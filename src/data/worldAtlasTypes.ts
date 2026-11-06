// 世界學科地圖 payload 的型別（public/data/atlas/world-atlas.json，由 scripts/build_world_atlas.mjs 生成）。

export interface AtlasFamily {
  code: string
  nameEn: string
  nameZh: string
}

export interface AtlasSubject {
  code: string
  family: string
  nameEn: string
  nameZh: string
  nameZhHans: string
  sourceUrl: string
}

export interface AtlasRegion {
  code: string
  nameZh: string
  continent: string
  continentZh: string
}

export interface AtlasInstitution {
  id: string
  nameEn: string
  nameZh: string | null
  region: string
  lat: number
  lng: number
  x: number
  y: number
  /** 大陸機構對應本站學校詳情頁的 id（教育部正體校名），其他為 null。 */
  schoolId: string | null
  moeCode: string | null
  univUp: string | null
  /** 學科代碼 → 該年名次（只收前 50）。 */
  ranks: Record<string, number>
}

export interface AtlasProgram {
  id: string
  orgEn: string
  orgZh: string
  programEn: string
  programZh: string
  kind: string
  kindZh: string
  country: string
  regionZh: string
  city: string
  cityZh: string
  lat: number
  lng: number
  x: number
  y: number
  eligibilityZh: string
  offersZh: string
  paid: string
  degree: string
  sinceYear: number | null
  status: string
  officialUrl: string
  sourceTitle: string
  sourceUrl: string
  sourceDate: string
  verifiedAt: string
  confidence: 'high' | 'medium' | 'low'
  notesZh: string
}

export interface WorldAtlasPayload {
  version: string
  generatedAt: string
  ranking: { name: string; nameZh: string; year: number; topNMax: number; url: string; fetchedAt: string }
  sources: { geo: { name: string; file: string }; land: { name: string; file: string }; programs: { file: string } }
  projection: { name: string; width: number; height: number }
  land: string[]
  families: AtlasFamily[]
  subjects: AtlasSubject[]
  regions: AtlasRegion[]
  institutions: AtlasInstitution[]
  programs: AtlasProgram[]
}
