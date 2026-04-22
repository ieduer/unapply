import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const researchDir = path.join(repoRoot, 'data', 'research');
const outputPath = path.join(repoRoot, 'src', 'data', 'researchData.ts');

const traditionalMap = {
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
];

const rawCollegesChatPathCandidates = [
  path.join(researchDir, 'collegeschat_results_desensitized.csv'),
  '/tmp/university-information/questionnaires/results_desensitized.csv',
];

const disciplineTokenRules = [
  { prefix: 'CS', disciplines: ['计算机科学与技术', '软件工程'] },
  { prefix: 'EE', disciplines: ['电子科学与技术', '信息与通信工程', '控制科学与工程', '电气工程'] },
  { prefix: 'Math', disciplines: ['数学'] },
  { prefix: 'Med', disciplines: ['临床医学'] },
  { prefix: 'Econ', disciplines: ['理论经济学', '应用经济学'] },
  { prefix: 'Law', disciplines: ['法学'] },
  { prefix: 'Chn', disciplines: ['中国语言文学'] },
  { prefix: 'Hist', disciplines: ['中国史', '世界史'] },
];

const gradeRank = { 'A+': 3, A: 2, 'A-': 1 };
const disciplineLookup = new Map(
  disciplineTokenRules.flatMap((rule) => rule.disciplines.map((discipline) => [discipline, rule.prefix])),
);

function normalizeSchoolName(name) {
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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (quoted) {
      if (char === '"') {
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === ',') {
      row.push(cell);
      cell = '';
      continue;
    }

    if (char === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }

    if (char === '\r') {
      continue;
    }

    cell += char;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

async function readCsvObjects(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell !== ''));
  const [header, ...body] = rows;
  return body.map((row) => {
    const record = {};
    header.forEach((column, index) => {
      record[column] = row[index] ?? '';
    });
    return record;
  });
}

function toOptionalTrim(value) {
  const text = value?.trim();
  return text ? text : undefined;
}

function toOptionalDistance(value) {
  const text = value?.trim();
  if (!text) return undefined;
  const distance = Number(text);
  return Number.isFinite(distance) ? distance : undefined;
}

function appendEvidence(profile, dimensionId, evidence) {
  if (!profile.evidence[dimensionId]) profile.evidence[dimensionId] = [];
  profile.evidence[dimensionId].push(evidence);
}

function ensureProfile(profiles, moeCode) {
  if (!profiles.has(moeCode)) {
    profiles.set(moeCode, {
      quality: {},
      evidence: {},
    });
  }
  return profiles.get(moeCode);
}

function addCoverage(coverage, dimensionId, moeCode) {
  if (!coverage.has(dimensionId)) {
    coverage.set(dimensionId, { schoolCodes: new Set(), recordCount: 0 });
  }
  const entry = coverage.get(dimensionId);
  entry.schoolCodes.add(moeCode);
  entry.recordCount += 1;
}

function chooseCrowdValue(tallies) {
  const entries = Array.from(tallies.entries()).sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0], 'zh-Hans-CN');
  });
  if (entries.length === 0) return null;

  const [[value, topCount], [, secondCount = 0] = []] = entries;
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (topCount === secondCount && entries.length > 1) return null;

  let confidence = 'low';
  if (topCount >= 3 && topCount / total >= 0.6) confidence = 'high';
  else if (topCount >= 2) confidence = 'medium';

  return {
    value,
    sampleSize: total,
    winningVotes: topCount,
    confidence,
  };
}

function normalizeDormLayout(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/三层|三人/.test(text)) return '三層上下鋪';
  if (/上床下桌|^是$|^是的$|大部分是|部分是/.test(text)) return '上床下桌';
  if (/不是|^否$|上下铺|双层/.test(text)) return '上下鋪';
  return null;
}

function normalizeAirConditioning(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/都没有|全都没有|^没有$|^无$|^否$/.test(text)) return '都沒有';
  if (/(宿舍有.*教室(没有|无))|((教室(没有|无)).*宿舍有)|^宿舍有$/.test(text)) return '僅宿舍有';
  if (/(教室有.*宿舍(没有|无))|((宿舍(没有|无)).*教室有)|^教室有$/.test(text)) return '僅教室有';
  if (/都有|都有空调|^有$|是的|宿舍和教室都有|都装了/.test(text)) return '都有';
  return null;
}

