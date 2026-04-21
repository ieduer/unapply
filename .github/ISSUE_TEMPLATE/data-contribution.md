---
name: Data contribution
about: Submit school data for review and import into unapply
title: "數據貢獻：<學校> · <維度> = <取值>"
labels:
  - data-contribution
  - needs-triage
---

## 基本信息

- 學校：
- 校區（如適用）：
- 維度 / 數據項：
- 取值：
- 適用範圍（專業 / 年級 / 批次 / 樣本量）：

## 來源與證據

- 來源類型：官方 / 學校官網 / 在讀學生或校友 / 新聞 / 地圖 / GitHub 或開放數據 / 其他
- 來源標題：
- 來源鏈接：
- 來源日期：
- 證據或補充說明：

## 自查

- [ ] 我已盡量提供可公開核驗的鏈接或明確證據
- [ ] 我已寫清楚適用範圍，避免把局部情況誤當全校結論
- [ ] 若內容涉及負面或敏感結論，我已附公開可核驗依據

## 機器讀取 JSON

```json
{
  "schema": "unapply.dataContribution.v1",
  "school": {
    "id": "",
    "name": ""
  },
  "dimension": {
    "type": "known",
    "id": "",
    "label": ""
  },
  "value": "",
  "source": {
    "type": "",
    "title": "",
    "url": "",
    "date": "",
    "confidence": "medium"
  },
  "scope": {
    "campus": "",
    "major": "",
    "grade": "",
    "sampleSize": ""
  },
  "evidence": "",
  "contributor": "anonymous"
}
```

---

入庫原則：可核驗來源優先；眾包項至少交叉覆核；敏感或負面項必須有公開證據。
