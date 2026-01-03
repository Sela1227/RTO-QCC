"""資料庫連線管理 - 支援 PostgreSQL 和 SQLite"""
import os
import threading
from pathlib import Path
from typing import Optional, List, Any
from datetime import datetime
import hashlib


class Database:
    """資料庫管理（支援 PostgreSQL 雲端 / SQLite 本地）"""
    
    _instance: Optional["Database"] = None
    _lock = threading.Lock()
    
    def __new__(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
                    cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self.database_url = os.environ.get("DATABASE_URL")
        self.is_postgres = bool(self.database_url)
        self._local = threading.local()
        self._initialized = True
    
    @property
    def conn(self):
        """取得當前執行緒的資料庫連線"""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            if self.is_postgres:
                import psycopg2
                import psycopg2.extras
                # Railway 的 DATABASE_URL 格式轉換
                url = self.database_url
                if url.startswith("postgres://"):
                    url = url.replace("postgres://", "postgresql://", 1)
                self._local.conn = psycopg2.connect(url)
                self._local.conn.autocommit = False
            else:
                import sqlite3
                from app.config.settings import AppSettings
                AppSettings.ensure_dirs()
                self._local.conn = sqlite3.connect(str(AppSettings.DB_FILE))
                self._local.conn.row_factory = sqlite3.Row
        return self._local.conn
    
    def _get_cursor(self):
        """取得 cursor（PostgreSQL 使用 RealDictCursor）"""
        if self.is_postgres:
            import psycopg2.extras
            return self.conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        return self.conn.cursor()
    
    def execute(self, sql: str, params: tuple = ()) -> int:
        """執行 SQL，回傳 lastrowid"""
        cursor = self._get_cursor()
        
        # PostgreSQL 參數佔位符轉換
        if self.is_postgres:
            sql = sql.replace("?", "%s")
            # AUTOINCREMENT -> SERIAL
            sql = sql.replace("INTEGER PRIMARY KEY AUTOINCREMENT", "SERIAL PRIMARY KEY")
            sql = sql.replace("BOOLEAN DEFAULT 0", "BOOLEAN DEFAULT FALSE")
            sql = sql.replace("BOOLEAN DEFAULT 1", "BOOLEAN DEFAULT TRUE")
        
        cursor.execute(sql, params)
        
        if self.is_postgres:
            self.conn.commit()
            # PostgreSQL 取得 lastrowid
            if "INSERT" in sql.upper() and "RETURNING" not in sql.upper():
                try:
                    cursor.execute("SELECT lastval()")
                    result = cursor.fetchone()
                    return result[0] if result else 0
                except:
                    return 0
            return 0
        else:
            self.conn.commit()
            return cursor.lastrowid
    
    def execute_returning(self, sql: str, params: tuple = ()) -> int:
        """執行 INSERT 並回傳 ID（PostgreSQL 用 RETURNING）"""
        cursor = self._get_cursor()
        
        if self.is_postgres:
            sql = sql.replace("?", "%s")
            if "RETURNING" not in sql.upper():
                sql = sql.rstrip(";").rstrip(")") + ") RETURNING id"
            cursor.execute(sql, params)
            self.conn.commit()
            result = cursor.fetchone()
            return result['id'] if result else 0
        else:
            cursor.execute(sql, params)
            self.conn.commit()
            return cursor.lastrowid
    
    def fetch_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        """查詢單筆"""
        cursor = self._get_cursor()
        if self.is_postgres:
            sql = sql.replace("?", "%s")
        cursor.execute(sql, params)
        row = cursor.fetchone()
        if row is None:
            return None
        if self.is_postgres:
            return dict(row)
        return dict(row)
    
    def fetch_all(self, sql: str, params: tuple = ()) -> List[dict]:
        """查詢多筆"""
        cursor = self._get_cursor()
        if self.is_postgres:
            sql = sql.replace("?", "%s")
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        if self.is_postgres:
            return [dict(row) for row in rows]
        return [dict(row) for row in rows]
    
    def initialize(self):
        """初始化資料庫結構"""
        if self.is_postgres:
            self._init_postgres_schema()
        else:
            self._init_sqlite_schema()
        
        self._run_migrations()
        self._init_default_settings()
        self._init_default_admin()
    
    def _init_postgres_schema(self):
        """PostgreSQL Schema"""
        schema = """
        -- 用戶表
        CREATE TABLE IF NOT EXISTS users (
            id              SERIAL PRIMARY KEY,
            username        VARCHAR(50) UNIQUE NOT NULL,
            password_hash   VARCHAR(255) NOT NULL,
            display_name    VARCHAR(100),
            role            VARCHAR(20) DEFAULT 'user',
            is_active       BOOLEAN DEFAULT TRUE,
            last_login      TIMESTAMP,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 操作紀錄表
        CREATE TABLE IF NOT EXISTS audit_logs (
            id              SERIAL PRIMARY KEY,
            user_id         INTEGER REFERENCES users(id),
            username        VARCHAR(50),
            action          VARCHAR(50) NOT NULL,
            target_type     VARCHAR(50),
            target_id       INTEGER,
            details         TEXT,
            ip_address      VARCHAR(50),
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 病人表
        CREATE TABLE IF NOT EXISTS patients (
            id              SERIAL PRIMARY KEY,
            medical_id      VARCHAR(50) UNIQUE NOT NULL,
            name            VARCHAR(100) NOT NULL,
            gender          VARCHAR(10),
            birth_date      DATE,
            treatment_intent VARCHAR(20),
            extra_fields    JSON,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 療程表
        CREATE TABLE IF NOT EXISTS treatments (
            id                  SERIAL PRIMARY KEY,
            patient_id          INTEGER NOT NULL REFERENCES patients(id),
            cancer_type         VARCHAR(100) NOT NULL,
            treatment_intent    VARCHAR(20),
            treatment_name      VARCHAR(255),
            treatment_start     DATE NOT NULL,
            treatment_end       DATE,
            baseline_weight     DECIMAL(5,2) NOT NULL,
            baseline_date       DATE NOT NULL,
            status              VARCHAR(20) DEFAULT 'active',
            status_reason       VARCHAR(255),
            status_changed_at   TIMESTAMP,
            unable_to_measure   BOOLEAN DEFAULT FALSE,
            unable_reason       VARCHAR(100),
            extra_fields        JSON,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 體重記錄表
        CREATE TABLE IF NOT EXISTS weight_records (
            id              SERIAL PRIMARY KEY,
            treatment_id    INTEGER NOT NULL REFERENCES treatments(id),
            measure_date    DATE NOT NULL,
            weight          DECIMAL(5,2) NOT NULL,
            change_rate     DECIMAL(5,2),
            alert_level     VARCHAR(20),
            notes           TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 介入記錄表
        CREATE TABLE IF NOT EXISTS interventions (
            id                  SERIAL PRIMARY KEY,
            treatment_id        INTEGER NOT NULL REFERENCES treatments(id),
            weight_record_id    INTEGER REFERENCES weight_records(id),
            type                VARCHAR(20) NOT NULL,
            source              VARCHAR(20) DEFAULT 'auto',
            trigger_reason      TEXT,
            status              VARCHAR(20) DEFAULT 'pending',
            executed_at         DATE,
            executed_by         VARCHAR(100),
            result              TEXT,
            skip_reason         VARCHAR(50),
            skip_note           TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 系統設定表
        CREATE TABLE IF NOT EXISTS settings (
            id              SERIAL PRIMARY KEY,
            category        VARCHAR(50) NOT NULL,
            key             VARCHAR(100) NOT NULL,
            value           TEXT,
            value_type      VARCHAR(20),
            description     VARCHAR(255),
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(category, key)
        );
        
        -- 資料庫版本表
        CREATE TABLE IF NOT EXISTS _db_migrations (
            id              SERIAL PRIMARY KEY,
            version         VARCHAR(20) NOT NULL,
            migration_name  VARCHAR(100) NOT NULL,
            applied_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 索引
        CREATE INDEX IF NOT EXISTS idx_patient_medical_id ON patients(medical_id);
        CREATE INDEX IF NOT EXISTS idx_treatment_patient ON treatments(patient_id);
        CREATE INDEX IF NOT EXISTS idx_treatment_status ON treatments(status);
        CREATE INDEX IF NOT EXISTS idx_weight_treatment ON weight_records(treatment_id);
        CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_records(measure_date);
        CREATE INDEX IF NOT EXISTS idx_intervention_treatment ON interventions(treatment_id);
        CREATE INDEX IF NOT EXISTS idx_intervention_status ON interventions(status);
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
        """
        
        for statement in schema.split(";"):
            statement = statement.strip()
            if statement:
                try:
                    self.execute(statement)
                except Exception as e:
                    print(f"Schema error (可能已存在): {e}")
    
    def _init_sqlite_schema(self):
        """SQLite Schema"""
        schema = """
        -- 用戶表
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            username        VARCHAR(50) UNIQUE NOT NULL,
            password_hash   VARCHAR(255) NOT NULL,
            display_name    VARCHAR(100),
            role            VARCHAR(20) DEFAULT 'user',
            is_active       BOOLEAN DEFAULT 1,
            last_login      TIMESTAMP,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 操作紀錄表
        CREATE TABLE IF NOT EXISTS audit_logs (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER REFERENCES users(id),
            username        VARCHAR(50),
            action          VARCHAR(50) NOT NULL,
            target_type     VARCHAR(50),
            target_id       INTEGER,
            details         TEXT,
            ip_address      VARCHAR(50),
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 病人表
        CREATE TABLE IF NOT EXISTS patients (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            medical_id      VARCHAR(50) UNIQUE NOT NULL,
            name            VARCHAR(100) NOT NULL,
            gender          VARCHAR(10),
            birth_date      DATE,
            treatment_intent VARCHAR(20),
            extra_fields    JSON,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 療程表
        CREATE TABLE IF NOT EXISTS treatments (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id          INTEGER NOT NULL REFERENCES patients(id),
            cancer_type         VARCHAR(100) NOT NULL,
            treatment_intent    VARCHAR(20),
            treatment_name      VARCHAR(255),
            treatment_start     DATE NOT NULL,
            treatment_end       DATE,
            baseline_weight     DECIMAL(5,2) NOT NULL,
            baseline_date       DATE NOT NULL,
            status              VARCHAR(20) DEFAULT 'active',
            status_reason       VARCHAR(255),
            status_changed_at   TIMESTAMP,
            unable_to_measure   BOOLEAN DEFAULT 0,
            unable_reason       VARCHAR(100),
            extra_fields        JSON,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 體重記錄表
        CREATE TABLE IF NOT EXISTS weight_records (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            treatment_id    INTEGER NOT NULL REFERENCES treatments(id),
            measure_date    DATE NOT NULL,
            weight          DECIMAL(5,2) NOT NULL,
            change_rate     DECIMAL(5,2),
            alert_level     VARCHAR(20),
            notes           TEXT,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 介入記錄表
        CREATE TABLE IF NOT EXISTS interventions (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            treatment_id        INTEGER NOT NULL REFERENCES treatments(id),
            weight_record_id    INTEGER REFERENCES weight_records(id),
            type                VARCHAR(20) NOT NULL,
            source              VARCHAR(20) DEFAULT 'auto',
            trigger_reason      TEXT,
            status              VARCHAR(20) DEFAULT 'pending',
            executed_at         DATE,
            executed_by         VARCHAR(100),
            result              TEXT,
            skip_reason         VARCHAR(50),
            skip_note           TEXT,
            created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 系統設定表
        CREATE TABLE IF NOT EXISTS settings (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            category        VARCHAR(50) NOT NULL,
            key             VARCHAR(100) NOT NULL,
            value           TEXT,
            value_type      VARCHAR(20),
            description     VARCHAR(255),
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(category, key)
        );
        
        -- 資料庫版本表
        CREATE TABLE IF NOT EXISTS _db_migrations (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            version         VARCHAR(20) NOT NULL,
            migration_name  VARCHAR(100) NOT NULL,
            applied_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- 索引
        CREATE INDEX IF NOT EXISTS idx_patient_medical_id ON patients(medical_id);
        CREATE INDEX IF NOT EXISTS idx_treatment_patient ON treatments(patient_id);
        CREATE INDEX IF NOT EXISTS idx_treatment_status ON treatments(status);
        CREATE INDEX IF NOT EXISTS idx_weight_treatment ON weight_records(treatment_id);
        CREATE INDEX IF NOT EXISTS idx_weight_date ON weight_records(measure_date);
        CREATE INDEX IF NOT EXISTS idx_intervention_treatment ON interventions(treatment_id);
        CREATE INDEX IF NOT EXISTS idx_intervention_status ON interventions(status);
        CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
        """
        
        for statement in schema.split(";"):
            statement = statement.strip()
            if statement:
                try:
                    self.execute(statement)
                except Exception as e:
                    print(f"Schema error: {e}")
    
    def _run_migrations(self):
        """執行資料庫遷移"""
        # 檢查初始版本
        if not self.fetch_one("SELECT * FROM _db_migrations WHERE version = '2.0.0'"):
            self.execute(
                "INSERT INTO _db_migrations (version, migration_name) VALUES (?, ?)",
                ("2.0.0", "cloud_version_with_users")
            )
    
    def _init_default_settings(self):
        """初始化預設設定"""
        defaults = [
            ("alert", "sdm_threshold", "3", "number", "SDM 提醒閾值 (%)"),
            ("alert", "nutrition_threshold", "5", "number", "營養師轉介閾值 (%)"),
            ("reminder", "warning_days", "5", "number", "幾天後開始提醒"),
            ("reminder", "overdue_days", "7", "number", "幾天後視為逾期"),
            ("reminder", "show_on_startup", "true", "boolean", "啟動時顯示逾期提醒"),
        ]
        
        for category, key, value, vtype, desc in defaults:
            existing = self.fetch_one(
                "SELECT * FROM settings WHERE category = ? AND key = ?",
                (category, key)
            )
            if not existing:
                self.execute(
                    """INSERT INTO settings (category, key, value, value_type, description)
                       VALUES (?, ?, ?, ?, ?)""",
                    (category, key, value, vtype, desc)
                )
    
    def _init_default_admin(self):
        """初始化預設管理員帳號"""
        existing = self.fetch_one("SELECT * FROM users WHERE username = ?", ("admin",))
        if not existing:
            # 密碼 hash（使用 SHA256 + salt）
            password = "1227"
            salt = "sela_weight_tracker"
            password_hash = hashlib.sha256(f"{password}{salt}".encode()).hexdigest()
            
            self.execute(
                """INSERT INTO users (username, password_hash, display_name, role, is_active)
                   VALUES (?, ?, ?, ?, ?)""",
                ("admin", password_hash, "系統管理員", "admin", True if self.is_postgres else 1)
            )
            print("已建立預設管理員帳號：admin / 1227")
    
    def close(self):
        """關閉當前執行緒的連線"""
        if hasattr(self._local, 'conn') and self._local.conn:
            self._local.conn.close()
            self._local.conn = None
