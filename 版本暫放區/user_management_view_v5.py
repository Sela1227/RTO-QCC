"""用戶管理頁面"""
import flet as ft
from app.config.theme import SELATheme
from app.services.auth_service import AuthService, UserService, AuditService


class UserManagementView:
    """用戶管理頁面"""
    
    def __init__(self, page: ft.Page, auth_service: AuthService, on_back):
        self.page = page
        self.auth_service = auth_service
        self.user_service = UserService(auth_service)
        self.audit_service = AuditService()
        self.on_back = on_back
        self.current_tab = "users"  # users, logs
    
    def build(self) -> ft.Control:
        """建立用戶管理頁面"""
        # 頁籤
        tabs = ft.Row([
            self._build_tab("users", "👥 用戶管理"),
            self._build_tab("logs", "📋 操作紀錄"),
        ], spacing=0)
        
        # 內容區
        if self.current_tab == "users":
            content = self._build_users_content()
        else:
            content = self._build_logs_content()
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                # 標題列
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    padding=ft.padding.symmetric(horizontal=16, vertical=12),
                    content=ft.Row([
                        ft.IconButton(
                            icon=ft.Icons.ARROW_BACK,
                            on_click=lambda e: self.on_back(),
                        ),
                        ft.Text(
                            "用戶與紀錄管理",
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Container(expand=True),
                        ft.Text(
                            f"目前用戶：{self.auth_service.current_user.display_name}",
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                    ]),
                ),
                # 頁籤
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    padding=ft.padding.only(left=16, right=16),
                    content=tabs,
                ),
                # 內容
                ft.Container(
                    expand=True,
                    padding=16,
                    content=content,
                ),
            ], spacing=0),
        )
    
    def _build_tab(self, key: str, label: str) -> ft.Control:
        """建立頁籤"""
        is_active = self.current_tab == key
        return ft.Container(
            padding=ft.padding.symmetric(horizontal=20, vertical=12),
            border=ft.border.only(bottom=ft.BorderSide(3, SELATheme.PRIMARY if is_active else "transparent")),
            ink=True,
            on_click=lambda e, k=key: self._switch_tab(k),
            content=ft.Text(
                label,
                size=14,
                weight=ft.FontWeight.BOLD if is_active else None,
                color=SELATheme.PRIMARY if is_active else SELATheme.TEXT_SECONDARY,
            ),
        )
    
    def _switch_tab(self, tab: str):
        """切換頁籤"""
        self.current_tab = tab
        self._refresh()
    
    def _refresh(self):
        """重整頁面"""
        self.page.controls.clear()
        self.page.add(self.build())
        self.page.update()
    
    def _build_users_content(self) -> ft.Control:
        """用戶列表"""
        users = self.user_service.get_all()
        
        # 用戶列表
        user_rows = []
        for user in users:
            status_icon = "🟢" if user.is_active else "🔴"
            last_login = user.last_login.strftime("%Y-%m-%d %H:%M") if user.last_login else "從未登入"
            
            user_rows.append(
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    border_radius=8,
                    padding=12,
                    margin=ft.margin.only(bottom=8),
                    content=ft.Row([
                        ft.Column([
                            ft.Text(f"{status_icon} {user.username}", size=14, weight=ft.FontWeight.BOLD),
                            ft.Text(f"{user.display_name} · {user.role_label}", size=12, color=SELATheme.TEXT_SECONDARY),
                            ft.Text(f"最後登入：{last_login}", size=11, color=SELATheme.TEXT_HINT),
                        ], spacing=2, expand=True),
                        ft.Row([
                            ft.IconButton(
                                icon=ft.Icons.EDIT,
                                icon_size=18,
                                tooltip="編輯",
                                on_click=lambda e, u=user: self._show_edit_dialog(u),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.KEY,
                                icon_size=18,
                                tooltip="重設密碼",
                                on_click=lambda e, u=user: self._show_reset_password_dialog(u),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.BLOCK if user.is_active else ft.Icons.CHECK_CIRCLE,
                                icon_size=18,
                                icon_color=SELATheme.DANGER if user.is_active else SELATheme.SUCCESS,
                                tooltip="停用" if user.is_active else "啟用",
                                on_click=lambda e, u=user: self._toggle_user_status(u),
                            ) if user.username != "admin" else ft.Container(),
                        ], spacing=0),
                    ]),
                )
            )
        
        return ft.Column([
            # 新增用戶按鈕
            ft.Row([
                ft.ElevatedButton(
                    "➕ 新增用戶",
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                    on_click=lambda e: self._show_add_dialog(),
                ),
            ]),
            ft.Container(height=16),
            # 用戶列表
            ft.Column(user_rows, scroll=ft.ScrollMode.AUTO, expand=True),
        ], expand=True)
    
    def _build_logs_content(self) -> ft.Control:
        """操作紀錄"""
        logs = self.audit_service.get_recent(200)
        
        log_rows = []
        for log in logs:
            time_str = log.created_at.strftime("%m/%d %H:%M") if log.created_at else ""
            
            log_rows.append(
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    border_radius=6,
                    padding=10,
                    margin=ft.margin.only(bottom=6),
                    content=ft.Row([
                        ft.Text(time_str, size=11, color=SELATheme.TEXT_HINT, width=80),
                        ft.Text(log.username or "-", size=12, width=80),
                        ft.Text(log.action_label, size=12, weight=ft.FontWeight.BOLD, width=100),
                        ft.Text(log.details or "", size=12, color=SELATheme.TEXT_SECONDARY, expand=True),
                    ]),
                )
            )
        
        return ft.Column([
            ft.Text(f"最近 {len(logs)} 筆操作紀錄", size=12, color=SELATheme.TEXT_SECONDARY),
            ft.Container(height=8),
            ft.Column(log_rows, scroll=ft.ScrollMode.AUTO, expand=True),
        ], expand=True)
    
    def _show_add_dialog(self):
        """新增用戶對話框"""
        username_field = ft.TextField(label="帳號 *", width=200, text_size=14)
        password_field = ft.TextField(label="密碼 *", width=200, text_size=14, password=True)
        display_field = ft.TextField(label="顯示名稱", width=200, text_size=14)
        role_dropdown = ft.Dropdown(
            label="角色",
            width=200,
            options=[
                ft.dropdown.Option("user", "一般用戶"),
                ft.dropdown.Option("viewer", "唯讀"),
                ft.dropdown.Option("admin", "管理員"),
            ],
            value="user",
        )
        error_text = ft.Text("", color=SELATheme.DANGER, size=12, visible=False)
        
        def on_save(e):
            username = username_field.value.strip()
            password = password_field.value
            display_name = display_field.value.strip() or username
            role = role_dropdown.value
            
            success, message, user = self.user_service.create(username, password, display_name, role)
            
            if success:
                dialog.open = False
                self._refresh()
            else:
                error_text.value = message
                error_text.visible = True
                self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("新增用戶", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                username_field,
                password_field,
                display_field,
                role_dropdown,
                error_text,
            ], tight=True, spacing=12),
            actions=[
                ft.TextButton("取消", on_click=lambda e: setattr(dialog, 'open', False) or self.page.update()),
                ft.ElevatedButton("新增", bgcolor=SELATheme.PRIMARY, color=ft.Colors.WHITE, on_click=on_save),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_edit_dialog(self, user):
        """編輯用戶對話框"""
        display_field = ft.TextField(label="顯示名稱", width=200, text_size=14, value=user.display_name)
        role_dropdown = ft.Dropdown(
            label="角色",
            width=200,
            options=[
                ft.dropdown.Option("user", "一般用戶"),
                ft.dropdown.Option("viewer", "唯讀"),
                ft.dropdown.Option("admin", "管理員"),
            ],
            value=user.role,
        )
        
        def on_save(e):
            display_name = display_field.value.strip()
            role = role_dropdown.value
            
            success, message = self.user_service.update(user.id, display_name, role)
            
            if success:
                dialog.open = False
                self._refresh()
            else:
                self.page.snack_bar = ft.SnackBar(ft.Text(message))
                self.page.snack_bar.open = True
                self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text(f"編輯用戶：{user.username}", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                display_field,
                role_dropdown,
            ], tight=True, spacing=12),
            actions=[
                ft.TextButton("取消", on_click=lambda e: setattr(dialog, 'open', False) or self.page.update()),
                ft.ElevatedButton("儲存", bgcolor=SELATheme.PRIMARY, color=ft.Colors.WHITE, on_click=on_save),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_reset_password_dialog(self, user):
        """重設密碼對話框"""
        password_field = ft.TextField(label="新密碼 *", width=200, text_size=14, password=True)
        
        def on_save(e):
            password = password_field.value
            
            success, message = self.user_service.reset_password(user.id, password)
            
            dialog.open = False
            self.page.snack_bar = ft.SnackBar(ft.Text(message))
            self.page.snack_bar.open = True
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text(f"重設密碼：{user.username}", font_family=SELATheme.FONT_FAMILY),
            content=password_field,
            actions=[
                ft.TextButton("取消", on_click=lambda e: setattr(dialog, 'open', False) or self.page.update()),
                ft.ElevatedButton("重設", bgcolor=SELATheme.WARNING, color=ft.Colors.WHITE, on_click=on_save),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _toggle_user_status(self, user):
        """切換用戶狀態"""
        if user.is_active:
            success, message = self.user_service.disable(user.id)
        else:
            success, message = self.user_service.enable(user.id)
        
        if success:
            self._refresh()
        else:
            self.page.snack_bar = ft.SnackBar(ft.Text(message))
            self.page.snack_bar.open = True
            self.page.update()
