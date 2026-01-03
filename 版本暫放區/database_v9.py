"""資料庫連線管理"""
import sqlite3
import threading
from pathlib import Path
from typing import Optional, List, Any
from app.config.settings import AppSettings


class Database:
    """SQLite 資料庫管理（支援多執行緒）"""
    
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
        AppSettings.ensure_dirs()
        self.db_path = AppSettings.DB_FILE
        # 使用 threading.local() 讓每個執行緒有自己的連線
        self._local = threading.local()
        self._initialized = True
    
    @property
    def conn(self) -> sqlite3.Connection:
        """取得當前執行緒的資料庫連線"""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(str(self.db_path))
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn
    
    def execute(self, sql: str, params: tuple = ()) -> int:
        """執行 SQL，回傳 lastrowid"""
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        self.conn.commit()
        return cursor.lastrowid
    
    def fetch_one(self, sql: str, params: tuple = ()) -> Optional[dict]:
        """查詢單筆"""
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def fetch_all(self, sql: str, params: tuple = ()) -> List[dict]:
        """查詢多筆"""
        cursor = self.conn.cursor()
        cursor.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]
    
    def initialize(self):
        """初始化資料庫結構"""
        schema = """
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
        """
        
        for statement in schema.split(";"):
            statement = statement.strip()
            if statement:
                self.execute(statement)
        
        # 初始版本記錄
        if not self.fetch_one("SELECT * FROM _db_migrations WHERE version = '1.0.0'"):
            self.execute(
                "INSERT INTO _db_migrations (version, migration_name) VALUES (?, ?)",
                ("1.0.0", "initial_schema")
            )
        
        # 1.1.0 - 新增無法測量欄位
        if not self.fetch_one("SELECT * FROM _db_migrations WHERE version = '1.1.0'"):
            try:
                self.execute("ALTER TABLE treatments ADD COLUMN unable_to_measure BOOLEAN DEFAULT 0")
                self.execute("ALTER TABLE treatments ADD COLUMN unable_reason VARCHAR(100)")
            except:
                pass  # 欄位已存在
            self.execute(
                "INSERT INTO _db_migrations (version, migration_name) VALUES (?, ?)",
                ("1.1.0", "add_unable_to_measure")
            )
        
        # 1.2.0 - 新增治療目的欄位
        if not self.fetch_one("SELECT * FROM _db_migrations WHERE version = '1.2.0'"):
            try:
                self.execute("ALTER TABLE patients ADD COLUMN treatment_intent VARCHAR(20)")
            except:
                pass  # 欄位已存在
            self.execute(
                "INSERT INTO _db_migrations (version, migration_name) VALUES (?, ?)",
                ("1.2.0", "add_treatment_intent")
            )
        
        # 1.3.0 - 修復體重變化率數據（確保下降為負、上升為正）
        if not self.fetch_one("SELECT * FROM _db_migrations WHERE version = '1.3.0'"):
            self._fix_change_rates()
            self.execute(
                "INSERT INTO _db_migrations (version, migration_name) VALUES (?, ?)",
                ("1.3.0", "fix_change_rates")
            )
        
        # 初始設定
        self._init_default_settings()
    
    def _fix_change_rates(self):
        """修復所有體重記錄的變化率"""
        treatments = self.fetch_all("SELECT id, baseline_weight FROM treatments")
        
        for t in treatments:
            treatment_id = t["id"]
            baseline = t["baseline_weight"]
            
            if not baseline or baseline <= 0:
                continue
            
            records = self.fetch_all(
                "SELECT id, weight FROM weight_records WHERE treatment_id = ?",
                (treatment_id,)
            )
            
            for r in records:
                record_id = r["id"]
                weight = r["weight"]
                
                # 正確計算：(目前 - 基準) / 基準 × 100
                # 下降為負，上升為正
                new_rate = round((weight - baseline) / baseline * 100, 2)
                
                # 重新判斷 alert_level
                if new_rate <= -5:
                    new_alert = "nutrition"
                elif new_rate <= -3:
                    new_alert = "sdm"
                else:
                    new_alert = "none"
                
                self.execute(
                    "UPDATE weight_records SET change_rate = ?, alert_level = ? WHERE id = ?",
                    (new_rate, new_alert, record_id)
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
    
    def close(self):
        """關閉當前執行緒的連線"""
        if hasattr(self._local, 'conn') and self._local.conn:
            self._local.conn.close()
            self._local.conn = None
