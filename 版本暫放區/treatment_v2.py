"""療程資料模型"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .patient import Patient
    from .weight_record import WeightRecord
    from .intervention import Intervention


@dataclass
class Treatment:
    """療程"""
    id: Optional[int] = None
    patient_id: int = 0
    cancer_type: str = ""
    treatment_name: Optional[str] = None
    treatment_start: Optional[date] = None
    treatment_end: Optional[date] = None
    baseline_weight: float = 0.0
    baseline_date: Optional[date] = None
    status: str = "active"
    status_reason: Optional[str] = None
    status_changed_at: Optional[datetime] = None
    unable_to_measure: bool = False
    unable_reason: Optional[str] = None
    extra_fields: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # 關聯（非 DB 欄位）
    patient: Optional["Patient"] = None
    weight_records: List["WeightRecord"] = field(default_factory=list)
    last_weight: Optional["WeightRecord"] = None
    pending_interventions: List["Intervention"] = field(default_factory=list)
    
    # 計算欄位
    tracking_status: Optional[str] = None
    days_since_last: Optional[int] = None
    current_weight: Optional[float] = None
    current_change_rate: Optional[float] = None
    
    @property
    def cancer_type_label(self) -> str:
        from app.config.constants import CANCER_TYPES, get_label
        return get_label(CANCER_TYPES, self.cancer_type)
    
    @property
    def status_label(self) -> str:
        from app.config.constants import TREATMENT_STATUS, get_label
        return get_label(TREATMENT_STATUS, self.status)
    
    @property
    def is_active(self) -> bool:
        return self.status == "active"
    
    @property
    def unable_reason_label(self) -> str:
        from app.config.constants import UNABLE_REASONS, get_label
        return get_label(UNABLE_REASONS, self.unable_reason) if self.unable_reason else ""
