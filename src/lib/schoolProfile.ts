import type { School } from '../data/schools'

export type SpecialAdmissionTrack =
  | 'regular_gaokao'
  | 'comprehensive_eval'
  | 'art_exam'
  | 'sports_test'
  | 'military_police'
  | 'navigation_flight'

// A6 是逐省判定的：同一所學校對不同省份的考生，答案可以不一樣。
// 上海科技大學 2025 年在 18 省只有綜合評價，但安徽考生走普通本科批。
export interface AdmissionContext {
  candidateProvince?: string
}

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
  民辦待核價: '民辦學費待核價',
  中外合作待核價: '中外合作學費待核價',
}

const specialTrackLabelMap: Record<SpecialAdmissionTrack, string> = {
  regular_gaokao: '普通高考常規統招',
  comprehensive_eval: '綜評校測·無常規批',
  art_exam: '藝術/校考門檻',
  sports_test: '體育/體測門檻',
  military_police: '軍警/政審體測',
  navigation_flight: '航海/飛行/面試',
}

const artAcademyPattern = /(音樂學院|音乐学院|美術學院|美术学院|戲劇學院|戏剧学院|戏曲学院|舞蹈学院|电影学院|電影學院|美院|美术职业学院|艺术职业学院)/
const sportsPattern = /(體育學院|体育学院|体育职业学院)/
const militaryPolicePattern = /(公安|警察学院|警官学院|司法警官|消防救援学院|中国消防救援学院|中国刑事警察学院|國防科技|国防科技|陆军|海军|空军|武警|人民公安)/
const navigationFlightPattern = /(海事大学|海事职业|航海|飞行学院|飛行學院|民用航空飞行|航运)/

function hasProvince(list: string[] | undefined, province: string | undefined): boolean {
  if (!list || list.length === 0) return false
  if (list.includes('all')) return true
  if (!province) return false
  return list.includes(province)
}

// 判斷「這位考生能不能只靠填志願錄進這所學校」。
//
// 四個分支的共同性質：只要證據不足，一律回到 regular_gaokao 先驗。
// 保守方向永遠是「留著讓用戶自己看」，不是「替他劃掉」。
export function getRegularChannelState(
  school: School,
  ctx?: AdmissionContext,
): 'regular' | 'comprehensive_only' {
  const channels = school.admissionChannels
  if (!channels) return 'regular'                                    // 未收錄 → 先驗

  const province = ctx?.candidateProvince
  if (hasProvince(channels.regularProvinces, province)) return 'regular'          // 該省有常規批
  if (hasProvince(channels.comprehensiveProvinces, province)) return 'comprehensive_only'  // 該省只有綜評

  if (province) {
    // 該校收錄了，但沒覆蓋到這個省 —— 通常是不在該省招生，或口徑未查實。
    // 兩種情況都不該替考生做排除決定。
    return 'regular'
  }

  // 沒有考生省份時，只有「全國口徑皆無常規批」才判定為綜評專屬。
  const noRegularAnywhere = channels.regularProvinces.length === 0
  const comprehensiveEverywhere = channels.comprehensiveProvinces.includes('all')
  return noRegularAnywhere && comprehensiveEverywhere ? 'comprehensive_only' : 'regular'
}

export function getSpecialAdmissionTracks(
  school: School,
  ctx?: AdmissionContext,
): SpecialAdmissionTrack[] {
  const tracks = new Set<SpecialAdmissionTrack>([
    getRegularChannelState(school, ctx) === 'comprehensive_only' ? 'comprehensive_eval' : 'regular_gaokao',
  ])
  const name = school.name ?? ''

  if (school.type === '藝術' || artAcademyPattern.test(name)) tracks.add('art_exam')
  if (school.type === '體育' || sportsPattern.test(name)) tracks.add('sports_test')
  if (school.type === '軍事' || militaryPolicePattern.test(name)) tracks.add('military_police')
  if (navigationFlightPattern.test(name)) tracks.add('navigation_flight')

  return Array.from(tracks)
}

export function getSpecialAdmissionLabels(school: School, ctx?: AdmissionContext): string[] {
  return getSpecialAdmissionTracks(school, ctx)
    .filter((track) => track !== 'regular_gaokao')
    .map((track) => specialTrackLabelMap[track])
}

export function buildSchoolTags(school: School, ctx?: AdmissionContext): string[] {
  const tags: string[] = []

  if (school.level && levelLabelMap[school.level]) tags.push(levelLabelMap[school.level])
  if (school.type) tags.push(school.type)
  if (school.cityTier && cityTierLabelMap[school.cityTier]) tags.push(cityTierLabelMap[school.cityTier])
  tags.push(`${school.province} · ${school.city}`)
  if (school.mainCampusType && campusLabelMap[school.mainCampusType]) tags.push(campusLabelMap[school.mainCampusType])
  if (school.tuitionRange && tuitionLabelMap[school.tuitionRange]) tags.push(tuitionLabelMap[school.tuitionRange])
  tags.push(...getSpecialAdmissionLabels(school, ctx))

  if (school.tags?.length) {
    for (const tag of school.tags) tags.push(tag)
  }

  return Array.from(new Set(tags)).slice(0, 8)
}