function normalizeBath(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/独立卫浴|独卫|^有$|^是$|有的/.test(text)) return '獨立衛浴';
  if (/楼层|公共浴室|公共淋浴|楼道/.test(text)) return '樓層公共浴室';
  if (/澡堂|浴堂|洗浴中心|公共澡堂|没有/.test(text)) return '公共澡堂';
  return null;
}

function normalizeStudy(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/^无$|^没有$|^没$|无早自习无晚自习/.test(text)) return '無';
  if (/早.*晚|晚.*早|早晚自习/.test(text)) return '早晚自習強制';
  if (/晚自习|晚修/.test(text)) return '僅晚自習強制';
  if (/早自习/.test(text)) return '僅早自習強制';
  return null;
}

function normalizeMorningRun(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/^无$|^没有$|^没$|不跑/.test(text)) return '無';
  if (/每天|天天|一周[三四五六七天]|每周[34567]次|每星期[34567]次/.test(text)) return '每週3+次';
  if (/有|晨跑|每周[12]次|一周[12]次|大一有/.test(text)) return '每週1-2次';
  return null;
}

function normalizeRunningQuota(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/^无$|^没有$|不用|不需要|免跑/.test(text)) return '無';
  const numbers = Array.from(text.matchAll(/(\d+(?:\.\d+)?)/g), (match) => Number(match[1])).filter(Number.isFinite);
  if (numbers.length === 0) return null;
  const quota = Math.max(...numbers);
  if (quota <= 20) return '20公里內';
  if (quota <= 40) return '20-40公里';
  return '40+公里';
}

function convertVacationUnitToDays(value, unit) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (/天|日|day/i.test(unit)) return amount;
  if (/周|週/.test(unit)) return amount * 7;
  if (/个月|個月|月/.test(unit)) return amount * 30;
  return null;
}

function extractVacationDays(text, keywords) {
  const escaped = keywords.join('|');
  const patterns = [
    new RegExp(`(?:${escaped})[^\\d]{0,6}(\\d+(?:\\.\\d+)?)(天|日|周|週|个月|個月|月|day|days)`, 'ig'),
    new RegExp(`(\\d+(?:\\.\\d+)?)(天|日|周|週|个月|個月|月|day|days)[^\\d]{0,6}(?:${escaped})`, 'ig'),
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const days = convertVacationUnitToDays(match[1], match[2]);
    if (days !== null) return days;
  }

  return null;
}

function normalizeVacation(answer) {
  const raw = answer.trim();
  const text = raw.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/小学期|小學期/.test(text)) return '有小學期';
  const summerDays = extractVacationDays(raw, ['暑假', '暑休', 'summer']);
  if (summerDays !== null) {
    if (summerDays < 28) return '暑假＜4週';
    if (summerDays < 42) return '暑假4-6週';
    return '標準';
  }
  if (/无小学期|無小學期|没有小学期|沒有小學期|正常双学期|正常兩學期|两学期制|兩學期制/.test(text)) {
    return '標準';
  }
  return null;
}

function normalizeTakeout(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/禁止|不允许|不讓|不能点/.test(text)) return '禁止外賣';
  if (/校外|校门|大门口/.test(text)) return '校外取';
  if (/外卖柜|外卖点|驿站|较远|很远/.test(text)) return '外賣牆遠';
  if (/允许|可以|能点|^有$/.test(text)) return '允許外賣';
  return null;
}

