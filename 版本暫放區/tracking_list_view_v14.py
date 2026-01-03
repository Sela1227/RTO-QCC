"""追蹤清單頁"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.services.tracking_service import TrackingService
from app.services.weight_service import WeightService
from app.services.treatment_service import TreatmentService


class TrackingListView:
    """追蹤清單 - 主從視圖"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.tracking_service = TrackingService()
        self.weight_service = WeightService()
        self.treatment_service = TreatmentService()
        self.current_filter = "all"
        self.current_tab = "active"
        self.selected_treatment = None
        self.detail_container = None
    
    def build(self) -> ft.Control:
        """建立主從視圖 UI"""
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
            total = len(treatments)
            filter_row = ft.Container()
        
        # 頁籤
        tabs = ft.Row([
            ft.Container(
                padding=ft.padding.symmetric(horizontal=16, vertical=8),
                border=ft.border.only(bottom=ft.BorderSide(2, SELATheme.PRIMARY if self.current_tab == "active" else "transparent")),
                ink=True,
                on_click=lambda e: self._switch_tab("active"),
                content=ft.Text("治療中", color=SELATheme.PRIMARY if self.current_tab == "active" else SELATheme.TEXT_SECONDARY),
            ),
            ft.Container(
                padding=ft.padding.symmetric(horizontal=16, vertical=8),
                border=ft.border.only(bottom=ft.BorderSide(2, SELATheme.PRIMARY if self.current_tab == "paused" else "transparent")),
                ink=True,
                on_click=lambda e: self._switch_tab("paused"),
                content=ft.Row([
                    ft.Text("暫停中", color=SELATheme.PRIMARY if self.current_tab == "paused" else SELATheme.TEXT_SECONDARY),
                    ft.Container(
                        bgcolor=SELATheme.TEXT_HINT,
                        border_radius=10,
                        padding=ft.padding.symmetric(horizontal=6, vertical=2),
                        content=ft.Text(str(paused_count), size=10, color=ft.Colors.WHITE),
                    ) if paused_count > 0 else ft.Container(),
                ], spacing=4),
            ),
        ])
        
        # 小卡片列表
        if treatments:
            cards = [self._build_card(t) for t in treatments]
            card_grid = ft.Container(
                width=480,
                content=ft.Column([
                    ft.Row(controls=cards, wrap=True, spacing=8, run_spacing=8),
                ], scroll=ft.ScrollMode.AUTO),
            )
        else:
            empty_msg = "目前沒有暫停中的療程" if self.current_tab == "paused" else "目前沒有治療中的病人"
            card_grid = ft.Container(
                width=480,
                content=ft.Column([
                    ft.Icon(ft.Icons.CHECK_CIRCLE, size=48, color=SELATheme.SUCCESS),
                    ft.Text(empty_msg, color=SELATheme.TEXT_SECONDARY),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                   alignment=ft.MainAxisAlignment.CENTER),
            )
        
        # 右側詳情區
        self.detail_container = ft.Container(
            expand=True,
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Icon(ft.Icons.TOUCH_APP, size=48, color=SELATheme.TEXT_HINT),
                ft.Text("點選左側病人卡片", color=SELATheme.TEXT_HINT),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
               alignment=ft.MainAxisAlignment.CENTER),
        )
        
        # 如果有預選，顯示詳情
        if self.selected_treatment:
            self._update_detail(self.selected_treatment)
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                # 標題列
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    padding=ft.padding.symmetric(horizontal=16, vertical=8),
                    content=ft.Column([tabs, filter_row if self.current_tab == "active" else ft.Container()], spacing=8),
                ),
                # 主內容：左側卡片 + 右側詳情
                ft.Container(
                    expand=True,
                    padding=SELATheme.SPACE_MD,
                    content=ft.Row([
                        card_grid,
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
        """建立小卡片：病歷號/姓名/年紀、癌別、現體重、幾天、%"""
        # 邊框顏色
        if treatment.status == "paused":
            border_color = SELATheme.TEXT_HINT
        elif treatment.unable_to_measure:
            border_color = SELATheme.TEXT_HINT
        else:
            border_color = {
                "normal": SELATheme.SUCCESS,
                "pending": SELATheme.WARNING,
                "overdue": SELATheme.DANGER,
            }.get(treatment.tracking_status, SELATheme.TEXT_HINT)
        
        # 是否選中
        is_selected = self.selected_treatment and self.selected_treatment.id == treatment.id
        
        # 資料
        patient = treatment.patient
        medical_id = patient.medical_id_display[-4:] if patient else ""
        name = patient.name if patient else ""
        age = f"{patient.age}y" if patient and patient.age else ""
        cancer = treatment.cancer_type_label[:2] if treatment.cancer_type_label else ""
        
        # 現體重
        current_weight = f"{treatment.current_weight:.1f}" if treatment.current_weight else "-"
        
        # 幾天
        if treatment.unable_to_measure:
            days_text = "無法量"
            days_color = SELATheme.TEXT_HINT
        elif treatment.days_since_last == 0:
            days_text = "今天"
            days_color = SELATheme.SUCCESS
        elif treatment.days_since_last:
            days_text = f"{treatment.days_since_last}天"
            days_color = SELATheme.DANGER if treatment.days_since_last >= 7 else (
                SELATheme.WARNING if treatment.days_since_last >= 5 else SELATheme.TEXT_SECONDARY
            )
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
            width=110,
            height=95,
            bgcolor=SELATheme.PRIMARY + "20" if is_selected else SELATheme.SURFACE,
            border=ft.border.all(2, SELATheme.PRIMARY if is_selected else border_color),
            border_radius=SELATheme.RADIUS_SM,
            padding=ft.padding.all(6),
            ink=True,
            on_click=lambda e, t=treatment: self._on_card_click(t),
            content=ft.Column([
                # 行1：病歷號 姓名 年紀
                ft.Row([
                    ft.Text(medical_id, size=10, weight=ft.FontWeight.BOLD),
                    ft.Text(name, size=10, max_lines=1, overflow=ft.TextOverflow.ELLIPSIS, expand=True),
                    ft.Text(age, size=9, color=SELATheme.TEXT_HINT),
                ], spacing=2),
                # 行2：癌別
                ft.Text(cancer, size=10, color=SELATheme.TEXT_SECONDARY),
                # 行3：體重 | 天數 | %
                ft.Row([
                    ft.Text(f"{current_weight}kg", size=10),
                    ft.Container(expand=True),
                    ft.Text(days_text, size=10, color=days_color),
                    ft.Text(rate_text, size=10, color=rate_color, weight=ft.FontWeight.BOLD),
                ], spacing=4),
            ], spacing=4),
        )
    
    def _on_card_click(self, treatment):
        """點擊卡片，更新右側詳情"""
        self.selected_treatment = treatment
        self._update_detail(treatment)
        # 重新建構以更新選中狀態
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _update_detail(self, treatment):
        """更新右側詳情區"""
        patient = treatment.patient
        
        # 體重記錄
        records = self.weight_service.get_history(treatment.id)
        
        # 建立體重記錄列表
        weight_items = []
        for r in records[:10]:  # 最近10筆
            measure_date = r.measure_date
            if isinstance(measure_date, str):
                measure_date = date.fromisoformat(measure_date.split('T')[0])
            date_str = measure_date.strftime("%m/%d")
            
            badge = None
            if r.alert_level == "sdm":
                badge = ft.Container(
                    bgcolor=SELATheme.WARNING, border_radius=4,
                    padding=ft.padding.symmetric(horizontal=4, vertical=1),
                    content=ft.Text("SDM", size=9, color=ft.Colors.WHITE),
                )
            elif r.alert_level == "nutrition":
                badge = ft.Container(
                    bgcolor=SELATheme.DANGER, border_radius=4,
                    padding=ft.padding.symmetric(horizontal=4, vertical=1),
                    content=ft.Text("營養", size=9, color=ft.Colors.WHITE),
                )
            
            weight_items.append(
                ft.Container(
                    padding=ft.padding.symmetric(vertical=4),
                    content=ft.Row([
                        ft.Text(date_str, size=12, width=45),
                        ft.Text(f"{r.weight:.1f} kg", size=12, weight=ft.FontWeight.BOLD),
                        ft.Text(r.change_rate_display, size=11, color=SELATheme.TEXT_SECONDARY),
                        ft.Container(expand=True),
                        badge if badge else ft.Container(),
                    ], spacing=8),
                )
            )
        
        # 待處理介入
        intervention_section = ft.Container()
        if treatment.pending_interventions:
            intervention_section = ft.Container(
                bgcolor=SELATheme.WARNING + "20",
                border_radius=SELATheme.RADIUS_SM,
                padding=SELATheme.SPACE_SM,
                margin=ft.margin.only(bottom=12),
                content=ft.Column([
                    ft.Text("⚠️ 待處理介入", size=12, weight=ft.FontWeight.BOLD, color=SELATheme.WARNING),
                    ft.Row([
                        ft.ElevatedButton(
                            "執行 SDM" if any(i.type == "sdm" for i in treatment.pending_interventions) else "轉營養師",
                            on_click=lambda e, t=treatment: self._go_intervention(t),
                            bgcolor=SELATheme.WARNING,
                            color=ft.Colors.WHITE,
                        ),
                    ]),
                ], spacing=4),
            )
        
        # 體重輸入區
        self.weight_input = ft.TextField(
            label="體重 (kg)",
            width=100,
            text_size=14,
            keyboard_type=ft.KeyboardType.NUMBER,
            text_align=ft.TextAlign.CENTER,
        )
        
        detail_content = ft.Column([
            # 病人資訊
            ft.Row([
                ft.Text(
                    f"{patient.medical_id_display}" if patient else "",
                    size=16, weight=ft.FontWeight.BOLD,
                ),
                ft.Text(
                    f"{patient.name}" if patient else "",
                    size=16, weight=ft.FontWeight.BOLD,
                ),
                ft.Text(
                    f"（{patient.age}歲）" if patient and patient.age else "",
                    size=14, color=SELATheme.TEXT_SECONDARY,
                ),
                ft.Container(expand=True),
                ft.TextButton(
                    "完整頁面",
                    on_click=lambda e, t=treatment: self.main_view.show_treatment(t.id),
                ),
            ]),
            ft.Text(
                f"{treatment.cancer_type_label} | 基準 {treatment.baseline_weight:.1f} kg",
                size=12, color=SELATheme.TEXT_SECONDARY,
            ),
            ft.Divider(height=16),
            
            # 快速輸入體重
            ft.Row([
                self.weight_input,
                ft.ElevatedButton(
                    "記錄體重",
                    on_click=lambda e, t=treatment: self._quick_add_weight(t),
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                ),
            ], spacing=12),
            ft.Container(height=8),
            
            # 待處理介入
            intervention_section,
            
            # 體重記錄
            ft.Text("體重記錄", size=13, weight=ft.FontWeight.BOLD),
            ft.Container(
                expand=True,
                content=ft.Column(weight_items, spacing=0, scroll=ft.ScrollMode.AUTO),
            ),
        ], spacing=8)
        
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
            
            # 刷新
            self.selected_treatment = self.treatment_service.get_with_details(treatment.id)
            self.main_view.content_area.content = self.build()
            self.page.update()
            
        except ValueError:
            self.main_view.show_snack("請輸入正確的體重")
    
    def _go_intervention(self, treatment):
        """前往介入頁"""
        self.main_view.show_intervention_detail(treatment.id)
