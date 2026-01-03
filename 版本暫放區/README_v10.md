# 放腫體重追蹤系統

放射線治療病人體重監控與營養介入管理系統，協助放腫團隊追蹤病人體重變化，及時進行 SDM 或營養師轉介。

## 功能

- **病人管理**：新增、搜尋、編輯病人資料
- **療程追蹤**：建立療程、記錄體重、監控變化率
- **自動警示**：體重下降達閾值自動觸發介入提醒
- **介入管理**：SDM 執行、營養師轉介、手動介入
- **統計報表**：體重分布、介入執行率、癌別分析
- **Excel 匯出**：完整報表匯出功能
- **PDF 轉介單**：營養轉介單自動生成

## 系統需求

- Python 3.9+ (建議 3.10 或 3.11)
- Windows 10+ / macOS 10.15+ / Linux

## 快速開始

### Windows

```batch
# 方法1：雙擊執行
啟動.bat

# 方法2：命令列
pip install -r requirements.txt
python main.py
```

### macOS

```bash
# 方法1：終端機執行
chmod +x 啟動.sh
./啟動.sh

# 方法2：手動安裝
pip3 install flet openpyxl reportlab python-dateutil Pillow
python3 main.py
```

### Linux

```bash
pip3 install -r requirements.txt
python3 main.py
```

## 常見問題

### macOS: matplotlib 安裝失敗
matplotlib 是可選套件（用於圖表），沒有它程式也能正常運行：
```bash
# 只安裝必要套件
pip3 install flet openpyxl reportlab python-dateutil Pillow
```

### Windows: 中文顯示亂碼
確保系統已安裝中文字體（微軟正黑體）

### 程式無法啟動
1. 確認 Python 版本：`python --version`（需 3.9+）
2. 重新安裝套件：`pip install -r requirements.txt --force-reinstall`

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
