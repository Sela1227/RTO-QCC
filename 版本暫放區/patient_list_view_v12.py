"""病人資料庫管理頁面"""
import flet as ft
from datetime import date
from app.config.theme import SELATheme
from app.config.constants import GENDER_OPTIONS
from app.services.patient_service import PatientService
from app.services.treatment_service import TreatmentService


class PatientListView:
    """病人資料庫管理"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.patient_service = PatientService()
        self.treatment_service = TreatmentService()
        self.search_keyword = ""
        self.selected_patient = None
    
    def build(self) -> ft.Control:
        """建立病人管理 UI"""
        patients = self.patient_service.get_all()
        stats = self.patient_service.get_statistics()
        
        # 搜尋過濾
        if self.search_keyword:
            keyword = self.search_keyword.lower()
            patients = [
                p for p in patients 
                if keyword in p.medical_id.lower() or keyword in p.name.lower()
            ]
        
        # 搜尋框
        self.search_field = ft.TextField(
            hint_text="搜尋病歷號或姓名...",
            prefix_icon=ft.Icons.SEARCH,
            border_radius=SELATheme.RADIUS_SM,
            height=44,
            text_size=14,
            value=self.search_keyword,
            on_change=self._on_search_change,
            expand=True,
        )
        
        # 統計區
        stats_row = ft.Row([
            self._build_stat_chip(f"👤 {stats['total_patients']}", "總病人數"),
            self._build_stat_chip(f"🟢 {stats['active_treatments']}", "追蹤中"),
        ], spacing=12)
        
        # 清單
        if patients:
            list_items = [self._build_item(p) for p in patients]
            content = ft.ListView(
                controls=list_items,
                spacing=6,
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
                    padding=ft.padding.symmetric(horizontal=16, vertical=12),
                    content=ft.Row([
                        ft.Text(
                            "病人資料庫",
                            size=18,
                            weight=ft.FontWeight.BOLD,
                            font_family=SELATheme.FONT_FAMILY,
                        ),
                        ft.Container(expand=True),
                        ft.IconButton(
                            icon=ft.Icons.PERSON_ADD,
                            tooltip="新增病人",
                            on_click=lambda e: self.main_view.show_patient_form(),
                        ),
                    ]),
                ),
                # 統計
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16, vertical=8),
                    content=stats_row,
                ),
                # 搜尋
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16, vertical=4),
                    content=ft.Row([
                        self.search_field,
                    ]),
                ),
                # 清單
                ft.Container(
                    expand=True,
                    padding=ft.padding.symmetric(horizontal=16),
                    content=content,
                ),
            ], spacing=0, expand=True),
        )
    
    def _build_stat_chip(self, value: str, label: str) -> ft.Control:
        """建立統計標籤"""
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=20,
            padding=ft.padding.symmetric(horizontal=12, vertical=6),
            content=ft.Row([
                ft.Text(value, size=13, weight=ft.FontWeight.BOLD),
                ft.Text(label, size=11, color=SELATheme.TEXT_SECONDARY),
            ], spacing=6),
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
        status_icon = "⚪"
        status_text = "無療程"
        if patient.active_treatment:
            status_icon = "🟢"
            status_text = patient.active_treatment.cancer_type_label
        elif patient.treatments:
            last = patient.treatments[0]
            status_icon = "⚫"
            status_text = f"{last.treatment_name} ({last.status_label})"
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_SM,
            padding=ft.padding.symmetric(horizontal=12, vertical=10),
            ink=True,
            on_click=lambda e, p=patient: self._show_patient_detail(p),
            content=ft.Row([
                # 狀態
                ft.Text(status_icon, size=14),
                ft.Container(width=8),
                # 資訊
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
                    ft.Text(
                        status_text,
                        size=12,
                        color=SELATheme.TEXT_SECONDARY,
                    ),
                ], spacing=2, expand=True),
                # 療程數
                ft.Container(
                    bgcolor=SELATheme.BG,
                    border_radius=12,
                    padding=ft.padding.symmetric(horizontal=8, vertical=4),
                    content=ft.Text(
                        f"{len(patient.treatments) if patient.treatments else 0} 療程",
                        size=11,
                        color=SELATheme.TEXT_HINT,
                    ),
                ),
                ft.Icon(ft.Icons.CHEVRON_RIGHT, color=SELATheme.TEXT_HINT, size=20),
            ]),
        )
    
    def _show_patient_detail(self, patient):
        """顯示病人詳情"""
        self.selected_patient = patient
        
        # 取得完整療程資訊
        patient = self.patient_service.get_with_treatments(patient.id)
        
        # 療程列表
        treatment_items = []
        if patient.treatments:
            for t in patient.treatments:
                status_color = {
                    "active": SELATheme.SUCCESS,
                    "paused": SELATheme.WARNING,
                    "terminated": SELATheme.DANGER,
                    "completed": SELATheme.TEXT_HINT,
                }.get(t.status, SELATheme.TEXT_HINT)
                
                # 操作按鈕
                action_btn = None
                if t.status == "active":
                    action_btn = ft.PopupMenuButton(
                        icon=ft.Icons.MORE_VERT,
                        icon_size=16,
                        items=[
                            ft.PopupMenuItem(
                                text="結束療程",
                                icon=ft.Icons.CHECK_CIRCLE,
                                on_click=lambda e, tid=t.id: self._complete_treatment(tid),
                            ),
                            ft.PopupMenuItem(
                                text="暫停療程",
                                icon=ft.Icons.PAUSE,
                                on_click=lambda e, tid=t.id: self._pause_treatment(tid),
                            ),
                            ft.PopupMenuItem(
                                text="終止療程",
                                icon=ft.Icons.CANCEL,
                                on_click=lambda e, tid=t.id: self._terminate_treatment(tid),
                            ),
                        ],
                    )
                elif t.status == "paused":
                    action_btn = ft.IconButton(
                        icon=ft.Icons.PLAY_ARROW,
                        icon_size=16,
                        tooltip="恢復療程",
                        on_click=lambda e, tid=t.id: self._resume_treatment(tid),
                    )
                
                treatment_items.append(
                    ft.Container(
                        bgcolor=SELATheme.BG,
                        border_radius=SELATheme.RADIUS_SM,
                        padding=ft.padding.symmetric(horizontal=12, vertical=8),
                        margin=ft.margin.only(bottom=4),
                        content=ft.Row([
                            ft.Container(
                                width=8,
                                height=8,
                                bgcolor=status_color,
                                border_radius=4,
                            ),
                            ft.Container(width=8),
                            ft.Container(
                                expand=True,
                                ink=True,
                                on_click=lambda e, tid=t.id: self._goto_treatment(tid),
                                content=ft.Column([
                                    ft.Text(t.treatment_name, size=13, weight=ft.FontWeight.BOLD),
                                    ft.Text(
                                        f"{t.treatment_start} · {t.status_label}",
                                        size=11,
                                        color=SELATheme.TEXT_SECONDARY,
                                    ),
                                ], spacing=2),
                            ),
                            action_btn if action_btn else ft.Icon(ft.Icons.CHEVRON_RIGHT, size=16, color=SELATheme.TEXT_HINT),
                        ]),
                    )
                )
        else:
            treatment_items.append(
                ft.Text("尚無療程記錄", size=12, color=SELATheme.TEXT_HINT)
            )
        
        def on_close(e):
            self.detail_dialog.open = False
            self.page.update()
        
        def on_edit(e):
            self.detail_dialog.open = False
            self.page.update()
            self._show_edit_dialog(patient)
        
        def on_delete(e):
            self.detail_dialog.open = False
            self.page.update()
            self._show_delete_confirm(patient)
        
        def on_new_treatment(e):
            self.detail_dialog.open = False
            self.page.update()
            self.main_view.show_patient_form(patient.medical_id)
        
        self.detail_dialog = ft.AlertDialog(
            title=ft.Row([
                ft.Text(
                    f"{patient.medical_id}",
                    weight=ft.FontWeight.BOLD,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Text(
                    patient.name,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Text(
                    patient.gender_label,
                    color=SELATheme.TEXT_SECONDARY,
                ),
            ], spacing=8),
            content=ft.Container(
                width=350,
                content=ft.Column([
                    # 基本資訊
                    ft.Container(
                        bgcolor=SELATheme.BG,
                        border_radius=SELATheme.RADIUS_SM,
                        padding=SELATheme.SPACE_MD,
                        content=ft.Column([
                            ft.Row([
                                ft.Text("建立時間", size=12, color=SELATheme.TEXT_SECONDARY, width=80),
                                ft.Text(
                                    str(patient.created_at)[:10] if patient.created_at else "-",
                                    size=12,
                                ),
                            ]),
                            ft.Row([
                                ft.Text("療程數", size=12, color=SELATheme.TEXT_SECONDARY, width=80),
                                ft.Text(
                                    str(len(patient.treatments) if patient.treatments else 0),
                                    size=12,
                                ),
                            ]),
                        ], spacing=8),
                    ),
                    ft.Container(height=8),
                    # 療程標題
                    ft.Row([
                        ft.Text("療程記錄", size=13, weight=ft.FontWeight.BOLD),
                        ft.Container(expand=True),
                        ft.TextButton(
                            "+ 新療程",
                            on_click=on_new_treatment,
                        ) if not patient.active_treatment else ft.Container(),
                    ]),
                    ft.Container(height=4),
                    # 療程列表
                    ft.Column(treatment_items, spacing=0),
                ], tight=True),
            ),
            actions=[
                ft.TextButton(
                    "刪除",
                    style=ft.ButtonStyle(color=SELATheme.DANGER),
                    on_click=on_delete,
                ),
                ft.TextButton("編輯", on_click=on_edit),
                ft.ElevatedButton("關閉", on_click=on_close),
            ],
        )
        
        self.page.overlay.append(self.detail_dialog)
        self.detail_dialog.open = True
        self.page.update()
    
    def _goto_treatment(self, treatment_id: int):
        """前往療程詳情"""
        if hasattr(self, 'detail_dialog'):
            self.detail_dialog.open = False
        self.page.update()
        self.main_view.show_treatment(treatment_id)
    
    def _show_edit_dialog(self, patient):
        """顯示編輯對話框"""
        name_field = ft.TextField(
            label="姓名",
            value=patient.name,
            border_radius=SELATheme.RADIUS_SM,
        )
        
        gender_group = ft.RadioGroup(
            value=patient.gender,
            content=ft.Row([
                ft.Radio(value="M", label="男"),
                ft.Radio(value="F", label="女"),
            ]),
        )
        
        def on_save(e):
            patient.name = name_field.value.strip()
            patient.gender = gender_group.value
            self.patient_service.update(patient)
            edit_dialog.open = False
            self.main_view.show_snack("已更新病人資料")
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_cancel(e):
            edit_dialog.open = False
            self.page.update()
        
        edit_dialog = ft.AlertDialog(
            title=ft.Text("編輯病人資料", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Text(f"病歷號：{patient.medical_id}", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Container(height=8),
                name_field,
                ft.Container(height=8),
                ft.Text("性別", size=12, color=SELATheme.TEXT_SECONDARY),
                gender_group,
            ], tight=True, width=280),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton(
                    "儲存",
                    on_click=on_save,
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(edit_dialog)
        edit_dialog.open = True
        self.page.update()
    
    def _show_delete_confirm(self, patient):
        """顯示刪除確認"""
        treatment_count = len(patient.treatments) if patient.treatments else 0
        
        def on_confirm(e):
            self.patient_service.delete(patient.id)
            confirm_dialog.open = False
            self.main_view.show_snack(f"已刪除 {patient.name}")
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_cancel(e):
            confirm_dialog.open = False
            self.page.update()
        
        confirm_dialog = ft.AlertDialog(
            title=ft.Row([
                ft.Icon(ft.Icons.WARNING, color=SELATheme.DANGER),
                ft.Text("確認刪除", font_family=SELATheme.FONT_FAMILY),
            ]),
            content=ft.Column([
                ft.Text(
                    f"確定要刪除 {patient.name}（{patient.medical_id}）嗎？",
                    size=14,
                ),
                ft.Container(height=8),
                ft.Container(
                    bgcolor="#FFF3E0",
                    border_radius=SELATheme.RADIUS_SM,
                    padding=SELATheme.SPACE_MD,
                    content=ft.Column([
                        ft.Text("⚠️ 此操作無法復原！", size=12, weight=ft.FontWeight.BOLD),
                        ft.Text(
                            f"將同時刪除 {treatment_count} 個療程及所有相關記錄",
                            size=12,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                    ], spacing=4),
                ),
            ], tight=True, width=300),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton(
                    "確認刪除",
                    on_click=on_confirm,
                    bgcolor=SELATheme.DANGER,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(confirm_dialog)
        confirm_dialog.open = True
        self.page.update()
    
    def _complete_treatment(self, treatment_id: int):
        """結束療程"""
        if hasattr(self, 'detail_dialog'):
            self.detail_dialog.open = False
        
        def on_confirm(e):
            from app.repositories.treatment_repository import TreatmentRepository
            repo = TreatmentRepository()
            repo.update_status(treatment_id, "completed", "TREATMENT_END")
            dialog.open = False
            self.main_view.show_snack("療程已結案")
            self.main_view.content_area.content = self.build()
            self.page.update()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("確認結案", font_family=SELATheme.FONT_FAMILY),
            content=ft.Text("確定要將此療程結案嗎？"),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton(
                    "確定結案",
                    on_click=on_confirm,
                    bgcolor=SELATheme.SUCCESS,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _pause_treatment(self, treatment_id: int):
        """暫停療程"""
        if hasattr(self, 'detail_dialog'):
            self.detail_dialog.open = False
        self._show_treatment_status_dialog(treatment_id, "暫停療程", "paused")
    
    def _terminate_treatment(self, treatment_id: int):
        """終止療程"""
        if hasattr(self, 'detail_dialog'):
            self.detail_dialog.open = False
        self._show_treatment_status_dialog(treatment_id, "終止療程", "terminated")
    
    def _resume_treatment(self, treatment_id: int):
        """恢復療程"""
        if hasattr(self, 'detail_dialog'):
            self.detail_dialog.open = False
        
        from app.repositories.treatment_repository import TreatmentRepository
        repo = TreatmentRepository()
        repo.update_status(treatment_id, "active")
        self.main_view.show_snack("療程已恢復")
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _show_treatment_status_dialog(self, treatment_id: int, title: str, new_status: str):
        """顯示療程狀態變更對話框"""
        from app.config.constants import PAUSE_REASONS, TERMINATE_REASONS
        
        reasons = PAUSE_REASONS if new_status == "paused" else TERMINATE_REASONS
        
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
                repo.update_status(treatment_id, new_status, reason_dropdown.value)
                dialog.open = False
                self.main_view.show_snack(f"療程已{title[:2]}")
                self.main_view.content_area.content = self.build()
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
