import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { allQuestions } from '../src/data/questions';
import { runtimeDataManifest } from '../src/data/runtimeManifest';
import type { School } from '../src/data/schools';
import { analyzeQuestionCoverage, getVisibleOptions } from '../src/engine/coverage';
import type { AnswerMap } from '../src/engine/filter';
import { __test, onRequest } from '../functions/api/learning/[action]';

const ORIGIN = 'https://nope.bdfz.net';
const SESSION_ID = 'gap_0123456789abcdef0123456789abcdef';
const schoolCatalogText = await readFile(
  new URL('../public/data/runtime/schools.json', import.meta.url),
  'utf8',
);
const schools = JSON.parse(schoolCatalogText) as School[];

function request(
  action: string,
  body?: Record<string, unknown>,
  overrides: { origin?: string; cookie?: string; method?: string } = {},
) {
  return new Request(`${ORIGIN}/api/learning/${action}`, {
    method: overrides.method || (body ? 'POST' : 'GET'),
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      Origin: overrides.origin ?? ORIGIN,
      'Sec-Fetch-Site': 'same-origin',
      Cookie: overrides.cookie ?? 'other=discard; bdfz_uc_session=signed-value; theme=discard',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function assets() {
  return {
    async fetch() {
      return new Response(schoolCatalogText, {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  };
}

function manifestAssets() {
  return {
    async fetch() {
      return new Response(JSON.stringify({
        schemaVersion: 1,
        siteKey: 'unapply',
        manifestVersion: 'unapply-result-v1',
        manifestDigest: 'sha256:136c786802e02d452210574756f5bef291c120e5edd7beee0c30856826636a99',
        itemCount: 1,
        items: [{ resourceKey: 'unapply:result:v1' }],
      }));
    },
  };
}

function completeAnswers() {
  const coverage = analyzeQuestionCoverage(schools);
  const active = allQuestions.filter(question => coverage[question.id]?.active);
  const answers: AnswerMap = {};
  active.forEach(question => {
    answers[question.id] = 'skip';
  });
  const first = active[0];
  const firstVisible = getVisibleOptions(first, coverage[first.id])[0];
  answers[first.id] = first.type === 'multi' ? [firstVisible.key] : firstVisible.key;
  return answers;
}

test('health requires the exact source descriptor', async () => {
  let descriptor: unknown;
  const response = await onRequest({
    request: request('health'),
    params: { action: 'health' },
    env: {
      ASSETS: manifestAssets(),
      APLUS_EVIDENCE: {
        async getSourceReceipt(input) {
          descriptor = input;
          return { ok: true, status: 'active', ...input };
        },
      } as never,
    },
  });
  assert.equal(response.status, 200);
  assert.deepEqual(descriptor, __test.SOURCE_DESCRIPTOR);
});

test('start pins the runtime catalog and forwards only the session cookie', async () => {
  let cookie = '';
  const response = await onRequest({
    request: request('start', {
      resourceKey: 'unapply:result:v1',
      runtimeVersion: runtimeDataManifest.version,
    }),
    params: { action: 'start' },
    env: {
      APLUS_EVIDENCE: {
        async startAPlusSession(receivedCookie) {
          cookie = receivedCookie;
          return { ok: true, sessionId: SESSION_ID };
        },
      } as never,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(cookie, 'bdfz_uc_session=signed-value');
});

test('rejects cross-origin and non-canonical choice IDs before RPC', async () => {
  let calls = 0;
  const env = {
    APLUS_EVIDENCE: {
      async recordAPlusInteraction() {
        calls += 1;
        return { ok: true };
      },
    } as never,
  };
  const crossOrigin = await onRequest({
    request: request('interaction', {}, { origin: 'https://evil.example' }),
    params: { action: 'interaction' },
    env,
  });
  assert.equal(crossOrigin.status, 403);
  const invalid = await onRequest({
    request: request('interaction', {
      sessionId: SESSION_ID,
      sequence: 1,
      runtimeVersion: runtimeDataManifest.version,
      changedQuestionId: 'A1',
      answers: { A1: 'forged' },
    }),
    params: { action: 'interaction' },
    env,
  });
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);
});

test('server recomputes the result from the pinned school catalog and sends only aggregates', async () => {
  const answers = completeAnswers();
  const rawChoice = JSON.stringify(answers);
  let interaction: Record<string, unknown> | null = null;
  let completion: Record<string, unknown> | null = null;
  const response = await onRequest({
    request: request('complete', {
      sessionId: SESSION_ID,
      sequence: Object.keys(answers).length + 1,
      runtimeVersion: runtimeDataManifest.version,
      answers,
    }),
    params: { action: 'complete' },
    env: {
      ASSETS: assets(),
      APLUS_EVIDENCE: {
        async recordAPlusInteraction(_cookie, input) {
          interaction = input;
          return { ok: true };
        },
        async completeAPlusSession(_cookie, input) {
          completion = input;
          return {
            ok: true,
            status: 'recorded',
            sourceSiteKey: 'unapply',
            manifestVersion: 'unapply-result-v1',
            eventId: 'event',
            evidenceId: 'evidence',
            alreadyRecorded: false,
          };
        },
      } as never,
    },
  });
  assert.equal(response.status, 200);
  assert.equal(interaction?.interactionKey, 'result_transcript');
  assert.match(String(interaction?.interactionDigest), /^sha256:[a-f0-9]{64}$/);
  const result = completion?.result as Record<string, unknown>;
  assert.equal(result.completionKind, 'result_generated');
  assert.equal(result.totalInput, runtimeDataManifest.counts.schools);
  assert.equal(
    Number(result.keptCount) + Number(result.excludedCount),
    runtimeDataManifest.counts.schools,
  );
  assert.match(String(result.transcriptDigest), /^sha256:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(completion).includes(rawChoice), false);
  assert.equal('answers' in result, false);
});

test('stale runtime versions and client-provided result counts fail closed', async () => {
  const response = await onRequest({
    request: request('complete', {
      sessionId: SESSION_ID,
      sequence: 1,
      runtimeVersion: 'stale',
      answers: completeAnswers(),
      keptCount: 1,
    }),
    params: { action: 'complete' },
    env: { ASSETS: assets(), APLUS_EVIDENCE: {} as never },
  });
  assert.equal(response.status, 400);
});
