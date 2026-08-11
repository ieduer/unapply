declare global {
  interface Window {
    BdfzIdentity?: {
      mount?: (options?: { siteKey?: string; returnTo?: string }) => unknown;
      createSessionKey?: (prefix?: string) => string;
      syncProgress?: (record: Record<string, unknown>) => Promise<unknown>;
      recordEvent?: (record: Record<string, unknown>) => Promise<unknown>;
      recordDownload?: (record: Record<string, unknown>) => Promise<unknown>;
      getSession?: () => Promise<{
        authenticated?: boolean;
        user?: { id?: number; slug?: string; displayName?: string } | null;
      }>;
    };
    __unapplyIdentityMounted?: boolean;
  }
}

const SITE_KEY = 'unapply';
let sessionKey = '';

export function mountUnapplyIdentity() {
  if (typeof window === 'undefined' || window.__unapplyIdentityMounted) return;
  if (window.BdfzIdentity?.mount) {
    window.__unapplyIdentityMounted = true;
    window.BdfzIdentity.mount({ siteKey: SITE_KEY });
  } else {
    // 外部腳本異步載入的兜底重試
    window.addEventListener('load', () => {
      if (window.BdfzIdentity?.mount && !window.__unapplyIdentityMounted) {
        window.__unapplyIdentityMounted = true;
        window.BdfzIdentity.mount({ siteKey: SITE_KEY });
      }
    });
  }
}

function ensureSessionKey() {
  if (!sessionKey) {
    sessionKey =
      window.BdfzIdentity?.createSessionKey?.(`${SITE_KEY}-filter`) ||
      `${SITE_KEY}-filter-${Date.now().toString(36)}`;
  }
  return sessionKey;
}

export function getSessionKey() {
  return ensureSessionKey();
}

async function getAuthenticatedIdentity() {
  const identity = window.BdfzIdentity;
  if (!identity?.getSession) return null;
  const session = await identity.getSession().catch(() => null);
  return session?.authenticated && session.user ? identity : null;
}

function skippedAnonymous() {
  return { ok: false, skipped: true, reason: 'anonymous' };
}

export async function recordUnapplyEvent(record: Record<string, unknown>) {
  const identity = await getAuthenticatedIdentity();
  if (!identity?.recordEvent) return skippedAnonymous();
  return identity.recordEvent({
    siteKey: SITE_KEY,
    sessionKey: ensureSessionKey(),
    ...record,
  });
}

export async function recordUnapplyDownload(record: Record<string, unknown>) {
  const identity = await getAuthenticatedIdentity();
  if (!identity?.recordDownload) return skippedAnonymous();
  return identity.recordDownload({
    siteKey: SITE_KEY,
    sourceSessionKey: ensureSessionKey(),
    ...record,
  });
}

export async function syncUnapplyProgress(record: Record<string, unknown>) {
  const identity = await getAuthenticatedIdentity();
  if (!identity?.syncProgress) return skippedAnonymous();
  return identity.syncProgress({
    siteKey: SITE_KEY,
    ...record,
  });
}

export async function getUnapplyUser() {
  try {
    const resp = await window.BdfzIdentity?.getSession?.();
    return resp?.authenticated ? resp.user ?? null : null;
  } catch {
    return null;
  }
}
