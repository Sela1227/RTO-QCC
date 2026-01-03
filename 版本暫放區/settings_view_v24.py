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
                        # 癌別管理
                        self._build_section("🏥 癌別管理", [
                            self._build_action_row(
                                "管理癌別選項",
                                "新增、刪除、調整癌別順序",
                                "管理",
                                on_click=self._show_cancer_types_dialog,
                                color=SELATheme.PRIMARY,
                            ),
                        ]),
                        ft.Container(height=16),
                        # 警示規則
                        self._build_section("⚠️ 警示規則", [
                            self._build_action_row(
                                "管理警示規則",
                                "設定不同癌別的警示閾值",
                                "管理",
                                on_click=self._show_threshold_rules_dialog,
                                color=SELATheme.WARNING,
                            ),
                        ]),
                        ft.Container(height=16),
                        # 文件管理
                        self._build_section("📁 文件管理", [
                            self._build_action_row(
                                "衛教文件",
                                "管理 SDM 單張、衛教單張等",
                                "管理",
                                on_click=self._show_documents_dialog,
                                color=SELATheme.INFO,
                            ),
                        ]),
                        ft.Container(height=16),
                        # 人員管理
                        self._build_section("👤 人員管理", [
                            self._build_action_row(
                                "人員",
                                "設定 PDF 轉介單的人員選項",
                                "管理",
                                on_click=self._show_staff_dialog,
                                color=SELATheme.PRIMARY,
                            ),
                        ]),
                        ft.Container(height=16),
                        # 關於
                        self._build_section("ℹ️ 關於", [
                            ft.Container(
                                padding=ft.padding.symmetric(vertical=8),
                                content=ft.Column([
                                    ft.Text("放射線治療體重追蹤系統", size=14, weight=ft.FontWeight.BOLD),
                                    ft.Text("版本 1.2.0", size=12, color=SELATheme.TEXT_SECONDARY),
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
                ft.Text(title, size=18, weight=ft.FontWeight.BOLD),
                ft.Container(height=12),
                ft.Column(children, spacing=0),
            ]),
        )
    
    def _build_setting_row(self, title: str, subtitle: str, value: str, on_tap=None) -> ft.Control:
        """建立設定項目"""
        return ft.Container(
            padding=ft.padding.symmetric(vertical=12),
            ink=True if on_tap else False,
            on_click=on_tap,
            content=ft.Row([
                ft.Column([
                    ft.Text(title, size=16),
                    ft.Text(subtitle, size=14, color=SELATheme.TEXT_HINT),
                ], spacing=2, expand=True),
                ft.Text(value, size=16, color=SELATheme.PRIMARY, weight=ft.FontWeight.BOLD),
                ft.Icon(ft.Icons.CHEVRON_RIGHT, size=20, color=SELATheme.TEXT_HINT) if on_tap else ft.Container(),
            ]),
        )
    
    def _build_action_row(self, title: str, subtitle: str, button_text: str, 
                          on_click=None, color: str = SELATheme.PRIMARY) -> ft.Control:
        """建立動作項目"""
        return ft.Container(
            padding=ft.padding.symmetric(vertical=12),
            content=ft.Row([
                ft.Column([
                    ft.Text(title, size=16),
                    ft.Text(subtitle, size=14, color=SELATheme.TEXT_HINT),
                ], spacing=2, expand=True),
                ft.OutlinedButton(
                    button_text,
                    on_click=on_click,
                    height=40,
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
    
    def _show_cancer_types_dialog(self, e):
        """顯示癌別管理對話框"""
        cancer_types = self.settings_service.get_cancer_types()
        
        # 建立列表項目
        def build_list():
            items = []
            for i, ct in enumerate(cancer_types):
                items.append(
                    ft.Container(
                        padding=ft.padding.symmetric(vertical=4, horizontal=8),
                        content=ft.Row([
                            ft.IconButton(
                                icon=ft.Icons.ARROW_UPWARD,
                                icon_size=16,
                                visible=i > 0,
                                on_click=lambda e, idx=i: move_up(idx),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.ARROW_DOWNWARD,
                                icon_size=16,
                                visible=i < len(cancer_types) - 1,
                                on_click=lambda e, idx=i: move_down(idx),
                            ),
                            ft.Text(f"{ct['code']}", size=12, width=50, color=SELATheme.TEXT_HINT),
                            ft.Text(ct["label"], size=13, expand=True),
                            ft.IconButton(
                                icon=ft.Icons.DELETE,
                                icon_size=16,
                                icon_color=SELATheme.DANGER,
                                on_click=lambda e, code=ct["code"]: remove_type(code),
                            ),
                        ]),
                    )
                )
            return items
        
        list_column = ft.Column(build_list(), spacing=0, scroll=ft.ScrollMode.AUTO, height=250)
        
        new_code_field = ft.TextField(label="代碼", width=80, text_size=12)
        new_label_field = ft.TextField(label="名稱", width=120, text_size=12)
        
        def refresh_list():
            nonlocal cancer_types
            cancer_types = self.settings_service.get_cancer_types()
            list_column.controls = build_list()
            self.page.update()
        
        def move_up(idx):
            if idx > 0:
                cancer_types[idx], cancer_types[idx-1] = cancer_types[idx-1], cancer_types[idx]
                self.settings_service.set_cancer_types(cancer_types)
                refresh_list()
        
        def move_down(idx):
            if idx < len(cancer_types) - 1:
                cancer_types[idx], cancer_types[idx+1] = cancer_types[idx+1], cancer_types[idx]
                self.settings_service.set_cancer_types(cancer_types)
                refresh_list()
        
        def remove_type(code):
            self.settings_service.remove_cancer_type(code)
            refresh_list()
        
        def add_type(e):
            code = new_code_field.value.strip().upper()
            label = new_label_field.value.strip()
            if code and label:
                if self.settings_service.add_cancer_type(code, label):
                    new_code_field.value = ""
                    new_label_field.value = ""
                    refresh_list()
        
        def on_close(e):
            dialog.open = False
            self._refresh()
        
        dialog = ft.AlertDialog(
            title=ft.Text("癌別管理", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                list_column,
                ft.Divider(),
                ft.Row([
                    new_code_field,
                    new_label_field,
                    ft.IconButton(
                        icon=ft.Icons.ADD,
                        icon_color=SELATheme.SUCCESS,
                        on_click=add_type,
                    ),
                ]),
            ], tight=True, width=320),
            actions=[
                ft.ElevatedButton("完成", on_click=on_close),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_threshold_rules_dialog(self, e):
        """顯示警示規則管理對話框"""
        rules = self.settings_service.get_threshold_rules()
        cancer_types = self.settings_service.get_cancer_types()
        
        def build_rule_list():
            items = []
            for rule in rules:
                # 癌別限制顯示
                cancer_list = rule.get("cancer_types", [])
                if cancer_list:
                    cancer_labels = []
                    for ct in cancer_types:
                        if ct["code"] in cancer_list:
                            cancer_labels.append(ct["label"])
                    cancer_str = "、".join(cancer_labels)
                else:
                    cancer_str = "所有癌別"
                
                type_label = "營養師" if rule.get("type") == "nutrition" else "SDM"
                
                items.append(
                    ft.Container(
                        padding=ft.padding.symmetric(vertical=6, horizontal=8),
                        content=ft.Row([
                            ft.Column([
                                ft.Text(rule.get("name", ""), size=13, weight=ft.FontWeight.BOLD),
                                ft.Text(f"{type_label} | {rule.get('threshold', 0)}% | {cancer_str}", 
                                       size=11, color=SELATheme.TEXT_HINT),
                            ], spacing=2, expand=True),
                            ft.Switch(
                                value=rule.get("enabled", True),
                                on_change=lambda e, r=rule: toggle_rule(r, e.control.value),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.DELETE,
                                icon_size=16,
                                icon_color=SELATheme.DANGER,
                                on_click=lambda e, r=rule: delete_rule(r),
                            ),
                        ]),
                    )
                )
            return items
        
        rule_list = ft.Column(build_rule_list(), spacing=0, scroll=ft.ScrollMode.AUTO, height=200)
        
        def refresh_rules():
            nonlocal rules
            rules = self.settings_service.get_threshold_rules()
            rule_list.controls = build_rule_list()
            self.page.update()
        
        def toggle_rule(rule, enabled):
            self.settings_service.update_threshold_rule(rule["id"], enabled=enabled)
            refresh_rules()
        
        def delete_rule(rule):
            self.settings_service.delete_threshold_rule(rule["id"])
            refresh_rules()
        
        # 新增規則區
        name_field = ft.TextField(label="名稱", width=100, text_size=12)
        type_dropdown = ft.Dropdown(
            label="類型",
            width=80,
            text_size=12,
            options=[
                ft.dropdown.Option("sdm", "SDM"),
                ft.dropdown.Option("nutrition", "營養師"),
            ],
        )
        threshold_field = ft.TextField(label="%", width=50, text_size=12, keyboard_type=ft.KeyboardType.NUMBER)
        
        # 癌別多選
        cancer_checkboxes = []
        for ct in cancer_types:
            cancer_checkboxes.append(
                ft.Checkbox(label=ct["label"], value=False, data=ct["code"])
            )
        
        def add_rule(e):
            name = name_field.value.strip()
            rule_type = type_dropdown.value
            threshold_str = threshold_field.value.strip()
            
            if not name or not rule_type or not threshold_str:
                return
            
            try:
                threshold = float(threshold_str)
            except:
                return
            
            # 收集選中的癌別
            selected_cancers = [cb.data for cb in cancer_checkboxes if cb.value]
            
            self.settings_service.add_threshold_rule(name, rule_type, threshold, selected_cancers)
            name_field.value = ""
            type_dropdown.value = None
            threshold_field.value = ""
            for cb in cancer_checkboxes:
                cb.value = False
            refresh_rules()
        
        def on_close(e):
            dialog.open = False
            self._refresh()
        
        dialog = ft.AlertDialog(
            title=ft.Text("警示規則管理", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text("現有規則", size=12, color=SELATheme.TEXT_SECONDARY),
                rule_list,
                ft.Divider(),
                ft.Text("新增規則", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Row([name_field, type_dropdown, threshold_field]),
                ft.Text("適用癌別（不選=全部）", size=11, color=SELATheme.TEXT_HINT),
                ft.Row(cancer_checkboxes[:4], wrap=True),
                ft.Row(cancer_checkboxes[4:] if len(cancer_checkboxes) > 4 else [], wrap=True),
                ft.ElevatedButton("新增規則", on_click=add_rule, bgcolor=SELATheme.SUCCESS, color=ft.Colors.WHITE),
            ], tight=True, width=400, scroll=ft.ScrollMode.AUTO),
            actions=[
                ft.ElevatedButton("完成", on_click=on_close),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_documents_dialog(self, e):
        """顯示文件管理對話框"""
        documents = self.settings_service.get_documents()
        
        def build_doc_list():
            items = []
            for doc in documents:
                category_label = {"sdm": "SDM", "education": "衛教", "other": "其他"}.get(doc.get("category"), "其他")
                items.append(
                    ft.Container(
                        padding=ft.padding.symmetric(vertical=6, horizontal=8),
                        content=ft.Row([
                            ft.Icon(ft.Icons.DESCRIPTION, size=20, color=SELATheme.PRIMARY),
                            ft.Column([
                                ft.Text(doc.get("name", ""), size=13),
                                ft.Text(f"{category_label} | {doc.get('created_at', '')}", 
                                       size=10, color=SELATheme.TEXT_HINT),
                            ], spacing=2, expand=True),
                            ft.IconButton(
                                icon=ft.Icons.OPEN_IN_NEW,
                                icon_size=16,
                                on_click=lambda e, d=doc: open_doc(d),
                            ),
                            ft.IconButton(
                                icon=ft.Icons.DELETE,
                                icon_size=16,
                                icon_color=SELATheme.DANGER,
                                on_click=lambda e, d=doc: delete_doc(d),
                            ),
                        ]),
                    )
                )
            
            if not items:
                items.append(ft.Text("尚無文件", color=SELATheme.TEXT_HINT))
            
            return items
        
        doc_list = ft.Column(build_doc_list(), spacing=0, scroll=ft.ScrollMode.AUTO, height=200)
        
        def refresh_docs():
            nonlocal documents
            documents = self.settings_service.get_documents()
            doc_list.controls = build_doc_list()
            self.page.update()
        
        def open_doc(doc):
            import os
            import subprocess
            import platform
            
            filepath = doc.get("filepath", "")
            if os.path.exists(filepath):
                if platform.system() == "Windows":
                    os.startfile(filepath)
                elif platform.system() == "Darwin":
                    subprocess.run(["open", filepath])
                else:
                    subprocess.run(["xdg-open", filepath])
            else:
                self.main_view.show_snack("檔案不存在")
        
        def delete_doc(doc):
            self.settings_service.delete_document(doc["id"])
            refresh_docs()
        
        # 新增文件
        name_field = ft.TextField(label="文件名稱", width=150, text_size=12)
        category_dropdown = ft.Dropdown(
            label="類別",
            width=100,
            text_size=12,
            options=[
                ft.dropdown.Option("sdm", "SDM 單張"),
                ft.dropdown.Option("education", "衛教單張"),
                ft.dropdown.Option("other", "其他"),
            ],
        )
        
        selected_file = [None]
        file_text = ft.Text("尚未選擇檔案", size=11, color=SELATheme.TEXT_HINT)
        
        def on_file_picked(e: ft.FilePickerResultEvent):
            if e.files and len(e.files) > 0:
                selected_file[0] = e.files[0].path
                file_text.value = e.files[0].name
                self.page.update()
        
        file_picker = ft.FilePicker(on_result=on_file_picked)
        self.page.overlay.append(file_picker)
        
        def pick_file(e):
            file_picker.pick_files(
                allowed_extensions=["pdf", "doc", "docx", "png", "jpg"],
                allow_multiple=False,
            )
        
        def add_doc(e):
            name = name_field.value.strip()
            category = category_dropdown.value
            filepath = selected_file[0]
            
            if not name or not filepath:
                self.main_view.show_snack("請填寫名稱並選擇檔案")
                return
            
            # 複製檔案到文件目錄
            import os
            import shutil
            from app.config.settings import AppSettings
            
            docs_dir = os.path.join(AppSettings.DATA_DIR, "documents")
            if not os.path.exists(docs_dir):
                os.makedirs(docs_dir)
            
            ext = os.path.splitext(filepath)[1]
            new_filename = f"{name}_{len(documents)+1}{ext}"
            new_path = os.path.join(docs_dir, new_filename)
            
            try:
                shutil.copy2(filepath, new_path)
                self.settings_service.add_document(name, new_path, category or "other")
                
                name_field.value = ""
                category_dropdown.value = None
                selected_file[0] = None
                file_text.value = "尚未選擇檔案"
                refresh_docs()
                self.main_view.show_snack("已新增文件")
            except Exception as ex:
                self.main_view.show_snack(f"新增失敗：{str(ex)}")
        
        def on_close(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("文件管理", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text("已上傳文件", size=12, color=SELATheme.TEXT_SECONDARY),
                doc_list,
                ft.Divider(),
                ft.Text("新增文件", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Row([name_field, category_dropdown]),
                ft.Row([
                    file_text,
                    ft.TextButton("選擇檔案", on_click=pick_file),
                ]),
                ft.ElevatedButton("新增", on_click=add_doc, bgcolor=SELATheme.SUCCESS, color=ft.Colors.WHITE),
            ], tight=True, width=350),
            actions=[
                ft.ElevatedButton("完成", on_click=on_close),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_staff_dialog(self, e):
        """顯示人員管理對話框"""
        staff_list = self.settings_service.get_staff_list()
        
        # 人員列表顯示
        staff_column = ft.Column([], spacing=4)
        
        def build_staff_list():
            staff_column.controls.clear()
            for name in staff_list:
                staff_column.controls.append(
                    ft.Container(
                        bgcolor=SELATheme.BG,
                        border_radius=4,
                        padding=ft.padding.symmetric(horizontal=12, vertical=8),
                        content=ft.Row([
                            ft.Text(name, size=14),
                            ft.Container(expand=True),
                            ft.IconButton(
                                icon=ft.Icons.DELETE,
                                icon_size=18,
                                icon_color=SELATheme.DANGER,
                                on_click=lambda e, n=name: remove_staff(n),
                            ),
                        ]),
                    )
                )
            if not staff_list:
                staff_column.controls.append(
                    ft.Text("尚無人員", color=SELATheme.TEXT_HINT, size=12)
                )
        
        build_staff_list()
        
        # 新增欄位
        name_field = ft.TextField(
            label="姓名",
            hint_text="輸入人員姓名",
            width=200,
        )
        
        def add_staff(e):
            name = name_field.value.strip()
            if name:
                if name not in staff_list:
                    staff_list.append(name)
                    self.settings_service.set_staff_list(staff_list)
                    name_field.value = ""
                    build_staff_list()
                    self.page.update()
                else:
                    self.main_view.show_snack("人員已存在")
        
        def remove_staff(name):
            if name in staff_list:
                staff_list.remove(name)
                self.settings_service.set_staff_list(staff_list)
                build_staff_list()
                self.page.update()
        
        def on_close(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("人員管理", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text("轉介人員列表", size=13, color=SELATheme.TEXT_SECONDARY),
                ft.Container(height=8),
                ft.Container(
                    height=200,
                    content=ft.Column([staff_column], scroll=ft.ScrollMode.AUTO),
                ),
                ft.Divider(),
                ft.Text("新增人員", size=13, color=SELATheme.TEXT_SECONDARY),
                ft.Row([
                    name_field,
                    ft.IconButton(
                        icon=ft.Icons.ADD_CIRCLE,
                        icon_color=SELATheme.SUCCESS,
                        on_click=add_staff,
                    ),
                ]),
            ], tight=True, width=300),
            actions=[
                ft.ElevatedButton("完成", on_click=on_close),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _refresh(self):
        """刷新頁面"""
        self.main_view.content_area.content = self.build()
        self.page.update()
