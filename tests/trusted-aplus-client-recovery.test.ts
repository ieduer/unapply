import assert from 'node:assert/strict';
import test from 'node:test';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, String(value));
    },
    removeItem(key: string) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    get length() {
      return values.size;
    },
  } satisfies Storage;
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: memoryStorage(),
});

const client = await import('../src/lib/trustedAPlus');
const SESSION_ID = 'gap_0123456789abcdef0123456789abcdef';
const oldEnoughExpiry = () => new Date(Date.now() + (2 * 60 * 60 * 1000) - 31_000).toISOString();

function ok(body: Record<string, unknown>) {
  return new Response(JSON.stringify({ ok: true, ...body }), { status: 200 });
}

test('persists an ambiguous answer and completion, then replays the identical sequence after reload', async () => {
  client._resetUnapplyAPlusMemoryForTest();
  const originalFetch = globalThis.fetch;
  const interactionBodies: Record<string, unknown>[] = [];
  const completionBodies: Record<string, unknown>[] = [];
  let failInteractions = true;

  globalThis.fetch = async (input, init) => {
    const path = String(input);
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    if (path.endsWith('/start')) {
      return ok({ sessionId: SESSION_ID, sequence: 0, expiresAt: oldEnoughExpiry() });
    }
    if (path.endsWith('/interaction')) {
      interactionBodies.push(body);
      if (failInteractions) throw new TypeError('connection closed after request');
      return ok({ sequence: 1 });
    }
    completionBodies.push(body);
    return ok({ status: 'recorded', sequence: 2 });
  };

  try {
    const answers = { location: ['north'] };
    await assert.rejects(
      client.recordUnapplyAPlusAnswers(answers, 'location'),
      /network_unavailable/,
    );
    await assert.rejects(client.completeUnapplyAPlusSession(answers), /network_unavailable/);

    const beforeReload = client._unapplyAPlusStateForTest();
    assert.equal(beforeReload.interactions[0].sequence, 1);
    assert.equal(beforeReload.completion?.sequence, null);
    assert.equal(beforeReload.phase, 'error');

    client._resetUnapplyAPlusMemoryForTest({ preserveStorage: true });
    failInteractions = false;
    const receipt = await client.resumeUnapplyAPlusRecovery();

    assert.equal(receipt?.status, 'recorded');
    assert.equal(interactionBodies.length, 3);
    assert.deepEqual(interactionBodies[0], interactionBodies[1]);
    assert.deepEqual(interactionBodies[0], interactionBodies[2]);
    assert.equal(interactionBodies[2].sequence, 1);
    assert.equal(completionBodies.length, 1);
    assert.equal(completionBodies[0].sequence, 2);
    assert.equal(client.getUnapplyAPlusStatus().phase, 'verified');
    assert.equal(client._unapplyAPlusStateForTest().completion, null);
  } finally {
    globalThis.fetch = originalFetch;
    client._resetUnapplyAPlusMemoryForTest();
  }
});

test('uses the authoritative server sequence for the next queued answer', async () => {
  client._resetUnapplyAPlusMemoryForTest();
  const originalFetch = globalThis.fetch;
  const sequences: number[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    if (path.endsWith('/start')) {
      return ok({ sessionId: SESSION_ID, sequence: 4, expiresAt: oldEnoughExpiry() });
    }
    sequences.push(Number(body.sequence));
    return ok({ sequence: Number(body.sequence) });
  };
  try {
    await client.recordUnapplyAPlusAnswers({ location: 'skip' }, 'location');
    await client.recordUnapplyAPlusAnswers(
      { location: 'skip', public_private: 'skip' },
      'public_private',
    );
    assert.deepEqual(sequences, [5, 6]);
  } finally {
    globalThis.fetch = originalFetch;
    client._resetUnapplyAPlusMemoryForTest();
  }
});

function failure(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), { status });
}

test('a signed-out visitor is never left with a stuck error notice', async () => {
  client._resetUnapplyAPlusMemoryForTest();
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input) => {
    paths.push(String(input));
    return failure(401, 'authentication_required');
  };
  try {
    assert.equal(await client.recordUnapplyAPlusAnswers({ location: 'skip' }, 'location'), null);
    assert.equal(client.getUnapplyAPlusStatus().phase, 'idle');
    const state = client._unapplyAPlusStateForTest();
    assert.equal(state.interactions.length, 0);
    assert.equal(state.completion, null);

    await client.recordUnapplyAPlusAnswers({ location: ['north'] }, 'location');
    await client.completeUnapplyAPlusSession({ location: ['north'] }, '北京');
    assert.deepEqual(paths, ['/api/learning/start']);
    assert.equal(client.getUnapplyAPlusStatus().phase, 'idle');
  } finally {
    globalThis.fetch = originalFetch;
    client._resetUnapplyAPlusMemoryForTest();
  }
});

