"""療程管理服務"""
from typing import Optional, List
from datetime import date
from app.models.treatment import Treatment
from app.models.weight_record import WeightRecord
from app.repositories.treatment_repository import TreatmentRepository
from app.repositories.patient_repository import PatientRepository
from app.repositories.weight_repository import WeightRepository
from app.repositories.intervention_repository import InterventionRepository
from app.config.constants import CANCER_TYPES, get_label


class TreatmentService:
    """療程服務"""
    
    def __init__(self):
        self.treatment_repo = TreatmentRepository()
        self.patient_repo = PatientRepository()
        self.weight_repo = WeightRepository()
        self.intervention_repo = InterventionRepository()
    
    def create(self, patient_id: int, cancer_type: str,
               treatment_start: date = None, baseline_weight: float = None,
               treatment_intent: str = None,
               unable_to_measure: bool = False, unable_reason: str = None) -> Treatment:
        # 檢查是否有未結束療程（active 或 paused）
        ongoing = self.treatment_repo.get_ongoing_by_patient(patient_id)
        if ongoing:
            status_text = "進行中" if ongoing.status == "active" else "暫停中"
            raise ValueError(f"此病人已有{status_text}的療程，請先結案或終止")
        
        # 預設日期
        if treatment_start is None:
            treatment_start = date.today()
        
        # 自動產生療程名稱
        treatment_name = self._generate_name(patient_id, cancer_type)
        
        # 建立療程
        treatment = Treatment(
            patient_id=patient_id,
            cancer_type=cancer_type,
            treatment_intent=treatment_intent,
            treatment_name=treatment_name,
            treatment_start=treatment_start,
            baseline_weight=baseline_weight or 0,
            baseline_date=treatment_start,
            status="active",
            unable_to_measure=unable_to_measure,
            unable_reason=unable_reason,
        )
        treatment = self.treatment_repo.create(treatment)
        
        # 建立基準體重記錄（如果有體重）
        if baseline_weight and baseline_weight > 0:
            baseline_record = WeightRecord(
                treatment_id=treatment.id,
                measure_date=treatment_start,
                weight=baseline_weight,
                change_rate=0.0,
                alert_level="none",
            )
            self.weight_repo.create(baseline_record)
        
        return treatment
    
    def update_unable_status(self, treatment_id: int, unable: bool, reason: str = None):
        """更新無法測量狀態"""
        self.treatment_repo.update_unable_status(treatment_id, unable, reason)
    
    def set_unable_to_measure(self, treatment_id: int, reason: str):
        """標記為無法測量"""
        self.treatment_repo.update_unable_status(treatment_id, True, reason)
    
    def clear_unable_to_measure(self, treatment_id: int):
        """清除無法測量標記"""
        self.treatment_repo.update_unable_status(treatment_id, False, None)
    
    def update_baseline_weight(self, treatment_id: int, weight: float, measure_date: date = None):
        """更新基準體重（用於無法測量病人首次量測）"""
        if measure_date is None:
            measure_date = date.today()
        
        # 更新療程基準體重
        self.treatment_repo.update_baseline(treatment_id, weight, measure_date)
        
        # 清除無法測量狀態
        self.treatment_repo.update_unable_status(treatment_id, False, None)
        
        # 建立基準體重記錄
        baseline_record = WeightRecord(
            treatment_id=treatment_id,
            measure_date=measure_date,
            weight=weight,
            change_rate=0.0,
            alert_level="none",
        )
        self.weight_repo.create(baseline_record)
    
    def get_with_details(self, treatment_id: int) -> Treatment:
        treatment = self.treatment_repo.get_by_id(treatment_id)
        if treatment:
            treatment.patient = self.patient_repo.get_by_id(treatment.patient_id)
            treatment.last_weight = self.weight_repo.get_latest(treatment_id)
            treatment.pending_interventions = self.intervention_repo.get_pending_by_treatment(treatment_id)
            if treatment.last_weight:
                treatment.current_weight = treatment.last_weight.weight
                treatment.current_change_rate = treatment.last_weight.change_rate
        return treatment
    
    def _generate_name(self, patient_id: int, cancer_type: str) -> str:
        label = get_label(CANCER_TYPES, cancer_type)
        count = self.treatment_repo.count_by_cancer_type(patient_id, cancer_type)
        if count == 0:
            return label
        return f"{label} ({count + 1})"
    
    def get_suggested_baseline(self, patient_id: int) -> dict:
        """取得建議基準體重（上次結案體重）"""
        treatments = self.treatment_repo.get_by_patient(patient_id)
        for t in treatments:
            if t.status == "completed":
                last_weight = self.weight_repo.get_latest(t.id)
                if last_weight:
                    return {
                        "suggested": last_weight.weight,
                        "source": f"上次結案 {last_weight.measure_date}",
                    }
        return {"suggested": None, "source": None}
    
    def pause(self, treatment_id: int, reason: str = None):
        """暫停療程"""
        self.treatment_repo.update_status(treatment_id, "paused", reason)
    
    def resume(self, treatment_id: int):
        """恢復療程"""
        self.treatment_repo.update_status(treatment_id, "active", None)
    
    def complete(self, treatment_id: int):
        """結案療程"""
        self.treatment_repo.update_status(treatment_id, "completed", None)
        self.treatment_repo.update_end_date(treatment_id, date.today())
    
    def terminate(self, treatment_id: int, reason: str = None):
        """終止療程"""
        self.treatment_repo.update_status(treatment_id, "terminated", reason)
        self.treatment_repo.update_end_date(treatment_id, date.today())
