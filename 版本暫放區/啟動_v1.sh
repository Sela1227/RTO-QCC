#!/bin/bash
# SELA 體重追蹤系統 - macOS/Linux 啟動腳本

echo "================================================"
echo "SELA 體重追蹤系統 V2.0.0"
echo "================================================"
echo ""

# 切換到腳本所在目錄
cd "$(dirname "$0")"

# 檢查 Python
if ! command -v python3 &> /dev/null; then
    echo "[錯誤] 找不到 Python3"
    echo "macOS: brew install python3"
    echo "Ubuntu: sudo apt install python3 python3-pip"
    exit 1
fi

# 安裝依賴
echo "檢查套件..."
pip3 install flet openpyxl reportlab python-dateutil Pillow -q 2>/dev/null || \
python3 -m pip install flet openpyxl reportlab python-dateutil Pillow -q

# 嘗試安裝 matplotlib（可選）
pip3 install matplotlib -q 2>/dev/null || true

echo ""
echo "啟動程式..."
echo "------------------------------------------------"
python3 main.py

if [ $? -ne 0 ]; then
    echo ""
    echo "[錯誤] 程式異常結束"
    read -p "按 Enter 鍵結束..."
fi
