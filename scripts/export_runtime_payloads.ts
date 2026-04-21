import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { campusResearchByMoeCode, campusResearchMeta } from '../src/data/campusResearch.ts'
import { provincePortalsByProvince, researchPipelineMeta, schoolResearchProfilesByMoeCode } from '../src/data/researchData.ts'
import { schools } from '../src/data/schools.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const runtimeDir = path.join(repoRoot, 'public', 'data', 'runtime')
const campusesDir = path.join(runtimeDir, 'campuses')
const runtimeManifestPath = path.join(repoRoot, 'src', 'data', 'runtimeManifest.ts')
const provincePortalsPath = path.join(repoRoot, 'src', 'data', 'provinceAdmissionPortals.ts')
const campusBucketsPath = path.join(repoRoot, 'src', 'data', 'campusProvinceBuckets.ts')

const evidenceDimensions = new Set(['A5', 'B9', 'C5'])

function toJson(value: unknown): string {
  return JSON.stringify(value)
}

function toTsJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function createStableVersion(parts: unknown[]): string {
  const hash = createHash('sha256')
  for (const part of parts) {
    hash.update(JSON.stringify(part))
  }
  return hash.digest('hex').slice(0, 12)
}

function withDefinedEntries<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T
}

function pickRuntimeEvidence(moeCode?: string) {
  if (!moeCode) return undefined
  const evidence = schoolResearchProfilesByMoeCode[moeCode]?.evidence
  if (!evidence) return undefined

  const filtered = Object.fromEntries(
    Object.entries(evidence).filter(([dimensionId, items]) => evidenceDimensions.has(dimensionId) && items && items.length > 0),
  )

  return Object.keys(filtered).length > 0 ? filtered : undefined
}

async function writeJson(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, toJson(value), 'utf8')
}

async function main() {
  await fs.rm(runtimeDir, { recursive: true, force: true })
  await fs.mkdir(campusesDir, { recursive: true })

  const runtimeSchools = schools.map((school) => withDefinedEntries({
    id: school.id,
    name: school.name,
    nameSimplified: school.nameSimplified,
    nameEn: school.nameEn,
    province: school.province,
    city: school.city,
    schoolAddress: school.schoolAddress,
    cityTier: school.cityTier,
    level: school.level,
    type: school.type,
    website: school.website,
    admissionWebsite: school.admissionWebsite,
    mainCampusType: school.mainCampusType,
    campusFreshmanPolicy: school.campusFreshmanPolicy,
    tuitionRange: school.tuitionRange,
    ownership: school.ownership,
    moeCode: school.moeCode,
    moeLevel: school.moeLevel,
    tags: school.tags,
    quality: school.quality,
    researchEvidence: pickRuntimeEvidence(school.moeCode),
  }))

  await writeJson(path.join(runtimeDir, 'schools.json'), runtimeSchools)

  const provinceBuckets = new Map<string, Record<string, unknown[]>>()
  const schoolProvinceByMoeCode = new Map(
    runtimeSchools
      .filter((school) => typeof school.moeCode === 'string' && typeof school.province === 'string')
      .map((school) => [school.moeCode as string, school.province as string]),
  )

  for (const [moeCode, campuses] of Object.entries(campusResearchByMoeCode)) {
    const province = schoolProvinceByMoeCode.get(moeCode) ?? campuses[0]?.province
    if (!province) continue
    if (!provinceBuckets.has(province)) provinceBuckets.set(province, {})
    provinceBuckets.get(province)![moeCode] = campuses
  }

  const campusBucketFileByProvince = {}
  const sortedProvinceBuckets = Array.from(provinceBuckets.entries()).sort(([left], [right]) => left.localeCompare(right, 'zh-Hans-CN'))
  for (const [index, [province, bucket]] of sortedProvinceBuckets.entries()) {
    const fileName = `campus-${String(index + 1).padStart(2, '0')}.json`
    campusBucketFileByProvince[province] = fileName
    await writeJson(path.join(campusesDir, fileName), bucket)
  }

  const orderedProvincePortals = Object.fromEntries(
    Object.entries(provincePortalsByProvince).sort(([left], [right]) => left.localeCompare(right, 'zh-Hans-CN')),
  )

  const runtimeManifest = {
    version: createStableVersion([
      runtimeSchools,
      sortedProvinceBuckets.map(([province, bucket]) => [province, bucket]),
      orderedProvincePortals,
      researchPipelineMeta?.counts ?? null,
      campusResearchMeta?.counts ?? null,
    ]),
    schoolsPath: '/data/runtime/schools.json',
    campusesBasePath: '/data/runtime/campuses',
    counts: {
      schools: runtimeSchools.length,
      campusBuckets: provinceBuckets.size,
      campusRows: Number(campusResearchMeta?.counts?.campusRows ?? Object.keys(campusResearchByMoeCode).length),
    },
  }

  await fs.writeFile(
    runtimeManifestPath,
    `// Generated by scripts/export_runtime_payloads.ts. Do not edit by hand.\n`
      + `export const runtimeDataManifest = ${toTsJson(runtimeManifest)} as const\n`,
    'utf8',
  )

  await fs.writeFile(
    provincePortalsPath,
    `// Generated by scripts/export_runtime_payloads.ts. Do not edit by hand.\n`
      + `import type { ProvinceAdmissionPortal } from './runtimeTypes'\n\n`
      + `export const provincePortalsByProvince: Record<string, ProvinceAdmissionPortal> = ${toTsJson(orderedProvincePortals)}\n`,
    'utf8',
  )

  await fs.writeFile(
    campusBucketsPath,
    `// Generated by scripts/export_runtime_payloads.ts. Do not edit by hand.\n`
      + `export const campusBucketFileByProvince: Record<string, string> = ${toTsJson(campusBucketFileByProvince)}\n`,
    'utf8',
  )

  console.log(`wrote public runtime payloads to ${path.relative(repoRoot, runtimeDir)}`)
  console.log(JSON.stringify(runtimeManifest, null, 2))
}

await main()
