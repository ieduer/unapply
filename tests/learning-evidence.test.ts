import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UNAPPLY_RESULT_EVIDENCE_SCHEMA,
  UNAPPLY_RESULT_ITEM_KEY,
  buildUnapplyResultEvidence,
} from '../src/lib/learningEvidence.ts';

test('builds strict progress and trace records from a genuine filter result', () => {
  const evidence = buildUnapplyResultEvidence({
    totalInput: 2919,
    keptCount: 9,
    excludedCount: 2910,
    answeredCount: 8,
    byQuestion: {},
  }, 'unapply-filter-canary', 'https://nope.bdfz.net/#/result');

  assert.ok(evidence);
  assert.equal(evidence.progress.itemKey, UNAPPLY_RESULT_ITEM_KEY);
  assert.equal(evidence.progress.state, 'completed');
  assert.equal((evidence.progress.meta as Record<string, unknown>).evidenceSchema, UNAPPLY_RESULT_EVIDENCE_SCHEMA);
  assert.equal((evidence.progress.meta as Record<string, unknown>).answeredCount, 8);
  assert.equal(evidence.event.contentFormat, UNAPPLY_RESULT_EVIDENCE_SCHEMA);
  assert.equal(evidence.event.recordKey, 'result:unapply-filter-canary');
});

test('rejects zero-answer and internally inconsistent results', () => {
  assert.equal(buildUnapplyResultEvidence({
    totalInput: 2919,
    keptCount: 2919,
    excludedCount: 0,
    answeredCount: 0,
    byQuestion: {},
  }, 'empty', 'https://nope.bdfz.net/'), null);

  assert.equal(buildUnapplyResultEvidence({
    totalInput: 2919,
    keptCount: 10,
    excludedCount: 2900,
    answeredCount: 2,
    byQuestion: {},
  }, 'inconsistent', 'https://nope.bdfz.net/'), null);
});
