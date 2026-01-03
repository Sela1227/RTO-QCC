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
    
    def get_all(self, limit: int = 500) -> List[Patient]:
        """取得全部病人"""
        rows = self.db.fetch_all(
            "SELECT * FROM patients ORDER BY updated_at DESC LIMIT ?",
            (limit,)
        )
        return [Patient(**row) for row in rows]
    
    def delete(self, patient_id: int) -> bool:
        """刪除病人（會連帶刪除相關療程、體重記錄、介入記錄）"""
        # 先取得所有療程 ID
        treatment_ids = self.db.fetch_all(
            "SELECT id FROM treatments WHERE patient_id = ?",
            (patient_id,)
        )
        
        for t in treatment_ids:
            tid = t['id']
            # 刪除介入記錄
            self.db.execute("DELETE FROM interventions WHERE treatment_id = ?", (tid,))
            # 刪除體重記錄
            self.db.execute("DELETE FROM weight_records WHERE treatment_id = ?", (tid,))
        
        # 刪除療程
        self.db.execute("DELETE FROM treatments WHERE patient_id = ?", (patient_id,))
        # 刪除病人
        self.db.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        return True
    
    def count_all(self) -> int:
        """統計病人總數"""
        result = self.db.fetch_one("SELECT COUNT(*) as cnt FROM patients")
        return result['cnt'] if result else 0
