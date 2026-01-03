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
