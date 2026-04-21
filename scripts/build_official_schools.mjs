import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from '@e965/xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const SOURCE_PAGE =
  'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html';
const ORDINARY_ATTACHMENT_FALLBACK =
  'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/W020250729615142156867.xls';

const C9_NAMES = new Set([
  '北京大学',
  '清华大学',
  '复旦大学',
  '上海交通大学',
  '浙江大学',
  '南京大学',
  '中国科学技术大学',
  '哈尔滨工业大学',
  '西安交通大学',
]);

const NINE_EIGHT_FIVE_NAMES = new Set([
  '北京大学',
  '中国人民大学',
  '清华大学',
  '北京航空航天大学',
  '北京理工大学',
  '中国农业大学',
  '北京师范大学',
  '中央民族大学',
  '南开大学',
  '天津大学',
  '大连理工大学',
  '东北大学',
  '吉林大学',
  '哈尔滨工业大学',
  '复旦大学',
  '同济大学',
  '上海交通大学',
  '华东师范大学',
  '南京大学',
  '东南大学',
  '浙江大学',
  '中国科学技术大学',
  '厦门大学',
  '山东大学',
  '中国海洋大学',
  '武汉大学',
  '华中科技大学',
  '湖南大学',
  '中南大学',
  '国防科学技术大学',
  '国防科技大学',
  '中山大学',
  '华南理工大学',
  '四川大学',
  '电子科技大学',
  '重庆大学',
  '西安交通大学',
  '西北工业大学',
  '西北农林科技大学',
  '兰州大学',
]);

const TWO_ONE_ONE_NAMES = new Set([
  '北京大学',
  '中国人民大学',
  '清华大学',
  '北京交通大学',
  '北京工业大学',
  '北京航空航天大学',
  '北京理工大学',
  '北京科技大学',
  '北京化工大学',
  '北京邮电大学',
  '中国农业大学',
  '北京林业大学',
  '北京中医药大学',
  '北京师范大学',
  '北京外国语大学',
  '中国传媒大学',
  '中央财经大学',
  '对外经济贸易大学',
  '北京体育大学',
  '中央音乐学院',
  '中央民族大学',
  '中国政法大学',
  '华北电力大学',
  '南开大学',
  '天津大学',
  '天津医科大学',
  '河北工业大学',
  '太原理工大学',
  '内蒙古大学',
  '辽宁大学',
  '大连理工大学',
  '东北大学',
  '大连海事大学',
  '吉林大学',
  '延边大学',
  '东北师范大学',
  '哈尔滨工业大学',
  '哈尔滨工程大学',
  '东北农业大学',
  '东北林业大学',
  '复旦大学',
  '同济大学',
  '上海交通大学',
  '华东理工大学',
  '东华大学',
  '华东师范大学',
  '上海外国语大学',
  '上海财经大学',
  '上海大学',
  '第二军医大学',
  '海军军医大学',
  '南京大学',
  '苏州大学',
  '东南大学',
  '南京航空航天大学',
  '南京理工大学',
  '中国矿业大学',
  '中国矿业大学（北京）',
  '河海大学',
  '江南大学',
  '南京农业大学',
  '中国药科大学',
  '南京师范大学',
  '浙江大学',
  '安徽大学',
  '中国科学技术大学',
  '合肥工业大学',
  '厦门大学',
  '福州大学',
  '南昌大学',
  '山东大学',
  '中国海洋大学',
  '中国石油大学',
  '中国石油大学（北京）',
  '中国石油大学（华东）',
  '郑州大学',
  '武汉大学',
  '华中科技大学',
  '中国地质大学',
  '中国地质大学（北京）',
  '中国地质大学（武汉）',
  '武汉理工大学',
  '华中农业大学',
  '华中师范大学',
  '中南财经政法大学',
  '湖南大学',
  '中南大学',
  '湖南师范大学',
  '国防科学技术大学',
  '国防科技大学',
  '中山大学',
  '暨南大学',
  '华南理工大学',
  '华南师范大学',
  '广西大学',
  '海南大学',
  '四川大学',
  '西南交通大学',
  '电子科技大学',
  '四川农业大学',
  '西南财经大学',
  '重庆大学',
  '西南大学',
  '贵州大学',
  '云南大学',
  '西藏大学',
  '西北大学',
  '西安交通大学',
  '西北工业大学',
  '西安电子科技大学',
  '长安大学',
  '西北农林科技大学',
  '陕西师范大学',
  '第四军医大学',
  '空军军医大学',
  '兰州大学',
  '青海大学',
  '宁夏大学',
  '新疆大学',
  '石河子大学',
]);

