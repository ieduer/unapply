# 你一定不考 · 項目報告（v1.0）

| 字段 | 值 |
| --- | --- |
| 項目名 | 你一定不考 · 不考大學指南 |
| 英文別名 | UnApply |
| 線上地址 | <https://nope.bdfz.net> |
| 本地路徑 | `/Users/ylsuen/CF/unapply/` |
| 技術棧 | Vite 8 · React 19 · TypeScript · Tailwind 4 · Motion · html-to-image |
| 部署 | Cloudflare Pages（`unapply`），GitHub → Pages 自動構建 |
| 用戶中心集成 | `siteKey='unapply'`；`window.BdfzIdentity.recordEvent/recordDownload` |
| 首次發布 | 2026-04-21 |
| 合規 | 代碼 MIT；CollegesChat 派生數據 CC BY-NC-SA 4.0 |

---

## 1. 目的與定位

絕大多數志願填報工具的思路是 **加法**：「你要考 XX 大學」「XX 大學適合你」。這類工具容易：

- 過度倚賴排名與歷年分數
- 無法反映校園日常體驗
- 讓學生越看越焦慮

本站走 **減法** 路線，對標 [path.bdfz.net](https://path.bdfz.net)（職業減法）：

> 不告訴你該考哪所。只陪你從已知 3000+ 所中，用你自己的不能忍，劃掉一批。

產品體驗：29 題（A 紅線 5 · B 生活質量 24 · C 特殊 5）→ 每題實時顯示「已劃掉 X / 剩 Y」→ 結果頁展示剩下學校分佈、每校「你為什麼沒劃掉它」一句話、下載分享圖。

---

## 2. 架構

```
┌───────────────────────────────────────────────────────────┐
│                  nope.bdfz.net (Pages)                    │
│  ┌──────────────────────────────────────────────────────┐ │
│  │  React 19 SPA                                        │ │
│  │  ├─ src/data/schools.ts  (125 所種子)                │ │
│  │  ├─ src/data/questions.ts (29 題)                   │ │
│  │  ├─ src/data/dimensions.ts (34 維度 + 權威源鏈接)   │ │
│  │  ├─ src/engine/filter.ts (純函數，疑罪從無)         │ │
│  │  └─ src/components/* (Landing / Runner / Result)    │ │
│  └──────────────────────────────────────────────────────┘ │
│                            │                              │
│                            ▼                              │
│  <script src="https://my.bdfz.net/site-auth.js"/>         │
└───────────────────────────────┬───────────────────────────┘
                                │
                                ▼ recordEvent / recordDownload
┌───────────────────────────────────────────────────────────┐
│   my.bdfz.net (Cloudflare Worker + D1)                    │
│   user_data_records (site_key='unapply')                  │
│                                                           │
│   ├─ 記錄 filter 結果樣本                                 │
│   ├─ 記錄 share 圖下載                                    │
│   └─ 記錄 contribute 貢獻（進人工審核）                   │
└───────────────────────────────────────────────────────────┘
```

### 為什麼 v1.0 不開獨立 D1

- 學校靜態數據一共 ~125 條，打包進 JS 只有 ~15KB gzip，無需查 DB
- 所有用戶狀態走 my.bdfz.net 的 `user_data_records`，避免重複造輪子
- 眾包貢獻先走 `recordEvent`，進審核隊列，v1.1 再做獨立 contributions 表

### v1.1 計劃遷移到 Worker + D1 的時機

- 學校池擴到 1000+ 時前端包超過 100KB
- 眾包數據量達到需要去重/三人一致驗證的程度
- 出現跨用戶分享鏈接需求（session 短連接）

`db/schema.sql` 已預寫好 v2 schema，可直接用。

---

## 3. 維度設計（34 維）

### A 紅線（5 維，一票否決）

| ID | 標籤 | 取值 | 權威來源 |
|---|---|---|---|
| A1 | 省份 | 34 省市自治區 | 教育部全國普通高校名單 |
| A2 | 城市等級 | tier1 / newtier1 / tier2 / tier3_below | 第一財經 2023 |
| A3 | 辦學層次 | C9 / 985非C9 / 211非985 / 雙一流非211 / 普通本科 / 專科 | 教育部公開名單 |
| A4 | 學費 | 公辦 / 1-3萬 / 3-8萬 / 8萬+ | 教育部陽光高考 |
| A5 | 主校區 | main_city / suburb_with_metro / suburb / separate_freshman | 各校官網 |

### B 生活質量（24 維）

全部 24 維對齊 [CollegesChat/university-information](https://github.com/CollegesChat/university-information) 的標準問卷：上床下桌 / 空調 / 獨衛 / 早晚自習 / 晨跑 / 公里打卡 / 假期 / 外賣 / 地鐵 / 洗衣機 / 校園網 / 斷電斷網 / 食堂 / 熱水 / 電瓶車 / 限電 / 通宵自習 / 大一電腦 / 校園卡 / 強發銀行卡 / 超市 / 快遞 / 共享單車 / 門禁查寢。

### C 特殊（5 維）

| ID | 標籤 | 取值 | 權威來源 |
|---|---|---|---|
| C1 | 飲食／宗教 | 有清真食堂 / 有素食窗口 / 普通食堂 | 中國伊斯蘭教協會 + 各校公開 |
| C2 | 無障礙 | 無障礙完善 / 視障輔助 / 一般 | 中國殘聯評估 |
| C3 | LGBTQ+ 氛圍 | 無公開事件 / 學生組織被整頓 / 近年壓制事件 | 公開新聞（人工整理） |
| C4 | 外省生源 | 外地≥50% / 本地50-70% / 本省生源＞70% | 各校招生章程分省計劃 |
| C5 | 學科評估 | A+ / A / A- × 8 個學科門類 | 教育部第四輪學科評估（2017） |

---

## 4. 核心算法：FilterEngine

純函數，無副作用，單元可測。

```typescript
filterSchools(allSchools: School[], answers: AnswerMap): FilterResult
```

關鍵邏輯（`src/engine/filter.ts`）：

1. **疑罪從無**：`if (schoolValue === null) continue;`
   當學校的某維度值未知時，不觸發該題的排除規則。這是避免「剛啟動時學校池太小就被全劃光」的關鍵。

2. **選項合併**：多選題下，多個選項的 `excludes` 取並集、`requires` 按 `dim` 取並集。

3. **可追溯**：每一次排除都帶 `ExcludeReason { questionId, questionTitle, userAnswerLabel, schoolValue }`，結果頁可解釋為什麼這所學校被劃掉。

---

## 5. 數據缺口清單（需要後續補完）

### 5.1 學校名錄擴容（優先級 P0）

- 當前 MVP 種子：**125 所**（C9 9 + 985 非C9 30 + 211 非985 60 + 雙一流 25 + 普通本科 3）
- 全量目標：**3306 所**（本科 1275 + 專科 1545 + 獨立學院 241 + 其他）
- 補完路徑：
  1. `scripts/` 下新增 `fetch_all_schools.ts`
  2. 從 [jorhelp/EDU_Website](https://github.com/jorhelp/EDU_Website) 拉取 3300+ 名錄（網址 + 省份 + 層次）
  3. 從 [xioajiumi/Chinese_Universities](https://github.com/xioajiumi/Chinese_Universities) 補齊軟科排名 + logo（582 所）
  4. 與教育部 2023 名單 diff，確保無遺漏
- 工時：2 人日

### 5.2 A2 城市等級（P0）

- 已硬編碼 125 所的 cityTier
- 擴容後需要 3306 所的城市 → tier 映射表
- 權威源：第一財經新一線城市研究所 2023 年度報告
- 工時：0.5 人日

### 5.3 A4 學費（P1）

- 當前默認所有學校為「公辦」
- 實際需要區分民辦 / 中外合作辦學
- 權威源：教育部陽光高考分省分專業招生計劃（每年 6 月更新）
- 工時：1 人日（半自動解析）

### 5.4 A5 校區定位（P1）

- 需要人工整理：主校區是否在主城 / 是否有地鐵 / 大一是否單獨分校
- 數據源組合：各校官網 + 高德地圖距離計算 + 維基百科
- 工時：3 人日

### 5.5 B 生活質量 24 維（P1，眾包）

- CollegesChat 已覆蓋約 300-500 所（yml 問卷，需解析映射到結構化字段）
- 短期：寫 `scripts/parse_collegeschat_yml.ts`，把 yml 映射到 `school.quality[B*]` 字段
- 中期：本站用戶貢獻入口（已實現）收集補充
- 長期：三人一致才正式採納，避免孤例抬屋
- 工時：解析 1 人日；採集持續運營

### 5.6 C5 學科評估（P2）

- 第四輪評估（2017）→ 需要從 [學位中心](https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/) 解析 PDF
- 第五輪評估（2022）官方未公開完整結果，只公開部分
- 當前：只硬編碼 2 條（北大 CS:A+、清華 CS:A+、浙大 CS:A）
- 工時：2 人日（PDF 解析 + 人工校對）

### 5.7 C3 LGBTQ+ 氛圍（P3）

- 無權威數據源
- 僅依據公開新聞（例：2021 清華女裙事件、2021 多校 LGBTQ 社團被關閉）
- 需要人工整理 + 審核，避免被舉報「造謠」
- 當前：全部學校此維度留空
- 工時：2 人日（需要法律合規顧問把關）

### 5.8 C4 外省生源比（P3）

- 各校分省招生計劃人工整理
- 每年變動，工作量大
- 可替代方案：先用 `province` 簡單標「本省類」「非本省類」，粗略實現
- 工時：10 人日（如做精確）

---

## 6. 與 my.bdfz.net 集成

登錄用戶的三類事件會落入 `user_data_records` 表：

| 事件 | record_kind | 觸發點 | payload |
|---|---|---|---|
| 完成一輪減法 | `event` | 點擊「看結果」 | `{ answers, stats }` |
| 下載分享圖 | `download` | 點擊「下載分享圖」 | `{ excluded, kept }` |
| 貢獻一條數據 | `event` | 提交貢獻表單 | `{ schoolId, dim, value, comment }` |

所有記錄帶 `siteKey='unapply'`、`sessionKey=unapply-filter-<ts>`。未登錄用戶走 localStorage 隊列，下次登錄時 flush。

---

## 7. 合規與運營

### 7.1 許可與 Attribution

- 本站代碼 MIT（放在根 `LICENSE`）
- 派生自 CollegesChat 的生活質量數據繼承 CC BY-NC-SA 4.0
- About 頁、頁腳、分享圖都要展示來源
- 不得用於商業用途

### 7.2 非政治化話術

- A1 地理排除題：文案強調「個人偏好」而非「地域歧視」
- 中性標籤：所有維度展示為「事實 + 時間戳 + 來源」，例「晨跑：每週 3 次 · 2023-05 · CollegesChat」
- 不給任何學校「絕對不推薦」標籤
- About 頁明確：本站不提供志願填報建議、不對錄取結果負責

### 7.3 申訴下架

- 郵箱：<nope@bdfz.net>
- 48 小時內人工處理
- 公開維度（如上床下桌）不接受下架
- 敏感維度（如食品安全新聞）需提供澄清證據
- 絕不接受整校下架

### 7.4 SEO 策略

- `robots.txt` 只允許首頁 + `/#/about` 被索引
- 單校頁 `/#/school/*` 不在 sitemap
- 避免「<學校名> 勸退」SEO 引流帶來的公關風險

---

## 8. 技術債與未來工作

### v1.1（2026-Q2）
- 學校池擴到 1000+（從 edu.cn 導入）
- CollegesChat yml 自動解析 → 300+ 所的 24 維數據
- 結果頁加地理熱力圖（按省份）
- 「再減一輪」頁面：建議回退哪幾題

### v1.2（2026-Q3）
- 獨立 Worker + D1（contributions + filter_sessions 短鏈）
- R2 存分享圖（服務端渲染）
- 中英繁簡切換（`opencc-js` 實時轉）

### v2.0
- 專業減法（學校減法的下一層漏斗）
- 和 path.bdfz.net 聯動：職業 → 專業 → 學校三層漏斗
- 移動端小程序

---

## 9. 風險與緩解

| 風險 | 概率 | 影響 | 緩解措施 |
|---|---|---|---|
| 學校公關要求下架維度 | 中 | 中 | 清晰的申訴流程 + 48h 響應 |
| 「地域歧視」輿論 | 中 | 高 | A1 題文案強調個人偏好，提供氣候維度替代 |
| CollegesChat 數據過時 | 高 | 中 | 每條 quality 顯示 `updated_at`，超 2 年加「可能已過時」 |
| 用戶貢獻水軍 | 中 | 中 | Turnstile + 頻率限制 + 人工審核 + 三人一致才採納 |
| 政策變動（院校合併、層次變更） | 低 | 低 | 數據源按年更新；CI 每年 9 月校對一次 |

---

## 10. 相關項目

| 項目 | 作用 | 本地路徑 | 狀態 |
|---|---|---|---|
| path.bdfz.net (minus-life) | 職業減法 | `/Users/ylsuen/CF/minus-life/` | 已上線 |
| 750.bdfz.net | 北京高考語料 | `/Users/ylsuen/CF/750/` | 已上線 |
| my.bdfz.net (bdfz-user-center) | 用戶中心 + 記錄後端 | `/Users/ylsuen/CF/bdfz-user-center/` | 已上線 |
| **nope.bdfz.net (unapply)** | **學校減法** | `/Users/ylsuen/CF/unapply/` | **v1.0** |

---

_本報告是活文檔，v1.x 期間隨項目迭代持續更新。_