function normalizeMetro(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/无地铁|没有地铁|没地铁|不通地铁/.test(text)) return '無地鐵';
  if (/校门口就是地铁|校门口有地铁|门口就是地铁|出门地铁/.test(text)) return '校門有';

  const distanceMatch = text.match(/(\d+(?:\.\d+)?)公里/);
  if (distanceMatch) {
    const distance = Number(distanceMatch[1]);
    if (Number.isFinite(distance)) {
      if (distance <= 1.2) return '步行15分鐘內';
      if (distance > 3) return '地鐵＞3公里';
    }
  }

  if (/十五分钟|15分钟|十多分钟|12分钟|骑车三分钟|五分钟有地铁|不远处有地铁/.test(text)) return '步行15分鐘內';
  if (/公交.*地铁|最近的地铁需要坐车半个小时|地铁站五十分钟步行|公交车才能到地铁站|进城.*小时/.test(text)) return '地鐵＞3公里';
  if (/有地铁|地铁在建|地铁口/.test(text)) return '步行15分鐘內';
  return null;
}

function normalizeLaundry(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/^无$|^没有$|没有洗衣机|無洗衣機/.test(text)) return '無洗衣機';
  if (/有|洗衣机/.test(text)) return '樓內\/宿舍有';
  return null;
}

function normalizeCampusNetwork(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/无校.?园网|没有校园网/.test(text)) return '無校園網';
  if (/流量|计费|收费/.test(text)) return '按流量計費';
  if (/限速|龟速|很慢|卡/.test(text)) return '限速嚴重';
  if (/免费|不限流|不计费|全覆盖|还行/.test(text)) return '不計費';
  return null;
}

function normalizePower(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/不断|不斷|不断电不断网/.test(text)) return '不斷';
  if (/周末不断|周六不断|周日不断/.test(text)) return '週末不斷';
  if (/21[:：.]?00|9点|九点/.test(text)) return '21點前斷';
  if (/22[:：.]?00|10点|十点/.test(text)) return '22點前斷';
  if (/23[:：.]?00|11点|十一点|12\.00/.test(text)) return '午夜後斷';
  if (/午夜|12点|24点/.test(text)) return '午夜後斷';
  if (/断电/.test(text)) return '每晚斷電';
  if (/断网/.test(text)) return '每晚斷網';
  return null;
}

function normalizeCanteen(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/异物|虫|食物中毒|拉肚子|不卫生/.test(text)) return '近年負面新聞';
  if (/贵|偏贵|很贵/.test(text)) return '貴';
  if (/不贵|便宜|还行|不错|好吃/.test(text)) return '好評';
  return null;
}

function normalizeHotWater(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/无热水|没有热水/.test(text)) return '無熱水';
  if (/24小时|全天|一直有/.test(text)) return '24小時';
  if (/仅晚|只在晚上|晚间/.test(text)) return '僅晚間';
  if (/限时|-\d+[:：]?00|到\d+[:：]?00|供应时间/.test(text)) return '限時段';
  return null;
}

function normalizeScooter(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/研究生/.test(text)) return '僅研究生允許';
  if (/禁止|不让|不能/.test(text)) return '禁止';
  if (/允许|可以|能骑|有充电/.test(text)) return '允許';
  return null;
}

function normalizeWatt(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/不限|无限制|无/.test(text)) return '不限';
  const watts = Array.from(text.matchAll(/(\d{3,4})\s*w?/gi), (match) => Number(match[1])).filter(Number.isFinite);
  if (watts.some((value) => value >= 1500)) return '1500W+';
  if (watts.some((value) => value >= 800)) return '800W內';
  if (watts.some((value) => value <= 400)) return '400W內';
  return null;
}

function normalizeOvernightStudy(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/无|没有|没/.test(text)) return '無通宵自習';
  if (/有|可以|能/.test(text)) return '有通宵自習';
  return null;
}

function normalizeFreshmanComputer(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/禁止|不让|不能/.test(text)) return '禁止';
  if (/限时|限\.?期|大一上|军训后/.test(text)) return '限時禁止';
  if (/允许|可以|能带|可带/.test(text)) return '允許';
  return null;
}

function normalizeCampusCard(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/银行卡|指定银行/.test(text)) return '強制特定銀行';
  if (/饭卡|校园卡|一卡通/.test(text)) return '強制校園卡';
  if (/支付宝|微信|电子|现金|刷码/.test(text)) return '電子/現金';
  return null;
}

