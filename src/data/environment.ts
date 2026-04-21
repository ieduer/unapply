// 地理／氣候／基礎設施權威數據
//
// 所有字段都可由「省份 + 城市」推導，權威來源：
// - 供暖：秦嶺-淮河分界線（國務院 1956 年制定；新華社、中央氣象局均採用）
//   https://www.gov.cn/ & http://www.cma.gov.cn/
// - 氣候帶：中國氣象局《中國氣候公報》——分為熱帶、亞熱帶、溫帶、寒溫帶、高原氣候
//   https://www.cma.gov.cn/2011xzt/essay/
// - 霧霾：生態環境部《中國生態環境狀況公報》
//   https://www.mee.gov.cn/hjzl/sthjzk/zghjzkgb/
// - 方言：《中國語言地圖集》（商務印書館／中國社科院）
//   https://www.cssn.cn/
// - 地鐵：中國城市軌道交通協會《城市軌道交通統計年鑑》（截至 2024）
//   https://www.camet.org.cn/
// - 沿海 / 高原：民政部《全國行政區劃》+ 中國地理常識
//   https://www.mca.gov.cn/

export type ClimateSummer = 'mild' | 'hot' | 'humid_hot' | 'extreme_hot';
export type ClimateWinter = 'warm' | 'mild' | 'cold' | 'extreme_cold';
export type HazeLevel = 'low' | 'medium' | 'high' | 'extreme';
export type DialectGroup =
  | '官話-北方'
  | '官話-西南'
  | '官話-江淮'
  | '吳語'
  | '粵語'
  | '閩南語'
  | '閩東語'
  | '客家話'
  | '湘語'
  | '贛語'
  | '晉語'
  | '藏語'
  | '維吾爾語'
  | '蒙古語'
  | '其他';

export interface ProvinceClimate {
  // 是否集中供暖（秦嶺-淮河以北）
  heating: boolean;
  // 夏季體感：mild ≤30°C 均溫、hot ≥35°C 常見、humid_hot 濕熱難耐、extreme_hot 吐魯番級
  summer: ClimateSummer;
  // 冬季：warm 不結冰、mild 偶結冰、cold 常-5°C、extreme_cold 低於-20°C
  winter: ClimateWinter;
  // 霧霾年均（PM2.5）：low<35、medium 35-50、high 50-70、extreme>70
  haze: HazeLevel;
  // 主要方言
  dialect: DialectGroup;
  // 是否沿海
  coastal: boolean;
  // 是否高海拔（>1500m）
  highland: boolean;
  // 代表菜系辣度
  spicy: 'low' | 'medium' | 'high';
}

