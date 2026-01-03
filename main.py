#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
放射線治療體重追蹤系統
Radio-Oncology Weight Tracking System

版本：2.0.0
"""

import flet as ft
import asyncio
import platform
from app.config.settings import AppSettings
from app.config.theme import SELATheme
from app.views.main_view import MainView

# ============================================================
# 應用程式資訊
# ============================================================
APP_VERSION = "2.0.0"
APP_NAME = "體重追蹤系統"
APP_TITLE_ZH = "彰秀放腫"
APP_SUBTITLE_EN_LINE1 = "Chang Bing Show Chwan Memorial Hospital"
APP_SUBTITLE_EN_LINE2 = "Radio-Oncology Weight Tracking System"

# ============================================================
# SELA 品牌常數（不可更改）
# ============================================================
BRAND_ORANGE = "#FA7A35"
FONT_FAMILY = "Microsoft JhengHei UI" if platform.system() == "Windows" else "PingFang TC"


def get_screen_size():
    """取得螢幕解析度（跨平台）"""
    try:
        system = platform.system()
        if system == "Windows":
            import ctypes
            user32 = ctypes.windll.user32
            # 啟用 DPI 感知以取得正確解析度
            try:
                user32.SetProcessDPIAware()
            except:
                pass
            return (user32.GetSystemMetrics(0), user32.GetSystemMetrics(1))
        elif system == "Darwin":  # macOS
            try:
                from AppKit import NSScreen
                screen = NSScreen.mainScreen()
                frame = screen.frame()
                # macOS 返回的是點（points），需考慮 Retina 顯示器
                # 但 Flet 使用的是邏輯尺寸，所以直接使用 frame
                w, h = int(frame.size.width), int(frame.size.height)
                # MacBook Air 13" 通常是 1440x900 或 1470x956
                # MacBook Air 15" 通常是 1710x1112
                # 如果偵測到很小，使用合理的預設值
                if w < 1400:
                    return (1440, 900)
                return (w, h)
            except ImportError:
                # 如果沒有 AppKit，使用 MacBook Air 預設值
                return (1440, 900)
        else:  # Linux
            return (1920, 1080)
    except Exception:
        return (1440, 900)


def calculate_splash_size(screen_w, screen_h):
    """計算 Splash 尺寸"""
    splash_w = max(450, min(580, screen_w * 0.35))
    splash_h = max(320, min(450, screen_h * 0.40))
    return int(splash_w), int(splash_h)


def calculate_window_size(screen_w, screen_h):
    """計算主視窗尺寸"""
    # 根據螢幕大小決定視窗比例
    if screen_w <= 1440:
        # 小螢幕（如 MacBook Air 13"）使用較大比例
        win_w = screen_w * 0.92
        win_h = screen_h * 0.88
    elif screen_w <= 1920:
        # 中等螢幕
        win_w = screen_w * 0.82
        win_h = screen_h * 0.85
    else:
        # 大螢幕
        win_w = screen_w * 0.75
        win_h = screen_h * 0.80
    
    # 確保最小和最大尺寸
    win_w = max(1100, min(1600, win_w))
    win_h = max(700, min(1000, win_h))
    return int(win_w), int(win_h)


def center_window(page: ft.Page, width: int, height: int):
    """視窗置中"""
    screen_w, screen_h = get_screen_size()
    left = (screen_w - width) // 2
    top = (screen_h - height) // 2
    page.window.width = width
    page.window.height = height
    page.window.left = left
    page.window.top = top


def splash_screen(page: ft.Page):
    """SELA 標準 Splash 啟動畫面（樣式不可更改）"""
    screen_w, screen_h = get_screen_size()
    splash_w, splash_h = calculate_splash_size(screen_w, screen_h)
    
    # 依螢幕調整尺寸
    logo_size = max(36, min(56, int(splash_w * 0.1)))
    is_small = screen_w <= 1440
    title_size = 18 if is_small else 22
    subtitle_size = 12 if is_small else 14
    copyright_size = 10 if is_small else 11
    progress_width = splash_w * 0.75
    
    # 視窗設定
    page.window.frameless = True
    page.window.title_bar_hidden = True
    page.window.resizable = False
    page.padding = 0
    page.bgcolor = ft.Colors.WHITE
    center_window(page, splash_w, splash_h)
    
    # 進度條
    progress = ft.ProgressBar(
        width=progress_width,
        value=0,
        color=BRAND_ORANGE,
        bgcolor=ft.Colors.GREY_200,
    )
    
    # Splash 內容（SELA 標準結構，不可更改）
    splash_content = ft.Column(
        [
            ft.Container(expand=True),
            # LOGO（樣式不可更改）
            ft.Text(
                "SELA",
                size=logo_size,
                weight=ft.FontWeight.BOLD,
                color=BRAND_ORANGE,
                font_family=FONT_FAMILY,
            ),
            ft.Container(height=8),
            # 中文標題
            ft.Text(
                f"{APP_TITLE_ZH} · {APP_NAME} V{APP_VERSION}",
                size=title_size,
                color=ft.Colors.BLUE_GREY_700,
                font_family=FONT_FAMILY,
            ),
            ft.Container(height=12),
            # 英文副標
            ft.Text(
                APP_SUBTITLE_EN_LINE1,
                size=subtitle_size,
                color=ft.Colors.BLUE_GREY_500,
                font_family=FONT_FAMILY,
            ),
            ft.Text(
                APP_SUBTITLE_EN_LINE2,
                size=subtitle_size,
                color=ft.Colors.BLUE_GREY_500,
                font_family=FONT_FAMILY,
            ),
            ft.Container(height=20),
            # 進度條
            progress,
            ft.Container(expand=True),
            # 版權
            ft.Text(
                "© SELA · Health Check Center · Chang Bing Show Chwan Memorial Hospital",
                size=copyright_size,
                color=ft.Colors.BLUE_GREY_400,
                font_family=FONT_FAMILY,
            ),
            ft.Container(height=15),
        ],
        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
    )
    
    page.add(splash_content)
    page.update()
    
    async def do_loading():
        # 初始化資料庫
        from app.models.database import Database
        db = Database()
        db.initialize()
        
        # 進度動畫
        for i in range(60):
            progress.value = (i + 1) / 60
            page.update()
            await asyncio.sleep(0.025)
        
        # 進入主程式
        page.window.resizable = True
        page.window.frameless = False
        page.window.title_bar_hidden = False
        
        # 計算主視窗尺寸
        win_w, win_h = calculate_window_size(screen_w, screen_h)
        page.window.width = win_w
        page.window.height = win_h
        page.window.min_width = 950
        page.window.min_height = 650
        page.title = f"{APP_TITLE_ZH} · {APP_NAME} V{APP_VERSION} By SELA"
        
        # 置中
        center_window(page, win_w, win_h)
        
        # 載入主畫面
        main_view = MainView(page)
        main_view.show()
    
    page.run_task(do_loading)


def main(page: ft.Page):
    """主程式進入點"""
    page.theme_mode = ft.ThemeMode.LIGHT
    splash_screen(page)


if __name__ == "__main__":
    # 兼容不同版本 flet 的啟動方式
    import sys
    
    try:
        # 嘗試使用新版 API (flet 0.70+)
        if hasattr(ft, 'run'):
            ft.run(target=main)
        else:
            # 舊版 flet
            ft.app(target=main)
    except TypeError:
        # 某些版本可能需要不同參數
        try:
            ft.app(target=main, view=ft.AppView.FLET_APP)
        except:
            ft.app(target=main)
    except Exception as e:
        print(f"啟動錯誤: {e}")
        print("請確認已安裝必要套件: pip install -r requirements.txt")
        sys.exit(1)
