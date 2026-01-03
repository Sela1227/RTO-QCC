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
        
        # 搜尋框（放大）
        self.search_field = ft.TextField(
            hint_text="輸入或掃描病歷號",
            prefix_icon=ft.Icons.SEARCH,
            border_radius=SELATheme.RADIUS_MD,
            height=56,
            text_size=18,
            on_submit=self._on_search,
            autofocus=True,
        )
        
        # 搜尋結果提示
        self.search_hint = ft.Text(
            "輸入病歷號後按 Enter，或使用 Barcode 掃描",
            size=12,
            color=SELATheme.TEXT_HINT,
        )
        
        # 統計卡片（加寬）- 點擊跳到對應篩選
        # 燈號邏輯：一週未量/待SDM/待營養 0=綠有=紅，待量測 0=綠有=黃
        cards = ft.Row([
            self._build_stat_card("overdue", "一週未量", summary["overdue_count"], "red"),
            self._build_stat_card("pending", "待量測", summary["pending_count"], "yellow"),
        ], alignment=ft.MainAxisAlignment.CENTER, spacing=20)
        
        cards2 = ft.Row([
            self._build_stat_card("sdm", "待 SDM", summary["sdm_pending"], "red"),
            self._build_stat_card("nutrition", "待轉營養", summary["nutrition_pending"], "red"),
        ], alignment=ft.MainAxisAlignment.CENTER, spacing=20)
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            padding=SELATheme.SPACE_LG,
            content=ft.Column([
                ft.Container(height=20),
                # LOGO
                ft.Text(
                    "SELA",
                    size=40,
                    weight=ft.FontWeight.BOLD,
                    color=SELATheme.PRIMARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Text(
                    "放射腫瘤體重追蹤系統",
                    size=18,
                    color=SELATheme.TEXT_SECONDARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=28),
                # 搜尋框（放大）
                ft.Container(
                    width=500,
                    content=self.search_field,
                ),
                ft.Container(height=8),
                # 搜尋提示
                self.search_hint,
                ft.Container(height=32),
                # 統計卡片（加寬）
                cards,
                ft.Container(height=16),
                cards2,
                ft.Container(height=28),
                # 快速操作
                ft.OutlinedButton(
                    "+ 新增病人",
                    icon=ft.Icons.PERSON_ADD,
                    height=44,
                    on_click=lambda e: self.main_view.show_patient_form(),
                ),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
        )
    
    def _build_stat_card(self, filter_type: str, label: str, count: int, alert_type: str) -> ft.Control:
        """建立統計卡片（放大）
        
        alert_type: 'red' = 0綠有紅, 'yellow' = 0綠有黃
        """
        # 燈號和顏色
        if count == 0:
            icon = "🟢"
            color = SELATheme.SUCCESS
        elif alert_type == "yellow":
            icon = "🟡"
            color = SELATheme.WARNING
        else:  # red
            icon = "🔴"
            color = SELATheme.DANGER
        
        return ft.Container(
            width=220,
            height=140,
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            ink=True,
            on_click=lambda e, f=filter_type: self._navigate_with_filter(f),
            content=ft.Column([
                ft.Text(icon, size=28),
                ft.Text(
                    str(count),
                    size=40,
                    weight=ft.FontWeight.BOLD,
                    color=color,
                ),
                ft.Text(
                    label,
                    size=16,
                    color=SELATheme.TEXT_SECONDARY,
                    font_family=SELATheme.FONT_FAMILY,
                ),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, 
               alignment=ft.MainAxisAlignment.CENTER,
               spacing=4),
        )
    
    def _navigate_with_filter(self, filter_type: str):
        """跳到追蹤清單並設置篩選"""
        self.main_view.navigate_to_tracking_with_filter(filter_type)
    
    def _on_search(self, e):
        """搜尋病人"""
        keyword = e.control.value.strip()
        if not keyword:
            return
        
        # 自動補0到7碼
        if keyword.isdigit() and len(keyword) < 7:
            keyword = keyword.zfill(7)
        
        patient = self.patient_service.get_by_medical_id(keyword)
        
        if patient:
            # 病人存在
            patient = self.patient_service.get_with_treatments(patient.id)
            
            if patient.ongoing_treatment:
                # 有未結束療程（active 或 paused）→ 進入療程頁
                self.main_view.show_treatment(patient.ongoing_treatment.id)
            else:
                # 只有已結束療程 → 顯示確認對話框，開新療程
                self._show_new_treatment_dialog(patient)
            
            # 清除提示
            self.search_hint.value = "輸入病歷號後按 Enter，或使用 Barcode 掃描"
            self.search_hint.color = SELATheme.TEXT_HINT
        else:
            # 病人不存在 → 顯示無符合
            self.search_hint.value = f"❌ 無符合病歷號：{keyword}"
            self.search_hint.color = SELATheme.DANGER
        
        e.control.value = ""
        self.page.update()
    
    def _show_new_treatment_dialog(self, patient):
        """顯示開新療程確認對話框"""
        def on_confirm(e):
            dialog.open = False
            self.page.update()
            # 使用新療程表單（只需填療程資料，不需病人資料）
            self.main_view.show_new_treatment_form(patient.id)
        
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
                ft.Text(f"病歷號：{patient.medical_id_display}", size=13),
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
