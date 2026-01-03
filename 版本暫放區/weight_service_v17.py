"""體重記錄服務"""
from typing import List
from datetime import date
from app.models.weight_record import WeightRecord
from app.repositories.weight_repository import WeightRepository
from app.repositories.treatment_repository import TreatmentRepository
from app.services.intervention_service import InterventionService
from app.services.settings_service import SettingsService


class WeightService:
    """體重服務"""
    
    def __init__(self):
        self.weight_repo = WeightRepository()
        self.treatment_repo = TreatmentRepository()
        self.intervention_service = InterventionService()
        self.settings_service = SettingsService()
    
    def create(self, treatment_id: int, weight: float,
               measure_date: date = None, notes: str = None) -> WeightRecord:
        if measure_date is None:
            measure_date = date.today()
        
        # 檢查是否重複
        existing = self.weight_repo.get_by_date(treatment_id, measure_date)
        if existing:
            raise ValueError(f"該日期已有記錄（{existing.weight} kg）")
        
        # 取得療程
        treatment = self.treatment_repo.get_by_id(treatment_id)
        
        # 判斷是否有基準體重
        has_baseline = treatment.baseline_weight and treatment.baseline_weight > 0
        
        # 如果沒有基準體重，這次輸入的體重變成基準體重
        if not has_baseline:
            self.treatment_repo.update_baseline(treatment_id, weight, measure_date)
            
            # 如果之前是無法測量狀態，清除標記
            if treatment.unable_to_measure:
                self.treatment_repo.update_unable_status(treatment_id, False, None)
            
            # 建立基準體重記錄（變化率為 0）
            record = WeightRecord(
                treatment_id=treatment_id,
                measure_date=measure_date,
                weight=weight,
                change_rate=0.0,
                alert_level="none",
                notes=notes,
            )
            return self.weight_repo.create(record)
        
        # 有基準體重的正常流程
        # 如果之前是無法測量狀態，清除標記（回到正常追蹤）
        if treatment.unable_to_measure:
            self.treatment_repo.update_unable_status(treatment_id, False, None)
        
        # 計算變化率
        change_rate = self._calculate_change_rate(treatment.baseline_weight, weight)
        # 使用癌別特定閾值
        alert_level = self._determine_alert_level(change_rate, treatment.cancer_type)
        
        # 建立記錄
        record = WeightRecord(
            treatment_id=treatment_id,
            measure_date=measure_date,
            weight=weight,
            change_rate=change_rate,
            alert_level=alert_level,
            notes=notes,
        )
        record = self.weight_repo.create(record)
        
        # 自動建立介入
        if alert_level in ("sdm", "nutrition"):
            self.intervention_service.create_auto(treatment_id, record.id, alert_level)
        
        return record
    
    def get_history(self, treatment_id: int) -> List[WeightRecord]:
        return self.weight_repo.get_by_treatment(treatment_id)
    
    def get_by_id(self, record_id: int) -> WeightRecord:
        return self.weight_repo.get_by_id(record_id)
    
    def update(self, record_id: int, weight: float, measure_date: date, 
               treatment_id: int, baseline_weight: float, cancer_type: str = None) -> WeightRecord:
        """更新體重記錄"""
        record = self.weight_repo.get_by_id(record_id)
        if not record:
            raise ValueError("記錄不存在")
        
        # 檢查日期是否重複（排除自己）
        existing = self.weight_repo.get_by_date(treatment_id, measure_date)
        if existing and existing.id != record_id:
            raise ValueError(f"該日期已有記錄（{existing.weight} kg）")
        
        # 重新計算變化率
        change_rate = self._calculate_change_rate(baseline_weight, weight)
        alert_level = self._determine_alert_level(change_rate, cancer_type)
        
        record.weight = weight
        record.measure_date = measure_date
        record.change_rate = change_rate
        record.alert_level = alert_level
        
        return self.weight_repo.update(record)
    
    def delete(self, record_id: int) -> bool:
        """刪除體重記錄"""
        return self.weight_repo.delete(record_id)
    
    def _calculate_change_rate(self, baseline: float, current: float) -> float:
        """計算體重變化率（下降為負，上升為正）"""
        if baseline <= 0:
            return 0.0
        # (current - baseline) / baseline * 100
        # 例：60kg → 57kg = (57-60)/60*100 = -5%（下降5%）
        # 例：60kg → 63kg = (63-60)/60*100 = +5%（上升5%）
        return round((current - baseline) / baseline * 100, 2)
    
    def _determine_alert_level(self, change_rate: float, cancer_type: str = None) -> str:
        """根據癌別和變化率判斷警示等級
        
        優先使用癌別特定規則，否則使用全域設定
        """
        # 嘗試使用新的規則系統
        if cancer_type:
            level = self.settings_service.get_alert_level_for_cancer(cancer_type, change_rate)
            if level != "none":
                return level
        
        # 回退到舊的全域設定
        nutrition_threshold = self.settings_service.nutrition_threshold
        sdm_threshold = self.settings_service.sdm_threshold
        
        # 體重下降（負數）達到閾值時觸發
        if change_rate <= -nutrition_threshold:
            return "nutrition"
        elif change_rate <= -sdm_threshold:
            return "sdm"
        return "none"
