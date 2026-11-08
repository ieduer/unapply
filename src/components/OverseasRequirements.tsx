import { useEffect, useState } from 'react'
import { loadOverseasRequirements, type OverseasRequirementsPayload } from '../lib/overseasRequirements'
import { useLocale } from '../i18n/react'

/**
 * 海外機構「錄取條件（官方原文）」兩行（批 G8，R1）：英語要求（IELTS／TOEFL 最低總分）與國際生本科年學費。
 * 只有研究抽出且核對過的機構才有；沒有就不顯示（不是「沒有要求」）。覆蓋不足，不作題目、不劃掉任何學校。
 */
export function OverseasRequirements({ id, compact = false }: { id: string; compact?: boolean }) {
  const { t, n } = useLocale()
  const [payload, setPayload] = useState<OverseasRequirementsPayload | null>(null)
  useEffect(() => { let alive = true; loadOverseasRequirements().then((p) => { if (alive) setPayload(p) }).catch(() => {}); return () => { alive = false } }, [])
  const req = payload?.institutions[id]
  if (!req || (!req.english && !req.tuition)) return null
  const e = req.english, fee = req.tuition
  const scores = e ? [e.ielts !== null ? `IELTS ${e.ielts}` : '', e.toefl !== null ? `TOEFL iBT ${e.toefl}` : '', e.toeflBand !== null ? `TOEFL ${t('ui.req.toeflBand', { band: e.toeflBand })}` : ''].filter(Boolean).join(' · ') : ''
  const amount = fee ? `${fee.currency} ${n(fee.min)}${fee.max !== null && fee.max > fee.min ? `–${n(fee.max)}` : ''}` : ''
  return (
    <div className="flex flex-col gap-2 text-xs text-fog-300 leading-relaxed" data-requirements={id}>
      {e && (
        <div data-requirements-english>
          <p><b className="text-fog-100">{t('ui.req.english')}</b>{t('ui.req.englishLine', { scores })}{e.scope === 'all-levels' ? ` ${t('ui.req.allLevels')}` : ''}</p>
          {!compact && <p className="text-fog-500">「{e.quote}」</p>}
          <p className="text-fog-500"><a className="tap underline hover:text-accent-500" href={e.url} target="_blank" rel="noreferrer noopener">{t('ui.req.source')} ↗</a> · {t('ui.req.fetched', { date: e.fetchedAt })}</p>
        </div>
      )}
      {fee && (
        <div data-requirements-tuition>
          <p><b className="text-fog-100">{t('ui.req.tuition')}</b>{t('ui.req.tuitionLine', { amount, year: fee.academicYear ?? t('ui.req.yearUnstated') })}</p>
          {!compact && <p className="text-fog-500">「{fee.quote}」</p>}
          <p className="text-fog-500"><a className="tap underline hover:text-accent-500" href={fee.url} target="_blank" rel="noreferrer noopener">{t('ui.req.source')} ↗</a> · {t('ui.req.fetched', { date: fee.fetchedAt })}</p>
        </div>
      )}
      {!compact && <p className="text-fog-500">{t('ui.req.note')}</p>}
    </div>
  )
}
