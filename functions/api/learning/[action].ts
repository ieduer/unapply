import { allQuestions } from '../../../src/data/questions';
import type { Question } from '../../../src/data/questions';
import { runtimeDataManifest } from '../../../src/data/runtimeManifest';
import type { School } from '../../../src/data/schools';
import { analyzeQuestionCoverage, getVisibleOptions } from '../../../src/engine/coverage';
import { filterSchools } from '../../../src/engine/filter';
import type { AnswerMap, AnswerValue } from '../../../src/engine/filter';

const SOURCE_DESCRIPTOR = Object.freeze({
  sourceSiteKey: 'unapply',
  manifestVersion: 'unapply-result-v1',
  manifestDigest: 'sha256:136c786802e02d452210574756f5bef291c120e5edd7beee0c30856826636a99',
  itemCount: 1,
  loaderContractVersion: 'source-rpc-result-session-v1',
});
const RESOURCE_KEY = 'unapply:result:v1';
const CONTRACT_VERSION = 'unapply-result-v1';
const MAX_BODY_BYTES = 32 * 1024;
const MAX_COOKIE_BYTES = 4096;
const SESSION_ID_RE = /^[A-Za-z0-9._:~-]{16,256}$/;

interface APlusEvidenceService {
  getSourceReceipt(descriptor: typeof SOURCE_DESCRIPTOR): Promise<Record<string, unknown>>;
  startAPlusSession(cookieHeader: string, input: {
    contractVersion: string;
    resourceKey: string;
  }): Promise<Record<string, unknown>>;
  recordAPlusInteraction(cookieHeader: string, input: {
    sessionId: string;
    sequence: number;
    interactionKey: string;
    interactionDigest: string;
  }): Promise<Record<string, unknown>>;
  completeAPlusSession(cookieHeader: string, input: {
    sessionId: string;
    result: Record<string, unknown>;
  }): Promise<Record<string, unknown>>;
}

interface Env {
  APLUS_EVIDENCE?: APlusEvidenceService;
  ASSETS?: { fetch(request: Request): Promise<Response> };
}

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function fail(code: string, status: number) {
  return json({ ok: false, error: code }, status);
}

function sameOrigin(request: Request) {
  const origin = request.headers.get('Origin');
  const fetchSite = request.headers.get('Sec-Fetch-Site');
  return origin === new URL(request.url).origin
    && (!fetchSite || fetchSite === 'same-origin' || fetchSite === 'none');
}

function sessionCookie(request: Request) {
  const raw = request.headers.get('Cookie') || '';
  const match = raw.match(/(?:^|;\s*)(bdfz_uc_session=[^;]+)/);
  if (!match) return '';
  const value = match[1];
  return new TextEncoder().encode(value).byteLength <= MAX_COOKIE_BYTES ? value : '';
}

function onlyKeys(value: unknown, allowed: string[]): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value as Record<string, unknown>).every(key => allowed.includes(key));
}

async function boundedJson(request: Request) {
  const declared = Number(request.headers.get('Content-Length'));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw Object.assign(new Error('request_too_large'), { status: 413 });
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error('request_too_large'), { status: 413 });
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('invalid_json');
    }
    return value as Record<string, unknown>;
  } catch (error) {
    if ((error as { status?: number }).status) throw error;
    throw Object.assign(new Error('invalid_json'), { status: 400 });
  }
}

function stableCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableCanonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableCanonical((value as Record<string, unknown>)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

async function digest(value: unknown) {
  const bytes = new TextEncoder().encode(stableCanonical(value));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return `sha256:${[...new Uint8Array(hash)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

async function rawDigest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return `sha256:${[...new Uint8Array(hash)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('')}`;
}

function normalizeAnswer(question: Question, value: unknown): AnswerValue | undefined {
  if (value === 'skip') return 'skip';
  const allowed = question.options.map(option => option.key);
  if (question.type === 'single') {
    return typeof value === 'string' && allowed.includes(value) ? value : undefined;
  }
  if (
    !Array.isArray(value)
    || value.length < 1
    || value.length > allowed.length
    || new Set(value).size !== value.length
    || value.some(key => typeof key !== 'string' || !allowed.includes(key))
  ) return undefined;
  return allowed.filter(key => value.includes(key));
}

function normalizeAnswers(value: unknown, questions: Question[] = allQuestions): AnswerMap | null {
  if (!onlyKeys(value, questions.map(question => question.id))) return null;
  const input = value as Record<string, unknown>;
  const answers: AnswerMap = {};
  for (const question of questions) {
    if (!(question.id in input)) continue;
    const answer = normalizeAnswer(question, input[question.id]);
    if (answer === undefined) return null;
    answers[question.id] = answer;
  }
  return answers;
}

async function loadCanonicalSchools(request: Request, env: Env) {
  if (typeof env.ASSETS?.fetch !== 'function') throw new Error('assets unavailable');
  const url = new URL(runtimeDataManifest.schoolsPath, request.url);
  url.searchParams.set('v', runtimeDataManifest.version);
  const response = await env.ASSETS.fetch(new Request(url, { method: 'GET' }));
  if (!response.ok) throw new Error('canonical school catalog unavailable');
  const schools = await response.json() as School[];
  if (!Array.isArray(schools) || schools.length !== runtimeDataManifest.counts.schools) {
    throw new Error('canonical school catalog mismatch');
  }
  return schools;
}

function exactReceipt(receipt: Record<string, unknown> | undefined) {
  return receipt?.ok === true
    && receipt.status === 'active'
    && receipt.sourceSiteKey === SOURCE_DESCRIPTOR.sourceSiteKey
    && receipt.manifestVersion === SOURCE_DESCRIPTOR.manifestVersion
    && receipt.manifestDigest === SOURCE_DESCRIPTOR.manifestDigest
    && Number(receipt.itemCount) === SOURCE_DESCRIPTOR.itemCount
    && receipt.loaderContractVersion === SOURCE_DESCRIPTOR.loaderContractVersion;
}

function upstreamStatus(result: Record<string, unknown> | undefined) {
  if (result?.ok === true) return 200;
  const status = Number(result?.statusCode);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 422;
}

async function localSourceDescriptor(request: Request, env: Env) {
  if (typeof env.ASSETS?.fetch !== 'function') throw new Error('assets unavailable');
  const response = await env.ASSETS.fetch(new Request(
    new URL('/learning-manifest.json', request.url),
    { method: 'GET' },
  ));
  if (!response.ok) throw new Error('learning manifest unavailable');
  const manifest = await response.json() as Record<string, unknown>;
  const items = Array.isArray(manifest.items) ? manifest.items as Record<string, unknown>[] : [];
  const resourceKey = String(items[0]?.resourceKey || '');
  if (
    manifest.schemaVersion !== 1
    || manifest.siteKey !== SOURCE_DESCRIPTOR.sourceSiteKey
    || manifest.manifestVersion !== SOURCE_DESCRIPTOR.manifestVersion
    || manifest.manifestDigest !== SOURCE_DESCRIPTOR.manifestDigest
    || Number(manifest.itemCount) !== SOURCE_DESCRIPTOR.itemCount
    || items.length !== SOURCE_DESCRIPTOR.itemCount
    || resourceKey !== RESOURCE_KEY
    || await rawDigest(resourceKey) !== SOURCE_DESCRIPTOR.manifestDigest
  ) throw new Error('learning manifest mismatch');
  return SOURCE_DESCRIPTOR;
}

async function health(request: Request, env: Env) {
  if (typeof env.APLUS_EVIDENCE?.getSourceReceipt !== 'function') {
    return fail('learning_evidence_unavailable', 503);
  }
  const descriptor = await localSourceDescriptor(request, env);
  const receipt = await env.APLUS_EVIDENCE.getSourceReceipt(descriptor);
  if (!exactReceipt(receipt)) return fail('source_receipt_mismatch', 503);
  return json({ ok: true, ...SOURCE_DESCRIPTOR, receipt });
}

async function start(request: Request, env: Env, cookie: string) {
  const body = await boundedJson(request);
  if (
    !onlyKeys(body, ['resourceKey', 'runtimeVersion'])
    || body.resourceKey !== RESOURCE_KEY
    || body.runtimeVersion !== runtimeDataManifest.version
  ) return fail('invalid_request', 400);
  if (typeof env.APLUS_EVIDENCE?.startAPlusSession !== 'function') {
    return fail('learning_evidence_unavailable', 503);
  }
  const result = await env.APLUS_EVIDENCE.startAPlusSession(cookie, {
    contractVersion: CONTRACT_VERSION,
    resourceKey: RESOURCE_KEY,
  });
  return json(result, upstreamStatus(result));
}

async function interaction(request: Request, env: Env, cookie: string) {
  const body = await boundedJson(request);
  const answers = normalizeAnswers(body.answers);
  const changedQuestionId = String(body.changedQuestionId || '');
  const sequence = Number(body.sequence);
  const sessionId = String(body.sessionId || '');
  if (
    !onlyKeys(body, ['sessionId', 'sequence', 'runtimeVersion', 'changedQuestionId', 'answers'])
    || body.runtimeVersion !== runtimeDataManifest.version
    || !SESSION_ID_RE.test(sessionId)
    || !Number.isSafeInteger(sequence)
    || sequence < 1
    || sequence > 500
    || !answers
    || !(changedQuestionId in answers)
  ) return fail('invalid_transcript', 400);
  if (typeof env.APLUS_EVIDENCE?.recordAPlusInteraction !== 'function') {
    return fail('learning_evidence_unavailable', 503);
  }
  const result = await env.APLUS_EVIDENCE.recordAPlusInteraction(cookie, {
    sessionId,
    sequence,
    interactionKey: `answer:${changedQuestionId}`,
    interactionDigest: await digest(answers),
  });
  return json(result, upstreamStatus(result));
}

async function complete(request: Request, env: Env, cookie: string) {
  const body = await boundedJson(request);
  const sequence = Number(body.sequence);
  const sessionId = String(body.sessionId || '');
  if (
    !onlyKeys(body, ['sessionId', 'sequence', 'runtimeVersion', 'answers'])
    || body.runtimeVersion !== runtimeDataManifest.version
    || !SESSION_ID_RE.test(sessionId)
    || !Number.isSafeInteger(sequence)
    || sequence < 1
    || sequence > 500
  ) return fail('invalid_transcript', 400);
  if (
    typeof env.APLUS_EVIDENCE?.recordAPlusInteraction !== 'function'
    || typeof env.APLUS_EVIDENCE?.completeAPlusSession !== 'function'
  ) return fail('learning_evidence_unavailable', 503);

  const schools = await loadCanonicalSchools(request, env);
  const coverage = analyzeQuestionCoverage(schools);
  const activeQuestions = allQuestions.filter(question => coverage[question.id]?.active);
  const visibleQuestions = activeQuestions.map(question => ({
    ...question,
    options: getVisibleOptions(question, coverage[question.id]),
  }));
  const answers = normalizeAnswers(body.answers, visibleQuestions);
  if (!answers) return fail('invalid_transcript', 400);
  const result = filterSchools(schools, answers);
  const visitedEveryQuestion = activeQuestions.every(question => question.id in answers);
  if (
    result.stats.answeredCount < 1
    || (result.stats.keptCount > 10 && !visitedEveryQuestion)
  ) return fail('incomplete_transcript', 400);

  const transcriptDigest = await digest(answers);
  const interactionResult = await env.APLUS_EVIDENCE.recordAPlusInteraction(cookie, {
    sessionId,
    sequence,
    interactionKey: 'result_transcript',
    interactionDigest: transcriptDigest,
  });
  if (interactionResult?.ok !== true) {
    return json(interactionResult, upstreamStatus(interactionResult));
  }
  const completion = await env.APLUS_EVIDENCE.completeAPlusSession(cookie, {
    sessionId,
    result: {
      completionKind: 'result_generated',
      answeredCount: result.stats.answeredCount,
      totalInput: result.stats.totalInput,
      keptCount: result.stats.keptCount,
      excludedCount: result.stats.excludedCount,
      transcriptDigest,
    },
  });
  return json(completion, upstreamStatus(completion));
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: { action?: string };
}) {
  const action = String(context.params.action || '');
  if (action === 'health') {
    if (context.request.method !== 'GET') return fail('method_not_allowed', 405);
    try {
      return await health(context.request, context.env);
    } catch {
      return fail('learning_evidence_unavailable', 503);
    }
  }
  if (context.request.method !== 'POST') return fail('method_not_allowed', 405);
  if (!sameOrigin(context.request)) return fail('cross_origin_denied', 403);
  const cookie = sessionCookie(context.request);
  if (!cookie) return fail('authentication_required', 401);
  try {
    if (action === 'start') return await start(context.request, context.env, cookie);
    if (action === 'interaction') return await interaction(context.request, context.env, cookie);
    if (action === 'complete') return await complete(context.request, context.env, cookie);
    return fail('not_found', 404);
  } catch (error) {
    const status = Number((error as { status?: number }).status);
    if (status === 400 || status === 413) {
      return fail((error as Error).message, status);
    }
    return fail('learning_evidence_unavailable', 503);
  }
}

export const __test = {
  SOURCE_DESCRIPTOR,
  normalizeAnswers,
  digest,
};
