"""舊病人開新療程表單"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.config.constants import CANCER_TYPES
from app.services.patient_service import PatientService
from app.services.treatment_service import TreatmentService


class NewTreatmentFormView:
    """舊病人開新療程表單"""
    
    def __init__(self, page: ft.Page, main_view, patient_id: int):
        self.page = page
        self.main_view = main_view
        self.patient_id = patient_id
        self.patient_service = PatientService()
        self.treatment_service = TreatmentService()
        self.patient = None
    
    def build(self) -> ft.Control:
        """建立表單 UI"""
        self.patient = self.patient_service.get_with_treatments(self.patient_id)
        
        if not self.patient:
            return ft.Container(content=ft.Text("病人不存在"))
        
        # 取得建議基準體重
        suggested = self.treatment_service.get_suggested_baseline(self.patient_id)
        
        # 癌別
        self.cancer_type_field = ft.Dropdown(
            label="癌別 *",
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            options=[
                ft.dropdown.Option(key=ct["code"], text=ct["label"])
                for ct in CANCER_TYPES
            ],
        )
        
        # 開始治療日
        self.start_date_field = ft.TextField(
            label="開始治療日 *",
            value=date.today().isoformat(),
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            read_only=True,
            suffix=ft.IconButton(
                icon=ft.Icons.CALENDAR_TODAY,
                on_click=self._show_date_picker,
            ),
        )
        
        # 基準體重
        self.weight_field = ft.TextField(
            label="基準體重 (kg) *",
            value=str(suggested["suggested"]) if suggested["suggested"] else "",
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            keyboard_type=ft.KeyboardType.NUMBER,
            input_filter=ft.InputFilter(regex_string=r"[0-9.]"),
            helper_text=suggested["source"] if suggested["source"] else None,
        )
        
        # 錯誤訊息
        self.error_text = ft.Text(
            "",
            color=SELATheme.DANGER,
            size=12,
            visible=False,
        )
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                # 標題列
                ft.Container(
                    bgcolor=SELATheme.SURFACE,
                    padding=ft.padding.symmetric(horizontal=16, vertical=12),
                    content=ft.Row([
                        ft.IconButton(
                            icon=ft.Icons.ARROW_BACK,
                            on_click=lambda e: self.main_view.navigate_to(0),
                        ),
                        ft.Text(
                            "新增療程",
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                    ]),
                ),
                # 病人資訊
                ft.Container(
                    bgcolor=SELATheme.PANEL_LEFT,
                    padding=SELATheme.SPACE_MD,
                    content=ft.Row([
                        ft.Text(
                            f"{self.patient.medical_id} {self.patient.name}",
                            size=14,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Text(
                            self.patient.gender_label,
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                    ], spacing=16),
                ),
                # 表單區
                ft.Container(
                    expand=True,
                    padding=SELATheme.SPACE_LG,
                    content=ft.Column([
                        self.cancer_type_field,
                        ft.Container(height=8),
                        self.start_date_field,
                        ft.Container(height=8),
                        self.weight_field,
                        ft.Container(height=16),
                        self.error_text,
                        ft.Container(height=16),
                        ft.ElevatedButton(
                            "建立療程",
                            width=200,
                            bgcolor=SELATheme.PRIMARY,
                            color=ft.Colors.WHITE,
                            on_click=self._on_save,
                        ),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                       scroll=ft.ScrollMode.AUTO),
                ),
            ], spacing=0),
        )
    
    def _show_date_picker(self, e):
        """顯示日期選擇器"""
        def on_date_change(e):
            if e.control.value:
                self.start_date_field.value = e.control.value.strftime("%Y-%m-%d")
                self.page.update()
        
        date_picker = ft.DatePicker(
            first_date=date(2020, 1, 1),
            last_date=date.today(),
            on_change=on_date_change,
        )
        self.page.overlay.append(date_picker)
        date_picker.open = True
        self.page.update()
    
    def _on_save(self, e):
        """儲存"""
        cancer_type = self.cancer_type_field.value
        start_date_str = self.start_date_field.value
        weight_str = self.weight_field.value.strip()
        
        if not cancer_type:
            self._show_error("請選擇癌別")
            return
        if not weight_str:
            self._show_error("請輸入基準體重")
            return
        
        try:
            weight = float(weight_str)
            if weight <= 0 or weight > 300:
                self._show_error("體重數值不合理")
                return
        except ValueError:
            self._show_error("體重格式錯誤")
            return
        
        try:
            start_date = date.fromisoformat(start_date_str)
        except ValueError:
            self._show_error("日期格式錯誤")
            return
        
        try:
            treatment = self.treatment_service.create(
                patient_id=self.patient_id,
                cancer_type=cancer_type,
                treatment_start=start_date,
                baseline_weight=weight,
            )
            self.main_view.show_snack(f"已建立 {self.patient.name} 的療程")
            self.main_view.show_treatment(treatment.id)
        except Exception as ex:
            self._show_error(str(ex))
    
    def _show_error(self, msg: str):
        """顯示錯誤"""
        self.error_text.value = msg
        self.error_text.visible = True
        self.page.update()
