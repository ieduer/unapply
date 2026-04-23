import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const sourceUrl = 'https://laosheng.top/fuwu/yuanxiao';
const outputPath = path.join(repoRoot, 'data', 'research', 'laosheng_school_profiles.2026-04-22.csv');
const cachePath = path.join(repoRoot, '.tmp', 'laosheng_yuanxiao.html');
const officialSchoolsPath = path.join(repoRoot, 'src', 'data', 'officialSchools.ts');

const warningTitlePattern = /无法连接|连接超时|安全连接失败|缓慢|夜间维护|不对外|停用|停服|失效|缺失|崩溃|打不开|禁校外访问|拒绝校外访问|要求校园卡绑定/;
const admissionTextPattern = /招生办|本科招生|招生网|本科招生网|招生信息网/;
const rejectedHostSuffixes = [
  'laosheng.top',
  'gaokao.cn',
  'gaokao.chsi.com.cn',
  'heec.cahe.edu.cn',
  'mp.weixin.qq.com',
  'weibo.com',
  'thepaper.cn',
  'gk100.com',
  '81.cn',
  '81.mil.cn',
  'mod.gov.cn',
  'people.com.cn',
  'gmw.cn',
  'bbtnews.com.cn',
  'smenx.com.cn',
  'pcepaper.cjxww.cn',
];

const traditionalMap = {
  學: '学', 國: '国', 華: '华', 東: '东', 師: '师', 範: '范', 農: '农',
  醫: '医', 藥: '药', 財: '财', 經: '经', 貿: '贸', 傳: '传', 樂: '乐',
  對: '对', 門: '门', 廈: '厦', 遼: '辽', 連: '连', 瀋: '沈', 濟: '济',
  龍: '龙', 蘭: '兰', 陝: '陕', 郵: '邮', 電: '电', 業: '业', 礦: '矿',
  質: '质', 術: '术', 蘇: '苏', 錫: '锡', 寧: '宁', 廣: '广', 慶: '庆',
  雲: '云', 貴: '贵', 內: '内', 爾: '尔', 濱: '滨', 烏: '乌', 齊: '齐',
  鄭: '郑', 長: '长', 體: '体', 藝: '艺', 劇: '剧',
};

function csvEscape(value) {
  const text = value ?? '';
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripHtml(text) {
  return decodeEntities(text.replace(/<[^>]+>/g, '')).trim();
}

function normalizeSchoolName(name) {
  return name
    .trim()
    .replace(/－/g, '-')
    .replace(/—/g, '-')
    .replace(/\s+/g, '')
    .split('')
    .map((char) => traditionalMap[char] ?? char)
    .join('')
    .replace(/国防科技大学/g, '国防科学技术大学')
    .replace(/中国地质大学北京/g, '中国地质大学（北京）')
    .replace(/中国地质大学武汉/g, '中国地质大学（武汉）')
    .replace(/中国石油大学北京/g, '中国石油大学（北京）')
    .replace(/中国石油大学华东/g, '中国石油大学（华东）')
    .replace(/北京师范大学-香港浸会大学联合国际学院/g, '北京师范大学－香港浸会大学联合国际学院')
    .replace(/华北电力大学（北京）/g, '华北电力大学')
    .replace(/华北电力大学北京/g, '华北电力大学');
}

function extractOfficialSchools(text) {
  const matched = text.match(/export const officialSchools = (\[[\s\S]*\]) satisfies School\[\];/);
  if (!matched) {
    throw new Error('Failed to parse src/data/officialSchools.ts');
  }

  return JSON.parse(matched[1]);
}

function extractTrailingPrefix(text) {
  const normalized = stripHtml(text).replace(/\s+/g, '');
  const matched = normalized.match(/([一-龥（）()－—-]{2,24})$/u);
  return matched ? matched[1] : '';
}

function parseTitle(attrs) {
  const matched = attrs.match(/title="([^"]*)"/);
  return matched ? decodeEntities(matched[1]) : '';
}

function shouldRejectUrl(href, title) {
  if (!/^https?:\/\//i.test(href)) return true;
  if (warningTitlePattern.test(title)) return true;

  try {
    const url = new URL(href);
    const hostname = url.hostname.toLowerCase();
    if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) return true;
    return rejectedHostSuffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
  } catch {
    return true;
  }
}

