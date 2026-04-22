// 43 維減法問卷底表 v1.6
//   A 紅線 6（權威/保守推導）+ E 環境 8（省份+城市客觀推導）+ B 生活 24（CollegesChat／用戶貢獻）+ C 特殊 5
// 每個選項帶 excludes 或 requires 規則，由 FilterEngine 套用。
// 文案原則：中性描述，不做價值判斷；所有題都可跳過 = 不參與篩選。
// 數據原則：缺失就缺失（疑罪從無），不默認。B/C crowdsourced 維度引導用戶貢獻。

import type { DimensionId } from './dimensions';

export type QuestionType = 'single' | 'multi';

export interface QuestionOption {
  key: string;
  label: string;
  hint?: string;
  excludes?: { dim: DimensionId; values: string[] }[];
  requires?: { dim: DimensionId; values: string[] }[];
}

export interface Question {
  id: DimensionId;
  section: 'A_redline' | 'E_environment' | 'B_quality' | 'C_special';
  title: string;
  subtitle?: string;
  type: QuestionType;
  skippable: boolean;
  options: QuestionOption[];
  // 標記：該題的數據是否為權威／可客觀推導。
  // 'authoritative' = 官方名單或地理推導，覆蓋所有學校；
  // 'mixed' = 有權威/客觀來源，但目前仍需校區、專業或年度級補齊；
  // 'crowdsourced' = CollegesChat / 用戶貢獻，覆蓋率低，缺失時本題對該校不排除。
  dataStatus: 'authoritative' | 'mixed' | 'crowdsourced';
}

