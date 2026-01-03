"""新增體重表單"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.services.treatment_service import TreatmentService
from app.services.weight_service import WeightService


class WeightFormView:
    """新增體重表單"""
    
    def __init__(self, page: ft.Page, main_view, treatment_id: int):
        self.page = page
        self.main_view = main_view
        self.treatment_id = treatment_id
        self.treatment_service = TreatmentService()
        self.weight_service = WeightService()
        self.treatment = None
        self.show_date_picker = False
    
    def build(self) -> ft.Control:
        """建立表單 UI"""
        self.treatment = self.treatment_service.get_with_details(self.treatment_id)
        
        if not self.treatment:
            return ft.Container(content=ft.Text("療程不存在"))
        
        # 目前體重資訊
        current = self.treatment.current_weight or self.treatment.baseline_weight
        
        # 體重輸入（大輸入框）
        self.weight_field = ft.TextField(
            hint_text="輸入體重",
            text_align=ft.TextAlign.CENTER,
            text_size=32,
            border_radius=SELATheme.RADIUS_MD,
            height=80,
            keyboard_type=ft.KeyboardType.NUMBER,
            input_filter=ft.InputFilter(regex_string=r"[0-9.]"),
            suffix_text="kg",
            autofocus=True,
        )
        
        # 日期（預設今天）
        self.selected_date = date.today()
        self.date_text = ft.Text(
            f"今天 {self.selected_date.strftime('%m/%d')}",
            size=14,
            color=SELATheme.TEXT_SECONDARY,
        )
        
        # 日期選擇器容器
        self.date_picker_container = ft.Container(visible=False)
        
        # 錯誤訊息
        self.error_text = ft.Text(
            "",
            color=SELATheme.DANGER,
            size=12,
            visible=False,
        )
        
        # 預覽結果
        self.preview_container = ft.Container(visible=False)
        
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
                            icon=ft.Icons.CLOSE,
                            on_click=lambda e: self.main_view.show_treatment(self.treatment_id),
                        ),
                        ft.Text(
                            "新增體重",
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                    ]),
                ),
                # 內容區
                ft.Container(
                    expand=True,
                    padding=SELATheme.SPACE_LG,
                    content=ft.Column([
                        # 病人資訊
                        ft.Container(
                            bgcolor=SELATheme.SURFACE,
                            border_radius=SELATheme.RADIUS_SM,
                            padding=SELATheme.SPACE_MD,
                            content=ft.Row([
                                ft.Text(
                                    f"{self.treatment.patient.medical_id} {self.treatment.patient.name}" if self.treatment.patient else "",
                                    size=14,
                                    font_family=SELATheme.FONT_FAMILY,
                                ),
                                ft.Container(expand=True),
                                ft.Text(
                                    f"目前 {current:.1f} kg（基準 {self.treatment.baseline_weight:.1f} kg）",
                                    size=12,
                                    color=SELATheme.TEXT_SECONDARY,
                                ),
                            ]),
                        ),
                        ft.Container(height=24),
                        # 體重輸入
                        ft.Container(
                            width=250,
                            content=self.weight_field,
                        ),
                        ft.Container(height=16),
                        # 日期
                        ft.Row([
                            self.date_text,
                            ft.TextButton(
                                "改日期",
                                on_click=self._show_date_picker,
                            ),
                        ], alignment=ft.MainAxisAlignment.CENTER),
                        ft.Container(height=16),
                        # 錯誤訊息
                        self.error_text,
                        # 預覽
                        self.preview_container,
                        ft.Container(height=24),
                        # 儲存按鈕
                        ft.ElevatedButton(
                            "儲存",
                            width=200,
                            height=48,
                            bgcolor=SELATheme.PRIMARY,
                            color=ft.Colors.WHITE,
                            on_click=self._on_save,
                        ),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                ),
            ], spacing=0),
        )
    
    def _show_date_picker(self, e):
        """顯示日期選擇器"""
        # 計算治療開始日
        start_date = self.treatment.treatment_start
        if isinstance(start_date, str):
            start_date = date.fromisoformat(start_date.split('T')[0])
        
        def on_date_change(e):
            if date_picker.value:
                # DatePicker 返回 datetime，轉換為 date
                picked = date_picker.value
                if hasattr(picked, 'date'):
                    self.selected_date = picked.date()
                else:
                    self.selected_date = picked
                
                if self.selected_date == date.today():
                    self.date_text.value = f"今天 {self.selected_date.strftime('%m/%d')}"
                else:
                    self.date_text.value = self.selected_date.strftime("%Y-%m-%d")
                self.page.update()
        
        def on_dismiss(e):
            pass
        
        date_picker = ft.DatePicker(
            first_date=start_date or date(2015, 1, 1),
            last_date=date.today(),
            value=self.selected_date,
            on_change=on_date_change,
            on_dismiss=on_dismiss,
        )
        self.page.open(date_picker)
    
    def _on_save(self, e):
        """儲存體重"""
        weight_str = self.weight_field.value.strip()
        
        if not weight_str:
            self._show_error("請輸入體重")
            return
        
        try:
            weight = float(weight_str)
            if weight <= 0 or weight > 300:
                self._show_error("體重數值不合理（應在 1-300 kg 之間）")
                return
        except ValueError:
            self._show_error("體重格式錯誤")
            return
        
        try:
            record = self.weight_service.create(
                treatment_id=self.treatment_id,
                weight=weight,
                measure_date=self.selected_date,
            )
            
            # 顯示結果
            msg = f"已記錄 {weight:.1f} kg"
            if record.alert_level == "nutrition":
                msg += "，已觸發營養師轉介提醒"
            elif record.alert_level == "sdm":
                msg += "，已觸發 SDM 提醒"
            
            self.main_view.show_snack(msg)
            self.main_view.show_treatment(self.treatment_id)
            
        except ValueError as ex:
            self._show_error(str(ex))
        except Exception as ex:
            self._show_error(f"儲存失敗：{str(ex)}")
    
    def _show_error(self, msg: str):
        """顯示錯誤"""
        self.error_text.value = msg
        self.error_text.visible = True
        self.page.update()