function normalizeWebsiteUrl(href) {
  try {
    const url = new URL(href);
    return `${url.protocol}//${url.host}/`;
  } catch {
    return href;
  }
}

function normalizeExactUrl(href) {
  try {
    return new URL(href).toString();
  } catch {
    return href;
  }
}

async function loadHtml() {
  try {
    const response = await fetch(sourceUrl, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; UnApplyResearchBot/1.0; +https://nope.bdfz.net)',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, html, 'utf8');
    return html;
  } catch {
    return fs.readFile(cachePath, 'utf8');
  }
}

const officialText = await fs.readFile(officialSchoolsPath, 'utf8');
const officialSchools = extractOfficialSchools(officialText);
const officialByName = new Map(officialSchools.map((school) => [
  normalizeSchoolName(school.nameSimplified ?? school.name),
  school,
]));

const html = await loadHtml();
const rowsByCode = new Map();
const blocks = [...html.matchAll(/<(p|td)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((match) => match[2]);

for (const block of blocks) {
  const anchorPattern = /<a([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g;
  let currentSchoolCode = '';
  let currentSchoolName = '';
  let lastIndex = 0;
  let anchorMatch;

  while ((anchorMatch = anchorPattern.exec(block))) {
    const [, preAttrs, href, postAttrs, innerHtml] = anchorMatch;
    const attrs = `${preAttrs} ${postAttrs}`;
    const anchorText = stripHtml(innerHtml);
    const title = parseTitle(attrs);
    const leftContext = block.slice(lastIndex, anchorMatch.index);
    const prefix = extractTrailingPrefix(leftContext);
    lastIndex = anchorPattern.lastIndex;

    const directMatch = officialByName.get(normalizeSchoolName(anchorText));
    const combinedMatch = prefix
      ? officialByName.get(normalizeSchoolName(`${prefix}${anchorText}`))
      : undefined;
    const school = directMatch ?? combinedMatch;

    if (school) {
      currentSchoolCode = school.moeCode;
      currentSchoolName = school.nameSimplified ?? school.name;

      if (!rowsByCode.has(currentSchoolCode)) {
        rowsByCode.set(currentSchoolCode, {
          moeCode: currentSchoolCode,
          schoolName: currentSchoolName,
          website: '',
          admissionWebsite: '',
        });
      }

      if (!shouldRejectUrl(href, title)) {
        const entry = rowsByCode.get(currentSchoolCode);
        if (!entry.website) entry.website = normalizeWebsiteUrl(href);
      }
      continue;
    }

    if (!currentSchoolCode || !admissionTextPattern.test(anchorText) || shouldRejectUrl(href, title)) {
      continue;
    }

    const entry = rowsByCode.get(currentSchoolCode);
    if (entry && !entry.admissionWebsite) {
      entry.schoolName = currentSchoolName;
      entry.admissionWebsite = normalizeExactUrl(href);
    }
  }
}

const outputRows = [
  ['moeCode', 'schoolName', 'website', 'admissionWebsite', 'sourceTitle', 'sourceUrl', 'sourceDate', 'confidence', 'notes'],
];

for (const row of Array.from(rowsByCode.values()).sort((left, right) => left.moeCode.localeCompare(right.moeCode))) {
  if (!row.website && !row.admissionWebsite) continue;
  outputRows.push([
    row.moeCode,
    row.schoolName,
    row.website,
    row.admissionWebsite,
    '老生常谈 高等院校三千所',
    sourceUrl,
    '2026-04-22',
    'medium',
    '第三方人工维护高校网址目录；仅用于补齐学校官网与本科招生网，不覆盖现有更高优先级来源。',
  ]);
}

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, outputRows.map((row) => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');

const websiteCount = outputRows.slice(1).filter((row) => row[2]).length;
const admissionCount = outputRows.slice(1).filter((row) => row[3]).length;

console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
console.log(`rows ${outputRows.length - 1}`);
console.log(`websites ${websiteCount}`);
console.log(`admissions ${admissionCount}`);
