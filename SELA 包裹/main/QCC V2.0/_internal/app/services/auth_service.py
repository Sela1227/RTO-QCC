"""認證服務"""
import hashlib
from typing import Optional
from app.models.user import User, AuditLog
from app.repositories.user_repository import UserRepository, AuditLogRepository


class AuthService:
    """認證服務"""
    
    SALT = "sela_weight_tracker"
    
    def __init__(self):
        self.user_repo = UserRepository()
        self.audit_repo = AuditLogRepository()
        self._current_user: Optional[User] = None
    
    @property
    def current_user(self) -> Optional[User]:
        return self._current_user
    
    @property
    def is_logged_in(self) -> bool:
        return self._current_user is not None
    
    @property
    def is_admin(self) -> bool:
        return self._current_user and self._current_user.is_admin
    
    @property
    def can_edit(self) -> bool:
        return self._current_user and self._current_user.can_edit
    
    def hash_password(self, password: str) -> str:
        """密碼 Hash"""
        return hashlib.sha256(f"{password}{self.SALT}".encode()).hexdigest()
    
    def login(self, username: str, password: str, ip_address: str = None) -> tuple[bool, str]:
        """登入
        
        Returns:
            (success, message)
        """
        user = self.user_repo.get_by_username(username)
        
        if not user:
            return False, "帳號不存在"
        
        if not user.is_active:
            return False, "帳號已停用"
        
        password_hash = self.hash_password(password)
        if user.password_hash != password_hash:
            return False, "密碼錯誤"
        
        # 登入成功
        self._current_user = user
        self.user_repo.update_last_login(user.id)
        
        # 記錄登入
        self.log_action("login", ip_address=ip_address)
        
        return True, "登入成功"
    
    def logout(self):
        """登出"""
        if self._current_user:
            self.log_action("logout")
        self._current_user = None
    
    def change_password(self, old_password: str, new_password: str) -> tuple[bool, str]:
        """變更密碼"""
        if not self._current_user:
            return False, "未登入"
        
        old_hash = self.hash_password(old_password)
        if self._current_user.password_hash != old_hash:
            return False, "舊密碼錯誤"
        
        if len(new_password) < 4:
            return False, "新密碼至少 4 個字元"
        
        new_hash = self.hash_password(new_password)
        self.user_repo.update_password(self._current_user.id, new_hash)
        self._current_user.password_hash = new_hash
        
        self.log_action("change_password")
        
        return True, "密碼已變更"
    
    def log_action(self, action: str, target_type: str = None, target_id: int = None, 
                   details: str = None, ip_address: str = None):
        """記錄操作"""
        if not self._current_user:
            return
        
        log = AuditLog(
            user_id=self._current_user.id,
            username=self._current_user.username,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip_address=ip_address,
        )
        self.audit_repo.create(log)


class UserService:
    """用戶管理服務"""
    
    def __init__(self, auth_service: AuthService = None):
        self.user_repo = UserRepository()
        self.auth_service = auth_service or AuthService()
    
    def get_all(self):
        return self.user_repo.get_all()
    
    def get_active(self):
        return self.user_repo.get_active()
    
    def get_by_id(self, id: int):
        return self.user_repo.get_by_id(id)
    
    def create(self, username: str, password: str, display_name: str = None, 
               role: str = "user") -> tuple[bool, str, Optional[User]]:
        """建立用戶"""
        # 檢查權限
        if not self.auth_service.is_admin:
            return False, "需要管理員權限", None
        
        # 檢查用戶名
        existing = self.user_repo.get_by_username(username)
        if existing:
            return False, "帳號已存在", None
        
        if len(username) < 3:
            return False, "帳號至少 3 個字元", None
        
        if len(password) < 4:
            return False, "密碼至少 4 個字元", None
        
        # 建立用戶
        user = User(
            username=username,
            password_hash=self.auth_service.hash_password(password),
            display_name=display_name or username,
            role=role,
            is_active=True,
        )
        user = self.user_repo.create(user)
        
        # 記錄
        self.auth_service.log_action("create_user", "user", user.id, f"新增用戶：{username}")
        
        return True, "用戶已建立", user
    
    def update(self, id: int, display_name: str = None, role: str = None) -> tuple[bool, str]:
        """更新用戶"""
        if not self.auth_service.is_admin:
            return False, "需要管理員權限"
        
        user = self.user_repo.get_by_id(id)
        if not user:
            return False, "用戶不存在"
        
        if display_name:
            user.display_name = display_name
        if role:
            user.role = role
        
        self.user_repo.update(user)
        self.auth_service.log_action("update_user", "user", id, f"更新用戶：{user.username}")
        
        return True, "已更新"
    
    def reset_password(self, id: int, new_password: str) -> tuple[bool, str]:
        """重設密碼"""
        if not self.auth_service.is_admin:
            return False, "需要管理員權限"
        
        user = self.user_repo.get_by_id(id)
        if not user:
            return False, "用戶不存在"
        
        if len(new_password) < 4:
            return False, "密碼至少 4 個字元"
        
        password_hash = self.auth_service.hash_password(new_password)
        self.user_repo.update_password(id, password_hash)
        
        self.auth_service.log_action("reset_password", "user", id, f"重設密碼：{user.username}")
        
        return True, "密碼已重設"
    
    def disable(self, id: int) -> tuple[bool, str]:
        """停用用戶"""
        if not self.auth_service.is_admin:
            return False, "需要管理員權限"
        
        user = self.user_repo.get_by_id(id)
        if not user:
            return False, "用戶不存在"
        
        if user.username == "admin":
            return False, "無法停用管理員帳號"
        
        self.user_repo.disable(id)
        self.auth_service.log_action("disable_user", "user", id, f"停用用戶：{user.username}")
        
        return True, "用戶已停用"
    
    def enable(self, id: int) -> tuple[bool, str]:
        """啟用用戶"""
        if not self.auth_service.is_admin:
            return False, "需要管理員權限"
        
        user = self.user_repo.get_by_id(id)
        if not user:
            return False, "用戶不存在"
        
        self.user_repo.enable(id)
        self.auth_service.log_action("enable_user", "user", id, f"啟用用戶：{user.username}")
        
        return True, "用戶已啟用"


class AuditService:
    """操作紀錄服務"""
    
    def __init__(self):
        self.audit_repo = AuditLogRepository()
    
    def get_recent(self, limit: int = 100):
        return self.audit_repo.get_recent(limit)
    
    def get_by_user(self, user_id: int, limit: int = 50):
        return self.audit_repo.get_by_user(user_id, limit)
    
    def get_by_date_range(self, start_date: str, end_date: str):
        return self.audit_repo.get_by_date_range(start_date, end_date)
