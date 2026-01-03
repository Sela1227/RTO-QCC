"""介入記錄服務"""
from typing import List
from app.models.intervention import Intervention
from app.repositories.intervention_repository import InterventionRepository


class InterventionService:
    """介入服務"""
    
    def __init__(self):
        self.intervention_repo = InterventionRepository()
    
    def create_auto(self, treatment_id: int, weight_record_id: int, alert_level: str):
        if alert_level == "nutrition":
            self._create(treatment_id, weight_record_id, "sdm", "auto")
            self._create(treatment_id, weight_record_id, "nutrition", "auto")
        elif alert_level == "sdm":
            self._create(treatment_id, weight_record_id, "sdm", "auto")
    
    def _create(self, treatment_id: int, weight_record_id: int,
                type: str, source: str) -> Intervention:
        intervention = Intervention(
            treatment_id=treatment_id,
            weight_record_id=weight_record_id,
            type=type,
            source=source,
            status="pending",
        )
        return self.intervention_repo.create(intervention)
    
    def mark_completed(self, id: int, reason: str = None, notes: str = None):
        """標記完成"""
        self.intervention_repo.mark_completed(id, reason=reason, notes=notes)
    
    def mark_skipped(self, id: int, reason: str, notes: str = None):
        """標記略過"""
        self.intervention_repo.mark_skipped(id, reason, notes)
    
    def get_pending_count(self) -> dict:
        return {
            "sdm": self.intervention_repo.count_pending_by_type("sdm"),
            "nutrition": self.intervention_repo.count_pending_by_type("nutrition"),
        }
