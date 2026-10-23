import { candidateProvinceOptions } from '../data/admissionAuthorities';
import type { CandidateProvince } from '../data/admissionAuthorities';
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
  candidateProvince: CandidateProvince | null;
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

const REJECTED_ERROR = 'rejected';

const listeners = new Set<() => void>();
let runtimeState = loadState();
let snapshot = statusFromState(runtimeState);
let startPromise: Promise<TrustedSession> | null = null;
let recoveryPromise: Promise<Record<string, unknown> | null> | null = null;
// 本頁收到 401 後即知未登入：匿名作答不排隊、不顯示核驗提示。重新載入頁面時重新判斷。
let signedOut = false;

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

function validProvince(value: unknown): CandidateProvince | null {
  return typeof value === 'string' && (candidateProvinceOptions as string[]).includes(value)
    ? value as CandidateProvince
    : null;
}

// 與 filterSchools 的 answeredCount 同一口徑；全部跳過時伺服器必拒，不必送出。
function hasAnsweredQuestion(answers: AnswerMap) {
  return Object.values(answers).some(
    value => value && value !== 'skip' && (!Array.isArray(value) || value.length > 0),
  );
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
        candidateProvince: validProvince(parsed.completion.candidateProvince),
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
    return state.error === REJECTED_ERROR
      ? { phase: 'error', message: '这次完成记录未被接受，不会自动重试；重新作答后可再次记录。' }
      : { phase: 'error', message: '完成记录尚未核验；恢复联网或重新打开页面后会自动重试。' };
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
      if (requestStatus(error) === 401) signedOut = true;
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
    if (result.completed === true || result.alreadyRecorded === true) {
      active.alreadyCompleted = true;
      return;
    }
    const serverSequence = sequenceFrom(result, assignedSequence);
    // 伺服器回 ok 卻沒收下這個序號：重送只會得到同樣結果，當成確定性拒絕。
    if (serverSequence < assignedSequence) {
      throw Object.assign(new Error('learning_sequence_not_advanced'), { status: 409 });
    }
    active.sequence = serverSequence;
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

function requestStatus(error: unknown) {
  const status = Number((error as { status?: number } | null)?.status);
  return Number.isInteger(status) ? status : 0;
}

// 4xx（逾時與限流除外）是確定性的拒絕：同一份紀錄重送也不會通過。
function isDeterministicRejection(status: number) {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

function dropQueuedWork() {
  runtimeState.interactions = [];
  runtimeState.completion = null;
  runtimeState.receipt = null;
}

// 本學年已完成（start 的 alreadyCompleted、互動的 completed）：UC 不再收這個會話的紀錄、序號也不前進，
// 排隊的作答與完成紀錄都送不進去。清掉，不重送；有完成紀錄時顯示已核驗（本學年的完成紀錄已在 UC）。
function settleCompletedSession() {
  const hadCompletion = Boolean(runtimeState.completion);
  dropQueuedWork();
  updatePhase(hadCompletion ? 'verified' : 'idle');
  return null;
}

async function recoverDurableWork() {
  if (signedOut) {
    dropQueuedWork();
    updatePhase('idle');
    return null;
  }
  if (runtimeState.completion && !hasAnsweredQuestion(runtimeState.completion.answers)) {
    runtimeState.completion = null;
    persistState();
  }
  if (runtimeState.interactions.length === 0 && !runtimeState.completion) {
    if (runtimeState.phase !== 'idle' && runtimeState.phase !== 'verified') updatePhase('idle');
    return null;
  }
  updatePhase('syncing');
  try {
    const active = await beginUnapplyAPlusSession();
    if (!active.alreadyCompleted) await drainInteractions(active);
    if (active.alreadyCompleted) return settleCompletedSession();
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
      ...(completion.candidateProvince ? { candidateProvince: completion.candidateProvince } : {}),
    });
    active.sequence = sequenceFrom(result, completion.sequence);
    runtimeState.interactions = [];
    runtimeState.completion = null;
    runtimeState.receipt = result;
    updatePhase('verified');
    return result;
  } catch (error) {
    // 下次重試重新取得伺服器會話與序號（會話可能已逾期或在別處前進）。
    startPromise = null;
    const status = requestStatus(error);
    if (status === 401) {
      signedOut = true;
      dropQueuedWork();
      updatePhase('idle');
      return null;
    }
    if (isDeterministicRejection(status)) {
      dropQueuedWork();
      updatePhase('error', REJECTED_ERROR);
    } else {
      updatePhase('error', error instanceof Error ? error.message : String(error));
    }
    throw error;
  }
}

function hasUnsentWork() {
  if (signedOut) return false;
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
  if (signedOut) return Promise.resolve(null);
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

export function completeUnapplyAPlusSession(
  answers: AnswerMap,
  candidateProvince: CandidateProvince | null = null,
) {
  if (signedOut || !hasAnsweredQuestion(answers)) return resumeUnapplyAPlusRecovery();
  const nextAnswers = cloneAnswers(answers);
  const province = validProvince(candidateProvince);
  if (
    !runtimeState.completion
    || JSON.stringify(runtimeState.completion.answers) !== JSON.stringify(nextAnswers)
    || runtimeState.completion.candidateProvince !== province
  ) {
    runtimeState.completion = { answers: nextAnswers, candidateProvince: province, sequence: null };
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
  signedOut = false;
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
