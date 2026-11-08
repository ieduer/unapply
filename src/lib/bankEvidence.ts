import { questionEvidence } from '../data/questionEvidence'

/**
 * 題庫效度證據 → 出題引擎的取值集合（批 G8 起集中一處）：`#/global`、audit:regions、tests 用同一份，免得三處各組一次。
 * 教資會資助、原句判讀為 confirmed 的管道、澳門公立／私立（未寫明者兩邊都不在）、香港最低年學費（港幣）。
 */
export function bankEvidence() {
  return {
    ugcFunded: new Set<string>(questionEvidence.ugcFunded.ids),
    confirmedChannels: new Set<string>(questionEvidence.channelChecks.confirmed),
    macauPublic: new Set<string>(questionEvidence.macauOwnership.public),
    macauPrivate: new Set<string>(questionEvidence.macauOwnership.private),
    hkTuitionMin: new Map<string, number>(questionEvidence.hkTuition.rows.map((r) => [r.id, r.min])),
  }
}
