"""追蹤清單頁 - 主從視圖"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.config.constants import PAUSE_REASONS, TERMINATE_REASONS
from app.services.tracking_service import TrackingService
from app.services.weight_service import WeightService
from app.services.treatment_service import TreatmentService
from app.services.intervention_service import InterventionService
from app.components.weight_chart import WeightChartComponent


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
            has_sdm = sum(1 for t in treatments if t.pending_interventions and any(i.type == "sdm" for i in t.pending_interventions))
            has_nutrition = sum(1 for t in treatments if t.pending_interventions and any(i.type == "nutrition" for i in t.pending_interventions))
            unable_count = sum(1 for t in treatments if t.unable_to_measure)
            
            filter_row = ft.Row([
                self._build_filter_chip("all", f"全部 ({total})", self.current_filter == "all"),
                self._build_filter_chip("pending", f"待量 ({pending})", self.current_filter == "pending"),
                self._build_filter_chip("overdue", f"一週未量 ({overdue})", self.current_filter == "overdue"),
                self._build_filter_chip("sdm", f"待SDM ({has_sdm})", self.current_filter == "sdm"),
                self._build_filter_chip("nutrition", f"待營養 ({has_nutrition})", self.current_filter == "nutrition"),
                self._build_filter_chip("unable", f"無法量 ({unable_count})", self.current_filter == "unable"),
            ], spacing=8, scroll=ft.ScrollMode.AUTO)
            
            if self.current_filter == "pending":
                treatments = [t for t in treatments if t.tracking_status == "pending"]
            elif self.current_filter == "overdue":
                treatments = [t for t in treatments if t.tracking_status == "overdue"]
            elif self.current_filter == "intervention":
                treatments = [t for t in treatments if t.pending_interventions]
            elif self.current_filter == "sdm":
                treatments = [t for t in treatments if t.pending_interventions and any(i.type == "sdm" for i in t.pending_interventions)]
            elif self.current_filter == "nutrition":
                treatments = [t for t in treatments if t.pending_interventions and any(i.type == "nutrition" for i in t.pending_interventions)]
            elif self.current_filter == "unable":
                treatments = [t for t in treatments if t.unable_to_measure]
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
        
        # 左側：小卡片列表（55%）- 一行4張固定大小
        if treatments:
            cards = [self._build_card(t) for t in treatments]
            card_area = ft.Container(
                expand=55,
                alignment=ft.alignment.top_left,
                content=ft.Column([
                    ft.Row(controls=cards, wrap=True, spacing=10, run_spacing=10),
                ], scroll=ft.ScrollMode.AUTO, alignment=ft.MainAxisAlignment.START),
            )
        else:
            empty_msg = "目前沒有暫停中的療程" if self.current_tab == "paused" else "目前沒有治療中的病人"
            card_area = ft.Container(
                expand=55,
                alignment=ft.alignment.top_center,
                content=ft.Column([
                    ft.Container(height=50),
                    ft.Icon(ft.Icons.CHECK_CIRCLE, size=48, color=SELATheme.SUCCESS),
                    ft.Text(empty_msg, color=SELATheme.TEXT_SECONDARY),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
            )
        
        # 右側：詳情區（45%）
        self.detail_container = ft.Container(
            expand=45,
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            alignment=ft.alignment.top_left,
            content=ft.Column([
                ft.Container(height=100),
                ft.Icon(ft.Icons.TOUCH_APP, size=48, color=SELATheme.TEXT_HINT),
                ft.Text("點選左側病人卡片", color=SELATheme.TEXT_HINT, size=14),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
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
                    ], spacing=12, alignment=ft.MainAxisAlignment.START,
                       vertical_alignment=ft.CrossAxisAlignment.START),
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
        """建立小卡片 - 固定大小 155x90，選中藍框"""
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
        has_pending = bool(treatment.pending_interventions)
        
        # 背景色：待處理=淡粉色，其他=白色
        if has_pending and not is_selected:
            bg_color = "#FCE4EC"
        else:
            bg_color = ft.Colors.WHITE
        
        # 邊框：選中=藍色粗框
        if is_selected:
            border = ft.border.all(3, "#1976D2")
        else:
            border = ft.border.only(left=ft.BorderSide(4, left_border_color))
        
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
            width=155,  # 固定寬度
            height=90,  # 固定高度
            bgcolor=bg_color,
            border=border,
            border_radius=SELATheme.RADIUS_SM,
            padding=ft.padding.only(left=10, right=8, top=8, bottom=8),
            shadow=ft.BoxShadow(blur_radius=3, color="#00000015"),
            ink=True,
            on_click=lambda e, t=treatment: self._on_card_click(t),
            content=ft.Column([
                # 行1：病歷號 姓名
                ft.Row([
                    ft.Text(medical_id, size=11, weight=ft.FontWeight.BOLD, color=SELATheme.TEXT_PRIMARY),
                    ft.Text(name, size=11, max_lines=1, overflow=ft.TextOverflow.ELLIPSIS),
                ], spacing=6),
                # 行2：癌別 年紀
                ft.Row([
                    ft.Text(cancer, size=11, color=SELATheme.TEXT_SECONDARY),
                    ft.Container(expand=True),
                    ft.Text(age, size=11, color=SELATheme.TEXT_HINT),
                ], spacing=2),
                # 行3：體重 天數 %
                ft.Row([
                    ft.Text(current_weight, size=11, color=SELATheme.TEXT_SECONDARY),
                    ft.Container(expand=True),
                    ft.Text(days_text, size=11, color=days_color),
                    ft.Text(rate_text, size=11, color=rate_color, weight=ft.FontWeight.BOLD),
                ], spacing=6),
            ], spacing=6),
        )
    
    def _on_card_click(self, treatment):
        """點擊卡片"""
        self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _update_detail(self, treatment):
        """更新右側詳情區 - 字體放大，按鈕固定底部"""
        patient = treatment.patient
        records = self.weight_service.get_history(treatment.id)
        
        # === 病人資訊區 ===
        info_section = ft.Column([
            ft.Row([
                ft.Text(f"{patient.medical_id_display}" if patient else "", size=22, weight=ft.FontWeight.BOLD),
                ft.Text(f"{patient.name}" if patient else "", size=22, weight=ft.FontWeight.BOLD),
                ft.Text(f"（{patient.age}歲）" if patient and patient.age else "", size=16, color=SELATheme.TEXT_SECONDARY),
            ], spacing=8),
            ft.Row([
                ft.Text(f"{treatment.cancer_type_label}", size=15, color=SELATheme.TEXT_SECONDARY),
                ft.Text(f"基準 {treatment.baseline_weight:.1f} kg", size=15, color=SELATheme.TEXT_SECONDARY),
                ft.Container(expand=True),
                ft.Container(
                    bgcolor={"active": SELATheme.SUCCESS, "paused": SELATheme.WARNING}.get(treatment.status, SELATheme.TEXT_HINT),
                    border_radius=4,
                    padding=ft.padding.symmetric(horizontal=8, vertical=2),
                    content=ft.Text(treatment.status_label, size=12, color=ft.Colors.WHITE),
                ),
            ], spacing=8),
        ], spacing=4)
        
        # === 快速輸入體重 ===
        self.weight_input = ft.TextField(
            label="體重 (kg)",
            width=120,
            text_size=16,
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
                    height=44,
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
                                              bgcolor=SELATheme.WARNING, color=ft.Colors.WHITE, height=40))
            if has_nutrition:
                btns.append(ft.ElevatedButton("轉營養師", on_click=lambda e, t=treatment: self._go_intervention(t, "nutrition"),
                                              bgcolor=SELATheme.DANGER, color=ft.Colors.WHITE, height=40))
            
            intervention_section = ft.Container(
                bgcolor="#FFF3E0",
                border_radius=SELATheme.RADIUS_SM,
                padding=SELATheme.SPACE_SM,
                content=ft.Column([
                    ft.Text("⚠️ 待處理介入", size=14, weight=ft.FontWeight.BOLD, color=SELATheme.WARNING),
                    ft.Row(btns, spacing=8),
                ], spacing=6),
            )
        
        # === 體重曲線圖（點擊放大）===
        chart_section = ft.Container()
        if len(records) >= 2:
            chart_component = WeightChartComponent(treatment.baseline_weight, records)
            chart_card = chart_component.build()
            
            # 存儲到實例變數以便點擊時使用
            self._chart_treatment = treatment
            self._chart_records = records
            
            # 使用按鈕確保點擊有效
            chart_section = ft.Container(
                height=140,
                content=ft.Stack([
                    chart_card,
                    ft.Container(
                        alignment=ft.alignment.top_right,
                        padding=6,
                        content=ft.IconButton(
                            icon=ft.Icons.FULLSCREEN,
                            icon_size=22,
                            icon_color=SELATheme.PRIMARY,
                            bgcolor=ft.Colors.WHITE,
                            on_click=self._on_chart_fullscreen_click,
                            tooltip="放大檢視",
                        ),
                    ),
                ]),
            )
        
        # === 體重記錄列表（字體放大）===
        weight_items = []
        for r in records[:6]:
            measure_date = r.measure_date
            if isinstance(measure_date, str):
                measure_date = date.fromisoformat(measure_date.split('T')[0])
            date_str = measure_date.strftime("%m/%d")
            
            badge = None
            if r.alert_level == "sdm":
                badge = ft.Container(bgcolor=SELATheme.WARNING, border_radius=4,
                    padding=ft.padding.symmetric(horizontal=6, vertical=2),
                    content=ft.Text("SDM", size=11, color=ft.Colors.WHITE))
            elif r.alert_level == "nutrition":
                badge = ft.Container(bgcolor=SELATheme.DANGER, border_radius=4,
                    padding=ft.padding.symmetric(horizontal=6, vertical=2),
                    content=ft.Text("營養", size=11, color=ft.Colors.WHITE))
            
            weight_items.append(
                ft.Container(
                    padding=ft.padding.symmetric(vertical=5, horizontal=4),
                    border_radius=4,
                    ink=True,
                    on_click=lambda e, rec=r, t=treatment: self._show_weight_edit_dialog(rec, t),
                    content=ft.Row([
                        ft.Text(date_str, size=15, width=50),
                        ft.Text(f"{r.weight:.1f} kg", size=15, weight=ft.FontWeight.BOLD),
                        ft.Text(r.change_rate_display, size=14, color=SELATheme.TEXT_SECONDARY),
                        ft.Container(expand=True),
                        badge if badge else ft.Container(),
                        ft.Icon(ft.Icons.EDIT, size=16, color=SELATheme.TEXT_HINT),
                    ], spacing=10),
                )
            )
        
        records_section = ft.Column([
            ft.Text("體重記錄", size=15, weight=ft.FontWeight.BOLD),
            ft.Column(weight_items, spacing=2),
        ], spacing=6)
        
        # === 操作按鈕區（固定底部）===
        if treatment.status == "active":
            action_buttons = ft.Row([
                ft.OutlinedButton("手動介入", height=38, on_click=lambda e, t=treatment: self._show_manual_intervention_dialog(t)),
                ft.OutlinedButton("無法測量", height=38, on_click=lambda e, t=treatment: self._show_unable_dialog(t)),
                ft.Container(expand=True),
                ft.OutlinedButton("暫停", height=38, style=ft.ButtonStyle(color=SELATheme.WARNING),
                                 on_click=lambda e, t=treatment: self._show_pause_dialog(t)),
                ft.OutlinedButton("結案", height=38, style=ft.ButtonStyle(color=SELATheme.SUCCESS),
                                 on_click=lambda e, t=treatment: self._show_complete_dialog(t)),
            ], spacing=8)
        elif treatment.status == "paused":
            action_buttons = ft.Row([
                ft.ElevatedButton("恢復療程", height=40, bgcolor=SELATheme.SUCCESS, color=ft.Colors.WHITE,
                                 on_click=lambda e, t=treatment: self._on_resume(t)),
                ft.OutlinedButton("終止", height=38, style=ft.ButtonStyle(color=SELATheme.DANGER),
                                 on_click=lambda e, t=treatment: self._show_terminate_dialog(t)),
            ], spacing=8)
        else:
            action_buttons = ft.Container()
        
        # === 組合詳情內容（內容可滾動，按鈕固定底部）===
        scrollable_content = ft.Column([
            info_section,
            ft.Divider(height=12),
            weight_input_section if treatment.status == "active" else ft.Container(),
            intervention_section,
            chart_section,
            records_section,
        ], spacing=8, scroll=ft.ScrollMode.AUTO, expand=True)
        
        # 按鈕固定在底部
        detail_content = ft.Column([
            scrollable_content,
            ft.Divider(height=8),
            action_buttons,
        ], spacing=0, alignment=ft.MainAxisAlignment.START)
        
        self.detail_container.content = detail_content
    
    def _on_chart_fullscreen_click(self, e):
        """點擊放大圖表按鈕"""
        if hasattr(self, '_chart_treatment') and hasattr(self, '_chart_records'):
            self._show_chart_fullscreen(self._chart_treatment, self._chart_records)
    
    def _show_chart_fullscreen(self, treatment, records):
        """顯示全螢幕體重曲線圖"""
        chart_component = WeightChartComponent(treatment.baseline_weight, records)
        chart_card = chart_component.build(width=600, height=400)  # width/height 在 build() 傳入
        
        def on_close(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Row([
                ft.Text("體重趨勢圖", size=18, font_family=SELATheme.FONT_FAMILY),
                ft.Container(expand=True),
                ft.IconButton(icon=ft.Icons.CLOSE, on_click=on_close),
            ]),
            content=ft.Container(
                width=620,
                height=420,
                content=chart_card,
            ),
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
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
        """顯示介入對話框"""
        from app.config.constants import SKIP_REASONS
        
        # 找到對應的介入
        intervention = None
        if treatment.pending_interventions:
            for inv in treatment.pending_interventions:
                if inv.type == int_type:
                    intervention = inv
                    break
        
        if not intervention:
            self.main_view.show_snack("找不到待處理的介入")
            return
        
        # 標題
        title = "SDM" if int_type == "sdm" else "營養師轉介"
        today = date.today()
        selected_date = [today]
        
        # 日期顯示
        date_text = ft.Text(today.strftime("%Y-%m-%d"), size=14, weight=ft.FontWeight.BOLD)
        
        def show_date_picker(e):
            def on_date_change(e):
                if dp.value:
                    picked = dp.value.date() if hasattr(dp.value, 'date') else dp.value
                    selected_date[0] = picked
                    date_text.value = picked.strftime("%Y-%m-%d")
                    self.page.update()
            dp = ft.DatePicker(first_date=date(2015, 1, 1), last_date=date.today(), value=selected_date[0], on_change=on_date_change)
            self.page.open(dp)
        
        # 不執行原因
        skip_reason_dropdown = ft.Dropdown(
            label="原因",
            options=[ft.dropdown.Option(key=r["code"], text=r["label"]) for r in SKIP_REASONS],
            width=200,
            visible=False,
        )
        skip_note_field = ft.TextField(
            label="備註（選填）",
            width=200,
            visible=False,
        )
        
        skip_section = ft.Column([skip_reason_dropdown, skip_note_field], spacing=8, visible=False)
        
        def on_show_skip(e):
            skip_section.visible = True
            skip_reason_dropdown.visible = True
            skip_note_field.visible = True
            self.page.update()
        
        def on_later(e):
            """稍後提醒"""
            dialog.open = False
            self.page.update()
        
        def on_skip(e):
            """不執行"""
            if not skip_reason_dropdown.value:
                self.main_view.show_snack("請選擇原因")
                return
            
            self.intervention_service.skip(
                intervention.id, 
                skip_reason_dropdown.value,
                skip_note_field.value.strip() if skip_note_field.value else None
            )
            dialog.open = False
            self.main_view.show_snack(f"已標記為不執行")
            self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_complete(e):
            """完成介入"""
            self.intervention_service.complete(intervention.id, selected_date[0].isoformat())
            dialog.open = False
            self.main_view.show_snack(f"{title} 已完成")
            self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        # 如果是營養師轉介，加入 PDF 生成按鈕
        pdf_btn = ft.Container()
        if int_type == "nutrition":
            pdf_btn = ft.OutlinedButton(
                "生成轉介單 PDF",
                icon=ft.Icons.PICTURE_AS_PDF,
                on_click=lambda e: self._generate_pdf_from_dialog(treatment, dialog),
            )
        
        dialog = ft.AlertDialog(
            title=ft.Text(f"執行 {title}", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text(f"病人：{treatment.patient.medical_id_display} {treatment.patient.name}", 
                       size=13, color=SELATheme.TEXT_SECONDARY),
                ft.Container(height=12),
                ft.Row([
                    ft.Text("執行日期：", size=13),
                    date_text,
                    ft.IconButton(icon=ft.Icons.CALENDAR_TODAY, icon_size=18, on_click=show_date_picker),
                ]),
                ft.Container(height=8),
                pdf_btn,
                ft.Divider(),
                ft.TextButton("不執行（選擇原因）", on_click=on_show_skip),
                skip_section,
            ], tight=True, width=280),
            actions=[
                ft.TextButton("稍後提醒", on_click=on_later),
                ft.OutlinedButton("不執行", on_click=on_skip, style=ft.ButtonStyle(color=SELATheme.WARNING)),
                ft.ElevatedButton("完成", on_click=on_complete, bgcolor=SELATheme.SUCCESS, color=ft.Colors.WHITE),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _generate_pdf_from_dialog(self, treatment, parent_dialog):
        """從介入對話框生成 PDF"""
        from app.services.settings_service import SettingsService
        settings_service = SettingsService()
        
        # 取得人員列表
        staff_list = settings_service.get_staff_list()
        
        # 轉介人員
        if staff_list:
            referrer_dropdown = ft.Dropdown(
                label="轉介同仁",
                options=[ft.dropdown.Option(key=s, text=s) for s in staff_list],
                width=200,
            )
            referrer_control = referrer_dropdown
        else:
            referrer_field = ft.TextField(label="轉介同仁", hint_text="您的姓名", width=200)
            referrer_control = referrer_field
        
        phone_field = ft.TextField(label="病人連絡電話", hint_text="電話號碼", width=200)
        notes_field = ft.TextField(label="備註", hint_text="其他備註（選填）", width=280, multiline=True, min_lines=2, max_lines=3)
        
        # 轉介需求勾選
        chk_subsidy = ft.Checkbox(label="輔助諮詢", value=False)
        chk_nutrition = ft.Checkbox(label="營養諮詢", value=True)
        chk_wound = ft.Checkbox(label="傷口照護諮詢", value=False)
        chk_psychology = ft.Checkbox(label="心理支持", value=False)
        chk_rental = ft.Checkbox(label="租借（假髮、輔具）", value=False)
        chk_headwear = ft.Checkbox(label="頭巾/髮帽", value=False)
        chk_support_group = ft.Checkbox(label="病友團體", value=False)
        chk_other = ft.Checkbox(label="其他", value=False)
        other_text = ft.TextField(hint_text="其他說明", width=120, visible=False)
        
        def on_other_change(e):
            other_text.visible = chk_other.value
            self.page.update()
        chk_other.on_change = on_other_change
        
        def on_generate(e):
            try:
                from app.services.pdf_service import PDFService
                pdf_service = PDFService()
                
                referrer = referrer_dropdown.value if staff_list else referrer_field.value.strip()
                
                needs = {
                    "subsidy": chk_subsidy.value,
                    "nutrition": chk_nutrition.value,
                    "wound": chk_wound.value,
                    "psychology": chk_psychology.value,
                    "rental": chk_rental.value,
                    "headwear": chk_headwear.value,
                    "support_group": chk_support_group.value,
                    "other": chk_other.value,
                    "other_text": other_text.value.strip() if chk_other.value else "",
                }
                
                filepath = pdf_service.generate_nutrition_referral(
                    patient=treatment.patient,
                    treatment=treatment,
                    referrer=referrer or "",
                    phone=phone_field.value.strip(),
                    notes=notes_field.value.strip(),
                    needs=needs,
                )
                
                pdf_dialog.open = False
                self.page.update()
                
                import os, subprocess, platform
                if platform.system() == "Windows":
                    os.startfile(filepath)
                elif platform.system() == "Darwin":
                    subprocess.run(["open", filepath])
                else:
                    subprocess.run(["xdg-open", filepath])
                
                self.main_view.show_snack(f"已生成轉介單")
            except Exception as ex:
                self.main_view.show_snack(f"生成失敗：{str(ex)}")
        
        def on_cancel(e):
            pdf_dialog.open = False
            self.page.update()
        
        pdf_dialog = ft.AlertDialog(
            title=ft.Text("生成營養轉介單", font_family=SELATheme.FONT_FAMILY),
            content=ft.Container(
                width=320,
                height=380,
                content=ft.Column([
                    referrer_control,
                    phone_field,
                    ft.Divider(),
                    ft.Text("轉介需求", size=12, weight=ft.FontWeight.BOLD),
                    chk_subsidy, chk_nutrition, chk_wound, chk_psychology,
                    chk_rental, chk_headwear, chk_support_group,
                    ft.Row([chk_other, other_text], spacing=4),
                    ft.Divider(),
                    notes_field,
                ], spacing=4, scroll=ft.ScrollMode.AUTO),
            ),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("生成 PDF", on_click=on_generate, bgcolor=SELATheme.PRIMARY, color=ft.Colors.WHITE),
            ],
        )
        
        self.page.overlay.append(pdf_dialog)
        pdf_dialog.open = True
        self.page.update()
    
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
