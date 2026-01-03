# 放腫體重追蹤系統

放射線治療病人體重監控與營養介入管理系統，協助放腫團隊追蹤病人體重變化，及時進行 SDM 或營養師轉介。

## 功能

- **病人管理**：新增、搜尋、編輯病人資料
- **療程追蹤**：建立療程、記錄體重、監控變化率
- **自動警示**：體重下降達閾值自動觸發介入提醒
- **介入管理**：SDM 執行、營養師轉介、手動介入
- **統計報表**：體重分布、介入執行率、癌別分析
- **Excel 匯出**：完整報表匯出功能

## 系統需求

- Python 3.10+
- Windows / macOS / Linux

## 安裝

```bash
# 複製專案
git clone <repository-url>
cd sela-weight-tracker

# 安裝依賴
pip install -r requirements.txt
```

## 使用

```bash
# 開發模式（熱重載）
flet run main.py

# 或直接執行
python main.py
```

## 打包

```bash
# 打包成執行檔
flet pack main.py --name 放腫體重追蹤系統
```

## 專案結構

```
sela-weight-tracker/
├── main.py              # 程式進入點
├── app/
│   ├── config/          # 設定檔（主題、常數）
│   ├── models/          # 資料模型
│   ├── repositories/    # 資料存取層
│   ├── services/        # 業務邏輯層
│   ├── views/           # 畫面元件
│   └── components/      # 共用元件
├── requirements.txt     # Python 依賴
└── data/                # 資料庫檔案（自動產生）
```

## 技術棧

- **框架**：Flet（Flutter for Python）
- **資料庫**：SQLite
- **圖表**：Matplotlib
- **報表**：OpenPyXL

## 開發

### 體重變化率計算

```
變化率 = (目前體重 - 基準體重) / 基準體重 × 100%

- 負數 = 體重下降
- 正數 = 體重上升
```

### 警示閾值（預設）

| 等級 | 閾值 | 動作 |
|------|------|------|
| SDM | ≤ -3% | 觸發 SDM 提醒 |
| 營養師 | ≤ -5% | 觸發營養師轉介 |

### 追蹤狀態

| 狀態 | 條件 |
|------|------|
| 🟢 正常 | 7 天內有量測 |
| 🟡 待量測 | 5-7 天未量測 |
| 🔴 逾期 | 超過 7 天未量測 |
| ⚠️ 無法測量 | 標記為無法測量 |

## 授權

MIT License
