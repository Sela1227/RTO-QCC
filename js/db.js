/**
 * SELA 體重追蹤系統 - IndexedDB 資料庫模組
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
    await Settings.set('staff_list', ['營養師', 'SDM']);
    
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
    
    await Settings.set('initialized', true);
    console.log('預設設定已初始化');
}
