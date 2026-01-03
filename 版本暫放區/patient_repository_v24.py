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
        # 病歷號補0到7碼
        medical_id = patient.medical_id.zfill(7)
        patient.id = self.db.execute(
            """INSERT INTO patients (medical_id, name, gender, birth_date, treatment_intent, extra_fields)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (medical_id, patient.name, patient.gender, 
             patient.birth_date, patient.treatment_intent, patient.extra_fields)
        )
        patient.medical_id = medical_id
        return patient
    
    def update(self, patient: Patient) -> Patient:
        self.db.execute(
            """UPDATE patients SET name=?, gender=?, birth_date=?, treatment_intent=?,
               extra_fields=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
            (patient.name, patient.gender, patient.birth_date, patient.treatment_intent,
             patient.extra_fields, patient.id)
        )
        return patient
    
    def search(self, keyword: str, limit: int = 20) -> List[Patient]:
        # 搜尋時也支援補0
        keyword_padded = keyword.zfill(7) if keyword.isdigit() else keyword
        pattern = f"%{keyword}%"
        pattern_padded = f"%{keyword_padded}%"
        rows = self.db.fetch_all(
            """SELECT * FROM patients 
               WHERE medical_id LIKE ? OR medical_id LIKE ? OR name LIKE ? 
               ORDER BY medical_id ASC
               LIMIT ?""",
            (pattern, pattern_padded, pattern, limit)
        )
        return [Patient(**row) for row in rows]
    
    def get_all(self, limit: int = 500) -> List[Patient]:
        """取得全部病人（依病歷號排序）"""
        rows = self.db.fetch_all(
            "SELECT * FROM patients ORDER BY medical_id ASC LIMIT ?",
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
