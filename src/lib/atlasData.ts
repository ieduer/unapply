import { worldAtlasManifest } from '../data/worldAtlasManifest'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'

let atlasPromise: Promise<WorldAtlasPayload> | null = null

export function loadWorldAtlas(): Promise<WorldAtlasPayload> {
  if (!atlasPromise) {
    atlasPromise = fetch(`${worldAtlasManifest.path}?v=${encodeURIComponent(worldAtlasManifest.version)}`, {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(20000),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`atlas payload request failed: ${response.status} ${response.statusText}`)
        const payload = (await response.json()) as WorldAtlasPayload
        const counts = worldAtlasManifest.counts
        if (payload.version !== worldAtlasManifest.version
          || payload.subjects?.length !== counts.subjects
          || payload.institutions?.length !== counts.institutions
          || payload.programs?.length !== counts.programs
          || !Array.isArray(payload.land) || payload.land.length !== counts.landPaths) {
          throw new Error('世界學科地圖資料不完整，請重新載入')
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