// ========== A 紅線（6 題） ==========
const sectionA: Question[] = [
  {
    id: 'A1',
    section: 'A_redline',
    dataStatus: 'authoritative',
    title: '哪些地區你一定不去？',
    subtitle: '可多選；選中的地區所有學校會被直接劃掉。',
    type: 'multi',
    skippable: true,
    options: [
      { key: 'jingjin', label: '北京／天津',
        excludes: [{ dim: 'A1', values: ['北京', '天津'] }] },
      { key: 'shanghai_jiangzhe', label: '上海／江蘇／浙江',
        excludes: [{ dim: 'A1', values: ['上海', '江蘇', '浙江'] }] },
      { key: 'guangdong', label: '廣東',
        excludes: [{ dim: 'A1', values: ['廣東'] }] },
      { key: 'fujian', label: '福建',
        excludes: [{ dim: 'A1', values: ['福建'] }] },
      { key: 'northeast', label: '東三省（黑龍江／吉林／遼寧）',
        excludes: [{ dim: 'A1', values: ['黑龍江', '吉林', '遼寧'] }] },
      { key: 'north_plain', label: '河北／山東／河南',
        excludes: [{ dim: 'A1', values: ['河北', '山東', '河南'] }] },
      { key: 'shanxi_inner_mongolia', label: '山西／內蒙古',
        excludes: [{ dim: 'A1', values: ['山西', '內蒙古'] }] },
      { key: 'shaanxi', label: '陝西（西安／咸陽／楊凌）',
        excludes: [{ dim: 'A1', values: ['陝西'] }] },
      { key: 'gansu_ningxia', label: '甘肅／寧夏',
        excludes: [{ dim: 'A1', values: ['甘肅', '寧夏'] }] },
      { key: 'qinghai_tibet', label: '青海／西藏（高海拔）',
        excludes: [{ dim: 'A1', values: ['青海', '西藏'] }] },
      { key: 'xinjiang', label: '新疆',
        excludes: [{ dim: 'A1', values: ['新疆'] }] },
      { key: 'sichuan_chongqing', label: '川渝',
        excludes: [{ dim: 'A1', values: ['四川', '重慶'] }] },
      { key: 'yungui', label: '雲南／貴州',
        excludes: [{ dim: 'A1', values: ['雲南', '貴州'] }] },
      { key: 'southisland', label: '海南／廣西',
        excludes: [{ dim: 'A1', values: ['海南', '廣西'] }] },
      { key: 'hubei_hunan', label: '湖北／湖南',
        excludes: [{ dim: 'A1', values: ['湖北', '湖南'] }] },
      { key: 'anhui_jiangxi', label: '安徽／江西',
        excludes: [{ dim: 'A1', values: ['安徽', '江西'] }] },
      { key: 'none', label: '都可以' },
    ],
  },
  {
    id: 'A2',
    section: 'A_redline',
    dataStatus: 'mixed',
    title: '城市等級底線？',
    subtitle: '低於這個等級的城市，直接劃掉。',
    type: 'single',
    skippable: true,
    options: [
      { key: 'tier1', label: '只考北上廣深',
        excludes: [{ dim: 'A2', values: ['newtier1', 'tier2', 'tier3_below'] }] },
      { key: 'newtier1', label: '新一線及以上',
        hint: '含成都、杭州、武漢、南京、蘇州、西安、重慶、長沙、青島、瀋陽、合肥、佛山、鄭州、東莞、昆明。',
        excludes: [{ dim: 'A2', values: ['tier2', 'tier3_below'] }] },
      { key: 'tier2', label: '二線及以上（省會級別）',
        excludes: [{ dim: 'A2', values: ['tier3_below'] }] },
      { key: 'any', label: '不挑城市' },
    ],
  },
  {
    id: 'A3',
    section: 'A_redline',
    dataStatus: 'authoritative',
    title: '學校層次門檻？',
    subtitle: '標準越高，後面能劃的學校越少。',
    type: 'single',
    skippable: true,
    options: [
      { key: 'c9', label: 'C9 聯盟',
        excludes: [{ dim: 'A3', values: ['985非C9', '211非985', '雙一流非211', '普通本科', '專科'] }] },
      { key: '985', label: '985 及以上',
        excludes: [{ dim: 'A3', values: ['211非985', '雙一流非211', '普通本科', '專科'] }] },
      { key: '211', label: '211 及以上',
        excludes: [{ dim: 'A3', values: ['雙一流非211', '普通本科', '專科'] }] },
      { key: 'doubleFirst', label: '雙一流及以上',
        excludes: [{ dim: 'A3', values: ['普通本科', '專科'] }] },
      { key: 'bachelor', label: '普通本科及以上',
        excludes: [{ dim: 'A3', values: ['專科'] }] },
      { key: 'any', label: '不限' },
    ],
  },
  {
    id: 'A4',
    section: 'A_redline',
    dataStatus: 'mixed',
    title: '每年學費上限？',
    subtitle: '官方名單能確認公辦、民辦與合作辦學；民辦/合作校精確金額未核價時不硬填。',
    type: 'single',
    skippable: true,
    options: [
      { key: 'public', label: '公辦標準（≤ 1 萬）',
        excludes: [{ dim: 'A4', values: ['1-3萬', '3-8萬', '8萬+', '民辦/合作待核價'] }] },
      { key: 'mid', label: '≤ 3 萬（可接受民辦）',
        excludes: [{ dim: 'A4', values: ['3-8萬', '8萬+'] }] },
      { key: 'high', label: '≤ 8 萬（含部分中外合作）',
        excludes: [{ dim: 'A4', values: ['8萬+'] }] },
      { key: 'any', label: '不限' },
    ],
  },
  {
    id: 'A5',
    section: 'A_redline',
    dataStatus: 'mixed',
    title: '校區位置？',
    subtitle: '部分學校本科生四年在遠郊新校區，和想像的「城市大學」體驗差別大。',
    type: 'single',
    skippable: true,
    options: [
      { key: 'main_only', label: '必須主校區（老校區／市中心）',
        excludes: [{ dim: 'A5', values: ['suburb_with_metro', 'suburb', 'separate_freshman'] }] },
      { key: 'metro_ok', label: '新校區可以，但要有地鐵',
        excludes: [{ dim: 'A5', values: ['suburb', 'separate_freshman'] }] },
      { key: 'no_freshman_split', label: '不接受大一單獨分校區',
        excludes: [{ dim: 'A5', values: ['separate_freshman'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'A6',
    section: 'A_redline',
    dataStatus: 'mixed',
    title: '特殊招生／特長門檻？',
    subtitle: '如果你只走普通高考常規統招，先把要校考、體測、政審或面試的院校排掉。',
    type: 'single',
    skippable: true,
    options: [
      { key: 'regular_only', label: '只看普通高考常規統招',
        excludes: [{ dim: 'A6', values: ['art_exam', 'sports_test', 'military_police', 'navigation_flight'] }] },
      { key: 'no_art_sports', label: '排掉藝術／體育特長類',
        excludes: [{ dim: 'A6', values: ['art_exam', 'sports_test'] }] },
      { key: 'no_screening', label: '排掉軍警／航海／飛行類',
        excludes: [{ dim: 'A6', values: ['military_police', 'navigation_flight'] }] },
      { key: 'any', label: '都看' },
    ],
  },
];

// ========== E 環境／地理（8 題，由省份+城市客觀推導） ==========
const sectionE: Question[] = [
  {
    id: 'E1', section: 'E_environment', dataStatus: 'authoritative',
    type: 'single', skippable: true,
    title: '冬天要不要集中供暖？',
    subtitle: '秦嶺-淮河以北有集中供暖，以南沒有（空調或小太陽自理）。',
    options: [
      { key: 'need', label: '必須有供暖',   excludes: [{ dim: 'E1', values: ['no'] }] },
      { key: 'avoid', label: '不要供暖城市', excludes: [{ dim: 'E1', values: ['yes'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'E2', section: 'E_environment', dataStatus: 'authoritative',
    type: 'single', skippable: true,
    title: '夏天體感底線？',
    subtitle: '重慶、南京、武漢、長沙素稱「火爐」；新疆吐魯番乾熱極端。',
    options: [
      { key: 'no_extreme', label: '不接受極端酷熱（重慶／吐魯番級）', excludes: [{ dim: 'E2', values: ['extreme_hot'] }] },
      { key: 'no_humid', label: '不接受濕熱（江南／華南）', excludes: [{ dim: 'E2', values: ['humid_hot', 'extreme_hot'] }] },
      { key: 'cool_only', label: '只要涼爽夏天',           excludes: [{ dim: 'E2', values: ['hot', 'humid_hot', 'extreme_hot'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'E3', section: 'E_environment', dataStatus: 'authoritative',
    type: 'single', skippable: true,
    title: '冬天冷到什麼程度可接受？',
    options: [
      { key: 'warm_only', label: '必須冬天溫暖（華南）', excludes: [{ dim: 'E3', values: ['mild', 'cold', 'extreme_cold'] }] },
      { key: 'no_cold', label: '不接受常結冰',            excludes: [{ dim: 'E3', values: ['cold', 'extreme_cold'] }] },
      { key: 'no_extreme', label: '不接受極寒（東北／內蒙）', excludes: [{ dim: 'E3', values: ['extreme_cold'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'E4', section: 'E_environment', dataStatus: 'authoritative',
    type: 'single', skippable: true,
    title: '空氣霧霾？',
    subtitle: '基於生態環境部 PM2.5 年均數據。',
    options: [
      { key: 'low_only', label: '只要空氣好的省份',       excludes: [{ dim: 'E4', values: ['medium', 'high', 'extreme'] }] },
      { key: 'no_extreme', label: '不接受重霾（河北／河南）', excludes: [{ dim: 'E4', values: ['extreme'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'E5', section: 'E_environment', dataStatus: 'authoritative',
    type: 'multi', skippable: true,
    title: '想避開哪些方言區？',
    subtitle: '非當地方言者會有聽課／社交成本。',
    options: [
      { key: 'cantonese', label: '粵語區', excludes: [{ dim: 'E5', values: ['粵語'] }] },
      { key: 'min', label: '閩語區',       excludes: [{ dim: 'E5', values: ['閩南語', '閩東語'] }] },
      { key: 'wu', label: '吳語區',         excludes: [{ dim: 'E5', values: ['吳語'] }] },
      { key: 'southwest', label: '西南官話區', excludes: [{ dim: 'E5', values: ['官話-西南'] }] },
      { key: 'minority', label: '少數民族語言區', excludes: [{ dim: 'E5', values: ['藏語', '維吾爾語', '蒙古語'] }] },
      { key: 'none', label: '都可以' },
    ],
  },
  {
    id: 'E6', section: 'E_environment', dataStatus: 'authoritative',
    type: 'single', skippable: true,
    title: '城市必須通地鐵？',
    subtitle: '截至 2024 年中國城市軌道交通協會數據。',
    options: [
      { key: 'must', label: '必須有地鐵', excludes: [{ dim: 'E6', values: ['no'] }] },
      { key: 'any', label: '無所謂' },
    ],
  },
  {
    id: 'E7', section: 'E_environment', dataStatus: 'authoritative',
    type: 'single', skippable: true,
    title: '沿海 vs 內陸？',
    options: [
      { key: 'coastal', label: '只去沿海', excludes: [{ dim: 'E7', values: ['no'] }] },
      { key: 'inland',  label: '只去內陸', excludes: [{ dim: 'E7', values: ['yes'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'E8', section: 'E_environment', dataStatus: 'authoritative',
    type: 'single', skippable: true,
    title: '避開高海拔？',
    subtitle: '海拔 >1500m 地區有高原反應風險（青海、西藏、雲貴等）。',
    options: [
      { key: 'avoid', label: '避開高海拔', excludes: [{ dim: 'E8', values: ['yes'] }] },
      { key: 'any', label: '都行' },
    ],
  },
];

// ========== B 生活質量（24 題） ==========
const sectionB: Question[] = [
  {
    id: 'B1', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '宿舍格局底線？',
    options: [
      { key: 'must', label: '必須上床下桌', excludes: [{ dim: 'B1', values: ['上下鋪', '三層上下鋪'] }] },
      { key: 'no_triple', label: '不接受三層鋪', excludes: [{ dim: 'B1', values: ['三層上下鋪'] }] },
      { key: 'any', label: '都可以' },
    ],
  },
  {
    id: 'B2', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '空調，必須有嗎？',
    options: [
      { key: 'both', label: '宿舍 + 教室都必須有', excludes: [{ dim: 'B2', values: ['都沒有', '僅教室有', '僅宿舍有'] }] },
      { key: 'dorm', label: '宿舍必須有', excludes: [{ dim: 'B2', values: ['都沒有', '僅教室有'] }] },
      { key: 'any', label: '可以沒有' },
    ],
  },
  {
    id: 'B3', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '洗澡呢？',
    options: [
      { key: 'private', label: '必須獨立衛浴', excludes: [{ dim: 'B3', values: ['公共澡堂', '樓層公共浴室'] }] },
      { key: 'floor', label: '樓層公共浴室可以', excludes: [{ dim: 'B3', values: ['公共澡堂'] }] },
      { key: 'any', label: '公共澡堂也行' },
    ],
  },
  {
    id: 'B4', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '早自習／晚自習？',
    options: [
      { key: 'none', label: '都不能有', excludes: [{ dim: 'B4', values: ['早晚自習強制', '僅晚自習強制', '僅早自習強制'] }] },
      { key: 'one_ok', label: '一個可以，兩個不行', excludes: [{ dim: 'B4', values: ['早晚自習強制'] }] },
      { key: 'any', label: '都可以接受' },
    ],
  },
  {
    id: 'B5', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '晨跑？',
    options: [
      { key: 'none', label: '不能有', excludes: [{ dim: 'B5', values: ['每週3+次', '每週1-2次'] }] },
      { key: 'light', label: '每週 1-2 次可以', excludes: [{ dim: 'B5', values: ['每週3+次'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'B6', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '每學期跑步公里打卡上限？',
    subtitle: '部分學校要求一學期跑 120 公里以上並須達到配速。',
    options: [
      { key: 'no_run', label: '不接受任何公里打卡', excludes: [{ dim: 'B6', values: ['40+公里', '20-40公里', '20公里內'] }] },
      { key: 'low', label: '≤ 20 公里可以', excludes: [{ dim: 'B6', values: ['40+公里', '20-40公里'] }] },
      { key: 'mid', label: '≤ 40 公里可以', excludes: [{ dim: 'B6', values: ['40+公里'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'B7', section: 'B_quality', dataStatus: 'mixed', type: 'single', skippable: true,
    title: '假期節奏？',
    subtitle: '只用明確能看懂的校曆或眾包描述；看不準的不會拿來誤排。',
    options: [
      { key: 'strict', label: '不接受小學期，且暑假至少 6 週', excludes: [{ dim: 'B7', values: ['有小學期', '暑假＜4週', '暑假4-6週'] }] },
      { key: 'no_summer', label: '不接受小學期', excludes: [{ dim: 'B7', values: ['有小學期'] }] },
      { key: 'summer_6', label: '暑假至少 6 週', excludes: [{ dim: 'B7', values: ['暑假＜4週', '暑假4-6週'] }] },
      { key: 'summer_4', label: '暑假至少 4 週', excludes: [{ dim: 'B7', values: ['暑假＜4週'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'B8', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '外賣政策？',
    options: [
      { key: 'must', label: '必須允許、送到宿舍樓下', excludes: [{ dim: 'B8', values: ['禁止外賣', '外賣牆遠', '校外取'] }] },
      { key: 'wall_ok', label: '外賣牆可以', excludes: [{ dim: 'B8', values: ['禁止外賣', '校外取'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'B9', section: 'B_quality', dataStatus: 'mixed', type: 'single', skippable: true,
    title: '地鐵？',
    options: [
      { key: 'door', label: '校門口必須有', excludes: [{ dim: 'B9', values: ['無地鐵', '地鐵＞3公里', '步行15分鐘內'] }] },
      { key: 'walkable', label: '步行 15 分鐘內', excludes: [{ dim: 'B9', values: ['無地鐵', '地鐵＞3公里'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B10', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '宿舍洗衣機？',
    options: [
      { key: 'must', label: '必須有', excludes: [{ dim: 'B10', values: ['無洗衣機'] }] },
      { key: 'any', label: '沒有也行' },
    ],
  },
  {
    id: 'B11', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '校園網？',
    options: [
      { key: 'good', label: '不計費／不限速', excludes: [{ dim: 'B11', values: ['按流量計費', '限速嚴重'] }] },
      { key: 'any', label: '能用就行' },
    ],
  },
  {
    id: 'B12', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '斷電斷網？',
    options: [
      { key: 'none', label: '不能斷', excludes: [{ dim: 'B12', values: ['每晚斷電', '每晚斷網', '22點前斷', '21點前斷'] }] },
      { key: 'late', label: '午夜後斷可以', excludes: [{ dim: 'B12', values: ['22點前斷', '21點前斷'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'B13', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '食堂？',
    options: [
      { key: 'no_scandal', label: '不接受近年負面新聞', excludes: [{ dim: 'B13', values: ['近年負面新聞'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B14', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '熱水？',
    options: [
      { key: '24h', label: '必須 24 小時', excludes: [{ dim: 'B14', values: ['限時段', '僅晚間', '無熱水'] }] },
      { key: 'evening', label: '晚間有就行', excludes: [{ dim: 'B14', values: ['無熱水'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B15', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '電瓶車？',
    options: [
      { key: 'must', label: '校內必須允許騎', excludes: [{ dim: 'B15', values: ['禁止', '僅研究生允許'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B16', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '宿舍限電功率？',
    options: [
      { key: 'high', label: '必須 ≥ 1500W', excludes: [{ dim: 'B16', values: ['400W內', '800W內'] }] },
      { key: 'mid', label: '≥ 800W 可以', excludes: [{ dim: 'B16', values: ['400W內'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B17', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '通宵自習？',
    options: [
      { key: 'must', label: '必須有', excludes: [{ dim: 'B17', values: ['無通宵自習'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B18', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '大一能帶電腦？',
    options: [
      { key: 'must', label: '必須允許', excludes: [{ dim: 'B18', values: ['禁止', '限時禁止'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B19', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '校園卡體系？',
    options: [
      { key: 'flex', label: '電子支付／現金都要通', excludes: [{ dim: 'B19', values: ['強制校園卡', '強制特定銀行'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B20', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '強發銀行卡？',
    options: [
      { key: 'no', label: '不接受', excludes: [{ dim: 'B20', values: ['強制開戶'] }] },
      { key: 'any', label: '都行' },
    ],
  },
  {
    id: 'B21', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '校內超市？',
    options: [
      { key: 'large', label: '必須有大型超市', excludes: [{ dim: 'B21', values: ['無超市', '小賣部'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B22', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '快遞？',
    options: [
      { key: 'door', label: '必須送到宿舍樓', excludes: [{ dim: 'B22', values: ['校門取', '菜鳥驛站遠'] }] },
      { key: 'nearby', label: '驛站在校內即可', excludes: [{ dim: 'B22', values: ['校門取'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B23', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '共享單車？',
    options: [
      { key: 'must', label: '校內必須有', excludes: [{ dim: 'B23', values: ['無', '限時段'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'B24', section: 'B_quality', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '門禁／查寢？',
    options: [
      { key: 'free', label: '不接受查寢與 23 點前封寢', excludes: [{ dim: 'B24', values: ['查寢', '23點封寢', '22點封寢'] }] },
      { key: 'late', label: '23 點後封寢可以', excludes: [{ dim: 'B24', values: ['22點封寢'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
];

// ========== C 特殊（5 題） ==========
const sectionC: Question[] = [
  {
    id: 'C1', section: 'C_special', dataStatus: 'crowdsourced', type: 'multi', skippable: true,
    title: '飲食禁忌／宗教？',
    options: [
      { key: 'halal', label: '清真飲食', requires: [{ dim: 'C1', values: ['有清真食堂'] }] },
      { key: 'vegetarian', label: '長期素食', requires: [{ dim: 'C1', values: ['有素食窗口'] }] },
      { key: 'none', label: '無' },
    ],
  },
  {
    id: 'C2', section: 'C_special', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: '無障礙需求？',
    options: [
      { key: 'wheelchair', label: '輪椅無障礙', requires: [{ dim: 'C2', values: ['無障礙完善'] }] },
      { key: 'visual', label: '視障輔助', requires: [{ dim: 'C2', values: ['視障輔助'] }] },
      { key: 'none', label: '無' },
    ],
  },
  {
    id: 'C3', section: 'C_special', dataStatus: 'crowdsourced', type: 'single', skippable: true,
    title: 'LGBTQ+ 友好度？',
    subtitle: '此維度以公開可查新聞為依據，僅供參考。',
    options: [
      { key: 'friendly', label: '希望明顯友好', excludes: [{ dim: 'C3', values: ['近年壓制事件', '學生組織被整頓'] }] },
      { key: 'neutral', label: '中性即可', excludes: [{ dim: 'C3', values: ['近年壓制事件'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'C4', section: 'C_special', dataStatus: 'mixed', type: 'single', skippable: true,
    title: '外省人友好度？',
    options: [
      { key: 'diverse', label: '外地生源 ≥ 50%', excludes: [{ dim: 'C4', values: ['本省生源＞70%'] }] },
      { key: 'any', label: '不挑' },
    ],
  },
  {
    id: 'C5', section: 'C_special', dataStatus: 'mixed', type: 'multi', skippable: true,
    title: '你想讀的專業，必須有 A 檔學科評估嗎？',
    subtitle: '依教育部第四輪學科評估（2017）。',
    options: [
      { key: 'cs', label: '計算機', requires: [{ dim: 'C5', values: ['CS:A+', 'CS:A', 'CS:A-'] }] },
      { key: 'ee', label: '電子／自動化', requires: [{ dim: 'C5', values: ['EE:A+', 'EE:A', 'EE:A-'] }] },
      { key: 'math', label: '數學', requires: [{ dim: 'C5', values: ['Math:A+', 'Math:A', 'Math:A-'] }] },
      { key: 'med', label: '臨床醫學', requires: [{ dim: 'C5', values: ['Med:A+', 'Med:A', 'Med:A-'] }] },
      { key: 'econ', label: '經濟', requires: [{ dim: 'C5', values: ['Econ:A+', 'Econ:A', 'Econ:A-'] }] },
      { key: 'law', label: '法學', requires: [{ dim: 'C5', values: ['Law:A+', 'Law:A', 'Law:A-'] }] },
      { key: 'lit', label: '中文', requires: [{ dim: 'C5', values: ['Chn:A+', 'Chn:A', 'Chn:A-'] }] },
      { key: 'hist', label: '歷史', requires: [{ dim: 'C5', values: ['Hist:A+', 'Hist:A', 'Hist:A-'] }] },
      { key: 'none', label: '不限專業' },
    ],
  },
];

export const allQuestions: Question[] = [...sectionA, ...sectionE, ...sectionB, ...sectionC];
export const QUESTIONS_BY_SECTION = {
  A: sectionA,
  E: sectionE,
  B: sectionB,
  C: sectionC,
};
