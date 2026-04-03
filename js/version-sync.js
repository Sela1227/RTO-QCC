/**
 * RTO-QCC 版本同步模組
 * 基於 version-sync-spec.md 實作
 * 支援共享資料夾 + localStorage 雙儲存，版本號衝突解決
 */

const VersionSync = {
    // 共享資料夾句柄（持久化在 IndexedDB）
    directoryHandle: null,
    
    // 檔案名稱
    FILENAME: 'RTO-QCC-DATA.json',
    BACKUP_KEY: 'rto_qcc_backup',
    HANDLE_KEY: 'rto_qcc_dir_handle',
    
    // 當前用戶名稱
    currentUser: '',
    
    /**
     * 初始化
     */
    async init() {
        // 嘗試從 IndexedDB 恢復目錄句柄
        await this.restoreDirectoryHandle();
        
        // 取得當前用戶名稱
        const staffList = await Settings.get('staff_list', []);
        this.currentUser = staffList[0] || '未設定';
    },
    
    /**
     * 設定當前用戶
     */
    setCurrentUser(name) {
        this.currentUser = name;
    },
    
    // ==================== 網路時間 ====================
    
    /**
     * 取得網路時間（瀑布式嘗試多個來源）
     */
    async getNetworkTime() {
        const sources = [
            {
                name: "TimeAPI.io",
                fetch: async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const r = await fetch(
                        "https://timeapi.io/api/time/current/zone?timeZone=Asia/Taipei",
                        { signal: controller.signal }
                    );
                    clearTimeout(timeoutId);
                    
                    const d = await r.json();
                    return { 
                        time: new Date(`${d.date}T${d.time}+08:00`).toISOString(), 
                        source: "TimeAPI.io" 
                    };
                }
            },
            {
                name: "Cloudflare",
                fetch: async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000);
                    
                    const r = await fetch(
                        "https://cloudflare.com/cdn-cgi/trace",
                        { signal: controller.signal }
                    );
                    clearTimeout(timeoutId);
                    
                    const text = await r.text();
                    const ts = text.match(/ts=([0-9.]+)/)?.[1];
                    if (!ts) throw new Error("no ts field");
                    return { 
                        time: new Date(parseFloat(ts) * 1000).toISOString(), 
                        source: "Cloudflare" 
                    };
                }
            }
        ];

        for (const source of sources) {
            try {
                const result = await source.fetch();
                console.log(`網路時間取得成功: ${source.name}`);
                return result;
            } catch (e) {
                console.warn(`${source.name} 時間取得失敗:`, e.message);
                continue;
            }
        }

        // 所有來源失敗，使用本機時間
        console.warn('所有網路時間來源失敗，使用本機時間');
        return { 
            time: new Date().toISOString(), 
            source: "local" 
        };
    },
    
    // ==================== 共享資料夾操作 ====================
    
    /**
     * 選擇共享資料夾
     */
    async selectDirectory() {
        if (!('showDirectoryPicker' in window)) {
            showToast('此瀏覽器不支援資料夾存取，請使用 Chrome 或 Edge', 'error');
            return false;
        }
        
        try {
            this.directoryHandle = await window.showDirectoryPicker({ 
                mode: 'readwrite',
                startIn: 'documents'
            });
            
            // 儲存句柄到 IndexedDB
            await this.saveDirectoryHandle();
            
            showToast('已連接共享資料夾', 'success');
            return true;
        } catch (e) {
            if (e.name === 'AbortError') {
                return false; // 用戶取消
            }
            console.error('選擇資料夾失敗:', e);
            showToast('選擇資料夾失敗', 'error');
            return false;
        }
    },
    
    /**
     * 儲存目錄句柄到 IndexedDB
     */
    async saveDirectoryHandle() {
        if (!this.directoryHandle) return;
        
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('rto_qcc_handles', 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
            
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('handles', 'readwrite');
                const store = tx.objectStore('handles');
                store.put(this.directoryHandle, this.HANDLE_KEY);
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => reject(tx.error);
            };
            
            request.onerror = () => reject(request.error);
        });
    },
    
    /**
     * 從 IndexedDB 恢復目錄句柄
     */
    async restoreDirectoryHandle() {
        return new Promise((resolve) => {
            const request = indexedDB.open('rto_qcc_handles', 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('handles')) {
                    db.createObjectStore('handles');
                }
            };
            
            request.onsuccess = async (e) => {
                const db = e.target.result;
                const tx = db.transaction('handles', 'readonly');
                const store = tx.objectStore('handles');
                const getRequest = store.get(this.HANDLE_KEY);
                
                getRequest.onsuccess = async () => {
                    if (getRequest.result) {
                        this.directoryHandle = getRequest.result;
                        
                        // 驗證權限
                        try {
                            const permission = await this.directoryHandle.queryPermission({ mode: 'readwrite' });
                            if (permission !== 'granted') {
                                // 嘗試請求權限
                                const newPermission = await this.directoryHandle.requestPermission({ mode: 'readwrite' });
                                if (newPermission !== 'granted') {
                                    this.directoryHandle = null;
                                }
                            }
                        } catch (e) {
                            console.warn('權限驗證失敗:', e);
                            this.directoryHandle = null;
                        }
                    }
                    resolve(this.directoryHandle !== null);
                };
                
                getRequest.onerror = () => resolve(false);
            };
            
            request.onerror = () => resolve(false);
        });
    },
    
    /**
     * 檢查是否已連接共享資料夾
     */
    isConnected() {
        return this.directoryHandle !== null;
    },
    
    /**
     * 從共享資料夾讀取資料
     */
    async readFromSharedFolder() {
        if (!this.directoryHandle) return null;
        
        try {
            const fileHandle = await this.directoryHandle.getFileHandle(this.FILENAME);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
        } catch (e) {
            if (e.name === 'NotFoundError') {
                return null; // 檔案不存在
            }
            console.error('讀取共享資料夾失敗:', e);
            throw e;
        }
    },
    
    /**
     * 寫入共享資料夾
     */
    async writeToSharedFolder(payload) {
        if (!this.directoryHandle) {
            throw new Error('未連接共享資料夾');
        }
        
        try {
            const fileHandle = await this.directoryHandle.getFileHandle(this.FILENAME, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(payload, null, 2));
            await writable.close();
            return true;
        } catch (e) {
            console.error('寫入共享資料夾失敗:', e);
            throw e;
        }
    },
    
    // ==================== localStorage 備份 ====================
    
    /**
     * 從 localStorage 讀取備份
     */
    readFromLocalBackup() {
        try {
            const data = localStorage.getItem(this.BACKUP_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('讀取本機備份失敗:', e);
            return null;
        }
    },
    
    /**
     * 寫入 localStorage 備份
     */
    writeToLocalBackup(payload) {
        try {
            localStorage.setItem(this.BACKUP_KEY, JSON.stringify(payload));
            return true;
        } catch (e) {
            console.error('寫入本機備份失敗:', e);
            return false;
        }
    },
    
    // ==================== 版本控制 ====================
    
    /**
     * 建立儲存 payload
     */
    async createPayload(data, existingVersion = 0) {
        const { time, source } = await this.getNetworkTime();
        
        return {
            version: existingVersion + 1,
            savedAt: time,
            savedAtSource: source,
            savedBy: this.currentUser,
            data: data
        };
    },
    
    /**
     * 取得當前版本號
     */
    async getCurrentVersion() {
        // 優先從共享資料夾取得
        if (this.isConnected()) {
            try {
                const sharedData = await this.readFromSharedFolder();
                if (sharedData?.version) return sharedData.version;
            } catch (e) {
                // 忽略錯誤
            }
        }
        
        // 從 localStorage 取得
        const localData = this.readFromLocalBackup();
        return localData?.version || 0;
    },
    
    // ==================== 衝突檢測 ====================
    
    /**
     * 檢測衝突
     */
    detectConflict(sharedFile, localFile) {
        if (!sharedFile || !localFile) return null; // 沒有衝突，其中一個不存在
        
        if (sharedFile.version === localFile.version) return null; // 版本相同
        
        return {
            hasConflict: true,
            newer: sharedFile.version > localFile.version ? "shared" : "local",
            shared: {
                version: sharedFile.version,
                savedBy: sharedFile.savedBy,
                savedAt: sharedFile.savedAt,
                savedAtSource: sharedFile.savedAtSource
            },
            local: {
                version: localFile.version,
                savedBy: localFile.savedBy,
                savedAt: localFile.savedAt,
                savedAtSource: localFile.savedAtSource
            }
        };
    },
    
    /**
     * 顯示衝突對話框
     */
    showConflictDialog(conflict, onResolve) {
        const formatTime = (isoString) => {
            if (!isoString) return '-';
            const d = new Date(isoString);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        };
        
        const sharedLabel = conflict.newer === 'shared' ? ' (較新)' : '';
        const localLabel = conflict.newer === 'local' ? ' (較新)' : '';
        
        const sourceWarning = (conflict.shared.savedAtSource === 'local' && conflict.local.savedAtSource === 'local')
            ? `<p style="color: var(--warning); font-size: 12px; margin-top: 12px;">
                 注意：兩邊時間戳皆為本機時間，可能不準確。請以版本號為準。
               </p>`
            : '';
        
        const html = `
            <div style="padding: 8px 0;">
                <div style="background: rgba(228, 185, 90, 0.15); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <span style="font-size: 20px;">!</span>
                        <strong style="color: var(--warning);">發現版本衝突</strong>
                    </div>
                    <p style="font-size: 13px; color: var(--text-secondary); margin: 0;">
                        共享資料夾與本機備份的版本不同，請選擇要使用的版本
                    </p>
                </div>
                
                <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
                    <tr style="border-bottom: 1px solid var(--border);">
                        <th style="text-align: left; padding: 8px 4px; width: 80px;"></th>
                        <th style="text-align: left; padding: 8px 4px;">版本</th>
                        <th style="text-align: left; padding: 8px 4px;">儲存者</th>
                        <th style="text-align: left; padding: 8px 4px;">時間</th>
                        <th style="text-align: left; padding: 8px 4px;">來源</th>
                    </tr>
                    <tr style="background: ${conflict.newer === 'shared' ? 'rgba(107, 175, 141, 0.1)' : 'transparent'};">
                        <td style="padding: 8px 4px; font-weight: 600;">共享資料夾${sharedLabel}</td>
                        <td style="padding: 8px 4px;">v${conflict.shared.version}</td>
                        <td style="padding: 8px 4px;">${conflict.shared.savedBy || '-'}</td>
                        <td style="padding: 8px 4px;">${formatTime(conflict.shared.savedAt)}</td>
                        <td style="padding: 8px 4px; font-size: 11px; color: var(--text-hint);">${conflict.shared.savedAtSource || '-'}</td>
                    </tr>
                    <tr style="background: ${conflict.newer === 'local' ? 'rgba(107, 175, 141, 0.1)' : 'transparent'};">
                        <td style="padding: 8px 4px; font-weight: 600;">本機備份${localLabel}</td>
                        <td style="padding: 8px 4px;">v${conflict.local.version}</td>
                        <td style="padding: 8px 4px;">${conflict.local.savedBy || '-'}</td>
                        <td style="padding: 8px 4px;">${formatTime(conflict.local.savedAt)}</td>
                        <td style="padding: 8px 4px; font-size: 11px; color: var(--text-hint);">${conflict.local.savedAtSource || '-'}</td>
                    </tr>
                </table>
                
                ${sourceWarning}
                
                <p style="margin-top: 16px; font-size: 13px; color: var(--text-secondary);">
                    建議使用版本號較大的版本（${conflict.newer === 'shared' ? '共享資料夾' : '本機備份'}）
                </p>
            </div>
        `;
        
        openModal('版本衝突', html, [
            {
                text: '使用本機版本',
                class: conflict.newer === 'local' ? 'btn-primary' : 'btn-outline',
                closeOnClick: false,
                onClick: () => {
                    closeModal();
                    onResolve('local');
                }
            },
            {
                text: '使用共享版本',
                class: conflict.newer === 'shared' ? 'btn-primary' : 'btn-outline',
                closeOnClick: false,
                onClick: () => {
                    closeModal();
                    onResolve('shared');
                }
            }
        ]);
    },
    
    // ==================== 主要操作 ====================
    
    /**
     * 儲存資料（雙寫共享資料夾 + localStorage）
     */
    async save() {
        // 匯出當前所有資料
        const data = await exportAllData();
        
        // 取得當前版本
        const currentVersion = await this.getCurrentVersion();
        
        // 建立 payload
        const payload = await this.createPayload(data, currentVersion);
        
        let sharedOk = false;
        let localOk = false;
        
        // 寫入共享資料夾
        if (this.isConnected()) {
            try {
                await this.writeToSharedFolder(payload);
                sharedOk = true;
            } catch (e) {
                console.error('共享資料夾寫入失敗:', e);
            }
        }
        
        // 寫入 localStorage
        localOk = this.writeToLocalBackup(payload);
        
        // 回饋結果
        if (sharedOk && localOk) {
            showToast(`已儲存至共享資料夾及本機備份 (v${payload.version})`, 'success');
            return { success: true, version: payload.version };
        } else if (sharedOk && !localOk) {
            showToast(`已儲存至共享資料夾（本機備份失敗）(v${payload.version})`, 'warning');
            return { success: true, version: payload.version };
        } else if (!sharedOk && localOk) {
            if (this.isConnected()) {
                showToast(`共享資料夾儲存失敗，已儲存至本機備份 (v${payload.version})`, 'warning');
            } else {
                showToast(`已儲存至本機備份 (v${payload.version})`, 'success');
            }
            return { success: true, version: payload.version };
        } else {
            showToast('儲存失敗，請確認權限', 'error');
            return { success: false };
        }
    },
    
    /**
     * 載入資料（啟動時呼叫）
     */
    async load() {
        let sharedData = null;
        let localData = null;
        
        // 讀取共享資料夾
        if (this.isConnected()) {
            try {
                sharedData = await this.readFromSharedFolder();
            } catch (e) {
                console.warn('讀取共享資料夾失敗:', e);
            }
        }
        
        // 讀取 localStorage
        localData = this.readFromLocalBackup();
        
        // 檢測衝突
        const conflict = this.detectConflict(sharedData, localData);
        
        if (conflict) {
            // 有衝突，顯示對話框讓用戶選擇
            return new Promise((resolve) => {
                this.showConflictDialog(conflict, async (choice) => {
                    const selectedData = choice === 'shared' ? sharedData : localData;
                    
                    if (selectedData?.data) {
                        // 匯入選擇的資料
                        await importAllData(selectedData.data);
                        
                        // 同步兩邊版本
                        if (choice === 'shared' && localData) {
                            this.writeToLocalBackup(sharedData);
                        } else if (choice === 'local' && sharedData && this.isConnected()) {
                            try {
                                await this.writeToSharedFolder(localData);
                            } catch (e) {
                                console.warn('同步到共享資料夾失敗:', e);
                            }
                        }
                        
                        showToast(`已載入${choice === 'shared' ? '共享' : '本機'}版本 (v${selectedData.version})`, 'success');
                        resolve({ loaded: true, version: selectedData.version, source: choice });
                    } else {
                        resolve({ loaded: false });
                    }
                });
            });
        }
        
        // 沒有衝突，使用存在的版本
        const dataToUse = sharedData || localData;
        
        if (dataToUse?.data) {
            await importAllData(dataToUse.data);
            
            // 確保兩邊同步
            if (sharedData && !localData) {
                this.writeToLocalBackup(sharedData);
            } else if (!sharedData && localData && this.isConnected()) {
                try {
                    await this.writeToSharedFolder(localData);
                } catch (e) {
                    console.warn('同步到共享資料夾失敗:', e);
                }
            }
            
            const source = sharedData ? 'shared' : 'local';
            console.log(`已載入資料 (v${dataToUse.version}) from ${source}`);
            return { loaded: true, version: dataToUse.version, source };
        }
        
        return { loaded: false };
    },
    
    /**
     * 連接共享資料夾並同步
     */
    async connectAndSync() {
        const connected = await this.selectDirectory();
        if (!connected) return false;
        
        // 讀取共享資料夾
        const sharedData = await this.readFromSharedFolder();
        const localData = this.readFromLocalBackup();
        
        if (!sharedData && !localData) {
            // 兩邊都沒資料，保存當前 IndexedDB 資料
            await this.save();
            return true;
        }
        
        // 檢測衝突
        const conflict = this.detectConflict(sharedData, localData);
        
        if (conflict) {
            return new Promise((resolve) => {
                this.showConflictDialog(conflict, async (choice) => {
                    const selectedData = choice === 'shared' ? sharedData : localData;
                    
                    if (selectedData?.data) {
                        await importAllData(selectedData.data);
                        
                        // 同步版本
                        const payload = choice === 'shared' ? sharedData : localData;
                        this.writeToLocalBackup(payload);
                        if (choice === 'local') {
                            await this.writeToSharedFolder(payload);
                        }
                        
                        showToast(`已同步${choice === 'shared' ? '共享' : '本機'}版本`, 'success');
                    }
                    resolve(true);
                });
            });
        }
        
        // 沒有衝突
        if (sharedData?.data) {
            await importAllData(sharedData.data);
            this.writeToLocalBackup(sharedData);
            showToast(`已從共享資料夾同步 (v${sharedData.version})`, 'success');
        } else if (localData?.data) {
            // 本機有資料但共享沒有，上傳到共享
            await this.writeToSharedFolder(localData);
            showToast(`已上傳至共享資料夾 (v${localData.version})`, 'success');
        }
        
        return true;
    },
    
    /**
     * 顯示同步狀態
     */
    getStatusText() {
        if (this.isConnected()) {
            return '已連接共享資料夾';
        } else {
            return '未連接共享資料夾（僅本機備份）';
        }
    },
    
    /**
     * 斷開共享資料夾
     */
    async disconnect() {
        this.directoryHandle = null;
        
        // 清除 IndexedDB 中的句柄
        return new Promise((resolve) => {
            const request = indexedDB.open('rto_qcc_handles', 1);
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction('handles', 'readwrite');
                const store = tx.objectStore('handles');
                store.delete(this.HANDLE_KEY);
                tx.oncomplete = () => {
                    showToast('已斷開共享資料夾連接', 'info');
                    resolve(true);
                };
            };
            request.onerror = () => resolve(false);
        });
    }
};
