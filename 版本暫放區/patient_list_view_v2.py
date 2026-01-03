"""全部病人清單"""
import flet as ft
from app.config.theme import SELATheme
from app.services.patient_service import PatientService


class PatientListView:
    """全部病人清單"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.patient_service = PatientService()
        self.search_keyword = ""
    
    def build(self) -> ft.Control:
        """建立病人清單 UI"""
        patients = self.patient_service.get_all()
        
        # 搜尋過濾
        if self.search_keyword:
            keyword = self.search_keyword.lower()
            patients = [
                p for p in patients 
                if keyword in p.medical_id.lower() or keyword in p.name.lower()
            ]
        
        # 搜尋框
        self.search_field = ft.TextField(
            hint_text="搜尋病歷號或姓名",
            prefix_icon=ft.Icons.SEARCH,
            border_radius=SELATheme.RADIUS_SM,
            height=44,
            text_size=14,
            value=self.search_keyword,
            on_change=self._on_search_change,
        )
        
        # 清單
        if patients:
            list_items = [self._build_item(p) for p in patients]
            content = ft.ListView(
                controls=list_items,
                spacing=8,
                expand=True,
            )
        else:
            content = ft.Container(
                expand=True,
                content=ft.Column([
                    ft.Icon(ft.Icons.PERSON_OFF, size=64, color=SELATheme.TEXT_HINT),
                    ft.Container(height=16),
                    ft.Text(
                        "找不到符合條件的病人" if self.search_keyword else "目前沒有病人資料",
                        color=SELATheme.TEXT_SECONDARY,
                        font_family=SELATheme.FONT_FAMILY,
                    ),
                ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                   alignment=ft.MainAxisAlignment.CENTER),
            )
        
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
                            on_click=lambda e: self.main_view.navigate_to(0),
                        ),
                        ft.Text(
                            f"全部病人 ({len(patients)})",
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                    ]),
                ),
                # 搜尋
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16, vertical=8),
                    content=self.search_field,
                ),
                # 清單
                ft.Container(
                    expand=True,
                    padding=ft.padding.symmetric(horizontal=16),
                    content=content,
                ),
            ], spacing=0, expand=True),
        )
    
    def _on_search_change(self, e):
        """搜尋變更"""
        self.search_keyword = e.control.value
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _build_item(self, patient) -> ft.Control:
        """建立病人項目"""
        # 取得療程資訊
        patient = self.patient_service.get_with_treatments(patient.id)
        
        # 療程狀態
        status_text = ""
        status_color = SELATheme.TEXT_HINT
        if patient.active_treatment:
            status_text = f"🟢 {patient.active_treatment.cancer_type_label}"
            status_color = SELATheme.SUCCESS
        elif patient.treatments:
            last = patient.treatments[0]
            status_text = f"⚪ {last.status_label}"
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_SM,
            padding=SELATheme.SPACE_MD,
            ink=True,
            on_click=lambda e, p=patient: self._on_item_click(p),
            content=ft.Row([
                ft.Column([
                    ft.Row([
                        ft.Text(
                            patient.medical_id,
                            weight=ft.FontWeight.BOLD,
                            size=14,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Text(
                            patient.name,
                            size=14,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Text(
                            patient.gender_label,
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                    ], spacing=8),
                    ft.Row([
                        ft.Text(
                            status_text,
                            size=12,
                            color=status_color,
                        ),
                        ft.Text(
                            f"共 {len(patient.treatments)} 個療程" if patient.treatments else "無療程",
                            size=12,
                            color=SELATheme.TEXT_HINT,
                        ),
                    ], spacing=8),
                ], spacing=4, expand=True),
                ft.Icon(ft.Icons.CHEVRON_RIGHT, color=SELATheme.TEXT_HINT),
            ]),
        )
    
    def _on_item_click(self, patient):
        """點擊病人"""
        if patient.active_treatment:
            # 有進行中療程 → 療程詳情
            self.main_view.show_treatment(patient.active_treatment.id)
        elif patient.treatments:
            # 有歷史療程 → 顯示選擇對話框
            self._show_patient_dialog(patient)
        else:
            # 無療程 → 開新療程
            self.main_view.show_patient_form(patient.medical_id)
    
    def _show_patient_dialog(self, patient):
        """顯示病人對話框"""
        # 療程列表
        items = []
        for t in patient.treatments[:5]:
            items.append(
                ft.Container(
                    padding=ft.padding.symmetric(vertical=4),
                    ink=True,
                    on_click=lambda e, tid=t.id: self._goto_treatment(tid),
                    content=ft.Row([
                        ft.Text(
                            t.treatment_name,
                            size=13,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Container(expand=True),
                        ft.Text(
                            t.status_label,
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                        ft.Icon(ft.Icons.CHEVRON_RIGHT, size=16, color=SELATheme.TEXT_HINT),
                    ]),
                )
            )
        
        def on_new_treatment(e):
            self.dialog.open = False
            self.page.update()
            self.main_view.show_patient_form(patient.medical_id)
        
        def on_close(e):
            self.dialog.open = False
            self.page.update()
        
        self.dialog = ft.AlertDialog(
            title=ft.Text(f"{patient.medical_id} {patient.name}", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text("歷史療程：", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Container(height=4),
                *items,
            ], tight=True, width=300),
            actions=[
                ft.TextButton("關閉", on_click=on_close),
                ft.ElevatedButton(
                    "開新療程",
                    on_click=on_new_treatment,
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(self.dialog)
        self.dialog.open = True
        self.page.update()
    
    def _goto_treatment(self, treatment_id: int):
        """跳轉到療程"""
        if hasattr(self, 'dialog'):
            self.dialog.open = False
        self.page.update()
        self.main_view.show_treatment(treatment_id)
