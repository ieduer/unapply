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
  /** 已核查的學校官網：兩個權威來源同網域為 high，單一來源且像學術網域為 medium；未核查通過者為 null。 */
  website: { url: string; sources: string; confidence: 'high' | 'medium'; verifiedAt: string } | null
}

export interface AtlasProgram {
  id: string
  orgEn: string
  orgZh: string
  programEn: string
  programZh: string
  /** 條目類型代碼（詞表見 scripts/build_world_atlas.mjs KIND_ZH；介面以 ui.world.program.kind.<kind> 顯示）。 */
  kind: string
  kindZh: string
  country: string
  /** 國家／地區的 i18n 鍵尾（ui.world.program.country.<regionKey>），由 country 派生。 */
  regionKey: string
  regionZh: string
  city: string
  cityZh: string
  lat: number
  lng: number
  x: number
  y: number
  eligibilityZh: string
  offersZh: string
  /** yes／no／stipend／unknown。 */
  paid: string
  /** yes／no／partial（同一入口含學位與非學位計劃）／unknown；yes 與 partial 在介面標「含在職學位」。 */
  degree: string
  sinceYear: number | null
  /** 招募狀態原文；status=unverified 的候選在建置期已過濾，不會出現在 payload。 */
  status: string
  officialUrl: string
  sourceTitle: string
  sourceUrl: string
  sourceDate: string
  verifiedAt: string
  /** 渲染的條目只有 high／medium；low 只存在於資料檔的 unverified 列。 */
  confidence: 'high' | 'medium'
  notesZh: string
}

export interface WorldAtlasPayload {
  version: string
  generatedAt: string
  ranking: { name: string; nameZh: string; year: number; topNMax: number; url: string; fetchedAt: string }
  sources: { geo: { name: string; file: string }; land: { name: string; file: string }; programs: { file: string; rows: number; rendered: number; unverified: number }; websites: { name: string; file: string } }
  projection: { name: string; width: number; height: number }
  land: string[]
  families: AtlasFamily[]
  subjects: AtlasSubject[]
  regions: AtlasRegion[]
  institutions: AtlasInstitution[]
  programs: AtlasProgram[]
}
