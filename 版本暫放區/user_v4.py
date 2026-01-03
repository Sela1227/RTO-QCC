"""用戶資料模型"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class User:
    """用戶"""
    id: Optional[int] = None
    username: str = ""
    password_hash: str = ""
    display_name: Optional[str] = None
    role: str = "user"  # admin, user, viewer
    is_active: bool = True
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    @property
    def role_label(self) -> str:
        labels = {
            "admin": "管理員",
            "user": "一般用戶",
            "viewer": "唯讀",
        }
        return labels.get(self.role, self.role)
    
    @property
    def is_admin(self) -> bool:
        return self.role == "admin"
    
    @property
    def can_edit(self) -> bool:
        return self.role in ("admin", "user")


@dataclass
class AuditLog:
    """操作紀錄"""
    id: Optional[int] = None
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str = ""
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None
    
    @property
    def action_label(self) -> str:
        labels = {
            "login": "登入",
            "logout": "登出",
            "create_patient": "新增病人",
            "update_patient": "更新病人",
            "delete_patient": "刪除病人",
            "create_treatment": "新增療程",
            "update_treatment": "更新療程",
            "create_weight": "新增體重",
            "update_weight": "更新體重",
            "delete_weight": "刪除體重",
            "create_intervention": "新增介入",
            "execute_intervention": "執行介入",
            "skip_intervention": "跳過介入",
            "create_user": "新增用戶",
            "update_user": "更新用戶",
            "disable_user": "停用用戶",
            "update_settings": "更新設定",
        }
        return labels.get(self.action, self.action)
