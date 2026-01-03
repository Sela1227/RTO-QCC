"""新增病人表單"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.config.constants import GENDER_OPTIONS, TREATMENT_INTENT
from app.services.patient_service import PatientService
from app.services.treatment_service import TreatmentService
from app.services.settings_service import SettingsService


class PatientFormView:
    """新增病人表單"""
    
    def __init__(self, page: ft.Page, main_view, prefill_medical_id: str = None):
        self.page = page
        self.main_view = main_view
        self.prefill_medical_id = prefill_medical_id
        self.patient_service = PatientService()
        self.treatment_service = TreatmentService()
        self.settings_service = SettingsService()
        self.birth_date_value = None
    
    def build(self) -> ft.Control:
        """建立表單 UI"""
        # 取得癌別選項（從設定）
        cancer_types = self.settings_service.get_cancer_types()
        
        # 病歷號
        self.medical_id_field = ft.TextField(
            label="病歷號 *（7碼）",
            value=self.prefill_medical_id or "",
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            autofocus=not self.prefill_medical_id,
            max_length=7,
            input_filter=ft.InputFilter(regex_string=r"[0-9]"),
        )
        
        # 姓名
        self.name_field = ft.TextField(
            label="姓名 *",
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            autofocus=bool(self.prefill_medical_id),
        )
        
        # 性別
        self.gender_field = ft.RadioGroup(
            content=ft.Row([
                ft.Radio(value="M", label="男"),
                ft.Radio(value="F", label="女"),
            ]),
        )
        
        # 生日（必填）
        self.birth_date_text = ft.Text("未選擇", size=14)
        self.age_text = ft.Text("", size=12, color=SELATheme.TEXT_SECONDARY)
        
        # 治療目的
        self.intent_field = ft.Dropdown(
            label="治療目的 *",
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            options=[
                ft.dropdown.Option(key=ti["code"], text=ti["label"])
                for ti in TREATMENT_INTENT
            ],
        )
        
        # 癌別
        self.cancer_type_field = ft.Dropdown(
            label="癌別 *",
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            options=[
                ft.dropdown.Option(key=ct["code"], text=ct["label"])
                for ct in cancer_types
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
                on_click=self._show_start_date_picker,
            ),
        )
        
        # 基準體重
        self.weight_field = ft.TextField(
            label="基準體重 (kg) *",
            border_radius=SELATheme.RADIUS_SM,
            text_size=14,
            keyboard_type=ft.KeyboardType.NUMBER,
            input_filter=ft.InputFilter(regex_string=r"[0-9.]"),
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
                            "新增病人",
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                    ]),
                ),
                # 表單區
                ft.Container(
                    expand=True,
                    padding=SELATheme.SPACE_LG,
                    content=ft.Column([
                        # 病人基本資料區
                        ft.Text("病人資料", size=14, weight=ft.FontWeight.BOLD, color=SELATheme.TEXT_SECONDARY),
                        ft.Container(height=8),
                        self.medical_id_field,
                        ft.Container(height=8),
                        self.name_field,
                        ft.Container(height=8),
                        ft.Text("性別", size=12, color=SELATheme.TEXT_SECONDARY),
                        self.gender_field,
                        ft.Container(height=8),
                        # 生日
                        ft.Row([
                            ft.Text("生日 *", size=12, color=SELATheme.TEXT_SECONDARY),
                            ft.Container(expand=True),
                            self.birth_date_text,
                            self.age_text,
                            ft.IconButton(
                                icon=ft.Icons.CALENDAR_TODAY,
                                on_click=self._show_birth_date_picker,
                            ),
                        ]),
                        ft.Container(height=8),
                        self.intent_field,
                        ft.Container(height=16),
                        # 療程資料區
                        ft.Text("療程資料", size=14, weight=ft.FontWeight.BOLD, color=SELATheme.TEXT_SECONDARY),
                        ft.Container(height=8),
                        self.cancer_type_field,
                        ft.Container(height=8),
                        self.start_date_field,
                        ft.Container(height=8),
                        self.weight_field,
                        ft.Container(height=16),
                        self.error_text,
                        ft.Container(height=16),
                        ft.ElevatedButton(
                            "儲存",
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
    
    def _show_birth_date_picker(self, e):
        """顯示生日日期選擇器"""
        def on_date_change(e):
            if date_picker.value:
                picked = date_picker.value
                if hasattr(picked, 'date'):
                    picked = picked.date()
                self.birth_date_value = picked
                self.birth_date_text.value = picked.strftime("%Y-%m-%d")
                # 計算年紀
                today = date.today()
                age = today.year - picked.year
                if (today.month, today.day) < (picked.month, picked.day):
                    age -= 1
                self.age_text.value = f"（{age}歲）"
                self.page.update()
        
        date_picker = ft.DatePicker(
            first_date=date(1900, 1, 1),
            last_date=date.today(),
            value=self.birth_date_value or date(1960, 1, 1),
            on_change=on_date_change,
        )
        self.page.open(date_picker)
    
    def _show_start_date_picker(self, e):
        """顯示開始治療日選擇器"""
        def on_date_change(e):
            if date_picker.value:
                picked = date_picker.value
                if hasattr(picked, 'date'):
                    picked = picked.date()
                self.start_date_field.value = picked.strftime("%Y-%m-%d")
                self.page.update()
        
        try:
            current_value = date.fromisoformat(self.start_date_field.value.split('T')[0])
        except:
            current_value = date.today()
        
        date_picker = ft.DatePicker(
            first_date=date(2015, 1, 1),
            last_date=date(2035, 12, 31),
            value=current_value,
            on_change=on_date_change,
        )
        self.page.open(date_picker)
    
    def _on_save(self, e):
        """儲存"""
        # 驗證
        medical_id = self.medical_id_field.value.strip()
        name = self.name_field.value.strip()
        gender = self.gender_field.value
        intent = self.intent_field.value
        cancer_type = self.cancer_type_field.value
        start_date_str = self.start_date_field.value
        weight_str = self.weight_field.value.strip()
        
        # 必填檢查
        if not medical_id:
            self._show_error("請輸入病歷號")
            return
        if not name:
            self._show_error("請輸入姓名")
            return
        if not self.birth_date_value:
            self._show_error("請選擇生日")
            return
        if not intent:
            self._show_error("請選擇治療目的")
            return
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
        
        # 病歷號補0
        medical_id = medical_id.zfill(7)
        
        # 檢查病人是否存在
        existing = self.patient_service.get_by_medical_id(medical_id)
        if existing:
            # 檢查是否有進行中療程
            existing = self.patient_service.get_with_treatments(existing.id)
            if existing.active_treatment:
                self._show_error("此病人已有進行中的療程")
                return
            # 舊病人開新療程
            patient = existing
        else:
            # 新病人
            patient = self.patient_service.get_or_create(
                medical_id=medical_id,
                name=name,
                gender=gender,
                birth_date=self.birth_date_value,
                treatment_intent=intent,
            )
        
        # 建立療程
        try:
            treatment = self.treatment_service.create(
                patient_id=patient.id,
                cancer_type=cancer_type,
                treatment_start=start_date,
                baseline_weight=weight,
            )
            self.main_view.show_snack(f"已建立 {patient.name} 的療程")
            # 跳轉到療程詳情
            self.main_view.show_treatment(treatment.id)
        except Exception as ex:
            self._show_error(str(ex))
    
    def _show_error(self, msg: str):
        """顯示錯誤"""
        self.error_text.value = msg
        self.error_text.visible = True
        self.page.update()