const DOUBLE_FIRST_CLASS_NAMES = new Set([
  '北京大学',
  '中国人民大学',
  '清华大学',
  '北京交通大学',
  '北京工业大学',
  '北京航空航天大学',
  '北京理工大学',
  '北京科技大学',
  '北京化工大学',
  '北京邮电大学',
  '中国农业大学',
  '北京林业大学',
  '北京协和医学院',
  '北京中医药大学',
  '北京师范大学',
  '首都师范大学',
  '北京外国语大学',
  '中国传媒大学',
  '中央财经大学',
  '对外经济贸易大学',
  '外交学院',
  '中国人民公安大学',
  '北京体育大学',
  '中央音乐学院',
  '中国音乐学院',
  '中央美术学院',
  '中央戏剧学院',
  '中央民族大学',
  '中国政法大学',
  '南开大学',
  '天津大学',
  '天津工业大学',
  '天津医科大学',
  '天津中医药大学',
  '华北电力大学',
  '河北工业大学',
  '山西大学',
  '太原理工大学',
  '内蒙古大学',
  '辽宁大学',
  '大连理工大学',
  '东北大学',
  '大连海事大学',
  '吉林大学',
  '延边大学',
  '东北师范大学',
  '哈尔滨工业大学',
  '哈尔滨工程大学',
  '东北农业大学',
  '东北林业大学',
  '复旦大学',
  '同济大学',
  '上海交通大学',
  '华东理工大学',
  '东华大学',
  '上海海洋大学',
  '上海中医药大学',
  '华东师范大学',
  '上海外国语大学',
  '上海财经大学',
  '上海体育学院',
  '上海音乐学院',
  '上海大学',
  '南京大学',
  '苏州大学',
  '东南大学',
  '南京航空航天大学',
  '南京理工大学',
  '中国矿业大学',
  '南京邮电大学',
  '河海大学',
  '江南大学',
  '南京林业大学',
  '南京信息工程大学',
  '南京农业大学',
  '南京医科大学',
  '南京中医药大学',
  '中国药科大学',
  '南京师范大学',
  '浙江大学',
  '中国美术学院',
  '安徽大学',
  '中国科学技术大学',
  '合肥工业大学',
  '厦门大学',
  '福州大学',
  '南昌大学',
  '山东大学',
  '中国海洋大学',
  '中国石油大学（华东）',
  '郑州大学',
  '河南大学',
  '武汉大学',
  '华中科技大学',
  '中国地质大学（武汉）',
  '武汉理工大学',
  '华中农业大学',
  '华中师范大学',
  '中南财经政法大学',
  '湘潭大学',
  '湖南大学',
  '中南大学',
  '湖南师范大学',
  '中山大学',
  '暨南大学',
  '华南理工大学',
  '华南农业大学',
  '广州医科大学',
  '广州中医药大学',
  '华南师范大学',
  '海南大学',
  '广西大学',
  '四川大学',
  '重庆大学',
  '西南交通大学',
  '电子科技大学',
  '西南石油大学',
  '成都理工大学',
  '四川农业大学',
  '成都中医药大学',
  '西南大学',
  '西南财经大学',
  '贵州大学',
  '云南大学',
  '西藏大学',
  '西北大学',
  '西安交通大学',
  '西北工业大学',
  '西安电子科技大学',
  '长安大学',
  '西北农林科技大学',
  '陕西师范大学',
  '兰州大学',
  '青海大学',
  '宁夏大学',
  '新疆大学',
  '石河子大学',
  '中国矿业大学（北京）',
  '中国石油大学（北京）',
  '中国地质大学（北京）',
  '宁波大学',
  '南方科技大学',
  '上海科技大学',
  '中国科学院大学',
  '国防科技大学',
  '海军军医大学',
  '空军军医大学',
]);

const PROVINCE_MAP = new Map([
  ['北京市', '北京'],
  ['天津市', '天津'],
  ['河北省', '河北'],
  ['山西省', '山西'],
  ['内蒙古自治区', '內蒙古'],
  ['辽宁省', '遼寧'],
  ['吉林省', '吉林'],
  ['黑龙江省', '黑龍江'],
  ['上海市', '上海'],
  ['江苏省', '江蘇'],
  ['浙江省', '浙江'],
  ['安徽省', '安徽'],
  ['福建省', '福建'],
  ['江西省', '江西'],
  ['山东省', '山東'],
  ['河南省', '河南'],
  ['湖北省', '湖北'],
  ['湖南省', '湖南'],
  ['广东省', '廣東'],
  ['广西壮族自治区', '廣西'],
  ['海南省', '海南'],
  ['重庆市', '重慶'],
  ['四川省', '四川'],
  ['贵州省', '貴州'],
  ['云南省', '雲南'],
  ['西藏自治区', '西藏'],
  ['陕西省', '陝西'],
  ['甘肃省', '甘肅'],
  ['青海省', '青海'],
  ['宁夏回族自治区', '寧夏'],
  ['新疆维吾尔自治区', '新疆'],
]);

