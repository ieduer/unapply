import { runtimeDataManifest } from '../data/runtimeManifest';
import type { AnswerMap } from '../engine/filter';

const RESOURCE_KEY = 'unapply:result:v1';
const STORAGE_KEY = 'bdfz:unapply:trusted-aplus:v2';
const STATE_VERSION = 2;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MINIMUM_ELAPSED_MS = 30_000;
const MAX_INTERACTIONS = 500;

export type UnapplyAPlusSyncPhase = 'idle' | 'syncing' | 'verified' | 'error';

export interface UnapplyAPlusSyncStatus {
  phase: UnapplyAPlusSyncPhase;
  message: string;
}

interface TrustedSession {
  sessionId: string;
  sequence: number;
  startedAt: number;
  alreadyCompleted: boolean;
}

interface DurableInteraction {
  id: string;
  answers: AnswerMap;
  changedQuestionId: string;
  sequence: number | null;
}

interface DurableCompletion {
  answers: AnswerMap;
  sequence: number | null;
}

interface DurableState {
  version: number;
  session: TrustedSession | null;
  interactions: DurableInteraction[];
  completion: DurableCompletion | null;
  phase: UnapplyAPlusSyncPhase;
  error: string;
  receipt: Record<string, unknown> | null;
}

const listeners = new Set<() => void>();
let runtimeState = loadState();
let snapshot = statusFromState(runtimeState);
let startPromise: Promise<TrustedSession> | null = null;
let recoveryPromise: Promise<Record<string, unknown> | null> | null = null;

function freshState(): DurableState {
  return {
    version: STATE_VERSION,
    session: null,
    interactions: [],
    completion: null,
    phase: 'idle',
    error: '',
    receipt: null,
  };
}

function cloneAnswers(answers: AnswerMap): AnswerMap {
  return structuredClone(answers);
}

function validAnswers(value: unknown): value is AnswerMap {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function loadState(): DurableState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return freshState();
    const parsed = JSON.parse(raw) as Partial<DurableState>;
    if (parsed.version !== STATE_VERSION) return freshState();
    const state = freshState();
    if (
      parsed.session
      && /^[A-Za-z0-9._:~-]{16,256}$/.test(String(parsed.session.sessionId || ''))
      && Number.isSafeInteger(Number(parsed.session.sequence))
      && Number(parsed.session.sequence) >= 0
    ) {
      state.session = {
        sessionId: String(parsed.session.sessionId),
        sequence: Number(parsed.session.sequence),
        startedAt: Number(parsed.session.startedAt) || Date.now(),
        alreadyCompleted: parsed.session.alreadyCompleted === true,
      };
    }
    if (Array.isArray(parsed.interactions)) {
      state.interactions = parsed.interactions.slice(0, MAX_INTERACTIONS).flatMap((item) => {
        if (
          !item
          || !validAnswers(item.answers)
          || !/^[A-Za-z0-9_-]{1,100}$/.test(String(item.changedQuestionId || ''))
        ) return [];
        const sequence = item.sequence === null
          ? null
          : Number.isSafeInteger(Number(item.sequence)) && Number(item.sequence) >= 1
            ? Number(item.sequence)
            : null;
        return [{
          id: String(item.id || crypto.randomUUID()).slice(0, 120),
          answers: cloneAnswers(item.answers),
          changedQuestionId: String(item.changedQuestionId),
          sequence,
        }];
      });
    }
    if (parsed.completion && validAnswers(parsed.completion.answers)) {
      state.completion = {
        answers: cloneAnswers(parsed.completion.answers),
        sequence: parsed.completion.sequence === null
          ? null
          : Number.isSafeInteger(Number(parsed.completion.sequence))
              && Number(parsed.completion.sequence) >= 1
            ? Number(parsed.completion.sequence)
            : null,
      };
    }
    state.phase = parsed.phase === 'verified'
      ? 'verified'
      : state.interactions.length > 0 || state.completion
        ? 'syncing'
        : 'idle';
    state.receipt = parsed.receipt && typeof parsed.receipt === 'object'
      ? parsed.receipt as Record<string, unknown>
      : null;
    return state;
  } catch {
    return freshState();
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(runtimeState));
    return true;
  } catch {
    return false;
  }
}

