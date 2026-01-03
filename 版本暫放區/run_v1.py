#!/usr/bin/env python3
"""
SELA 體重追蹤系統 - 啟動腳本
支援 Windows / macOS / Linux
"""
import subprocess
import sys
import os

def check_and_install_packages():
    """檢查並安裝必要套件"""
    required = {
        'flet': 'flet',
        'openpyxl': 'openpyxl',
        'reportlab': 'reportlab',
        'dateutil': 'python-dateutil',
        'PIL': 'Pillow',
    }
    
    optional = {
        'matplotlib': 'matplotlib',
    }
    
    missing = []
    
    # 檢查必要套件
    for module, package in required.items():
        try:
            __import__(module)
        except ImportError:
            missing.append(package)
    
    # 檢查可選套件
    for module, package in optional.items():
        try:
            __import__(module)
            print(f"✓ {package} 已安裝")
        except ImportError:
            print(f"⚠ {package} 未安裝（圖表功能不可用，但不影響主程式）")
    
    if missing:
        print(f"\n缺少必要套件: {', '.join(missing)}")
        print("正在安裝...")
        for pkg in missing:
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', pkg])
        print("安裝完成！\n")
    else:
        print("✓ 所有必要套件已安裝\n")

def main():
    """主程式"""
    print("=" * 50)
    print("SELA 體重追蹤系統 V2.0.0")
    print("=" * 50)
    print()
    
    # 切換到腳本所在目錄
    script_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(script_dir)
    
    # 檢查套件
    print("檢查套件...")
    check_and_install_packages()
    
    # 啟動主程式
    print("啟動程式...")
    print("-" * 50)
    
    # 導入並執行 main
    import main as app_main
    import flet as ft
    
    try:
        ft.app(target=app_main.main)
    except Exception as e:
        print(f"啟動錯誤: {e}")
        input("按 Enter 鍵結束...")

if __name__ == "__main__":
    main()
