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

- **版本**：V7.2.0（2026-07-15，舊病人回診流程）
- **技術棧**：純 JavaScript（無框架無 build）+ IndexedDB + **Service Worker（PWA）** + Chart.js + jsPDF + SheetJS（全 CDN）
- **部署**：GitHub Pages 或直接開 `index.html`；**部署檔 = 原始檔**（無 dist 概念）
- **PWA**：醫護端、病人端各自可安裝（`favicon/site.webmanifest` / 根目錄 `manifest.json`，不同主題）；離線靠 `sw.js`
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
   - 原因：cache-busting `?v=` 沒跟著改；PWA 後又多一個 `sw.js` 的 `CACHE_VERSION`
   - 做法：升版一次改**四類** —
     1. `index.html` header span（`header-version`，第 43 行附近）
     2. `index.html` 全部 18 個 `?v=`（style.css + 17 支 JS）
     3. **`sw.js` 的 `CACHE_VERSION`**（PWA 後新增，沒改的話舊快取不會清，Kit 坑 #14）
     4. `README.md` 版本歷程
   - `patient.html` 是**獨立 `?v=3.0` 軌道**，沒動病人端檔案就不要動它

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

9. **patient.html 引用了不存在的 `manifest.json`**（V7.1.0 已修）
   - 症狀：病人端 console 出現 manifest 404
   - 原因：`<link rel="manifest" href="manifest.json">` 但根目錄無此檔
   - 做法：✓ V7.1.0 PWA 升級時建了根目錄 `manifest.json`（病人端專屬、深色 `#1a1a2e`）。已解決

10. **PWA 兩個介面要兩份 manifest（主題不同）**
    - 症狀：醫護端霧藍、病人端深色，共用一份 manifest 啟動畫面會錯一個
    - 原因：醫護 `#5B8FB9` vs 病人 `#1a1a2e`，是兩個可安裝 app
    - 做法：醫護用 `favicon/site.webmanifest`（`id: rto-qcc-medical`、start_url `../index.html`、scope `../`，因檔在 favicon/ 子目錄要 `../`）；病人用根目錄 `manifest.json`（`id: rto-qcc-patient`、start_url `patient.html`、scope `./`）。各 HTML 各自 `<link rel="manifest">`

11. **Service Worker 鐵律（Kit 坑 #13）**
    - 症狀：SW 攔截 POST / 外部 API 導致功能崩潰
    - 原因：fetch handler 沒排除非 GET、沒放行外部域名
    - 做法：`sw.js` fetch handler 第一行 `if (req.method !== 'GET') return;`；外部 API（天氣 open-meteo/7timer、時間 timeapi、QR 產生器 qrserver）一律放行走網路，**只有同源資源 + 白名單 CDN 函式庫才進快取**

12. **CDN 函式庫用 best-effort 預快取，不要 addAll**
    - 症狀：醫院網路封鎖某 CDN → `cache.addAll` 整個 reject → SW 裝不起來 → 整個 PWA 失效
    - 原因：`addAll` 任一失敗就全失敗
    - 做法：本地 App Shell 用 `addAll`（要保證完整）；7 個 CDN 函式庫用 `Promise.allSettled(map(cache.add))`（best-effort，封鎖時降級成線上才載入，但 PWA 仍裝得起來）

13. **「衍生欄位為空」不等於「該筆資料該被隱藏」**（V7.1.1 修，真實使用者回報）
    - 症狀：只建了基本資料、還沒建療程的病人，在資料庫頁選任何日期區間後就**整個人消失**，連用姓名/病歷號搜尋都找不回來 → 永遠無法補建療程（追蹤清單 8 個 Tab 全以療程為基礎，那邊也不會出現，等於這個病人被困死）
    - 原因：`patient-db.js` 收案日期篩選寫 `if (!p._treatment_start) return false;`。`_treatment_start` 是從**第一筆療程**衍生的欄位，沒有療程 → `''` → 被當成「不符合日期條件」濾掉。但真正的語意是「這個人還沒有收案日期」，不是「不符合」
    - 做法：篩選衍生欄位前先問「**這筆資料是沒有值，還是值不符合？**」。沒有值的一律保留（`p.treatments.length === 0 → return true`），否則使用者會遇到「資料存在卻找不到」的死路。同理，有療程但缺 `treatment_start`（待補資料）也不隱藏
    - 延伸：只要「該筆資料是使用者唯一的操作入口」，寧可多顯示也不要藏

