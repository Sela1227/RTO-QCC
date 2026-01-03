"""療程詳情頁"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.config.constants import PAUSE_REASONS, TERMINATE_REASONS, SKIP_REASONS
from app.services.treatment_service import TreatmentService
from app.services.weight_service import WeightService
from app.services.intervention_service import InterventionService


class TreatmentView:
    """療程詳情頁"""
    
    def __init__(self, page: ft.Page, main_view, treatment_id: int):
        self.page = page
        self.main_view = main_view
        self.treatment_id = treatment_id
        self.treatment_service = TreatmentService()
        self.weight_service = WeightService()
        self.intervention_service = InterventionService()
        self.treatment = None
    
    def build(self) -> ft.Control:
        """建立療程詳情 UI"""
        self.treatment = self.treatment_service.get_with_details(self.treatment_id)
        
        if not self.treatment:
            return ft.Container(
                expand=True,
                content=ft.Text("療程不存在"),
            )
        
        # 取得體重歷史
        weight_records = self.weight_service.get_history(self.treatment_id)
        
        # 計算追蹤狀態
        days_since = 0
        if self.treatment.last_weight:
            last_date = self.treatment.last_weight.measure_date
            if isinstance(last_date, str):
                last_date = date.fromisoformat(last_date.split('T')[0])
            elif hasattr(last_date, 'date'):
                last_date = last_date.date()
            days_since = (date.today() - last_date).days
        
        # 狀態標籤
        status_color = {
            "active": SELATheme.SUCCESS,
            "paused": SELATheme.WARNING,
            "terminated": SELATheme.DANGER,
            "completed": SELATheme.TEXT_HINT,
        }.get(self.treatment.status, SELATheme.TEXT_HINT)
        
        # 警示橫幅
        alert_banner = None
        if self.treatment.status == "active":
            if days_since > 7:
                alert_banner = self._build_alert_banner(
                    f"🔴 此病人已 {days_since} 天未量測體重",
                    SELATheme.DANGER,
                )
            elif self.treatment.pending_interventions:
                pending_types = [i.type_label for i in self.treatment.pending_interventions]
                alert_banner = self._build_intervention_banner(pending_types)
        
        # 體重資訊卡
        weight_card = self._build_weight_card()
        
        # 體重趨勢圖（簡化版，用文字表示）
        chart_card = self._build_chart_placeholder(weight_records)
        
        # 體重記錄列表
        records_list = self._build_records_list(weight_records[:10])
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                # 標題列
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    padding=ft.padding.symmetric(horizontal=8, vertical=8),
                    content=ft.Row([
                        ft.IconButton(
                            icon=ft.Icons.ARROW_BACK,
                            on_click=lambda e: self.main_view.navigate_to(1),
                        ),
                        ft.Container(expand=True),
                        ft.PopupMenuButton(
                            icon=ft.Icons.MORE_VERT,
                            items=self._build_menu_items(),
                        ),
                    ]),
                ),
                # 內容區
                ft.Container(
                    expand=True,
                    padding=SELATheme.SPACE_MD,
                    content=ft.Column([
                        # 病人資訊
                        ft.Row([
                            ft.Text(
                                self.treatment.patient.medical_id if self.treatment.patient else "",
                                size=16,
                                weight=ft.FontWeight.BOLD,
                                font_family=SELATheme.FONT_FAMILY,
                            ),
                            ft.Text(
                                self.treatment.patient.name if self.treatment.patient else "",
                                size=16,
                                font_family=SELATheme.FONT_FAMILY,
                            ),
                            ft.Text(
                                self.treatment.patient.gender_label if self.treatment.patient else "",
                                size=14,
                                color=SELATheme.TEXT_SECONDARY,
                            ),
                            ft.Container(expand=True),
                            ft.Container(
                                bgcolor=status_color,
                                border_radius=4,
                                padding=ft.padding.symmetric(horizontal=8, vertical=4),
                                content=ft.Text(
                                    self.treatment.status_label,
                                    size=12,
                                    color=ft.Colors.WHITE,
                                ),
                            ),
                        ]),
                        ft.Container(height=8),
                        # 警示橫幅
                        alert_banner if alert_banner else ft.Container(),
                        ft.Container(height=8) if alert_banner else ft.Container(),
                        # 體重卡片
                        weight_card,
                        ft.Container(height=12),
                        # 趨勢圖
                        chart_card,
                        ft.Container(height=12),
                        # 記錄列表標題
                        ft.Text(
                            "體重記錄",
                            size=14,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Container(height=8),
                        # 記錄列表
                        records_list,
                    ], scroll=ft.ScrollMode.AUTO, expand=True),
                ),
                # 底部按鈕
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    padding=SELATheme.SPACE_MD,
                    content=ft.ElevatedButton(
                        "+ 新增體重",
                        width=200,
                        height=48,
                        bgcolor=SELATheme.PRIMARY,
                        color=ft.Colors.WHITE,
                        on_click=lambda e: self.main_view.show_weight_form(self.treatment_id),
                    ),
                ) if self.treatment.status == "active" else ft.Container(),
            ], spacing=0, expand=True),
        )
    
    def _build_weight_card(self) -> ft.Control:
        """建立體重資訊卡"""
        baseline = self.treatment.baseline_weight
        current = self.treatment.current_weight or baseline
        change_rate = self.treatment.current_change_rate or 0
        
        # 變化率顏色
        rate_color = SELATheme.SUCCESS
        if change_rate >= 5:
            rate_color = SELATheme.DANGER
        elif change_rate >= 3:
            rate_color = SELATheme.WARNING
        
        # 變化率顯示
        rate_text = "基準"
        if change_rate != 0:
            sign = "-" if change_rate > 0 else "+"
            rate_text = f"{sign}{abs(change_rate):.1f}%"
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Row([
                    ft.Text(
                        self.treatment.cancer_type_label,
                        size=14,
                        weight=ft.FontWeight.BOLD,
                        font_family=SELATheme.FONT_FAMILY,
                    ),
                    ft.Container(expand=True),
                    ft.Text(
                        f"{self.treatment.treatment_start} 開始" if self.treatment.treatment_start else "",
                        size=12,
                        color=SELATheme.TEXT_SECONDARY,
                    ),
                ]),
                ft.Container(height=16),
                ft.Row([
                    ft.Column([
                        ft.Text(f"{baseline:.1f}", size=24, weight=ft.FontWeight.BOLD),
                        ft.Text("基準", size=12, color=SELATheme.TEXT_SECONDARY),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Text("→", size=20, color=SELATheme.TEXT_HINT),
                    ft.Column([
                        ft.Text(f"{current:.1f}", size=24, weight=ft.FontWeight.BOLD),
                        ft.Text("目前", size=12, color=SELATheme.TEXT_SECONDARY),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Container(expand=True),
                    ft.Column([
                        ft.Text(rate_text, size=24, weight=ft.FontWeight.BOLD, color=rate_color),
                        ft.Text("變化", size=12, color=SELATheme.TEXT_SECONDARY),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                ], alignment=ft.MainAxisAlignment.SPACE_AROUND),
            ]),
        )
    
    def _build_chart_placeholder(self, records) -> ft.Control:
        """建立趨勢圖（簡化版）"""
        if len(records) < 2:
            return ft.Container(
                bgcolor=SELATheme.SURFACE,
                border_radius=SELATheme.RADIUS_MD,
                padding=SELATheme.SPACE_MD,
                height=100,
                content=ft.Column([
                    ft.Text("📈 體重趨勢", size=12, color=SELATheme.TEXT_SECONDARY),
                    ft.Container(expand=True),
                    ft.Text("資料不足，需要至少 2 筆記錄", size=12, color=SELATheme.TEXT_HINT),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
            )
        
        # 簡化的趨勢顯示
        weights = [r.weight for r in reversed(records[:7])]
        baseline = self.treatment.baseline_weight
        sdm_line = baseline * 0.97
        nutrition_line = baseline * 0.95
        
        # 建立簡單的條形圖
        bars = []
        max_w = max(weights + [baseline])
        min_w = min(weights + [nutrition_line]) - 1
        range_w = max_w - min_w
        
        for i, w in enumerate(weights):
            height = ((w - min_w) / range_w) * 60 if range_w > 0 else 30
            color = SELATheme.SUCCESS
            if w <= nutrition_line:
                color = SELATheme.DANGER
            elif w <= sdm_line:
                color = SELATheme.WARNING
            
            bars.append(
                ft.Container(
                    width=20,
                    height=height,
                    bgcolor=color,
                    border_radius=4,
                    tooltip=f"{w:.1f} kg",
                )
            )
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Text("📈 體重趨勢（最近 7 筆）", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Container(height=8),
                ft.Row(
                    bars,
                    alignment=ft.MainAxisAlignment.SPACE_AROUND,
                    vertical_alignment=ft.CrossAxisAlignment.END,
                ),
                ft.Container(height=4),
                ft.Row([
                    ft.Container(width=10, height=10, bgcolor=SELATheme.SUCCESS, border_radius=2),
                    ft.Text("正常", size=10),
                    ft.Container(width=10, height=10, bgcolor=SELATheme.WARNING, border_radius=2),
                    ft.Text("<3%", size=10),
                    ft.Container(width=10, height=10, bgcolor=SELATheme.DANGER, border_radius=2),
                    ft.Text("<5%", size=10),
                ], spacing=8),
            ]),
        )
    
    def _build_records_list(self, records) -> ft.Control:
        """建立體重記錄列表"""
        if not records:
            return ft.Container(
                padding=SELATheme.SPACE_MD,
                content=ft.Text("尚無體重記錄", color=SELATheme.TEXT_HINT),
            )
        
        items = []
        for r in records:
            # 日期
            measure_date = r.measure_date
            if isinstance(measure_date, str):
                measure_date = date.fromisoformat(measure_date.split('T')[0])
            elif hasattr(measure_date, 'date'):
                measure_date = measure_date.date()
            date_str = measure_date.strftime("%m/%d")
            
            # 警示標籤
            alert_badge = None
            if r.alert_level == "sdm":
                alert_badge = ft.Container(
                    bgcolor=SELATheme.WARNING,
                    border_radius=4,
                    padding=ft.padding.symmetric(horizontal=4, vertical=2),
                    content=ft.Text("SDM", size=10, color=ft.Colors.WHITE),
                )
            elif r.alert_level == "nutrition":
                alert_badge = ft.Container(
                    bgcolor=SELATheme.DANGER,
                    border_radius=4,
                    padding=ft.padding.symmetric(horizontal=4, vertical=2),
                    content=ft.Text("營養", size=10, color=ft.Colors.WHITE),
                )
            
            items.append(
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    border_radius=SELATheme.RADIUS_SM,
                    padding=ft.padding.symmetric(horizontal=12, vertical=8),
                    margin=ft.margin.only(bottom=4),
                    content=ft.Row([
                        ft.Text(date_str, size=13, width=50),
                        ft.Text(f"{r.weight:.1f} kg", size=13, weight=ft.FontWeight.BOLD),
                        ft.Text(
                            r.change_rate_display,
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                        ft.Container(expand=True),
                        alert_badge if alert_badge else ft.Container(),
                    ]),
                )
            )
        
        return ft.Column(items, spacing=0)
    
    def _build_alert_banner(self, text: str, color: str) -> ft.Control:
        """建立警示橫幅"""
        return ft.Container(
            bgcolor=color,
            border_radius=SELATheme.RADIUS_SM,
            padding=ft.padding.symmetric(horizontal=12, vertical=8),
            content=ft.Row([
                ft.Text(text, size=13, color=ft.Colors.WHITE),
                ft.Container(expand=True),
                ft.TextButton(
                    "立即量測",
                    style=ft.ButtonStyle(color=ft.Colors.WHITE),
                    on_click=lambda e: self.main_view.show_weight_form(self.treatment_id),
                ),
            ]),
        )
    
    def _build_intervention_banner(self, types: list) -> ft.Control:
        """建立介入提醒橫幅"""
        return ft.Container(
            bgcolor=SELATheme.WARNING,
            border_radius=SELATheme.RADIUS_SM,
            padding=ft.padding.symmetric(horizontal=12, vertical=8),
            content=ft.Row([
                ft.Text(f"🟠 需執行：{', '.join(types)}", size=13, color=ft.Colors.WHITE),
                ft.Container(expand=True),
                ft.TextButton(
                    "完成",
                    style=ft.ButtonStyle(color=ft.Colors.WHITE),
                    on_click=self._on_complete_intervention,
                ),
                ft.TextButton(
                    "略過",
                    style=ft.ButtonStyle(color=ft.Colors.WHITE),
                    on_click=self._on_skip_intervention,
                ),
            ]),
        )
    
    def _build_menu_items(self) -> list:
        """建立更多選單"""
        items = []
        
        if self.treatment.status == "active":
            items.extend([
                ft.PopupMenuItem(
                    text="暫停療程",
                    icon=ft.Icons.PAUSE,
                    on_click=self._on_pause,
                ),
                ft.PopupMenuItem(
                    text="終止療程",
                    icon=ft.Icons.CANCEL,
                    on_click=self._on_terminate,
                ),
                ft.PopupMenuItem(
                    text="療程結案",
                    icon=ft.Icons.CHECK_CIRCLE,
                    on_click=self._on_complete,
                ),
            ])
        elif self.treatment.status == "paused":
            items.append(
                ft.PopupMenuItem(
                    text="恢復療程",
                    icon=ft.Icons.PLAY_ARROW,
                    on_click=self._on_resume,
                ),
            )
        
        return items
    
    def _on_complete_intervention(self, e):
        """完成介入"""
        if self.treatment.pending_interventions:
            for intervention in self.treatment.pending_interventions:
                self.intervention_service.mark_completed(intervention.id)
            self.main_view.show_snack("已標記完成")
            self.main_view.show_treatment(self.treatment_id)
    
    def _on_skip_intervention(self, e):
        """略過介入"""
        self._show_skip_dialog()
    
    def _show_skip_dialog(self):
        """顯示略過原因對話框"""
        reason_dropdown = ft.Dropdown(
            label="略過原因",
            options=[
                ft.dropdown.Option(key=r["code"], text=r["label"])
                for r in SKIP_REASONS
            ],
            width=300,
        )
        
        def on_confirm(e):
            if reason_dropdown.value and self.treatment.pending_interventions:
                for intervention in self.treatment.pending_interventions:
                    self.intervention_service.mark_skipped(intervention.id, reason_dropdown.value)
                dialog.open = False
                self.main_view.show_snack("已略過")
                self.main_view.show_treatment(self.treatment_id)
                self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("略過介入", font_family=SELATheme.FONT_FAMILY),
            content=reason_dropdown,
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("確定", on_click=on_confirm),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _on_pause(self, e):
        """暫停療程"""
        self._show_status_dialog("暫停療程", PAUSE_REASONS, "paused")
    
    def _on_terminate(self, e):
        """終止療程"""
        self._show_status_dialog("終止療程", TERMINATE_REASONS, "terminated")
    
    def _on_complete(self, e):
        """結案療程"""
        def on_confirm(e):
            from app.repositories.treatment_repository import TreatmentRepository
            repo = TreatmentRepository()
            repo.update_status(self.treatment_id, "completed", "TREATMENT_END")
            dialog.open = False
            self.main_view.show_snack("療程已結案")
            self.main_view.navigate_to(1)
            self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("確認結案", font_family=SELATheme.FONT_FAMILY),
            content=ft.Text("確定要將此療程結案嗎？"),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("確定結案", on_click=on_confirm),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _on_resume(self, e):
        """恢復療程"""
        from app.repositories.treatment_repository import TreatmentRepository
        repo = TreatmentRepository()
        repo.update_status(self.treatment_id, "active")
        self.main_view.show_snack("療程已恢復")
        self.main_view.show_treatment(self.treatment_id)
    
    def _show_status_dialog(self, title: str, reasons: list, new_status: str):
        """顯示狀態變更對話框"""
        reason_dropdown = ft.Dropdown(
            label="原因",
            options=[
                ft.dropdown.Option(key=r["code"], text=r["label"])
                for r in reasons
            ],
            width=300,
        )
        
        def on_confirm(e):
            if reason_dropdown.value:
                from app.repositories.treatment_repository import TreatmentRepository
                repo = TreatmentRepository()
                repo.update_status(self.treatment_id, new_status, reason_dropdown.value)
                dialog.open = False
                self.main_view.show_snack(f"療程已{title[:2]}")
                self.main_view.navigate_to(1)
                self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text(title, font_family=SELATheme.FONT_FAMILY),
            content=reason_dropdown,
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("確定", on_click=on_confirm),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