test('stale anonymous work saved by an older page is cleared on the next visit', async () => {
  client._resetUnapplyAPlusMemoryForTest();
  localStorage.setItem('bdfz:unapply:trusted-aplus:v2', JSON.stringify({
    version: 2,
    session: null,
    interactions: [{ id: 'old', answers: { location: 'skip' }, changedQuestionId: 'location', sequence: null }],
    completion: { answers: { location: ['north'] }, sequence: null },
    phase: 'error',
    error: 'authentication_required',
    receipt: null,
  }));
  client._resetUnapplyAPlusMemoryForTest({ preserveStorage: true });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => failure(401, 'authentication_required');
  try {
    assert.equal(client.getUnapplyAPlusStatus().phase, 'syncing');
    assert.equal(await client.resumeUnapplyAPlusRecovery(), null);
    assert.equal(client.getUnapplyAPlusStatus().phase, 'idle');
    client._resetUnapplyAPlusMemoryForTest({ preserveStorage: true });
    assert.equal(client.getUnapplyAPlusStatus().phase, 'idle');
  } finally {
    globalThis.fetch = originalFetch;
    client._resetUnapplyAPlusMemoryForTest();
  }
});

test('a deterministic rejection is reported once and not retried forever', async () => {
  client._resetUnapplyAPlusMemoryForTest();
  const originalFetch = globalThis.fetch;
  const completions: Record<string, unknown>[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    if (path.endsWith('/start')) {
      return ok({ sessionId: SESSION_ID, sequence: 0, expiresAt: oldEnoughExpiry() });
    }
    if (path.endsWith('/interaction')) return ok({ sequence: Number(body.sequence) });
    completions.push(body);
    return failure(400, 'incomplete_transcript');
  };
  try {
    await client.recordUnapplyAPlusAnswers({ location: ['north'] }, 'location');
    await assert.rejects(client.completeUnapplyAPlusSession({ location: ['north'] }, '江蘇'));
    assert.equal(completions.length, 1);
    assert.equal(completions[0].candidateProvince, '江蘇');
    const status = client.getUnapplyAPlusStatus();
    assert.equal(status.phase, 'error');
    assert.match(status.message, /不会自动重试/);
    assert.equal(client._unapplyAPlusStateForTest().completion, null);

    client._resetUnapplyAPlusMemoryForTest({ preserveStorage: true });
    assert.equal(await client.resumeUnapplyAPlusRecovery(), null);
    assert.equal(completions.length, 1);
    assert.equal(client.getUnapplyAPlusStatus().phase, 'idle');
  } finally {
    globalThis.fetch = originalFetch;
    client._resetUnapplyAPlusMemoryForTest();
  }
});

test('an all-skipped run does not submit a completion the server must reject', async () => {
  client._resetUnapplyAPlusMemoryForTest();
  const originalFetch = globalThis.fetch;
  const paths: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    paths.push(path);
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    if (path.endsWith('/start')) {
      return ok({ sessionId: SESSION_ID, sequence: 0, expiresAt: oldEnoughExpiry() });
    }
    return ok({ sequence: Number(body.sequence) });
  };
  try {
    await client.recordUnapplyAPlusAnswers({ location: 'skip' }, 'location');
    assert.equal(await client.completeUnapplyAPlusSession({ location: 'skip' }, '北京'), null);
    assert.equal(paths.some(path => path.endsWith('/complete')), false);
    assert.equal(client.getUnapplyAPlusStatus().phase, 'idle');
  } finally {
    globalThis.fetch = originalFetch;
    client._resetUnapplyAPlusMemoryForTest();
  }
});

test('a transient failure keeps the work and asks the server for the session again', async () => {
  client._resetUnapplyAPlusMemoryForTest();
  const originalFetch = globalThis.fetch;
  let starts = 0;
  let failInteraction = true;
  globalThis.fetch = async (input, init) => {
    const path = String(input);
    const body = JSON.parse(String(init?.body || '{}')) as Record<string, unknown>;
    if (path.endsWith('/start')) {
      starts += 1;
      return ok({ sessionId: SESSION_ID, sequence: 0, expiresAt: oldEnoughExpiry() });
    }
    if (failInteraction) return failure(503, 'learning_evidence_unavailable');
    return ok({ sequence: Number(body.sequence) });
  };
  try {
    await assert.rejects(client.recordUnapplyAPlusAnswers({ location: ['north'] }, 'location'));
    const status = client.getUnapplyAPlusStatus();
    assert.equal(status.phase, 'error');
    assert.match(status.message, /自动重试/);
    assert.equal(client._unapplyAPlusStateForTest().interactions.length, 1);

    failInteraction = false;
    await client.resumeUnapplyAPlusRecovery();
    assert.equal(starts, 2);
    assert.equal(client.getUnapplyAPlusStatus().phase, 'idle');
  } finally {
    globalThis.fetch = originalFetch;
    client._resetUnapplyAPlusMemoryForTest();
  }
});
