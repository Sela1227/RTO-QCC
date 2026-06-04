/**
 * 彰濱放腫體重監控預防系統 - 同步模組
 * 實作 Offline-First File Sync with Version Control
 * 
 * 主要功能：
 * 1. 本機 IndexedDB + 共享資料夾雙重儲存
 * 2. 版本號為衝突解決的主要依據
 * 3. 網路時間 API（多備援）
 * 4. 開啟時自動偵測衝突
 */

const Sync = {
    // 共享資料夾句柄（File System Access API）
    directoryHandle: null,
    fileHandle: null,
    
    // 同步檔案名稱
    SYNC_FILENAME: 'RTO-QCC-Data.json',
    
    // IndexedDB 存放目錄句柄的 key
    DIR_HANDLE_KEY: 'shared_folder_handle',
    
    /**
     * 取得網路時間（多備援機制）
     * 依序嘗試：TimeAPI.io → Cloudflare → 本機時間
     */
    async getNetworkTime() {
        const sources = [
            {
                name: "TimeAPI.io",
                fetch: async () => {
                    const r = await fetch("https://timeapi.io/api/time/current/zone?timeZone=Asia/Taipei");
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
                    const r = await fetch("https://cloudflare.com/cdn-cgi/trace");
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
                return await Promise.race([
                    source.fetch(),
                    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 5000))
                ]);
            } catch (e) {
                console.warn(`${source.name} 時間取得失敗:`, e.message);
                continue;
            }
        }

        // 所有來源都失敗，使用本機時間
        return { 
            time: new Date().toISOString(), 
            source: "local" 
        };
    },
    
    /**
     * 取得目前使用者名稱
     */
    async getCurrentUser() {
        const staffList = await Settings.get('staff_list', []);
        const lastUser = await Settings.get('current_user', null);
        return lastUser || (staffList.length > 0 ? staffList[0] : '未知使用者');
    },
    
    /**
     * 設定目前使用者
     */
    async setCurrentUser(name) {
        await Settings.set('current_user', name);
    },
    
    /**
     * 取得本機版本資訊
     */
    async getLocalVersion() {
        return await Settings.get('sync_version', null);
    },
    
    /**
     * 儲存本機版本資訊
     */
    async setLocalVersion(versionInfo) {
        await Settings.set('sync_version', versionInfo);
    },
    
    /**
     * 匯出資料（含版本資訊）
     */
    async exportWithVersion() {
        const localVersion = await this.getLocalVersion();
        const { time, source } = await this.getNetworkTime();
        const userName = await this.getCurrentUser();
        
        const nextVersion = (localVersion?.version ?? 0) + 1;
        
        const data = await exportPatientData();
        
        return {
            version: nextVersion,
            savedAt: time,
            savedAtSource: source,
            savedBy: userName,
            data: data
        };
    },
    
    /**
     * 連接共享資料夾
     */
    async connectSharedFolder() {
        try {
            // 檢查瀏覽器支援
            if (!('showDirectoryPicker' in window)) {
                showToast('此瀏覽器不支援共享資料夾功能，請使用 Chrome 或 Edge', 'error');
                return false;
            }
            
            // 請求資料夾存取權限
            this.directoryHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
            
            // 儲存句柄到 IndexedDB
            await this.saveDirectoryHandle(this.directoryHandle);
            
            showToast('已連接共享資料夾', 'success');
            return true;
            
        } catch (e) {
            if (e.name === 'AbortError') {
                // 使用者取消
                return false;
            }
            console.error('連接共享資料夾失敗:', e);
            showToast('連接失敗: ' + e.message, 'error');
            return false;
        }
    },
    
    /**
     * 儲存目錄句柄到 IndexedDB
     */
    async saveDirectoryHandle(handle) {
        await Settings.set(this.DIR_HANDLE_KEY, handle);
    },
    
    /**
     * 從 IndexedDB 讀取目錄句柄
     */
    async loadDirectoryHandle() {
        try {
            const handle = await Settings.get(this.DIR_HANDLE_KEY, null);
            if (!handle) return null;
            
            // 驗證權限
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission === 'granted') {
                this.directoryHandle = handle;
                return handle;
            }
            
            // 請求權限
            const newPermission = await handle.requestPermission({ mode: 'readwrite' });
            if (newPermission === 'granted') {
                this.directoryHandle = handle;
                return handle;
            }
            
            return null;
        } catch (e) {
            console.warn('讀取目錄句柄失敗:', e);
            return null;
        }
    },
    
    /**
     * 讀取共享資料夾的檔案
     */
    async readSharedFile() {
        try {
            if (!this.directoryHandle) {
                await this.loadDirectoryHandle();
            }
            
            if (!this.directoryHandle) return null;
            
            const fileHandle = await this.directoryHandle.getFileHandle(this.SYNC_FILENAME);
            const file = await fileHandle.getFile();
            const text = await file.text();
            return JSON.parse(text);
            
        } catch (e) {
            if (e.name === 'NotFoundError') {
                // 檔案不存在
                return null;
            }
            console.warn('讀取共享檔案失敗:', e);
            return null;
        }
    },
    
    /**
     * 寫入共享資料夾
     */
    async writeSharedFile(payload) {
        try {
            if (!this.directoryHandle) {
                await this.loadDirectoryHandle();
            }
            
            if (!this.directoryHandle) {
                return { success: false, error: '未連接共享資料夾' };
            }
            
            const fileHandle = await this.directoryHandle.getFileHandle(this.SYNC_FILENAME, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(JSON.stringify(payload, null, 2));
            await writable.close();
            
            return { success: true };
            
        } catch (e) {
            console.error('寫入共享檔案失敗:', e);
            return { success: false, error: e.message };
        }
    },
    
    /**
     * 偵測衝突
     */
    detectConflict(sharedFile, localVersion) {
        if (!sharedFile || !localVersion) return null;
        
        if (sharedFile.version === localVersion.version) return null;
        
        return {
            hasConflict: true,
            newer: sharedFile.version > localVersion.version ? 'shared' : 'local',
            shared: {
                version: sharedFile.version,
                savedBy: sharedFile.savedBy,
                savedAt: sharedFile.savedAt,
                savedAtSource: sharedFile.savedAtSource
            },
            local: {
                version: localVersion.version,
                savedBy: localVersion.savedBy,
                savedAt: localVersion.savedAt,
                savedAtSource: localVersion.savedAtSource
            }
        };
    },
    
    /**
     * 顯示衝突對話框
     */
    showVersionConflictDialog(conflict) {
        return new Promise((resolve) => {
            const formatTime = (isoStr) => {
                if (!isoStr) return '-';
                const d = new Date(isoStr);
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            };
            
            const sharedLabel = conflict.newer === 'shared' ? ' (較新)' : '';
            const localLabel = conflict.newer === 'local' ? ' (較新)' : '';
            
            const timeWarning = (conflict.shared.savedAtSource === 'local' && conflict.local.savedAtSource === 'local')
                ? '<p style="font-size: 12px; color: var(--warning); margin-top: 12px;">兩邊時間來源皆為本機，時間可能不準確，請以版本號為準</p>'
                : '';
            
            const html = `
                <div style="padding: 8px 0;">
                    <div style="background: rgba(228, 185, 90, 0.15); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <div style="font-weight: 600; color: var(--warning); margin-bottom: 8px;">發現版本衝突</div>
                        <p style="font-size: 13px; color: var(--text-secondary);">共享資料夾與本機資料版本不一致，請選擇要使用的版本</p>
                    </div>
                    
                    <div style="display: grid; gap: 12px;">
                        <div style="background: var(--bg); padding: 12px; border-radius: 8px; border: 2px solid ${conflict.newer === 'shared' ? 'var(--primary)' : 'transparent'};">
                            <div style="font-weight: 600; margin-bottom: 4px;">共享資料夾${sharedLabel}</div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                版本 ${conflict.shared.version} · ${conflict.shared.savedBy} · ${formatTime(conflict.shared.savedAt)}
                                <span style="font-size: 11px; color: var(--text-hint);">(${conflict.shared.savedAtSource})</span>
                            </div>
                        </div>
                        
                        <div style="background: var(--bg); padding: 12px; border-radius: 8px; border: 2px solid ${conflict.newer === 'local' ? 'var(--primary)' : 'transparent'};">
                            <div style="font-weight: 600; margin-bottom: 4px;">本機資料${localLabel}</div>
                            <div style="font-size: 13px; color: var(--text-secondary);">
                                版本 ${conflict.local.version} · ${conflict.local.savedBy} · ${formatTime(conflict.local.savedAt)}
                                <span style="font-size: 11px; color: var(--text-hint);">(${conflict.local.savedAtSource})</span>
                            </div>
                        </div>
                    </div>
                    
                    ${timeWarning}
                    
                    <p style="font-size: 12px; color: var(--text-hint); margin-top: 12px;">
                        建議使用版本號較大的資料
                    </p>
                </div>
            `;
            
            openModal('版本衝突', html, [
                {
                    text: '使用本機版本',
                    class: 'btn-outline',
                    onClick: () => resolve('local')
                },
                {
                    text: '使用共享版本',
                    class: 'btn-primary',
                    onClick: () => resolve('shared')
                }
            ]);
        });
    },
    
    /**
     * 儲存資料（同時寫入 IndexedDB 和共享資料夾）
     */
    async save() {
        try {
            // 準備資料
            const payload = await this.exportWithVersion();
            
            // 寫入共享資料夾
            const sharedResult = await this.writeSharedFile(payload);
            
            // 更新本機版本資訊
            await this.setLocalVersion({
                version: payload.version,
                savedAt: payload.savedAt,
                savedAtSource: payload.savedAtSource,
                savedBy: payload.savedBy
            });
            
            // 更新最後備份時間
            await Settings.set('last_backup_date', new Date().toISOString().split('T')[0]);
            
            // 顯示結果
            if (sharedResult.success) {
                showToast('已儲存至共享資料夾及本機', 'success');
                return { shared: true, local: true };
            } else {
                showToast('已儲存至本機（共享資料夾失敗）', 'warning');
                return { shared: false, local: true, error: sharedResult.error };
            }
            
        } catch (e) {
            console.error('儲存失敗:', e);
            showToast('儲存失敗: ' + e.message, 'error');
            return { shared: false, local: false, error: e.message };
        }
    },
    
    /**
     * 啟動時檢查同步
     */
    async checkOnStartup() {
        // 嘗試載入目錄句柄
        const handle = await this.loadDirectoryHandle();
        
        if (!handle) {
            // 沒有連接共享資料夾，顯示連接提示
            const patients = await DB.getAll('patients');
            if (patients.length > 0) {
                this.showConnectPrompt();
            }
            return;
        }
        
        // 讀取共享檔案和本機版本
        const sharedFile = await this.readSharedFile();
        const localVersion = await this.getLocalVersion();
        
        // 偵測衝突
        const conflict = this.detectConflict(sharedFile, localVersion);
        
        if (conflict) {
            // 有衝突，顯示對話框
            const choice = await this.showVersionConflictDialog(conflict);
            
            if (choice === 'shared') {
                // 使用共享版本
                await this.loadFromShared(sharedFile);
            } else {
                // 使用本機版本，同步到共享資料夾
                await this.save();
            }
        } else if (sharedFile && !localVersion) {
            // 本機沒有版本資訊但共享有，詢問是否載入
            this.showLoadSharedPrompt(sharedFile);
        } else if (!sharedFile && localVersion) {
            // 共享沒有但本機有，詢問是否同步
            this.showSyncToSharedPrompt();
        }
    },
    
    /**
     * 從共享資料載入
     */
    async loadFromShared(sharedFile) {
        try {
            showToast('正在載入共享資料...', 'info');
            
            // 匯入資料
            await importPatientData(sharedFile.data);
            
            // 更新本機版本資訊
            await this.setLocalVersion({
                version: sharedFile.version,
                savedAt: sharedFile.savedAt,
                savedAtSource: sharedFile.savedAtSource,
                savedBy: sharedFile.savedBy
            });
            
            showToast('已載入共享資料', 'success');
            App.refresh();
            
        } catch (e) {
            console.error('載入共享資料失敗:', e);
            showToast('載入失敗: ' + e.message, 'error');
        }
    },
    
    /**
     * 顯示連接共享資料夾提示
     */
    showConnectPrompt() {
        const html = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 48px; margin-bottom: 16px;">📁</div>
                <p style="margin-bottom: 16px;">建議連接共享資料夾，啟用自動同步功能</p>
                <p style="font-size: 13px; color: var(--text-secondary);">
                    連接後，每次儲存會自動同步到共享資料夾，<br>
                    多台電腦可共用最新資料
                </p>
            </div>
        `;
        
        openModal('連接共享資料夾', html, [
            { text: '稍後再說', class: 'btn-outline' },
            { 
                text: '選擇資料夾', 
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    closeModal();
                    await this.connectSharedFolder();
                }
            }
        ]);
    },
    
    /**
     * 顯示載入共享資料提示
     */
    showLoadSharedPrompt(sharedFile) {
        const formatTime = (isoStr) => {
            if (!isoStr) return '-';
            const d = new Date(isoStr);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        };
        
        const html = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 48px; margin-bottom: 16px;">📥</div>
                <p style="margin-bottom: 12px;">發現共享資料夾有資料</p>
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-size: 13px;">
                        版本 ${sharedFile.version} · ${sharedFile.savedBy}<br>
                        ${formatTime(sharedFile.savedAt)}
                    </div>
                </div>
                <p style="font-size: 13px; color: var(--text-secondary);">
                    是否載入共享資料？
                </p>
            </div>
        `;
        
        openModal('載入共享資料', html, [
            { text: '使用本機資料', class: 'btn-outline' },
            { 
                text: '載入共享資料', 
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    closeModal();
                    await this.loadFromShared(sharedFile);
                }
            }
        ]);
    },
    
    /**
     * 顯示同步到共享資料夾提示
     */
    showSyncToSharedPrompt() {
        const html = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 48px; margin-bottom: 16px;">📤</div>
                <p style="margin-bottom: 16px;">共享資料夾尚無資料</p>
                <p style="font-size: 13px; color: var(--text-secondary);">
                    是否將本機資料同步到共享資料夾？
                </p>
            </div>
        `;
        
        openModal('同步到共享資料夾', html, [
            { text: '稍後再說', class: 'btn-outline' },
            { 
                text: '立即同步', 
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    closeModal();
                    await this.save();
                }
            }
        ]);
    },
    
    /**
     * 顯示同步狀態
     */
    async showSyncStatus() {
        const localVersion = await this.getLocalVersion();
        const sharedFile = await this.readSharedFile();
        const hasHandle = !!this.directoryHandle;
        
        const formatTime = (isoStr) => {
            if (!isoStr) return '-';
            const d = new Date(isoStr);
            return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        };
        
        const html = `
            <div style="padding: 8px 0;">
                <div class="form-group">
                    <label class="form-label">共享資料夾</label>
                    <div style="padding: 8px 12px; background: var(--bg); border-radius: 6px;">
                        ${hasHandle ? '<span style="color: var(--success);">已連接</span>' : '<span style="color: var(--text-hint);">未連接</span>'}
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">本機版本</label>
                    <div style="padding: 8px 12px; background: var(--bg); border-radius: 6px; font-size: 13px;">
                        ${localVersion ? `
                            版本 ${localVersion.version}<br>
                            ${localVersion.savedBy} · ${formatTime(localVersion.savedAt)}<br>
                            <span style="color: var(--text-hint);">時間來源: ${localVersion.savedAtSource}</span>
                        ` : '無版本資訊'}
                    </div>
                </div>
                
                <div class="form-group">
                    <label class="form-label">共享版本</label>
                    <div style="padding: 8px 12px; background: var(--bg); border-radius: 6px; font-size: 13px;">
                        ${sharedFile ? `
                            版本 ${sharedFile.version}<br>
                            ${sharedFile.savedBy} · ${formatTime(sharedFile.savedAt)}<br>
                            <span style="color: var(--text-hint);">時間來源: ${sharedFile.savedAtSource}</span>
                        ` : (hasHandle ? '檔案不存在' : '未連接')}
                    </div>
                </div>
            </div>
        `;
        
        const buttons = [
            { text: '關閉', class: 'btn-outline' }
        ];
        
        if (!hasHandle) {
            buttons.push({
                text: '連接共享資料夾',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    closeModal();
                    await this.connectSharedFolder();
                }
            });
        } else {
            buttons.push({
                text: '立即同步',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    closeModal();
                    await this.save();
                }
            });
        }
        
        openModal('同步狀態', html, buttons);
    },
    
    /**
     * 手動選擇使用者
     */
    async selectUser() {
        const staffList = await Settings.get('staff_list', []);
        const currentUser = await this.getCurrentUser();
        
        if (staffList.length === 0) {
            showToast('請先在系統設定中新增人員', 'warning');
            return;
        }
        
        const html = `
            <div style="padding: 8px 0;">
                <div class="form-group">
                    <label class="form-label">選擇目前使用者</label>
                    <select class="form-select" id="sync-user-select">
                        ${staffList.map(s => `<option value="${s}" ${s === currentUser ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                </div>
                <p style="font-size: 12px; color: var(--text-hint);">
                    此名稱會顯示在同步記錄中
                </p>
            </div>
        `;
        
        openModal('設定使用者', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '確定',
                class: 'btn-primary',
                onClick: async () => {
                    const select = document.getElementById('sync-user-select');
                    await this.setCurrentUser(select.value);
                    showToast(`已設定使用者: ${select.value}`);
                }
            }
        ]);
    },
    
    /**
     * 備份到檔案（舊版相容）
     */
    async backupToFile() {
        const payload = await this.exportWithVersion();
        const filename = `RTO-QCC-Backup-${new Date().toISOString().split('T')[0]}.json`;
        
        const result = await downloadJSON(payload, filename);
        
        if (result) {
            await this.setLocalVersion({
                version: payload.version,
                savedAt: payload.savedAt,
                savedAtSource: payload.savedAtSource,
                savedBy: payload.savedBy
            });
            await Settings.set('last_backup_date', new Date().toISOString().split('T')[0]);
            showToast('備份完成', 'success');
        }
    },
    
    /**
     * 從檔案還原（舊版相容）
     */
    async restoreFromFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const fileData = await readJSONFile(file);
                
                // 檢查是否為新版格式（有 version 欄位）
                if (fileData.version && fileData.data) {
                    // 新版格式
                    await importPatientData(fileData.data);
                    await this.setLocalVersion({
                        version: fileData.version,
                        savedAt: fileData.savedAt,
                        savedAtSource: fileData.savedAtSource,
                        savedBy: fileData.savedBy
                    });
                } else {
                    // 舊版格式
                    await importPatientData(fileData);
                }
                
                showToast('還原完成', 'success');
                App.refresh();
                
            } catch (e) {
                showToast('還原失敗: ' + e.message, 'error');
            }
        };
        
        input.click();
    }
};
