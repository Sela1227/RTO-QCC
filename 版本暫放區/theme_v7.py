"""SELA 品牌 + 北歐簡潔風格主題"""
import flet as ft

class SELATheme:
    """SELA 品牌主題（結合北歐簡潔風格）"""
    
    # =========================================================
    # SELA 品牌色（不可更改）
    # =========================================================
    BRAND_ORANGE = "#FA7A35"      # 企業識別色（愛馬仕橘）
    
    # =========================================================
    # 基礎色（北歐風格）
    # =========================================================
    BG = "#FAFBFC"                # 頁面背景
    SURFACE = "#FFFFFF"           # 卡片背景
    DIVIDER = "#E2E8F0"           # 分隔線
    
    # 面板背景（SELA 規範）
    PANEL_LEFT = ft.Colors.GREY_50        # 左側面板
    PANEL_RIGHT = ft.Colors.BLUE_GREY_50  # 右側面板
    
    # =========================================================
    # 文字色
    # =========================================================
    TEXT_PRIMARY = ft.Colors.BLUE_GREY_700    # 主要文字
    TEXT_SECONDARY = ft.Colors.BLUE_GREY_600  # 次要文字
    TEXT_HINT = ft.Colors.BLUE_GREY_400       # 提示文字
    TEXT_SUBTITLE = ft.Colors.BLUE_GREY_500   # 副標題
    
    # =========================================================
    # 功能色
    # =========================================================
    PRIMARY = "#FA7A35"           # 主色調（SELA 橘）
    SUCCESS = "#68D391"           # 成功/正常（柔和綠）
    WARNING = "#F6AD55"           # 警告/SDM（柔和橙）
    DANGER = "#FC8181"            # 危險/營養師（柔和紅）
    INFO = ft.Colors.BLUE_700     # 資訊
    
    # =========================================================
    # 狀態色
    # =========================================================
    STATUS_ACTIVE = "#68D391"     # 追蹤中
    STATUS_PAUSED = "#F6AD55"     # 暫停中
    STATUS_TERMINATED = "#FC8181" # 已終止
    STATUS_COMPLETED = "#A0AEC0"  # 已結案
    
    # 追蹤狀態
    TRACKING_NORMAL = "#68D391"   # 正常（綠燈）
    TRACKING_PENDING = "#F6E05E"  # 待量測（黃燈）
    TRACKING_OVERDUE = "#FC8181"  # 逾期（紅燈）
    
    # =========================================================
    # 字體（SELA 規範）
    # =========================================================
    FONT_FAMILY = "Microsoft JhengHei UI"
    
    # 字級
    FONT_H1 = 24
    FONT_H2 = 18
    FONT_H3 = 16
    FONT_BODY = 14
    FONT_CAPTION = 12
    FONT_SMALL = 11
    FONT_TINY = 10
    
    # =========================================================
    # 間距（8 的倍數）
    # =========================================================
    SPACE_XS = 4
    SPACE_SM = 8
    SPACE_MD = 16
    SPACE_LG = 24
    SPACE_XL = 32
    
    # =========================================================
    # 圓角
    # =========================================================
    RADIUS_SM = 8
    RADIUS_MD = 12
    RADIUS_LG = 16
    
    # =========================================================
    # 輔助方法
    # =========================================================
    @classmethod
    def get_font_size(cls, base_size: int, screen_w: int) -> int:
        """根據螢幕寬度調整字體大小"""
        if screen_w <= 1440:
            return max(base_size - 1, 10)
        return base_size
    
    @classmethod
    def is_small_screen(cls, screen_w: int) -> bool:
        """判斷是否小螢幕"""
        return screen_w <= 1440
