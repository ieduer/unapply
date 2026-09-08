import type { School } from '../data/schools'
import type { CampusResearchRecord } from '../data/runtimeTypes'
import { campusBucketFileByProvince } from '../data/campusProvinceBuckets'
import { runtimeDataManifest } from '../data/runtimeManifest'

type CampusProvinceBucket = Record<string, CampusResearchRecord[]>

let schoolsPromise: Promise<School[]> | null = null
const campusBucketPromises = new Map<string, Promise<CampusProvinceBucket>>()

async function fetchRuntimeJson<T>(pathname: string): Promise<T> {
  const separator = pathname.includes('?') ? '&' : '?'
  const response = await fetch(`${pathname}${separator}v=${encodeURIComponent(runtimeDataManifest.version)}`, {
    credentials: 'same-origin',
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    throw new Error(`runtime payload request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export function loadSchools(): Promise<School[]> {
  if (!schoolsPromise) {
    schoolsPromise = fetchRuntimeJson<School[]>(runtimeDataManifest.schoolsPath).then((loaded) => {
      if (!Array.isArray(loaded) || loaded.length !== runtimeDataManifest.counts.schools
        || loaded.some((school) => !school || typeof school.moeCode !== 'string')
        || new Set(loaded.map((school) => school.moeCode)).size !== loaded.length) {
        throw new Error('學校目錄不完整，請重新載入')
      }
      return loaded
    }).catch((error: unknown) => {
      schoolsPromise = null
      throw error
    })
  }
  return schoolsPromise
}

export function loadCampusesByProvince(province: string): Promise<CampusProvinceBucket> {
  const key = province.trim()
  if (!key) return Promise.resolve({})
  const fileName = campusBucketFileByProvince[key]
  if (!fileName) return Promise.resolve({})

  if (!campusBucketPromises.has(key)) {
    const bucketPath = `${runtimeDataManifest.campusesBasePath}/${fileName}`
    const promise = fetchRuntimeJson<CampusProvinceBucket>(bucketPath).catch((error: unknown) => {
      campusBucketPromises.delete(key)
      throw error
    })
    campusBucketPromises.set(key, promise)
  }

  return campusBucketPromises.get(key)!
}