function normalizeBankCard(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/强制|必须|统一发|统一办理|开户/.test(text)) return '強制開戶';
  if (/不发|没有|无|自愿/.test(text)) return '不強制';
  return null;
}

function normalizeStore(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/没有|无超市/.test(text)) return '無超市';
  if (/大型|超市多|大超市|罗森|全家/.test(text)) return '大型超市';
  if (/小卖部|小超市|便利店/.test(text)) return '小賣部';
  return null;
}

function normalizeExpress(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/送到宿舍|送货上门/.test(text)) return '送到宿舍';
  if (/校门|门口/.test(text)) return '校門取';
  if (/驿站|校内/.test(text)) return '驛站在校內';
  if (/远|很远|菜鸟/.test(text)) return '菜鳥驛站遠';
  return null;
}

function normalizeBike(answer) {
  const text = answer.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/无|没有/.test(text)) return '無';
  if (/限时|时间段/.test(text)) return '限時段';
  if (/有|哈啰|青桔|美团/.test(text)) return '覆蓋';
  return null;
}

function normalizeCurfew(entranceAnswer, dormAnswer) {
  const text = `${entranceAnswer} ${dormAnswer}`.replace(/\s+/g, '');
  if (!text || /不知道|不清楚/.test(text)) return null;
  if (/22[:：.]?00|10点|十点/.test(text)) return '22點封寢';
  if (/23[:：.]?00|11点|十一点/.test(text)) return '23點封寢';
  if (/查寝|会查|查/.test(text)) return '查寢';
  if (/无门禁|没有门禁|不封寝|不查寝|宽松|能回去|能回来/.test(text)) return '寬鬆';
  return null;
}

const crowdNormalizers = [
  { dimensionId: 'B1', index: 6, normalize: normalizeDormLayout },
  { dimensionId: 'B2', index: 7, normalize: normalizeAirConditioning },
  { dimensionId: 'B3', index: 8, normalize: normalizeBath },
  { dimensionId: 'B4', index: 9, normalize: normalizeStudy },
  { dimensionId: 'B5', index: 10, normalize: normalizeMorningRun },
  { dimensionId: 'B6', index: 11, normalize: normalizeRunningQuota },
  { dimensionId: 'B7', index: 12, normalize: normalizeVacation },
  { dimensionId: 'B8', index: 13, normalize: normalizeTakeout },
  { dimensionId: 'B9', index: 14, normalize: normalizeMetro },
  { dimensionId: 'B10', index: 15, normalize: normalizeLaundry },
  { dimensionId: 'B11', index: 16, normalize: normalizeCampusNetwork },
  { dimensionId: 'B12', index: 17, normalize: normalizePower },
  { dimensionId: 'B13', index: 18, normalize: normalizeCanteen },
  { dimensionId: 'B14', index: 19, normalize: normalizeHotWater },
  { dimensionId: 'B15', index: 20, normalize: normalizeScooter },
  { dimensionId: 'B16', index: 21, normalize: normalizeWatt },
  { dimensionId: 'B17', index: 22, normalize: normalizeOvernightStudy },
  { dimensionId: 'B18', index: 23, normalize: normalizeFreshmanComputer },
  { dimensionId: 'B19', index: 24, normalize: normalizeCampusCard },
  { dimensionId: 'B20', index: 25, normalize: normalizeBankCard },
  { dimensionId: 'B21', index: 26, normalize: normalizeStore },
  { dimensionId: 'B22', index: 27, normalize: normalizeExpress },
  { dimensionId: 'B23', index: 28, normalize: normalizeBike },
];

function buildProvincePortal(cells) {
  return {
    authorityName: cells[1] || '',
    portalUrl: cells[2] || '',
    scoreQueryUrl: cells[3] || '',
    planQueryUrl: cells[4] || '',
    sourceTitle: cells[5] || '阳光高考（全国各省市招办）',
    sourceUrl: cells[6] || 'https://gaokao.chsi.com.cn/',
    sourceDate: cells[7] || '2026-04-21',
    confidence: cells[8] || 'high',
    notes: cells[9] || '',
  };
}

