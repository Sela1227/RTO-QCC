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
    
    def show_patient_form(self, prefill_medical_id: str = None):
        """顯示新增病人表單"""
        from app.views.patient_form_view import PatientFormView
        form_view = PatientFormView(self.page, self, prefill_medical_id)
        self.content_area.content = form_view.build()
        self.nav_bar.selected_index = None  # 取消選取
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
