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
    const answers = { location: 'skip' };
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