// 省份 → 氣候／環境特徵
// 來源：中國氣象局氣候分區、國家統計局 2023、《中國語言地圖集》
export const PROVINCE_CLIMATE: Record<string, ProvinceClimate> = {
  // ========= 東北 =========
  黑龍江: { heating: true, summer: 'mild', winter: 'extreme_cold', haze: 'medium', dialect: '官話-北方', coastal: false, highland: false, spicy: 'medium' },
  吉林:   { heating: true, summer: 'mild', winter: 'extreme_cold', haze: 'medium', dialect: '官話-北方', coastal: false, highland: false, spicy: 'medium' },
  遼寧:   { heating: true, summer: 'hot',  winter: 'cold',         haze: 'high',   dialect: '官話-北方', coastal: true,  highland: false, spicy: 'medium' },

  // ========= 華北 =========
  北京:   { heating: true, summer: 'hot',  winter: 'cold',         haze: 'high',   dialect: '官話-北方', coastal: false, highland: false, spicy: 'low' },
  天津:   { heating: true, summer: 'hot',  winter: 'cold',         haze: 'high',   dialect: '官話-北方', coastal: true,  highland: false, spicy: 'low' },
  河北:   { heating: true, summer: 'hot',  winter: 'cold',         haze: 'extreme',dialect: '官話-北方', coastal: true,  highland: false, spicy: 'low' },
  山西:   { heating: true, summer: 'hot',  winter: 'cold',         haze: 'high',   dialect: '晉語',     coastal: false, highland: false, spicy: 'medium' },
  內蒙古: { heating: true, summer: 'mild', winter: 'extreme_cold', haze: 'medium', dialect: '蒙古語',   coastal: false, highland: true,  spicy: 'medium' },

  // ========= 華東 =========
  上海:   { heating: false, summer: 'humid_hot', winter: 'mild', haze: 'medium', dialect: '吳語',       coastal: true,  highland: false, spicy: 'low' },
  江蘇:   { heating: false, summer: 'humid_hot', winter: 'mild', haze: 'medium', dialect: '官話-江淮',  coastal: true,  highland: false, spicy: 'low' },
  浙江:   { heating: false, summer: 'humid_hot', winter: 'mild', haze: 'medium', dialect: '吳語',       coastal: true,  highland: false, spicy: 'low' },
  安徽:   { heating: false, summer: 'humid_hot', winter: 'mild', haze: 'high',   dialect: '官話-江淮',  coastal: false, highland: false, spicy: 'medium' },
  福建:   { heating: false, summer: 'humid_hot', winter: 'warm', haze: 'low',    dialect: '閩南語',     coastal: true,  highland: false, spicy: 'low' },
  江西:   { heating: false, summer: 'humid_hot', winter: 'mild', haze: 'medium', dialect: '贛語',       coastal: false, highland: false, spicy: 'high' },
  山東:   { heating: true,  summer: 'hot',       winter: 'cold', haze: 'high',   dialect: '官話-北方', coastal: true,  highland: false, spicy: 'low' },

  // ========= 華中 =========
  河南:   { heating: true,  summer: 'hot',       winter: 'cold', haze: 'extreme',dialect: '官話-北方', coastal: false, highland: false, spicy: 'medium' },
  湖北:   { heating: false, summer: 'humid_hot', winter: 'mild', haze: 'high',   dialect: '官話-西南', coastal: false, highland: false, spicy: 'high' },
  湖南:   { heating: false, summer: 'humid_hot', winter: 'mild', haze: 'medium', dialect: '湘語',       coastal: false, highland: false, spicy: 'high' },

  // ========= 華南 =========
  廣東:   { heating: false, summer: 'humid_hot', winter: 'warm', haze: 'low',    dialect: '粵語',       coastal: true,  highland: false, spicy: 'low' },
  廣西:   { heating: false, summer: 'humid_hot', winter: 'warm', haze: 'low',    dialect: '粵語',       coastal: true,  highland: false, spicy: 'medium' },
  海南:   { heating: false, summer: 'humid_hot', winter: 'warm', haze: 'low',    dialect: '閩南語',     coastal: true,  highland: false, spicy: 'low' },

  // ========= 西南 =========
  重慶:   { heating: false, summer: 'extreme_hot', winter: 'mild', haze: 'high',   dialect: '官話-西南', coastal: false, highland: false, spicy: 'high' },
  四川:   { heating: false, summer: 'humid_hot',   winter: 'mild', haze: 'high',   dialect: '官話-西南', coastal: false, highland: false, spicy: 'high' },
  貴州:   { heating: false, summer: 'mild',        winter: 'mild', haze: 'low',    dialect: '官話-西南', coastal: false, highland: true,  spicy: 'high' },
  雲南:   { heating: false, summer: 'mild',        winter: 'warm', haze: 'low',    dialect: '官話-西南', coastal: false, highland: true,  spicy: 'medium' },
  西藏:   { heating: true,  summer: 'mild',        winter: 'cold', haze: 'low',    dialect: '藏語',     coastal: false, highland: true,  spicy: 'medium' },

  // ========= 西北 =========
  陝西:   { heating: true,  summer: 'hot',  winter: 'cold',         haze: 'high',   dialect: '官話-北方', coastal: false, highland: false, spicy: 'medium' },
  甘肅:   { heating: true,  summer: 'hot',  winter: 'cold',         haze: 'medium', dialect: '官話-北方', coastal: false, highland: true,  spicy: 'medium' },
  青海:   { heating: true,  summer: 'mild', winter: 'extreme_cold', haze: 'low',    dialect: '官話-北方', coastal: false, highland: true,  spicy: 'medium' },
  寧夏:   { heating: true,  summer: 'hot',  winter: 'cold',         haze: 'medium', dialect: '官話-北方', coastal: false, highland: false, spicy: 'medium' },
  新疆:   { heating: true,  summer: 'extreme_hot', winter: 'extreme_cold', haze: 'low', dialect: '維吾爾語', coastal: false, highland: true, spicy: 'medium' },

  // ========= 港澳臺 =========
  香港:   { heating: false, summer: 'humid_hot', winter: 'warm', haze: 'low', dialect: '粵語',   coastal: true, highland: false, spicy: 'low' },
  澳門:   { heating: false, summer: 'humid_hot', winter: 'warm', haze: 'low', dialect: '粵語',   coastal: true, highland: false, spicy: 'low' },
  臺灣:   { heating: false, summer: 'humid_hot', winter: 'warm', haze: 'low', dialect: '閩南語', coastal: true, highland: false, spicy: 'low' },
};

