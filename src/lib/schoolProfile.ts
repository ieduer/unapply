import type { School } from '../data/schools'

export type SpecialAdmissionTrack =
  | 'regular_gaokao'
  | 'art_exam'
  | 'sports_test'
  | 'military_police'
  | 'navigation_flight'

const levelLabelMap: Record<string, string> = {
  C9: 'C9',
  '985非C9': '985',
  '211非985': '211',
  '雙一流非211': '雙一流',
  普通本科: '普通本科',
  專科: '高職專科',
}

const cityTierLabelMap: Record<string, string> = {
  tier1: '一線城市',
  newtier1: '新一線城市',
  tier2: '二線城市',
  tier3_below: '三線及以下',
}

const campusLabelMap: Record<string, string> = {
  main_city: '主城主校區',
  suburb_with_metro: '遠郊但有地鐵',
  suburb: '遠郊校區',
  separate_freshman: '大一分校區',
}

const tuitionLabelMap: Record<string, string> = {
  公辦: '公辦學費',
  '1-3萬': '1-3 萬/年',
  '3-8萬': '3-8 萬/年',
  '8萬+': '8 萬+/年',
  '民辦/合作待核價': '民辦/合作待核價',
}

const specialTrackLabelMap: Record<SpecialAdmissionTrack, string> = {
  regular_gaokao: '普通高考常規統招',
  art_exam: '藝術/校考門檻',
  sports_test: '體育/體測門檻',
  military_police: '軍警/政審體測',
  navigation_flight: '航海/飛行/面試',
}

const artAcademyPattern = /(音樂學院|音乐学院|美術學院|美术学院|戲劇學院|戏剧学院|戏曲学院|舞蹈学院|电影学院|電影學院|美院|美术职业学院|艺术职业学院)/
const sportsPattern = /(體育學院|体育学院|体育职业学院)/
const militaryPolicePattern = /(公安|警察学院|警官学院|司法警官|消防救援学院|中国消防救援学院|中国刑事警察学院|國防科技|国防科技|陆军|海军|空军|武警|人民公安)/
const navigationFlightPattern = /(海事大学|海事职业|航海|飞行学院|飛行學院|民用航空飞行|航运)/

export function getSpecialAdmissionTracks(school: School): SpecialAdmissionTrack[] {
  const tracks = new Set<SpecialAdmissionTrack>(['regular_gaokao'])
  const name = school.name ?? ''

  if (school.type === '藝術' || artAcademyPattern.test(name)) tracks.add('art_exam')
  if (school.type === '體育' || sportsPattern.test(name)) tracks.add('sports_test')
  if (school.type === '軍事' || militaryPolicePattern.test(name)) tracks.add('military_police')
  if (navigationFlightPattern.test(name)) tracks.add('navigation_flight')

  return Array.from(tracks)
}

export function getSpecialAdmissionLabels(school: School): string[] {
  return getSpecialAdmissionTracks(school)
    .filter((track) => track !== 'regular_gaokao')
    .map((track) => specialTrackLabelMap[track])
}

export function buildSchoolTags(school: School): string[] {
  const tags: string[] = []

  if (school.level && levelLabelMap[school.level]) tags.push(levelLabelMap[school.level])
  if (school.type) tags.push(school.type)
  if (school.cityTier && cityTierLabelMap[school.cityTier]) tags.push(cityTierLabelMap[school.cityTier])
  tags.push(`${school.province} · ${school.city}`)
  if (school.mainCampusType && campusLabelMap[school.mainCampusType]) tags.push(campusLabelMap[school.mainCampusType])
  if (school.tuitionRange && tuitionLabelMap[school.tuitionRange]) tags.push(tuitionLabelMap[school.tuitionRange])
  tags.push(...getSpecialAdmissionLabels(school))

  if (school.tags?.length) {
    for (const tag of school.tags) tags.push(tag)
  }

  return Array.from(new Set(tags)).slice(0, 8)
}
