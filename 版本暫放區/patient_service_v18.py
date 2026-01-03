"""病人管理服務"""
from typing import Optional, List
from app.models.patient import Patient
from app.repositories.patient_repository import PatientRepository
from app.repositories.treatment_repository import TreatmentRepository


class PatientService:
    """病人服務"""
    
    def __init__(self):
        self.patient_repo = PatientRepository()
        self.treatment_repo = TreatmentRepository()
    
    def get_or_create(self, medical_id: str, name: str = None, 
                      gender: str = None, birth_date=None,
                      treatment_intent: str = None) -> Patient:
        # 搜尋時也支援補0
        medical_id_padded = medical_id.zfill(7)
        patient = self.patient_repo.get_by_medical_id(medical_id_padded)
        if not patient:
            patient = self.patient_repo.get_by_medical_id(medical_id)
        if not patient and name:
            patient = Patient(
                medical_id=medical_id,
                name=name,
                gender=gender,
                birth_date=birth_date,
                treatment_intent=treatment_intent,
            )
            patient = self.patient_repo.create(patient)
        return patient
    
    def get_by_medical_id(self, medical_id: str) -> Optional[Patient]:
        # 搜尋時也支援補0
        medical_id_padded = medical_id.zfill(7)
        patient = self.patient_repo.get_by_medical_id(medical_id_padded)
        if not patient:
            patient = self.patient_repo.get_by_medical_id(medical_id)
        return patient
    
    def get_with_treatments(self, patient_id: int) -> Patient:
        patient = self.patient_repo.get_by_id(patient_id)
        if patient:
            patient.treatments = self.treatment_repo.get_by_patient(patient_id)
            patient.active_treatment = next(
                (t for t in patient.treatments if t.status == "active"), None
            )
        return patient
    
    def search(self, keyword: str) -> List[Patient]:
        return self.patient_repo.search(keyword)
    
    def get_all(self) -> List[Patient]:
        """取得全部病人"""
        return self.patient_repo.get_all()
    
    def delete(self, patient_id: int) -> bool:
        """刪除病人及相關資料"""
        return self.patient_repo.delete(patient_id)
    
    def update(self, patient: 'Patient') -> 'Patient':
        """更新病人資料"""
        return self.patient_repo.update(patient)
    
    def count_all(self) -> int:
        """統計病人總數"""
        return self.patient_repo.count_all()
    
    def get_statistics(self) -> dict:
        """取得統計資料"""
        total_patients = self.patient_repo.count_all()
        
        # 統計各狀態療程
        from app.repositories.treatment_repository import TreatmentRepository
        treatment_repo = TreatmentRepository()
        
        active_count = len(treatment_repo.get_all_active())
        
        return {
            "total_patients": total_patients,
            "active_treatments": active_count,
        }
