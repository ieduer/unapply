// FilterEngine — 減法核心
// 原則：疑罪從無（缺失維度值不觸發排除），每一次排除必須能說明理由。

import { allQuestions } from '../data/questions';
import type { Question } from '../data/questions';
import type { DimensionId } from '../data/dimensions';
import type { School } from '../data/schools';
import { getEnvironment } from '../data/environment';
import { getSpecialAdmissionTracks } from '../lib/schoolProfile';

export type AnswerValue = string | string[] | 'skip' | null;
export type AnswerMap = Partial<Record<DimensionId, AnswerValue>>;

export interface ExcludeReason {
  questionId: DimensionId;
  questionTitle: string;
  userAnswerLabel: string;
  schoolValue: string;
}

export interface FilterStats {
  totalInput: number;
  keptCount: number;
  excludedCount: number;
  byQuestion: Record<string, number>;
  answeredCount: number;
}

export interface FilterResult {
  kept: School[];
  excluded: { school: School; reasons: ExcludeReason[] }[];
  stats: FilterStats;
}

function formatSchoolValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join(' / ') : value;
}

export function getSchoolDimensionValue(school: School, dim: DimensionId): string | string[] | null {
  switch (dim) {
    case 'A1': return school.province ?? null;
    case 'A2': return school.cityTier ?? null;
    case 'A3': return school.level ?? null;
    case 'A4': return school.tuitionRange ?? null;
    case 'A5': return school.mainCampusType ?? null;
    case 'A6': return getSpecialAdmissionTracks(school);
    case 'E1': case 'E2': case 'E3': case 'E4':
    case 'E5': case 'E6': case 'E7': case 'E8': {
      const env = getEnvironment(school.province, school.city);
      if (!env) return null;
      switch (dim) {
        case 'E1': return env.heating;
        case 'E2': return env.summer;
        case 'E3': return env.winter;
        case 'E4': return env.haze;
        case 'E5': return env.dialect;
        case 'E6': return env.subwayCity;
        case 'E7': return env.coastal;
        case 'E8': return env.highland;
      }
      return null;
    }
    default:   return school.quality?.[dim] ?? null;
  }
}

function checkQuestion(
  question: Question,
  answer: AnswerValue,
  school: School,
): ExcludeReason | null {
  if (!answer || answer === 'skip') return null;
  const keys = Array.isArray(answer) ? answer : [answer];
  if (keys.length === 0) return null;

  const excludes: { dim: DimensionId; values: string[] }[] = [];
  const requires: { dim: DimensionId; values: string[] }[] = [];
  const labels: string[] = [];

  for (const key of keys) {
    const opt = question.options.find(o => o.key === key);
    if (!opt) continue;
    labels.push(opt.label);
    if (opt.excludes) excludes.push(...opt.excludes);
    if (opt.requires) requires.push(...opt.requires);
  }

  // C5 之類 multi 的 requires 合併時：同 dim 的多個 requires 應取並集
  const requireByDim = new Map<DimensionId, Set<string>>();
  for (const r of requires) {
    if (!requireByDim.has(r.dim)) requireByDim.set(r.dim, new Set());
    for (const v of r.values) requireByDim.get(r.dim)!.add(v);
  }

  for (const rule of excludes) {
    const val = getSchoolDimensionValue(school, rule.dim);
    if (val === null) continue; // 疑罪從無
    const values = Array.isArray(val) ? val : [val];
    if (values.some((item) => rule.values.includes(item))) {
      return {
        questionId: question.id,
        questionTitle: question.title,
        userAnswerLabel: labels.join('、'),
        schoolValue: formatSchoolValue(val),
      };
    }
  }

  for (const [dim, okValues] of requireByDim) {
    const val = getSchoolDimensionValue(school, dim);
    if (val === null) continue;
    const values = Array.isArray(val) ? val : [val];
    if (!values.some((item) => okValues.has(item))) {
      return {
        questionId: question.id,
        questionTitle: question.title,
        userAnswerLabel: labels.join('、'),
        schoolValue: `${formatSchoolValue(val)}（不含 ${Array.from(okValues).join('/')}）`,
      };
    }
  }

  return null;
}

