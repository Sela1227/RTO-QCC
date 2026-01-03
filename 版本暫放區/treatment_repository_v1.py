"""療程資料存取"""
from typing import Optional, List
from datetime import date
from app.models.database import Database
from app.models.treatment import Treatment


class TreatmentRepository:
    """療程 Repository"""
    
    def __init__(self):
        self.db = Database()
    
    def get_by_id(self, id: int) -> Optional[Treatment]:
        row = self.db.fetch_one("SELECT * FROM treatments WHERE id = ?", (id,))
        return Treatment(**row) if row else None
    
    def get_by_patient(self, patient_id: int) -> List[Treatment]:
        rows = self.db.fetch_all(
            "SELECT * FROM treatments WHERE patient_id = ? ORDER BY treatment_start DESC",
            (patient_id,)
        )
        return [Treatment(**row) for row in rows]
    
    def get_active_by_patient(self, patient_id: int) -> Optional[Treatment]:
        row = self.db.fetch_one(
            "SELECT * FROM treatments WHERE patient_id = ? AND status = 'active'",
            (patient_id,)
        )
        return Treatment(**row) if row else None
    
    def get_all_active(self) -> List[Treatment]:
        rows = self.db.fetch_all("SELECT * FROM treatments WHERE status = 'active'")
        return [Treatment(**row) for row in rows]
    
    def count_by_cancer_type(self, patient_id: int, cancer_type: str) -> int:
        result = self.db.fetch_one(
            "SELECT COUNT(*) as count FROM treatments WHERE patient_id = ? AND cancer_type = ?",
            (patient_id, cancer_type)
        )
        return result["count"] if result else 0
    
    def create(self, treatment: Treatment) -> Treatment:
        treatment.id = self.db.execute(
            """INSERT INTO treatments 
               (patient_id, cancer_type, treatment_name, treatment_start, 
                baseline_weight, baseline_date, status)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (treatment.patient_id, treatment.cancer_type, treatment.treatment_name,
             treatment.treatment_start, treatment.baseline_weight, 
             treatment.baseline_date, treatment.status)
        )
        return treatment
    
    def update_status(self, id: int, status: str, reason: str = None):
        self.db.execute(
            """UPDATE treatments SET status=?, status_reason=?, 
               status_changed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP 
               WHERE id=?""",
            (status, reason, id)
        )