function persistStateOrThrow() {
  if (!persistState()) {
    throw new Error('durable browser storage unavailable');
  }
}

function statusFromState(state: DurableState): UnapplyAPlusSyncStatus {
  if (state.phase === 'verified') {
    return { phase: 'verified', message: '完成记录已核验。' };
  }
  if (state.phase === 'syncing') {
    return { phase: 'syncing', message: '正在核验完成记录，请保持联网。' };
  }
  if (state.phase === 'error') {
    return { phase: 'error', message: '完成记录尚未核验；联网后将自动重试。' };
  }
  return { phase: 'idle', message: '完成问卷后将在这里显示核验状态。' };
}

function publish() {
  snapshot = statusFromState(runtimeState);
  listeners.forEach(listener => listener());
}

function updatePhase(phase: UnapplyAPlusSyncPhase, error = '') {
  runtimeState.phase = phase;
  runtimeState.error = error.slice(0, 240);
  persistState();
  publish();
}

function sequenceFrom(result: Record<string, unknown>, fallback: number) {
  const sequence = Number(result.sequence);
  return Number.isSafeInteger(sequence) && sequence >= 0 ? sequence : fallback;
}

async function post(path: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (cause) {
    throw Object.assign(new Error('network_unavailable'), { cause, ambiguous: true });
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok !== true) {
    throw Object.assign(
      new Error(payload?.error || `learning evidence HTTP ${response.status}`),
      { status: response.status, ambiguous: response.status >= 500 },
    );
  }
  return payload as Record<string, unknown>;
}

export function beginUnapplyAPlusSession() {
  if (startPromise) return startPromise;
  startPromise = post('/api/learning/start', {
    resourceKey: RESOURCE_KEY,
    runtimeVersion: runtimeDataManifest.version,
  })
    .then((result) => {
      const sessionId = String(result.sessionId || '');
      if (!/^[A-Za-z0-9._:~-]{16,256}$/.test(sessionId)) {
        throw new Error('invalid learning session');
      }
      const serverSequence = sequenceFrom(result, 0);
      const expiresAt = Date.parse(String(result.expiresAt || ''));
      const sameSession = runtimeState.session?.sessionId === sessionId;
      if (!sameSession) {
        runtimeState.interactions.forEach(item => {
          item.sequence = null;
        });
        if (runtimeState.completion) runtimeState.completion.sequence = null;
      }
      runtimeState.session = {
        sessionId,
        sequence: serverSequence,
        startedAt: Number.isFinite(expiresAt)
          ? expiresAt - SESSION_TTL_MS
          : sameSession
            ? runtimeState.session!.startedAt
            : Date.now(),
        alreadyCompleted: result.alreadyCompleted === true,
      };
      persistState();
      return runtimeState.session;
    })
    .catch((error) => {
      startPromise = null;
      throw error;
    });
  return startPromise;
}

async function drainInteractions(active: TrustedSession) {
  for (const item of runtimeState.interactions) {
    if (item.sequence !== null && item.sequence <= active.sequence) continue;
    if (item.sequence === null || item.sequence !== active.sequence + 1) {
      item.sequence = active.sequence + 1;
      persistStateOrThrow();
    }
    const assignedSequence = item.sequence;
    const result = await post('/api/learning/interaction', {
      sessionId: active.sessionId,
      sequence: assignedSequence,
      runtimeVersion: runtimeDataManifest.version,
      changedQuestionId: item.changedQuestionId,
      answers: item.answers,
    });
    active.sequence = sequenceFrom(result, assignedSequence);
    persistStateOrThrow();
  }
}

function waitForCompletionThreshold(active: TrustedSession) {
  if (active.alreadyCompleted) return Promise.resolve();
  const remainingMs = MINIMUM_ELAPSED_MS - (Date.now() - active.startedAt);
  return remainingMs > 0
    ? new Promise<void>(resolve => window.setTimeout(resolve, remainingMs))
    : Promise.resolve();
}

