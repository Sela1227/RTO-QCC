"""追蹤狀態服務"""
from typing import List
from datetime import date
from app.models.treatment import Treatment
from app.repositories.treatment_repository import TreatmentRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.weight_repository import WeightRepository
from app.repositories.intervention_repository import InterventionRepository
from app.services.settings_service import SettingsService


class TrackingService:
    """追蹤服務"""
    
    def __init__(self):
        self.treatment_repo = TreatmentRepository()
        self.patient_repo = PatientRepository()
        self.weight_repo = WeightRepository()
        self.intervention_repo = InterventionRepository()
        self.settings_service = SettingsService()
    
    def get_tracking_list(self, status_filter: str = "active") -> List[Treatment]:
        if status_filter == "active":
            treatments = self.treatment_repo.get_all_active()
        elif status_filter == "paused":
            treatments = self.treatment_repo.get_by_status("paused")
        elif status_filter == "all":
            # 取得進行中和暫停中
            active = self.treatment_repo.get_all_active()
            paused = self.treatment_repo.get_by_status("paused")
            treatments = active + paused
        else:
            treatments = self.treatment_repo.get_by_status(status_filter)
        
        for t in treatments:
            t.patient = self.patient_repo.get_by_id(t.patient_id)
            t.last_weight = self.weight_repo.get_latest(t.id)
            t.tracking_status = self._calculate_tracking_status(t)
            t.days_since_last = self._calculate_days_since(t)
            t.pending_interventions = self.intervention_repo.get_pending_by_treatment(t.id)
            if t.last_weight:
                t.current_weight = t.last_weight.weight
                t.current_change_rate = t.last_weight.change_rate
        
        return self._sort_by_priority(treatments)
    
    def get_paused_list(self) -> List[Treatment]:
        """取得暫停中療程"""
        return self.get_tracking_list("paused")
    
    def get_dashboard_summary(self) -> dict:
        treatments = self.get_tracking_list("active")
        # 排除無法測量的療程計算逾期/待量測
        measurable = [t for t in treatments if not t.unable_to_measure]
        return {
            "total_active": len(treatments),
            "overdue_count": sum(1 for t in measurable if t.tracking_status == "overdue"),
            "pending_count": sum(1 for t in measurable if t.tracking_status == "pending"),
            "unable_count": sum(1 for t in treatments if t.unable_to_measure),
            "sdm_pending": self.intervention_repo.count_pending_by_type("sdm"),
            "nutrition_pending": self.intervention_repo.count_pending_by_type("nutrition"),
        }
    
    def get_overdue_list(self) -> List[Treatment]:
        treatments = self.get_tracking_list("active")
        # 排除無法測量的療程
        return [t for t in treatments if t.tracking_status == "overdue" and not t.unable_to_measure]
    
    def _calculate_tracking_status(self, treatment: Treatment) -> str:
        """計算追蹤狀態（使用設定的逾期天數）"""
        if treatment.status != "active":
            return treatment.status
        
        # 無法測量的療程顯示特殊狀態
        if treatment.unable_to_measure:
            return "unable"
        
        if not treatment.last_weight:
            return "overdue"
        
        overdue_days = self.settings_service.overdue_days
        days = self._calculate_days_since(treatment)
        
        if days > overdue_days:
            return "overdue"
        elif days >= overdue_days - 2:  # 提前兩天警示
            return "pending"
        return "normal"
    
    def _calculate_days_since(self, treatment: Treatment) -> int:
        if not treatment.last_weight:
            return 999
        last_date = treatment.last_weight.measure_date
        if isinstance(last_date, str):
            # 處理可能含有時間的格式 '2025-12-09T00:00:00'
            last_date = date.fromisoformat(last_date.split('T')[0])
        elif hasattr(last_date, 'date'):
            last_date = last_date.date()
        return (date.today() - last_date).days
    
    def _sort_by_priority(self, treatments: List[Treatment]) -> List[Treatment]:
        priority = {"overdue": 0, "pending": 1, "normal": 2}
        return sorted(treatments, key=lambda t: (
            priority.get(t.tracking_status, 99),
            -(t.days_since_last or 0)
        ))
