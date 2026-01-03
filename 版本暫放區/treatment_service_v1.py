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
               treatment_start: date, baseline_weight: float) -> Treatment:
        # 檢查是否有進行中療程
        active = self.treatment_repo.get_active_by_patient(patient_id)
        if active:
            raise ValueError("此病人已有進行中的療程")
        
        # 自動產生療程名稱
        treatment_name = self._generate_name(patient_id, cancer_type)
        
        # 建立療程
        treatment = Treatment(
            patient_id=patient_id,
            cancer_type=cancer_type,
            treatment_name=treatment_name,
            treatment_start=treatment_start,
            baseline_weight=baseline_weight,
            baseline_date=treatment_start,
            status="active",
        )
        treatment = self.treatment_repo.create(treatment)
        
        # 建立基準體重記錄
        baseline_record = WeightRecord(
            treatment_id=treatment.id,
            measure_date=treatment_start,
            weight=baseline_weight,
            change_rate=0.0,
            alert_level="none",
        )
        self.weight_repo.create(baseline_record)
        
        return treatment
    
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
