import type { School } from './schools'
import { provincePortalsByProvince } from './provinceAdmissionPortals'
import { sortProvinces } from './provinceOrder'

export interface AdmissionResourceLink {
  /** zh-Hant 標籤（引擎語言）；展示層用 labelKey＋labelParams 翻譯（link.*）。 */
  label: string
  labelKey: string
  labelParams?: { province: string }
  url: string
  kind: 'official' | 'authority'
  note?: string
  noteKey?: string
}

// 批 G8b：照行政區劃代碼排序（北京 11 … 新疆 65），不再用物件鍵的拼音序
export const candidateProvinceOptions = sortProvinces(Object.keys(provincePortalsByProvince) as CandidateProvince[])

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
      labelKey: 'link.officialSite',
      url: school.website,
      kind: 'official',
    })
  }

  if (school.admissionWebsite) {
    links.push({
      label: '本科招生網',
      labelKey: 'link.admissionSite',
      url: school.admissionWebsite,
      kind: 'official',
    })
  }

  links.push({
    label: '陽光高考院校庫',
    labelKey: 'link.chsi',
    url: buildChsiSchoolSearchUrl(school.nameSimplified ?? school.name),
    kind: 'authority',
    note: '教育部學生服務與素質發展中心',
    noteKey: 'link.chsi.note',
  })

  if (provincePortal?.scoreQueryUrl) {
    links.push({
      label: `${candidateProvince}近年錄取/分數線`,
      labelKey: 'link.provinceScores',
      labelParams: { province: candidateProvince },
      url: provincePortal.scoreQueryUrl,
      kind: 'official',
      note: provincePortal.authorityName,
    })
  } else if (provincePortal?.portalUrl) {
    links.push({
      label: `${candidateProvince}招考入口`,
      labelKey: 'link.provincePortal',
      labelParams: { province: candidateProvince },
      url: provincePortal.portalUrl,
      kind: 'official',
      note: provincePortal.authorityName,
    })
  }

  if (provincePortal?.planQueryUrl) {
    links.push({
      label: `${candidateProvince}招生計劃`,
      labelKey: 'link.provincePlan',
      labelParams: { province: candidateProvince },
      url: provincePortal.planQueryUrl,
      kind: 'official',
      note: provincePortal.authorityName,
    })
  }

  return links
}
