# RTO-QCC 設計系統規範

本文件定義了 RTO-QCC 體重監控系統的 UI 設計規範，供其他程式或開發者參考使用。

---

## 1. 設計風格

**風格名稱**：北歐簡約風（Nordic Minimalism）

**設計原則**：
- 乾淨、低對比度的淺色背景
- 柔和的色彩搭配
- 充足的留白空間
- 圓角卡片設計
- 微妙的陰影層次
- 無過多裝飾元素

---

## 2. 色彩系統

### 2.1 主色調

| 變數名 | 色碼 | 用途 |
|--------|------|------|
| `--primary` | `#5B8FB9` | 主要按鈕、連結、強調元素 |
| `--primary-light` | `#7BA7C9` | 主色淺色變體 |
| `--primary-dark` | `#4A7A9E` | 主色深色變體、hover 狀態 |

### 2.2 背景色

| 變數名 | 色碼 | 用途 |
|--------|------|------|
| `--bg` | `#F7F9FB` | 頁面背景 |
| `--bg-card` | `#FFFFFF` | 卡片、對話框背景 |
| `--bg-hover` | `#F0F4F8` | hover 狀態背景 |
| `--bg-input` | `#F0F4F8` | 輸入框背景 |

### 2.3 文字色

| 變數名 | 色碼 | 用途 |
|--------|------|------|
| `--text` | `#2C3E50` | 主要文字 |
| `--text-secondary` | `#7C8DB0` | 次要文字、標籤 |
| `--text-hint` | `#A8B5C8` | 提示文字、placeholder |

### 2.4 狀態色

| 變數名 | 色碼 | 用途 |
|--------|------|------|
| `--success` | `#6BAF8D` | 成功、正常、綠色狀態 |
| `--warning` | `#E4B95A` | 警告、注意、黃色狀態 |
| `--danger` | `#D97B7B` | 錯誤、危險、紅色狀態 |
| `--purple` | `#9370DB` | 特殊標記（如暫停狀態）|

### 2.5 邊框色

| 變數名 | 色碼 | 用途 |
|--------|------|------|
| `--border` | `#E8ECF1` | 卡片邊框、分隔線 |
| `--border-light` | `#F0F4F8` | 淺色邊框 |

### 2.6 狀態色背景（12% 透明度）

用於標籤、圖標背景：

```css
/* 藍色背景 */
background: rgba(91, 143, 185, 0.12);
color: var(--primary);

/* 綠色背景 */
background: rgba(107, 175, 141, 0.12);
color: var(--success);

/* 黃色背景 */
background: rgba(228, 185, 90, 0.12);
color: #B8941F;

/* 紅色背景 */
background: rgba(217, 123, 123, 0.12);
color: var(--danger);

/* 紫色背景 */
background: rgba(147, 112, 219, 0.12);
color: #7B5BB5;

/* 灰色背景 */
background: rgba(128, 140, 153, 0.12);
color: var(--text-secondary);
```

---

## 3. 字體系統

### 3.1 字體家族

```css
--font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", "微軟正黑體", sans-serif;
```

### 3.2 字體大小

| 變數名 | 大小 | 用途 |
|--------|------|------|
| `--font-size-xs` | `12px` | 輔助文字、標籤 |
| `--font-size-sm` | `14px` | 次要文字、表格 |
| `--font-size-base` | `15px` | 正文、按鈕 |
| `--font-size-lg` | `17px` | 小標題 |
| `--font-size-xl` | `22px` | 標題 |
| `--font-size-2xl` | `32px` | 大數字、統計值 |

### 3.3 字重

| 值 | 用途 |
|----|------|
| `400` | 正文 |
| `500` | 按鈕、標籤 |
| `600` | 小標題、強調 |
| `700` | 大標題、數字 |

### 3.4 行高

```css
line-height: 1.5;  /* 正文 */
line-height: 1.2;  /* 標題、大數字 */
```

---

## 4. 間距系統

| 變數名 | 大小 | 用途 |
|--------|------|------|
| `--space-xs` | `6px` | 最小間距、元素內部 |
| `--space-sm` | `10px` | 小間距、按鈕內距 |
| `--space-md` | `18px` | 中間距、卡片內距 |
| `--space-lg` | `28px` | 大間距、區塊間距 |
| `--space-xl` | `40px` | 最大間距、頁面邊距 |

---

## 5. 圓角系統

| 變數名 | 大小 | 用途 |
|--------|------|------|
| `--radius-sm` | `6px` | 小元素、標籤 |
| `--radius-md` | `10px` | 按鈕、輸入框 |
| `--radius-lg` | `16px` | 卡片、對話框 |
| `--radius-full` | `9999px` | 膠囊形、圓形 |

