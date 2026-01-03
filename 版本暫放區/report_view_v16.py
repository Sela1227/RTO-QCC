"""報表頁"""
import flet as ft
from datetime import date, timedelta
from app.config.theme import SELATheme
from app.config.constants import CANCER_TYPES, TREATMENT_STATUS
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
        
        # 篩選條件
        self.filters = {
            "cancer_type": None,
            "exclude_unable": False,
            "status": None,
        }
    
    def build(self) -> ft.Control:
        """建立報表 UI"""
        try:
            # 取得統計數據
            summary = self.report_service.get_summary(self.start_date, self.end_date, self.filters)
            weight_dist = self.report_service.get_weight_distribution(self.start_date, self.end_date, self.filters)
            int_stats = self.report_service.get_intervention_stats(self.start_date, self.end_date, self.filters)
            tracking = self.report_service.get_tracking_quality(self.start_date, self.end_date, self.filters)
            cancer_data = self.report_service.get_cancer_analysis(self.start_date, self.end_date, self.filters)
        except Exception as e:
            # 如果有錯誤，顯示錯誤訊息
            return ft.Container(
                expand=True,
                bgcolor=SELATheme.BG,
                padding=SELATheme.SPACE_LG,
                content=ft.Column([
                    ft.Text("統計報表", size=20, weight=ft.FontWeight.BOLD),
                    ft.Container(height=20),
                    ft.Text(f"載入報表時發生錯誤：{str(e)}", color=SELATheme.DANGER),
                ]),
            )
        
        # 日期顯示
        date_text = f"{self.start_date.strftime('%Y/%m/%d')} ~ {self.end_date.strftime('%Y/%m/%d')}"
        
        # 篩選標籤
        filter_labels = []
        if self.filters.get("cancer_type"):
            for ct in CANCER_TYPES:
                if ct["code"] == self.filters["cancer_type"]:
                    filter_labels.append(ct["label"])
                    break
        if self.filters.get("exclude_unable"):
            filter_labels.append("排除無法測量")
        if self.filters.get("status"):
            for st in TREATMENT_STATUS:
                if st["code"] == self.filters["status"]:
                    filter_labels.append(st["label"])
                    break
        
        filter_text = f"篩選：{', '.join(filter_labels)}" if filter_labels else ""
        
        # 快速選項
        preset_chips = ft.Row([
            self._build_preset_chip("this_week", "本週"),
            self._build_preset_chip("this_month", "本月"),
            self._build_preset_chip("last_month", "上月"),
            self._build_preset_chip("last_3_months", "近三月"),
        ], spacing=8, scroll=ft.ScrollMode.AUTO)
        
        return ft.Container(
            expand=True,
            bgcolor=SELATheme.BG,
            content=ft.Column([
                # 標題列
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16, vertical=8),
                    content=ft.Row([
                        ft.Text("統計報表", size=18, weight=ft.FontWeight.BOLD, font_family=SELATheme.FONT_FAMILY),
                        ft.Container(expand=True),
                        ft.IconButton(icon=ft.Icons.FILTER_LIST, tooltip="篩選", on_click=self._show_filter_dialog),
                        ft.IconButton(icon=ft.Icons.DOWNLOAD, tooltip="匯出", on_click=self._on_export),
                    ]),
                ),
                # 日期選擇
                ft.Container(
                    padding=ft.padding.symmetric(horizontal=16),
                    content=ft.Column([
                        ft.Row([
                            ft.Text(date_text, size=13, weight=ft.FontWeight.BOLD),
                            ft.TextButton("改", on_click=self._show_date_picker),
                        ]),
                        preset_chips,
                        ft.Text(filter_text, size=11, color=SELATheme.TEXT_HINT) if filter_text else ft.Container(),
                    ], spacing=6),
                ),
                ft.Container(height=8),
                # 內容區
                ft.Container(
                    expand=True,
                    padding=ft.padding.symmetric(horizontal=16),
                    content=ft.Column([
                        # 基本統計
                        self._build_basic_stats(summary),
                        ft.Container(height=16),
                        # 體重變化分布
                        self._build_weight_distribution(weight_dist),
                        ft.Container(height=16),
                        # 介入執行率
                        self._build_intervention_stats(int_stats),
                        ft.Container(height=16),
                        # 追蹤品質
                        self._build_tracking_quality(tracking),
                        ft.Container(height=16),
                        # 癌別分析
                        self._build_cancer_analysis(cancer_data),
                        ft.Container(height=32),
                    ], scroll=ft.ScrollMode.AUTO),
                ),
            ], spacing=0, expand=True),
        )
    
    def _build_preset_chip(self, code: str, label: str) -> ft.Control:
        """建立快速選項標籤"""
        selected = self.selected_preset == code
        return ft.Container(
            bgcolor=SELATheme.PRIMARY if selected else SELATheme.SURFACE,
            border_radius=16,
            padding=ft.padding.symmetric(horizontal=10, vertical=4),
            ink=True,
            on_click=lambda e, c=code: self._on_preset_change(c),
            content=ft.Text(label, size=11, color=ft.Colors.WHITE if selected else SELATheme.TEXT_PRIMARY),
        )
    
    def _build_basic_stats(self, summary: dict) -> ft.Control:
        """建立基本統計"""
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Text("基本統計", size=14, weight=ft.FontWeight.BOLD),
                ft.Container(height=8),
                ft.Row([
                    self._build_stat_item("👤", "新病人", summary["new_patients"]),
                    self._build_stat_item("📋", "新療程", summary["new_treatments"]),
                    self._build_stat_item("⚖️", "量體重", summary["weight_records"]),
                    self._build_stat_item("✅", "結案", summary["completed_treatments"]),
                ], alignment=ft.MainAxisAlignment.SPACE_AROUND),
            ]),
        )
    
    def _build_stat_item(self, icon: str, label: str, value: int) -> ft.Control:
        """建立統計項目"""
        return ft.Column([
            ft.Text(icon, size=18),
            ft.Text(str(value), size=18, weight=ft.FontWeight.BOLD, color=SELATheme.PRIMARY if value > 0 else SELATheme.TEXT_HINT),
            ft.Text(label, size=10, color=SELATheme.TEXT_SECONDARY),
        ], horizontal_alignment=ft.CrossAxisAlignment.CENTER, spacing=2)
    
    def _build_weight_distribution(self, dist: dict) -> ft.Control:
        """建立體重變化分布圖"""
        total = dist["total"] or 1
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Text("體重變化分布", size=14, weight=ft.FontWeight.BOLD),
                ft.Container(height=12),
                # 長條圖
                self._build_bar("下降≥5%（營養師）", dist["severe_loss"], total, SELATheme.DANGER),
                ft.Container(height=6),
                self._build_bar("下降3-5%（SDM）", dist["moderate_loss"], total, SELATheme.WARNING),
                ft.Container(height=6),
                self._build_bar("維持/上升", dist["maintained"], total, SELATheme.SUCCESS),
                ft.Container(height=8),
                ft.Text(f"共 {total} 筆療程", size=11, color=SELATheme.TEXT_HINT),
            ]),
        )
    
    def _build_bar(self, label: str, value: int, total: int, color: str) -> ft.Control:
        """建立長條"""
        pct = value / total * 100 if total > 0 else 0
        return ft.Column([
            ft.Row([
                ft.Text(label, size=11, width=140),
                ft.Text(f"{value} 人 ({pct:.0f}%)", size=11, color=SELATheme.TEXT_SECONDARY),
            ]),
            ft.Container(
                width=300,
                height=16,
                bgcolor="#E0E0E0",
                border_radius=8,
                content=ft.Container(
                    width=max(4, 300 * pct / 100),
                    height=16,
                    bgcolor=color,
                    border_radius=8,
                ),
            ),
        ], spacing=2)
    
    def _build_intervention_stats(self, stats: dict) -> ft.Control:
        """建立介入執行率"""
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Text("介入執行率", size=14, weight=ft.FontWeight.BOLD),
                ft.Container(height=12),
                # SDM
                ft.Row([
                    ft.Text("💬 SDM", size=12, width=100),
                    ft.Container(
                        width=150,
                        height=20,
                        bgcolor="#E0E0E0",
                        border_radius=10,
                        content=ft.Container(
                            width=max(4, 150 * stats["sdm"]["rate"] / 100),
                            height=20,
                            bgcolor=SELATheme.WARNING,
                            border_radius=10,
                        ),
                    ),
                    ft.Text(f"{stats['sdm']['rate']:.0f}%", size=12, weight=ft.FontWeight.BOLD),
                    ft.Text(f"({stats['sdm']['completed']}/{stats['sdm']['total']})", size=11, color=SELATheme.TEXT_HINT),
                ], spacing=8),
                ft.Container(height=8),
                # 營養師
                ft.Row([
                    ft.Text("🍎 營養師", size=12, width=100),
                    ft.Container(
                        width=150,
                        height=20,
                        bgcolor="#E0E0E0",
                        border_radius=10,
                        content=ft.Container(
                            width=max(4, 150 * stats["nutrition"]["rate"] / 100),
                            height=20,
                            bgcolor=SELATheme.DANGER,
                            border_radius=10,
                        ),
                    ),
                    ft.Text(f"{stats['nutrition']['rate']:.0f}%", size=12, weight=ft.FontWeight.BOLD),
                    ft.Text(f"({stats['nutrition']['completed']}/{stats['nutrition']['total']})", size=11, color=SELATheme.TEXT_HINT),
                ], spacing=8),
            ]),
        )
    
    def _build_tracking_quality(self, tracking: dict) -> ft.Control:
        """建立追蹤品質"""
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Text("追蹤品質", size=14, weight=ft.FontWeight.BOLD),
                ft.Container(height=8),
                ft.Row([
                    ft.Column([
                        ft.Text(f"{tracking['on_time_rate']:.0f}%", size=24, weight=ft.FontWeight.BOLD, color=SELATheme.SUCCESS),
                        ft.Text("按時量測率", size=11, color=SELATheme.TEXT_SECONDARY),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                    ft.Container(width=40),
                    ft.Column([
                        ft.Text(f"{tracking['avg_interval']:.1f} 天", size=24, weight=ft.FontWeight.BOLD, color=SELATheme.INFO),
                        ft.Text("平均間隔", size=11, color=SELATheme.TEXT_SECONDARY),
                    ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
                ], alignment=ft.MainAxisAlignment.CENTER),
            ]),
        )
    
    def _build_cancer_analysis(self, data: list) -> ft.Control:
        """建立癌別分析"""
        if not data:
            return ft.Container()
        
        rows = []
        for cd in data[:6]:  # 只顯示前 6 個
            rate_color = SELATheme.SUCCESS
            if cd["avg_change_rate"] <= -5:
                rate_color = SELATheme.DANGER
            elif cd["avg_change_rate"] <= -3:
                rate_color = SELATheme.WARNING
            
            rows.append(
                ft.Container(
                    padding=ft.padding.symmetric(vertical=4),
                    content=ft.Row([
                        ft.Text(cd["label"], size=12, width=60),
                        ft.Text(f"{cd['count']}人", size=11, width=40, color=SELATheme.TEXT_SECONDARY),
                        ft.Text(f"{cd['avg_change_rate']:+.1f}%", size=11, width=50, color=rate_color),
                        ft.Text(f"介入{cd['intervention_rate']:.0f}%", size=11, color=SELATheme.TEXT_HINT),
                    ]),
                )
            )
        
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            content=ft.Column([
                ft.Text("癌別分析", size=14, weight=ft.FontWeight.BOLD),
                ft.Container(height=8),
                ft.Row([
                    ft.Text("癌別", size=10, width=60, color=SELATheme.TEXT_HINT),
                    ft.Text("人數", size=10, width=40, color=SELATheme.TEXT_HINT),
                    ft.Text("平均變化", size=10, width=50, color=SELATheme.TEXT_HINT),
                    ft.Text("介入率", size=10, color=SELATheme.TEXT_HINT),
                ]),
                ft.Divider(height=1),
                *rows,
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
        
        self.selected_preset = code
        self._refresh()
    
    def _show_date_picker(self, e):
        """顯示日期選擇"""
        temp_start = self.start_date
        temp_end = self.end_date
        
        start_text = ft.Text(f"開始：{temp_start}")
        end_text = ft.Text(f"結束：{temp_end}")
        
        def pick_start(e):
            nonlocal temp_start
            def on_change(e):
                nonlocal temp_start
                if picker.value:
                    temp_start = picker.value.date() if hasattr(picker.value, 'date') else picker.value
                    start_text.value = f"開始：{temp_start}"
                    self.page.update()
            picker = ft.DatePicker(value=temp_start, on_change=on_change)
            self.page.open(picker)
        
        def pick_end(e):
            nonlocal temp_end
            def on_change(e):
                nonlocal temp_end
                if picker.value:
                    temp_end = picker.value.date() if hasattr(picker.value, 'date') else picker.value
                    end_text.value = f"結束：{temp_end}"
                    self.page.update()
            picker = ft.DatePicker(value=temp_end, on_change=on_change)
            self.page.open(picker)
        
        def on_confirm(e):
            self.start_date = temp_start
            self.end_date = temp_end
            self.selected_preset = "custom"
            dialog.open = False
            self._refresh()
        
        dialog = ft.AlertDialog(
            title=ft.Text("選擇日期", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                ft.Row([start_text, ft.TextButton("選", on_click=pick_start)]),
                ft.Row([end_text, ft.TextButton("選", on_click=pick_end)]),
            ], tight=True),
            actions=[
                ft.TextButton("取消", on_click=lambda e: setattr(dialog, 'open', False) or self.page.update()),
                ft.ElevatedButton("確定", on_click=on_confirm),
            ],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _show_filter_dialog(self, e):
        """顯示篩選對話框"""
        cancer_dropdown = ft.Dropdown(
            label="癌別",
            options=[ft.dropdown.Option(key="", text="全部")] + [
                ft.dropdown.Option(key=ct["code"], text=ct["label"])
                for ct in CANCER_TYPES
            ],
            value=self.filters.get("cancer_type") or "",
            width=200,
        )
        
        status_dropdown = ft.Dropdown(
            label="療程狀態",
            options=[ft.dropdown.Option(key="", text="全部")] + [
                ft.dropdown.Option(key=st["code"], text=st["label"])
                for st in TREATMENT_STATUS
            ],
            value=self.filters.get("status") or "",
            width=200,
        )
        
        exclude_unable = ft.Checkbox(
            label="排除無法測量",
            value=self.filters.get("exclude_unable", False),
        )
        
        def on_reset(e):
            cancer_dropdown.value = ""
            status_dropdown.value = ""
            exclude_unable.value = False
            self.page.update()
        
        def on_confirm(e):
            self.filters["cancer_type"] = cancer_dropdown.value or None
            self.filters["status"] = status_dropdown.value or None
            self.filters["exclude_unable"] = exclude_unable.value
            dialog.open = False
            self._refresh()
        
        dialog = ft.AlertDialog(
            title=ft.Text("篩選條件", font_family=SELATheme.FONT_FAMILY),
            content=ft.Column([
                cancer_dropdown,
                ft.Container(height=8),
                status_dropdown,
                ft.Container(height=8),
                exclude_unable,
            ], tight=True),
            actions=[
                ft.TextButton("重設", on_click=on_reset),
                ft.TextButton("取消", on_click=lambda e: setattr(dialog, 'open', False) or self.page.update()),
                ft.ElevatedButton("套用", on_click=on_confirm),
            ],
        )
        self.page.overlay.append(dialog)
        dialog.open = True
        self.page.update()
    
    def _on_export(self, e):
        """匯出 Excel"""
        import os
        
        filename = f"體重追蹤報表_{self.start_date.strftime('%Y%m%d')}_{self.end_date.strftime('%Y%m%d')}.xlsx"
        docs_path = os.path.expanduser("~/Documents")
        if not os.path.exists(docs_path):
            docs_path = os.path.expanduser("~")
        
        filepath = os.path.join(docs_path, filename)
        success = self.report_service.export_to_excel(self.start_date, self.end_date, filepath, self.filters)
        
        if success:
            self.main_view.show_snack(f"已匯出：{filename}")
        else:
            self.main_view.show_snack("匯出失敗")
    
    def _refresh(self):
        """刷新頁面"""
        self.main_view.content_area.content = self.build()
        self.page.update()
