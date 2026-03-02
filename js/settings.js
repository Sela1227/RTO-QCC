/**
 * 彰濱放腫體重監控預防系統 - 設定模組
 */

const SettingsUI = {
    /**
     * 顯示設定對話框
     */
    async show() {
        const cancerTypes = await Settings.get('cancer_types', []);
        const staffList = await Settings.get('staff_list', []);
        const alertRules = await Settings.get('alert_rules', []);
        const pauseReasons = await Settings.get('pause_reasons', []);
        
        const html = `
            <div class="settings-tabs" style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
                <button class="tab active" data-settings-tab="cancer">癌別</button>
                <button class="tab" data-settings-tab="staff">人員</button>
                <button class="tab" data-settings-tab="alert">警示</button>
                <button class="tab" data-settings-tab="pause">暫停原因</button>
                <button class="tab" data-settings-tab="data">資料</button>
            </div>
            
            <div class="settings-content" style="min-height: 280px;">
                <!-- 癌別設定 -->
                <div class="settings-panel active" id="settings-cancer">
                    <div class="settings-list" id="cancer-list">
                        ${cancerTypes.map((c, i) => `
                            <div class="settings-item" data-index="${i}">
                                <span class="settings-item-text">${c.label}</span>
                                <span class="settings-item-actions">
                                    <button class="btn-mini" onclick="SettingsUI.moveCancerType(${i}, -1)" title="上移">▲</button>
                                    <button class="btn-mini" onclick="SettingsUI.moveCancerType(${i}, 1)" title="下移">▼</button>
                                    <button class="btn-mini" onclick="SettingsUI.editCancerType(${i})" title="編輯">✎</button>
                                    <button class="btn-mini btn-mini-danger" onclick="SettingsUI.deleteCancerType(${i})" title="刪除">✕</button>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-outline btn-sm" style="margin-top: 12px;" onclick="SettingsUI.addCancerType()">
                        + 新增
                    </button>
                </div>
                
                <!-- 人員設定 -->
                <div class="settings-panel" id="settings-staff" style="display: none;">
                    <div class="settings-list" id="staff-list">
                        ${staffList.map((s, i) => `
                            <div class="settings-item" data-index="${i}">
                                <span class="settings-item-text">${s}</span>
                                <span class="settings-item-actions">
                                    <button class="btn-mini" onclick="SettingsUI.moveStaff(${i}, -1)" title="上移">▲</button>
                                    <button class="btn-mini" onclick="SettingsUI.moveStaff(${i}, 1)" title="下移">▼</button>
                                    <button class="btn-mini" onclick="SettingsUI.editStaff(${i})" title="編輯">✎</button>
                                    <button class="btn-mini btn-mini-danger" onclick="SettingsUI.deleteStaff(${i})" title="刪除">✕</button>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-outline btn-sm" style="margin-top: 12px;" onclick="SettingsUI.addStaff()">
                        + 新增
                    </button>
                </div>
                
                <!-- 警示設定 -->
                <div class="settings-panel" id="settings-alert" style="display: none;">
                    <p style="color: var(--text-secondary); font-size: 12px; margin-bottom: 12px;">
                        體重下降達閾值時自動觸發介入提醒
                    </p>
                    <div class="settings-list" id="alert-list">
                        ${alertRules.map((r, i) => {
                            const label = r.cancer_type === 'default' ? '預設規則' : 
                                (cancerTypes.find(c => c.code === r.cancer_type)?.label || r.cancer_type);
                            return `
                            <div class="settings-item" data-index="${i}">
                                <span class="settings-item-text">
                                    <strong>${label}</strong>
                                    <span style="color: var(--text-hint); font-size: 11px; margin-left: 8px;">
                                        SDM ${r.sdm_threshold}% · 營養 ${r.nutrition_threshold}%
                                    </span>
                                </span>
                                <span class="settings-item-actions">
                                    <button class="btn-mini" onclick="SettingsUI.moveAlertRule(${i}, -1)" title="上移">▲</button>
                                    <button class="btn-mini" onclick="SettingsUI.moveAlertRule(${i}, 1)" title="下移">▼</button>
                                    <button class="btn-mini" onclick="SettingsUI.editAlertRule(${i})" title="編輯">✎</button>
                                    ${r.cancer_type !== 'default' ? 
                                        `<button class="btn-mini btn-mini-danger" onclick="SettingsUI.deleteAlertRule(${i})" title="刪除">✕</button>` 
                                        : '<span style="width:20px;"></span>'}
                                </span>
                            </div>
                        `}).join('')}
                    </div>
                    <button class="btn btn-outline btn-sm" style="margin-top: 12px;" onclick="SettingsUI.addAlertRule()">
                        + 新增癌別規則
                    </button>
                </div>
                
                <!-- 暫停原因設定 -->
                <div class="settings-panel" id="settings-pause" style="display: none;">
                    <p style="color: var(--text-secondary); font-size: 12px; margin-bottom: 12px;">
                        暫停療程時可快速選擇的原因
                    </p>
                    <div class="settings-list" id="pause-list">
                        ${pauseReasons.map((r, i) => `
                            <div class="settings-item" data-index="${i}">
                                <span class="settings-item-text">${r.label}</span>
                                <span class="settings-item-actions">
                                    <button class="btn-mini" onclick="SettingsUI.movePauseReason(${i}, -1)" title="上移">▲</button>
                                    <button class="btn-mini" onclick="SettingsUI.movePauseReason(${i}, 1)" title="下移">▼</button>
                                    <button class="btn-mini" onclick="SettingsUI.editPauseReason(${i})" title="編輯">✎</button>
                                    <button class="btn-mini btn-mini-danger" onclick="SettingsUI.deletePauseReason(${i})" title="刪除">✕</button>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-outline btn-sm" style="margin-top: 12px;" onclick="SettingsUI.addPauseReason()">
                        + 新增
                    </button>
                </div>
                
                <!-- 資料管理 -->
                <div class="settings-panel" id="settings-data" style="display: none;">
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="btn btn-outline" onclick="SettingsUI.exportData()">
                            匯出備份 (JSON)
                        </button>
                        <button class="btn btn-outline" onclick="document.getElementById('import-file').click()">
                            匯入還原 (JSON)
                        </button>
                        <input type="file" id="import-file" accept=".json" style="display: none;" 
                               onchange="SettingsUI.importData(this.files[0])">
                        <hr style="border: none; border-top: 1px solid var(--border); margin: 8px 0;">
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
    
    async moveCancerType(index, direction) {
        const cancerTypes = await Settings.get('cancer_types', []);
        const newIndex = index + direction;
        
        if (newIndex < 0 || newIndex >= cancerTypes.length) return;
        
        [cancerTypes[index], cancerTypes[newIndex]] = [cancerTypes[newIndex], cancerTypes[index]];
        await Settings.set('cancer_types', cancerTypes);
        
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
    
    // === 警示規則管理 ===
    
    async addAlertRule() {
        const cancerTypes = await Settings.get('cancer_types', []);
        const alertRules = await Settings.get('alert_rules', []);
        
        const existingCodes = alertRules.map(r => r.cancer_type);
        const availableCancerTypes = cancerTypes.filter(c => !existingCodes.includes(c.code));
        
        if (availableCancerTypes.length === 0) {
            showToast('所有癌別都已設定規則', 'error');
            return;
        }
        
        closeModal();
        setTimeout(() => this.showAlertRuleForm(null, availableCancerTypes), 100);
    },
    
    async editAlertRule(index) {
        const alertRules = await Settings.get('alert_rules', []);
        const rule = alertRules[index];
        
        closeModal();
        setTimeout(() => this.showAlertRuleForm(rule, null, index), 100);
    },
    
    async deleteAlertRule(index) {
        if (!confirm('確定刪除此警示規則？')) return;
        
        const alertRules = await Settings.get('alert_rules', []);
        alertRules.splice(index, 1);
        await Settings.set('alert_rules', alertRules);
        
        showToast('警示規則已刪除');
        this.show();
    },
    
    async moveAlertRule(index, direction) {
        const alertRules = await Settings.get('alert_rules', []);
        const newIndex = index + direction;
        
        if (newIndex < 0 || newIndex >= alertRules.length) return;
        
        [alertRules[index], alertRules[newIndex]] = [alertRules[newIndex], alertRules[index]];
        await Settings.set('alert_rules', alertRules);
        
        this.show();
    },
    
    async showAlertRuleForm(rule = null, availableCancerTypes = null, editIndex = null) {
        const isEdit = rule !== null;
        const cancerTypes = await Settings.get('cancer_types', []);
        
        let cancerSelectHtml = '';
        if (isEdit) {
            const label = rule.cancer_type === 'default' ? '預設' : 
                         (cancerTypes.find(c => c.code === rule.cancer_type)?.label || rule.cancer_type);
            cancerSelectHtml = `<input type="text" class="form-input" value="${label}" readonly>
                                <input type="hidden" id="alert_cancer_type" value="${rule.cancer_type}">`;
        } else {
            cancerSelectHtml = `<select class="form-select" id="alert_cancer_type">
                ${availableCancerTypes.map(c => `<option value="${c.code}">${c.label}</option>`).join('')}
            </select>`;
        }
        
        const html = `
            <form id="alert-rule-form">
                ${createFormGroup('癌別', cancerSelectHtml)}
                <div class="form-row">
                    ${createFormGroup('SDM 閾值 (%)', `
                        <input type="number" step="0.1" class="form-input" id="sdm_threshold" 
                               value="${rule?.sdm_threshold || -3}" placeholder="-3">
                    `, true)}
                    ${createFormGroup('營養師閾值 (%)', `
                        <input type="number" step="0.1" class="form-input" id="nutrition_threshold" 
                               value="${rule?.nutrition_threshold || -5}" placeholder="-5">
                    `, true)}
                </div>
                <p style="color: var(--text-hint); font-size: 12px; margin-top: 8px;">
                    體重下降達 SDM 閾值觸發 SDM；達營養師閾值觸發營養轉介
                </p>
            </form>
        `;
        
        openModal(isEdit ? '編輯警示規則' : '新增警示規則', html, [
            { 
                text: '取消', 
                class: 'btn-outline',
                onClick: () => this.show()
            },
            {
                text: isEdit ? '儲存' : '新增',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const cancerType = document.getElementById('alert_cancer_type').value;
                    const sdmThreshold = parseFloat(document.getElementById('sdm_threshold').value);
                    const nutritionThreshold = parseFloat(document.getElementById('nutrition_threshold').value);
                    
                    if (isNaN(sdmThreshold) || isNaN(nutritionThreshold)) {
                        showToast('請輸入有效的數值', 'error');
                        return;
                    }
                    
                    if (sdmThreshold >= 0 || nutritionThreshold >= 0) {
                        showToast('閾值應為負數', 'error');
                        return;
                    }
                    
                    if (nutritionThreshold > sdmThreshold) {
                        showToast('營養師閾值應小於或等於 SDM 閾值', 'error');
                        return;
                    }
                    
                    const alertRules = await Settings.get('alert_rules', []);
                    
                    const newRule = {
                        cancer_type: cancerType,
                        sdm_threshold: sdmThreshold,
                        nutrition_threshold: nutritionThreshold
                    };
                    
                    if (isEdit) {
                        alertRules[editIndex] = newRule;
                    } else {
                        alertRules.push(newRule);
                    }
                    
                    await Settings.set('alert_rules', alertRules);
                    showToast(isEdit ? '警示規則已更新' : '警示規則已新增');
                    closeModal();
                    this.show();
                }
            }
        ]);
    },
    
    // === 資料管理 ===
    
    async exportData() {
        const data = await exportAllData();
        const filename = `weight_backup_${today()}.json`;
        downloadJSON(data, filename);
        
        // 記錄備份時間
        await Settings.set('last_backup_date', today());
        await Settings.set('last_backup_time', new Date().toISOString());
        
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
    },
    
    // === 暫停原因管理 ===
    
    async addPauseReason() {
        const name = prompt('請輸入暫停原因：');
        if (!name) return;
        
        const pauseReasons = await Settings.get('pause_reasons', []);
        const code = 'custom_' + Date.now();
        pauseReasons.push({ code, label: name });
        await Settings.set('pause_reasons', pauseReasons);
        
        showToast('暫停原因已新增');
        this.show();
        // 切換到暫停原因頁籤
        setTimeout(() => {
            document.querySelector('[data-settings-tab="pause"]')?.click();
        }, 100);
    },
    
    async editPauseReason(index) {
        const pauseReasons = await Settings.get('pause_reasons', []);
        const current = pauseReasons[index];
        
        const name = prompt('請輸入新名稱：', current.label);
        if (!name) return;
        
        pauseReasons[index].label = name;
        await Settings.set('pause_reasons', pauseReasons);
        
        showToast('暫停原因已更新');
        this.show();
        setTimeout(() => {
            document.querySelector('[data-settings-tab="pause"]')?.click();
        }, 100);
    },
    
    async deletePauseReason(index) {
        if (!confirm('確定刪除此暫停原因？')) return;
        
        const pauseReasons = await Settings.get('pause_reasons', []);
        pauseReasons.splice(index, 1);
        await Settings.set('pause_reasons', pauseReasons);
        
        showToast('暫停原因已刪除');
        this.show();
        setTimeout(() => {
            document.querySelector('[data-settings-tab="pause"]')?.click();
        }, 100);
    },
    
    async movePauseReason(index, direction) {
        const pauseReasons = await Settings.get('pause_reasons', []);
        const newIndex = index + direction;
        
        if (newIndex < 0 || newIndex >= pauseReasons.length) return;
        
        [pauseReasons[index], pauseReasons[newIndex]] = [pauseReasons[newIndex], pauseReasons[index]];
        await Settings.set('pause_reasons', pauseReasons);
        
        this.show();
        setTimeout(() => {
            document.querySelector('[data-settings-tab="pause"]')?.click();
        }, 100);
    }
};
