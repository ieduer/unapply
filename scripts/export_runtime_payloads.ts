import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { campusResearchByMoeCode, campusResearchMeta } from '../src/data/campusResearch.ts'
import { provincePortalsByProvince, researchPipelineMeta, schoolResearchProfilesByMoeCode } from '../src/data/researchData.ts'
import { schools } from '../src/data/schools.ts'
import { SCHOOLS_CORE_FORMAT, decodeSchoolsCore, encodeSchoolsCore, toEvidenceCore } from '../src/data/runtimeCore.ts'
import type { EvidenceBucket } from '../src/data/runtimeCore.ts'
import type { CanonicalSchool } from '../src/data/schools.ts'
import { isDeepStrictEqual } from 'node:util'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const runtimeDir = path.join(repoRoot, 'public', 'data', 'runtime')
const campusesDir = path.join(runtimeDir, 'campuses')
const runtimeManifestPath = path.join(repoRoot, 'src', 'data', 'runtimeManifest.ts')
const provincePortalsPath = path.join(repoRoot, 'src', 'data', 'provinceAdmissionPortals.ts')
const campusBucketsPath = path.join(repoRoot, 'src', 'data', 'campusProvinceBuckets.ts')
const evidenceDir = path.join(runtimeDir, 'evidence')
const evidenceBucketsPath = path.join(repoRoot, 'src', 'data', 'evidenceProvinceBuckets.ts')

const evidenceDimensions = new Set(['A5', 'C5', ...Array.from({ length: 24 }, (_, i) => `B${i + 1}`)])

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
    qualityEvidence: school.qualityEvidence,
    admissionChannels: school.admissionChannels,
    researchEvidence: pickRuntimeEvidence(school.moeCode),
  }))

  await writeJson(path.join(runtimeDir, 'schools.json'), runtimeSchools)

  // 生活維度證據的完整票數按省分桶（學校詳情頁才載）；瀏覽器進問卷前載的瘦身目錄不帶票數（批 H1）。
  const evidenceBuckets = new Map<string, EvidenceBucket>()
  let evidenceSchools = 0
  for (const school of runtimeSchools as CanonicalSchool[]) {
    if (!school.qualityEvidence) continue
    if (typeof school.moeCode !== 'string' || typeof school.province !== 'string') {
      throw new Error(`school with quality evidence lacks moeCode/province: ${school.name}`)
    }
    if (!evidenceBuckets.has(school.province)) evidenceBuckets.set(school.province, {})
    evidenceBuckets.get(school.province)![school.moeCode] = school.qualityEvidence
    evidenceSchools += 1
  }
  const evidenceBucketFileByProvince: Record<string, string> = {}
  const sortedEvidenceBuckets = Array.from(evidenceBuckets.entries()).sort(([left], [right]) => left.localeCompare(right, 'zh-Hans-CN'))
  for (const [index, [province, bucket]] of sortedEvidenceBuckets.entries()) {
    const fileName = `evidence-${String(index + 1).padStart(2, '0')}.json`
    evidenceBucketFileByProvince[province] = fileName
    await writeJson(path.join(evidenceDir, fileName), bucket)
  }

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

  // 版本只由資料內容決定（與批 H1 之前相同的輸入，所以版本值不變）；瘦身目錄與 evidence 桶都是 runtimeSchools 的純衍生物。
  const version = createStableVersion([
    runtimeSchools,
    sortedProvinceBuckets.map(([province, bucket]) => [province, bucket]),
    orderedProvincePortals,
    researchPipelineMeta?.counts ?? null,
    campusResearchMeta?.counts ?? null,
  ])

  // 瘦身目錄：瀏覽器進問卷前唯一要載的學校檔。寫出前先自我核對——
  // （1）解碼後除 qualityEvidence 外與 canonical 逐欄相同；（2）每個取值的最小證據與 canonical 一致；
  // （3）瘦身目錄＋evidence 桶可以完整還原 canonical。任何一條不成立就不產出。
  const corePayload = encodeSchoolsCore(runtimeSchools as CanonicalSchool[], version)
  const coreJson = toJson(corePayload)
  const decoded = decodeSchoolsCore(JSON.parse(coreJson))
  if (decoded.length !== runtimeSchools.length) throw new Error('schools core self-check: length mismatch')
  for (const [index, canonical] of (runtimeSchools as CanonicalSchool[]).entries()) {
    const slim = decoded[index]
    const { qualityEvidence: fullEvidence, ...canonicalRest } = canonical
    const { qualityEvidence: coreEvidence, ...slimRest } = slim
    if (!isDeepStrictEqual(slimRest, canonicalRest)) throw new Error(`schools core self-check: fields differ for ${canonical.name}`)
    const expectedCore = fullEvidence
      ? Object.fromEntries(Object.entries(fullEvidence).map(([dimension, meta]) => [dimension, toEvidenceCore(meta!)]))
      : undefined
    if (!isDeepStrictEqual(coreEvidence, expectedCore)) throw new Error(`schools core self-check: evidence core differs for ${canonical.name}`)
    const restored = fullEvidence ? evidenceBuckets.get(canonical.province)?.[canonical.moeCode as string] : undefined
    if (!isDeepStrictEqual(restored, fullEvidence)) throw new Error(`schools core self-check: evidence bucket differs for ${canonical.name}`)
  }
  await fs.writeFile(path.join(runtimeDir, 'schools.core.json'), coreJson, 'utf8')

  const runtimeManifest = {
    version,
    schoolsPath: '/data/runtime/schools.json',
    schoolsCorePath: '/data/runtime/schools.core.json',
    schoolsCoreFormat: SCHOOLS_CORE_FORMAT,
    schoolsCoreBytes: Buffer.byteLength(coreJson, 'utf8'),
    campusesBasePath: '/data/runtime/campuses',
    evidenceBasePath: '/data/runtime/evidence',
    counts: {
      schools: runtimeSchools.length,
      campusBuckets: provinceBuckets.size,
      campusRows: Number(campusResearchMeta?.counts?.campusRows ?? Object.keys(campusResearchByMoeCode).length),
      evidenceBuckets: evidenceBuckets.size,
      evidenceSchools,
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

  await fs.writeFile(
    evidenceBucketsPath,
    `// Generated by scripts/export_runtime_payloads.ts. Do not edit by hand.\n`
      + `export const evidenceBucketFileByProvince: Record<string, string> = ${toTsJson(evidenceBucketFileByProvince)}\n`,
    'utf8',
  )

  console.log(`wrote public runtime payloads to ${path.relative(repoRoot, runtimeDir)}`)
  console.log(JSON.stringify(runtimeManifest, null, 2))
}

await main()
