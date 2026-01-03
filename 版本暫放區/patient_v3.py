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
    treatment_intent: Optional[str] = None  # 治療目的：curative/palliative/other
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
    def treatment_intent_label(self) -> str:
        return {
            "curative": "治癒性",
            "palliative": "姑息性",
            "other": "其他",
        }.get(self.treatment_intent, "")
    
    @property
    def has_active_treatment(self) -> bool:
        return self.active_treatment is not None
    
    @property
    def medical_id_display(self) -> str:
        """病歷號顯示（7碼補0）"""
        return self.medical_id.zfill(7) if self.medical_id else ""
    
    @property
    def age(self) -> Optional[int]:
        """計算年紀"""
        if not self.birth_date:
            return None
        bd = self.birth_date
        if isinstance(bd, str):
            bd = date.fromisoformat(bd.split('T')[0])
        today = date.today()
        age = today.year - bd.year
        if (today.month, today.day) < (bd.month, bd.day):
            age -= 1
        return age
    
    @property
    def age_display(self) -> str:
        """年紀顯示"""
        age = self.age
        return f"{age}歲" if age is not None else ""
