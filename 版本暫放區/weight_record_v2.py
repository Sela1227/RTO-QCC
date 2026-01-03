"""體重記錄資料模型"""
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class WeightRecord:
    """體重記錄"""
    id: Optional[int] = None
    treatment_id: int = 0
    measure_date: Optional[date] = None
    weight: float = 0.0
    change_rate: Optional[float] = None
    alert_level: Optional[str] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    
    @property
    def alert_level_label(self) -> str:
        return {"none": "正常", "sdm": "SDM", "nutrition": "營養師"}.get(self.alert_level, "")
    
    @property
    def change_rate_display(self) -> str:
        """變化率顯示（負=下降，正=上升）"""
        if self.change_rate is None or self.change_rate == 0:
            return "基準"
        return f"{self.change_rate:+.1f}%"
