declare global {
  interface Window {
    BdfzIdentity?: {
      mount?: (options?: { siteKey?: string; returnTo?: string }) => unknown;
      createSessionKey?: (prefix?: string) => string;
      syncProgress?: (record: Record<string, unknown>) => Promise<unknown>;
      recordEvent?: (record: Record<string, unknown>) => Promise<unknown>;
      recordDownload?: (record: Record<string, unknown>) => Promise<unknown>;
      getSession?: () => Promise<{ user?: { id: number; name?: string } | null }>;
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

export function recordUnapplyEvent(record: Record<string, unknown>) {
  return (
    window.BdfzIdentity?.recordEvent?.({
      siteKey: SITE_KEY,
      sessionKey: ensureSessionKey(),
      ...record,
    }) ?? Promise.resolve(null)
  );
}

export function recordUnapplyDownload(record: Record<string, unknown>) {
  return (
    window.BdfzIdentity?.recordDownload?.({
      siteKey: SITE_KEY,
      sourceSessionKey: ensureSessionKey(),
      ...record,
    }) ?? Promise.resolve(null)
  );
}

export function syncUnapplyProgress(record: Record<string, unknown>) {
  return (
    window.BdfzIdentity?.syncProgress?.({
      siteKey: SITE_KEY,
      ...record,
    }) ?? Promise.resolve(null)
  );
}

export async function getUnapplyUser() {
  try {
    const resp = await window.BdfzIdentity?.getSession?.();
    return resp?.user ?? null;
  } catch {
    return null;
  }
}
