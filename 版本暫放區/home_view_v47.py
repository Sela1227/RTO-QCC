"""首頁"""
import flet as ft
from datetime import date
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
        """顯示開新療程對話框 - 完整表單"""
        from app.config.constants import UNABLE_REASONS, TREATMENT_INTENT
        from app.services.settings_service import SettingsService
        from app.services.treatment_service import TreatmentService
        
        settings_service = SettingsService()
        treatment_service = TreatmentService()
        
        # 取得建議基準體重
        suggested = treatment_service.get_suggested_baseline(patient.id)
        
        # 取得癌別選項
        cancer_types = settings_service.get_cancer_types()
        
        # 表單欄位
        intent_field = ft.Dropdown(
            label="治療目的 *",
            width=200,
            text_size=14,
            options=[ft.dropdown.Option(key=ti["code"], text=ti["label"]) for ti in TREATMENT_INTENT],
        )
        
        cancer_field = ft.Dropdown(
            label="癌別 *",
            width=200,
            text_size=14,
            options=[ft.dropdown.Option(key=ct["code"], text=ct["label"]) for ct in cancer_types],
        )
        
        start_date = [date.today()]
        date_text = ft.Text(date.today().strftime("%Y-%m-%d"), size=14)
        
        weight_field = ft.TextField(
            label="基準體重 (kg)",
            value=str(suggested["suggested"]) if suggested["suggested"] else "",
            width=120,
            text_size=14,
            keyboard_type=ft.KeyboardType.NUMBER,
            helper_text=suggested["source"] if suggested["source"] else None,
        )
        
        unable_checkbox = ft.Checkbox(label="無法測量", value=False)
        unable_reason = ft.Dropdown(
            label="原因",
            width=120,
            text_size=12,
            options=[ft.dropdown.Option(key=r["code"], text=r["label"]) for r in UNABLE_REASONS],
            visible=False,
        )
        
        error_text = ft.Text("", color=SELATheme.DANGER, size=12, visible=False)
        
        def on_unable_change(e):
            unable_reason.visible = unable_checkbox.value
            self.page.update()
        
        unable_checkbox.on_change = on_unable_change
        
        def show_date_picker(e):
            def on_date_change(e):
                if dp.value:
                    picked = dp.value.date() if hasattr(dp.value, 'date') else dp.value
                    start_date[0] = picked
                    date_text.value = picked.strftime("%Y-%m-%d")
                    self.page.update()
            dp = ft.DatePicker(
                first_date=date(2015, 1, 1),
                last_date=date(2035, 12, 31),
                value=start_date[0],
                on_change=on_date_change,
            )
            self.page.open(dp)
        
        def on_save(e):
            intent = intent_field.value
            cancer = cancer_field.value
            weight_str = weight_field.value.strip()
            unable = unable_checkbox.value
            unable_rsn = unable_reason.value if unable else None
            
            if not intent:
                error_text.value = "請選擇治療目的"
                error_text.visible = True
                self.page.update()
                return
            if not cancer:
                error_text.value = "請選擇癌別"
                error_text.visible = True
                self.page.update()
                return
            if not weight_str and not unable:
                error_text.value = "請輸入基準體重或勾選無法測量"
                error_text.visible = True
                self.page.update()
                return
            if unable and not unable_rsn:
                error_text.value = "請選擇無法測量原因"
                error_text.visible = True
                self.page.update()
                return
            
            weight = 0
            if weight_str:
                try:
                    weight = float(weight_str)
                    if weight <= 0 or weight > 300:
                        error_text.value = "體重數值不合理"
                        error_text.visible = True
                        self.page.update()
                        return
                except ValueError:
                    error_text.value = "體重格式錯誤"
                    error_text.visible = True
                    self.page.update()
                    return
            
            try:
                treatment = treatment_service.create(
                    patient_id=patient.id,
                    cancer_type=cancer,
                    treatment_intent=intent,
                    treatment_start=start_date[0],
                    baseline_weight=weight if weight > 0 else None,
                    unable_to_measure=unable,
                    unable_reason=unable_rsn,
                )
                dialog.open = False
                self.page.update()
                self.main_view.show_snack(f"已建立 {patient.name} 的療程")
                self.main_view.show_treatment(treatment.id)
            except Exception as ex:
                error_text.value = str(ex)
                error_text.visible = True
                self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        # 顯示歷史療程
        history_items = []
        if patient.treatments:
            for t in patient.treatments[:3]:
                history_items.append(
                    ft.Text(f"• {t.treatment_name} ({t.status_label})", size=12)
                )
        
        dialog = ft.AlertDialog(
            title=ft.Text(f"新增療程 - {patient.name}", font_family=SELATheme.FONT_FAMILY),
            content=ft.Container(
                width=320,
                content=ft.Column([
                    # 病人資訊（唯讀）
                    ft.Container(
                        bgcolor=SELATheme.BG,
                        border_radius=SELATheme.RADIUS_SM,
                        padding=SELATheme.SPACE_SM,
                        content=ft.Column([
                            ft.Row([
                                ft.Text(f"病歷號：{patient.medical_id_display}", size=13),
                                ft.Text(patient.gender_label, size=12, color=SELATheme.TEXT_SECONDARY),
                                ft.Text(patient.age_display, size=12, color=SELATheme.TEXT_HINT),
                            ], spacing=12),
                        ]),
                    ),
                    # 歷史療程
                    ft.Column(history_items, spacing=2) if history_items else ft.Container(),
                    ft.Divider() if history_items else ft.Container(),
                    # 療程表單
                    intent_field,
                    cancer_field,
                    ft.Row([
                        ft.Text("開始日期：", size=13),
                        date_text,
                        ft.IconButton(icon=ft.Icons.CALENDAR_TODAY, on_click=show_date_picker),
                    ]),
                    ft.Row([
                        weight_field,
                        unable_checkbox,
                    ], vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    unable_reason,
                    error_text,
                ], spacing=8, tight=True),
            ),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("建立療程", on_click=on_save, bgcolor=SELATheme.PRIMARY, color=ft.Colors.WHITE),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
