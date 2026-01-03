"""報表頁"""
import flet as ft
from app.config.theme import SELATheme


class ReportView:
    """報表頁"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
    
    def build(self) -> ft.Control:
        """建立報表 UI"""
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            padding=SELATheme.SPACE_LG,
            content=ft.Column([
                ft.Text(
                    "統計報表",
                    size=18,
                    weight=ft.FontWeight.BOLD,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=24),
                ft.Text(
                    "報表功能開發中...",
                    color=SELATheme.TEXT_SECONDARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
            ]),
        )
