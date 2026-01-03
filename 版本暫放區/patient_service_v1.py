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
                      gender: str = None) -> Patient:
        patient = self.patient_repo.get_by_medical_id(medical_id)
        if not patient and name:
            patient = Patient(medical_id=medical_id, name=name, gender=gender)
            patient = self.patient_repo.create(patient)
        return patient
    
    def get_by_medical_id(self, medical_id: str) -> Optional[Patient]:
        return self.patient_repo.get_by_medical_id(medical_id)
    
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
