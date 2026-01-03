"""介入記錄資料存取"""
from typing import Optional, List
from datetime import date
from app.models.database import Database
from app.models.intervention import Intervention


class InterventionRepository:
    """介入記錄 Repository"""
    
    def __init__(self):
        self.db = Database()
    
    def get_by_treatment(self, treatment_id: int) -> List[Intervention]:
        rows = self.db.fetch_all(
            "SELECT * FROM interventions WHERE treatment_id = ? ORDER BY created_at DESC",
            (treatment_id,)
        )
        return [Intervention(**row) for row in rows]
    
    def get_pending_by_treatment(self, treatment_id: int) -> List[Intervention]:
        rows = self.db.fetch_all(
            "SELECT * FROM interventions WHERE treatment_id = ? AND status = 'pending'",
            (treatment_id,)
        )
        return [Intervention(**row) for row in rows]
    
    def get_all_pending(self) -> List[Intervention]:
        rows = self.db.fetch_all(
            "SELECT * FROM interventions WHERE status = 'pending' ORDER BY created_at"
        )
        return [Intervention(**row) for row in rows]
    
    def count_pending_by_type(self, type: str) -> int:
        """計算待處理介入的療程數（只計算治療中的療程）"""
        result = self.db.fetch_one(
            """SELECT COUNT(DISTINCT i.treatment_id) as count 
               FROM interventions i
               JOIN treatments t ON i.treatment_id = t.id
               WHERE i.type = ? AND i.status = 'pending' AND t.status = 'active'""",
            (type,)
        )
        return result["count"] if result else 0
    
    def create(self, intervention: Intervention) -> Intervention:
        intervention.id = self.db.execute(
            """INSERT INTO interventions 
               (treatment_id, weight_record_id, type, source, trigger_reason, status)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (intervention.treatment_id, intervention.weight_record_id,
             intervention.type, intervention.source, 
             intervention.trigger_reason, intervention.status)
        )
        return intervention
    
    def mark_completed(self, id: int, reason: str = None, notes: str = None, executed_date: date = None):
        """標記完成"""
        exec_date = executed_date.isoformat() if executed_date else date.today().isoformat()
        self.db.execute(
            """UPDATE interventions SET status='completed', executed_at=?, 
               trigger_reason=?, result=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
            (exec_date, reason, notes, id)
        )
    
    def mark_skipped(self, id: int, reason: str, notes: str = None):
        """標記略過"""
        self.db.execute(
            """UPDATE interventions SET status='skipped', skip_reason=?, 
               skip_note=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
            (reason, notes, id)
        )
