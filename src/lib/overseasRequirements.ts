import { overseasRequirementsManifest } from '../data/overseasRequirementsManifest'
import { fetchJson } from './fetchJson'

/** 海外機構錄取條件原文（批 G8，R1）：英語要求與國際生年學費；只作展示，不出題。 */
export interface OverseasEnglishReq { ielts: number | null; toefl: number | null; toeflBand: number | null; scope: string; quote: string; quoteToefl: string | null; url: string; fetchedAt: string }
export interface OverseasTuitionReq { min: number; max: number | null; currency: string; academicYear: string | null; basis: string; quote: string; url: string; fetchedAt: string }
export interface OverseasRequirementsPayload { schema: string; rulesVersion: string; counts: { institutions: number; english: number; tuition: number }; institutions: Record<string, { english?: OverseasEnglishReq; tuition?: OverseasTuitionReq }> }

let promise: Promise<OverseasRequirementsPayload> | null = null
export function loadOverseasRequirements(): Promise<OverseasRequirementsPayload> {
  if (!promise) {
    promise = fetchJson<OverseasRequirementsPayload>(`${overseasRequirementsManifest.path}?v=${overseasRequirementsManifest.version}`)
      .then((p) => {
        const c = overseasRequirementsManifest.counts
        if (p.schema !== 'nope.overseas.requirements.v1' || p.counts.english !== c.english || p.counts.tuition !== c.tuition || Object.keys(p.institutions).length !== c.institutions) throw new Error('requirements payload mismatch')
        return p
      })
      .catch((e: unknown) => { promise = null; throw e })
  }
  return promise
}
