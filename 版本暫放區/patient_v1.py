"""病人資料模型"""
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional, List, TYPE_CHECKING

if TYPE_CHECKING:
    from .treatment import Treatment


@dataclass
class Patient:
    """病人"""
    id: Optional[int] = None
    medical_id: str = ""
    name: str = ""
    gender: Optional[str] = None
    birth_date: Optional[date] = None
    extra_fields: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    # 關聯（非 DB 欄位）
    treatments: List["Treatment"] = field(default_factory=list)
    active_treatment: Optional["Treatment"] = None
    
    @property
    def gender_label(self) -> str:
        return {"M": "男", "F": "女"}.get(self.gender, "")
    
    @property
    def has_active_treatment(self) -> bool:
        return self.active_treatment is not None
