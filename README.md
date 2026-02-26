# SELA 體重追蹤系統 - Web 版

放射線治療病人體重監控與營養介入管理系統的 Web 版本。

## 特點

- 🌐 **純網頁應用** - 無需安裝，瀏覽器直接使用
- 💾 **本地儲存** - 資料存在瀏覽器，保護病人隱私
- 📱 **跨平台** - Windows / macOS / 手機都能用
- 🎨 **北歐風設計** - 簡約美觀、大量留白

## 快速開始

### 方法一：直接開啟

雙擊 `index.html` 即可使用。

### 方法二：本地伺服器（推薦）

```bash
# Python 3
cd sela-weight-tracker-web
python -m http.server 8000

# 然後開啟 http://localhost:8000
```

### 方法三：部署到 GitHub Pages

1. 建立 GitHub Repository
2. 上傳所有檔案
3. 到 Settings → Pages → Source 選擇 `main` branch
4. 等待幾分鐘後即可使用

## 功能

- ✅ 病人管理（新增、編輯、搜尋）
- ✅ 療程管理（新增、暫停、恢復、結案）
- ✅ 體重記錄（記錄、編輯、刪除）
- ✅ 自動警示（SDM、營養師轉介）
- ✅ 介入管理（執行、跳過、手動）
- ✅ 統計報表（圖表、Excel 匯出）
- ✅ 資料備份（匯出 / 匯入 JSON）

## 資料儲存

資料存在瀏覽器的 IndexedDB 中：
- 關閉瀏覽器不會遺失
- 清除瀏覽器資料會遺失
- 建議定期使用「設定 → 匯出備份」

## 多機同步

1. 在 A 電腦：設定 → 匯出備份
2. 複製 JSON 檔案到 B 電腦
3. 在 B 電腦：設定 → 匯入還原

## 瀏覽器支援

- Chrome 80+
- Firefox 75+
- Safari 14+
- Edge 80+

## 檔案結構

```
sela-weight-tracker-web/
├── index.html      # 主頁面
├── css/
│   └── style.css   # 樣式
└── js/
    ├── app.js      # 主程式
    ├── db.js       # 資料庫
    ├── patient.js  # 病人模組
    ├── treatment.js # 療程模組
    ├── weight.js   # 體重模組
    ├── intervention.js # 介入模組
    ├── report.js   # 報表模組
    ├── settings.js # 設定模組
    └── utils.js    # 工具函數
```

## 版本

v2.2 Web - 2024
- 介入執行可選擇日期（預設當天）
- 手動介入可選擇日期和執行人員
- 介入記錄顯示執行日期

v2.1 Web
- 體重趨勢圖從基準值開始
- 加入 -3% (SDM) 和 -5% (營養) 警示線

## 授權

MIT License - By SELA
