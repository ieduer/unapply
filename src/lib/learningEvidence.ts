import type { FilterStats } from '../engine/filter';

export const UNAPPLY_RESULT_EVIDENCE_SCHEMA = 'unapply-result-v1';
export const UNAPPLY_RESULT_ITEM_KEY = 'unapply:result:v1';

export interface UnapplyResultEvidence {
  progress: Record<string, unknown>;
  event: Record<string, unknown>;
}

export function buildUnapplyResultEvidence(
  stats: FilterStats,
  sessionKey: string,
  sourceUrl: string,
): UnapplyResultEvidence | null {
  const answeredCount = Math.trunc(stats.answeredCount);
  const totalInput = Math.trunc(stats.totalInput);
  const excludedCount = Math.trunc(stats.excludedCount);
  const keptCount = Math.trunc(stats.keptCount);
  const normalizedSessionKey = String(sessionKey || '').trim();

  if (
    answeredCount < 1
    || totalInput < 1
    || excludedCount < 0
    || keptCount < 0
    || excludedCount + keptCount !== totalInput
    || !normalizedSessionKey
  ) {
    return null;
  }

  const meta = {
    evidenceSchema: UNAPPLY_RESULT_EVIDENCE_SCHEMA,
    completionKind: 'result_generated',
    answeredCount,
    totalInput,
    excludedCount,
    keptCount,
  };

  return {
    progress: {
      itemKey: UNAPPLY_RESULT_ITEM_KEY,
      itemTitle: '不考大學指南結果',
      itemGroup: '升學探索',
      itemType: 'learning_result',
      state: 'completed',
      progressPercent: 100,
      meta,
    },
    event: {
      recordKind: 'event',
      recordKey: `result:${normalizedSessionKey}`.slice(0, 180),
      title: '不考大學指南結果',
      summary: `完成 ${answeredCount} 個條件，從 ${totalInput} 所中保留 ${keptCount} 所`.slice(0, 220),
      itemGroup: '升學探索',
      itemType: 'learning_result',
      contentFormat: UNAPPLY_RESULT_EVIDENCE_SCHEMA,
      sourceUrl,
      payload: meta,
    },
  };
}
