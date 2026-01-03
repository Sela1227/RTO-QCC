"""介入記錄詳情頁"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.config.constants import SDM_REASONS, NUTRITION_REASONS, SKIP_REASONS
from app.services.intervention_service import InterventionService
from app.services.treatment_service import TreatmentService


class InterventionDetailView:
    """介入記錄詳情頁"""
    
    def __init__(self, page: ft.Page, main_view, treatment_id: int, intervention_type: str = None):
        self.page = page
        self.main_view = main_view
        self.treatment_id = treatment_id
        self.intervention_type = intervention_type  # "sdm" or "nutrition"
        self.intervention_service = InterventionService()
        self.treatment_service = TreatmentService()
        self.treatment = None
        self.interventions = []
    
    def build(self) -> ft.Control:
        """建立介入詳情 UI"""
        self.treatment = self.treatment_service.get_with_details(self.treatment_id)
        
        if not self.treatment:
            return ft.Container(content=ft.Text("療程不存在"))
        
        # 取得待處理介入
        self.interventions = [
            i for i in self.treatment.pending_interventions
            if not self.intervention_type or i.type == self.intervention_type
        ]
        
        if not self.interventions:
            return ft.Container(
                expand=True,
                content=ft.Column([
                    ft.Text("沒有待處理的介入"),
                    ft.ElevatedButton(
                        "返回",
                        on_click=lambda e: self.main_view.show_treatment(self.treatment_id),
                    ),
                ], alignment=ft.MainAxisAlignment.CENTER,
                   horizontal_alignment=ft.CrossAxisAlignment.CENTER),
            )
        
        # 判斷類型
        has_nutrition = any(i.type == "nutrition" for i in self.interventions)
        has_sdm = any(i.type == "sdm" for i in self.interventions)
        
        if has_nutrition:
            title = "營養師轉介"
            icon = "🍎"
            color = SELATheme.DANGER
            reason_options = NUTRITION_REASONS
        else:
            title = "SDM 諮詢"
            icon = "💬"
            color = SELATheme.WARNING
            reason_options = SDM_REASONS
        
        # 表單元件
        self.reason_dropdown = ft.Dropdown(
            label="介入原因",
            options=[
                ft.dropdown.Option(key=r["code"], text=r["label"])
                for r in reason_options
            ],
            width=320,
        )
        
        self.assessment_field = ft.TextField(
            label="評估內容",
            hint_text="請填寫評估發現...",
            multiline=True,
            min_lines=3,
            max_lines=5,
            width=320,
        )
        
        self.plan_field = ft.TextField(
            label="處置計畫",
            hint_text="請填寫處置計畫...",
            multiline=True,
            min_lines=3,
            max_lines=5,
            width=320,
        )
        
        self.notes_field = ft.TextField(
            label="備註（選填）",
            multiline=True,
            min_lines=2,
            max_lines=3,
            width=320,
        )
        
        # 執行日期
        self.executed_date = date.today()
        self.date_text = ft.Text(
            f"執行日期：{self.executed_date.strftime('%Y-%m-%d')}",
            size=14,
        )
        
        # 體重資訊
        current_weight = self.treatment.current_weight or self.treatment.baseline_weight
        change_rate = self.treatment.current_change_rate or 0
        
        change_color = SELATheme.TEXT_SECONDARY
        if change_rate >= 5:
            change_color = SELATheme.DANGER
        elif change_rate >= 3:
            change_color = SELATheme.WARNING
        
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
                            on_click=lambda e: self.main_view.show_treatment(self.treatment_id),
                        ),
                        ft.Text(icon, size=20),
                        ft.Text(
                            title,
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                    ]),
                ),
                # 內容
                ft.Container(
                    expand=True,
                    padding=SELATheme.SPACE_LG,
                    content=ft.Column([
                        # 病人資訊卡
                        ft.Container(
                            bgcolor=SELATheme.SURFACE,
                            border_radius=SELATheme.RADIUS_MD,
                            padding=SELATheme.SPACE_MD,
                            content=ft.Column([
                                ft.Row([
                                    ft.Text(
                                        f"{self.treatment.patient.medical_id}" if self.treatment.patient else "",
                                        weight=ft.FontWeight.BOLD,
                                        size=16,
                                    ),
                                    ft.Text(
                                        f"{self.treatment.patient.name}" if self.treatment.patient else "",
                                        size=16,
                                    ),
                                    ft.Text(
                                        self.treatment.patient.gender_label if self.treatment.patient else "",
                                        size=14,
                                        color=SELATheme.TEXT_SECONDARY,
                                    ),
                                ], spacing=8),
                                ft.Row([
                                    ft.Text(
                                        f"目前體重：{current_weight:.1f} kg",
                                        size=13,
                                    ),
                                    ft.Text(
                                        f"（{change_rate:+.1f}%）",
                                        size=13,
                                        color=change_color,
                                    ),
                                ], spacing=4),
                                ft.Row([
                                    ft.Text(
                                        f"基準：{self.treatment.baseline_weight:.1f} kg",
                                        size=12,
                                        color=SELATheme.TEXT_SECONDARY,
                                    ),
                                    ft.Text(
                                        f"療程：{self.treatment.treatment_name}",
                                        size=12,
                                        color=SELATheme.TEXT_SECONDARY,
                                    ),
                                ], spacing=12),
                            ], spacing=8),
                        ),
                        ft.Container(height=16),
                        # 表單
                        self.reason_dropdown,
                        ft.Container(height=12),
                        self.assessment_field,
                        ft.Container(height=12),
                        self.plan_field,
                        ft.Container(height=12),
                        self.notes_field,
                        ft.Container(height=12),
                        # 日期
                        ft.Row([
                            self.date_text,
                            ft.TextButton("更改", on_click=self._show_date_picker),
                        ]),
                        ft.Container(height=24),
                        # 按鈕
                        ft.Row([
                            ft.OutlinedButton(
                                "略過此介入",
                                icon=ft.Icons.SKIP_NEXT,
                                on_click=self._show_skip_dialog,
                            ),
                            ft.Container(expand=True),
                            ft.ElevatedButton(
                                "完成介入",
                                icon=ft.Icons.CHECK,
                                bgcolor=SELATheme.SUCCESS,
                                color=ft.Colors.WHITE,
                                on_click=self._on_complete,
                            ),
                        ]),
                    ], scroll=ft.ScrollMode.AUTO,
                       horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                ),
            ], spacing=0),
        )
    
    def _show_date_picker(self, e):
        """顯示日期選擇器"""
        def on_change(e):
            if picker.value:
                picked = picker.value
                if hasattr(picked, 'date'):
                    self.executed_date = picked.date()
                else:
                    self.executed_date = picked
                self.date_text.value = f"執行日期：{self.executed_date.strftime('%Y-%m-%d')}"
                self.page.update()
        
        picker = ft.DatePicker(
            first_date=date(2020, 1, 1),
            last_date=date.today(),
            value=self.executed_date,
            on_change=on_change,
        )
        self.page.open(picker)
    
    def _on_complete(self, e):
        """完成介入"""
        reason = self.reason_dropdown.value or ""
        assessment = self.assessment_field.value.strip() if self.assessment_field.value else ""
        plan = self.plan_field.value.strip() if self.plan_field.value else ""
        notes = self.notes_field.value.strip() if self.notes_field.value else ""
        
        # 組合結果
        result = ""
        if assessment:
            result += f"【評估】{assessment}\n"
        if plan:
            result += f"【計畫】{plan}\n"
        if notes:
            result += f"【備註】{notes}"
        
        # 標記完成
        for intervention in self.interventions:
            self.intervention_service.mark_completed(
                intervention.id,
                reason=reason,
                notes=result.strip(),
                executed_date=self.executed_date,
            )
        
        self.main_view.show_snack("介入已完成")
        self.main_view.show_treatment(self.treatment_id)
    
    def _show_skip_dialog(self, e):
        """顯示略過對話框"""
        reason_dropdown = ft.Dropdown(
            label="略過原因 *",
            options=[
                ft.dropdown.Option(key=r["code"], text=r["label"])
                for r in SKIP_REASONS
            ],
            width=280,
        )
        
        notes_field = ft.TextField(
            label="備註（選填）",
            multiline=True,
            min_lines=2,
            max_lines=3,
            width=280,
        )
        
        # 病人拒絕快速按鈕
        def on_patient_refused(e):
            reason_dropdown.value = "PATIENT_REFUSED"
            self.page.update()
        
        def on_confirm(e):
            if not reason_dropdown.value:
                return
            
            notes = notes_field.value.strip() if notes_field.value else ""
            
            for intervention in self.interventions:
                self.intervention_service.mark_skipped(
                    intervention.id,
                    reason_dropdown.value,
                    notes=notes,
                )
            
            dialog.open = False
            self.main_view.show_snack("已略過")
            self.main_view.show_treatment(self.treatment_id)
            self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("略過介入", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                # 快速選項
                ft.Container(
                    bgcolor="#FFF3E0",
                    border_radius=SELATheme.RADIUS_SM,
                    padding=ft.padding.symmetric(horizontal=12, vertical=8),
                    ink=True,
                    on_click=on_patient_refused,
                    content=ft.Row([
                        ft.Icon(ft.Icons.PERSON_OFF, size=18, color=SELATheme.WARNING),
                        ft.Text("病人拒絕", size=13),
                    ], spacing=8),
                ),
                ft.Container(height=12),
                reason_dropdown,
                ft.Container(height=8),
                notes_field,
            ], tight=True),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("確定略過", on_click=on_confirm),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