const FIRST_TIER_CITIES = new Set(['北京', '上海', '广州', '深圳', '廣州']);
const NEW_TIER_CITIES = new Set([
  '成都',
  '杭州',
  '重庆',
  '重慶',
  '武汉',
  '武漢',
  '苏州',
  '蘇州',
  '西安',
  '南京',
  '长沙',
  '長沙',
  '郑州',
  '鄭州',
  '天津',
  '合肥',
  '青岛',
  '青島',
  '东莞',
  '東莞',
  '宁波',
  '寧波',
  '佛山',
]);
const SECOND_TIER_CITIES = new Set([
  '济南',
  '濟南',
  '无锡',
  '無錫',
  '沈阳',
  '瀋陽',
  '昆明',
  '大连',
  '大連',
  '福州',
  '厦门',
  '廈門',
  '哈尔滨',
  '哈爾濱',
  '长春',
  '長春',
  '石家庄',
  '石家莊',
  '南宁',
  '南寧',
  '贵阳',
  '貴陽',
  '南昌',
  '太原',
  '兰州',
  '蘭州',
  '海口',
  '乌鲁木齐',
  '烏魯木齊',
  '呼和浩特',
  '银川',
  '銀川',
  '西宁',
  '西寧',
  '拉萨',
  '拉薩',
  '徐州',
  '常州',
  '温州',
  '溫州',
  '绍兴',
  '紹興',
]);

function decodeHtml(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function normalizeNameKey(name) {
  const map = {
    學: '学',
    國: '国',
    華: '华',
    東: '东',
    師: '师',
    範: '范',
    農: '农',
    醫: '医',
    藥: '药',
    財: '财',
    經: '经',
    貿: '贸',
    傳: '传',
    媒: '媒',
    樂: '乐',
    對: '对',
    門: '门',
    廈: '厦',
    遼: '辽',
    連: '连',
    瀋: '沈',
    濟: '济',
    龍: '龙',
    蘭: '兰',
    陝: '陕',
    郵: '邮',
    電: '电',
    業: '业',
    礦: '矿',
    質: '质',
    術: '术',
    蘇: '苏',
    錫: '锡',
    寧: '宁',
    廣: '广',
    慶: '庆',
    雲: '云',
    貴: '贵',
    內: '内',
    爾: '尔',
    濱: '滨',
    烏: '乌',
    齊: '齐',
    鄭: '郑',
    長: '长',
    灣: '湾',
    體: '体',
    藝: '艺',
    劇: '剧',
    學: '学',
  };
  return String(name)
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (ch) =>
      String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
    )
    .split('')
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/国防科技大学/g, '国防科学技术大学')
    .replace(/\s+/g, '')
    .trim();
}

function normalizeCity(city) {
  return String(city || '').trim().replace(/市$/, '');
}

function normalizeProvince(rawProvince) {
  const stripped = String(rawProvince || '').replace(/[（(].*$/, '').trim();
  const mapped = PROVINCE_MAP.get(stripped);
  if (!mapped) throw new Error(`Unknown province label: ${rawProvince}`);
  return mapped;
}

function inferCityTier(city) {
  const c = normalizeCity(city);
  if (FIRST_TIER_CITIES.has(c)) return 'tier1';
  if (NEW_TIER_CITIES.has(c)) return 'newtier1';
  if (SECOND_TIER_CITIES.has(c)) return 'tier2';
  return 'tier3_below';
}

function inferOwnership(note) {
  const n = String(note || '');
  if (n.includes('民办')) return 'private';
  if (n.includes('中外合作') || n.includes('内地与港澳') || n.includes('合作办学')) {
    return 'cooperative';
  }
  return 'public';
}

function inferTuitionRange(ownership) {
  if (ownership === 'public') return '公辦';
  if (ownership === 'private' || ownership === 'cooperative') return '民辦/合作待核價';
  return undefined;
}

function inferLevel(name, moeLevel) {
  const key = normalizeNameKey(name);
  if (C9_NAMES.has(key)) return 'C9';
  if (NINE_EIGHT_FIVE_NAMES.has(key)) return '985非C9';
  if (TWO_ONE_ONE_NAMES.has(key)) return '211非985';
  if (DOUBLE_FIRST_CLASS_NAMES.has(key)) return '雙一流非211';
  if (moeLevel === '本科') return '普通本科';
  if (moeLevel === '专科') return '專科';
  return '普通本科';
}

async function fetchText(url) {
  const resp = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) unapply-data-builder/1.0',
    },
  });
  if (!resp.ok) throw new Error(`GET ${url} failed: ${resp.status}`);
  return resp.text();
}

async function fetchBuffer(url) {
  const resp = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X) unapply-data-builder/1.0',
    },
  });
  if (!resp.ok) throw new Error(`GET ${url} failed: ${resp.status}`);
  return Buffer.from(await resp.arrayBuffer());
}

