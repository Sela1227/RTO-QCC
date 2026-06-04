> **⚠ 給同時拿到 SELA-Starter-Kit 的 Claude：**
> 這是**已對齊 Kit V1.11.1 的成熟專案**（從 v6.11.23 對齊升上來），不是新專案。
>
> 衝突仲裁規則：
> 1. **以本專案 CLAUDE.md 為主、Kit 為輔**
> 2. 本專案刻意不對齊 Kit 的部分（都有理由，不要「修正」回去）：
>    - **配色用 `#5B8FB9`（霧藍），非 Kit 預設 `#5A7A8B`** — 已長期使用者驗證，是事實標準
>    - **業務命名、十個癌別、三位醫師預設（熊敬業/劉育昌/林伯儒）、排序順序、追蹤 8 Tab 定義** — 保留 V6 累積結構，已成熟
>    - **版號歷史 v1.x–v6.11.x 不重訂** — 過去就是過去，從 V7.0.0 起嚴格三位制
> 3. **品牌歸屬：仍是 SELA 個人專案**（即使 UI 掛機構名「彰濱秀傳」、授權寫醫院）。logo/favicon 用 SELA 橘壁虎；UI 文字維持機構名。哪天醫院 IT 正式接管才換。
> 4. 版號規則照 Kit：**部署版無後綴、備份版 `-source`**，ZIP 命名空格分隔（`RTO-QCC V7.0.0.zip`）
> 5. **下次完成版本時記得評估 SELA-handoff.md**（鐵律 #0 — 完整見 Kit master CLAUDE.md）

---

# CLAUDE.md — RTO-QCC 彰濱放腫體重監控預防系統

> 給下一個接手的 Claude。讀完這份你應該能直接動手。
> （這份取代了原本的 HANDOVER.md，V7.0.0 對齊 Kit 時整併。）

---

## 〇、當前狀態

- **版本**：V7.0.0（2026-06-04，首次對齊 SELA Kit 里程碑）
- **技術棧**：純 JavaScript（無框架無 build）+ IndexedDB + Chart.js + jsPDF + SheetJS（全 CDN）
- **部署**：GitHub Pages 或直接開 `index.html`；**部署檔 = 原始檔**（無 dist 概念）
- **工作目錄慣例**：`/home/claude/RTO-QCC/`
- **登入密碼**：`QCC`（改 `js/config.js` 的 `PASSWORD`）

頁面架構：
```
醫護端 index.html → 儀表板 / 追蹤清單 / 資料庫 / 統計報表 / 系統成效 / 系統設定（6 分頁）
病人端 patient.html → 單一病人體重自我回報（獨立深色主題、獨立 ?v=3.0 cache 軌道）
```

---

## 一、技術棧決策（為什麼這樣選）

- **純 JS 無 build**：醫院環境部署單純，丟 GitHub Pages 即可，零工具鏈依賴。代價是 library 走 CDN（離線得另解）。
- **IndexedDB 而非後端**：病人資料完全留瀏覽器本機，不經伺服器，符合個資要求。代價是跨機共享要靠 `version-sync.js` 的共享資料夾雙寫。
- **演進史**：Python/Flet 桌面 → 純 JS web（現況）→ 未來可能 Capacitor 轉手機（需 IndexedDB→SQLite）。

---

## 二、踩過的坑（編號累積，永不重排）

純環境/結構類在前，業務邏輯類在後。

1. **favicon 必須用相對路徑**
   - 症狀：GitHub Pages 子路徑（`sela1227.github.io/RTO-QCC/`）下 favicon 404
   - 原因：絕對路徑 `/favicon/...` 會指到網域根，不是專案子路徑
   - 做法：head 一律 `href="favicon/..."`（相對），已於 V7.0.0 套好

2. **theme-color 用 app 主題色，不是 SELA 橘**
   - 症狀：PWA 啟動畫面顏色和介面不一致
   - 原因：品牌色（logo=橘）與介面色（theme-color）是兩回事
   - 做法：`index.html` theme-color = `#5B8FB9`、`site.webmanifest` theme_color 同步；`patient.html` 維持自己的深色 `#1a1a2e`