export function filterSchools(allSchools: School[], answers: AnswerMap): FilterResult {
  const kept: School[] = [];
  const excluded: { school: School; reasons: ExcludeReason[] }[] = [];
  const byQuestion: Record<string, number> = {};

  for (const school of allSchools) {
    const reasons: ExcludeReason[] = [];
    for (const question of allQuestions) {
      const ans = answers[question.id] ?? null;
      const reason = checkQuestion(question, ans, school);
      if (reason) {
        reasons.push(reason);
        byQuestion[reason.questionId] = (byQuestion[reason.questionId] ?? 0) + 1;
      }
    }
    if (reasons.length === 0) kept.push(school);
    else excluded.push({ school, reasons });
  }

  const answeredCount = Object.values(answers).filter(v => v && v !== 'skip' && (!Array.isArray(v) || v.length > 0)).length;

  return {
    kept,
    excluded,
    stats: {
      totalInput: allSchools.length,
      keptCount: kept.length,
      excludedCount: excluded.length,
      byQuestion,
      answeredCount,
    },
  };
}

// 給結果頁用的：「你為什麼沒劃掉它」一句話
export function explainKept(school: School, _answers: AnswerMap): string {
  void _answers;
  const bits: string[] = [];
  if (school.level === 'C9') bits.push('C9');
  else if (school.level === '985非C9') bits.push('985');
  else if (school.level === '211非985') bits.push('211');
  else if (school.level === '雙一流非211') bits.push('雙一流');
  if (school.cityTier === 'tier1') bits.push('一線');
  else if (school.cityTier === 'newtier1') bits.push('新一線');
  if (school.type && bits.length < 3) bits.push(school.type);
  if (bits.length === 0) return '沒有設到會排除它的條件';
  return bits.slice(0, 3).join(' · ');
}

// 給結果頁提示：如果剩 0 所，提示放寬哪幾題
export function suggestRelax(stats: FilterStats, topN = 3): string[] {
  const entries = Object.entries(stats.byQuestion);
  entries.sort((a, b) => b[1] - a[1]);
  return entries.slice(0, topN).map(([qid]) => {
    const q = allQuestions.find(q => q.id === qid);
    return q ? q.title : qid;
  });
}

// 分佈統計：按省份、層次
export interface KeptDistribution {
  byProvince: { label: string; count: number }[];
  byLevel: { label: string; count: number }[];
  byCityTier: { label: string; count: number }[];
}

const levelDistLabel: Record<NonNullable<School['level']>, string> = {
  C9: 'C9',
  '985非C9': '985 非 C9',
  '211非985': '211 非 985',
  '雙一流非211': '雙一流非 211',
  普通本科: '普通本科',
  專科: '專科',
};

const cityTierDistLabel: Record<NonNullable<School['cityTier']>, string> = {
  tier1: '一線',
  newtier1: '新一線',
  tier2: '二線',
  tier3_below: '三線及以下',
};

export function distribute(kept: School[]): KeptDistribution {
  const prov = new Map<string, number>();
  const lvl = new Map<string, number>();
  const tier = new Map<string, number>();
  for (const s of kept) {
    prov.set(s.province, (prov.get(s.province) ?? 0) + 1);
    const levelLabel = s.level ? levelDistLabel[s.level] : '未知層次';
    const tierLabel = s.cityTier ? cityTierDistLabel[s.cityTier] : '未知城市等級';
    lvl.set(levelLabel, (lvl.get(levelLabel) ?? 0) + 1);
    tier.set(tierLabel, (tier.get(tierLabel) ?? 0) + 1);
  }
  const sortDesc = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
  return {
    byProvince: sortDesc(prov),
    byLevel: sortDesc(lvl),
    byCityTier: sortDesc(tier),
  };
}