function findOrdinaryAttachment(pageHtml) {
  const links = [...pageHtml.matchAll(/href="([^"]+\.xls)"/gi)].map((m) => m[1]);
  const ordinary = links.find((href) => {
    const around = pageHtml.slice(Math.max(0, pageHtml.indexOf(href) - 80), pageHtml.indexOf(href) + 160);
    return around.includes('普通高等学校名单');
  });
  const href = ordinary || './W020250729615142156867.xls';
  return new URL(href, SOURCE_PAGE).toString();
}

function parseOrdinaryWorkbook(buffer) {
  const workbook = XLSX.read(buffer);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  let province = '';
  const records = [];

  for (const row of rows) {
    if (!row.length) continue;
    if (row.length === 1 && typeof row[0] === 'string' && /（\d+所）/.test(row[0])) {
      province = normalizeProvince(row[0]);
      continue;
    }
    if (typeof row[0] !== 'number') continue;

    const [, name, moeCode, department, cityRaw, moeLevel, note = ''] = row;
    if (!name || !moeCode || !province) continue;

    const city = normalizeCity(cityRaw);
    const ownership = inferOwnership(note);
    const school = {
      id: `moe:${String(moeCode)}`,
      name: String(name),
      nameSimplified: String(name),
      province,
      city,
      cityTier: inferCityTier(city),
      level: inferLevel(String(name), String(moeLevel)),
      moeCode: String(moeCode),
      department: String(department || ''),
      moeLevel: String(moeLevel || ''),
      ownership,
      mainCampusType: undefined,
      tuitionRange: inferTuitionRange(ownership),
      sources: ['MOE-2025-ordinary'],
      sourceUrl: SOURCE_PAGE,
      updatedAt: '2025-06-20',
    };
    Object.keys(school).forEach((key) => school[key] === undefined && delete school[key]);
    records.push(school);
  }

  return records;
}

function buildCatalogMeta(records, attachmentUrl) {
  const undergraduateCount = records.filter((s) => s.moeLevel === '本科').length;
  const vocationalCount = records.filter((s) => s.moeLevel === '专科').length;
  const provinceCount = new Set(records.map((s) => s.province)).size;
  return {
    source: 'MOE National Higher Education Institution List',
    sourcePageUrl: SOURCE_PAGE,
    ordinaryAttachmentUrl: attachmentUrl,
    sourceDate: '2025-06-20',
    publishedDate: '2025-06-27',
    ordinaryCount: records.length,
    undergraduateCount,
    vocationalCount,
    adultCount: 248,
    totalHigherEducationCount: 3167,
    provinceCount,
    notes:
      'Official ordinary higher education institutions only; adult institutions are counted in metadata but excluded from the filter pool.',
  };
}

function makeMetaTs(meta) {
  return `// Generated by scripts/build_official_schools.mjs. Do not edit by hand.
// Source: ${SOURCE_PAGE}

export const officialSchoolCatalogMeta = ${JSON.stringify(meta, null, 2)} as const;
`;
}

function makeSchoolsTs(records) {
  return `// Generated by scripts/build_official_schools.mjs. Do not edit by hand.
// Source: ${SOURCE_PAGE}

import type { School } from './schools';

export const officialSchools = ${JSON.stringify(records, null, 2)} satisfies School[];
`;
}

async function main() {
  let attachmentUrl = ORDINARY_ATTACHMENT_FALLBACK;
  try {
    const pageHtml = await fetchText(SOURCE_PAGE);
    attachmentUrl = findOrdinaryAttachment(decodeHtml(pageHtml));
  } catch (err) {
    console.warn(`Unable to resolve attachment from page, using fallback: ${err.message}`);
  }

  const buffer = await fetchBuffer(attachmentUrl);
  const records = parseOrdinaryWorkbook(buffer);
  if (records.length !== 2919) {
    throw new Error(`Expected 2919 ordinary schools, got ${records.length}`);
  }
  const byCode = new Set(records.map((s) => s.moeCode));
  if (byCode.size !== records.length) {
    throw new Error(`MOE code collision: ${records.length - byCode.size}`);
  }

  const meta = buildCatalogMeta(records, attachmentUrl);
  const metaPath = path.join(repoRoot, 'src/data/officialSchoolMeta.ts');
  const schoolsPath = path.join(repoRoot, 'src/data/officialSchools.ts');
  await Promise.all([
    fs.writeFile(metaPath, makeMetaTs(meta), 'utf8'),
    fs.writeFile(schoolsPath, makeSchoolsTs(records), 'utf8'),
  ]);
  console.log(`Wrote ${path.relative(repoRoot, schoolsPath)} (${records.length} records)`);
  console.log(`Wrote ${path.relative(repoRoot, metaPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
