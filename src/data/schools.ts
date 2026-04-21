// 學校數據聚合層
//
// 第一層：src/data/officialSchools.ts，來自教育部 2025 全國普通高等學校名單，2919 所。
// 第二層：curatedSchools，人工補強少量主流院校的英文名、官網、校區與眾包樣本。
//
// 原則：官方名單能確定的字段才全量填充；校區、生活質量、精確學費等缺失就保持 undefined，
// 由 FilterEngine 疑罪從無處理。

import type { DimensionId } from './dimensions';
import type { SchoolResearchEvidenceMap } from './runtimeTypes';
import { officialSchoolCatalogMeta } from './officialSchoolMeta';
import { officialSchools } from './officialSchools';
import { schoolResearchProfilesByMoeCode } from './researchData';
import { normalizeSchoolName } from '../lib/schoolName';

export type SchoolLevel = 'C9' | '985非C9' | '211非985' | '雙一流非211' | '普通本科' | '專科';
export type CityTier = 'tier1' | 'newtier1' | 'tier2' | 'tier3_below';
export type CampusType = 'main_city' | 'suburb_with_metro' | 'suburb' | 'separate_freshman';
export type TuitionRange = '公辦' | '1-3萬' | '3-8萬' | '8萬+' | '民辦/合作待核價';
export type SchoolOwnership = 'public' | 'private' | 'cooperative' | 'unknown';
export type SchoolType = '綜合' | '理工' | '師範' | '農林' | '醫藥' | '財經' | '政法' | '語言' | '民族' | '藝術' | '體育' | '軍事';

export interface School {
  id: string;
  name: string;
  nameSimplified?: string;
  nameEn?: string;
  province: string;
  city: string;
  schoolAddress?: string;
  cityTier?: CityTier;
  level?: SchoolLevel;
  type?: SchoolType;
  website?: string;
  admissionWebsite?: string;
  mainCampusType?: CampusType;
  campusFreshmanPolicy?: 'yes' | 'no' | 'unknown';
  tuitionRange?: TuitionRange;
  ownership?: SchoolOwnership;
  moeCode?: string;
  department?: string;
  moeLevel?: string;
  sources?: string[];
  sourceUrl?: string;
  updatedAt?: string;
  tags?: string[];
  researchEvidence?: SchoolResearchEvidenceMap;
  // 生活質量與學科維度：可部分覆蓋，未知為 undefined → 引擎疑罪從無
  quality?: Partial<Record<DimensionId, string | string[]>>;
}

const mk = (
  name: string,
  province: string,
  city: string,
  cityTier: CityTier,
  level: SchoolLevel,
  type: School['type'],
  extra?: Partial<School>,
): School => ({
  id: name,
  name,
  province,
  city,
  cityTier,
  level,
  type,
  mainCampusType: 'main_city',
  tuitionRange: '公辦',
  ...extra,
});

