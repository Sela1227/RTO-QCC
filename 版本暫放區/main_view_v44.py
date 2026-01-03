"""主視窗框架"""
import flet as ft
from app.config.theme import SELATheme
from app.services.tracking_service import TrackingService
from app.services.patient_service import PatientService


class MainView:
    """主視窗"""
    
    def __init__(self, page: ft.Page):
        self.page = page
        self.tracking_service = TrackingService()
        self.patient_service = PatientService()
        
        # 當前頁面索引
        self.current_index = 0
        
        # 子頁面（延遲載入）
        self._home_view = None
        self._tracking_view = None
        self._report_view = None
        self._settings_view = None
        self._patient_list_view = None
    
    @property
    def home_view(self):
        if self._home_view is None:
            from app.views.home_view import HomeView
            self._home_view = HomeView(self.page, self)
        return self._home_view
    
    @property
    def tracking_view(self):
        if self._tracking_view is None:
            from app.views.tracking_list_view import TrackingListView
            self._tracking_view = TrackingListView(self.page, self)
        return self._tracking_view
    
    @property
    def report_view(self):
        if self._report_view is None:
            from app.views.report_view import ReportView
            self._report_view = ReportView(self.page, self)
        return self._report_view
    
    @property
    def patient_list_view(self):
        if self._patient_list_view is None:
            from app.views.patient_list_view import PatientListView
            self._patient_list_view = PatientListView(self.page, self)
        return self._patient_list_view
    
    @property
    def settings_view(self):
        if self._settings_view is None:
            from app.views.settings_view import SettingsView
            self._settings_view = SettingsView(self.page, self)
        return self._settings_view
    
    def show(self):
        """顯示主畫面"""
        self.page.controls.clear()
        self._build_ui()
        self.page.update()
        
        # 檢查啟動時提醒
        self._check_startup_reminder()
    
    def _build_ui(self):
        """建立 UI"""
        # 內容區域
        self.content_area = ft.Container(
            expand=True,
            content=self.home_view.build(),
        )
        
        # 底部導航
        self.nav_bar = ft.NavigationBar(
            selected_index=0,
            on_change=self._on_nav_change,
            bgcolor=SELATheme.PANEL_RIGHT,
            height=65,
            destinations=[
                ft.NavigationBarDestination(
                    icon=ft.Icons.HOME_OUTLINED,
                    selected_icon=ft.Icons.HOME,
                    label="首頁",
                ),
                ft.NavigationBarDestination(
                    icon=ft.Icons.MONITOR_HEART_OUTLINED,
                    selected_icon=ft.Icons.MONITOR_HEART,
                    label="治療中",
                ),
                ft.NavigationBarDestination(
                    icon=ft.Icons.BAR_CHART_OUTLINED,
                    selected_icon=ft.Icons.BAR_CHART,
                    label="報表",
                ),
                ft.NavigationBarDestination(
                    icon=ft.Icons.FOLDER_SHARED_OUTLINED,
                    selected_icon=ft.Icons.FOLDER_SHARED,
                    label="病人",
                ),
                ft.NavigationBarDestination(
                    icon=ft.Icons.SETTINGS_OUTLINED,
                    selected_icon=ft.Icons.SETTINGS,
                    label="設定",
                ),
            ],
        )
        
        self.page.add(
            ft.Column([
                self.content_area,
                self.nav_bar,
            ], expand=True, spacing=0)
        )
    
    def _on_nav_change(self, e):
        """導航切換"""
        self.current_index = e.control.selected_index
        
        # 重建 view 以刷新資料
        if self.current_index == 0:
            self._home_view = None
        elif self.current_index == 1:
            self._tracking_view = None
        elif self.current_index == 2:
            self._report_view = None  # 也重建報表頁
        elif self.current_index == 3:
            self._patient_list_view = None
        
        views = [
            self.home_view,        # 0: 首頁
            self.tracking_view,    # 1: 治療中
            self.report_view,      # 2: 報表
            self.patient_list_view,# 3: 病人
            self.settings_view,    # 4: 設定
        ]
        self.content_area.content = views[self.current_index].build()
        self.page.update()
    
    def navigate_to(self, index: int):
        """跳轉到指定頁面"""
        self.current_index = index
        self.nav_bar.selected_index = index
        
        # 重建 view 以刷新
        if index == 0:
            self._home_view = None
        elif index == 1:
            self._tracking_view = None
        elif index == 2:
            self._report_view = None  # 也重建報表頁
        elif index == 3:
            self._patient_list_view = None
        
        views = [
            self.home_view,        # 0: 首頁
            self.tracking_view,    # 1: 治療中
            self.report_view,      # 2: 報表
            self.patient_list_view,# 3: 病人
            self.settings_view,    # 4: 設定
        ]
        self.content_area.content = views[index].build()
        self.page.update()
    
    def navigate_to_tracking_with_filter(self, filter_type: str):
        """跳轉到追蹤清單並設置篩選"""
        self.current_index = 1
        self.nav_bar.selected_index = 1
        
        # 重建 tracking view 並設置篩選
        self._tracking_view = None
        tracking = self.tracking_view
        
        # 設置篩選
        if filter_type in ["overdue", "pending", "intervention"]:
            tracking.current_filter = filter_type
        elif filter_type == "sdm":
            tracking.current_filter = "sdm"
        elif filter_type == "nutrition":
            tracking.current_filter = "nutrition"
        else:
            tracking.current_filter = "all"
        
        self.content_area.content = tracking.build()
        self.page.update()
    
    def show_patient_form(self, prefill_medical_id: str = None):
        """顯示新增病人對話框"""
        from app.services.patient_service import PatientService
        from app.services.treatment_service import TreatmentService
        from app.services.settings_service import SettingsService
        from app.config.constants import GENDER_OPTIONS, TREATMENT_INTENT, UNABLE_REASONS
        from datetime import date
        
        patient_service = PatientService()
        treatment_service = TreatmentService()
        settings_service = SettingsService()
        cancer_types = settings_service.get_cancer_types()
        
        # 表單欄位
        medical_id_field = ft.TextField(
            label="病歷號 *（7碼）",
            value=prefill_medical_id or "",
            width=200,
            max_length=7,
            input_filter=ft.InputFilter(regex_string=r"[0-9]"),
        )
        name_field = ft.TextField(label="姓名 *", width=200)
        gender_group = ft.RadioGroup(
            content=ft.Row([ft.Radio(value="M", label="男"), ft.Radio(value="F", label="女")]),
        )
        birth_field = ft.TextField(
            label="生日 *（YYYYMMDD）",
            width=200,
            max_length=8,
            hint_text="19900101",
            input_filter=ft.InputFilter(regex_string=r"[0-9]"),
        )
        age_text = ft.Text("", size=11, color=SELATheme.TEXT_SECONDARY)
        
        intent_dropdown = ft.Dropdown(
            label="治療目的 *",
            width=200,
            options=[ft.dropdown.Option(key=ti["code"], text=ti["label"]) for ti in TREATMENT_INTENT],
        )
        cancer_dropdown = ft.Dropdown(
            label="癌別 *",
            width=200,
            options=[ft.dropdown.Option(key=ct["code"], text=ct["label"]) for ct in cancer_types],
        )
        baseline_field = ft.TextField(
            label="基準體重 (kg)",
            width=120,
            keyboard_type=ft.KeyboardType.NUMBER,
        )
        
        # 無法測量
        unable_checkbox = ft.Checkbox(label="無法測量", value=False)
        unable_reason_dropdown = ft.Dropdown(
            label="原因",
            width=120,
            options=[ft.dropdown.Option(key=r["code"], text=r["label"]) for r in UNABLE_REASONS],
            visible=False,
        )
        
        def on_unable_change(e):
            unable_reason_dropdown.visible = unable_checkbox.value
            self.page.update()
        
        unable_checkbox.on_change = on_unable_change
        
        error_text = ft.Text("", color=SELATheme.DANGER, size=12, visible=False)
        
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
        
        def on_save(e):
            # 驗證
            mid = medical_id_field.value.strip().zfill(7)
            name = name_field.value.strip()
            gender = gender_group.value
            birth_val = birth_field.value.strip()
            intent = intent_dropdown.value
            cancer = cancer_dropdown.value
            baseline = baseline_field.value.strip()
            unable = unable_checkbox.value
            unable_reason = unable_reason_dropdown.value if unable else None
            
            if not all([mid, name, gender, birth_val, intent, cancer]):
                error_text.value = "請填寫所有必填欄位"
                error_text.visible = True
                self.page.update()
                return
            
            # 檢查體重或無法測量
            if not baseline and not unable:
                error_text.value = "請輸入基準體重或勾選無法測量"
                error_text.visible = True
                self.page.update()
                return
            
            if unable and not unable_reason:
                error_text.value = "請選擇無法測量原因"
                error_text.visible = True
                self.page.update()
                return
            
            if len(birth_val) != 8:
                error_text.value = "生日格式錯誤"
                error_text.visible = True
                self.page.update()
                return
            
            try:
                y, m, d = int(birth_val[:4]), int(birth_val[4:6]), int(birth_val[6:8])
                birth_date = date(y, m, d)
            except:
                error_text.value = "生日格式錯誤"
                error_text.visible = True
                self.page.update()
                return
            
            baseline_weight = None
            if baseline:
                try:
                    baseline_weight = float(baseline)
                except:
                    error_text.value = "體重格式錯誤"
                    error_text.visible = True
                    self.page.update()
                    return
            
            # 檢查病歷號
            existing = patient_service.get_by_medical_id(mid)
            if existing:
                error_text.value = "病歷號已存在"
                error_text.visible = True
                self.page.update()
                return
            
            # 使用 get_or_create 建立病人
            patient = patient_service.get_or_create(
                medical_id=mid,
                name=name,
                gender=gender,
                birth_date=birth_date,
            )
            
            # 使用 treatment_service.create 建立療程
            treatment = treatment_service.create(
                patient_id=patient.id,
                cancer_type=cancer,
                treatment_intent=intent,
                baseline_weight=baseline_weight,
                unable_to_measure=unable,
                unable_reason=unable_reason,
            )
            
            dialog.open = False
            self.show_snack(f"已新增 {name}")
            self.navigate_to(1)
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("新增病人", font_family=SELATheme.FONT_FAMILY),
            content=ft.Container(
                width=350,
                height=500,
                content=ft.Column([
                    ft.Text("基本資料", size=13, weight=ft.FontWeight.BOLD, color=SELATheme.TEXT_SECONDARY),
                    medical_id_field,
                    name_field,
                    ft.Row([ft.Text("性別 *", size=12), gender_group]),
                    ft.Row([birth_field, age_text]),
                    ft.Divider(),
                    ft.Text("療程資料", size=13, weight=ft.FontWeight.BOLD, color=SELATheme.TEXT_SECONDARY),
                    intent_dropdown,
                    cancer_dropdown,
                    ft.Row([baseline_field, unable_checkbox], vertical_alignment=ft.CrossAxisAlignment.CENTER),
                    unable_reason_dropdown,
                    error_text,
                ], spacing=8, scroll=ft.ScrollMode.AUTO),
            ),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("儲存", on_click=on_save, bgcolor=SELATheme.PRIMARY, color=ft.Colors.WHITE),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def show_treatment(self, treatment_id: int):
        """顯示療程詳情"""
        from app.views.treatment_view import TreatmentView
        treatment_view = TreatmentView(self.page, self, treatment_id)
        self.content_area.content = treatment_view.build()
        self.nav_bar.selected_index = None
        self.page.update()
    
    def show_weight_form(self, treatment_id: int):
        """顯示新增體重表單"""
        from app.views.weight_form_view import WeightFormView
        form_view = WeightFormView(self.page, self, treatment_id)
        self.content_area.content = form_view.build()
        self.nav_bar.selected_index = None
        self.page.update()
    
    def show_new_treatment_form(self, patient_id: int):
        """顯示舊病人開新療程表單"""
        from app.views.new_treatment_form_view import NewTreatmentFormView
        form_view = NewTreatmentFormView(self.page, self, patient_id)
        self.content_area.content = form_view.build()
        self.nav_bar.selected_index = None
        self.page.update()
    
    def show_patient_list(self):
        """顯示全部病人清單"""
        self.navigate_to(3)  # 導航到病人頁面
    
    def show_intervention_detail(self, treatment_id: int, intervention_type: str = None):
        """顯示介入詳情頁"""
        from app.views.intervention_detail_view import InterventionDetailView
        detail_view = InterventionDetailView(self.page, self, treatment_id, intervention_type)
        self.content_area.content = detail_view.build()
        self.nav_bar.selected_index = None
        self.page.update()
    
    def _check_startup_reminder(self):
        """啟動時檢查逾期提醒"""
        overdue = self.tracking_service.get_overdue_list()
        if overdue:
            self._show_overdue_dialog(overdue)
    
    def _show_overdue_dialog(self, overdue_list):
        """顯示逾期提醒對話框"""
        items = []
        for t in overdue_list[:5]:
            if t.patient:
                items.append(
                    ft.Text(
                        f"• {t.patient.medical_id} {t.patient.name}（{t.days_since_last} 天）",
                        size=12,
                        font_family=SELATheme.FONT_FAMILY,
                    )
                )
        
        if len(overdue_list) > 5:
            items.append(ft.Text(f"... 還有 {len(overdue_list) - 5} 位", size=11))
        
        def close_dialog(e):
            dialog.open = False
            self.page.update()
        
        def goto_tracking(e):
            dialog.open = False
            self.navigate_to(1)
        
        dialog = ft.AlertDialog(
            modal=True,
            title=ft.Row([
                ft.Icon(ft.Icons.WARNING_AMBER, color=SELATheme.WARNING),
                ft.Text("逾期提醒", font_family=SELATheme.FONT_FAMILY),
            ]),
            content=ft.Column([
                ft.Text(
                    f"目前有 {len(overdue_list)} 位病人超過一週未量體重",
                    size=13,
                    font_family=SELATheme.FONT_FAMILY,
                ),
                ft.Container(height=8),
                *items,
            ], tight=True),
            actions=[
                ft.TextButton("稍後提醒", on_click=close_dialog),
                ft.ElevatedButton(
                    "前往處理",
                    on_click=goto_tracking,
                    bgcolor=SELATheme.PRIMARY,
                    color=ft.Colors.WHITE,
                ),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def show_snack(self, msg: str):
        """顯示 Snackbar"""
        self.page.snack_bar = ft.SnackBar(
            ft.Text(msg, font_family=SELATheme.FONT_FAMILY)
        )
        self.page.snack_bar.open = True
        self.page.update()
