"""設定服務"""
import json
import os
from typing import Any, Optional, List, Dict


class SettingsService:
    """設定服務 - 使用 JSON 檔案儲存設定"""
    
    # 預設值
    DEFAULTS = {
        "sdm_threshold": 3,        # SDM 閾值 (%)
        "nutrition_threshold": 5,  # 營養師閾值 (%)
        "overdue_days": 7,         # 逾期天數
    }
    
    # 預設閾值規則
    DEFAULT_THRESHOLD_RULES = [
        {"id": 1, "name": "SDM 提醒", "type": "sdm", "threshold": 3, "cancer_types": [], "enabled": True},
        {"id": 2, "name": "營養師轉介", "type": "nutrition", "threshold": 5, "cancer_types": [], "enabled": True},
    ]
    
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
    
    # === 閾值規則管理 ===
    def get_threshold_rules(self) -> List[Dict]:
        """取得閾值規則列表"""
        rules = self.get("threshold_rules")
        if rules:
            return rules
        return self.DEFAULT_THRESHOLD_RULES.copy()
    
    def set_threshold_rules(self, rules: List[Dict]):
        """設定閾值規則"""
        self.set("threshold_rules", rules)
    
    def add_threshold_rule(self, name: str, rule_type: str, threshold: float, 
                          cancer_types: List[str] = None) -> Dict:
        """新增閾值規則"""
        rules = self.get_threshold_rules()
        new_id = max([r.get("id", 0) for r in rules], default=0) + 1
        new_rule = {
            "id": new_id,
            "name": name,
            "type": rule_type,  # "sdm" 或 "nutrition"
            "threshold": threshold,
            "cancer_types": cancer_types or [],  # 空列表表示所有癌別
            "enabled": True,
        }
        rules.append(new_rule)
        self.set_threshold_rules(rules)
        return new_rule
    
    def update_threshold_rule(self, rule_id: int, **kwargs):
        """更新閾值規則"""
        rules = self.get_threshold_rules()
        for rule in rules:
            if rule.get("id") == rule_id:
                rule.update(kwargs)
                break
        self.set_threshold_rules(rules)
    
    def delete_threshold_rule(self, rule_id: int):
        """刪除閾值規則"""
        rules = self.get_threshold_rules()
        rules = [r for r in rules if r.get("id") != rule_id]
        self.set_threshold_rules(rules)
    
    def get_alert_level_for_cancer(self, cancer_type: str, change_rate: float) -> str:
        """根據癌別和變化率判斷警示等級
        
        Args:
            cancer_type: 癌別代碼
            change_rate: 變化率（負數表示下降）
        
        Returns:
            "nutrition", "sdm", 或 "none"
        """
        rules = self.get_threshold_rules()
        
        # 找出適用的規則（按閾值從大到小排序，先判斷更嚴重的）
        applicable_rules = []
        for rule in rules:
            if not rule.get("enabled", True):
                continue
            # 檢查癌別限制
            cancer_list = rule.get("cancer_types", [])
            if cancer_list and cancer_type not in cancer_list:
                continue
            applicable_rules.append(rule)
        
        # 按閾值從大到小排序
        applicable_rules.sort(key=lambda r: r.get("threshold", 0), reverse=True)
        
        # 判斷警示等級
        for rule in applicable_rules:
            threshold = rule.get("threshold", 0)
            if change_rate <= -threshold:
                return rule.get("type", "none")
        
        return "none"
    
    # === 文件管理 ===
    def get_documents(self) -> List[Dict]:
        """取得文件列表"""
        return self.get("documents") or []
    
    def add_document(self, name: str, filepath: str, category: str = "other") -> Dict:
        """新增文件"""
        docs = self.get_documents()
        new_id = max([d.get("id", 0) for d in docs], default=0) + 1
        doc = {
            "id": new_id,
            "name": name,
            "filepath": filepath,
            "category": category,  # "sdm", "education", "other"
            "created_at": str(date.today()),
        }
        docs.append(doc)
        self.set("documents", docs)
        return doc
    
    def update_document(self, doc_id: int, **kwargs):
        """更新文件"""
        docs = self.get_documents()
        for doc in docs:
            if doc.get("id") == doc_id:
                doc.update(kwargs)
                break
        self.set("documents", docs)
    
    def delete_document(self, doc_id: int):
        """刪除文件"""
        docs = self.get_documents()
        docs = [d for d in docs if d.get("id") != doc_id]
        self.set("documents", docs)
    
    # === 人員管理 ===
    def get_staff_list(self) -> List[str]:
        """取得人員列表"""
        return self.get("staff_list") or []
    
    def set_staff_list(self, staff: List[str]):
        """設定人員列表"""
        self.set("staff_list", staff)
    
    def add_staff(self, name: str) -> bool:
        """新增人員"""
        staff = self.get_staff_list()
        if name not in staff:
            staff.append(name)
            self.set_staff_list(staff)
            return True
        return False
    
    def remove_staff(self, name: str):
        """移除人員"""
        staff = self.get_staff_list()
        staff = [s for s in staff if s != name]
        self.set_staff_list(staff)


from datetime import date
