import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const repoRoot = '/Users/ylsuen/CF/unapply';

const questionsModule = await import(pathToFileURL(path.join(repoRoot, 'src', 'data', 'questions.ts')).href);
const coverageModule = await import(pathToFileURL(path.join(repoRoot, 'src', 'engine', 'coverage.ts')).href);
const schools = JSON.parse(await fs.readFile(path.join(repoRoot, 'public', 'data', 'runtime', 'schools.json'), 'utf8'));
const schoolCount = schools.length;

const coverage = coverageModule.analyzeQuestionCoverage(schools);

const rows = questionsModule.allQuestions.map((question) => {
  const item = coverage[question.id];
  return {
    id: question.id,
    section: question.section,
    dataStatus: question.dataStatus,
    active: item.active ? 'yes' : 'no',
    covered: `${item.coveredSchoolCount}/${schoolCount}`,
    coveredRate: `${(item.coveredRate * 100).toFixed(1)}%`,
    maxExcluded: item.maxExcludedCount,
    impactfulOptions: item.impactfulOptionCount,
    hiddenOptions: item.hiddenOptionCount,
    title: question.title,
  };
});

rows.sort((left, right) => {
  if (left.coveredRate !== right.coveredRate) return Number.parseFloat(left.coveredRate) - Number.parseFloat(right.coveredRate);
  return left.id.localeCompare(right.id, 'en');
});

console.table(rows);

const hiddenQuestions = questionsModule.allQuestions
  .filter((question) => !coverage[question.id].active)
  .map((question) => ({
    id: question.id,
    title: question.title,
    covered: `${coverage[question.id].coveredSchoolCount}/${schoolCount}`,
    coveredRate: `${(coverage[question.id].coveredRate * 100).toFixed(1)}%`,
  }));

if (hiddenQuestions.length > 0) {
  console.log('\nHidden questions (no effective filtering yet):');
  console.table(hiddenQuestions);
}

const hiddenOptions = questionsModule.allQuestions.flatMap((question) =>
  question.options
    .filter((option) => coverage[question.id].optionCoverageByKey[option.key]?.hasRule
      && !coverage[question.id].optionCoverageByKey[option.key]?.impactful)
    .map((option) => ({
      questionId: question.id,
      optionKey: option.key,
      optionLabel: option.label,
      excluded: coverage[question.id].optionCoverageByKey[option.key].excludedCount,
    })),
);

if (hiddenOptions.length > 0) {
  console.log('\nHidden restrictive options (currently no actual exclusions):');
  console.table(hiddenOptions);
}
