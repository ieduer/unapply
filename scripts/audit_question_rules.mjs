#!/usr/bin/env node

import { DIMENSIONS } from '../src/data/dimensions.ts';
import { allQuestions } from '../src/data/questions.ts';

const issues = [];
const warnings = [];
const questionIds = new Set();
const knownDims = new Set(Object.keys(DIMENSIONS));

for (const question of allQuestions) {
  if (!knownDims.has(question.id)) {
    issues.push(`question ${question.id}: dimension is missing from DIMENSIONS`);
    continue;
  }
  if (questionIds.has(question.id)) {
    issues.push(`question ${question.id}: duplicate question id`);
  }
  questionIds.add(question.id);

  const dimMeta = DIMENSIONS[question.id];
  if (dimMeta.section !== question.section) {
    issues.push(`question ${question.id}: section ${question.section} does not match dimension section ${dimMeta.section}`);
  }
  if (question.dataStatus === 'authoritative' && dimMeta.coverage !== 'authoritative') {
    warnings.push(`question ${question.id}: dataStatus is authoritative but dimension coverage is ${dimMeta.coverage}`);
  }

  for (const option of question.options) {
    const rules = [...(option.excludes ?? []), ...(option.requires ?? [])];
    if (rules.length === 0 && !['any', 'none'].includes(option.key)) {
      warnings.push(`question ${question.id} option ${option.key}: no rule; confirm this is intentional`);
    }
    for (const rule of rules) {
      if (!knownDims.has(rule.dim)) {
        issues.push(`question ${question.id} option ${option.key}: rule dimension ${rule.dim} is missing`);
        continue;
      }
      const allowed = new Set(DIMENSIONS[rule.dim].values);
      for (const value of rule.values) {
        if (!allowed.has(value)) {
          issues.push(`question ${question.id} option ${option.key}: value "${value}" is not in DIMENSIONS.${rule.dim}.values`);
        }
      }
    }
  }
}

for (const dim of knownDims) {
  if (!questionIds.has(dim)) {
    warnings.push(`dimension ${dim}: no question uses this dimension`);
  }
}

if (warnings.length) {
  console.warn(`Question-rule audit warnings (${warnings.length}):`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (issues.length) {
  console.error(`Question-rule audit failed (${issues.length}):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Question-rule audit passed: ${allQuestions.length} questions, ${knownDims.size} dimensions, 0 blocking issues.`);