3. **同步選單 SVG 圖標溢出**
   - 症狀：sync 下拉選單裡 SVG 撐大變形
   - 原因：SVG 無固定尺寸時吃滿容器
   - 做法：強制 `width/height/min/max-width 16px`

4. **設定頁資料結構不符 → undefined / [object Object]**
   - 症狀：系統設定頁顯示 `[object Object]` 或 undefined
   - 原因：假設的物件形狀和實際存的不一致
   - 做法：**警示規則**必須 `{ cancer_type, sdm_threshold, nutrition_threshold }`；**暫停/終止原因**必須 `{ code, label }`。改這兩個結構時 settings.js 顯示端要一起對齊

5. **升版要同步改所有版本字串**
   - 症狀：升版後瀏覽器抓舊 JS（cache 沒清）
   - 原因：cache-busting `?v=` 沒跟著改
   - 做法：`index.html` 改兩類 — header span（第 43 行附近 `header-version`）+ **全部 16 個 `?v=`**（style.css + 15 支 JS）。`patient.html` 是**獨立 `?v=3.0` 軌道**，沒動病人端檔案就不要動它

6. **儀表板動態 UI 用 `.init()` 不是 `.refresh()`**
   - 症狀：系統成效「指定年」下拉是空的
   - 原因：`.refresh()` 不會重建年份下拉這類動態元素
   - 做法：要填充動態 UI（年份下拉等）呼叫 `Dashboard.init()`

7. **載入演示資料用 `DemoData.init()` 不是 `loadDemoData()`**
   - 症狀：`loadDemoData is not defined`
   - 原因：函式掛在 `DemoData` 物件下
   - 做法：`await DemoData.init()`，載入 100 位測試病人

8. **「待輸體重」門檻是 `days > 7`**
   - 症狀：做測試資料時「待輸體重」tab 抓不到人
   - 原因：overdue 判斷是 `days > 7`，不是 >3 或 >5
   - 做法：要出現在「待輸體重」，最後一筆體重必須 **≥8 天前**。（注意：舊 HANDOVER 第九節曾誤寫「>3 天」，以本條 + `utils.js getTrackingStatus` 為準）

9. **patient.html 引用了不存在的 `manifest.json`**（待修）
   - 症狀：病人端 console 出現 manifest 404
   - 原因：`<link rel="manifest" href="manifest.json">` 但根目錄無此檔
   - 做法：尚未修（不影響核心功能）。要做病人端 PWA「加入主畫面」時補一個專屬 manifest（注意病人端主題是深色 `#1a1a2e`，別直接套 `favicon/site.webmanifest` 的霧藍）

---

## 三、業務對映表（單一真相）

### 追蹤狀態（`utils.js` → `getTrackingStatus`）
| 天數（距最後量測） | 狀態 | 中文 |
|---|---|---|
| `days <= 5` | normal | 正常 |
| `days <= 7` | pending | 待量測 |
| `days > 7` | overdue | 待輸體重 |

### 警示閾值
| 概念 | 值 | 觸發 |
|---|---|---|
| `sdm_threshold` | -3% | 達閾值觸發 SDM 介入 |
| `nutrition_threshold` | -5% | 達閾值觸發營養師轉介 |
| 需處理 | 達閾值 + **7 天內無處置** | |
| 需關注 | 達閾值 + **7 天內有處置** | |

### 追蹤清單 8 Tab
| Tab | 條件 |
|---|---|
| 治療中 | `status === 'active'` |
| 暫停中 | `status === 'paused'` |
| 需關注 | `change_rate ≤ -3%` 且 7 天內有處置 |
| 需處理 | `change_rate ≤ -3%` 且 7 天內無處置 |
| 待輸體重 | 最後量測 `days > 7` |
| 待補資料 | 缺 baseline_weight / physician / radiation_dose |
| 待上線 | `treatment_start > 今天` |
| 今日上線 | `treatment_start === 今天` |

