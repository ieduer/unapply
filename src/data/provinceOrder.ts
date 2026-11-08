// 省級行政區的標準順序（2026-11-08 批 G8b）：GB/T 2260 行政區劃代碼，與教育部學校標識碼第 3–4 位相同（北京 11 … 新疆 65）。
// 全站省份清單（考生省份下拉、查詢頁省份過濾、選考科目來源省表）一律照這個順序，三語相同；`tests/province-order.test.ts` 逐校核對代碼。
// 鍵是站內省名（正體，A1 取值原文）；簡體寫法另列，讓研究資料的簡體省名也排得對。
export const PROVINCE_CODE: Readonly<Record<string, number>> = {
  北京: 11, 天津: 12, 河北: 13, 山西: 14, 內蒙古: 15,
  遼寧: 21, 吉林: 22, 黑龍江: 23,
  上海: 31, 江蘇: 32, 浙江: 33, 安徽: 34, 福建: 35, 江西: 36, 山東: 37,
  河南: 41, 湖北: 42, 湖南: 43, 廣東: 44, 廣西: 45, 海南: 46,
  重慶: 50, 四川: 51, 貴州: 52, 雲南: 53, 西藏: 54,
  陝西: 61, 甘肅: 62, 青海: 63, 寧夏: 64, 新疆: 65,
  臺灣: 71, 香港: 81, 澳門: 82,
  // 簡體寫法
  内蒙古: 15, 辽宁: 21, 黑龙江: 23, 江苏: 32, 山东: 37, 广东: 44, 广西: 45, 重庆: 50, 贵州: 52, 云南: 53, 陕西: 61, 甘肃: 62, 宁夏: 64, 台湾: 71, 澳门: 82,
}

/** 省名排序比較：有代碼的照代碼；沒有代碼的排在後面、按字串。 */
export function compareProvinces(a: string, b: string): number {
  const ca = PROVINCE_CODE[a] ?? 999, cb = PROVINCE_CODE[b] ?? 999
  return ca - cb || a.localeCompare(b)
}

export function sortProvinces<T extends string>(provinces: Iterable<T>): T[] {
  return [...provinces].sort(compareProvinces)
}
