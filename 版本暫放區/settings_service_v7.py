"""設定服務"""
import json
import os
from typing import Any, Optional


class SettingsService:
    """設定服務 - 使用 JSON 檔案儲存設定"""
    
    # 預設值
    DEFAULTS = {
        "sdm_threshold": 3,        # SDM 閾值 (%)
        "nutrition_threshold": 5,  # 營養師閾值 (%)
        "overdue_days": 7,         # 逾期天數
    }
    
    def __init__(self):
        # 設定檔路徑
        app_data = os.path.expanduser("~/.weight-tracker")
        if not os.path.exists(app_data):
            os.makedirs(app_data)
        self.settings_file = os.path.join(app_data, "settings.json")
        self._settings = None
    
    def _load(self) -> dict:
        """載入設定"""
        if self._settings is not None:
            return self._settings
        
        try:
            if os.path.exists(self.settings_file):
                with open(self.settings_file, "r", encoding="utf-8") as f:
                    self._settings = json.load(f)
            else:
                self._settings = {}
        except Exception:
            self._settings = {}
        
        return self._settings
    
    def _save(self):
        """儲存設定"""
        try:
            with open(self.settings_file, "w", encoding="utf-8") as f:
                json.dump(self._settings, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"儲存設定失敗: {e}")
    
    def get(self, key: str, default: Any = None) -> Any:
        """取得設定值"""
        settings = self._load()
        if key in settings:
            return settings[key]
        if key in self.DEFAULTS:
            return self.DEFAULTS[key]
        return default
    
    def set(self, key: str, value: Any):
        """設定值"""
        self._load()
        self._settings[key] = value
        self._save()
    
    def get_all(self) -> dict:
        """取得所有設定"""
        settings = self._load()
        result = dict(self.DEFAULTS)
        result.update(settings)
        return result
    
    # 便利方法
    @property
    def sdm_threshold(self) -> int:
        return self.get("sdm_threshold")
    
    @sdm_threshold.setter
    def sdm_threshold(self, value: int):
        self.set("sdm_threshold", value)
    
    @property
    def nutrition_threshold(self) -> int:
        return self.get("nutrition_threshold")
    
    @nutrition_threshold.setter
    def nutrition_threshold(self, value: int):
        self.set("nutrition_threshold", value)
    
    @property
    def overdue_days(self) -> int:
        return self.get("overdue_days")
    
    @overdue_days.setter
    def overdue_days(self, value: int):
        self.set("overdue_days", value)
    
    # 癌別管理
    def get_cancer_types(self) -> list:
        """取得癌別列表"""
        from app.config.constants import CANCER_TYPES
        custom = self.get("cancer_types")
        if custom:
            return custom
        return CANCER_TYPES
    
    def set_cancer_types(self, cancer_types: list):
        """設定癌別列表"""
        self.set("cancer_types", cancer_types)
    
    def add_cancer_type(self, code: str, label: str):
        """新增癌別"""
        types = self.get_cancer_types()
        # 檢查是否重複
        for t in types:
            if t["code"] == code:
                return False
        types.append({"code": code, "label": label})
        self.set_cancer_types(types)
        return True
    
    def remove_cancer_type(self, code: str):
        """移除癌別"""
        types = self.get_cancer_types()
        types = [t for t in types if t["code"] != code]
        self.set_cancer_types(types)
    
    def reorder_cancer_types(self, codes: list):
        """重新排序癌別"""
        types = self.get_cancer_types()
        type_dict = {t["code"]: t for t in types}
        new_order = []
        for code in codes:
            if code in type_dict:
                new_order.append(type_dict[code])
        # 加入沒在 codes 中的
        for t in types:
            if t not in new_order:
                new_order.append(t)
        self.set_cancer_types(new_order)
