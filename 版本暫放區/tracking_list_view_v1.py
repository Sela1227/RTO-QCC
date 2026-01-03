"""追蹤清單頁"""
import flet as ft
from app.config.theme import SELATheme
from app.services.tracking_service import TrackingService


class TrackingListView:
    """追蹤清單"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.tracking_service = TrackingService()
        self.current_filter = "all"
    
    def build(self) -> ft.Control:
        """建立追蹤清單 UI"""
        treatments = self.tracking_service.get_tracking_list("active")
        
        # 統計
        total = len(treatments)
        overdue = sum(1 for t in treatments if t.tracking_status == "overdue")
        pending = sum(1 for t in treatments if t.tracking_status == "pending")
        has_intervention = sum(1 for t in treatments if t.pending_interventions)
        
        # 篩選按鈕
        filter_row = ft.Row([
            self._build_filter_chip("all", f"全部 ({total})", self.current_filter == "all"),
            self._build_filter_chip("pending", f"待量 ({pending})", self.current_filter == "pending"),
            self._build_filter_chip("overdue", f"逾期 ({overdue})", self.current_filter == "overdue"),
            self._build_filter_chip("intervention", f"待介入 ({has_intervention})", self.current_filter == "intervention"),
        ], spacing=8, scroll=ft.ScrollMode.AUTO)
        
        # 依篩選過濾
        if self.current_filter == "pending":
            treatments = [t for t in treatments if t.tracking_status == "pending"]
        elif self.current_filter == "overdue":
            treatments = [t for t in treatments if t.tracking_status == "overdue"]
        elif self.current_filter == "intervention":
            treatments = [t for t in treatments if t.pending_interventions]
        
        # 清單
        if treatments:
            list_items = [self._build_item(t) for t in treatments]
            content = ft.ListView(
                controls=list_items,
                spacing=8,
                expand=True,
            )
        else:
            content = ft.Container(
                expand=True,
                content=ft.Column([
                    ft.Icon(ft.Icons.CHECK_CIRCLE, size=64, color=SELATheme.SUCCESS),
                    ft.Container(height=16),
                    ft.Text(
                        "目前沒有符合條件的病人" if self.current_filter != "all" else "目前沒有追蹤中的病人",
                        color=SELATheme.TEXT_SECONDARY,
                        font_family=SELATheme.FONT_FAMILY,
                    ),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                   alignment=ft.MainAxisAlignment.CENTER),
            )
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                # 標題
                ft.Text(
                    f"追蹤中 ({total})",
                    size=18,
                    weight=ft.FontWeight.BOLD,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=12),
                # 篩選
                filter_row,
                ft.Container(height=12),
                # 清單
                content,
            ], expand=True),
        )
    
    def _build_filter_chip(self, code: str, label: str, selected: bool) -> ft.Control:
        """建立篩選標籤"""
        return ft.Container(
            bgcolor=SELATheme.PRIMARY if selected else SELATheme.SURFACE,
            border_radius=20,
            padding=ft.padding.symmetric(horizontal=12, vertical=6),
            ink=True,
            on_click=lambda e, c=code: self._on_filter_change(c),
            content=ft.Text(
                label,
                size=12,
                color=ft.Colors.WHITE if selected else SELATheme.TEXT_PRIMARY,
            ),
        )
    
    def _on_filter_change(self, code: str):
        """篩選變更"""
        self.current_filter = code
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _build_item(self, treatment) -> ft.Control:
        """建立清單項目"""
        # 狀態圖示
        status_icon = {
            "normal": "🟢",
            "pending": "🟡",
            "overdue": "🔴",
        }.get(treatment.tracking_status, "⚪")
        
        # 警示標籤
        badges = []
        if treatment.last_weight and treatment.last_weight.alert_level == "sdm":
            badges.append(
                ft.Container(
                    bgcolor=SELATheme.WARNING,
                    border_radius=4,
                    padding=ft.padding.symmetric(horizontal=6, vertical=2),
                    content=ft.Text("SDM", size=10, color=ft.Colors.WHITE),
                )
            )
        elif treatment.last_weight and treatment.last_weight.alert_level == "nutrition":
            badges.append(
                ft.Container(
                    bgcolor=SELATheme.DANGER,
                    border_radius=4,
                    padding=ft.padding.symmetric(horizontal=6, vertical=2),
                    content=ft.Text("營養", size=10, color=ft.Colors.WHITE),
                )
            )
        
        if treatment.pending_interventions:
            badges.append(
                ft.Container(
                    bgcolor=SELATheme.INFO,
                    border_radius=4,
                    padding=ft.padding.symmetric(horizontal=6, vertical=2),
                    content=ft.Text("待處理", size=10, color=ft.Colors.WHITE),
                )
            )
        
        # 天數顯示
        days_text = "今天"
        if treatment.days_since_last == 1:
            days_text = "昨天"
        elif treatment.days_since_last and treatment.days_since_last > 1:
            days_text = f"{treatment.days_since_last} 天前"
        
        # 變化率
        rate_text = ""
        if treatment.last_weight:
            rate_text = treatment.last_weight.change_rate_display
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_SM,
            padding=SELATheme.SPACE_MD,
            ink=True,
            on_click=lambda e, t=treatment: self._on_item_click(t),
            content=ft.Row([
                ft.Text(status_icon, size=16),
                ft.Container(width=8),
                ft.Column([
                    ft.Row([
                        ft.Text(
                            treatment.patient.medical_id if treatment.patient else "",
                            weight=ft.FontWeight.BOLD,
                            size=14,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Text(
                            treatment.patient.name if treatment.patient else "",
                            size=14,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                    ], spacing=8),
                    ft.Row([
                        ft.Text(
                            treatment.cancer_type_label,
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                        ft.Text(
                            rate_text,
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                        *badges,
                    ], spacing=8),
                ], spacing=4, expand=True),
                ft.Text(
                    days_text,
                    size=12,
                    color=SELATheme.TEXT_HINT,
                ),
                ft.Icon(ft.Icons.CHEVRON_RIGHT, color=SELATheme.TEXT_HINT),
            ]),
        )
    
    def _on_item_click(self, treatment):
        """點擊項目"""
        self.main_view.show_treatment(treatment.id)
