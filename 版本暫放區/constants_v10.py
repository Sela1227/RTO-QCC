"""常數定義"""

# ============================================================
# 癌別選項
# ============================================================
CANCER_TYPES = [
    {"code": "HN", "label": "頭頸癌"},
    {"code": "LUNG", "label": "肺癌"},
    {"code": "BREAST", "label": "乳癌"},
    {"code": "GI", "label": "腸胃道癌"},
    {"code": "GU", "label": "泌尿道癌"},
    {"code": "GYN", "label": "婦癌"},
    {"code": "CNS", "label": "腦瘤"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# 性別選項
# ============================================================
GENDER_OPTIONS = [
    {"code": "M", "label": "男"},
    {"code": "F", "label": "女"},
]

# ============================================================
# 療程狀態
# ============================================================
TREATMENT_STATUS = [
    {"code": "active", "label": "追蹤中", "color": "green"},
    {"code": "paused", "label": "暫停中", "color": "orange"},
    {"code": "terminated", "label": "已終止", "color": "red"},
    {"code": "completed", "label": "已結案", "color": "gray"},
]

# ============================================================
# 追蹤狀態
# ============================================================
TRACKING_STATUS = [
    {"code": "normal", "label": "正常", "icon": "🟢"},
    {"code": "pending", "label": "待量測", "icon": "🟡"},
    {"code": "overdue", "label": "逾期", "icon": "🔴"},
]

# ============================================================
# 警示等級
# ============================================================
ALERT_LEVELS = [
    {"code": "none", "label": "正常", "threshold": 0},
    {"code": "sdm", "label": "SDM", "threshold": 3},
    {"code": "nutrition", "label": "營養師", "threshold": 5},
]

# ============================================================
# 介入類型
# ============================================================
INTERVENTION_TYPES = [
    {"code": "sdm", "label": "SDM"},
    {"code": "nutrition", "label": "營養師轉介"},
]

# ============================================================
# 介入來源
# ============================================================
INTERVENTION_SOURCES = [
    {"code": "auto", "label": "系統觸發"},
    {"code": "manual", "label": "手動新增"},
]

# ============================================================
# 暫停原因
# ============================================================
PAUSE_REASONS = [
    {"code": "HOSPITALIZED", "label": "住院中"},
    {"code": "SIDE_EFFECT", "label": "副作用暫停治療"},
    {"code": "PERSONAL", "label": "病人個人因素"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# 終止原因
# ============================================================
TERMINATE_REASONS = [
    {"code": "DECEASED", "label": "病人過世"},
    {"code": "TRANSFER", "label": "轉院"},
    {"code": "WITHDRAW", "label": "病人放棄治療"},
    {"code": "CONDITION", "label": "病況不適合繼續"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# 手動介入觸發原因
# ============================================================
MANUAL_TRIGGER_REASONS = [
    {"code": "PROACTIVE_ASSESS", "label": "主動評估"},
    {"code": "PATIENT_REQUEST", "label": "病人/家屬要求"},
    {"code": "PHYSICIAN_ORDER", "label": "醫師醫囑"},
    {"code": "CLINICAL_OBSERVATION", "label": "臨床觀察"},
    {"code": "FOLLOW_UP", "label": "追蹤複評"},
    {"code": "BACKFILL", "label": "補登記錄"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# 略過介入原因
# ============================================================
SKIP_REASONS = [
    {"code": "PATIENT_REFUSED", "label": "病人拒絕"},
    {"code": "SELF_MANAGED", "label": "病人已自行處理"},
    {"code": "PHYSICIAN_DECISION", "label": "醫師評估暫不需要"},
    {"code": "ALREADY_REFERRED", "label": "已有其他轉介"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# 無法測量原因
# ============================================================
UNABLE_REASONS = [
    {"code": "BEDRIDDEN", "label": "臥床"},
    {"code": "IMMOBILE", "label": "行動不便"},
    {"code": "REFUSED", "label": "拒絕配合"},
    {"code": "EQUIPMENT", "label": "設備限制"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# SDM 介入原因
# ============================================================
SDM_REASONS = [
    {"code": "WEIGHT_LOSS", "label": "體重下降 ≥3%"},
    {"code": "APPETITE_CHANGE", "label": "食慾明顯改變"},
    {"code": "SWALLOWING_DIFFICULTY", "label": "吞嚥困難"},
    {"code": "NAUSEA_VOMITING", "label": "噁心嘔吐"},
    {"code": "TASTE_CHANGE", "label": "味覺改變"},
    {"code": "MUCOSITIS", "label": "口腔黏膜炎"},
    {"code": "FATIGUE", "label": "疲倦虛弱"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# 營養師轉介原因
# ============================================================
NUTRITION_REASONS = [
    {"code": "WEIGHT_LOSS", "label": "體重下降 ≥5%"},
    {"code": "SEVERE_APPETITE", "label": "嚴重食慾不振"},
    {"code": "UNABLE_ORAL", "label": "無法經口進食"},
    {"code": "TUBE_FEEDING", "label": "需管灌飲食"},
    {"code": "NUTRITION_RISK", "label": "營養風險評估異常"},
    {"code": "FAMILY_REQUEST", "label": "家屬要求"},
    {"code": "OTHER", "label": "其他"},
]

# ============================================================
# 快速日期選項
# ============================================================
DATE_PRESETS = [
    {"code": "this_week", "label": "本週"},
    {"code": "this_month", "label": "本月"},
    {"code": "last_month", "label": "上月"},
    {"code": "last_3_months", "label": "近三個月"},
    {"code": "custom", "label": "自訂"},
]


def get_label(options: list, code: str) -> str:
    """從選項列表取得標籤"""
    for opt in options:
        if opt["code"] == code:
            return opt["label"]
    return code
