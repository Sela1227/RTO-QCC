"""體重記錄資料存取"""
from typing import Optional, List
from datetime import date
from app.models.database import Database
from app.models.weight_record import WeightRecord


class WeightRepository:
    """體重記錄 Repository"""
    
    def __init__(self):
        self.db = Database()
    
    def get_by_treatment(self, treatment_id: int) -> List[WeightRecord]:
        rows = self.db.fetch_all(
            "SELECT * FROM weight_records WHERE treatment_id = ? ORDER BY measure_date DESC",
            (treatment_id,)
        )
        return [WeightRecord(**row) for row in rows]
    
    def get_latest(self, treatment_id: int) -> Optional[WeightRecord]:
        row = self.db.fetch_one(
            """SELECT * FROM weight_records WHERE treatment_id = ? 
               ORDER BY measure_date DESC LIMIT 1""",
            (treatment_id,)
        )
        return WeightRecord(**row) if row else None
    
    def get_by_date(self, treatment_id: int, measure_date: date) -> Optional[WeightRecord]:
        row = self.db.fetch_one(
            "SELECT * FROM weight_records WHERE treatment_id = ? AND measure_date = ?",
            (treatment_id, measure_date.isoformat() if isinstance(measure_date, date) else measure_date)
        )
        return WeightRecord(**row) if row else None
    
    def create(self, record: WeightRecord) -> WeightRecord:
        measure_date = record.measure_date
        if isinstance(measure_date, date):
            measure_date = measure_date.isoformat()
        
        record.id = self.db.execute(
            """INSERT INTO weight_records 
               (treatment_id, measure_date, weight, change_rate, alert_level, notes)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (record.treatment_id, measure_date, record.weight,
             record.change_rate, record.alert_level, record.notes)
        )
        return record
