# 彰濱放腫體重監控預防系統 - Web 版

放射線治療病人體重監控與營養介入管理系統的 Web 版本。

## 特點

- 純網頁應用 - 無需安裝，瀏覽器直接使用
- 本地儲存 - 資料存在瀏覽器，保護病人隱私
- 跨平台 - Windows / macOS / 手機都能用
- 北歐風設計 - 簡約美觀、大量留白

## 快速開始

### 方法一：直接開啟

雙擊 `index.html` 即可使用。

### 方法二：本地伺服器（推薦）

```bash
# Python 3
cd weight-tracker-web
python -m http.server 8000

# 然後開啟 http://localhost:8000
```

### 方法三：部署到 GitHub Pages

1. 建立 GitHub Repository
2. 上傳所有檔案
3. 到 Settings → Pages → Source 選擇 `main` branch
4. 等待幾分鐘後即可使用

## 功能

### 醫護端（index.html）
- 病人管理（新增、編輯、搜尋）
- 療程管理（新增、暫停、恢復、結案）
- 體重記錄（記錄、編輯、刪除、趨勢預測）
- 副作用評估（CTCAE v5.0 標準）
- 自動警示（SDM -3%、營養師 -5%）
- 介入管理（執行、跳過、反應時間追蹤）
- 滿意度調查（5 題問卷、NPS 計算）
- 成效儀表板（8 項 KPI、4 張圖表）
- 統計報表（圖表、Excel/PDF 匯出）
- 資料備份（匯出 / 匯入 / 多機同步）
- QR Code 功能（產生給病人 / 匯入病人資料）

### 病人端（patient.html）
- 掃描 QR Code 初始化
- 記錄每日體重
- 副作用自我評估
- 體重趨勢圖
- 變化警示（-3% / -5%）
- 滿意度回饋
- 提醒設定
- 回傳 QR Code 給醫護
- 加到主畫面（PWA）

## 資料儲存

資料存在瀏覽器的 IndexedDB 中（共 7 個資料表）：
- patients - 病人資料
- treatments - 療程資料
- weight_records - 體重記錄
- side_effects - 副作用評估
- interventions - 介入記錄
- satisfaction - 滿意度調查
- settings - 系統設定

注意事項：
- 關閉瀏覽器不會遺失
- 清除瀏覽器資料會遺失
- 建議定期使用「設定 → 匯出備份」

## 多機同步

1. 在 A 電腦：設定 → 匯出備份
2. 複製 JSON 檔案到 B 電腦
3. 在 B 電腦：首頁 → 同步 → 選擇檔案
4. 系統會自動比對並合併資料

## 瀏覽器支援

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## 檔案結構

```
weight-tracker-web/
├── index.html          # 醫護端主頁面
├── patient.html        # 病人端填報頁面
├── logo.png            # SELA Logo
├── css/
│   ├── style.css       # 醫護端樣式
│   └── patient.css     # 病人端樣式
└── js/
    ├── app.js          # 主程式
    ├── db.js           # 資料庫模組
    ├── config.js       # 設定檔
    ├── utils.js        # 工具函數
    ├── patient.js      # 病人模組
    ├── treatment.js    # 療程模組
    ├── weight.js       # 體重模組
    ├── sideeffect.js   # 副作用模組
    ├── intervention.js # 介入模組
    ├── satisfaction.js # 滿意度模組
    ├── dashboard.js    # 成效儀表板
    ├── report.js       # 報表模組
    ├── settings.js     # 設定模組
    ├── sync.js         # 同步模組
    └── patient-app.js  # 病人端應用
```

## 版本歷史

### v6.2.0 (2026-03-30)
- 新增滿意度調查功能（醫護端 + 病人端）
- 新增成效儀表板（8 項 KPI、5 張圖表）
- 新增 PDF 成效報告匯出（含圖表）
- 資料庫升級至 v3（新增 satisfaction 表）
- 備份/同步支援滿意度資料

### v6.1.0 (2026-03-30)
- 新增體重趨勢預測（線性迴歸，預測 14 天）
- 新增介入反應時間追蹤（contacted 狀態）
- 新增 SDM 比較表（鼻胃管 vs 胃造廔術）
- CTCAE v5.0 文字說明整合

### v6.0.1 (2026-03-29)
- 軟刪除機制（deleted 標記，支援同步）
- 副作用評估系統（8 項症狀、CTCAE 分級）
- 疼痛評估改用 0-10 量表
- QR Code 改用本地生成（qrcode.js）
- 設定頁面重新設計（分組標籤）
- 病人資料獨立匯出/匯入

### v5.x (2026-03)
- 病人端分頁架構（體重、副作用、飲食、衛教）
- QR Code 雙向資料傳輸
- 多機同步功能
- 備份機制完整化

### v4.x (2026-03)
- 病人端填報系統（patient.html）
- 響應式設計（手機版）
- 北歐風格 UI

### v3.x (2024-2026)
- 營養轉介單 PDF
- 統計報表圖表化
- Excel 匯出功能

## 授權

MIT License - 彰濱秀傳紀念醫院
