"""介入記錄資料模型"""
from dataclasses import dataclass
from datetime import date, datetime
from typing import Optional


@dataclass
class Intervention:
    """介入記錄"""
    id: Optional[int] = None
    treatment_id: int = 0
    weight_record_id: Optional[int] = None
    type: str = ""
    source: str = "auto"
    trigger_reason: Optional[str] = None
    status: str = "pending"
    executed_at: Optional[date] = None
    executed_by: Optional[str] = None
    result: Optional[str] = None
    skip_reason: Optional[str] = None
    skip_note: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @property
    def type_label(self) -> str:
        return {"sdm": "SDM", "nutrition": "營養師轉介"}.get(self.type, "")
    
    @property
    def status_label(self) -> str:
        return {"pending": "待處理", "completed": "已執行", "skipped": "已略過"}.get(self.status, "")
    
    @property
    def is_pending(self) -> bool:
        return self.status == "pending"
