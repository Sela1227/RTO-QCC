"""報表頁"""
import flet as ft
from datetime import date, timedelta
from app.config.theme import SELATheme
from app.services.report_service import ReportService


class ReportView:
    """報表頁"""
    
    def __init__(self, page: ft.Page, main_view):
        self.page = page
        self.main_view = main_view
        self.report_service = ReportService()
        
        # 預設日期範圍（本月）
        today = date.today()
        self.start_date = today.replace(day=1)
        self.end_date = today
        self.selected_preset = "this_month"
    
    def build(self) -> ft.Control:
        """建立報表 UI"""
        summary = self.report_service.get_summary(self.start_date, self.end_date)
        
        # 日期顯示
        self.date_range_text = ft.Text(
            f"{self.start_date.strftime('%Y/%m/%d')} ~ {self.end_date.strftime('%Y/%m/%d')}",
            size=14,
            weight=ft.FontWeight.BOLD,
        )
        
        # 快速選項
        preset_chips = ft.Row([
            self._build_preset_chip("this_week", "本週"),
            self._build_preset_chip("this_month", "本月"),
            self._build_preset_chip("last_month", "上月"),
            self._build_preset_chip("last_3_months", "近三月"),
            self._build_preset_chip("custom", "自訂"),
        ], spacing=8, scroll=ft.ScrollMode.AUTO)
        
        # 統計卡片
        stat_cards = ft.Row([
            self._build_stat_card("👤", "新病人", summary["new_patients"], SELATheme.PRIMARY),
            self._build_stat_card("📋", "新療程", summary["new_treatments"], SELATheme.SUCCESS),
            self._build_stat_card("⚖️", "量體重", summary["weight_records"], SELATheme.INFO),
        ], alignment=ft.MainAxisAlignment.SPACE_AROUND)
        
        stat_cards_2 = ft.Row([
            self._build_stat_card("💬", "SDM", summary["sdm_completed"], SELATheme.WARNING),
            self._build_stat_card("🍎", "營養師", summary["nutrition_completed"], SELATheme.DANGER),
            self._build_stat_card("✅", "結案", summary["completed_treatments"], SELATheme.TEXT_HINT),
        ], alignment=ft.MainAxisAlignment.SPACE_AROUND)
        
        # 詳細報表區
        treatments = self.report_service.get_treatment_report(self.start_date, self.end_date)
        
        if treatments:
            treatment_list = ft.ListView(
                controls=[self._build_treatment_item(t) for t in treatments[:20]],
                spacing=4,
                height=200,
            )
        else:
            treatment_list = ft.Container(
                height=100,
                content=ft.Text("此期間無療程資料", color=SELATheme.TEXT_HINT),
                alignment=ft.alignment.center,
            )
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                # 標題
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16, vertical=12),
                    content=ft.Text(
                        "統計報表",
                        size=18,
                        weight=ft.FontWeight.BOLD,
                        font_family=SELATheme.FONT_FAMILY,
                    ),
                ),
                # 日期選擇
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16),
                    content=ft.Column([
                        ft.Row([
                            self.date_range_text,
                            ft.Container(expand=True),
                            ft.IconButton(
                                icon=ft.Icons.CALENDAR_MONTH,
                                tooltip="選擇日期",
                                on_click=self._show_date_range_picker,
                            ),
                        ]),
                        preset_chips,
                    ], spacing=8),
                ),
                ft.Container(height=16),
                # 統計卡片
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16),
                    content=ft.Column([
                        stat_cards,
                        ft.Container(height=8),
                        stat_cards_2,
                    ]),
                ),
                ft.Container(height=16),
                # 匯出按鈕
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16),
                    content=ft.ElevatedButton(
                        "📥 匯出 Excel",
                        icon=ft.Icons.DOWNLOAD,
                        on_click=self._on_export,
                        bgcolor=SELATheme.SUCCESS,
                        color=ft.Colors.WHITE,
                    ),
                ),
                ft.Container(height=16),
                # 療程列表
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16),
                    content=ft.Column([
                        ft.Text(
                            f"療程清單（{len(treatments)} 筆）",
                            size=14,
                            weight=ft.FontWeight.BOLD,
                        ),
                        ft.Container(height=8),
                        treatment_list,
                    ]),
                ),
            ], scroll=ft.ScrollMode.AUTO, expand=True),
        )
    
    def _build_preset_chip(self, code: str, label: str) -> ft.Control:
        """建立快速選項標籤"""
        selected = self.selected_preset == code
        return ft.Container(
            bgcolor=SELATheme.PRIMARY if selected else SELATheme.SURFACE,
            border_radius=16,
            padding=ft.padding.symmetric(horizontal=12, vertical=6),
            ink=True,
            on_click=lambda e, c=code: self._on_preset_change(c),
            content=ft.Text(
                label,
                size=12,
                color=ft.Colors.WHITE if selected else SELATheme.TEXT_PRIMARY,
            ),
        )
    
    def _build_stat_card(self, icon: str, label: str, value: int, color: str) -> ft.Control:
        """建立統計卡片"""
        return ft.Container(
            width=100,
            height=80,
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_SM,
            content=ft.Column([
                ft.Text(icon, size=16),
                ft.Text(
                    str(value),
                    size=20,
                    weight=ft.FontWeight.BOLD,
                    color=color if value > 0 else SELATheme.TEXT_HINT,
                ),
                ft.Text(label, size=11, color=SELATheme.TEXT_SECONDARY),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER,
               alignment=ft.MainAxisAlignment.CENTER,
               spacing=2),
        )
    
    def _build_treatment_item(self, t: dict) -> ft.Control:
        """建立療程項目"""
        from app.config.constants import CANCER_TYPES, TREATMENT_STATUS, get_label
        
        status_color = {
            "active": SELATheme.SUCCESS,
            "paused": SELATheme.WARNING,
            "terminated": SELATheme.DANGER,
            "completed": SELATheme.TEXT_HINT,
        }.get(t["status"], SELATheme.TEXT_HINT)
        
        # 變化率顏色（負數=下降，正數=上升）
        change_rate = t["change_rate"] or 0
        change_color = SELATheme.TEXT_SECONDARY
        if change_rate <= -5:  # 下降 5% 以上
            change_color = SELATheme.DANGER
        elif change_rate <= -3:  # 下降 3% 以上
            change_color = SELATheme.WARNING
        
        # 體重顯示文字
        baseline = float(t["baseline_weight"]) if t["baseline_weight"] else 0
        last_weight = t["last_weight"]
        if last_weight:
            weight_text = f"{baseline:.1f}→{float(last_weight):.1f}kg"
        else:
            weight_text = f"{baseline:.1f}→- kg"
        
        # 變化率文字
        if change_rate:
            change_text = f"({change_rate:+.1f}%)"
        else:
            change_text = ""
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_SM,
            padding=ft.padding.symmetric(horizontal=12, vertical=8),
            content=ft.Row([
                ft.Container(
                    width=6,
                    height=40,
                    bgcolor=status_color,
                    border_radius=3,
                ),
                ft.Container(width=8),
                ft.Column([
                    ft.Row([
                        ft.Text(t["medical_id"], size=12, weight=ft.FontWeight.BOLD),
                        ft.Text(t["name"], size=12),
                        ft.Text(
                            get_label(CANCER_TYPES, t["cancer_type"]),
                            size=11,
                            color=SELATheme.TEXT_SECONDARY,
                        ),
                    ], spacing=6),
                    ft.Row([
                        ft.Text(weight_text, size=11, color=SELATheme.TEXT_SECONDARY),
                        ft.Text(change_text, size=11, color=change_color),
                        ft.Text(f"量{t['weight_count']}次", size=11, color=SELATheme.TEXT_HINT),
                    ], spacing=6),
                ], spacing=2, expand=True),
            ]),
        )
    
    def _on_preset_change(self, code: str):
        """快速選項變更"""
        today = date.today()
        
        if code == "this_week":
            self.start_date = today - timedelta(days=today.weekday())
            self.end_date = today
        elif code == "this_month":
            self.start_date = today.replace(day=1)
            self.end_date = today
        elif code == "last_month":
            last_month = today.replace(day=1) - timedelta(days=1)
            self.start_date = last_month.replace(day=1)
            self.end_date = last_month
        elif code == "last_3_months":
            self.start_date = today - timedelta(days=90)
            self.end_date = today
        elif code == "custom":
            self._show_date_range_picker(None)
            return
        
        self.selected_preset = code
        self._refresh()
    
    def _show_date_range_picker(self, e):
        """顯示日期範圍選擇器"""
        start_text = ft.Text(f"開始：{self.start_date.strftime('%Y-%m-%d')}")
        end_text = ft.Text(f"結束：{self.end_date.strftime('%Y-%m-%d')}")
        
        temp_start = self.start_date
        temp_end = self.end_date
        
        def show_start_picker(e):
            nonlocal temp_start
            
            def on_change(e):
                nonlocal temp_start
                if picker.value:
                    picked = picker.value
                    if hasattr(picked, 'date'):
                        temp_start = picked.date()
                    else:
                        temp_start = picked
                    start_text.value = f"開始：{temp_start.strftime('%Y-%m-%d')}"
                    self.page.update()
            
            picker = ft.DatePicker(
                first_date=date(2020, 1, 1),
                last_date=date.today(),
                value=temp_start,
                on_change=on_change,
            )
            self.page.open(picker)
        
        def show_end_picker(e):
            nonlocal temp_end
            
            def on_change(e):
                nonlocal temp_end
                if picker.value:
                    picked = picker.value
                    if hasattr(picked, 'date'):
                        temp_end = picked.date()
                    else:
                        temp_end = picked
                    end_text.value = f"結束：{temp_end.strftime('%Y-%m-%d')}"
                    self.page.update()
            
            picker = ft.DatePicker(
                first_date=date(2020, 1, 1),
                last_date=date.today(),
                value=temp_end,
                on_change=on_change,
            )
            self.page.open(picker)
        
        def on_confirm(e):
            nonlocal temp_start, temp_end
            self.start_date = temp_start
            self.end_date = temp_end
            self.selected_preset = "custom"
            dialog.open = False
            self._refresh()
        
        def on_cancel(e):
            dialog.open = False
            self.page.update()
        
        dialog = ft.AlertDialog(
            title=ft.Text("選擇日期範圍", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Row([
                    start_text,
                    ft.IconButton(icon=ft.Icons.EDIT_CALENDAR, on_click=show_start_picker),
                ]),
                ft.Row([
                    end_text,
                    ft.IconButton(icon=ft.Icons.EDIT_CALENDAR, on_click=show_end_picker),
                ]),
            ], tight=True, width=250),
            actions=[
                ft.TextButton("取消", on_click=on_cancel),
                ft.ElevatedButton("確定", on_click=on_confirm),
            ],
        )
        
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _on_export(self, e):
        """匯出 Excel"""
        import os
        
        # 檔案名稱
        filename = f"體重追蹤報表_{self.start_date.strftime('%Y%m%d')}_{self.end_date.strftime('%Y%m%d')}.xlsx"
        
        # 儲存位置（使用者文件夾）
        docs_path = os.path.expanduser("~/Documents")
        if not os.path.exists(docs_path):
            docs_path = os.path.expanduser("~")
        
        filepath = os.path.join(docs_path, filename)
        
        success = self.report_service.export_to_excel(self.start_date, self.end_date, filepath)
        
        if success:
            self.main_view.show_snack(f"已匯出：{filename}")
        else:
            self.main_view.show_snack("匯出失敗，請確認 openpyxl 已安裝")
    
    def _refresh(self):
        """刷新頁面"""
        self.main_view.content_area.content = self.build()
        self.page.update()