### IndexedDB 7 表（`db.js`，`DB_VERSION = 3`）
`patients`（medical_id, name, gender, birth_date←可選） / `treatments`（patient_id, cancer_type, treatment_start/end, status, baseline_weight, sdm_choice, physician, radiation_dose/fractions, pause/terminate_reason） / `weight_records`（treatment_id, measure_date, weight, change_rate） / `side_effects` / `interventions` / `satisfaction` / `settings`

> 改「警示規則」或「暫停/終止原因」的物件形狀 = 同時動 settings.js 顯示端（見坑 #4）。

---

## 四、關鍵路徑（要改 X 動哪個檔）

```
改追蹤狀態判斷         → js/utils.js (getTrackingStatus)
改警示規則/暫停終止原因 → js/settings.js (SettingsPage) + settings 表結構（坑 #4）
改演示資料             → js/demo.js (DemoData.init，100 位 2024-2026)
改成效儀表板/KPI/圖表   → js/dashboard.js（動態 UI 用 Dashboard.init，坑 #6）
改轉介單 PDF           → js/intervention.js (printReferral，A5 橫式)
改統計報表/Excel/PDF    → js/report.js
改共享資料夾同步        → js/version-sync.js（雙寫共享+localStorage）/ js/sync.js
改密碼/癌別清單         → js/config.js
改病人端              → patient.html + js/patient-app.js + css/patient.css（獨立 v3.0 軌道）
升版                  → index.html：header span + 16 個 ?v=（坑 #5）+ README 版本歷程
```

---

## 五、煙霧測試（升版必跑）

```bash
cd RTO-QCC && python3 -m http.server 8000
# 開 http://localhost:8000 → 密碼 QCC → console 不應有紅字
```
進系統後在開發者 console：
```javascript
await DemoData.init()        // 應載入 100 位病人，無 error
```
手動點檢：
- 「系統成效」→「指定年」下拉應有 2024 / 2025 / 2026（坑 #6）
- 追蹤清單「待輸體重」tab 應有人（demo 裡最後量測 ≥8 天前，坑 #8）
- 瀏覽器分頁 icon 應是 SELA 橘壁虎（favicon 生效）

---

## 六、版本歷程（近期；完整看 README）

- **V7.0.0**（2026-06-04）對齊 SELA Kit V1.11.1：補 logo/favicon、.gitignore、CLAUDE.md、SELA-handoff.md；版號改嚴格三位制；整併 v6.11.17–23 變更
- v6.11.23 生日改可選欄位
- v6.11.22 待輸體重門檻改 >7 天、預載 100 位病人（2024–2026）
- v6.11.21 修 loadDemoData 未定義
- v6.11.20 排序重排、加三位醫師、HANDOVER 更新
- v6.11.19 修設定頁資料結構、清除資料需輸入四碼
- v6.11.18 系統設定移至側邊欄、修系統成效指定年、同步圖標

---

## 七、下版候選工作（按優先序）

1. **實測共享資料夾同步**（`version-sync.js`）在真實醫院環境 — 多人協作上線前必驗：衝突檢測與雙寫機制還沒在醫院實際共享資料夾跑過，這是病人安全相關的資料正確性風險
2. 補 `patient.html` 缺失的 `manifest.json`（病人端 PWA「加入主畫面」才正常，坑 #9）
3. Capacitor 手機版轉換（IndexedDB→SQLite、CDN library 本地打包、離線字型、原生分享、App Store/Play 帳號）
4. 體重預測演算法優化（目前線性迴歸 14 天）
5. 多院區支援

---

## 八、一句話總結

V7.0.0 是把這個跑了一年多的專案首次對齊 SELA Kit 的里程碑：補齊 logo/favicon/.gitignore/CLAUDE.md/handoff、版號從亂掉的 v6.11.x 重新校準成嚴格三位制，但**完全沒動已驗證的配色、業務命名與既有設計**。下版重點轉回功能驗證 —— 共享資料夾同步的醫院實機測試是第一優先。
