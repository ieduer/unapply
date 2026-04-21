# 數據採集 SOP

本文檔描述 v1.1 把學校池從 125 擴到 3000+ 時的採集流程。

## 第一步：clone 參考源到 `scripts/raw/`

```bash
cd scripts
mkdir -p raw && cd raw
git clone https://github.com/CollegesChat/university-information
git clone https://github.com/xioajiumi/Chinese_Universities
git clone https://github.com/jorhelp/EDU_Website
curl -L -o aurorai.json "https://gist.githubusercontent.com/Aurorai/dfe84b9ed58913e2b9cd/raw/school-data.json"
```

## 第二步：建主表 `schools.json`

優先級：`xioajiumi`（軟科 582 所，含 logo + 官網）＞ `Aurorai`（按省分組）＞ `jorhelp`（3300+ 網址）。

名稱歸一規則：
- 去除括號註釋 → 「北京航空航天大學」而非「北京航空航天大學（北航）」
- 統一繁體（本站繁體為主）
- 別名映射：THU → 清華大學、THU → 清華 → 清華大學
- id = sha1(normalized_name)[:12]

合併輸出 `src/data/schools_full.ts`，取代當前的 seed `schools.ts`。

## 第三步：CollegesChat yml → quality.json

CollegesChat 的每所學校有一個 yml，形如：

```yaml
name: 北京大學
answers:
  上床下桌: 是
  宿舍有空調: 是
  獨立衛浴: 否
  ...
```

寫 `parse_collegeschat.ts`：
1. 遍歷 `raw/university-information/data/*.yml`
2. 映射到結構化字段 B1..B24
3. 輸出 `src/data/quality.json`，每條包含 `{ schoolId, dim, value, source, updated_at }`
4. 至少 300 所應該有完整 24 維

## 第四步：城市 tier 補全

從第一財經 2023 年度城市等級表寫死 tier 映射：
- tier1: 北京、上海、廣州、深圳
- newtier1: 成都、重慶、杭州、武漢、蘇州、西安、南京、長沙、天津、鄭州、東莞、無錫、寧波、青島、合肥、佛山
- tier2: 其他省會 + 計劃單列
- tier3_below: 其他地級

寫入 `src/data/cityTiers.ts`。

## 第五步：學科評估數據

1. 下載學位中心 PDF：<https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/>
2. 用 `pdfplumber` 解析第四輪評估（2017）的表格
3. 只取 A+、A、A- 三檔（B 檔以下不顯示）
4. 輸出 `src/data/disciplines.json`

## 第六步：校區定位

手工整理，沒有權威結構化數據源。
按 985 + 211 + 雙一流約 170 所優先處理，普通本科在 v2 再完善。

## 第七步：合規校對

- 每次新增數據必須帶 `source` + `updated_at`
- 敏感維度（C3 LGBTQ+、B13 食堂負面）需人工審核後才入庫
- 派生自 CollegesChat 的數據標註 CC BY-NC-SA 4.0

## 運行

```bash
cd /Users/ylsuen/CF/unapply/scripts
node --experimental-strip-types build_all.ts --dry-run  # 預覽
node --experimental-strip-types build_all.ts            # 真跑
```

（v1.1 會補 `build_all.ts` 主腳本）
