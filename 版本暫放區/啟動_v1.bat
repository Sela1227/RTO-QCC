@echo off
chcp 65001 >nul
title SELA 體重追蹤系統

echo ================================================
echo SELA 體重追蹤系統 V2.0.0
echo ================================================
echo.

REM 檢查 Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 找不到 Python，請先安裝 Python 3.9+
    echo 下載: https://www.python.org/downloads/
    pause
    exit /b 1
)

REM 安裝依賴
echo 檢查套件...
pip install flet openpyxl reportlab python-dateutil Pillow -q

REM 嘗試安裝 matplotlib（可選）
pip install matplotlib -q 2>nul

echo.
echo 啟動程式...
echo ------------------------------------------------
python main.py

if %errorlevel% neq 0 (
    echo.
    echo [錯誤] 程式異常結束
    pause
)
