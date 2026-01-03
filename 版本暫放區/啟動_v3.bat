@echo off
chcp 65001 >nul 2>&1
title SELA 體重追蹤系統 V2.0.0

echo ================================================
echo SELA 體重追蹤系統 V2.0.0
echo ================================================
echo.

REM 檢查 Python
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [錯誤] 找不到 Python
    echo 請先安裝 Python 3.9+ : https://www.python.org/downloads/
    echo 安裝時請勾選 "Add Python to PATH"
    pause
    exit /b 1
)

echo 檢查 Python 版本...
python --version

echo.
echo 安裝/更新套件...
python -m pip install --upgrade pip -q 2>nul
python -m pip install flet openpyxl reportlab python-dateutil Pillow -q

REM 嘗試安裝 matplotlib（可選）
python -m pip install matplotlib -q 2>nul

echo.
echo 啟動程式...
echo ------------------------------------------------
python main.py

if %errorlevel% neq 0 (
    echo.
    echo [錯誤] 程式異常結束，錯誤碼: %errorlevel%
    pause
)
