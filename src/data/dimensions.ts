// 維度元數據：每個維度的題目 id、取值集合、官方／權威數據來源鏈接。
// 所有可驗證的維度都必須給出外部鏈接，不可驗證的放在 PROJECT_REPORT.md 的數據缺口節。

export type DimensionId =
  | 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6'
  | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8'
  | 'B1' | 'B2' | 'B3' | 'B4' | 'B5' | 'B6' | 'B7' | 'B8'
  | 'B9' | 'B10' | 'B11' | 'B12' | 'B13' | 'B14' | 'B15' | 'B16'
  | 'B17' | 'B18' | 'B19' | 'B20' | 'B21' | 'B22' | 'B23' | 'B24'
  | 'C1' | 'C2' | 'C3' | 'C4' | 'C5';

export interface DimensionMeta {
  id: DimensionId;
  label: string;
  section: 'A_redline' | 'E_environment' | 'B_quality' | 'C_special';
  // 該維度的可能值枚舉（null 表示未收錄）
  values: readonly string[];
  // 官方或權威數據來源，允許多個
  authoritativeSources: { title: string; url: string }[];
  // 說明該維度數據當前的覆蓋來源與狀態
  coverage: 'authoritative' | 'crowdsourced' | 'mixed' | 'pending';
  notes?: string;
}

