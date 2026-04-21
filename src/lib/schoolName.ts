const traditionalMap: Record<string, string> = {
  學: '学', 國: '国', 華: '华', 東: '东', 師: '师', 範: '范', 農: '农',
  醫: '医', 藥: '药', 財: '财', 經: '经', 貿: '贸', 傳: '传', 樂: '乐',
  對: '对', 門: '门', 廈: '厦', 遼: '辽', 連: '连', 瀋: '沈', 濟: '济',
  龍: '龙', 蘭: '兰', 陝: '陕', 郵: '邮', 電: '电', 業: '业', 礦: '矿',
  質: '质', 術: '术', 蘇: '苏', 錫: '锡', 寧: '宁', 廣: '广', 慶: '庆',
  雲: '云', 貴: '贵', 內: '内', 爾: '尔', 濱: '滨', 烏: '乌', 齊: '齐',
  鄭: '郑', 長: '长', 體: '体', 藝: '艺', 劇: '剧',
};

const campusSuffixPatterns = [
  /（威海）/g,
  /（深圳）/g,
  /威海校区/g,
  /深圳校区/g,
  /秦皇岛分校/g,
  /宣城校区/g,
  /珠海校区/g,
  /盘锦校区/g,
  /天目湖校区/g,
  /浑南校区/g,
  /克拉玛依校区/g,
  /沙河校区/g,
  /医学部/g,
] as const;

export function normalizeSchoolName(name: string): string {
  let value = name
    .trim()
    .replace(/－/g, '-')
    .replace(/—/g, '-')
    .replace(/\s+/g, '')
    .split('')
    .map((char) => traditionalMap[char] ?? char)
    .join('');

  value = value
    .replace(/国防科技大学/g, '国防科学技术大学')
    .replace(/中国地质大学北京/g, '中国地质大学（北京）')
    .replace(/中国地质大学武汉/g, '中国地质大学（武汉）')
    .replace(/中国石油大学北京/g, '中国石油大学（北京）')
    .replace(/中国石油大学华东/g, '中国石油大学（华东）')
    .replace(/北京师范大学-香港浸会大学联合国际学院/g, '北京师范大学－香港浸会大学联合国际学院')
    .replace(/华北电力大学（北京）/g, '华北电力大学')
    .replace(/华北电力大学北京/g, '华北电力大学');

  for (const pattern of campusSuffixPatterns) {
    value = value.replace(pattern, '');
  }

  return value;
}
