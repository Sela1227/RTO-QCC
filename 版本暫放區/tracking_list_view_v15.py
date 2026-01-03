"""追蹤清單頁 - 主從視圖"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.config.constants import PAUSE_REASONS, TERMINATE_REASONS
from app.services.tracking_service import TrackingService
from app.services.weight_service import WeightService
from app.services.treatment_service import TreatmentService
from app.services.intervention_service import InterventionService


class TrackingListView:
    """追蹤清單 - 主從視圖（完整功能）"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.tracking_service = TrackingService()
        self.weight_service = WeightService()
        self.treatment_service = TreatmentService()
        self.intervention_service = InterventionService()
        self.current_filter = "all"
        self.current_tab = "active"
        self.selected_treatment = None
        self.detail_container = None
    
    def build(self) -> ft.Control:
        """建立主從視圖"""
        # 取得資料
        if self.current_tab == "active":
            treatments = self.tracking_service.get_tracking_list("active")
        else:
            treatments = self.tracking_service.get_tracking_list("paused")
        
        paused_count = len(self.tracking_service.get_paused_list())
        
        # 統計
        if self.current_tab == "active":
            total = len(treatments)
            overdue = sum(1 for t in treatments if t.tracking_status == "overdue")
            pending = sum(1 for t in treatments if t.tracking_status == "pending")
            has_intervention = sum(1 for t in treatments if t.pending_interventions)
            
            filter_row = ft.Row([
                self._build_filter_chip("all", f"全部 ({total})", self.current_filter == "all"),
                self._build_filter_chip("pending", f"待量 ({pending})", self.current_filter == "pending"),
                self._build_filter_chip("overdue", f"一週未量 ({overdue})", self.current_filter == "overdue"),
                self._build_filter_chip("intervention", f"待介入 ({has_intervention})", self.current_filter == "intervention"),
            ], spacing=8, scroll=ft.ScrollMode.AUTO)
            
            if self.current_filter == "pending":
                treatments = [t for t in treatments if t.tracking_status == "pending"]
            elif self.current_filter == "overdue":
                treatments = [t for t in treatments if t.tracking_status == "overdue"]
            elif self.current_filter == "intervention":
                treatments = [t for t in treatments if t.pending_interventions]
        else:
            filter_row = ft.Container()
        
        # 頁籤
        tabs = ft.Row([
            ft.Container(
                padding=ft.padding.symmetric(horizontal=16, vertical=8),
                border=ft.border.only(bottom=ft.BorderSide(2, SELATheme.PRIMARY if self.current_tab == "active" else "transparent")),
                ink=True,
                on_click=lambda e: self._switch_tab("active"),
                content=ft.Text("治療中", size=14, weight=ft.FontWeight.BOLD if self.current_tab == "active" else None,
                               color=SELATheme.PRIMARY if self.current_tab == "active" else SELATheme.TEXT_SECONDARY),
            ),
            ft.Container(
                padding=ft.padding.symmetric(horizontal=16, vertical=8),
                border=ft.border.only(bottom=ft.BorderSide(2, SELATheme.PRIMARY if self.current_tab == "paused" else "transparent")),
                ink=True,
                on_click=lambda e: self._switch_tab("paused"),
                content=ft.Row([
                    ft.Text("暫停中", size=14, weight=ft.FontWeight.BOLD if self.current_tab == "paused" else None,
                           color=SELATheme.PRIMARY if self.current_tab == "paused" else SELATheme.TEXT_SECONDARY),
                    ft.Container(
                        bgcolor=SELATheme.WARNING,
                        border_radius=10,
                        padding=ft.padding.symmetric(horizontal=6, vertical=2),
                        content=ft.Text(str(paused_count), size=10, color=ft.Colors.WHITE),
                    ) if paused_count > 0 else ft.Container(),
                ], spacing=4),
            ),
        ])
        
        # 左側：小卡片列表（60%）
        if treatments:
            cards = [self._build_card(t) for t in treatments]
            card_area = ft.Container(
                expand=6,  # 60%
                content=ft.Column([
                    ft.Row(controls=cards, wrap=True, spacing=6, run_spacing=6),
                ], scroll=ft.ScrollMode.AUTO),
            )
        else:
            empty_msg = "目前沒有暫停中的療程" if self.current_tab == "paused" else "目前沒有治療中的病人"
            card_area = ft.Container(
                expand=6,
                content=ft.Column([
                    ft.Icon(ft.Icons.CHECK_CIRCLE, size=48, color=SELATheme.SUCCESS),
                    ft.Text(empty_msg, color=SELATheme.TEXT_SECONDARY),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                   alignment=ft.MainAxisAlignment.CENTER),
            )
        
        # 右側：詳情區（40%）
        self.detail_container = ft.Container(
            expand=4,  # 40%
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Icon(ft.Icons.TOUCH_APP, size=48, color=SELATheme.TEXT_HINT),
                ft.Text("點選左側病人卡片", color=SELATheme.TEXT_HINT),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
               alignment=ft.MainAxisAlignment.CENTER),
        )
        
        if self.selected_treatment:
            self._update_detail(self.selected_treatment)
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    padding=ft.padding.symmetric(horizontal=16, vertical=8),
                    content=ft.Column([tabs, filter_row if self.current_tab == "active" else ft.Container()], spacing=8),
                ),
                ft.Container(
                    expand=True,
                    padding=ft.padding.all(12),
                    content=ft.Row([
                        card_area,
                        ft.VerticalDivider(width=1, color=SELATheme.DIVIDER),
                        self.detail_container,
                    ], spacing=12),
                ),
            ], spacing=0),
        )
    
    def _build_filter_chip(self, code: str, label: str, selected: bool) -> ft.Control:
        return ft.Container(
            bgcolor=SELATheme.PRIMARY if selected else SELATheme.SURFACE,
            border_radius=16,
            padding=ft.padding.symmetric(horizontal=12, vertical=6),
            ink=True,
            on_click=lambda e, c=code: self._on_filter_change(c),
            content=ft.Text(label, size=12, color=ft.Colors.WHITE if selected else SELATheme.TEXT_PRIMARY),
        )
    
    def _switch_tab(self, tab: str):
        self.current_tab = tab
        self.current_filter = "all"
        self.selected_treatment = None
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _on_filter_change(self, code: str):
        self.current_filter = code
        self.selected_treatment = None
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _build_card(self, treatment) -> ft.Control:
        """建立小卡片 - 簡潔配色"""
        # 狀態決定左邊框顏色
        if treatment.status == "paused":
            left_border_color = SELATheme.TEXT_HINT
        elif treatment.unable_to_measure:
            left_border_color = SELATheme.TEXT_HINT
        elif treatment.tracking_status == "overdue":
            left_border_color = SELATheme.DANGER
        elif treatment.tracking_status == "pending":
            left_border_color = SELATheme.WARNING
        else:
            left_border_color = SELATheme.SUCCESS
        
        is_selected = self.selected_treatment and self.selected_treatment.id == treatment.id
        
        patient = treatment.patient
        medical_id = patient.medical_id_display if patient else ""
        name = patient.name if patient else ""
        age = f"{patient.age}y" if patient and patient.age else ""
        cancer = treatment.cancer_type_label if treatment.cancer_type_label else ""
        
        current_weight = f"{treatment.current_weight:.1f}kg" if treatment.current_weight else "-"
        
        # 天數
        if treatment.unable_to_measure:
            days_text = "無法量"
            days_color = SELATheme.TEXT_HINT
        elif treatment.days_since_last == 0:
            days_text = "今天"
            days_color = SELATheme.SUCCESS
        elif treatment.days_since_last:
            days_text = f"{treatment.days_since_last}天"
            days_color = SELATheme.DANGER if treatment.days_since_last >= 7 else SELATheme.TEXT_SECONDARY
        else:
            days_text = "-"
            days_color = SELATheme.TEXT_HINT
        
        # 變化率
        rate_text = ""
        rate_color = SELATheme.TEXT_SECONDARY
        if treatment.current_change_rate:
            rate = treatment.current_change_rate
            rate_text = f"{rate:+.1f}%"
            if rate <= -5:
                rate_color = SELATheme.DANGER
            elif rate <= -3:
                rate_color = SELATheme.WARNING
        
        return ft.Container(
            width=115,
            height=80,
            bgcolor=SELATheme.PRIMARY + "15" if is_selected else ft.Colors.WHITE,
            border=ft.border.only(left=ft.BorderSide(4, left_border_color)),
            border_radius=SELATheme.RADIUS_SM,
            padding=ft.padding.only(left=8, right=6, top=6, bottom=6),
            shadow=ft.BoxShadow(blur_radius=2, color="#00000010") if not is_selected else None,
            ink=True,
            on_click=lambda e, t=treatment: self._on_card_click(t),
            content=ft.Column([
                # 行1：病歷號 姓名
                ft.Row([
                    ft.Text(medical_id, size=9, weight=ft.FontWeight.BOLD, color=SELATheme.TEXT_PRIMARY),
                    ft.Text(name, size=9, max_lines=1, overflow=ft.TextOverflow.ELLIPSIS),
                ], spacing=4),
                # 行2：癌別 年紀
                ft.Row([
                    ft.Text(cancer, size=9, color=SELATheme.TEXT_SECONDARY),
                    ft.Container(expand=True),
                    ft.Text(age, size=9, color=SELATheme.TEXT_HINT),
                ], spacing=2),
                # 行3：體重 天數 %
                ft.Row([
                    ft.Text(current_weight, size=9, color=SELATheme.TEXT_SECONDARY),
                    ft.Container(expand=True),
                    ft.Text(days_text, size=9, color=days_color),
                    ft.Text(rate_text, size=9, color=rate_color, weight=ft.FontWeight.BOLD),
                ], spacing=4),
            ], spacing=3),
        )
    
    def _on_card_click(self, treatment):
        """點擊卡片"""
        self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _update_detail(self, treatment):
        """更新右側詳情區 - 完整功能"""
        patient = treatment.patient
        records = self.weight_service.get_history(treatment.id)
        
        # === 病人資訊區 ===
        info_section = ft.Column([
            ft.Row([
                ft.Text(f"{patient.medical_id_display}" if patient else "", size=18, weight=ft.FontWeight.BOLD),
                ft.Text(f"{patient.name}" if patient else "", size=18, weight=ft.FontWeight.BOLD),
                ft.Text(f"（{patient.age}歲）" if patient and patient.age else "", size=14, color=SELATheme.TEXT_SECONDARY),
            ], spacing=8),
            ft.Row([
                ft.Text(f"{treatment.cancer_type_label}", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Text(f"基準 {treatment.baseline_weight:.1f} kg", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Container(expand=True),
                ft.Container(
                    bgcolor={"active": SELATheme.SUCCESS, "paused": SELATheme.WARNING}.get(treatment.status, SELATheme.TEXT_HINT),
                    border_radius=4,
                    padding=ft.padding.symmetric(horizontal=8, vertical=2),
                    content=ft.Text(treatment.status_label, size=10, color=ft.Colors.WHITE),
                ),
            ], spacing=8),
        ], spacing=4)
        
        # === 快速輸入體重 ===
        self.weight_input = ft.TextField(
            label="體重 (kg)",
            width=100,
            text_size=14,
            keyboard_type=ft.KeyboardType.NUMBER,
            text_align=ft.TextAlign.CENTER,
        )
        
        weight_input_section = ft.Container(
            bgcolor=SELATheme.BG,
            border_radius=SELATheme.RADIUS_SM,
            padding=SELATheme.SPACE_SM,
            content=ft.Row([
                self.weight_input,
                ft.ElevatedButton(
                    "記錄體重",
                    on_click=lambda e, t=treatment: self._quick_add_weight(t),
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                    height=40,
                ),
            ], spacing=12),
        )
        
        # === 待處理介入 ===
        intervention_section = ft.Container()
        if treatment.pending_interventions:
            has_sdm = any(i.type == "sdm" for i in treatment.pending_interventions)
            has_nutrition = any(i.type == "nutrition" for i in treatment.pending_interventions)
            
            btns = []
            if has_sdm:
                btns.append(ft.ElevatedButton("執行 SDM", on_click=lambda e, t=treatment: self._go_intervention(t, "sdm"),
                                              bgcolor=SELATheme.WARNING, color=ft.Colors.WHITE, height=36))
            if has_nutrition:
                btns.append(ft.ElevatedButton("轉營養師", on_click=lambda e, t=treatment: self._go_intervention(t, "nutrition"),
                                              bgcolor=SELATheme.DANGER, color=ft.Colors.WHITE, height=36))
            
            intervention_section = ft.Container(
                bgcolor=SELATheme.WARNING + "20",
                border_radius=SELATheme.RADIUS_SM,
                padding=SELATheme.SPACE_SM,
                content=ft.Column([
                    ft.Text("⚠️ 待處理介入", size=12, weight=ft.FontWeight.BOLD, color=SELATheme.WARNING),
                    ft.Row(btns, spacing=8),
                ], spacing=6),
            )
        
        # === 體重記錄列表（可點擊編輯）===
        weight_items = []
        for r in records[:8]:
            measure_date = r.measure_date
            if isinstance(measure_date, str):
                measure_date = date.fromisoformat(measure_date.split('T')[0])
            date_str = measure_date.strftime("%m/%d")
            
            badge = None
            if r.alert_level == "sdm":
                badge = ft.Container(bgcolor=SELATheme.WARNING, border_radius=4,
                    padding=ft.padding.symmetric(horizontal=4, vertical=1),
                    content=ft.Text("SDM", size=9, color=ft.Colors.WHITE))
            elif r.alert_level == "nutrition":
                badge = ft.Container(bgcolor=SELATheme.DANGER, border_radius=4,
                    padding=ft.padding.symmetric(horizontal=4, vertical=1),
                    content=ft.Text("營養", size=9, color=ft.Colors.WHITE))
            
            weight_items.append(
                ft.Container(
                    padding=ft.padding.symmetric(vertical=4, horizontal=4),
                    border_radius=4,
                    ink=True,
                    on_click=lambda e, rec=r, t=treatment: self._show_weight_edit_dialog(rec, t),
                    content=ft.Row([
                        ft.Text(date_str, size=11, width=40),
                        ft.Text(f"{r.weight:.1f} kg", size=11, weight=ft.FontWeight.BOLD),
                        ft.Text(r.change_rate_display, size=10, color=SELATheme.TEXT_SECONDARY),
                        ft.Container(expand=True),
                        badge if badge else ft.Container(),
                        ft.Icon(ft.Icons.EDIT, size=12, color=SELATheme.TEXT_HINT),
                    ], spacing=6),
                )
            )
        
        records_section = ft.Column([
            ft.Text("體重記錄", size=12, weight=ft.FontWeight.BOLD),
            ft.Container(
                height=180,
                content=ft.Column(weight_items, spacing=2, scroll=ft.ScrollMode.AUTO),
            ),
        ], spacing=4)
        
        # === 操作按鈕區 ===
        if treatment.status == "active":
            action_buttons = ft.Row([
                ft.OutlinedButton("手動介入", height=32, on_click=lambda e, t=treatment: self._show_manual_intervention_dialog(t)),
                ft.OutlinedButton("無法測量", height=32, on_click=lambda e, t=treatment: self._show_unable_dialog(t)),
                ft.Container(expand=True),
                ft.OutlinedButton("暫停", height=32, style=ft.ButtonStyle(color=SELATheme.WARNING),
                                 on_click=lambda e, t=treatment: self._show_pause_dialog(t)),
                ft.OutlinedButton("結案", height=32, style=ft.ButtonStyle(color=SELATheme.SUCCESS),
                                 on_click=lambda e, t=treatment: self._show_complete_dialog(t)),
            ], spacing=6)
        elif treatment.status == "paused":
            action_buttons = ft.Row([
                ft.ElevatedButton("恢復療程", height=36, bgcolor=SELATheme.SUCCESS, color=ft.Colors.WHITE,
                                 on_click=lambda e, t=treatment: self._on_resume(t)),
                ft.OutlinedButton("終止", height=32, style=ft.ButtonStyle(color=SELATheme.DANGER),
                                 on_click=lambda e, t=treatment: self._show_terminate_dialog(t)),
            ], spacing=8)
        else:
            action_buttons = ft.Container()
        
        # === 組合詳情內容 ===
        detail_content = ft.Column([
            info_section,
            ft.Divider(height=16),
            weight_input_section if treatment.status == "active" else ft.Container(),
            ft.Container(height=8) if treatment.status == "active" else ft.Container(),
            intervention_section,
            ft.Container(height=8) if treatment.pending_interventions else ft.Container(),
            records_section,
            ft.Container(expand=True),
            ft.Divider(height=8),
            action_buttons,
        ], spacing=4)
        
        self.detail_container.content = detail_content
    
    def _quick_add_weight(self, treatment):
        """快速新增體重"""
        try:
            weight = float(self.weight_input.value.strip())
            if weight <= 0 or weight > 300:
                self.main_view.show_snack("體重數值不合理")
                return
            
            self.weight_service.create(treatment.id, weight)
            self.main_view.show_snack("已記錄體重")
            
            self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
            self.main_view.content_area.content = self.build()
            self.page.update()
        except ValueError:
            self.main_view.show_snack("請輸入正確的體重")
    
    def _go_intervention(self, treatment, int_type):
        """前往介入頁"""
        self.main_view.show_intervention_detail(treatment.id, int_type)
    
    def _show_weight_edit_dialog(self, record, treatment):
        """顯示體重編輯對話框"""
        measure_date = record.measure_date
        if isinstance(measure_date, str):
            measure_date = date.fromisoformat(measure_date.split('T')[0])
        
        selected_date = [measure_date]
        
        weight_field = ft.TextField(value=str(record.weight), label="體重 (kg)", width=120,
                                    text_align=ft.TextAlign.CENTER, keyboard_type=ft.KeyboardType.NUMBER)
        date_text = ft.Text(measure_date.strftime("%Y-%m-%d"), size=14)
        error_text = ft.Text("", color=SELATheme.DANGER, size=12, visible=False)
        
        def show_date_picker(e):
            def on_date_change(e):
                if dp.value:
                    picked = dp.value.date() if hasattr(dp.value, 'date') else dp.value
                    selected_date[0] = picked
                    date_text.value = picked.strftime("%Y-%m-%d")
                    self.page.update()
            dp = ft.DatePicker(first_date=date(2015, 1, 1), last_date=date.today(), value=selected_date[0], on_change=on_date_change)
            self.page.open(dp)
        
        def on_save(e):
            try:
                weight = float(weight_field.value.strip())
                if weight <= 0 or weight > 300:
                    error_text.value = "體重數值不合理"
                    error_text.visible = True
                    self.page.update()
                    return
                
                self.weight_service.update(record.id, weight, selected_date[0], treatment.id,
                                          treatment.baseline_weight, treatment.cancer_type)
                dialog.open = False
                self.main_view.show_snack("已更新")
                self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
                self.main_view.content_area.content = self.build()
                self.page.update()
            except ValueError as ex:
                error_text.value = str(ex)
                error_text.visible = True
                self.page.update()
        
        def on_delete(e):
            self.weight_service.delete(record.id)
            dialog.open = False
            self.main_view.show_snack("已刪除")
            self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        is_baseline = record.change_rate is None or record.change_rate == 0
        
        dialog = ft.AlertDialog(
            title=ft.Text("編輯體重", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Row([ft.Text("日期："), date_text, ft.IconButton(icon=ft.Icons.CALENDAR_TODAY, on_click=show_date_picker)]),
                weight_field, error_text,
            ], tight=True, width=250),
            actions=[
                ft.TextButton("刪除", on_click=on_delete, style=ft.ButtonStyle(color=SELATheme.DANGER)) if not is_baseline else ft.Container(),
                ft.Container(expand=True),
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("儲存", on_click=on_save, bgcolor=SELATheme.PRIMARY, color=ft.Colors.WHITE),
            ],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_manual_intervention_dialog(self, treatment):
        """手動建立介入"""
        def on_sdm(e):
            dialog.open = False
            self.intervention_service.create_manual(treatment.id, "sdm")
            self.main_view.show_snack("已建立 SDM")
            self._go_intervention(treatment, "sdm")
        
        def on_nutrition(e):
            dialog.open = False
            self.intervention_service.create_manual(treatment.id, "nutrition")
            self.main_view.show_snack("已建立營養師轉介")
            self._go_intervention(treatment, "nutrition")
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("手動建立介入", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.ElevatedButton("SDM", width=200, bgcolor=SELATheme.WARNING, color=ft.Colors.WHITE, on_click=on_sdm),
                ft.ElevatedButton("營養師轉介", width=200, bgcolor=SELATheme.DANGER, color=ft.Colors.WHITE, on_click=on_nutrition),
            ], tight=True, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
            actions=[ft.TextButton("取消", on_click=on_cancel)],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_unable_dialog(self, treatment):
        """無法測量對話框"""
        from app.config.constants import UNABLE_REASONS
        
        is_unable = treatment.unable_to_measure
        reason_dropdown = ft.Dropdown(
            label="原因", width=200,
            options=[ft.dropdown.Option(key=r["code"], text=r["label"]) for r in UNABLE_REASONS],
        )
        
        def on_toggle(e):
            if is_unable:
                self.treatment_service.clear_unable_to_measure(treatment.id)
            else:
                reason = reason_dropdown.value
                if not reason:
                    self.main_view.show_snack("請選擇原因")
                    return
                self.treatment_service.set_unable_to_measure(treatment.id, reason)
            dialog.open = False
            self.main_view.show_snack("已更新")
            self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        content = ft.Text(f"目前：{treatment.unable_reason_label}\n取消標記？") if is_unable else reason_dropdown
        btn_text = "取消標記" if is_unable else "確定標記"
        
        dialog = ft.AlertDialog(
            title=ft.Text("無法測量體重", font_family=SELATheme.FONT_FAMILY),
            content=content,
            actions=[ft.TextButton("取消", on_click=on_cancel), ft.ElevatedButton(btn_text, on_click=on_toggle)],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_pause_dialog(self, treatment):
        """暫停療程對話框"""
        reason_dropdown = ft.Dropdown(
            label="原因", width=200,
            options=[ft.dropdown.Option(key=r["code"], text=r["label"]) for r in PAUSE_REASONS],
        )
        
        def on_confirm(e):
            reason = reason_dropdown.value
            if not reason:
                self.main_view.show_snack("請選擇原因")
                return
            self.treatment_service.pause(treatment.id, reason)
            dialog.open = False
            self.main_view.show_snack("已暫停療程")
            self._switch_tab("paused")
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("暫停療程", font_family=SELATheme.FONT_FAMILY),
            content=reason_dropdown,
            actions=[ft.TextButton("取消", on_click=on_cancel), ft.ElevatedButton("暫停", on_click=on_confirm)],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_complete_dialog(self, treatment):
        """結案對話框"""
        def on_confirm(e):
            self.treatment_service.complete(treatment.id)
            dialog.open = False
            self.main_view.show_snack("已結案")
            self.selected_treatment = None
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("確認結案", font_family=SELATheme.FONT_FAMILY),
            content=ft.Text("確定要結案此療程嗎？"),
            actions=[ft.TextButton("取消", on_click=on_cancel), 
                    ft.ElevatedButton("結案", on_click=on_confirm, bgcolor=SELATheme.SUCCESS, color=ft.Colors.WHITE)],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_terminate_dialog(self, treatment):
        """終止療程對話框"""
        reason_dropdown = ft.Dropdown(
            label="原因", width=200,
            options=[ft.dropdown.Option(key=r["code"], text=r["label"]) for r in TERMINATE_REASONS],
        )
        
        def on_confirm(e):
            reason = reason_dropdown.value
            if not reason:
                self.main_view.show_snack("請選擇原因")
                return
            self.treatment_service.terminate(treatment.id, reason)
            dialog.open = False
            self.main_view.show_snack("已終止療程")
            self.selected_treatment = None
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("終止療程", font_family=SELATheme.FONT_FAMILY),
            content=reason_dropdown,
            actions=[ft.TextButton("取消", on_click=on_cancel), 
                    ft.ElevatedButton("終止", on_click=on_confirm, bgcolor=SELATheme.DANGER, color=ft.Colors.WHITE)],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _on_resume(self, treatment):
        """恢復療程"""
        self.treatment_service.resume(treatment.id)
        self.main_view.show_snack("已恢復療程")
        self._switch_tab("active")
