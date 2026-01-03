"""首頁"""
import flet as ft
from app.config.theme import SELATheme
from app.services.tracking_service import TrackingService
from app.services.patient_service import PatientService


class HomeView:
    """首頁"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.tracking_service = TrackingService()
        self.patient_service = PatientService()
    
    def build(self) -> ft.Control:
        """建立首頁 UI"""
        summary = self.tracking_service.get_dashboard_summary()
        
        # 搜尋框
        self.search_field = ft.TextField(
            hint_text="輸入或掃描病歷號",
            prefix_icon=ft.Icons.SEARCH,
            border_radius=SELATheme.RADIUS_SM,
            height=48,
            text_size=14,
            on_submit=self._on_search,
            autofocus=True,
        )
        
        # 統計卡片
        cards = ft.Row([
            self._build_stat_card("🔴", "逾期", summary["overdue_count"], SELATheme.DANGER),
            self._build_stat_card("🟡", "待量測", summary["pending_count"], SELATheme.WARNING),
        ], alignment=ft.MainAxisAlignment.CENTER, spacing=16)
        
        cards2 = ft.Row([
            self._build_stat_card("🟠", "待 SDM", summary["sdm_pending"], SELATheme.WARNING),
            self._build_stat_card("🔴", "待轉營養", summary["nutrition_pending"], SELATheme.DANGER),
        ], alignment=ft.MainAxisAlignment.CENTER, spacing=16)
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            padding=SELATheme.SPACE_LG,
            content=ft.Column([
                ft.Container(height=30),
                # LOGO
                ft.Text(
                    "SELA",
                    size=36,
                    weight=ft.FontWeight.BOLD,
                    color=SELATheme.PRIMARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Text(
                    "放射腫瘤體重追蹤系統",
                    size=16,
                    color=SELATheme.TEXT_SECONDARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=32),
                # 搜尋框
                ft.Container(
                    width=400,
                    content=self.search_field,
                ),
                ft.Container(height=8),
                # 搜尋提示
                ft.Text(
                    "輸入病歷號後按 Enter，或使用 Barcode 掃描",
                    size=11,
                    color=SELATheme.TEXT_HINT,
                ),
                ft.Container(height=40),
                # 統計卡片
                cards,
                ft.Container(height=12),
                cards2,
                ft.Container(height=32),
                # 快速新增
                ft.OutlinedButton(
                    "+ 新增病人",
                    icon=ft.Icons.PERSON_ADD,
                    on_click=lambda e: self.main_view.show_patient_form(),
                ),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
        )
    
    def _build_stat_card(self, icon: str, label: str, count: int, color: str) -> ft.Control:
        """建立統計卡片"""
        return ft.Container(
            width=130,
            height=100,
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            ink=True,
            on_click=lambda e: self.main_view.navigate_to(1),
            content=ft.Column([
                ft.Text(icon, size=20),
                ft.Text(
                    str(count),
                    size=28,
                    weight=ft.FontWeight.BOLD,
                    color=color if count > 0 else SELATheme.TEXT_HINT,
                ),
                ft.Text(
                    label,
                    size=12,
                    color=SELATheme.TEXT_SECONDARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=4),
        )
    
    def _on_search(self, e):
        """搜尋病人"""
        keyword = e.control.value.strip()
        if not keyword:
            return
        
        patient = self.patient_service.get_by_medical_id(keyword)
        
        if patient:
            # 病人存在
            patient = self.patient_service.get_with_treatments(patient.id)
            
            if patient.active_treatment:
                # 有進行中療程 → 進入療程頁
                self.main_view.show_treatment(patient.active_treatment.id)
            else:
                # 無進行中療程 → 顯示確認對話框
                self._show_new_treatment_dialog(patient)
        else:
            # 病人不存在 → 新增病人表單
            self.main_view.show_patient_form(keyword)
        
        e.control.value = ""
        self.page.update()
    
    def _show_new_treatment_dialog(self, patient):
        """顯示開新療程確認對話框"""
        def on_confirm(e):
            dialog.open = False
            self.page.update()
            self.main_view.show_patient_form(patient.medical_id)
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        # 顯示歷史療程
        history_text = ""
        if patient.treatments:
            history_items = []
            for t in patient.treatments[:3]:
                history_items.append(f"• {t.treatment_name} ({t.status_label})")
            history_text = "\n".join(history_items)
        
        dialog = ft.AlertDialog(
            title=ft.Text(f"{patient.name}", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text(f"病歷號：{patient.medical_id}", size=13),
                ft.Container(height=8),
                ft.Text("此病人目前無進行中療程", size=13, color=SELATheme.WARNING),
                ft.Container(height=8) if history_text else ft.Container(),
                ft.Text("歷史療程：", size=12, color=SELATheme.TEXT_SECONDARY) if history_text else ft.Container(),
                ft.Text(history_text, size=12) if history_text else ft.Container(),
            ], tight=True),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton(
                    "開始新療程",
                    on_click=on_confirm,
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
