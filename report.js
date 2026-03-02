/**
 * 彰濱放腫體重監控預防系統 - IndexedDB 資料庫模組
 * 負責所有資料的本地儲存
 */

const DB_NAME = 'sela_weight_tracker';
const DB_VERSION = 1;

// 資料庫實例
let db = null;

/**
 * 初始化資料庫
 */
async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            console.error('資料庫開啟失敗', request.error);
            reject(request.error);
        };
        
        request.onsuccess = () => {
            db = request.result;
            console.log('資料庫已連線');
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            // 病人資料表
            if (!database.objectStoreNames.contains('patients')) {
                const patientStore = database.createObjectStore('patients', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                patientStore.createIndex('medical_id', 'medical_id', { unique: true });
                patientStore.createIndex('name', 'name', { unique: false });
            }
            
            // 療程資料表
            if (!database.objectStoreNames.contains('treatments')) {
                const treatmentStore = database.createObjectStore('treatments', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                treatmentStore.createIndex('patient_id', 'patient_id', { unique: false });
                treatmentStore.createIndex('status', 'status', { unique: false });
            }
            
            // 體重記錄表
            if (!database.objectStoreNames.contains('weight_records')) {
                const weightStore = database.createObjectStore('weight_records', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                weightStore.createIndex('treatment_id', 'treatment_id', { unique: false });
                weightStore.createIndex('measure_date', 'measure_date', { unique: false });
            }
            
            // 介入記錄表
            if (!database.objectStoreNames.contains('interventions')) {
                const interventionStore = database.createObjectStore('interventions', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                interventionStore.createIndex('treatment_id', 'treatment_id', { unique: false });
                interventionStore.createIndex('status', 'status', { unique: false });
            }
            
            // 設定表
            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }
            
            console.log('資料庫結構已建立');
        };
    });
}

/**
 * 通用 CRUD 操作
 */
