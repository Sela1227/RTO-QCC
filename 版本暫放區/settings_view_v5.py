"""設定頁"""
import flet as ft
import os
import shutil
from datetime import datetime
from app.config.theme import SELATheme
from app.models.database import Database
from app.services.settings_service import SettingsService


class SettingsView:
    """設定頁"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.db = Database()
        self.settings_service = SettingsService()
    
    def build(self) -> ft.Control:
        """建立設定 UI"""
        # 取得資料庫統計
        db_stats = self._get_db_stats()
        
        # 取得目前設定
        settings = self.settings_service.get_all()
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                # 標題
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16, vertical=12),
                    content=ft.Text(
                        "設定",
                        size=18,
                        weight=ft.FontWeight.BOLD,
                        font_family=SELATheme.FONT_FAMILY,
                    ),
                ),
                # 內容
                ft.Container(
                    expand=True,
                    padding=ft.padding.symmetric(horizontal=16),
                    content=ft.Column([
                        # 警示設定
                        self._build_section("⚠️ 警示設定", [
                            self._build_setting_row(
                                "SDM 提醒閾值",
                                "體重下降達此比例觸發 SDM",
                                f"{settings['sdm_threshold']}%",
                                on_tap=lambda e: self._show_threshold_dialog("sdm"),
                            ),
                            self._build_setting_row(
                                "營養師轉介閾值",
                                "體重下降達此比例觸發營養師轉介",
                                f"{settings['nutrition_threshold']}%",
                                on_tap=lambda e: self._show_threshold_dialog("nutrition"),
                            ),
                            self._build_setting_row(
                                "逾期天數",
                                "超過此天數未量體重視為逾期",
                                f"{settings['overdue_days']} 天",
                                on_tap=lambda e: self._show_threshold_dialog("overdue"),
                            ),
                        ]),
                        ft.Container(height=16),
                        # 資料管理
                        self._build_section("💾 資料管理", [
                            self._build_action_row(
                                "備份資料庫",
                                f"目前資料：{db_stats['patients']} 病人、{db_stats['treatments']} 療程",
                                "備份",
                                on_click=self._on_backup,
                                color=SELATheme.SUCCESS,
                            ),
                            self._build_action_row(
                                "還原資料庫",
                                "從備份檔還原資料",
                                "還原",
                                on_click=self._on_restore,
                                color=SELATheme.WARNING,
                            ),
                            self._build_action_row(
                                "清除所有資料",
                                "刪除所有病人、療程、記錄",
                                "清除",
                                on_click=self._on_clear_all,
                                color=SELATheme.DANGER,
                            ),
                        ]),
                        ft.Container(height=16),
                        # 關於
                        self._build_section("ℹ️ 關於", [
                            ft.Container(
                                padding=ft.padding.symmetric(vertical=8),
                                content=ft.Column([
                                    ft.Text("放射線治療體重追蹤系統", size=14, weight=ft.FontWeight.BOLD),
                                    ft.Text("版本 1.0.0", size=12, color=SELATheme.TEXT_SECONDARY),
                                    ft.Container(height=8),
                                    ft.Text(
                                        "© 2024 SELA",
                                        size=11,
                                        color=SELATheme.TEXT_HINT,
                                    ),
                                    ft.Text(
                                        "Chang Bing Show Chwan Memorial Hospital",
                                        size=11,
                                        color=SELATheme.TEXT_HINT,
                                    ),
                                ], spacing=4),
                            ),
                        ]),
                    ], scroll=ft.ScrollMode.AUTO),
                ),
            ], spacing=0),
        )
    
    def _build_section(self, title: str, children: list) -> ft.Control:
        """建立設定區塊"""
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Text(title, size=14, weight=ft.FontWeight.BOLD),
                ft.Container(height=8),
                ft.Column(children, spacing=0),
            ]),
        )
    
    def _build_setting_row(self, title: str, subtitle: str, value: str, on_tap=None) -> ft.Control:
        """建立設定項目"""
        return ft.Container(
            padding=ft.padding.symmetric(vertical=8),
            ink=True if on_tap else False,
            on_click=on_tap,
            content=ft.Row([
                ft.Column([
                    ft.Text(title, size=13),
                    ft.Text(subtitle, size=11, color=SELATheme.TEXT_HINT),
                ], spacing=2, expand=True),
                ft.Text(value, size=13, color=SELATheme.PRIMARY),
                ft.Icon(ft.Icons.CHEVRON_RIGHT, size=16, color=SELATheme.TEXT_HINT) if on_tap else ft.Container(),
            ]),
        )
    
    def _build_action_row(self, title: str, subtitle: str, button_text: str, 
                          on_click=None, color: str = SELATheme.PRIMARY) -> ft.Control:
        """建立動作項目"""
        return ft.Container(
            padding=ft.padding.symmetric(vertical=8),
            content=ft.Row([
                ft.Column([
                    ft.Text(title, size=13),
                    ft.Text(subtitle, size=11, color=SELATheme.TEXT_HINT),
                ], spacing=2, expand=True),
                ft.OutlinedButton(
                    button_text,
                    on_click=on_click,
                    style=ft.ButtonStyle(
                        color=color,
                        side=ft.BorderSide(1, color),
                    ),
                ),
            ]),
        )
    
    def _get_db_stats(self) -> dict:
        """取得資料庫統計"""
        patients = self.db.fetch_one("SELECT COUNT(*) as cnt FROM patients")
        treatments = self.db.fetch_one("SELECT COUNT(*) as cnt FROM treatments")
        weights = self.db.fetch_one("SELECT COUNT(*) as cnt FROM weight_records")
        
        return {
            "patients": patients["cnt"] if patients else 0,
            "treatments": treatments["cnt"] if treatments else 0,
            "weights": weights["cnt"] if weights else 0,
        }
    
    def _show_threshold_dialog(self, setting_type: str):
        """顯示閾值設定對話框"""
        titles = {
            "sdm": "SDM 提醒閾值",
            "nutrition": "營養師轉介閾值",
            "overdue": "逾期天數",
        }
        
        keys = {
            "sdm": "sdm_threshold",
            "nutrition": "nutrition_threshold",
            "overdue": "overdue_days",
        }
        
        current_value = self.settings_service.get(keys[setting_type])
        
        field = ft.TextField(
            value=str(current_value),
            keyboard_type=ft.KeyboardType.NUMBER,
            input_filter=ft.InputFilter(regex_string=r"[0-9]"),
            suffix_text="%" if setting_type != "overdue" else "天",
            width=150,
            text_align=ft.TextAlign.CENTER,
        )
        
        error_text = ft.Text("", color=SELATheme.DANGER, size=12, visible=False)
        
        def on_save(e):
            try:
                value = int(field.value)
                if value <= 0:
                    error_text.value = "數值必須大於 0"
                    error_text.visible = True
                    self.page.update()
                    return
                
                if setting_type in ("sdm", "nutrition") and value > 50:
                    error_text.value = "閾值不應超過 50%"
                    error_text.visible = True
                    self.page.update()
                    return
                
                if setting_type == "overdue" and value > 30:
                    error_text.value = "天數不應超過 30"
                    error_text.visible = True
                    self.page.update()
                    return
                
                # 儲存
                self.settings_service.set(keys[setting_type], value)
                
                dialog.open = False
                self.main_view.show_snack("設定已儲存")
                # 重新整理頁面
                self.main_view.content_area.content = self.build()
                self.page.update()
                
            except ValueError:
                error_text.value = "請輸入有效數字"
                error_text.visible = True
                self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        # 快速選項
        quick_options = []
        if setting_type == "sdm":
            quick_values = [2, 3, 5]
        elif setting_type == "nutrition":
            quick_values = [3, 5, 7]
        else:
            quick_values = [5, 7, 14]
        
        def set_quick_value(value):
            def handler(e):
                field.value = str(value)
                self.page.update()
            return handler
        
        for v in quick_values:
            suffix = "%" if setting_type != "overdue" else "天"
            quick_options.append(
                ft.Container(
                    bgcolor=SELATheme.BG,
                    border_radius=12,
                    padding=ft.padding.symmetric(horizontal=12, vertical=6),
                    ink=True,
                    on_click=set_quick_value(v),
                    content=ft.Text(f"{v}{suffix}", size=12),
                )
            )
        
        dialog = ft.AlertDialog(
            title=ft.Text(titles.get(setting_type, ""), font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text(
                    "選擇或輸入數值",
                    size=12,
                    color=SELATheme.TEXT_SECONDARY,
                ),
                ft.Container(height=12),
                ft.Row(quick_options, spacing=8),
                ft.Container(height=12),
                field,
                error_text,
            ], tight=True, width=250),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton(
                    "儲存",
                    on_click=on_save,
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _on_backup(self, e):
        """備份資料庫"""
        try:
            # 備份路徑
            docs_path = os.path.expanduser("~/Documents")
            if not os.path.exists(docs_path):
                docs_path = os.path.expanduser("~")
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_filename = f"weight_tracker_backup_{timestamp}.db"
            backup_path = os.path.join(docs_path, backup_filename)
            
            # 複製資料庫
            shutil.copy2(self.db.db_path, backup_path)
            
            self.main_view.show_snack(f"已備份：{backup_filename}")
        except Exception as ex:
            self.main_view.show_snack(f"備份失敗：{str(ex)}")
    
    def _on_restore(self, e):
        """還原資料庫"""
        def on_confirm(e):
            dialog.open = False
            self.page.update()
            self._do_restore()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Row([
                ft.Icon(ft.Icons.WARNING, color=SELATheme.WARNING),
                ft.Text("還原資料庫", font_family=SELATheme.FONT_FAMILY),
            ]),
            content=ft.Column([
                ft.Text("還原將會覆蓋目前所有資料！", size=14),
                ft.Container(height=8),
                ft.Text(
                    "請確認備份檔案位於「文件」資料夾中，\n檔名格式：weight_tracker_backup_*.db",
                    size=12,
                    color=SELATheme.TEXT_SECONDARY,
                ),
            ], tight=True),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton(
                    "選擇檔案還原",
                    on_click=on_confirm,
                    bgcolor=SELATheme.WARNING,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _do_restore(self):
        """執行還原"""
        # 列出可用的備份檔
        docs_path = os.path.expanduser("~/Documents")
        if not os.path.exists(docs_path):
            docs_path = os.path.expanduser("~")
        
        backup_files = []
        for f in os.listdir(docs_path):
            if f.startswith("weight_tracker_backup_") and f.endswith(".db"):
                backup_files.append(f)
        
        if not backup_files:
            self.main_view.show_snack("找不到備份檔案")
            return
        
        backup_files.sort(reverse=True)  # 最新的在前面
        
        # 顯示選擇對話框
        options = [
            ft.dropdown.Option(key=f, text=f.replace("weight_tracker_backup_", "").replace(".db", ""))
            for f in backup_files[:10]
        ]
        
        dropdown = ft.Dropdown(
            label="選擇備份檔",
            options=options,
            width=300,
        )
        
        def on_restore(e):
            if not dropdown.value:
                return
            
            try:
                backup_path = os.path.join(docs_path, dropdown.value)
                shutil.copy2(backup_path, self.db.db_path)
                
                select_dialog.open = False
                self.main_view.show_snack("還原成功，請重新啟動程式")
                self.page.update()
            except Exception as ex:
                self.main_view.show_snack(f"還原失敗：{str(ex)}")
        
        def on_cancel(e):
            select_dialog.open = False
            self.page.update()
        
        select_dialog = ft.AlertDialog(
            title=ft.Text("選擇備份檔", font_family=SELATheme.FONT_FAMILY),
            content=dropdown,
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("還原", on_click=on_restore),
            ],
        )
        
        self.page.overlay.append(select_dialog)
        select_dialog.open = True
        self.page.update()
    
    def _on_clear_all(self, e):
        """清除所有資料"""
        def on_confirm(e):
            try:
                self.db.execute("DELETE FROM interventions")
                self.db.execute("DELETE FROM weight_records")
                self.db.execute("DELETE FROM treatments")
                self.db.execute("DELETE FROM patients")
                
                dialog.open = False
                self.main_view.show_snack("已清除所有資料")
                self.main_view.navigate_to(0)
                self.page.update()
            except Exception as ex:
                self.main_view.show_snack(f"清除失敗：{str(ex)}")
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Row([
                ft.Icon(ft.Icons.WARNING, color=SELATheme.DANGER),
                ft.Text("清除所有資料", font_family=SELATheme.FONT_FAMILY),
            ]),
            content=ft.Column([
                ft.Text("確定要刪除所有資料嗎？", size=14),
                ft.Container(height=8),
                ft.Container(
                    bgcolor="#FFEBEE",
                    border_radius=SELATheme.RADIUS_SM,
                    padding=SELATheme.SPACE_MD,
                    content=ft.Column([
                        ft.Text("⚠️ 此操作無法復原！", size=12, weight=ft.FontWeight.BOLD),
                        ft.Text("建議先執行備份", size=12, color=SELATheme.TEXT_SECONDARY),
                    ], spacing=4),
                ),
            ], tight=True),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton(
                    "確認清除",
                    on_click=on_confirm,
                    bgcolor=SELATheme.DANGER,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