export const DIMENSIONS: Record<DimensionId, DimensionMeta> = {
  // ============ A 紅線維度 ============
  A1: {
    id: 'A1',
    label: '省份',
    section: 'A_redline',
    values: [
      '北京', '上海', '天津', '重慶', '河北', '山西', '內蒙古', '遼寧', '吉林', '黑龍江',
      '江蘇', '浙江', '安徽', '福建', '江西', '山東', '河南', '湖北', '湖南', '廣東',
      '廣西', '海南', '四川', '貴州', '雲南', '西藏', '陝西', '甘肅', '青海', '寧夏',
      '新疆', '香港', '澳門', '臺灣',
    ],
    authoritativeSources: [
      { title: '教育部全國普通高等學校名單（截至 2025-06-20）', url: 'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html' },
    ],
    coverage: 'authoritative',
  },
  A2: {
    id: 'A2',
    label: '城市等級',
    section: 'A_redline',
    values: ['tier1', 'newtier1', 'tier2', 'tier3_below'],
    authoritativeSources: [
      { title: '第一財經新一線城市研究所（2025 城市商業魅力榜）', url: 'https://www.yicai.com/topic/100311963/' },
    ],
    coverage: 'mixed',
    notes: 'tier1 = 北上廣深；newtier1 = 第一財經 2025 新一線榜單 15 座；tier2 = 省會/計劃單列/重點城市映射；tier3_below = 其他地級',
  },
  A3: {
    id: 'A3',
    label: '辦學層次',
    section: 'A_redline',
    values: ['C9', '985非C9', '211非985', '雙一流非211', '普通本科', '專科'],
    authoritativeSources: [
      { title: '教育部「雙一流」建設高校及建設學科名單', url: 'https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html' },
      { title: '教育部「985 工程」名單', url: 'https://www.moe.gov.cn/srcsite/A22/s7065/200612/t20061206_128833.html' },
      { title: 'C9 聯盟（北京大學、清華大學等 9 所）', url: 'https://www.edu.cn/' },
    ],
    coverage: 'authoritative',
  },
  A4: {
    id: 'A4',
    label: '學費區間',
    section: 'A_redline',
    values: ['公辦', '1-3萬', '3-8萬', '8萬+', '民辦/合作待核價'],
    authoritativeSources: [
      { title: '教育部「陽光高考」信息公開平台（院校招生章程／學費）', url: 'https://gaokao.chsi.com.cn/' },
    ],
    coverage: 'mixed',
    notes: '官方名單能確認公辦/民辦/合作辦學；精確學費需到各校當年招生章程核對，未核價不硬填。',
  },
  A5: {
    id: 'A5',
    label: '主校區定位',
    section: 'A_redline',
    values: ['main_city', 'suburb_with_metro', 'suburb', 'separate_freshman'],
    authoritativeSources: [
      { title: '各校官網「校區概況」', url: 'https://gaokao.chsi.com.cn/' },
    ],
    coverage: 'mixed',
    notes: 'main_city = 主校區在主城；suburb_with_metro = 遠郊但有地鐵；suburb = 遠郊無地鐵；separate_freshman = 大一在分校',
  },
  A6: {
    id: 'A6',
    label: '特殊招生門檻',
    section: 'A_redline',
    values: ['regular_gaokao', 'art_exam', 'sports_test', 'military_police', 'navigation_flight'],
    authoritativeSources: [
      { title: '教育部全國普通高等學校名單（院校類型 / 校名）', url: 'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html' },
      { title: '陽光高考（藝術 / 體育 / 軍警等特殊招生信息）', url: 'https://gaokao.chsi.com.cn/' },
    ],
    coverage: 'mixed',
    notes: '用院校類型、校名與公開招生方式保守推導：藝術/體育院校、軍警院校、航海/飛行等優先標記；拿不準的不硬貼。',
  },

  // ============ E 環境／地理維度（由省份+城市推導） ============
  E1: {
    id: 'E1', label: '集中供暖', section: 'E_environment',
    values: ['yes', 'no'],
    authoritativeSources: [
      { title: '秦嶺-淮河供暖分界線（1956 國務院）', url: 'https://www.gov.cn/' },
      { title: '中國氣象局氣候分區', url: 'http://www.cma.gov.cn/' },
    ],
    coverage: 'authoritative',
  },
  E2: {
    id: 'E2', label: '夏季體感', section: 'E_environment',
    values: ['mild', 'hot', 'humid_hot', 'extreme_hot'],
    authoritativeSources: [{ title: '中國氣象局《中國氣候公報》', url: 'https://www.cma.gov.cn/2011xzt/essay/' }],
    coverage: 'authoritative',
    notes: 'mild=涼爽；hot=乾熱；humid_hot=濕熱；extreme_hot=吐魯番/重慶級',
  },
  E3: {
    id: 'E3', label: '冬季體感', section: 'E_environment',
    values: ['warm', 'mild', 'cold', 'extreme_cold'],
    authoritativeSources: [{ title: '中國氣象局《中國氣候公報》', url: 'https://www.cma.gov.cn/2011xzt/essay/' }],
    coverage: 'authoritative',
    notes: 'extreme_cold=東北/內蒙/新疆，最低 < -20°C',
  },
  E4: {
    id: 'E4', label: '霧霾年均', section: 'E_environment',
    values: ['low', 'medium', 'high', 'extreme'],
    authoritativeSources: [{ title: '生態環境部《中國生態環境狀況公報》', url: 'https://www.mee.gov.cn/hjzl/sthjzk/zghjzkgb/' }],
    coverage: 'authoritative',
    notes: 'PM2.5 年均：low<35、medium 35-50、high 50-70、extreme>70',
  },
  E5: {
    id: 'E5', label: '方言', section: 'E_environment',
    values: ['官話-北方', '官話-西南', '官話-江淮', '吳語', '粵語', '閩南語', '閩東語', '客家話', '湘語', '贛語', '晉語', '藏語', '維吾爾語', '蒙古語', '其他'],
    authoritativeSources: [
      { title: '《中國語言地圖集》（商務印書館 / 中國社科院）', url: 'https://www.cssn.cn/' },
    ],
    coverage: 'authoritative',
  },
  E6: {
    id: 'E6', label: '有地鐵', section: 'E_environment',
    values: ['yes', 'no'],
    authoritativeSources: [
      { title: '中國城市軌道交通協會年度報告', url: 'https://www.camet.org.cn/tjxx/' },
    ],
    coverage: 'authoritative',
    notes: '截至 2024 年，含已開通地鐵與輕軌的城市',
  },
  E7: {
    id: 'E7', label: '沿海省份', section: 'E_environment',
    values: ['yes', 'no'],
    authoritativeSources: [{ title: '民政部《全國行政區劃》', url: 'https://www.mca.gov.cn/' }],
    coverage: 'authoritative',
  },
  E8: {
    id: 'E8', label: '高海拔省份', section: 'E_environment',
    values: ['yes', 'no'],
    authoritativeSources: [{ title: '中國地理常識（海拔>1500m 地區）', url: 'http://www.cma.gov.cn/' }],
    coverage: 'authoritative',
    notes: '含西藏、青海、雲南、貴州、內蒙古、甘肅、新疆',
  },

  // ============ B 生活質量維度（CollegesChat 24 條） ============
  B1: {
    id: 'B1', label: '宿舍格局', section: 'B_quality',
    values: ['上床下桌', '上下鋪', '三層上下鋪'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B2: {
    id: 'B2', label: '空調', section: 'B_quality',
    values: ['都有', '僅教室有', '僅宿舍有', '都沒有'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B3: {
    id: 'B3', label: '洗澡', section: 'B_quality',
    values: ['獨立衛浴', '樓層公共浴室', '公共澡堂'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B4: {
    id: 'B4', label: '早晚自習', section: 'B_quality',
    values: ['無', '僅早自習強制', '僅晚自習強制', '早晚自習強制'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B5: {
    id: 'B5', label: '晨跑', section: 'B_quality',
    values: ['無', '每週1-2次', '每週3+次'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B6: {
    id: 'B6', label: '公里打卡', section: 'B_quality',
    values: ['無', '20公里內', '20-40公里', '40+公里'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B7: {
    id: 'B7', label: '假期', section: 'B_quality',
    values: ['標準', '有小學期', '暑假＜4週', '暑假4-6週'],
    authoritativeSources: [{ title: '各校校曆', url: 'https://gaokao.chsi.com.cn/' }],
    coverage: 'mixed',
  },
  B8: {
    id: 'B8', label: '外賣', section: 'B_quality',
    values: ['允許外賣', '外賣牆遠', '校外取', '禁止外賣'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B9: {
    id: 'B9', label: '地鐵', section: 'B_quality',
    values: ['校門有', '步行15分鐘內', '地鐵＞3公里', '無地鐵'],
    authoritativeSources: [{ title: '各城市軌道交通公司官網', url: 'https://www.bjsubway.com/' }],
    coverage: 'mixed',
    notes: '城市是否有軌交可客觀推導；校區到站距離需要逐校區核驗。',
  },
  B10: {
    id: 'B10', label: '洗衣機', section: 'B_quality',
    values: ['樓內/宿舍有', '無洗衣機'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B11: {
    id: 'B11', label: '校園網', section: 'B_quality',
    values: ['不計費', '按流量計費', '限速嚴重', '無校園網'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B12: {
    id: 'B12', label: '斷電斷網', section: 'B_quality',
    values: ['不斷', '午夜後斷', '22點前斷', '21點前斷', '每晚斷電', '每晚斷網', '週末不斷'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B13: {
    id: 'B13', label: '食堂', section: 'B_quality',
    values: ['好評', '貴', '近年負面新聞'],
    authoritativeSources: [{ title: '國家市場監督管理總局食品安全通告', url: 'https://www.samr.gov.cn/' }],
    coverage: 'mixed',
  },
  B14: {
    id: 'B14', label: '熱水', section: 'B_quality',
    values: ['24小時', '限時段', '僅晚間', '無熱水'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B15: {
    id: 'B15', label: '電瓶車', section: 'B_quality',
    values: ['允許', '僅研究生允許', '禁止'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B16: {
    id: 'B16', label: '限電', section: 'B_quality',
    values: ['不限', '1500W+', '800W內', '400W內'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B17: {
    id: 'B17', label: '通宵自習', section: 'B_quality',
    values: ['有通宵自習', '無通宵自習'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B18: {
    id: 'B18', label: '大一電腦', section: 'B_quality',
    values: ['允許', '限時禁止', '禁止'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B19: {
    id: 'B19', label: '校園卡', section: 'B_quality',
    values: ['電子/現金', '強制校園卡', '強制特定銀行'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B20: {
    id: 'B20', label: '強發銀行卡', section: 'B_quality',
    values: ['不強制', '強制開戶'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B21: {
    id: 'B21', label: '校內超市', section: 'B_quality',
    values: ['大型超市', '小賣部', '無超市'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B22: {
    id: 'B22', label: '快遞', section: 'B_quality',
    values: ['送到宿舍', '驛站在校內', '校門取', '菜鳥驛站遠'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B23: {
    id: 'B23', label: '共享單車', section: 'B_quality',
    values: ['覆蓋', '限時段', '無'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },
  B24: {
    id: 'B24', label: '門禁／查寢', section: 'B_quality',
    values: ['寬鬆', '23點封寢', '22點封寢', '查寢'],
    authoritativeSources: [{ title: 'CollegesChat 眾包問卷', url: 'https://github.com/CollegesChat/university-information' }],
    coverage: 'crowdsourced',
  },

  // ============ C 特殊維度 ============
  C1: {
    id: 'C1', label: '飲食／宗教', section: 'C_special',
    values: ['有清真食堂', '有素食窗口', '普通食堂'],
    authoritativeSources: [
      { title: '中國伊斯蘭教協會清真食品認證', url: 'http://www.chinaislam.net.cn/' },
    ],
    coverage: 'mixed',
  },
  C2: {
    id: 'C2', label: '無障礙', section: 'C_special',
    values: ['無障礙完善', '視障輔助', '一般'],
    authoritativeSources: [
      { title: '中國殘疾人聯合會高校無障礙建設評估', url: 'https://www.cdpf.org.cn/' },
    ],
    coverage: 'pending',
  },
  C3: {
    id: 'C3', label: 'LGBTQ+ 氛圍', section: 'C_special',
    values: ['無公開事件', '學生組織被整頓', '近年壓制事件'],
    authoritativeSources: [],
    coverage: 'pending',
    notes: '此維度無權威數據源，僅以公開可查新聞為依據，需人工審核。',
  },
  C4: {
    id: 'C4', label: '外省生源比', section: 'C_special',
    values: ['外地≥50%', '本地50-70%', '本省生源＞70%'],
    authoritativeSources: [
      { title: '各校本科招生章程（分省計劃）', url: 'https://gaokao.chsi.com.cn/' },
    ],
    coverage: 'mixed',
  },
  C5: {
    id: 'C5', label: '學科評估', section: 'C_special',
    values: [
      'CS:A+', 'CS:A', 'CS:A-', 'EE:A+', 'EE:A', 'EE:A-',
      'Math:A+', 'Math:A', 'Math:A-', 'Med:A+', 'Med:A', 'Med:A-',
      'Econ:A+', 'Econ:A', 'Econ:A-', 'Law:A+', 'Law:A', 'Law:A-',
      'Chn:A+', 'Chn:A', 'Chn:A-', 'Hist:A+', 'Hist:A', 'Hist:A-',
    ],
    authoritativeSources: [
      { title: '教育部第四輪學科評估（2017）', url: 'https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/' },
    ],
    coverage: 'authoritative',
    notes: '目前以第四輪（2017）為準；第五輪結果未全部公開。',
  },
};

export const DIMENSION_GROUPS = {
  A: ['A1', 'A2', 'A3', 'A4', 'A5', 'A6'] as DimensionId[],
  E: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'] as DimensionId[],
  B: [
    'B1','B2','B3','B4','B5','B6','B7','B8',
    'B9','B10','B11','B12','B13','B14','B15','B16',
    'B17','B18','B19','B20','B21','B22','B23','B24',
  ] as DimensionId[],
  C: ['C1','C2','C3','C4','C5'] as DimensionId[],
};
