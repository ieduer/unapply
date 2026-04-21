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
  })

  if (!response.ok) {
    throw new Error(`runtime payload request failed: ${response.status} ${response.statusText}`)
  }

  return response.json() as Promise<T>
}

export function loadSchools(): Promise<School[]> {
  if (!schoolsPromise) {
    schoolsPromise = fetchRuntimeJson<School[]>(runtimeDataManifest.schoolsPath)
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
      if (error instanceof Error && /404/.test(error.message)) return {}
      throw error
    })
    campusBucketPromises.set(key, promise)
  }

  return campusBucketPromises.get(key)!
}