// 已開通地鐵（含輕軌）的城市。
// 來源：中國城市軌道交通協會《城市軌道交通 2024 年度統計和分析報告》
// https://www.camet.org.cn/tjxx/
export const SUBWAY_CITIES: ReadonlySet<string> = new Set([
  // 2000 年前
  '北京', '上海', '廣州', '天津', '香港',
  // 2000-2010
  '深圳', '南京', '武漢', '重慶', '成都', '瀋陽', '佛山',
  // 2010-2015
  '西安', '蘇州', '昆明', '杭州', '哈爾濱', '鄭州', '長沙', '寧波', '大連', '無錫',
  // 2015-2020
  '青島', '南昌', '合肥', '南寧', '福州', '東莞', '貴陽', '廈門', '烏魯木齊',
  '長春', '石家莊', '濟南', '常州', '徐州', '呼和浩特', '蘭州', '太原', '紹興',
  // 2020-2024
  '溫州', '洛陽', '天水', '三亞', '珠海', '金華',
]);

const placeCharMap: Record<string, string> = {
  廣: '广', 州: '州', 深: '深', 圳: '圳', 武: '武', 漢: '汉',
  重: '重', 慶: '庆', 瀋: '沈', 蘇: '苏', 爾: '尔', 濱: '滨',
  鄭: '郑', 長: '长', 寧: '宁', 連: '连', 錫: '锡', 島: '岛',
  門: '门', 東: '东', 貴: '贵', 廈: '厦', 烏: '乌', 魯: '鲁',
  齊: '齐', 濟: '济', 紹: '绍', 溫: '温', 陽: '阳', 龍: '龙',
};

function normalizePlaceName(name: string): string {
  return name
    .replace(/市$/, '')
    .split('')
    .map((ch) => placeCharMap[ch] ?? ch)
    .join('');
}

const SUBWAY_CITY_KEYS = new Set(
  Array.from(SUBWAY_CITIES, (city) => normalizePlaceName(city)),
);

// 八大菜系辣度參考（省份推導）
// 省份 → 典型菜系：川湘贛鄂辣；粵閩滬淡；魯豫咸；東北/西北（見省份表 spicy 字段）

// ========= 導出 helper =========

export interface Environment {
  heating: 'yes' | 'no';
  summer: ClimateSummer;
  winter: ClimateWinter;
  haze: HazeLevel;
  dialect: DialectGroup;
  coastal: 'yes' | 'no';
  highland: 'yes' | 'no';
  subwayCity: 'yes' | 'no';
  spicy: 'low' | 'medium' | 'high';
}

export function getEnvironment(province: string, city: string): Environment | null {
  const c = PROVINCE_CLIMATE[province];
  if (!c) return null;
  return {
    heating: c.heating ? 'yes' : 'no',
    summer: c.summer,
    winter: c.winter,
    haze: c.haze,
    dialect: c.dialect,
    coastal: c.coastal ? 'yes' : 'no',
    highland: c.highland ? 'yes' : 'no',
    subwayCity: SUBWAY_CITY_KEYS.has(normalizePlaceName(city)) ? 'yes' : 'no',
    spicy: c.spicy,
  };
}