---

## 6. 陰影系統

| 變數名 | 值 | 用途 |
|--------|------|------|
| `--shadow-sm` | `0 1px 3px rgba(0, 0, 0, 0.04)` | 卡片基礎陰影 |
| `--shadow-md` | `0 4px 12px rgba(0, 0, 0, 0.06)` | hover 狀態陰影 |
| `--shadow-lg` | `0 8px 24px rgba(0, 0, 0, 0.08)` | 對話框、浮動元素 |

---

## 7. 動畫

```css
--transition: 0.2s ease;
```

所有互動元素都應使用此過渡效果。

---

## 8. 元件規範

### 8.1 按鈕

#### 基礎樣式
```css
.btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 10px 18px;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: 0.2s ease;
    border: none;
    white-space: nowrap;
}
```

#### 按鈕變體

| 類別 | 背景 | 文字 | 用途 |
|------|------|------|------|
| `.btn-primary` | `#5B8FB9` | 白色 | 主要操作 |
| `.btn-outline` | 透明 | `#5B8FB9` | 次要操作 |
| `.btn-success` | `#6BAF8D` | 白色 | 確認、成功操作 |
| `.btn-warning` | `#E4B95A` | 白色 | 警告操作 |
| `.btn-danger` | `#D97B7B` | 白色 | 刪除、危險操作 |

#### 圖標按鈕
```css
.btn-icon {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: transparent;
    border: none;
    color: #7C8DB0;
}

.btn-icon:hover {
    background: #F0F4F8;
    color: #2C3E50;
}
```

### 8.2 輸入框

```css
.form-input,
.form-select {
    width: 100%;
    padding: 10px 18px;
    border: 1px solid #E8ECF1;
    border-radius: 10px;
    font-size: 15px;
    color: #2C3E50;
    background: #F0F4F8;
    transition: 0.2s ease;
}

.form-input:focus,
.form-select:focus {
    outline: none;
    border-color: #5B8FB9;
    background: #FFFFFF;
}
```

### 8.3 卡片

```css
.card {
    background: #FFFFFF;
    border-radius: 16px;
    padding: 18px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
    transform: translateY(-2px);
}
```

### 8.4 標籤

```css
.tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 500;
}

/* 顏色變體：使用 2.6 節的背景色規則 */
```

### 8.5 對話框（Modal）

```css
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal {
    background: #FFFFFF;
    border-radius: 16px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    width: 90%;
    max-width: 480px;
    max-height: 85vh;
    overflow: hidden;
}

.modal-header {
    padding: 18px;
    border-bottom: 1px solid #E8ECF1;
    font-size: 17px;
    font-weight: 600;
}

.modal-body {
    padding: 18px;
    overflow-y: auto;
}

.modal-footer {
    padding: 18px;
    border-top: 1px solid #E8ECF1;
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}
```

### 8.6 Toast 通知

```css
.toast {
    background: #2C3E50;
    color: white;
    padding: 18px 28px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    font-size: 14px;
}

.toast.success { background: #6BAF8D; }
.toast.error { background: #D97B7B; }
```

### 8.7 表格

```css
.table {
    width: 100%;
    border-collapse: collapse;
    background: #FFFFFF;
    border-radius: 16px;
    overflow: hidden;
}

.table th,
.table td {
    padding: 18px;
    text-align: left;
    border-bottom: 1px solid #F0F4F8;
}

.table th {
    background: #F7F9FB;
    font-size: 14px;
    font-weight: 600;
    color: #7C8DB0;
}

.table tr:hover {
    background: #F0F4F8;
}
```

### 8.8 頁籤（Tab）

```css
.tab-group {
    display: flex;
    gap: 6px;
    background: #F7F9FB;
    padding: 6px;
    border-radius: 10px;
}

.tab {
    padding: 10px 18px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: #7C8DB0;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: 0.2s ease;
}

.tab.active {
    background: #FFFFFF;
    color: #5B8FB9;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
```

---

## 9. 圖表配色

用於 Chart.js 或其他圖表庫：

```javascript
const chartColors = {
    primary: '#5B8FB9',
    success: '#6BAF8D',
    warning: '#E4B95A',
    danger: '#D97B7B',
    purple: '#9370DB',
    gray: '#A8B5C8',
    
    // 多色系列（用於圓餅圖、柱狀圖）
    palette: [
        '#5B8FB9',  // 藍
        '#6BAF8D',  // 綠
        '#E4B95A',  // 黃
        '#D97B7B',  // 紅
        '#9370DB',  // 紫
        '#5DADE2',  // 淺藍
        '#F5B041',  // 橙
        '#85929E'   // 灰
    ]
};
```