14. **`initDefaultSettings` 對舊資料庫早退 → 後來新增的設定永遠是空的**（V7.1.1 修）
    - 症狀：舊資料庫（`initialized` 已為 true）拿不到後來才加進預設值的設定。例如 `treatment_intents` 若為空 →「治療目的」下拉只有「請選擇」→ 它是新增療程的**必填欄位** → 使用者永遠無法新增療程，而系統設定頁**沒有地方可以補**（`treatment_intents` 無管理 UI）
    - 原因：`if (existing) return;` 讓舊資料庫跳過所有 `Settings.set`。（舊版曾為 `patient_app_url` 單獨打補丁「新舊用戶都適用」—— 那就是這個坑咬過一次的證據）
    - 做法：改成 `DEFAULT_SETTINGS` 常數 + 迴圈補齊**缺少的鍵**（`Settings.get(key) === null` 才寫入）。要點：
      - 只補「完全不存在」的鍵；使用者刻意清空成 `[]` 的設定要保留，不可還原
      - **`initDemoData()` 必須維持只在首次初始化時跑**（`if (wasInitialized) return;` 之後才呼叫），否則使用者「清除資料」後演示資料會自己長回來
      - 之後在 `DEFAULT_SETTINGS` 加新設定，舊資料庫會自動補齊，不必再打單點補丁

15. **明確搜尋不該被其他篩選條件擋住**（V7.2.0 修，坑 #13 的同族）
    - 症狀：使用者在資料庫頁搜尋舊病人的姓名/病歷號，結果 0 筆 —— 因為該病人的療程在往年，被「本月」期間篩選擋掉了。人在系統裡卻搜不到，無法回頭幫他開新療程
    - 原因：搜尋和期間篩選被當成「同時成立的 AND 條件」。但語意不同：**期間篩選是瀏覽用的收斂，明確搜尋是指名要找「那個人」**
    - 做法：`patient-db.js` 的日期篩選加 `&& !searchInput` —— 有搜尋字串時一律忽略期間。並在結果數標示「（搜尋中，已忽略期間篩選）」，否則使用者會困惑為何跑出本月以外的人
    - 通則：**瀏覽用篩選 vs 指名查找，是兩種模式**。使用者打字搜尋時，其他收斂條件應退讓

16. **新增病人：病歷號是唯一鍵，一輸完就要查**（V7.2.0）
    - 症狀（舊行為）：要把姓名、性別全部填完並按「新增」才跳出「病歷號已存在」，白填一輪
    - 做法：`medical_id` 欄位 `onblur/onchange → Patient.checkExisting(value)`，即時在表單內顯示舊病人資訊（姓名/性別/年齡/療程數/狀態）與「沿用舊資料，開新療程」。有進行中療程則不給開新療程、改提示需先結案或終止
    - 注意：比對前必須先 `padMedicalId()` 補零（輸 `12345` 要命中 `0012345`），否則永遠查不到
    - 送出時的 `showExistingPatientDialog` 保留為最後防線（使用者可能略過提示直接按新增）

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
改 PWA 離線/快取策略    → sw.js（CACHE_VERSION + APP_SHELL + CDN_ASSETS）；可安裝設定 → favicon/site.webmanifest（醫護）/ manifest.json（病人）
升版                  → index.html：header span + 18 個 ?v= + sw.js CACHE_VERSION + README 版本歷程（坑 #5 四處）
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

- **V7.2.0**（2026-07-15）舊病人回診流程：輸完病歷號即時提醒舊資料 + 沿用開新療程（坑 #16）；資料庫搜尋不再被期間篩選擋住（坑 #15）
- **V7.1.1**（2026-07-15）Bug 修正：資料庫頁日期篩選會讓「只有基本資料的病人」消失導致無法補建療程（坑 #13）；`initDefaultSettings` 對舊資料庫早退致設定永遠空白（坑 #14）；無生日顯示 `null歲`、生日欄位誤標必填（v6.11.23 遺留）
- **V7.1.0**（2026-06-04）PWA 升級：加 `sw.js`（離線快取 App Shell + CDN best-effort）、醫護/病人各自可安裝、補病人端 manifest.json（修坑 #9）
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
2. **PWA 離線實機驗證** — sw.js 的離線快取、「加入主畫面」在醫院 iPad/Android 實機跑過一輪；確認 CDN 封鎖時 best-effort 降級行為正常
3. Capacitor 手機版轉換（IndexedDB→SQLite、CDN library 本地打包、離線字型、原生分享、App Store/Play 帳號）
4. 體重預測演算法優化（目前線性迴歸 14 天）
5. 多院區支援

---

## 八、一句話總結

V7.2.0 補完「舊病人回診」這條路：輸完病歷號當下就提醒有舊資料並可直接沿用開新療程（不必白填一輪才發現重複），資料庫搜尋也不再被期間篩選擋住（往年收案的舊病人現在搜得到）。連同 V7.1.1 修掉的兩個死路（無療程病人被日期篩選藏死、舊資料庫設定永遠空白擋住新增療程），坑 #13/#15 是同一個教訓的兩面：**資料存在卻讓使用者找不到，就是死路**。下版重點仍是把共享資料夾同步和 PWA 離線拉到醫院實機驗證。
