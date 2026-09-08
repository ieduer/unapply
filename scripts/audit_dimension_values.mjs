#!/usr/bin/env node
//
// 死值閘門。
//
// 這個站的失效模式不是報錯，是「靜默退化」：枚舉裡寫了一個取值，但主池裡
// 沒有任何學校取到它，於是引用它的選項排除數恆為 0，再被 getVisibleOptions
// 從界面上悄悄拿掉。用戶看不到那個選項，維護者看不到任何錯誤，題目就這樣
// 少了一半的表達力——A4「≤ 3 萬（可接受民辦）」正是這樣消失的。
//
// 規則：
//   1. 枚舉值在主池出現 0 次 → 必須在 dimension.reservedValues 裡顯式聲明，否則 fail。
//   2. reservedValues 裡的值如果實際上有數據了 → 聲明過期，fail。
//   3. active 題目的限制型選項排除數為 0，但它引用的值都不是 reserved → 邏輯錯誤，fail。

import { DIMENSIONS } from '../src/data/dimensions.ts';
import { allQuestions } from '../src/data/questions.ts';
import { schools } from '../src/data/schools.ts';
import { getSchoolDimensionValue } from '../src/engine/filter.ts';
import { analyzeQuestionCoverage } from '../src/engine/coverage.ts';

const issues = [];
const notes = [];
const belowThreshold = [];

// 三態，而不是有／無：
//   live            —— 有夠格進硬篩選的數據
//   below_threshold —— 數據存在，但全部是 n=1 的眾包單票，被證據門檻擋在硬篩選外
//   absent          —— 主池裡根本沒有任何學校取這個值
// 混淆後兩者會讓「證據不足」被誤記成「永久缺數據」，反過來也一樣。
const observedByDimension = new Map();
const rawObservedByDimension = new Map();
for (const dimensionId of Object.keys(DIMENSIONS)) {
  const observed = new Set();
  const rawObserved = new Set();
  for (const school of schools) {
    const value = getSchoolDimensionValue(school, dimensionId);
    if (value !== null) {
      for (const item of Array.isArray(value) ? value : [value]) observed.add(item);
    }
    const raw = school.quality?.[dimensionId];
    if (raw != null) {
      for (const item of Array.isArray(raw) ? raw : [raw]) rawObserved.add(item);
    }
  }
  observedByDimension.set(dimensionId, observed);
  rawObservedByDimension.set(dimensionId, rawObserved);
}

for (const [dimensionId, meta] of Object.entries(DIMENSIONS)) {
  const observed = observedByDimension.get(dimensionId);
  const reserved = new Set(meta.reservedValues ?? []);
  for (const value of observed) {
    if (!meta.values.includes(value)) issues.push(`${dimensionId}: 運行值 "${value}" 不在題目維度枚舉中`);
  }

  for (const value of meta.values) {
    // C5 是 `${學科}:${等第}` 的複合值，枚舉裡放的是等第，不逐一比對。

    if (observed.has(value)) {
      if (reserved.has(value)) {
        issues.push(`${dimensionId}: "${value}" 已列入 reservedValues，但主池裡已有數據，声明过期`);
      }
      continue;
    }
    if (rawObservedByDimension.get(dimensionId).has(value)) {
      belowThreshold.push(`${dimensionId}: "${value}" 有数据，但现有证据全部低于硬筛选门槛（单票众包），暂不参与排除`);
      continue;
    }
    if (reserved.has(value)) {
      notes.push(`${dimensionId}: "${value}" 主池里完全没有，已显式声明为 reserved`);
      continue;
    }
    issues.push(`${dimensionId}: 枚举值 "${value}" 在 ${schools.length} 所主池里出现 0 次，且未在 reservedValues 中声明`);
  }
}

const coverage = analyzeQuestionCoverage(schools);
for (const question of allQuestions) {
  const summary = coverage[question.id];
  if (!summary?.active) continue;
  const reserved = new Set(DIMENSIONS[question.id]?.reservedValues ?? []);

  for (const option of question.options) {
    const rules = [...(option.excludes ?? []), ...(option.requires ?? [])];
    if (rules.length === 0) continue;
    const optionCoverage = summary.optionCoverageByKey[option.key];
    if (!optionCoverage || optionCoverage.excludedCount > 0) continue;

    const referenced = rules.flatMap((rule) => rule.values);
    const rawObserved = rawObservedByDimension.get(question.id) ?? new Set();
    const allReserved = referenced.every((value) => reserved.has(value));
    const allBelowThreshold = referenced.every((value) => reserved.has(value) || rawObserved.has(value));
    if (allReserved) {
      notes.push(`${question.id}/${option.key}「${option.label}」排除 0 所，但引用的全是 reserved 值，符合预期`);
    } else if (allBelowThreshold) {
      belowThreshold.push(
        `${question.id}/${option.key}「${option.label}」排除 0 所：引用的值没有满足整校范围与年度证据门槛，`
        + `须补足适用范围与年度依据，不能只靠增加票数恢复`,
      );
    } else {
      issues.push(
        `${question.id}/${option.key}「${option.label}」排除 0 所，但引用了非 reserved 的值 ${referenced.join('、')}；`
        + `这个选项会被 getVisibleOptions 从界面上静默移除`,
      );
    }
  }
}

if (belowThreshold.length > 0) {
  console.log(`Below evidence threshold (${belowThreshold.length}):`);
  for (const item of belowThreshold) console.log(`- ${item}`);
  console.log('');
}

if (notes.length > 0) {
  console.log(`Declared-dead values (${notes.length}):`);
  for (const note of notes) console.log(`- ${note}`);
  console.log('');
}

if (issues.length > 0) {
  console.error(`Dimension-value audit failed (${issues.length}):`);
  for (const issue of issues) console.error(`- ${issue}`);
  process.exit(1);
}

console.log(`Dimension-value audit passed: ${Object.keys(DIMENSIONS).length} dimensions, ${allQuestions.length} questions, 0 blocking issues.`);
