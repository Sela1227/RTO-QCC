"""體重記錄服務"""
from typing import List
from datetime import date
from app.models.weight_record import WeightRecord
from app.repositories.weight_repository import WeightRepository
from app.repositories.treatment_repository import TreatmentRepository
from app.services.intervention_service import InterventionService
from app.services.settings_service import SettingsService


class WeightService:
    """體重服務"""
    
    def __init__(self):
        self.weight_repo = WeightRepository()
        self.treatment_repo = TreatmentRepository()
        self.intervention_service = InterventionService()
        self.settings_service = SettingsService()
    
    def create(self, treatment_id: int, weight: float,
               measure_date: date = None, notes: str = None) -> WeightRecord:
        if measure_date is None:
            measure_date = date.today()
        
        # 檢查是否重複
        existing = self.weight_repo.get_by_date(treatment_id, measure_date)
        if existing:
            raise ValueError(f"該日期已有記錄（{existing.weight} kg）")
        
        # 計算變化率
        treatment = self.treatment_repo.get_by_id(treatment_id)
        change_rate = self._calculate_change_rate(treatment.baseline_weight, weight)
        alert_level = self._determine_alert_level(change_rate)
        
        # 建立記錄
        record = WeightRecord(
            treatment_id=treatment_id,
            measure_date=measure_date,
            weight=weight,
            change_rate=change_rate,
            alert_level=alert_level,
            notes=notes,
        )
        record = self.weight_repo.create(record)
        
        # 自動建立介入
        if alert_level in ("sdm", "nutrition"):
            self.intervention_service.create_auto(treatment_id, record.id, alert_level)
        
        return record
    
    def get_history(self, treatment_id: int) -> List[WeightRecord]:
        return self.weight_repo.get_by_treatment(treatment_id)
    
    def _calculate_change_rate(self, baseline: float, current: float) -> float:
        if baseline <= 0:
            return 0.0
        return round((baseline - current) / baseline * 100, 2)
    
    def _determine_alert_level(self, change_rate: float) -> str:
        """根據設定的閾值判斷警示等級"""
        nutrition_threshold = self.settings_service.nutrition_threshold
        sdm_threshold = self.settings_service.sdm_threshold
        
        if change_rate >= nutrition_threshold:
            return "nutrition"
        elif change_rate >= sdm_threshold:
            return "sdm"
        return "none"
