"""體重趨勢圖元件"""
import flet as ft
import matplotlib
matplotlib.use('Agg')  # 非互動模式
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.figure import Figure
from datetime import date, timedelta
import io
import base64
from typing import List
from app.models.weight_record import WeightRecord
from app.config.theme import SELATheme


class WeightChartComponent:
    """體重趨勢圖"""
    
    def __init__(self, baseline_weight: float, records: List[WeightRecord]):
        self.baseline = baseline_weight
        self.records = records
        self.sdm_threshold = 0.97  # 3%
        self.nutrition_threshold = 0.95  # 5%
    
    def build(self, width: int = 380, height: int = 220) -> ft.Control:
        """建立圖表控制項"""
        if len(self.records) < 2:
            return self._build_placeholder()
        
        # 產生圖表
        img_base64 = self._generate_chart(width, height)
        
        if img_base64:
            return ft.Container(
                bgcolor=SELATheme.SURFACE,
                border_radius=SELATheme.RADIUS_MD,
                padding=SELATheme.SPACE_SM,
                content=ft.Image(
                    src_base64=img_base64,
                    width=width,
                    height=height,
                    fit=ft.ImageFit.CONTAIN,
                ),
            )
        else:
            return self._build_placeholder()
    
    def _build_placeholder(self) -> ft.Control:
        """資料不足時的佔位"""
        return ft.Container(
            bgcolor=SELATheme.SURFACE,
            border_radius=SELATheme.RADIUS_MD,
            padding=SELATheme.SPACE_MD,
            height=120,
            content=ft.Column([
                ft.Text("📈 體重趨勢", size=12, color=SELATheme.TEXT_SECONDARY),
                ft.Container(expand=True),
                ft.Text(
                    "資料不足，需要至少 2 筆記錄",
                    size=12,
                    color=SELATheme.TEXT_HINT,
                ),
            ], horizontal_alignment=ft.CrossAxisAlignment.CENTER),
        )
    
    def _generate_chart(self, width: int, height: int) -> str:
        """產生圖表，返回 base64"""
        try:
            # 設定中文字體
            plt.rcParams['font.sans-serif'] = ['Microsoft JhengHei', 'SimHei', 'Arial Unicode MS']
            plt.rcParams['axes.unicode_minus'] = False
            
            # 準備資料（按日期排序）
            sorted_records = sorted(self.records, key=lambda r: self._parse_date(r.measure_date))
            
            dates = [self._parse_date(r.measure_date) for r in sorted_records]
            weights = [r.weight for r in sorted_records]
            
            # 建立圖表
            fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
            fig.patch.set_facecolor('#FFFFFF')
            ax.set_facecolor('#FAFAFA')
            
            # 繪製警戒線
            sdm_line = self.baseline * self.sdm_threshold
            nutrition_line = self.baseline * self.nutrition_threshold
            
            ax.axhline(y=self.baseline, color='#4CAF50', linestyle='--', 
                      linewidth=1, alpha=0.7, label=f'基準 {self.baseline:.1f}')
            ax.axhline(y=sdm_line, color='#FF9800', linestyle='--', 
                      linewidth=1, alpha=0.7, label=f'SDM {sdm_line:.1f}')
            ax.axhline(y=nutrition_line, color='#F44336', linestyle='--', 
                      linewidth=1, alpha=0.7, label=f'營養師 {nutrition_line:.1f}')
            
            # 繪製體重曲線
            ax.plot(dates, weights, 'o-', color='#2196F3', linewidth=2, 
                   markersize=6, markerfacecolor='white', markeredgewidth=2)
            
            # 標記警示點
            for i, (d, w) in enumerate(zip(dates, weights)):
                if w <= nutrition_line:
                    ax.plot(d, w, 'o', color='#F44336', markersize=10, zorder=5)
                elif w <= sdm_line:
                    ax.plot(d, w, 'o', color='#FF9800', markersize=10, zorder=5)
            
            # 格式化 X 軸
            if len(dates) <= 7:
                ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            else:
                ax.xaxis.set_major_locator(mdates.AutoDateLocator())
                ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
            
            plt.xticks(rotation=45, ha='right', fontsize=8)
            plt.yticks(fontsize=8)
            
            # Y 軸範圍
            y_min = min(weights + [nutrition_line]) - 1
            y_max = max(weights + [self.baseline]) + 1
            ax.set_ylim(y_min, y_max)
            
            # 標籤
            ax.set_ylabel('體重 (kg)', fontsize=9)
            
            # 圖例
            ax.legend(loc='upper right', fontsize=7, framealpha=0.9)
            
            # 格線
            ax.grid(True, linestyle=':', alpha=0.5)
            
            # 緊湊佈局
            plt.tight_layout()
            
            # 輸出為 base64
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', 
                       facecolor='white', edgecolor='none')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            
            plt.close(fig)
            return img_base64
            
        except Exception as e:
            print(f"圖表產生失敗: {e}")
            plt.close('all')
            return None
    
    def _parse_date(self, d) -> date:
        """解析日期"""
        if isinstance(d, date):
            return d
        if isinstance(d, str):
            return date.fromisoformat(d.split('T')[0])
        if hasattr(d, 'date'):
            return d.date()
        return date.today()


class MiniChartComponent:
    """迷你趨勢圖（用於清單）"""
    
    def __init__(self, baseline_weight: float, records: List[WeightRecord]):
        self.baseline = baseline_weight
        self.records = records[-7:]  # 只取最近 7 筆
    
    def build(self, width: int = 100, height: int = 40) -> ft.Control:
        """建立迷你圖表"""
        if len(self.records) < 2:
            return ft.Container(width=width, height=height)
        
        img_base64 = self._generate_mini_chart(width, height)
        
        if img_base64:
            return ft.Image(
                src_base64=img_base64,
                width=width,
                height=height,
                fit=ft.ImageFit.CONTAIN,
            )
        return ft.Container(width=width, height=height)
    
    def _generate_mini_chart(self, width: int, height: int) -> str:
        """產生迷你圖"""
        try:
            sorted_records = sorted(self.records, key=lambda r: self._parse_date(r.measure_date))
            weights = [r.weight for r in sorted_records]
            
            fig, ax = plt.subplots(figsize=(width/100, height/100), dpi=100)
            fig.patch.set_alpha(0)
            ax.set_facecolor('none')
            
            # 判斷趨勢顏色
            sdm_line = self.baseline * 0.97
            nutrition_line = self.baseline * 0.95
            
            last_weight = weights[-1]
            if last_weight <= nutrition_line:
                color = '#F44336'
            elif last_weight <= sdm_line:
                color = '#FF9800'
            else:
                color = '#4CAF50'
            
            # 繪製
            ax.plot(weights, '-', color=color, linewidth=1.5)
            ax.fill_between(range(len(weights)), weights, min(weights)-0.5, 
                           color=color, alpha=0.2)
            
            # 隱藏軸
            ax.axis('off')
            ax.set_xlim(-0.5, len(weights)-0.5)
            
            plt.tight_layout(pad=0)
            
            buf = io.BytesIO()
            fig.savefig(buf, format='png', transparent=True, bbox_inches='tight', pad_inches=0)
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            
            plt.close(fig)
            return img_base64
            
        except:
            plt.close('all')
            return None
    
    def _parse_date(self, d) -> date:
        if isinstance(d, date):
            return d
        if isinstance(d, str):
            return date.fromisoformat(d.split('T')[0])
        if hasattr(d, 'date'):
            return d.date()
        return date.today()
