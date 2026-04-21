import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import xlsx from '@e965/xlsx';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const researchDir = path.join(repoRoot, 'data', 'research');

const outputPath = path.join(researchDir, 'campus_locations.2026-04-21.csv');
const schoolProfilesPath = path.join(researchDir, 'github_school_profiles.2026-04-21.csv');

const geocoderDir = process.env.UNAPPLY_CAMPUS_GEOCODER_DIR || '/tmp/cn-university-geocoder';
const poiJsonCandidates = [
  process.env.UNAPPLY_CAMPUS_POI_JSON || '',
  '/tmp/china-university-database/public/大学.json',
  '/tmp/The-Location-Data-of-Schools-in-China/大学-8084.json',
].filter(Boolean);
const gaohrXlsxCandidates = [
  process.env.UNAPPLY_GAOHR_XLSX || '',
  '/tmp/gaohr_university_2021.xlsx',
  path.join(repoRoot, '.tmp', 'gaohr_university_2021.xlsx'),
].filter(Boolean);

const sourceUrls = {
  geocoder: 'https://github.com/Naptie/cn-university-geocoder',
  profiles: 'https://github.com/DaoSword/China-Education-Data',
  poiA: 'https://github.com/ZsTs119/china-university-database',
  poiB: 'https://github.com/pg7go/The-Location-Data-of-Schools-in-China',
  gaohr: 'https://gaohr.win/site/blogs/2022/2022-03-27-university-of-china.html',
  hcu: 'https://github.com/jtchen2k/hcu',
  cgsop: 'https://daxue.cgsop.com/',
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (quoted) {
      if (char === '"') {
        if (next === '"') {
          cell += '"';
          index += 1;
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

    if (char === '\r') continue;

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

async function readOptionalXlsxObjects(filePath) {
  try {
    const buffer = await fs.readFile(filePath);
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    return xlsx.utils.sheet_to_json(sheet, { defval: '' });
  } catch {
    return null;
  }
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function splitSegments(text) {
  return text
    .split(/[;,，]\s*/g)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function normalizeCampusLabel(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/校區/g, '校区')
    .replace(/校園/g, '校园');
}

function campusShortToken(label) {
  return normalizeCampusLabel(label).replace(/(校区|校园|园区|分校|校本部|主校区|主校園|本部)$/g, '');
}

function buildCampusVariants(schoolName, campusName) {
  const normalizedSchool = normalizeCampusLabel(schoolName);
  const normalizedCampus = normalizeCampusLabel(campusName);
  const shortToken = campusShortToken(campusName);
  const variants = new Set();

  if (normalizedCampus) variants.add(normalizedCampus);
  if (shortToken && shortToken !== normalizedCampus) variants.add(shortToken);

  if (!normalizedCampus) {
    variants.add('主校区');
    variants.add('校本部');
    variants.add('本部');
  } else {
    variants.add(`${normalizedSchool}${normalizedCampus}`);
    if (shortToken) {
      variants.add(`${normalizedSchool}${shortToken}`);
      variants.add(`${normalizedSchool}(${shortToken})`);
      variants.add(`${normalizedSchool}（${shortToken}）`);
    }
  }

  return Array.from(variants).filter(Boolean);
}

function parseCampusAddresses(rawAddress) {
  const labelled = new Map();
  const unlabeled = [];

  for (const segment of splitSegments(rawAddress ?? '')) {
    const matched = segment.match(/^([^:：]{1,24})[:：](.+)$/);
    if (!matched) {
      unlabeled.push(segment);
      continue;
    }

    const label = normalizeCampusLabel(matched[1]);
    const address = matched[2].trim();
    if (!label || !address) {
      unlabeled.push(segment);
      continue;
    }

    labelled.set(label, address);
  }

  return {
    labelled,
    unlabeled,
    singleAddress: labelled.size === 0 && unlabeled.length === 1 ? unlabeled[0] : '',
  };
}

function normalizeProvinceName(value) {
  return String(value ?? '')
    .replace(/维吾尔自治区/g, '')
    .replace(/壮族自治区/g, '')
    .replace(/回族自治区/g, '')
    .replace(/自治区/g, '')
    .replace(/特别行政区/g, '')
    .replace(/省/g, '')
    .replace(/市/g, '');
}

function normalizeCityName(value) {
  return String(value ?? '')
    .replace(/自治州/g, '')
    .replace(/地区/g, '')
    .replace(/盟/g, '')
    .replace(/市/g, '');
}

function dedupePoiRecords(records) {
  const seen = new Set();
  const deduped = [];
  for (const record of records) {
    const key = [
      record.normalizedName,
      record.location?.lat ?? '',
      record.location?.lng ?? '',
      record.address ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(record);
  }
  return deduped;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((value) => Number.isFinite(value))) return Infinity;
  const earthRadius = 6371;
  const toRadians = (value) => (value * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const a = sinLat * sinLat
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * sinLng * sinLng;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function inferDistrictFromAddress(address) {
  const text = String(address ?? '').trim();
  if (!text) return '';

  const contextual = text.match(/(?:省|市|州|盟)([\u4e00-\u9fa5]{1,8}?(?:区|县|旗))/);
  if (contextual?.[1]) return contextual[1];

  const allMatches = Array.from(text.matchAll(/([\u4e00-\u9fa5]{1,8}?(?:区|县|旗))/g), (match) => match[1]);
  return allMatches.at(-1) ?? '';
}

function buildSourceInfo({ geocoder, address, poi, gaohr }) {
  const titles = [];
  const urls = [];

  if (geocoder) {
    titles.push('Naptie cn-university-geocoder');
    urls.push(sourceUrls.geocoder);
  }

  if (address) {
    titles.push('DaoSword China-Education-Data');
    urls.push(sourceUrls.profiles);
  }

  if (poi) {
    titles.push('ZsTs119/pg7go Baidu POI 数据集');
    urls.push(sourceUrls.poiA);
  }

  if (gaohr) {
    titles.push('GaoHR 全国大学基本信息');
    urls.push(sourceUrls.gaohr);
  }

  return {
    title: titles.join(' + '),
    url: urls[0] || sourceUrls.geocoder,
  };
}

function chooseConfidence({ geocoder, address, poi, gaohr, labelledAddress, exactPoi }) {
  if (geocoder && labelledAddress && (poi ? exactPoi : true)) return 'high';
  if (geocoder && address && poi) return 'high';
  if (address && gaohr) return 'medium';
  if (geocoder && gaohr) return 'medium';
  if (geocoder && (address || poi)) return 'medium';
  if (address && poi) return exactPoi ? 'medium' : 'low';
  if (address || poi || gaohr) return 'low';
  return 'low';
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function resolvePoiDataset() {
  for (const candidate of poiJsonCandidates) {
    const payload = await readOptionalJson(candidate);
    if (Array.isArray(payload)) {
      return {
        filePath: candidate,
        rows: payload,
      };
    }
  }
  return {
    filePath: null,
    rows: [],
  };
}

async function resolveGaohrDataset() {
  for (const candidate of gaohrXlsxCandidates) {
    const payload = await readOptionalXlsxObjects(candidate);
    if (Array.isArray(payload) && payload.length > 0) {
      return {
        filePath: candidate,
        rows: payload,
      };
    }
  }

  return {
    filePath: null,
    rows: [],
  };
}

function findAddressForCampus(parsedAddress, schoolName, campusName) {
  const mainVariants = ['主校区', '校本部', '本部'];
  const lookupKeys = campusName
    ? buildCampusVariants(schoolName, campusName)
    : mainVariants;

  for (const key of lookupKeys.map((value) => normalizeCampusLabel(value))) {
    if (parsedAddress.labelled.has(key)) {
      return {
        label: key,
        address: parsedAddress.labelled.get(key),
        labelled: true,
      };
    }
  }

  if (!campusName && parsedAddress.singleAddress) {
    return {
      label: '',
      address: parsedAddress.singleAddress,
      labelled: false,
    };
  }

  if (parsedAddress.labelled.size === 1 && !campusName) {
    const [label, address] = Array.from(parsedAddress.labelled.entries())[0];
    if (mainVariants.includes(label)) {
      return { label, address, labelled: true };
    }
  }

  return null;
}

function choosePoiMatch(poiRecords, school, campusName, lat, lng, normalizeSchoolName) {
  const schoolKey = normalizeSchoolName(school.nameSimplified ?? school.name);
  const shortToken = campusShortToken(campusName);
  const exactNames = [];

  if (campusName) {
    exactNames.push(normalizeSchoolName(`${school.nameSimplified ?? school.name}${campusName}`));
    exactNames.push(normalizeSchoolName(`${school.name}${campusName}`));
  } else {
    exactNames.push(schoolKey);
  }

  const candidates = [];

  for (const exactName of Array.from(new Set(exactNames)).filter(Boolean)) {
    for (const record of poiRecords.exact.get(exactName) ?? []) {
      candidates.push({ ...record, matchType: 'exact' });
    }
  }

  if (candidates.length === 0 && shortToken) {
    const fuzzy = poiRecords.rows.filter((record) => (
      record.normalizedName.startsWith(schoolKey) && record.normalizedName.includes(shortToken)
    ));
    for (const record of fuzzy) candidates.push({ ...record, matchType: 'fuzzy' });
  }

  if (candidates.length === 0) return null;

  const ranked = dedupePoiRecords(candidates).map((record) => ({
    ...record,
    distanceKm: Number.isFinite(lat) && Number.isFinite(lng)
      ? haversineKm(lat, lng, record.location?.lat, record.location?.lng)
      : Infinity,
  })).sort((left, right) => left.distanceKm - right.distanceKm);

  const best = ranked[0];
  if (!best) return null;

  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const limit = best.matchType === 'exact' ? 8 : 5;
    if (best.distanceKm > limit) return null;
  } else if (ranked.length > 1 && ranked[1].distanceKm === ranked[0].distanceKm) {
    return null;
  }

  return best;
}

function buildPoiIndex(rows, normalizeSchoolName) {
  const normalizedRows = rows
    .filter((row) => row && typeof row.name === 'string' && row.location)
    .map((row) => ({
      ...row,
      normalizedName: normalizeSchoolName(row.name),
      location: {
        lat: Number(row.location.lat),
        lng: Number(row.location.lng),
      },
    }))
    .filter((row) => Number.isFinite(row.location.lat) && Number.isFinite(row.location.lng));

  const exact = new Map();
  for (const row of normalizedRows) {
    if (!exact.has(row.normalizedName)) exact.set(row.normalizedName, []);
    exact.get(row.normalizedName).push(row);
  }

  return {
    rows: normalizedRows,
    exact,
  };
}

function buildGaohrIndex(rows, normalizeSchoolName) {
  const bySchool = new Map();

  for (const row of rows) {
    const name = String(row.名称 ?? '').trim();
    if (!name) continue;

    const lat = Number(row.纬度);
    const lng = Number(row.经度);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    bySchool.set(normalizeSchoolName(name), {
      name,
      province: normalizeProvinceName(row.省份 ?? ''),
      city: normalizeCityName(row.城市 ?? ''),
      address: String(row.地址 ?? '').trim(),
      lat,
      lng,
    });
  }

  return bySchool;
}

function isPoiCompatibleWithSchool(poiMatch, school) {
  if (!poiMatch) return false;

  const poiProvince = normalizeProvinceName(poiMatch.province ?? '');
  const poiCity = normalizeCityName(poiMatch.city ?? '');
  const schoolProvince = normalizeProvinceName(school.province ?? '');
  const schoolCity = normalizeCityName(school.city ?? '');

  if (poiProvince && schoolProvince && poiProvince !== schoolProvince) return false;
  if (poiCity && schoolCity && poiCity !== schoolCity) return false;
  return true;
}

function makeCampusDisplayName(rawCampusName) {
  const value = String(rawCampusName ?? '').trim();
  return value || '主校区';
}

async function main() {
  const officialModuleUrl = pathToFileURL(path.join(repoRoot, 'src', 'data', 'officialSchools.ts')).href;
  const schoolNameModuleUrl = pathToFileURL(path.join(repoRoot, 'src', 'lib', 'schoolName.ts')).href;

  const { officialSchools } = await import(officialModuleUrl);
  const { normalizeSchoolName } = await import(schoolNameModuleUrl);

  const officialByName = new Map();
  for (const school of officialSchools) {
    officialByName.set(normalizeSchoolName(school.name), school);
    officialByName.set(normalizeSchoolName(school.nameSimplified ?? school.name), school);
  }

  const githubProfiles = await readCsvObjects(schoolProfilesPath);
  const addressByMoeCode = new Map(githubProfiles.map((row) => [row.moeCode, row.schoolAddress?.trim() ?? '']));

  const geocoderSchools = await readOptionalJson(path.join(geocoderDir, 'univ_supp.json'));
  if (!Array.isArray(geocoderSchools)) {
    throw new Error(`Missing geocoder data: ${path.join(geocoderDir, 'univ_supp.json')}`);
  }

  const poiDataset = await resolvePoiDataset();
  const poiIndex = buildPoiIndex(poiDataset.rows, normalizeSchoolName);
  const gaohrDataset = await resolveGaohrDataset();
  const gaohrIndex = buildGaohrIndex(gaohrDataset.rows, normalizeSchoolName);

  const rows = [];
  const emitted = new Set();
  const emittedBySchool = new Map();

  const stats = {
    geocoderSchools: geocoderSchools.length,
    officialSchools: officialSchools.length,
    matchedGeocoderSchools: 0,
    campusRows: 0,
    campusSchools: 0,
    withCoordinates: 0,
    highConfidenceRows: 0,
    mediumConfidenceRows: 0,
    lowConfidenceRows: 0,
    addressOnlyRows: 0,
  };

  function emitRow(school, campusName, {
    campusAddress = '',
    province = school.province,
    city = school.city,
    district = '',
    lat = '',
    lng = '',
    sourceFlags = {},
    labelledAddress = false,
    exactPoi = false,
    gaohr = false,
    notes = '',
  }) {
    const displayCampusName = makeCampusDisplayName(campusName);
    const rowKey = `${school.moeCode}|${normalizeCampusLabel(displayCampusName)}|${campusAddress}`;
    if (emitted.has(rowKey)) return;
    emitted.add(rowKey);

    const confidence = chooseConfidence({
      geocoder: Boolean(sourceFlags.geocoder),
      address: Boolean(sourceFlags.address),
      poi: Boolean(sourceFlags.poi),
      gaohr: Boolean(sourceFlags.gaohr),
      labelledAddress,
      exactPoi,
    });

    const sourceInfo = buildSourceInfo({
      geocoder: sourceFlags.geocoder,
      address: sourceFlags.address,
      poi: sourceFlags.poi,
      gaohr: sourceFlags.gaohr,
    });

    rows.push({
      moeCode: school.moeCode,
      schoolName: school.nameSimplified ?? school.name,
      campusName: displayCampusName,
      campusAddress,
      province,
      city,
      district,
      lat: lat === '' ? '' : String(lat),
      lng: lng === '' ? '' : String(lng),
      undergraduateScope: 'unknown',
      freshmanOnly: 'unknown',
      mainCampusType: '',
      nearestMetroStation: '',
      metroDistanceKm: '',
      sourceTitle: sourceInfo.title,
      sourceUrl: sourceInfo.url,
      sourceDate: '2026-04-21',
      confidence,
      notes,
    });

    if (!emittedBySchool.has(school.moeCode)) emittedBySchool.set(school.moeCode, 0);
    emittedBySchool.set(school.moeCode, emittedBySchool.get(school.moeCode) + 1);
    stats.campusRows += 1;
    if (lat !== '' && lng !== '') stats.withCoordinates += 1;
    if (confidence === 'high') stats.highConfidenceRows += 1;
    if (confidence === 'medium') stats.mediumConfidenceRows += 1;
    if (confidence === 'low') stats.lowConfidenceRows += 1;
    if (!sourceFlags.geocoder) stats.addressOnlyRows += 1;
  }

  for (const rawSchool of geocoderSchools) {
    const matchedSchool = officialByName.get(normalizeSchoolName(rawSchool.name ?? ''));
    if (!matchedSchool?.moeCode) continue;

    stats.matchedGeocoderSchools += 1;

    const parsedAddress = parseCampusAddresses(addressByMoeCode.get(matchedSchool.moeCode) ?? '');
    const usedAddressLabels = new Set();
    const geocoderCampuses = Array.isArray(rawSchool.campuses) ? rawSchool.campuses : [];

    for (const campus of geocoderCampuses) {
      const campusName = String(campus?.name ?? '').trim();
      const campusDisplayName = makeCampusDisplayName(campusName);
      const lat = Number(campus?.latitude);
      const lng = Number(campus?.longitude);
      const addressMatch = findAddressForCampus(parsedAddress, matchedSchool.nameSimplified ?? matchedSchool.name, campusName);
      const poiMatch = choosePoiMatch(
        poiIndex,
        matchedSchool,
        campusDisplayName === '主校区' ? '' : campusDisplayName,
        lat,
        lng,
        normalizeSchoolName,
      );
      const safePoiMatch = (
        campusDisplayName === '主校区'
        && !addressMatch?.labelled
        && !Number.isFinite(lat)
        && !Number.isFinite(lng)
      )
        ? (isPoiCompatibleWithSchool(poiMatch, matchedSchool) ? poiMatch : null)
        : poiMatch;

      const hasAddress = Boolean(addressMatch?.address);
      const hasPoi = Boolean(safePoiMatch);
      const isSingleCampus = geocoderCampuses.length === 1;

      if (!hasAddress && !hasPoi) {
        if (parsedAddress.labelled.size > 0) continue;
        if (!isSingleCampus) continue;
      }

      if (addressMatch?.label) usedAddressLabels.add(addressMatch.label);

      const province = safePoiMatch?.province
        ? normalizeProvinceName(safePoiMatch.province)
        : matchedSchool.province;
      const city = safePoiMatch?.city
        ? normalizeCityName(safePoiMatch.city)
        : matchedSchool.city;
      const district = safePoiMatch?.area ?? inferDistrictFromAddress(addressMatch?.address ?? '');
      const campusAddress = addressMatch?.address ?? safePoiMatch?.address ?? (isSingleCampus ? parsedAddress.singleAddress : '');
      const gaohrPoint = (
        !Number.isFinite(lat)
        && !Number.isFinite(lng)
        && campusDisplayName === '主校区'
      )
        ? gaohrIndex.get(normalizeSchoolName(matchedSchool.nameSimplified ?? matchedSchool.name))
        : null;
      const notes = [
        addressMatch?.labelled ? '校区地址与 DaoSword 宽表中的标注校区名一致。' : '',
        safePoiMatch
          ? `${safePoiMatch.matchType === 'exact' ? '百度 POI 精确匹配' : '百度 POI 近似匹配'}${Number.isFinite(safePoiMatch.distanceKm) ? `，坐标偏差约 ${safePoiMatch.distanceKm.toFixed(2)} km。` : '。'}`
          : '',
        gaohrPoint ? '补入 GaoHR 2021 校级坐标；仅作为主校区近似点位。' : '',
        (!hasAddress && !hasPoi && isSingleCampus) ? '暂仅保留单校址占位，后续需补官方校区页。' : '',
      ].filter(Boolean).join(' ');

      emitRow(matchedSchool, campusDisplayName, {
        campusAddress,
        province,
        city,
        district,
        lat: Number.isFinite(lat) ? lat : (safePoiMatch?.location?.lat ?? gaohrPoint?.lat ?? ''),
        lng: Number.isFinite(lng) ? lng : (safePoiMatch?.location?.lng ?? gaohrPoint?.lng ?? ''),
        sourceFlags: {
          geocoder: true,
          address: hasAddress || Boolean(parsedAddress.singleAddress),
          poi: hasPoi,
          gaohr: Boolean(gaohrPoint),
        },
        labelledAddress: Boolean(addressMatch?.labelled),
        exactPoi: safePoiMatch?.matchType === 'exact',
        notes: notes || `辅源：${sourceUrls.hcu}、${sourceUrls.cgsop} 可用于后续人工校验校区沿革与本科去向。`,
      });
    }

    for (const [label, address] of parsedAddress.labelled.entries()) {
      if (usedAddressLabels.has(label)) continue;
      const poiMatch = choosePoiMatch(
        poiIndex,
        matchedSchool,
        label,
        Number.NaN,
        Number.NaN,
        normalizeSchoolName,
      );

      emitRow(matchedSchool, label, {
        campusAddress: address,
        province: poiMatch?.province ? normalizeProvinceName(poiMatch.province) : matchedSchool.province,
        city: poiMatch?.city ? normalizeCityName(poiMatch.city) : matchedSchool.city,
        district: poiMatch?.area ?? inferDistrictFromAddress(address),
        lat: poiMatch?.location?.lat ?? '',
        lng: poiMatch?.location?.lng ?? '',
        sourceFlags: {
          geocoder: false,
          address: true,
          poi: Boolean(poiMatch),
        },
        labelledAddress: true,
        exactPoi: poiMatch?.matchType === 'exact',
        notes: '此校区由 DaoSword 宽表中的标注校址补入；未在 geocoder 主结果中出现，建议后续以学校校区介绍页复核。',
      });
    }
  }

  for (const school of officialSchools) {
    if (!school.moeCode || emittedBySchool.has(school.moeCode)) continue;
    const rawAddress = addressByMoeCode.get(school.moeCode) ?? '';
    if (!rawAddress) continue;

    const parsedAddress = parseCampusAddresses(rawAddress);
    const labelledEntries = Array.from(parsedAddress.labelled.entries());

    if (labelledEntries.length > 0) {
      for (const [label, address] of labelledEntries) {
        const poiMatch = choosePoiMatch(poiIndex, school, label, Number.NaN, Number.NaN, normalizeSchoolName);
        emitRow(school, label, {
          campusAddress: address,
          province: poiMatch?.province ? normalizeProvinceName(poiMatch.province) : school.province,
          city: poiMatch?.city ? normalizeCityName(poiMatch.city) : school.city,
          district: poiMatch?.area ?? inferDistrictFromAddress(address),
          lat: poiMatch?.location?.lat ?? '',
          lng: poiMatch?.location?.lng ?? '',
          sourceFlags: {
            geocoder: false,
            address: true,
            poi: Boolean(poiMatch),
          },
          labelledAddress: true,
          exactPoi: poiMatch?.matchType === 'exact',
          notes: '当前仅有聚合校址，尚未接入官方招生章程或校区说明页，暂不参与硬筛选推导。',
        });
      }
      continue;
    }

    if (parsedAddress.singleAddress) {
      const poiMatch = choosePoiMatch(poiIndex, school, '', Number.NaN, Number.NaN, normalizeSchoolName);
      const safePoiMatch = isPoiCompatibleWithSchool(poiMatch, school) ? poiMatch : null;
      const gaohrPoint = gaohrIndex.get(normalizeSchoolName(school.nameSimplified ?? school.name));
      emitRow(school, '主校区', {
        campusAddress: parsedAddress.singleAddress,
        province: safePoiMatch?.province ? normalizeProvinceName(safePoiMatch.province) : school.province,
        city: safePoiMatch?.city ? normalizeCityName(safePoiMatch.city) : school.city,
        district: safePoiMatch?.area ?? inferDistrictFromAddress(parsedAddress.singleAddress),
        lat: safePoiMatch?.location?.lat ?? gaohrPoint?.lat ?? '',
        lng: safePoiMatch?.location?.lng ?? gaohrPoint?.lng ?? '',
        sourceFlags: {
          geocoder: false,
          address: true,
          poi: Boolean(safePoiMatch),
          gaohr: Boolean(gaohrPoint),
        },
        labelledAddress: false,
        exactPoi: safePoiMatch?.matchType === 'exact',
        notes: `${gaohrPoint ? '已补 GaoHR 2021 校级坐标；' : ''}当前为学校级校址占位；需要后续 deep research 继续补本科生具体校区、是否大一分校和地铁距离。`,
      });
    }
  }

  stats.campusSchools = emittedBySchool.size;

  const header = [
    'moeCode',
    'schoolName',
    'campusName',
    'campusAddress',
    'province',
    'city',
    'district',
    'lat',
    'lng',
    'undergraduateScope',
    'freshmanOnly',
    'mainCampusType',
    'nearestMetroStation',
    'metroDistanceKm',
    'sourceTitle',
    'sourceUrl',
    'sourceDate',
    'confidence',
    'notes',
  ];

  const csv = [
    header.join(','),
    ...rows
      .sort((left, right) => (
        left.moeCode.localeCompare(right.moeCode)
        || left.campusName.localeCompare(right.campusName, 'zh-Hans-CN')
      ))
      .map((row) => header.map((column) => csvEscape(row[column] ?? '')).join(',')),
  ].join('\n');

  await fs.writeFile(outputPath, `${csv}\n`, 'utf8');

  console.log(`wrote ${path.relative(repoRoot, outputPath)}`);
  console.log(JSON.stringify({
    ...stats,
    poiDataset: poiDataset.filePath ? path.basename(poiDataset.filePath) : null,
    gaohrDataset: gaohrDataset.filePath ? path.basename(gaohrDataset.filePath) : null,
  }, null, 2));
}

await main();
