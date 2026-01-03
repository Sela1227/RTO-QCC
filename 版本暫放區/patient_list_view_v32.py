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
        
        # 搜尋過濾（支援部分匹配）
        if self.search_keyword:
            keyword = self.search_keyword.lower().strip()
            filtered_patients = []
            for p in patients:
                # 姓名匹配
                if keyword in p.name.lower():
                    filtered_patients.append(p)
                    continue
                # 病歷號完整匹配
                if keyword in p.medical_id.lower():
                    filtered_patients.append(p)
                    continue
                # 病歷號去除前導零匹配（輸入 123 可匹配 0000123）
                if keyword.isdigit():
                    medical_id_stripped = p.medical_id.lstrip('0')
                    keyword_stripped = keyword.lstrip('0')
                    if keyword_stripped and keyword_stripped in medical_id_stripped:
                        filtered_patients.append(p)
                        continue
                    # 或者關鍵字在病歷號的任何位置
                    if keyword in p.medical_id:
                        filtered_patients.append(p)
                        continue
            patients = filtered_patients
        
        # 搜尋框 - 改成按按鈕才搜尋
        self.search_field = ft.TextField(
            hint_text="搜尋病歷號或姓名...",
            prefix_icon=ft.Icons.SEARCH,
            border_radius=SELATheme.RADIUS_SM,
            height=44,
            text_size=14,
            value=self.search_keyword,
            on_submit=self._on_search_submit,  # 按 Enter 搜尋
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
                        ft.IconButton(
                            icon=ft.Icons.SEARCH,
                            tooltip="搜尋",
                            on_click=self._on_search_click,
                        ),
                        ft.IconButton(
                            icon=ft.Icons.CLEAR,
                            tooltip="清除",
                            on_click=self._on_clear_search,
                        ) if self.search_keyword else ft.Container(width=0),
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
    
    def _on_search_submit(self, e):
        """按 Enter 搜尋"""
        self.search_keyword = e.control.value
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _on_search_click(self, e):
        """按搜尋按鈕"""
        self.search_keyword = self.search_field.value
        self.main_view.content_area.content = self.build()
        self.page.update()
    
    def _on_clear_search(self, e):
        """清除搜尋"""
        self.search_keyword = ""
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
                            patient.medical_id_display,
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
                        ft.Text(
                            patient.age_display,
                            size=12,
                            color=SELATheme.TEXT_HINT,
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
            # 使用新療程表單（只需填療程資料）
            self.main_view.show_new_treatment_form(patient.id)
        
        # 只有在沒有未結束療程時才能開新療程
        can_new_treatment = patient.ongoing_treatment is None
        
        self.detail_dialog = ft.AlertDialog(
            title=ft.Row([
                ft.Text(
                    f"{patient.medical_id_display}",
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
                ft.Text(
                    patient.age_display,
                    color=SELATheme.TEXT_HINT,
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
                        ) if can_new_treatment else ft.Container(),
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
        """顯示編輯對話框（可編輯所有欄位）"""
        from datetime import date
        
        # 病歷號（只讀）
        medical_id_text = ft.Text(f"病歷號：{patient.medical_id_display}", size=13, color=SELATheme.TEXT_SECONDARY)
        
        name_field = ft.TextField(
            label="姓名",
            value=patient.name,
            width=200,
        )
        
        gender_group = ft.RadioGroup(
            value=patient.gender,
            content=ft.Row([
                ft.Radio(value="M", label="男"),
                ft.Radio(value="F", label="女"),
            ]),
        )
        
        # 生日
        birth_val = ""
        if patient.birth_date:
            if isinstance(patient.birth_date, date):
                birth_val = patient.birth_date.strftime("%Y%m%d")
            elif isinstance(patient.birth_date, str):
                birth_val = patient.birth_date.replace("-", "")[:8]
        
        birth_field = ft.TextField(
            label="生日（YYYYMMDD）",
            value=birth_val,
            width=200,
            max_length=8,
            hint_text="19900101",
            input_filter=ft.InputFilter(regex_string=r"[0-9]"),
        )
        
        age_text = ft.Text(f"（{patient.age} 歲）" if patient.age else "", size=11, color=SELATheme.TEXT_SECONDARY)
        
        def on_birth_change(e):
            val = birth_field.value
            if len(val) == 8:
                try:
                    y, m, d = int(val[:4]), int(val[4:6]), int(val[6:8])
                    bd = date(y, m, d)
                    age = (date.today() - bd).days // 365
                    age_text.value = f"（{age} 歲）"
                except:
                    age_text.value = "日期格式錯誤"
            else:
                age_text.value = ""
            self.page.update()
        
        birth_field.on_change = on_birth_change
        
        error_text = ft.Text("", color=SELATheme.DANGER, size=12, visible=False)
        
        def on_save(e):
            name = name_field.value.strip()
            gender = gender_group.value
            birth_val = birth_field.value.strip()
            
            if not name:
                error_text.value = "姓名不可空白"
                error_text.visible = True
                self.page.update()
                return
            
            # 處理生日
            birth_date = None
            if birth_val:
                if len(birth_val) == 8:
                    try:
                        y, m, d = int(birth_val[:4]), int(birth_val[4:6]), int(birth_val[6:8])
                        birth_date = date(y, m, d)
                    except:
                        error_text.value = "生日格式錯誤"
                        error_text.visible = True
                        self.page.update()
                        return
                else:
                    error_text.value = "生日需為8碼"
                    error_text.visible = True
                    self.page.update()
                    return
            
            patient.name = name
            patient.gender = gender
            patient.birth_date = birth_date
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
                medical_id_text,
                ft.Container(height=8),
                name_field,
                ft.Container(height=8),
                ft.Text("性別", size=12, color=SELATheme.TEXT_SECONDARY),
                gender_group,
                ft.Container(height=8),
                ft.Row([birth_field, age_text]),
                error_text,
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
        """顯示刪除確認（需輸入 4 碼確認碼）"""
        import random
        
        treatment_count = len(patient.treatments) if patient.treatments else 0
        confirm_code = str(random.randint(1000, 9999))
        
        confirm_field = ft.TextField(
            label=f"請輸入 {confirm_code} 確認",
            hint_text="輸入確認碼",
            width=180,
            text_align=ft.TextAlign.CENTER,
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        
        error_text = ft.Text("", color=SELATheme.DANGER, size=12, visible=False)
        
        def on_confirm(e):
            if confirm_field.value.strip() != confirm_code:
                error_text.value = "確認碼不符"
                error_text.visible = True
                self.page.update()
                return
            
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
                ft.Text(f"刪除 {patient.name}（{patient.medical_id_display}）？", size=13),
                ft.Text(f"將刪除 {treatment_count} 個療程及所有記錄", size=12, color=SELATheme.TEXT_HINT),
                ft.Container(height=8),
                confirm_field,
                error_text,
            ], tight=True, horizontal_alignment=ft.CrossAxisAlignment.CENTER),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("確認刪除", on_click=on_confirm, bgcolor=SELATheme.DANGER, color=ft.Colors.WHITE),
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
