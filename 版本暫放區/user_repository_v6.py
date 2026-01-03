"""用戶資料存取"""
from typing import Optional, List
from app.models.database_v2 import Database
from app.models.user import User, AuditLog


class UserRepository:
    """用戶 Repository"""
    
    def __init__(self):
        self.db = Database()
    
    def get_by_id(self, id: int) -> Optional[User]:
        row = self.db.fetch_one("SELECT * FROM users WHERE id = ?", (id,))
        return User(**row) if row else None
    
    def get_by_username(self, username: str) -> Optional[User]:
        row = self.db.fetch_one("SELECT * FROM users WHERE username = ?", (username,))
        return User(**row) if row else None
    
    def get_all(self) -> List[User]:
        rows = self.db.fetch_all("SELECT * FROM users ORDER BY created_at DESC")
        return [User(**row) for row in rows]
    
    def get_active(self) -> List[User]:
        rows = self.db.fetch_all("SELECT * FROM users WHERE is_active = ? ORDER BY username", (True,))
        return [User(**row) for row in rows]
    
    def create(self, user: User) -> User:
        user.id = self.db.execute(
            """INSERT INTO users (username, password_hash, display_name, role, is_active)
               VALUES (?, ?, ?, ?, ?)""",
            (user.username, user.password_hash, user.display_name, user.role, user.is_active)
        )
        return user
    
    def update(self, user: User) -> User:
        self.db.execute(
            """UPDATE users SET display_name=?, role=?, is_active=?, updated_at=CURRENT_TIMESTAMP
               WHERE id=?""",
            (user.display_name, user.role, user.is_active, user.id)
        )
        return user
    
    def update_password(self, id: int, password_hash: str):
        self.db.execute(
            "UPDATE users SET password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (password_hash, id)
        )
    
    def update_last_login(self, id: int):
        self.db.execute(
            "UPDATE users SET last_login=CURRENT_TIMESTAMP WHERE id=?",
            (id,)
        )
    
    def disable(self, id: int):
        self.db.execute(
            "UPDATE users SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (False, id)
        )
    
    def enable(self, id: int):
        self.db.execute(
            "UPDATE users SET is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (True, id)
        )


class AuditLogRepository:
    """操作紀錄 Repository"""
    
    def __init__(self):
        self.db = Database()
    
    def create(self, log: AuditLog) -> AuditLog:
        log.id = self.db.execute(
            """INSERT INTO audit_logs (user_id, username, action, target_type, target_id, details, ip_address)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (log.user_id, log.username, log.action, log.target_type, log.target_id, log.details, log.ip_address)
        )
        return log
    
    def get_recent(self, limit: int = 100) -> List[AuditLog]:
        rows = self.db.fetch_all(
            "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        return [AuditLog(**row) for row in rows]
    
    def get_by_user(self, user_id: int, limit: int = 50) -> List[AuditLog]:
        rows = self.db.fetch_all(
            "SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit)
        )
        return [AuditLog(**row) for row in rows]
    
    def get_by_date_range(self, start_date: str, end_date: str) -> List[AuditLog]:
        rows = self.db.fetch_all(
            """SELECT * FROM audit_logs 
               WHERE date(created_at) BETWEEN ? AND ?
               ORDER BY created_at DESC""",
            (start_date, end_date)
        )
        return [AuditLog(**row) for row in rows]
    
    def get_by_action(self, action: str, limit: int = 100) -> List[AuditLog]:
        rows = self.db.fetch_all(
            "SELECT * FROM audit_logs WHERE action = ? ORDER BY created_at DESC LIMIT ?",
            (action, limit)
        )
        return [AuditLog(**row) for row in rows]