async function readProvincePortals(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const rows = parseCsv(text).filter((row) => row.some((cell) => cell !== ''));
  return rows.slice(1).map((row) => {
    const cells = [...row];
    while (cells.length > 10 && cells[5] === '') cells.splice(5, 1);
    while (cells.length < 10) cells.push('');
    return cells.slice(0, 10);
  });
}

async function resolveCollegesChatPath() {
  for (const candidate of rawCollegesChatPathCandidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return null;
}

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

async function main() {
  const officialModuleUrl = pathToFileURL(path.join(repoRoot, 'src', 'data', 'officialSchools.ts')).href;
  const { officialSchools } = await import(officialModuleUrl);
  const officialByCode = new Map(officialSchools.map((school) => [school.moeCode, school]));
  const officialByName = new Map(officialSchools.map((school) => [
    normalizeSchoolName(school.nameSimplified ?? school.name),
    school,
  ]));

  const profiles = new Map();
  const coverage = new Map();
  const pipelineWarnings = [];
  const counts = {
    websiteRows: 0,
    websiteSchools: 0,
    githubProfileRows: 0,
    campusOfficialRows: 0,
    campusOfficialA5Schools: 0,
    campusOfficialB9Schools: 0,
    mergedWebsiteSchools: 0,
    mergedAddressSchools: 0,
    provincePortals: 0,
    crowdMatchedAnswers: 0,
    crowdMatchedSchools: 0,
    crowdUnmatchedSchools: 0,
    crowdValuesAccepted: 0,
    disciplineRows: 0,
    disciplineSchools: 0,
    cooperativeSchools: 0,
  };

  const websites = await readCsvObjects(path.join(researchDir, 'school_websites.2026-04-21.csv'));
  counts.websiteRows = websites.length;
  for (const row of websites) {
    if (!row.moeCode || !officialByCode.has(row.moeCode)) continue;
    const profile = ensureProfile(profiles, row.moeCode);
    if (row.website?.trim()) profile.website = row.website.trim();
    if (row.admissionWebsite?.trim()) profile.admissionWebsite = row.admissionWebsite.trim();
    if (profile.website || profile.admissionWebsite) counts.websiteSchools += 1;
  }

  const provinceRows = await readProvincePortals(path.join(researchDir, 'province_portals.2026-04-21.csv'));
  const provincePortals = {};
  for (const row of provinceRows) {
    if (!row[0]?.trim()) continue;
    provincePortals[row[0].trim()] = buildProvincePortal(row);
  }
  counts.provincePortals = Object.keys(provincePortals).length;

  const cooperativeRows = await readCsvObjects(path.join(researchDir, 'sino_foreign_programs.2026-04-21.csv'));
  for (const row of cooperativeRows) {
    const matchedSchool = officialByName.get(normalizeSchoolName(row.schoolName ?? ''));
    if (!matchedSchool?.moeCode) continue;
    const profile = ensureProfile(profiles, matchedSchool.moeCode);
    profile.ownership = 'cooperative';
    profile.tuitionRange = '民辦/合作待核價';
      counts.cooperativeSchools += 1;
  }

  try {
    const githubProfiles = await readCsvObjects(path.join(researchDir, 'github_school_profiles.2026-04-21.csv'));
    counts.githubProfileRows = githubProfiles.length;
    for (const row of githubProfiles) {
      if (!row.moeCode || !officialByCode.has(row.moeCode)) continue;
      const profile = ensureProfile(profiles, row.moeCode);
      if (!profile.website && row.website?.trim()) profile.website = row.website.trim();
      if (row.schoolAddress?.trim()) profile.schoolAddress = row.schoolAddress.trim();
    }
  } catch {
    counts.githubProfileRows = 0;
  }

  const campusOfficialRows = await readCsvObjects(path.join(researchDir, 'campus_official_overrides.2026-04-21.csv'));
  counts.campusOfficialRows = campusOfficialRows.length;
  const campusOfficialA5Schools = new Set();
  const campusOfficialB9Schools = new Set();
  for (const row of campusOfficialRows) {
    const moeCode = row.moeCode?.trim();
    if (!moeCode || !officialByCode.has(moeCode)) continue;

    const profile = ensureProfile(profiles, moeCode);
    const official = officialByCode.get(moeCode);
    const mainCampusType = toOptionalTrim(row.mainCampusType);
    const freshmanOnly = toOptionalTrim(row.freshmanOnly);
    const b9Value = toOptionalTrim(row.b9Value);
    const nearestMetroStation = toOptionalTrim(row.nearestMetroStation);
    const metroDistanceKm = toOptionalDistance(row.metroDistanceKm);
    const sourceTitle = toOptionalTrim(row.sourceTitle) ?? '学校官方校区信息';
    const sourceUrl = toOptionalTrim(row.sourceUrl) ?? official.sourceUrl;
    const sourceDate = toOptionalTrim(row.sourceDate);
    const confidence = toOptionalTrim(row.confidence);
    const campusName = toOptionalTrim(row.campusName);
    const notes = toOptionalTrim(row.notes);
    const noteParts = [
      campusName ? `校区：${campusName}` : null,
      nearestMetroStation ? `最近地铁：${nearestMetroStation}` : null,
      Number.isFinite(metroDistanceKm) ? `步行约 ${metroDistanceKm} 公里` : null,
      notes ?? null,
    ].filter(Boolean);
    const note = noteParts.length > 0 ? noteParts.join('；') : undefined;

    if (mainCampusType) {
      profile.mainCampusType = mainCampusType;
      appendEvidence(profile, 'A5', {
        title: sourceTitle,
        url: sourceUrl,
        ...(sourceDate ? { date: sourceDate } : {}),
        ...(confidence ? { confidence } : {}),
        ...(note ? { note } : {}),
      });
      addCoverage(coverage, 'A5', moeCode);
      campusOfficialA5Schools.add(moeCode);
    }

    if (freshmanOnly) {
      profile.campusFreshmanPolicy = freshmanOnly;
    }

    if (b9Value) {
      profile.quality.B9 = b9Value;
      appendEvidence(profile, 'B9', {
        title: sourceTitle,
        url: sourceUrl,
        ...(sourceDate ? { date: sourceDate } : {}),
        ...(confidence ? { confidence } : {}),
        ...(note ? { note } : {}),
      });
      addCoverage(coverage, 'B9', moeCode);
      campusOfficialB9Schools.add(moeCode);
    }
  }
  counts.campusOfficialA5Schools = campusOfficialA5Schools.size;
  counts.campusOfficialB9Schools = campusOfficialB9Schools.size;

  const disciplineRows = await readCsvObjects(path.join(researchDir, 'discipline_eval.4th.csv'));
  counts.disciplineRows = disciplineRows.length;
  const disciplineBestBySchool = new Map();
  for (const row of disciplineRows) {
    const moeCode = row.moeCode?.trim();
    const grade = row.grade?.trim();
    const prefix = disciplineLookup.get(row.disciplineName?.trim());
    if (!moeCode || !officialByCode.has(moeCode) || !prefix || !gradeRank[grade]) continue;
    if (!disciplineBestBySchool.has(moeCode)) disciplineBestBySchool.set(moeCode, new Map());
    const schoolEntries = disciplineBestBySchool.get(moeCode);
    const currentGrade = schoolEntries.get(prefix);
    if (!currentGrade || gradeRank[grade] > gradeRank[currentGrade]) schoolEntries.set(prefix, grade);
  }

  for (const [moeCode, subjectGrades] of disciplineBestBySchool.entries()) {
    const values = Array.from(subjectGrades.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([prefix, grade]) => `${prefix}:${grade}`);
    if (values.length === 0) continue;
    const profile = ensureProfile(profiles, moeCode);
    profile.quality.C5 = values;
    profile.evidence.C5 = [{
      title: '第四轮学科评估结果',
      url: 'https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/',
      date: '2017-12-28',
      confidence: 'high',
      note: `${values.length} 个学科方向进入 A-/A/A+`,
    }];
    addCoverage(coverage, 'C5', moeCode);
  }
  counts.disciplineSchools = disciplineBestBySchool.size;

  const collegesChatPath = await resolveCollegesChatPath();
  if (!collegesChatPath) {
    pipelineWarnings.push('未找到 CollegesChat 原始脱敏 CSV，B 系生活题仅保留现有人工样本。');
  } else {
    const rawRows = parseCsv(await fs.readFile(collegesChatPath, 'utf8'));
    const crowdTallies = new Map();
    const unmatchedNames = new Set();

    for (const row of rawRows.slice(1)) {
      if (row.length < 31) continue;
      const rawSchoolName = row[5]?.trim();
      if (!rawSchoolName) continue;
      const matchedSchool = officialByName.get(normalizeSchoolName(rawSchoolName));
      if (!matchedSchool?.moeCode) {
        unmatchedNames.add(rawSchoolName);
        continue;
      }

      counts.crowdMatchedAnswers += 1;
      if (!crowdTallies.has(matchedSchool.moeCode)) crowdTallies.set(matchedSchool.moeCode, new Map());
      const schoolTallies = crowdTallies.get(matchedSchool.moeCode);

      for (const item of crowdNormalizers) {
        const normalized = item.normalize(row[item.index] ?? '');
        if (!normalized) continue;
        if (!schoolTallies.has(item.dimensionId)) schoolTallies.set(item.dimensionId, new Map());
        const dimTallies = schoolTallies.get(item.dimensionId);
        dimTallies.set(normalized, (dimTallies.get(normalized) ?? 0) + 1);
      }

      const curfew = normalizeCurfew(row[29] ?? '', row[30] ?? '');
      if (curfew) {
        if (!schoolTallies.has('B24')) schoolTallies.set('B24', new Map());
        const curfewTallies = schoolTallies.get('B24');
        curfewTallies.set(curfew, (curfewTallies.get(curfew) ?? 0) + 1);
      }
    }

    counts.crowdMatchedSchools = crowdTallies.size;
    counts.crowdUnmatchedSchools = unmatchedNames.size;

    for (const [moeCode, schoolTallies] of crowdTallies.entries()) {
      const profile = ensureProfile(profiles, moeCode);
      for (const [dimensionId, tallies] of schoolTallies.entries()) {
        const chosen = chooseCrowdValue(tallies);
        if (!chosen) continue;
        profile.quality[dimensionId] = chosen.value;
        counts.crowdValuesAccepted += 1;
        addCoverage(coverage, dimensionId, moeCode);
      }
    }
  }

  const schoolResearchProfilesByMoeCode = Object.fromEntries(
    Array.from(profiles.entries())
      .map(([moeCode, profile]) => [
        moeCode,
        {
          ...('website' in profile ? { website: profile.website } : {}),
          ...('admissionWebsite' in profile ? { admissionWebsite: profile.admissionWebsite } : {}),
          ...('schoolAddress' in profile ? { schoolAddress: profile.schoolAddress } : {}),
          ...('mainCampusType' in profile ? { mainCampusType: profile.mainCampusType } : {}),
          ...('campusFreshmanPolicy' in profile ? { campusFreshmanPolicy: profile.campusFreshmanPolicy } : {}),
          ...('ownership' in profile ? { ownership: profile.ownership } : {}),
          ...('tuitionRange' in profile ? { tuitionRange: profile.tuitionRange } : {}),
          ...(Object.keys(profile.quality).length > 0 ? { quality: profile.quality } : {}),
          ...(Object.keys(profile.evidence).length > 0 ? { evidence: profile.evidence } : {}),
        },
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  counts.mergedWebsiteSchools = Object.values(schoolResearchProfilesByMoeCode).filter((profile) => Boolean(profile.website)).length;
  counts.mergedAddressSchools = Object.values(schoolResearchProfilesByMoeCode).filter((profile) => Boolean(profile.schoolAddress)).length;

  const researchCoverageByDimension = Object.fromEntries(
    Array.from(coverage.entries())
      .map(([dimensionId, info]) => [
        dimensionId,
        {
          schoolCount: info.schoolCodes.size,
          recordCount: info.recordCount,
        },
      ])
      .sort(([left], [right]) => left.localeCompare(right)),
  );

  const output = `// Generated by scripts/build_research_data.mjs. Do not edit by hand.\n`
    + `// Inputs: school_websites.2026-04-21.csv, github_school_profiles.2026-04-21.csv, campus_official_overrides.2026-04-21.csv, province_portals.2026-04-21.csv, discipline_eval.4th.csv, sino_foreign_programs.2026-04-21.csv${collegesChatPath ? `, ${path.basename(collegesChatPath)}` : ''}\n\n`
    + `import type { DimensionId } from './dimensions';\n`
    + `import type { CampusType, SchoolOwnership, TuitionRange } from './schools';\n\n`
    + `export interface ResearchEvidence {\n`
    + `  title: string;\n`
    + `  url: string;\n`
    + `  date?: string;\n`
    + `  confidence?: 'high' | 'medium' | 'low';\n`
    + `  note?: string;\n`
    + `}\n\n`
    + `export interface SchoolResearchProfile {\n`
    + `  website?: string;\n`
    + `  admissionWebsite?: string;\n`
    + `  schoolAddress?: string;\n`
    + `  mainCampusType?: CampusType;\n`
    + `  campusFreshmanPolicy?: 'yes' | 'no' | 'unknown';\n`
    + `  ownership?: SchoolOwnership;\n`
    + `  tuitionRange?: TuitionRange;\n`
    + `  quality?: Partial<Record<DimensionId, string | string[]>>;\n`
    + `  evidence?: Partial<Record<DimensionId, ResearchEvidence[]>>;\n`
    + `}\n\n`
    + `export interface ProvinceAdmissionPortal {\n`
    + `  authorityName: string;\n`
    + `  portalUrl: string;\n`
    + `  scoreQueryUrl?: string;\n`
    + `  planQueryUrl?: string;\n`
    + `  sourceTitle: string;\n`
    + `  sourceUrl: string;\n`
    + `  sourceDate?: string;\n`
    + `  confidence?: 'high' | 'medium' | 'low';\n`
    + `  notes?: string;\n`
    + `}\n\n`
    + `export const schoolResearchProfilesByMoeCode: Record<string, SchoolResearchProfile> = ${formatJson(schoolResearchProfilesByMoeCode)};\n\n`
    + `export const provincePortalsByProvince: Record<string, ProvinceAdmissionPortal> = ${formatJson(provincePortals)};\n\n`
    + `export const researchCoverageByDimension: Partial<Record<DimensionId, { schoolCount: number; recordCount: number }>> = ${formatJson(researchCoverageByDimension)};\n\n`
    + `export const researchPipelineMeta = ${formatJson({
      generatedAt: new Date().toISOString(),
      inputs: {
        websites: 'data/research/school_websites.2026-04-21.csv',
        githubProfiles: 'data/research/github_school_profiles.2026-04-21.csv',
        campusOfficialOverrides: 'data/research/campus_official_overrides.2026-04-21.csv',
        provincePortals: 'data/research/province_portals.2026-04-21.csv',
        disciplineEval: 'data/research/discipline_eval.4th.csv',
        cooperativePrograms: 'data/research/sino_foreign_programs.2026-04-21.csv',
        collegesChatRaw: collegesChatPath ? path.relative(repoRoot, collegesChatPath) : null,
      },
      counts,
      warnings: [
        ...pipelineWarnings,
        'quality_crowd.2026-04-21.jsonl 暂未直接入库，因为现有文件存在列错位，需以后基于原始问卷重新导出。',
        'city_environment.2026-04-21.csv 与 city_metro.2026-04-21.csv 目前为空表，尚未接入校区级客观推导。',
      ],
    })};\n`;

  await fs.writeFile(outputPath, output, 'utf8');

  console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
  console.log(`website profiles: ${counts.websiteSchools}`);
  console.log(`official campus overrides (A5): ${counts.campusOfficialA5Schools}`);
  console.log(`official campus overrides (B9): ${counts.campusOfficialB9Schools}`);
  console.log(`province portals: ${counts.provincePortals}`);
  console.log(`crowd matched schools: ${counts.crowdMatchedSchools}`);
  console.log(`discipline schools: ${counts.disciplineSchools}`);
}

await main();
