#!/bin/bash
# SELA 體重追蹤系統 - macOS/Linux 啟動腳本

echo "================================================"
echo "SELA 體重追蹤系統 V2.0.0"
echo "================================================"
echo ""

# 切換到腳本所在目錄
cd "$(dirname "$0")"

# 檢查 Python
PYTHON_CMD=""
if command -v python3 &> /dev/null; then
    PYTHON_CMD="python3"
elif command -v python &> /dev/null; then
    PYTHON_CMD="python"
else
    echo "[錯誤] 找不到 Python"
    echo "macOS: brew install python3"
    echo "Ubuntu: sudo apt install python3 python3-pip"
    exit 1
fi

echo "使用 Python: $PYTHON_CMD"
$PYTHON_CMD --version
echo ""

# 安裝依賴
echo "檢查套件..."
$PYTHON_CMD -m pip install --upgrade pip -q 2>/dev/null
$PYTHON_CMD -m pip install flet openpyxl reportlab python-dateutil Pillow -q 2>/dev/null

# 嘗試安裝 matplotlib（可選）
$PYTHON_CMD -m pip install matplotlib -q 2>/dev/null || true

echo ""
echo "啟動程式..."
echo "------------------------------------------------"
$PYTHON_CMD main.py

if [ $? -ne 0 ]; then
    echo ""
    echo "[錯誤] 程式異常結束"
    read -p "按 Enter 鍵結束..."
fi