export const curatedSchools: School[] = [
  // ============ C9 ============
  mk('北京大學', '北京', '北京', 'tier1', 'C9', '綜合', {
    website: 'https://www.pku.edu.cn', nameEn: 'Peking University',
    quality: { 'C5': 'CS:A+', 'B5': '每週1-2次' },
  }),
  mk('清華大學', '北京', '北京', 'tier1', 'C9', '理工', {
    website: 'https://www.tsinghua.edu.cn', nameEn: 'Tsinghua University',
    quality: { 'C5': 'CS:A+' },
  }),
  mk('復旦大學', '上海', '上海', 'tier1', 'C9', '綜合', { website: 'https://www.fudan.edu.cn' }),
  mk('上海交通大學', '上海', '上海', 'tier1', 'C9', '綜合', { website: 'https://www.sjtu.edu.cn' }),
  mk('浙江大學', '浙江', '杭州', 'newtier1', 'C9', '綜合', {
    website: 'https://www.zju.edu.cn',
    quality: { 'C5': 'CS:A' },
    mainCampusType: 'suburb_with_metro',
    tags: ['紫金港主校區'],
  }),
  mk('南京大學', '江蘇', '南京', 'newtier1', 'C9', '綜合', { website: 'https://www.nju.edu.cn' }),
  mk('中國科學技術大學', '安徽', '合肥', 'newtier1', 'C9', '理工', { website: 'https://www.ustc.edu.cn' }),
  mk('哈爾濱工業大學', '黑龍江', '哈爾濱', 'tier2', 'C9', '理工', {
    website: 'https://www.hit.edu.cn',
    tags: ['另有威海、深圳校區'],
  }),
  mk('西安交通大學', '陝西', '西安', 'newtier1', 'C9', '理工', { website: 'https://www.xjtu.edu.cn' }),

  // ============ 985 非 C9（30 所） ============
  mk('中國人民大學', '北京', '北京', 'tier1', '985非C9', '綜合', { website: 'https://www.ruc.edu.cn' }),
  mk('北京師範大學', '北京', '北京', 'tier1', '985非C9', '師範', { website: 'https://www.bnu.edu.cn' }),
  mk('北京航空航天大學', '北京', '北京', 'tier1', '985非C9', '理工', { website: 'https://www.buaa.edu.cn' }),
  mk('北京理工大學', '北京', '北京', 'tier1', '985非C9', '理工', { website: 'https://www.bit.edu.cn' }),
  mk('中國農業大學', '北京', '北京', 'tier1', '985非C9', '農林', { website: 'https://www.cau.edu.cn' }),
  mk('中央民族大學', '北京', '北京', 'tier1', '985非C9', '民族', { website: 'https://www.muc.edu.cn' }),
  mk('南開大學', '天津', '天津', 'newtier1', '985非C9', '綜合', { website: 'https://www.nankai.edu.cn' }),
  mk('天津大學', '天津', '天津', 'newtier1', '985非C9', '理工', { website: 'https://www.tju.edu.cn' }),
  mk('大連理工大學', '遼寧', '大連', 'tier2', '985非C9', '理工', { website: 'https://www.dlut.edu.cn' }),
  mk('東北大學', '遼寧', '瀋陽', 'newtier1', '985非C9', '理工', { website: 'https://www.neu.edu.cn' }),
  mk('吉林大學', '吉林', '長春', 'tier2', '985非C9', '綜合', { website: 'https://www.jlu.edu.cn' }),
  mk('同濟大學', '上海', '上海', 'tier1', '985非C9', '綜合', { website: 'https://www.tongji.edu.cn' }),
  mk('華東師範大學', '上海', '上海', 'tier1', '985非C9', '師範', { website: 'https://www.ecnu.edu.cn' }),
  mk('東南大學', '江蘇', '南京', 'newtier1', '985非C9', '綜合', { website: 'https://www.seu.edu.cn' }),
  mk('中國海洋大學', '山東', '青島', 'newtier1', '985非C9', '綜合', { website: 'https://www.ouc.edu.cn' }),
  mk('山東大學', '山東', '濟南', 'newtier1', '985非C9', '綜合', { website: 'https://www.sdu.edu.cn' }),
  mk('廈門大學', '福建', '廈門', 'tier2', '985非C9', '綜合', { website: 'https://www.xmu.edu.cn' }),
  mk('中山大學', '廣東', '廣州', 'tier1', '985非C9', '綜合', { website: 'https://www.sysu.edu.cn' }),
  mk('華南理工大學', '廣東', '廣州', 'tier1', '985非C9', '理工', { website: 'https://www.scut.edu.cn' }),
  mk('武漢大學', '湖北', '武漢', 'newtier1', '985非C9', '綜合', { website: 'https://www.whu.edu.cn' }),
  mk('華中科技大學', '湖北', '武漢', 'newtier1', '985非C9', '理工', { website: 'https://www.hust.edu.cn' }),
  mk('湖南大學', '湖南', '長沙', 'newtier1', '985非C9', '綜合', { website: 'https://www.hnu.edu.cn' }),
  mk('中南大學', '湖南', '長沙', 'newtier1', '985非C9', '綜合', { website: 'https://www.csu.edu.cn' }),
  mk('重慶大學', '重慶', '重慶', 'newtier1', '985非C9', '綜合', { website: 'https://www.cqu.edu.cn' }),
  mk('電子科技大學', '四川', '成都', 'newtier1', '985非C9', '理工', { website: 'https://www.uestc.edu.cn' }),
  mk('四川大學', '四川', '成都', 'newtier1', '985非C9', '綜合', { website: 'https://www.scu.edu.cn' }),
  mk('蘭州大學', '甘肅', '蘭州', 'tier2', '985非C9', '綜合', { website: 'https://www.lzu.edu.cn' }),
  mk('西北工業大學', '陝西', '西安', 'newtier1', '985非C9', '理工', { website: 'https://www.nwpu.edu.cn' }),
  mk('西北農林科技大學', '陝西', '楊凌', 'tier3_below', '985非C9', '農林', {
    website: 'https://www.nwsuaf.edu.cn',
    mainCampusType: 'suburb', tags: ['位於楊凌農業高新區，遠離西安'],
  }),
  mk('國防科技大學', '湖南', '長沙', 'newtier1', '985非C9', '軍事', { tags: ['軍校，單獨招生'] }),
  mk('華東理工大學', '上海', '上海', 'tier1', '211非985', '理工', { website: 'https://www.ecust.edu.cn' }),

  // ============ 211 非 985（60 所主要） ============
  mk('北京交通大學', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.bjtu.edu.cn' }),
  mk('北京科技大學', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.ustb.edu.cn' }),
  mk('北京郵電大學', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.bupt.edu.cn' }),
  mk('北京化工大學', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.buct.edu.cn' }),
  mk('北京林業大學', '北京', '北京', 'tier1', '211非985', '農林', { website: 'https://www.bjfu.edu.cn' }),
  mk('北京工業大學', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.bjut.edu.cn' }),
  mk('北京中醫藥大學', '北京', '北京', 'tier1', '211非985', '醫藥', { website: 'https://www.bucm.edu.cn' }),
  mk('中國政法大學', '北京', '北京', 'tier1', '211非985', '政法', { website: 'https://www.cupl.edu.cn' }),
  mk('中央財經大學', '北京', '北京', 'tier1', '211非985', '財經', { website: 'https://www.cufe.edu.cn' }),
  mk('對外經濟貿易大學', '北京', '北京', 'tier1', '211非985', '財經', { website: 'https://www.uibe.edu.cn' }),
  mk('中國傳媒大學', '北京', '北京', 'tier1', '211非985', '藝術', { website: 'https://www.cuc.edu.cn' }),
  mk('北京外國語大學', '北京', '北京', 'tier1', '211非985', '語言', { website: 'https://www.bfsu.edu.cn' }),
  mk('中央音樂學院', '北京', '北京', 'tier1', '211非985', '藝術', { website: 'https://www.ccom.edu.cn' }),
  mk('華北電力大學', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.ncepu.edu.cn', tags: ['另有保定校區'] }),
  mk('中國地質大學（北京）', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.cugb.edu.cn' }),
  mk('中國礦業大學（北京）', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.cumtb.edu.cn' }),
  mk('中國石油大學（北京）', '北京', '北京', 'tier1', '211非985', '理工', { website: 'https://www.cup.edu.cn' }),
  mk('中國藥科大學', '江蘇', '南京', 'newtier1', '211非985', '醫藥', { website: 'https://www.cpu.edu.cn' }),
  mk('河海大學', '江蘇', '南京', 'newtier1', '211非985', '理工', { website: 'https://www.hhu.edu.cn' }),
  mk('南京理工大學', '江蘇', '南京', 'newtier1', '211非985', '理工', { website: 'https://www.njust.edu.cn' }),
  mk('南京航空航天大學', '江蘇', '南京', 'newtier1', '211非985', '理工', { website: 'https://www.nuaa.edu.cn' }),
  mk('南京農業大學', '江蘇', '南京', 'newtier1', '211非985', '農林', { website: 'https://www.njau.edu.cn' }),
  mk('南京師範大學', '江蘇', '南京', 'newtier1', '211非985', '師範', { website: 'https://www.njnu.edu.cn' }),
  mk('蘇州大學', '江蘇', '蘇州', 'newtier1', '211非985', '綜合', { website: 'https://www.suda.edu.cn' }),
  mk('上海大學', '上海', '上海', 'tier1', '211非985', '綜合', { website: 'https://www.shu.edu.cn' }),
  mk('上海外國語大學', '上海', '上海', 'tier1', '211非985', '語言', { website: 'https://www.shisu.edu.cn' }),
  mk('上海財經大學', '上海', '上海', 'tier1', '211非985', '財經', { website: 'https://www.sufe.edu.cn' }),
  mk('東華大學', '上海', '上海', 'tier1', '211非985', '理工', { website: 'https://www.dhu.edu.cn' }),
  mk('暨南大學', '廣東', '廣州', 'tier1', '211非985', '綜合', { website: 'https://www.jnu.edu.cn' }),
  mk('華南師範大學', '廣東', '廣州', 'tier1', '211非985', '師範', { website: 'https://www.scnu.edu.cn' }),
  mk('華中師範大學', '湖北', '武漢', 'newtier1', '211非985', '師範', { website: 'https://www.ccnu.edu.cn' }),
  mk('華中農業大學', '湖北', '武漢', 'newtier1', '211非985', '農林', { website: 'https://www.hzau.edu.cn' }),
  mk('中國地質大學（武漢）', '湖北', '武漢', 'newtier1', '211非985', '理工', { website: 'https://www.cug.edu.cn' }),
  mk('武漢理工大學', '湖北', '武漢', 'newtier1', '211非985', '理工', { website: 'https://www.whut.edu.cn' }),
  mk('中南財經政法大學', '湖北', '武漢', 'newtier1', '211非985', '財經', { website: 'https://www.zuel.edu.cn' }),
  mk('湖南師範大學', '湖南', '長沙', 'newtier1', '211非985', '師範', { website: 'https://www.hunnu.edu.cn' }),
  mk('東北師範大學', '吉林', '長春', 'tier2', '211非985', '師範', { website: 'https://www.nenu.edu.cn' }),
  mk('東北林業大學', '黑龍江', '哈爾濱', 'tier2', '211非985', '農林', { website: 'https://www.nefu.edu.cn' }),
  mk('哈爾濱工程大學', '黑龍江', '哈爾濱', 'tier2', '211非985', '理工', { website: 'https://www.hrbeu.edu.cn' }),
  mk('遼寧大學', '遼寧', '瀋陽', 'newtier1', '211非985', '綜合', { website: 'https://www.lnu.edu.cn' }),
  mk('大連海事大學', '遼寧', '大連', 'tier2', '211非985', '理工', { website: 'https://www.dlmu.edu.cn' }),
  mk('延邊大學', '吉林', '延吉', 'tier3_below', '211非985', '綜合', { website: 'https://www.ybu.edu.cn' }),
  mk('西南交通大學', '四川', '成都', 'newtier1', '211非985', '理工', { website: 'https://www.swjtu.edu.cn' }),
  mk('西南財經大學', '四川', '成都', 'newtier1', '211非985', '財經', { website: 'https://www.swufe.edu.cn' }),
  mk('四川農業大學', '四川', '雅安', 'tier3_below', '211非985', '農林', { website: 'https://www.sicau.edu.cn' }),
  mk('西南大學', '重慶', '重慶', 'newtier1', '211非985', '綜合', { website: 'https://www.swu.edu.cn' }),
  mk('雲南大學', '雲南', '昆明', 'newtier1', '211非985', '綜合', { website: 'https://www.ynu.edu.cn' }),
  mk('貴州大學', '貴州', '貴陽', 'tier2', '211非985', '綜合', { website: 'https://www.gzu.edu.cn' }),
  mk('西藏大學', '西藏', '拉薩', 'tier3_below', '211非985', '綜合', { website: 'https://www.utibet.edu.cn' }),
  mk('廣西大學', '廣西', '南寧', 'tier2', '211非985', '綜合', { website: 'https://www.gxu.edu.cn' }),
  mk('海南大學', '海南', '海口', 'tier2', '211非985', '綜合', { website: 'https://www.hainanu.edu.cn' }),
  mk('福州大學', '福建', '福州', 'tier2', '211非985', '理工', { website: 'https://www.fzu.edu.cn' }),
  mk('鄭州大學', '河南', '鄭州', 'newtier1', '211非985', '綜合', { website: 'https://www.zzu.edu.cn' }),
  mk('太原理工大學', '山西', '太原', 'tier2', '211非985', '理工', { website: 'https://www.tyut.edu.cn' }),
  mk('內蒙古大學', '內蒙古', '呼和浩特', 'tier2', '211非985', '綜合', { website: 'https://www.imu.edu.cn' }),
  mk('新疆大學', '新疆', '烏魯木齊', 'tier2', '211非985', '綜合', { website: 'https://www.xju.edu.cn' }),
  mk('石河子大學', '新疆', '石河子', 'tier3_below', '211非985', '綜合', { website: 'https://www.shzu.edu.cn' }),
  mk('寧夏大學', '寧夏', '銀川', 'tier2', '211非985', '綜合', { website: 'https://www.nxu.edu.cn' }),
  mk('青海大學', '青海', '西寧', 'tier2', '211非985', '綜合', { website: 'https://www.qhu.edu.cn' }),
  mk('中國礦業大學', '江蘇', '徐州', 'tier3_below', '211非985', '理工', { website: 'https://www.cumt.edu.cn' }),
  mk('江南大學', '江蘇', '無錫', 'newtier1', '211非985', '綜合', { website: 'https://www.jiangnan.edu.cn' }),
  mk('中央戲劇學院', '北京', '北京', 'tier1', '雙一流非211', '藝術', { website: 'https://www.chntheatre.edu.cn' }),

  // ============ 雙一流非 211（20 所） ============
  mk('上海科技大學', '上海', '上海', 'tier1', '雙一流非211', '理工', { website: 'https://www.shanghaitech.edu.cn' }),
  mk('南方科技大學', '廣東', '深圳', 'tier1', '雙一流非211', '理工', { website: 'https://www.sustech.edu.cn' }),
  mk('上海海洋大學', '上海', '上海', 'tier1', '雙一流非211', '農林', { website: 'https://www.shou.edu.cn' }),
  mk('天津工業大學', '天津', '天津', 'newtier1', '雙一流非211', '理工', { website: 'https://www.tiangong.edu.cn' }),
  mk('河北工業大學', '河北', '天津', 'newtier1', '雙一流非211', '理工', { website: 'https://www.hebut.edu.cn', tags: ['河北省屬，校址在天津'] }),
  mk('河南大學', '河南', '開封', 'tier3_below', '雙一流非211', '綜合', { website: 'https://www.henu.edu.cn' }),
  mk('寧波大學', '浙江', '寧波', 'newtier1', '雙一流非211', '綜合', { website: 'https://www.nbu.edu.cn' }),
  mk('中國美術學院', '浙江', '杭州', 'newtier1', '雙一流非211', '藝術', { website: 'https://www.caa.edu.cn' }),
  mk('成都理工大學', '四川', '成都', 'newtier1', '雙一流非211', '理工', { website: 'https://www.cdut.edu.cn' }),
  mk('西南石油大學', '四川', '成都', 'newtier1', '雙一流非211', '理工', { website: 'https://www.swpu.edu.cn' }),
  mk('首都師範大學', '北京', '北京', 'tier1', '雙一流非211', '師範', { website: 'https://www.cnu.edu.cn' }),
  mk('外交學院', '北京', '北京', 'tier1', '雙一流非211', '語言', { website: 'https://www.cfau.edu.cn' }),
  mk('中國人民公安大學', '北京', '北京', 'tier1', '雙一流非211', '政法', { website: 'https://www.ppsuc.edu.cn' }),
  mk('中央美術學院', '北京', '北京', 'tier1', '雙一流非211', '藝術', { website: 'https://www.cafa.edu.cn' }),
  mk('中國音樂學院', '北京', '北京', 'tier1', '雙一流非211', '藝術', { website: 'https://www.ccmusic.edu.cn' }),
  mk('上海音樂學院', '上海', '上海', 'tier1', '雙一流非211', '藝術', { website: 'https://www.shcmusic.edu.cn' }),
  mk('上海中醫藥大學', '上海', '上海', 'tier1', '雙一流非211', '醫藥', { website: 'https://www.shutcm.edu.cn' }),
  mk('南京信息工程大學', '江蘇', '南京', 'newtier1', '雙一流非211', '理工', { website: 'https://www.nuist.edu.cn' }),
  mk('南京林業大學', '江蘇', '南京', 'newtier1', '雙一流非211', '農林', { website: 'https://www.njfu.edu.cn' }),
  mk('廣州醫科大學', '廣東', '廣州', 'tier1', '雙一流非211', '醫藥', { website: 'https://www.gzhmu.edu.cn' }),
  mk('廣州中醫藥大學', '廣東', '廣州', 'tier1', '雙一流非211', '醫藥', { website: 'https://www.gzucm.edu.cn' }),
  mk('山西大學', '山西', '太原', 'tier2', '雙一流非211', '綜合', { website: 'https://www.sxu.edu.cn' }),
  mk('湘潭大學', '湖南', '湘潭', 'tier3_below', '雙一流非211', '綜合', { website: 'https://www.xtu.edu.cn' }),
  mk('華南農業大學', '廣東', '廣州', 'tier1', '雙一流非211', '農林', { website: 'https://www.scau.edu.cn' }),

  // 少量普通本科代表，以便測試「不限層次」選項
  mk('首都經濟貿易大學', '北京', '北京', 'tier1', '普通本科', '財經', { website: 'https://www.cueb.edu.cn' }),
  mk('深圳大學', '廣東', '深圳', 'tier1', '普通本科', '綜合', { website: 'https://www.szu.edu.cn' }),
  mk('南京工業大學', '江蘇', '南京', 'newtier1', '普通本科', '理工', { website: 'https://www.njtech.edu.cn' }),
];

function schoolNameKey(name: string): string {
  return normalizeSchoolName(name);
}

function mergeDimensionValue(
  left: string | string[] | undefined,
  right: string | string[] | undefined,
): string | string[] | undefined {
  if (!left) return right;
  if (!right) return left;
  const values = Array.from(new Set([
    ...(Array.isArray(left) ? left : [left]),
    ...(Array.isArray(right) ? right : [right]),
  ]));
  return values.length === 1 ? values[0] : values;
}

function mergeQuality(
  base: School['quality'],
  extra: School['quality'],
): School['quality'] {
  if (!base) return extra;
  if (!extra) return base;
  const merged: School['quality'] = { ...base };
  for (const [dimensionId, value] of Object.entries(extra) as [DimensionId, string | string[]][]) {
    merged[dimensionId] = mergeDimensionValue(merged[dimensionId], value);
  }
  return merged;
}

function mergeOfficialWithCurated(official: School, curated?: School): School {
  if (!curated) return official;
  const sources = Array.from(new Set([...(official.sources ?? []), ...(curated.sources ?? ['curated'])]));
  return {
    ...official,
    ...curated,
    id: curated.id,
    nameSimplified: official.nameSimplified ?? curated.nameSimplified,
    moeCode: official.moeCode,
    department: official.department,
    moeLevel: official.moeLevel,
    ownership: official.ownership ?? curated.ownership,
    sources,
    sourceUrl: official.sourceUrl ?? curated.sourceUrl,
    updatedAt: official.updatedAt ?? curated.updatedAt,
    quality: mergeQuality(official.quality, curated.quality),
  };
}

const curatedByName = new Map(
  curatedSchools.map((school) => [schoolNameKey(school.nameSimplified ?? school.name), school]),
);

const officialNameKeys = new Set<string>();
export const schools: School[] = officialSchools.map((official) => {
  const key = schoolNameKey(official.nameSimplified ?? official.name);
  officialNameKeys.add(key);
  const merged = mergeOfficialWithCurated(official, curatedByName.get(key));
  const research = merged.moeCode ? schoolResearchProfilesByMoeCode[merged.moeCode] : undefined;
  if (!research) return merged;

  const sources = Array.from(new Set([
    ...(merged.sources ?? []),
    'research',
  ]));

  return {
    ...merged,
    website: research.website ?? merged.website,
    admissionWebsite: research.admissionWebsite ?? merged.admissionWebsite,
    schoolAddress: research.schoolAddress ?? merged.schoolAddress,
    mainCampusType: research.mainCampusType ?? merged.mainCampusType,
    campusFreshmanPolicy: research.campusFreshmanPolicy ?? merged.campusFreshmanPolicy,
    ownership: research.ownership ?? merged.ownership,
    tuitionRange: research.tuitionRange ?? merged.tuitionRange,
    quality: mergeQuality(merged.quality, research.quality),
    sources,
  };
});

// 人工增強層只補官方主表，不擴張篩選主池。未匹配項保留作審計，避免把軍校、
// 別名或不在教育部普通高校附件中的院校混進 2919 所官方口徑。
export const curatedOnlySchools: School[] = curatedSchools
  .filter((school) => !officialNameKeys.has(schoolNameKey(school.nameSimplified ?? school.name)))
  .map((school) => ({
    ...school,
    sources: Array.from(new Set([...(school.sources ?? []), 'curated'])),
  }));

export const officialSchoolCount = officialSchoolCatalogMeta.ordinaryCount;
export const officialUndergraduateCount = officialSchoolCatalogMeta.undergraduateCount;
export const officialVocationalCount = officialSchoolCatalogMeta.vocationalCount;
export const adultHigherEducationCount = officialSchoolCatalogMeta.adultCount;
export const totalHigherEducationCount = officialSchoolCatalogMeta.totalHigherEducationCount;
export const totalKnownSchoolCount = officialSchoolCatalogMeta.ordinaryCount;
export const curatedSchoolCount = curatedSchools.length;
export const curatedOnlySchoolCount = curatedOnlySchools.length;
export const schoolCount = schools.length;
