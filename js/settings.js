/**
 * SELA 體重追蹤系統 - 設定模組
 */

const SettingsUI = {
    /**
     * 顯示設定對話框
     */
    async show() {
        const cancerTypes = await Settings.get('cancer_types', []);
        const staffList = await Settings.get('staff_list', []);
        const alertRules = await Settings.get('alert_rules', []);
        
        const html = `
            <div class="settings-tabs" style="display: flex; gap: 8px; margin-bottom: 16px;">
                <button class="tab active" data-settings-tab="cancer">癌別</button>
                <button class="tab" data-settings-tab="staff">人員</button>
                <button class="tab" data-settings-tab="alert">警示</button>
                <button class="tab" data-settings-tab="data">資料</button>
            </div>
            
            <div class="settings-content">
                <!-- 癌別設定 -->
                <div class="settings-panel active" id="settings-cancer">
                    <div id="cancer-list">
                        ${cancerTypes.map((c, i) => `
                            <div class="detail-row">
                                <span>${c.label}</span>
                                <span>
                                    <button class="btn-icon" onclick="SettingsUI.editCancerType(${i})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </button>
                                    <button class="btn-icon" onclick="SettingsUI.deleteCancerType(${i})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-outline" style="margin-top: 12px;" onclick="SettingsUI.addCancerType()">
                        + 新增癌別
                    </button>
                </div>
                
                <!-- 人員設定 -->
                <div class="settings-panel" id="settings-staff" style="display: none;">
                    <div id="staff-list">
                        ${staffList.map((s, i) => `
                            <div class="detail-row">
                                <span>${s}</span>
                                <span>
                                    <button class="btn-icon" onclick="SettingsUI.moveStaff(${i}, -1)">↑</button>
                                    <button class="btn-icon" onclick="SettingsUI.moveStaff(${i}, 1)">↓</button>
                                    <button class="btn-icon" onclick="SettingsUI.editStaff(${i})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                    </button>
                                    <button class="btn-icon" onclick="SettingsUI.deleteStaff(${i})">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polyline points="3 6 5 6 21 6"></polyline>
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                    </button>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-outline" style="margin-top: 12px;" onclick="SettingsUI.addStaff()">
                        + 新增人員
                    </button>
                </div>
                
                <!-- 警示設定 -->
                <div class="settings-panel" id="settings-alert" style="display: none;">
                    <p style="color: var(--text-secondary); margin-bottom: 12px;">
                        設定體重下降達到多少百分比時觸發警示
                    </p>
                    <div class="detail-row">
                        <span>SDM 閾值</span>
                        <span>-3%</span>
                    </div>
                    <div class="detail-row">
                        <span>營養師轉介閾值</span>
                        <span>-5%</span>
                    </div>
                </div>
                
                <!-- 資料管理 -->
                <div class="settings-panel" id="settings-data" style="display: none;">
                    <div class="action-group" style="flex-direction: column; gap: 12px;">
                        <button class="btn btn-outline" onclick="SettingsUI.exportData()">
                            匯出備份 (JSON)
                        </button>
                        <button class="btn btn-outline" onclick="document.getElementById('import-file').click()">
                            匯入還原 (JSON)
                        </button>
                        <input type="file" id="import-file" accept=".json" style="display: none;" 
                               onchange="SettingsUI.importData(this.files[0])">
                        <hr style="border: none; border-top: 1px solid var(--border);">
                        <button class="btn btn-danger" onclick="SettingsUI.clearAllData()">
                            清除所有資料
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        openModal('設定', html, [
            { text: '關閉', class: 'btn-outline' }
        ]);
        
        // 頁籤切換
        document.querySelectorAll('[data-settings-tab]').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('[data-settings-tab]').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.settings-panel').forEach(p => p.style.display = 'none');
                tab.classList.add('active');
                document.getElementById('settings-' + tab.dataset.settingsTab).style.display = 'block';
            };
        });
    },
    
    // === 癌別管理 ===
    
    async addCancerType() {
        const name = prompt('請輸入癌別名稱：');
        if (!name) return;
        
        const cancerTypes = await Settings.get('cancer_types', []);
        const code = 'custom_' + Date.now();
        cancerTypes.push({ code, label: name });
        await Settings.set('cancer_types', cancerTypes);
        
        showToast('癌別已新增');
        this.show();
    },
    
    async editCancerType(index) {
        const cancerTypes = await Settings.get('cancer_types', []);
        const name = prompt('請輸入癌別名稱：', cancerTypes[index].label);
        if (!name) return;
        
        cancerTypes[index].label = name;
        await Settings.set('cancer_types', cancerTypes);
        
        showToast('癌別已更新');
        this.show();
    },
    
    async deleteCancerType(index) {
        if (!confirm('確定刪除此癌別？')) return;
        
        const cancerTypes = await Settings.get('cancer_types', []);
        cancerTypes.splice(index, 1);
        await Settings.set('cancer_types', cancerTypes);
        
        showToast('癌別已刪除');
        this.show();
    },
    
    // === 人員管理 ===
    
    async addStaff() {
        const name = prompt('請輸入人員姓名：');
        if (!name) return;
        
        const staffList = await Settings.get('staff_list', []);
        if (staffList.includes(name)) {
            showToast('人員已存在', 'error');
            return;
        }
        
        staffList.push(name);
        await Settings.set('staff_list', staffList);
        
        showToast('人員已新增');
        this.show();
    },
    
    async editStaff(index) {
        const staffList = await Settings.get('staff_list', []);
        const name = prompt('請輸入人員姓名：', staffList[index]);
        if (!name) return;
        
        staffList[index] = name;
        await Settings.set('staff_list', staffList);
        
        showToast('人員已更新');
        this.show();
    },
    
    async deleteStaff(index) {
        if (!confirm('確定刪除此人員？')) return;
        
        const staffList = await Settings.get('staff_list', []);
        staffList.splice(index, 1);
        await Settings.set('staff_list', staffList);
        
        showToast('人員已刪除');
        this.show();
    },
    
    async moveStaff(index, direction) {
        const staffList = await Settings.get('staff_list', []);
        const newIndex = index + direction;
        
        if (newIndex < 0 || newIndex >= staffList.length) return;
        
        [staffList[index], staffList[newIndex]] = [staffList[newIndex], staffList[index]];
        await Settings.set('staff_list', staffList);
        
        this.show();
    },
    
    // === 資料管理 ===
    
    async exportData() {
        const data = await exportAllData();
        const filename = `sela_backup_${today()}.json`;
        downloadJSON(data, filename);
        showToast('備份已下載');
    },
    
    async importData(file) {
        if (!file) return;
        
        try {
            const data = await readJSONFile(file);
            
            if (!confirm(`即將匯入備份，這將覆蓋所有現有資料。\n\n病人數: ${data.patients?.length || 0}\n療程數: ${data.treatments?.length || 0}\n\n確定繼續？`)) {
                return;
            }
            
            await importAllData(data);
            showToast('資料已還原');
            closeModal();
            App.refresh();
        } catch (e) {
            showToast('匯入失敗: ' + e.message, 'error');
        }
    },
    
    async clearAllData() {
        if (!confirm('確定要清除所有資料？此操作無法復原！')) return;
        if (!confirm('再次確認：這將刪除所有病人、療程、體重記錄。確定嗎？')) return;
        
        await DB.clear('patients');
        await DB.clear('treatments');
        await DB.clear('weight_records');
        await DB.clear('interventions');
        
        showToast('所有資料已清除');
        closeModal();
        App.refresh();
    }
};
