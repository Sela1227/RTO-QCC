"""病人資料存取"""
from typing import Optional, List
from app.models.database import Database
from app.models.patient import Patient


class PatientRepository:
    """病人 Repository"""
    
    def __init__(self):
        self.db = Database()
    
    def get_by_id(self, id: int) -> Optional[Patient]:
        row = self.db.fetch_one("SELECT * FROM patients WHERE id = ?", (id,))
        return Patient(**row) if row else None
    
    def get_by_medical_id(self, medical_id: str) -> Optional[Patient]:
        row = self.db.fetch_one("SELECT * FROM patients WHERE medical_id = ?", (medical_id,))
        return Patient(**row) if row else None
    
    def create(self, patient: Patient) -> Patient:
        patient.id = self.db.execute(
            """INSERT INTO patients (medical_id, name, gender, birth_date, extra_fields)
               VALUES (?, ?, ?, ?, ?)""",
            (patient.medical_id, patient.name, patient.gender, 
             patient.birth_date, patient.extra_fields)
        )
        return patient
    
    def update(self, patient: Patient) -> Patient:
        self.db.execute(
            """UPDATE patients SET name=?, gender=?, birth_date=?, 
               extra_fields=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
            (patient.name, patient.gender, patient.birth_date,
             patient.extra_fields, patient.id)
        )
        return patient
    
    def search(self, keyword: str, limit: int = 20) -> List[Patient]:
        pattern = f"%{keyword}%"
        rows = self.db.fetch_all(
            """SELECT * FROM patients WHERE medical_id LIKE ? OR name LIKE ? LIMIT ?""",
            (pattern, pattern, limit)
        )
        return [Patient(**row) for row in rows]
