import type { School } from './schools'
import { provincePortalsByProvince } from './provinceAdmissionPortals'

export interface AdmissionResourceLink {
  label: string
  url: string
  kind: 'official' | 'authority'
  note?: string
}

export const candidateProvinceOptions = Object.keys(provincePortalsByProvince) as CandidateProvince[]

export type CandidateProvince = keyof typeof provincePortalsByProvince

export const defaultCandidateProvince: CandidateProvince = '北京'

export function buildChsiSchoolSearchUrl(schoolName: string): string {
  return `https://gaokao.chsi.com.cn/sch/search.do?searchType=1&yxmc=${encodeURIComponent(schoolName)}`
}

export function getAdmissionResourceLinks(
  school: School,
  candidateProvince: CandidateProvince = defaultCandidateProvince,
): AdmissionResourceLink[] {
  const links: AdmissionResourceLink[] = []
  const provincePortal = provincePortalsByProvince[candidateProvince]

  if (school.website) {
    links.push({
      label: '學校官網',
      url: school.website,
      kind: 'official',
    })
  }

  if (school.admissionWebsite) {
    links.push({
      label: '本科招生網',
      url: school.admissionWebsite,
      kind: 'official',
    })
  }

  links.push({
    label: '陽光高考院校庫',
    url: buildChsiSchoolSearchUrl(school.nameSimplified ?? school.name),
    kind: 'authority',
    note: '教育部學生服務與素質發展中心',
  })

  if (provincePortal?.scoreQueryUrl) {
    links.push({
      label: `${candidateProvince}近年錄取/分數線`,
      url: provincePortal.scoreQueryUrl,
      kind: 'official',
      note: provincePortal.authorityName,
    })
  } else if (provincePortal?.portalUrl) {
    links.push({
      label: `${candidateProvince}招考入口`,
      url: provincePortal.portalUrl,
      kind: 'official',
      note: provincePortal.authorityName,
    })
  }

  if (provincePortal?.planQueryUrl) {
    links.push({
      label: `${candidateProvince}招生計劃`,
      url: provincePortal.planQueryUrl,
      kind: 'official',
      note: provincePortal.authorityName,
    })
  }

  return links
}