---

## 10. 響應式斷點

```css
/* 手機 */
@media (max-width: 768px) { }

/* 平板 */
@media (min-width: 769px) and (max-width: 1024px) { }

/* 桌面 */
@media (min-width: 1025px) { }
```

---

## 11. 佈局尺寸

| 變數名 | 大小 | 用途 |
|--------|------|------|
| `--header-height` | `60px` | 頂部導航列高度 |
| `--sidebar-width` | `200px` | 側邊欄寬度 |
| `--footer-height` | `44px` | 底部列高度 |

---

## 12. 圖標規範

### 12.1 尺寸

| 場景 | 大小 |
|------|------|
| 按鈕內圖標 | `18px × 18px` |
| 導航圖標 | `20px × 20px` |
| 統計卡片圖標 | `24px × 24px` |
| 空狀態圖標 | `48px × 48px` |

### 12.2 樣式

使用 SVG 線條圖標，推薦 Lucide Icons 或 Feather Icons：

```html
<svg width="20" height="20" viewBox="0 0 24 24" 
     fill="none" stroke="currentColor" stroke-width="2">
    <!-- path -->
</svg>
```

---

## 13. 病人端配色（淺色版）

病人端 APP 使用獨立的淺色配色：

```css
:root {
    --primary: #4A90D9;
    --primary-dark: #3A7BC8;
    --primary-light: #E8F2FC;
    
    --bg: #F5F7FA;
    --bg-card: #FFFFFF;
    --bg-input: #F0F2F5;
    --border: #E0E4E8;
    
    --text: #2C3E50;
    --text-secondary: #5A6A7A;
    --text-hint: #8A9AAA;
    
    --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    --shadow-lg: 0 4px 16px rgba(0, 0, 0, 0.12);
}
```

---

## 14. CSS 變數完整列表

```css
:root {
    /* 主色調 */
    --primary: #5B8FB9;
    --primary-light: #7BA7C9;
    --primary-dark: #4A7A9E;
    
    /* 背景色 */
    --bg: #F7F9FB;
    --bg-card: #FFFFFF;
    --bg-hover: #F0F4F8;
    --bg-input: #F0F4F8;
    
    /* 文字色 */
    --text: #2C3E50;
    --text-secondary: #7C8DB0;
    --text-hint: #A8B5C8;
    
    /* 狀態色 */
    --success: #6BAF8D;
    --warning: #E4B95A;
    --danger: #D97B7B;
    
    /* 邊線 */
    --border: #E8ECF1;
    --border-light: #F0F4F8;
    
    /* 陰影 */
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.04);
    --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.06);
    --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.08);
    
    /* 圓角 */
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 16px;
    --radius-full: 9999px;
    
    /* 間距 */
    --space-xs: 6px;
    --space-sm: 10px;
    --space-md: 18px;
    --space-lg: 28px;
    --space-xl: 40px;
    
    /* 尺寸 */
    --header-height: 60px;
    --sidebar-width: 200px;
    --footer-height: 44px;
    
    /* 字體 */
    --font-family: -apple-system, BlinkMacSystemFont, "Noto Sans TC", "微軟正黑體", sans-serif;
    --font-size-xs: 12px;
    --font-size-sm: 14px;
    --font-size-base: 15px;
    --font-size-lg: 17px;
    --font-size-xl: 22px;
    --font-size-2xl: 32px;
    
    /* 動畫 */
    --transition: 0.2s ease;
}
```

---

## 15. 使用範例

### 15.1 建立一個卡片

```html
<div class="card">
    <div class="card-title">標題</div>
    <div class="card-content">
        內容文字
    </div>
    <div class="card-footer">
        <button class="btn btn-outline">取消</button>
        <button class="btn btn-primary">確定</button>
    </div>
</div>
```

### 15.2 建立表單

```html
<div class="form-group">
    <label class="form-label">姓名</label>
    <input type="text" class="form-input" placeholder="請輸入姓名">
</div>

<div class="form-group">
    <label class="form-label">癌別</label>
    <select class="form-select">
        <option>請選擇</option>
        <option>頭頸癌</option>
        <option>肺癌</option>
    </select>
</div>
```

### 15.3 狀態標籤

```html
<span class="tag tag-green">正常</span>
<span class="tag tag-amber">警告</span>
<span class="tag tag-red">危險</span>
<span class="tag tag-blue">追蹤中</span>
<span class="tag tag-purple">暫停</span>
```

---

*文件版本：v1.0*  
*最後更新：2026-03-30*