async function recoverDurableWork() {
  if (runtimeState.interactions.length === 0 && !runtimeState.completion) return null;
  updatePhase('syncing');
  try {
    const active = await beginUnapplyAPlusSession();
    await drainInteractions(active);
    if (!runtimeState.completion) {
      updatePhase('idle');
      return null;
    }
    await waitForCompletionThreshold(active);
    const completion = runtimeState.completion;
    if (completion.sequence === null || completion.sequence > active.sequence + 1) {
      completion.sequence = active.sequence + 1;
      persistStateOrThrow();
    }
    const result = await post('/api/learning/complete', {
      sessionId: active.sessionId,
      sequence: completion.sequence,
      runtimeVersion: runtimeDataManifest.version,
      answers: completion.answers,
    });
    active.sequence = sequenceFrom(result, completion.sequence);
    runtimeState.interactions = [];
    runtimeState.completion = null;
    runtimeState.receipt = result;
    updatePhase('verified');
    return result;
  } catch (error) {
    updatePhase('error', error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function hasUnsentWork() {
  const sequence = runtimeState.session?.sequence ?? 0;
  return runtimeState.interactions.some(item => item.sequence === null || item.sequence > sequence)
    || Boolean(runtimeState.completion);
}

export function resumeUnapplyAPlusRecovery(): Promise<Record<string, unknown> | null> {
  if (!recoveryPromise) {
    recoveryPromise = recoverDurableWork().finally(() => {
      recoveryPromise = null;
    });
  }
  const current = recoveryPromise;
  return current.then((result) => {
    if (hasUnsentWork()) return resumeUnapplyAPlusRecovery();
    return result;
  });
}

export function recordUnapplyAPlusAnswers(answers: AnswerMap, changedQuestionId: string) {
  runtimeState.interactions.push({
    id: crypto.randomUUID(),
    answers: cloneAnswers(answers),
    changedQuestionId,
    sequence: null,
  });
  if (runtimeState.interactions.length > MAX_INTERACTIONS) {
    runtimeState.interactions = runtimeState.interactions.slice(-MAX_INTERACTIONS);
  }
  runtimeState.receipt = null;
  runtimeState.phase = 'syncing';
  runtimeState.error = '';
  try {
    persistStateOrThrow();
  } catch (error) {
    runtimeState.phase = 'error';
    runtimeState.error = error instanceof Error ? error.message : String(error);
    publish();
    return Promise.reject(error);
  }
  publish();
  return resumeUnapplyAPlusRecovery();
}

export function completeUnapplyAPlusSession(answers: AnswerMap) {
  const nextAnswers = cloneAnswers(answers);
  if (
    !runtimeState.completion
    || JSON.stringify(runtimeState.completion.answers) !== JSON.stringify(nextAnswers)
  ) {
    runtimeState.completion = { answers: nextAnswers, sequence: null };
  }
  runtimeState.receipt = null;
  runtimeState.phase = 'syncing';
  runtimeState.error = '';
  try {
    persistStateOrThrow();
  } catch (error) {
    runtimeState.phase = 'error';
    runtimeState.error = error instanceof Error ? error.message : String(error);
    publish();
    return Promise.reject(error);
  }
  publish();
  return resumeUnapplyAPlusRecovery();
}

export function subscribeUnapplyAPlusStatus(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getUnapplyAPlusStatus() {
  return snapshot;
}

export function resetUnapplyAPlusSession() {
  if (runtimeState.completion) {
    resumeUnapplyAPlusRecovery().then(() => undefined).catch(() => undefined);
    return false;
  }
  runtimeState = freshState();
  startPromise = null;
  recoveryPromise = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage during an explicit local reset.
  }
  publish();
  return true;
}

export function _resetUnapplyAPlusMemoryForTest(options: { preserveStorage?: boolean } = {}) {
  startPromise = null;
  recoveryPromise = null;
  if (!options.preserveStorage) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Test helper only.
    }
  }
  runtimeState = loadState();
  snapshot = statusFromState(runtimeState);
}

export function _unapplyAPlusStateForTest() {
  return structuredClone(runtimeState);
}
