import { allQuestions } from '../data/questions';
import type { Question } from '../data/questions';
import type { DimensionId } from '../data/dimensions';
import type { School } from '../data/schools';
import { filterSchools, getSchoolDimensionValue } from './filter';

export interface QuestionOptionCoverageSummary {
  optionKey: string;
  hasRule: boolean;
  excludedCount: number;
  excludedRate: number;
  impactful: boolean;
}

export interface QuestionCoverageSummary {
  questionId: DimensionId;
  coveredSchoolCount: number;
  coveredRate: number;
  maxExcludedCount: number;
  maxExcludedRate: number;
  impactfulOptionCount: number;
  hiddenOptionCount: number;
  active: boolean;
  optionCoverageByKey: Record<string, QuestionOptionCoverageSummary>;
}

function answerForOption(question: Question, optionKey: string): string | string[] {
  return question.type === 'multi' ? [optionKey] : optionKey;
}

export function analyzeQuestionCoverage(allSchools: School[]): Record<DimensionId, QuestionCoverageSummary> {
  const total = allSchools.length || 1;
  const summary = {} as Record<DimensionId, QuestionCoverageSummary>;

  for (const question of allQuestions) {
    const coveredSchoolCount = allSchools.filter((school) => {
      const value = getSchoolDimensionValue(school, question.id);
      return Array.isArray(value) ? value.length > 0 : value !== null;
    }).length;

    let maxExcludedCount = 0;
    let impactfulOptionCount = 0;
    let hiddenOptionCount = 0;
    const optionCoverageByKey: Record<string, QuestionOptionCoverageSummary> = {};

    for (const option of question.options) {
      const hasRule = Boolean(option.excludes?.length || option.requires?.length);
      const excludedCount = hasRule
        ? filterSchools(allSchools, {
            [question.id]: answerForOption(question, option.key),
          }).stats.excludedCount
        : 0;
      const impactful = excludedCount > 0;
      if (hasRule && impactful) impactfulOptionCount += 1;
      if (hasRule && !impactful) hiddenOptionCount += 1;
      if (excludedCount > maxExcludedCount) maxExcludedCount = excludedCount;
      optionCoverageByKey[option.key] = {
        optionKey: option.key,
        hasRule,
        excludedCount,
        excludedRate: excludedCount / total,
        impactful,
      };
    }

    summary[question.id] = {
      questionId: question.id,
      coveredSchoolCount,
      coveredRate: coveredSchoolCount / total,
      maxExcludedCount,
      maxExcludedRate: maxExcludedCount / total,
      impactfulOptionCount,
      hiddenOptionCount,
      active: impactfulOptionCount > 0,
      optionCoverageByKey,
    };
  }

  return summary;
}

export function getActiveQuestions(allSchools: School[]): Question[] {
  const coverage = analyzeQuestionCoverage(allSchools);
  return allQuestions.filter((question) => coverage[question.id]?.active);
}

export function getVisibleOptions(question: Question, coverage: QuestionCoverageSummary): Question['options'] {
  return question.options.filter((option) => {
    const optionCoverage = coverage.optionCoverageByKey[option.key];
    if (!optionCoverage) return true;
    return !optionCoverage.hasRule || optionCoverage.impactful;
  });
}
