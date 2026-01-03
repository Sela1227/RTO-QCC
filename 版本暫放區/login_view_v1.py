"""登入頁面"""
import flet as ft
from app.config.theme import SELATheme
from app.services.auth_service import AuthService


class LoginView:
    """登入頁面"""
    
    def __init__(self, page: ft.Page, on_login_success):
        self.page = page
        self.on_login_success = on_login_success
        self.auth_service = AuthService()
    
    def build(self) -> ft.Control:
        """建立登入頁面"""
        # 帳號輸入
        self.username_field = ft.TextField(
            label="帳號",
            width=280,
            text_size=16,
            border_radius=8,
            autofocus=True,
            on_submit=lambda e: self.password_field.focus(),
        )
        
        # 密碼輸入
        self.password_field = ft.TextField(
            label="密碼",
            width=280,
            text_size=16,
            border_radius=8,
            password=True,
            can_reveal_password=True,
            on_submit=lambda e: self._on_login(e),
        )
        
        # 錯誤訊息
        self.error_text = ft.Text(
            "",
            color=SELATheme.DANGER,
            size=13,
            visible=False,
        )
        
        # 登入按鈕
        self.login_btn = ft.ElevatedButton(
            "登入",
            width=280,
            height=48,
            bgcolor=SELATheme.PRIMARY,
            color=ft.Colors.WHITE,
            on_click=self._on_login,
        )
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                ft.Container(expand=True),
                # LOGO
                ft.Text(
                    "SELA",
                    size=48,
                    weight=ft.FontWeight.BOLD,
                    color=SELATheme.PRIMARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=8),
                ft.Text(
                    "體重追蹤系統",
                    size=20,
                    color=SELATheme.TEXT_PRIMARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=40),
                # 登入表單
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    border_radius=12,
                    padding=30,
                    content=ft.Column([
                        ft.Text(
                            "登入",
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Container(height=20),
                        self.username_field,
                        ft.Container(height=16),
                        self.password_field,
                        ft.Container(height=8),
                        self.error_text,
                        ft.Container(height=20),
                        self.login_btn,
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                ),
                ft.Container(expand=True),
                ft.Text(
                    "© SELA · Chang Bing Show Chwan Memorial Hospital",
                    size=11,
                    color=SELATheme.TEXT_HINT,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=20),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
        )
    
    def _on_login(self, e):
        """登入處理"""
        username = self.username_field.value.strip()
        password = self.password_field.value
        
        if not username or not password:
            self._show_error("請輸入帳號和密碼")
            return
        
        # 執行登入
        success, message = self.auth_service.login(username, password)
        
        if success:
            self.on_login_success(self.auth_service)
        else:
            self._show_error(message)
    
    def _show_error(self, message: str):
        """顯示錯誤"""
        self.error_text.value = message
        self.error_text.visible = True
        self.page.update()
