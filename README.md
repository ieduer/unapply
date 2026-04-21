# 你一定不考 · UnApply

一個對標 [path.bdfz.net](https://path.bdfz.net)（減法人生）的**學校版減法工具**：不做推薦，只陪你從中國 3306 所高校中劃掉一定不考的那批。

- 線上：<https://nope.bdfz.net>
- 技術棧：Vite 8 · React 19 · TypeScript · Tailwind 4 · Motion
- 部署：Cloudflare Pages（`wrangler.jsonc` → project `unapply`）
- 用戶中心：[my.bdfz.net](https://my.bdfz.net) `siteKey='unapply'`
- 許可：代碼 MIT · 派生自 CollegesChat 的生活質量數據 CC BY-NC-SA 4.0

## 開發

```bash
npm install
npm run dev    # Vite 本機啟動
npm run build  # tsc + vite build → dist/
npm run lint
```

## 部署

```bash
npm run pages:deploy  # 會先 build，再 push 到 CF Pages 的 unapply 項目
```

Cloudflare 首次部署需要在 dashboard 新建 `unapply` Pages 項目並綁定 `nope.bdfz.net`。

## 項目結構

```
src/
  App.tsx                   # 根路由（hash router）
  main.tsx
  data/
    dimensions.ts           # 34 個維度 + 官方權威來源鏈接
    questions.ts            # 29 題減法問卷
    schools.ts              # 125 所種子學校
  engine/
    filter.ts               # 純函數篩選引擎（疑罪從無）
  lib/
    bdfzIdentity.ts         # my.bdfz.net 集成
    share.ts                # html-to-image 分享圖
  components/
    Landing.tsx
    QuestionRunner.tsx
    ResultPage.tsx
    SchoolDetail.tsx
    ShareCard.tsx
    ContributePage.tsx
    AboutPage.tsx
docs/
  PROJECT_REPORT.md         # 目的、架構、數據缺口、合規
db/
  schema.sql                # v2 引入 Worker + D1 時使用
scripts/
  fetch_sources.md          # 數據採集流程 SOP
```

## 核心原則

1. **疑罪從無**：學校某維度數據缺失時，不用該題排除它。
2. **中性展示**：不給任何學校「絕對不推薦」標籤。
3. **判斷權在用戶**：所有「勸退」都由用戶的個人偏好觸發。
4. **非商業**：本站非商業用途，CollegesChat 派生數據繼承 CC BY-NC-SA 4.0。
5. **不提供志願填報建議**：本站不是教育機構，不對錄取結果負責。

## 姊妹站

- [path.bdfz.net](https://path.bdfz.net) — 職業減法
- [750.bdfz.net](https://750.bdfz.net) — 北京高考
- [my.bdfz.net](https://my.bdfz.net) — 用戶中心

## 申訴下架

學校官方認為某維度存在爭議，可發郵件至 <nope@bdfz.net>，48 小時內人工處理。
