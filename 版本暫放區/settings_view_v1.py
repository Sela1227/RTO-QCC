"""設定頁"""
import flet as ft
from app.config.theme import SELATheme


class SettingsView:
    """設定頁"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
    
    def build(self) -> ft.Control:
        """建立設定 UI"""
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            padding=SELATheme.SPACE_LG,
            content=ft.Column([
                ft.Text(
                    "設定",
                    size=18,
                    weight=ft.FontWeight.BOLD,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=24),
                # 警示設定
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    border_radius=SELATheme.RADIUS_MD,
                    padding=SELATheme.SPACE_MD,
                    content=ft.Column([
                        ft.Text("警示設定", weight=ft.FontWeight.BOLD),
                        ft.Row([
                            ft.Text("SDM 提醒閾值:", size=12),
                            ft.Text("3%", size=12, color=SELATheme.TEXT_SECONDARY),
                        ]),
                        ft.Row([
                            ft.Text("營養師轉介閾值:", size=12),
                            ft.Text("5%", size=12, color=SELATheme.TEXT_SECONDARY),
                        ]),
                    ], spacing=8),
                ),
                ft.Container(height=16),
                # 版本資訊
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    border_radius=SELATheme.RADIUS_MD,
                    padding=SELATheme.SPACE_MD,
                    content=ft.Column([
                        ft.Text("關於", weight=ft.FontWeight.BOLD),
                        ft.Text("版本 1.0.0", size=12, color=SELATheme.TEXT_SECONDARY),
                        ft.Text(
                            "© SELA · Chang Bing Show Chwan Memorial Hospital",
                            size=11,
                            color=SELATheme.TEXT_HINT,
                        ),
                    ], spacing=8),
                ),
            ]),
        )