const DB = {
    /**
     * 新增記錄
     */
    async add(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            // 加入時間戳
            data.created_at = new Date().toISOString();
            data.updated_at = new Date().toISOString();
            
            const request = store.add(data);
            
            request.onsuccess = () => {
                data.id = request.result;
                resolve(data);
            };
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 更新記錄
     */
    async update(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            data.updated_at = new Date().toISOString();
            
            const request = store.put(data);
            
            request.onsuccess = () => resolve(data);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 刪除記錄
     */
    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 取得單筆記錄
     */
    async get(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 取得所有記錄
     */
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 依索引查詢
     */
    async getByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(value);
            
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 依索引查詢單筆
     */
    async getOneByIndex(storeName, indexName, value) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.get(value);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 清空資料表
     */
    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();
            
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 計數
     */
    async count(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
};

/**
 * 設定存取
 */
const Settings = {
    async get(key, defaultValue = null) {
        const result = await DB.get('settings', key);
        return result ? result.value : defaultValue;
    },
    
    async set(key, value) {
        return DB.update('settings', { key, value, updated_at: new Date().toISOString() });
    },
    
    async getAll() {
        const all = await DB.getAll('settings');
        const result = {};
        all.forEach(item => {
            result[item.key] = item.value;
        });
        return result;
    }
};

/**
 * 匯出所有資料（備份）
 */
async function exportAllData() {
    const data = {
        version: DB_VERSION,
        exported_at: new Date().toISOString(),
        patients: await DB.getAll('patients'),
        treatments: await DB.getAll('treatments'),
        weight_records: await DB.getAll('weight_records'),
        interventions: await DB.getAll('interventions'),
        settings: await DB.getAll('settings')
    };
    return data;
}

/**
 * 匯入資料（還原）
 */
async function importAllData(data) {
    // 清空現有資料
    await DB.clear('patients');
    await DB.clear('treatments');
    await DB.clear('weight_records');
    await DB.clear('interventions');
    await DB.clear('settings');
    
    // 匯入新資料
    for (const patient of (data.patients || [])) {
        await DB.update('patients', patient);
    }
    for (const treatment of (data.treatments || [])) {
        await DB.update('treatments', treatment);
    }
    for (const record of (data.weight_records || [])) {
        await DB.update('weight_records', record);
    }
    for (const intervention of (data.interventions || [])) {
        await DB.update('interventions', intervention);
    }
    for (const setting of (data.settings || [])) {
        await DB.update('settings', setting);
    }
    
    return true;
}

/**
 * 初始化預設設定
 */
async function initDefaultSettings() {
    const existing = await Settings.get('initialized');
    if (existing) return;
    
    // 癌別
    await Settings.set('cancer_types', [
        { code: 'head_neck', label: '頭頸癌' },
        { code: 'lung', label: '肺癌' },
        { code: 'breast', label: '乳癌' },
        { code: 'esophagus', label: '食道癌' },
        { code: 'liver', label: '肝癌' },
        { code: 'colorectal', label: '大腸直腸癌' },
        { code: 'prostate', label: '攝護腺癌' },
        { code: 'cervical', label: '子宮頸癌' },
        { code: 'other', label: '其他' }
    ]);
    
    // 人員
    await Settings.set('staff_list', ['王孝宇', '陳詩韻', '廖芝穎']);
    
    // 警示規則
    await Settings.set('alert_rules', [
        { cancer_type: 'default', sdm_threshold: -3, nutrition_threshold: -5 },
        { cancer_type: 'head_neck', sdm_threshold: -3, nutrition_threshold: -5 }
    ]);
    
    // 治療目的
    await Settings.set('treatment_intents', [
        { code: 'curative', label: '根治性' },
        { code: 'palliative', label: '緩和性' },
        { code: 'adjuvant', label: '輔助性' }
    ]);
    
    // 無法測量原因
    await Settings.set('unable_reasons', [
        { code: 'bedridden', label: '臥床' },
        { code: 'wheelchair', label: '輪椅' },
        { code: 'refused', label: '拒測' },
        { code: 'other', label: '其他' }
    ]);
    
    // 暫停療程原因
    await Settings.set('pause_reasons', [
        { code: 'side_effect', label: '副作用' },
        { code: 'infection', label: '感染' },
        { code: 'hospitalized', label: '住院中' },
        { code: 'patient_request', label: '病人要求' },
        { code: 'other', label: '其他（手填）' }
    ]);
    
    await Settings.set('initialized', true);
    console.log('預設設定已初始化');
    
    // 初始化測試資料
    await initDemoData();
}

/**
 * 初始化測試資料（10位病人）
 */
async function initDemoData() {
    const patientCount = await DB.count('patients');
    if (patientCount > 0) return; // 已有資料則不重複建立
    
    const today = new Date();
    const formatDate = (d) => d.toISOString().split('T')[0];
    const daysAgo = (n) => {
        const d = new Date(today);
        d.setDate(d.getDate() - n);
        return formatDate(d);
    };
    
    // 測試病人資料
    const testPatients = [
        { medical_id: '1001234', name: '王大明', gender: 'M', birth_date: '1958-03-15', cancer: 'head_neck', baseline: 68.5, weights: [68.5, 67.8, 67.2, 66.5, 65.8] },
        { medical_id: '1001235', name: '李美玲', gender: 'F', birth_date: '1965-07-22', cancer: 'breast', baseline: 55.0, weights: [55.0, 54.8, 54.5, 54.2] },
        { medical_id: '1001236', name: '張志明', gender: 'M', birth_date: '1952-11-08', cancer: 'lung', baseline: 72.0, weights: [72.0, 70.5, 69.0, 67.5, 66.0, 64.5] },
        { medical_id: '1001237', name: '陳淑芬', gender: 'F', birth_date: '1970-04-30', cancer: 'cervical', baseline: 58.0, weights: [58.0, 57.5, 57.8, 57.2] },
        { medical_id: '1001238', name: '林建宏', gender: 'M', birth_date: '1948-09-12', cancer: 'prostate', baseline: 75.5, weights: [75.5, 75.0, 74.8] },
        { medical_id: '1001239', name: '黃雅婷', gender: 'F', birth_date: '1975-01-25', cancer: 'head_neck', baseline: 52.0, weights: [52.0, 51.5, 50.8, 50.0, 49.2] },
        { medical_id: '1001240', name: '吳俊傑', gender: 'M', birth_date: '1960-06-18', cancer: 'esophagus', baseline: 65.0, weights: [65.0, 63.5, 62.0, 60.5] },
        { medical_id: '1001241', name: '許惠珍', gender: 'F', birth_date: '1968-12-05', cancer: 'colorectal', baseline: 60.5, weights: [60.5, 60.2, 60.0, 59.8, 59.5] },
        { medical_id: '1001242', name: '鄭文彬', gender: 'M', birth_date: '1955-08-20', cancer: 'liver', baseline: 70.0, weights: [70.0, 69.5, 69.0] },
        { medical_id: '1001243', name: '蔡佳蓉', gender: 'F', birth_date: '1972-02-14', cancer: 'lung', baseline: 48.5, weights: [48.5, 47.8, 47.0, 46.2, 45.5] }
    ];
    
    for (let i = 0; i < testPatients.length; i++) {
        const p = testPatients[i];
        
        // 建立病人
        const patient = await DB.add('patients', {
            medical_id: p.medical_id,
            name: p.name,
            gender: p.gender,
            birth_date: p.birth_date,
            created_at: new Date().toISOString()
        });
        
        // 決定療程狀態
        let status = 'active';
        if (i === 7) status = 'paused'; // 第8位病人暫停中
        if (i === 9) status = 'completed'; // 第10位病人已完成
        
        // 建立療程
        const startDays = 30 + i * 3; // 療程開始日期
        const treatment = await DB.add('treatments', {
            patient_id: patient.id,
            cancer_type: p.cancer,
            treatment_intent: 'curative',
            treatment_start: daysAgo(startDays),
            baseline_weight: p.baseline,
            status: status,
            created_at: new Date().toISOString()
        });
        
        // 建立體重記錄
        for (let j = 0; j < p.weights.length; j++) {
            const weight = p.weights[j];
            const changeRate = ((weight - p.baseline) / p.baseline) * 100;
            
            await DB.add('weight_records', {
                treatment_id: treatment.id,
                weight: weight,
                measure_date: daysAgo(startDays - j * 7), // 每週記錄一次
                change_rate: changeRate,
                created_at: new Date().toISOString()
            });
        }
        
        // 部分病人建立待處理介入
        if (i === 0 || i === 2 || i === 5) {
            const lastWeight = p.weights[p.weights.length - 1];
            const changeRate = ((lastWeight - p.baseline) / p.baseline) * 100;
            
            await DB.add('interventions', {
                treatment_id: treatment.id,
                type: changeRate < -5 ? 'nutrition' : 'sdm',
                trigger_rate: changeRate,
                status: 'pending',
                created_at: new Date().toISOString()
            });
        }
    }
    
    console.log('測試資料已初始化（10位病人）');
}
