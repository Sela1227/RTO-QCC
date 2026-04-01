/**
 * 彰濱放腫體重監控預防系統 - 密碼設定
 * 
 * ════════════════════════════════════════
 *   要改密碼？改下面這行就好！ 
 * ════════════════════════════════════════
 */

const CONFIG = {
    // 👇👇👇 改這裡 👇👇👇
    PASSWORD: 'QCC',
    // 👆👆👆 改這裡 👆👆👆
    
    // 記住登入幾天（0 = 每次都要輸入）
    REMEMBER_DAYS: 7,
    
    // 癌別選項
    CANCER_TYPES: [
        { code: 'head_neck', label: '頭頸癌' },
        { code: 'lung', label: '肺癌' },
        { code: 'esophagus', label: '食道癌' },
        { code: 'breast', label: '乳癌' },
        { code: 'prostate', label: '攝護腺癌' },
        { code: 'liver', label: '肝癌' },
        { code: 'cervical', label: '子宮頸癌' },
        { code: 'colorectal', label: '大腸直腸癌' },
        { code: 'brain', label: '腦瘤' },
        { code: 'other', label: '其他' }
    ]
};
