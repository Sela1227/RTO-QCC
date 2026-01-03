"""系統設定"""
from pathlib import Path

class AppSettings:
    """應用程式設定"""
    
    # 路徑
    BASE_DIR = Path(__file__).parent.parent.parent
    DATA_DIR = BASE_DIR / "data"
    BACKUP_DIR = BASE_DIR / "backups"
    EXPORT_DIR = BASE_DIR / "exports"
    
    # 資料庫
    DB_FILE = DATA_DIR / "weight_tracker.db"
    
    # 自動儲存
    AUTOSAVE_FILE = DATA_DIR / "autosave.json"
    
    # 預設設定值
    DEFAULT_SETTINGS = {
        "alert": {
            "sdm_threshold": 3,
            "nutrition_threshold": 5,
        },
        "reminder": {
            "warning_days": 5,
            "overdue_days": 7,
            "show_on_startup": True,
        },
        "report": {
            "default_range": "this_month",
            "page_size": 20,
        },
    }
    
    @classmethod
    def ensure_dirs(cls):
        """確保目錄存在"""
        cls.DATA_DIR.mkdir(parents=True, exist_ok=True)
        cls.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
        cls.EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        (cls.BACKUP_DIR / "daily").mkdir(exist_ok=True)
        (cls.BACKUP_DIR / "pre_upgrade").mkdir(exist_ok=True)
        (cls.BACKUP_DIR / "manual").mkdir(exist_ok=True)
