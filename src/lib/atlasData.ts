import { t } from '../i18n/core'
import { worldAtlasManifest } from '../data/worldAtlasManifest'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'
import { fetchJson } from './fetchJson'

let atlasPromise: Promise<WorldAtlasPayload> | null = null

export function loadWorldAtlas(): Promise<WorldAtlasPayload> {
  if (!atlasPromise) {
    atlasPromise = fetchJson<WorldAtlasPayload>(`${worldAtlasManifest.path}?v=${encodeURIComponent(worldAtlasManifest.version)}`)
      .then((payload) => {
        const counts = worldAtlasManifest.counts
        if (payload.version !== worldAtlasManifest.version
          || payload.subjects?.length !== counts.subjects
          || payload.institutions?.length !== counts.institutions
          || payload.programs?.length !== counts.programs
          || payload.institutions.filter((institution) => institution.website).length !== counts.websites
          || !Array.isArray(payload.land) || payload.land.length !== counts.landPaths) {
          throw new Error(t('ui.data.error.atlas'))
        }
        return payload
      })
      .catch((error: unknown) => {
        atlasPromise = null
        throw error
      })
  }
  return atlasPromise
}
