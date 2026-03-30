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
        const patientAppUrl = await Settings.get('patient_app_url', '');
        const syncOnStartup = await Settings.get('sync_on_startup', true);
        const syncOnClose = await Settings.get('sync_on_close', true);
        const lastSyncTime = await Settings.get('last_sync_time', null);
        const satisfactionEnabled = await Settings.get('satisfaction_enabled', false);
        
        const html = `
            <div class="settings-tabs-container">
                <div class="settings-tabs-group">
                    <div class="settings-tabs-label">基本設定</div>
                    <div class="settings-tabs-row">
                        <button class="settings-tab active" data-settings-tab="cancer">
                            <span class="settings-tab-icon">+</span>
                            <span class="settings-tab-text">癌別</span>
                        </button>
                        <button class="settings-tab" data-settings-tab="staff">
                            <span class="settings-tab-icon">*</span>
                            <span class="settings-tab-text">人員</span>
                        </button>
                        <button class="settings-tab" data-settings-tab="alert">
                            <span class="settings-tab-icon">!</span>
                            <span class="settings-tab-text">警示</span>
                        </button>
                        <button class="settings-tab" data-settings-tab="pause">
                            <span class="settings-tab-icon">⏸️</span>
                            <span class="settings-tab-text">暫停</span>
                        </button>
                    </div>
                </div>
                <div class="settings-tabs-group">
                    <div class="settings-tabs-label">資料管理</div>
                    <div class="settings-tabs-row">
                        <button class="settings-tab" data-settings-tab="sync">
                            <span class="settings-tab-icon">~</span>
                            <span class="settings-tab-text">同步</span>
                        </button>
                        <button class="settings-tab" data-settings-tab="backup">
                            <span class="settings-tab-icon">@</span>
                            <span class="settings-tab-text">備份</span>
                        </button>
                        <button class="settings-tab" data-settings-tab="patient">
                            <span class="settings-tab-icon">#</span>
                            <span class="settings-tab-text">病人端</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="settings-content" style="min-height: 280px;">
                <!-- 癌別設定 -->
                <div class="settings-panel active" id="settings-cancer">
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">癌別管理</span>
                        <span class="settings-panel-desc">設定系統中可選的癌症類型</span>
                    </div>
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
                        + 新增癌別
                    </button>
                </div>
                
                <!-- 人員設定 -->
                <div class="settings-panel" id="settings-staff" style="display: none;">
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">人員管理</span>
                        <span class="settings-panel-desc">設定可選擇的執行人員名單</span>
                    </div>
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
                        + 新增人員
                    </button>
                </div>
                
                <!-- 警示設定 -->
                <div class="settings-panel" id="settings-alert" style="display: none;">
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">警示規則</span>
                        <span class="settings-panel-desc">體重下降達閾值時自動觸發介入提醒</span>
                    </div>
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
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">暫停原因</span>
                        <span class="settings-panel-desc">暫停療程時可快速選擇的原因</span>
                    </div>
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
                        + 新增原因
                    </button>
                </div>
                
                <!-- 病人端設定 -->
                <div class="settings-panel" id="settings-patient" style="display: none;">
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">病人端網址</span>
                        <span class="settings-panel-desc">部署病人端網頁後填入網址，QR Code 會包含此網址</span>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <div>
                            <input type="text" class="form-input" id="patient-app-url" 
                                   value="${patientAppUrl}"
                                   placeholder="例如：https://example.com/patient.html">
                        </div>
                        <button class="btn btn-primary" onclick="SettingsUI.savePatientAppUrl()">
                            儲存設定
                        </button>
                        <div class="settings-info-box">
                            <div class="settings-info-title">部署說明</div>
                            <ol class="settings-info-list">
                                <li>將 <code>patient.html</code> 上傳到網頁伺服器</li>
                                <li>複製網頁網址填入上方欄位</li>
                                <li>病人掃描 QR Code 後即可開啟填報頁面</li>
                            </ol>
                        </div>
                    </div>
                    
                    <div class="settings-panel-header" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border);">
                        <span class="settings-panel-title">滿意度調查</span>
                        <span class="settings-panel-desc">療程結束時詢問病人對服務的滿意度</span>
                    </div>
                    <div class="settings-toggle-row">
                        <label class="toggle-switch">
                            <input type="checkbox" id="satisfaction-enabled" ${satisfactionEnabled ? 'checked' : ''} 
                                   onchange="SettingsUI.saveSatisfactionEnabled()">
                            <span class="toggle-slider"></span>
                        </label>
                        <span>啟用滿意度調查（病人端顯示問卷入口）</span>
                    </div>
                </div>
                
                <!-- 完整備份 -->
                <div class="settings-panel" id="settings-backup" style="display: none;">
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">完整備份與還原</span>
                        <span class="settings-panel-desc">包含所有資料：病人、療程、體重、副作用、介入、設定</span>
                    </div>
                    <div class="settings-btn-group">
                        <button class="btn btn-primary" onclick="SettingsUI.exportData()">
                            <span class="btn-icon">[備]</span> 匯出完整備份
                        </button>
                        <button class="btn btn-outline" onclick="document.getElementById('import-file').click()">
                            <span class="btn-icon">📂</span> 匯入還原
                        </button>
                        <input type="file" id="import-file" accept=".json" style="display: none;" 
                               onchange="SettingsUI.importData(this.files[0])">
                    </div>
                    <div class="settings-warning">
                        匯入還原會清除現有資料，以備份檔案完全取代
                    </div>
                    
                    <div class="settings-divider"></div>
                    
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">同步資料</span>
                        <span class="settings-panel-desc">從備份檔匯入，只新增本地沒有的資料</span>
                    </div>
                    <div class="settings-btn-group">
                        <button class="btn btn-outline" onclick="document.getElementById('sync-file').click()">
                            <span class="btn-icon">[入]</span> 同步資料（只新增不覆蓋）
                        </button>
                        <input type="file" id="sync-file" accept=".json" style="display: none;" 
                               onchange="SettingsUI.syncData(this.files[0])">
                    </div>
                    
                    <div class="settings-divider"></div>
                    
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">重置資料</span>
                        <span class="settings-panel-desc">清除或重置系統資料</span>
                    </div>
                    <div class="settings-btn-group">
                        <button class="btn btn-danger" onclick="SettingsUI.clearAllData()">
                            <span class="btn-icon">[清]</span> 清除所有資料
                        </button>
                        <button class="btn btn-outline" onclick="SettingsUI.resetToDemo()">
                            還原測試資料
                        </button>
                    </div>
                </div>
                
                <!-- 同步設定 -->
                <div class="settings-panel" id="settings-sync" style="display: none;">
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">多機同步</span>
                        <span class="settings-panel-desc">在多台電腦間同步病人資料（不含系統設定）</span>
                    </div>
                    
                    <div class="settings-info-box" style="margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                            <span style="font-size: 20px;">📁</span>
                            <span style="font-weight: 500;">建議檔名：SELA_RTO_病人資料.json</span>
                        </div>
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            存放於 RTO 網芳共用資料夾，所有電腦使用同一檔案
                        </div>
                    </div>
                    
                    <div class="settings-btn-group">
                        <button class="btn btn-primary" onclick="closeModal(); Sync.selectAndSync()">
                            <span class="btn-icon">[入]</span> 從網芳同步
                        </button>
                        <button class="btn btn-outline" onclick="closeModal(); Sync.backupToFile()">
                            <span class="btn-icon">[備]</span> 備份到網芳
                        </button>
                    </div>
                    
                    ${lastSyncTime ? `
                        <p style="font-size: 12px; color: var(--text-hint); margin-top: 8px;">
                            上次同步：${new Date(lastSyncTime).toLocaleString('zh-TW')}
                        </p>
                    ` : ''}
                    
                    <div class="settings-divider"></div>
                    
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">提示設定</span>
                        <span class="settings-panel-desc">控制自動提示行為</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                            <input type="checkbox" id="sync-on-startup" ${syncOnStartup ? 'checked' : ''} 
                                   onchange="SettingsUI.saveSyncSettings()">
                            <span>啟動時提示同步</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                            <input type="checkbox" id="sync-on-close" ${syncOnClose ? 'checked' : ''} 
                                   onchange="SettingsUI.saveSyncSettings()">
                            <span>顯示備份快捷鍵提示 (Ctrl+S)</span>
                        </label>
                    </div>
                    
                    <div class="settings-divider"></div>
                    
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">使用說明</span>
                    </div>
                    <div class="settings-info-box">
                        <ol class="settings-info-list">
                            <li><strong>上班</strong>：開啟系統 → 從網芳同步最新資料</li>
                            <li><strong>工作中</strong>：正常使用，資料存在本機</li>
                            <li><strong>下班</strong>：按 Ctrl+S 或點「備份到網芳」</li>
                        </ol>
                    </div>
                    
                    <div class="settings-info-box" style="margin-top: 12px; background: var(--warning-bg, #fff8e6);">
                        <div style="font-size: 13px;">
                            <strong>衝突處理</strong>：若同一筆資料內容不同，系統會提示您選擇保留哪一個版本
                        </div>
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
        
        // 顯示備份摘要
        const summaryHtml = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 18px; margin-bottom: 12px; color: var(--primary);">[備份]</div>
                <h3 style="margin-bottom: 16px;">備份摘要</h3>
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; text-align: left;">
                    <div class="detail-row">
                        <span>病人數</span>
                        <strong>${data.patients?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>療程數</span>
                        <strong>${data.treatments?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>體重記錄</span>
                        <strong>${data.weight_records?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>副作用評估</span>
                        <strong>${data.side_effects?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>介入記錄</span>
                        <strong>${data.interventions?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>滿意度調查</span>
                        <strong>${data.satisfaction?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>設定項目</span>
                        <strong>${data.settings?.length || 0}</strong>
                    </div>
                </div>
                <p style="margin-top: 16px; font-size: 13px; color: var(--text-secondary);">
                    備份檔案將自動下載
                </p>
            </div>
        `;
        
        openModal('完整備份', summaryHtml, [
            { text: '確定', class: 'btn-primary' }
        ]);
        
        const filename = `SELA_完整備份_${today()}.json`;
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
            
            const confirmMsg = `即將匯入備份，這將覆蓋所有現有資料。

備份資訊：
• 備份時間：${data.exported_at ? new Date(data.exported_at).toLocaleString('zh-TW') : '未知'}
• 資料庫版本：${data.version || '未知'}

資料內容：
• 病人數：${data.patients?.length || 0}
• 療程數：${data.treatments?.length || 0}
• 體重記錄：${data.weight_records?.length || 0}
• 副作用評估：${data.side_effects?.length || 0}
• 介入記錄：${data.interventions?.length || 0}
• 設定項目：${data.settings?.length || 0}

確定要還原嗎？`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            await importAllData(data);
            showToast('資料已完整還原');
            closeModal();
            App.refresh();
        } catch (e) {
            showToast('匯入失敗: ' + e.message, 'error');
        }
    },
    
    /**
     * 匯出病人資料（不含設定）
     */
    async exportPatientData() {
        const data = await exportPatientData();
        
        // 顯示摘要
        const summaryHtml = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 36px; margin-bottom: 12px;">👥</div>
                <h3 style="margin-bottom: 16px;">病人資料摘要</h3>
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; text-align: left;">
                    <div class="detail-row">
                        <span>病人數</span>
                        <strong>${data.patients?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>療程數</span>
                        <strong>${data.treatments?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>體重記錄</span>
                        <strong>${data.weight_records?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>副作用評估</span>
                        <strong>${data.side_effects?.length || 0}</strong>
                    </div>
                    <div class="detail-row">
                        <span>介入記錄</span>
                        <strong>${data.interventions?.length || 0}</strong>
                    </div>
                </div>
                <p style="margin-top: 16px; font-size: 13px; color: var(--text-secondary);">
                    不含系統設定（癌別、人員、警示規則等）
                </p>
            </div>
        `;
        
        openModal('病人資料匯出', summaryHtml, [
            { text: '確定', class: 'btn-primary' }
        ]);
        
        const filename = `SELA_病人資料_${today()}.json`;
        downloadJSON(data, filename);
        
        showToast('病人資料已下載');
    },
    
    /**
     * 匯入病人資料（覆蓋）
     */
    async importPatientData(file) {
        if (!file) return;
        
        try {
            const data = await readJSONFile(file);
            
            const confirmMsg = `即將匯入病人資料，這將覆蓋現有的病人資料（不影響系統設定）。

資料內容：
• 病人數：${data.patients?.length || 0}
• 療程數：${data.treatments?.length || 0}
• 體重記錄：${data.weight_records?.length || 0}
• 副作用評估：${data.side_effects?.length || 0}
• 介入記錄：${data.interventions?.length || 0}

確定要匯入嗎？`;
            
            if (!confirm(confirmMsg)) {
                return;
            }
            
            await importPatientData(data);
            showToast('病人資料已還原');
            closeModal();
            App.refresh();
        } catch (e) {
            showToast('匯入失敗: ' + e.message, 'error');
        }
        
        // 清除 input
        document.getElementById('import-patient-file').value = '';
    },
    
    /**
     * 同步病人資料（只新增不覆蓋）
     */
    async syncPatientData(file) {
        if (!file) return;
        
        try {
            const importData = await readJSONFile(file);
            
            // 取得本地資料
            const localPatients = await DB.getAll('patients');
            const localTreatments = await DB.getAll('treatments');
            const localWeights = await DB.getAll('weight_records');
            const localSideEffects = await DB.getAll('side_effects');
            const localInterventions = await DB.getAll('interventions');
            
            // 建立本地索引
            const localPatientIndex = new Set(localPatients.map(p => p.medical_id));
            
            const localTreatmentIndex = new Map();
            for (const t of localTreatments) {
                const patient = localPatients.find(p => p.id === t.patient_id);
                if (patient) {
                    const key = `${patient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
                    localTreatmentIndex.set(key, t);
                }
            }
            
            const localWeightIndex = new Set();
            for (const w of localWeights) {
                const treatment = localTreatments.find(t => t.id === w.treatment_id);
                if (treatment) {
                    const patient = localPatients.find(p => p.id === treatment.patient_id);
                    if (patient) {
                        localWeightIndex.add(`${patient.medical_id}_${treatment.treatment_start}_${w.measure_date}`);
                    }
                }
            }
            
            const localSideEffectIndex = new Set();
            for (const se of localSideEffects) {
                const treatment = localTreatments.find(t => t.id === se.treatment_id);
                if (treatment) {
                    const patient = localPatients.find(p => p.id === treatment.patient_id);
                    if (patient) {
                        localSideEffectIndex.add(`${patient.medical_id}_${treatment.treatment_start}_${se.assess_date}`);
                    }
                }
            }
            
            const localInterventionIndex = new Set();
            for (const i of localInterventions) {
                const treatment = localTreatments.find(t => t.id === i.treatment_id);
                if (treatment) {
                    const patient = localPatients.find(p => p.id === treatment.patient_id);
                    if (patient) {
                        const createdDate = i.created_at ? i.created_at.split('T')[0] : '';
                        localInterventionIndex.add(`${patient.medical_id}_${treatment.treatment_start}_${i.type}_${createdDate}`);
                    }
                }
            }
            
            // 統計
            const stats = { patient: { added: 0, skipped: 0 }, treatment: { added: 0, skipped: 0 }, 
                          weight: { added: 0, skipped: 0 }, sideEffect: { added: 0, skipped: 0 },
                          intervention: { added: 0, skipped: 0 } };
            
            const importPatients = importData.patients || [];
            const importTreatments = importData.treatments || [];
            const importWeights = importData.weight_records || [];
            const importSideEffects = importData.side_effects || [];
            const importInterventions = importData.interventions || [];
            
            const patientIdMap = new Map();
            const treatmentIdMap = new Map();
            
            // 同步病人
            for (const p of importPatients) {
                if (localPatientIndex.has(p.medical_id)) {
                    const localPatient = localPatients.find(lp => lp.medical_id === p.medical_id);
                    patientIdMap.set(p.id, localPatient.id);
                    stats.patient.skipped++;
                } else {
                    const newPatient = { ...p };
                    delete newPatient.id;
                    const newId = await DB.add('patients', newPatient);
                    patientIdMap.set(p.id, newId);
                    localPatientIndex.add(p.medical_id);
                    stats.patient.added++;
                }
            }
            
            // 同步療程
            for (const t of importTreatments) {
                const importPatient = importPatients.find(p => p.id === t.patient_id);
                if (!importPatient) continue;
                const key = `${importPatient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
                if (localTreatmentIndex.has(key)) {
                    treatmentIdMap.set(t.id, localTreatmentIndex.get(key).id);
                    stats.treatment.skipped++;
                } else {
                    const newTreatment = { ...t };
                    delete newTreatment.id;
                    newTreatment.patient_id = patientIdMap.get(t.patient_id);
                    const newId = await DB.add('treatments', newTreatment);
                    treatmentIdMap.set(t.id, newId);
                    stats.treatment.added++;
                }
            }
            
            // 同步體重
            for (const w of importWeights) {
                const importTreatment = importTreatments.find(t => t.id === w.treatment_id);
                if (!importTreatment) continue;
                const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
                if (!importPatient) continue;
                const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${w.measure_date}`;
                if (localWeightIndex.has(key)) {
                    stats.weight.skipped++;
                } else {
                    const newWeight = { ...w };
                    delete newWeight.id;
                    newWeight.treatment_id = treatmentIdMap.get(w.treatment_id);
                    if (newWeight.treatment_id) {
                        await DB.add('weight_records', newWeight);
                        stats.weight.added++;
                    }
                }
            }
            
            // 同步副作用
            for (const se of importSideEffects) {
                const importTreatment = importTreatments.find(t => t.id === se.treatment_id);
                if (!importTreatment) continue;
                const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
                if (!importPatient) continue;
                const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${se.assess_date}`;
                if (localSideEffectIndex.has(key)) {
                    stats.sideEffect.skipped++;
                } else {
                    const newSideEffect = { ...se };
                    delete newSideEffect.id;
                    newSideEffect.treatment_id = treatmentIdMap.get(se.treatment_id);
                    if (newSideEffect.treatment_id) {
                        await DB.add('side_effects', newSideEffect);
                        stats.sideEffect.added++;
                    }
                }
            }
            
            // 同步介入
            for (const i of importInterventions) {
                const importTreatment = importTreatments.find(t => t.id === i.treatment_id);
                if (!importTreatment) continue;
                const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
                if (!importPatient) continue;
                const createdDate = i.created_at ? i.created_at.split('T')[0] : '';
                const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${i.type}_${createdDate}`;
                if (localInterventionIndex.has(key)) {
                    stats.intervention.skipped++;
                } else {
                    const newIntervention = { ...i };
                    delete newIntervention.id;
                    newIntervention.treatment_id = treatmentIdMap.get(i.treatment_id);
                    if (newIntervention.treatment_id) {
                        await DB.add('interventions', newIntervention);
                        stats.intervention.added++;
                    }
                }
            }
            
            // 顯示結果
            const resultHtml = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 18px; margin-bottom: 12px; color: var(--success);">[完成]</div>
                    <h3 style="margin-bottom: 16px;">同步完成</h3>
                    <div style="background: var(--bg); padding: 16px; border-radius: 8px; text-align: left;">
                        <div class="detail-row"><span>病人</span><span>新增 <strong>${stats.patient.added}</strong> / 跳過 ${stats.patient.skipped}</span></div>
                        <div class="detail-row"><span>療程</span><span>新增 <strong>${stats.treatment.added}</strong> / 跳過 ${stats.treatment.skipped}</span></div>
                        <div class="detail-row"><span>體重</span><span>新增 <strong>${stats.weight.added}</strong> / 跳過 ${stats.weight.skipped}</span></div>
                        <div class="detail-row"><span>副作用</span><span>新增 <strong>${stats.sideEffect.added}</strong> / 跳過 ${stats.sideEffect.skipped}</span></div>
                        <div class="detail-row"><span>介入</span><span>新增 <strong>${stats.intervention.added}</strong> / 跳過 ${stats.intervention.skipped}</span></div>
                    </div>
                </div>
            `;
            
            closeModal();
            openModal('同步結果', resultHtml, [{ text: '確定', class: 'btn-primary' }]);
            App.refresh();
            
        } catch (e) {
            console.error('同步失敗:', e);
            showToast('同步失敗: ' + e.message, 'error');
        }
        
        document.getElementById('sync-patient-file').value = '';
    },
    
    /**
     * 同步資料（只新增不覆蓋）
     */
    async syncData(file) {
        if (!file) return;
        
        try {
            const importData = await readJSONFile(file);
            
            // 取得本地資料
            const localPatients = await DB.getAll('patients');
            const localTreatments = await DB.getAll('treatments');
            const localWeights = await DB.getAll('weight_records');
            const localSideEffects = await DB.getAll('side_effects');
            const localInterventions = await DB.getAll('interventions');
            
            // 建立本地索引（用業務鍵）
            const localPatientIndex = new Set(localPatients.map(p => p.medical_id));
            
            // 療程索引：病歷號 + 開始日期 + 癌別
            const localTreatmentIndex = new Map();
            for (const t of localTreatments) {
                const patient = localPatients.find(p => p.id === t.patient_id);
                if (patient) {
                    const key = `${patient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
                    localTreatmentIndex.set(key, t);
                }
            }
            
            // 體重索引：病歷號 + 療程開始日期 + 測量日期
            const localWeightIndex = new Set();
            for (const w of localWeights) {
                const treatment = localTreatments.find(t => t.id === w.treatment_id);
                if (treatment) {
                    const patient = localPatients.find(p => p.id === treatment.patient_id);
                    if (patient) {
                        const key = `${patient.medical_id}_${treatment.treatment_start}_${w.measure_date}`;
                        localWeightIndex.add(key);
                    }
                }
            }
            
            // 副作用索引：病歷號 + 療程開始日期 + 評估日期
            const localSideEffectIndex = new Set();
            for (const se of localSideEffects) {
                const treatment = localTreatments.find(t => t.id === se.treatment_id);
                if (treatment) {
                    const patient = localPatients.find(p => p.id === treatment.patient_id);
                    if (patient) {
                        const key = `${patient.medical_id}_${treatment.treatment_start}_${se.assess_date}`;
                        localSideEffectIndex.add(key);
                    }
                }
            }
            
            // 介入索引：病歷號 + 療程開始日期 + 類型 + 建立日期
            const localInterventionIndex = new Set();
            for (const i of localInterventions) {
                const treatment = localTreatments.find(t => t.id === i.treatment_id);
                if (treatment) {
                    const patient = localPatients.find(p => p.id === treatment.patient_id);
                    if (patient) {
                        const createdDate = i.created_at ? i.created_at.split('T')[0] : '';
                        const key = `${patient.medical_id}_${treatment.treatment_start}_${i.type}_${createdDate}`;
                        localInterventionIndex.add(key);
                    }
                }
            }
            
            // 統計
            const stats = {
                patient: { added: 0, skipped: 0 },
                treatment: { added: 0, skipped: 0 },
                weight: { added: 0, skipped: 0 },
                sideEffect: { added: 0, skipped: 0 },
                intervention: { added: 0, skipped: 0 }
            };
            
            // 匯入資料的病人索引（用於對應 ID）
            const importPatients = importData.patients || [];
            const importTreatments = importData.treatments || [];
            const importWeights = importData.weight_records || [];
            const importSideEffects = importData.side_effects || [];
            const importInterventions = importData.interventions || [];
            
            // ID 對應表（匯入ID → 本地ID）
            const patientIdMap = new Map();
            const treatmentIdMap = new Map();
            
            // 1. 同步病人
            for (const p of importPatients) {
                if (localPatientIndex.has(p.medical_id)) {
                    // 已存在，記錄 ID 對應
                    const localPatient = localPatients.find(lp => lp.medical_id === p.medical_id);
                    patientIdMap.set(p.id, localPatient.id);
                    stats.patient.skipped++;
                } else {
                    // 新增
                    const newPatient = { ...p };
                    delete newPatient.id;
                    const newId = await DB.add('patients', newPatient);
                    patientIdMap.set(p.id, newId);
                    localPatientIndex.add(p.medical_id);
                    stats.patient.added++;
                }
            }
            
            // 2. 同步療程
            for (const t of importTreatments) {
                const importPatient = importPatients.find(p => p.id === t.patient_id);
                if (!importPatient) continue;
                
                const key = `${importPatient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
                
                if (localTreatmentIndex.has(key)) {
                    // 已存在
                    const localTreatment = localTreatmentIndex.get(key);
                    treatmentIdMap.set(t.id, localTreatment.id);
                    stats.treatment.skipped++;
                } else {
                    // 新增
                    const newTreatment = { ...t };
                    delete newTreatment.id;
                    newTreatment.patient_id = patientIdMap.get(t.patient_id);
                    const newId = await DB.add('treatments', newTreatment);
                    treatmentIdMap.set(t.id, newId);
                    localTreatmentIndex.set(key, { id: newId, ...newTreatment });
                    stats.treatment.added++;
                }
            }
            
            // 3. 同步體重記錄
            for (const w of importWeights) {
                const importTreatment = importTreatments.find(t => t.id === w.treatment_id);
                if (!importTreatment) continue;
                
                const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
                if (!importPatient) continue;
                
                const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${w.measure_date}`;
                
                if (localWeightIndex.has(key)) {
                    stats.weight.skipped++;
                } else {
                    const newWeight = { ...w };
                    delete newWeight.id;
                    newWeight.treatment_id = treatmentIdMap.get(w.treatment_id);
                    if (newWeight.treatment_id) {
                        await DB.add('weight_records', newWeight);
                        localWeightIndex.add(key);
                        stats.weight.added++;
                    }
                }
            }
            
            // 4. 同步副作用評估
            for (const se of importSideEffects) {
                const importTreatment = importTreatments.find(t => t.id === se.treatment_id);
                if (!importTreatment) continue;
                
                const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
                if (!importPatient) continue;
                
                const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${se.assess_date}`;
                
                if (localSideEffectIndex.has(key)) {
                    stats.sideEffect.skipped++;
                } else {
                    const newSideEffect = { ...se };
                    delete newSideEffect.id;
                    newSideEffect.treatment_id = treatmentIdMap.get(se.treatment_id);
                    if (newSideEffect.treatment_id) {
                        await DB.add('side_effects', newSideEffect);
                        localSideEffectIndex.add(key);
                        stats.sideEffect.added++;
                    }
                }
            }
            
            // 5. 同步介入記錄
            for (const i of importInterventions) {
                const importTreatment = importTreatments.find(t => t.id === i.treatment_id);
                if (!importTreatment) continue;
                
                const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
                if (!importPatient) continue;
                
                const createdDate = i.created_at ? i.created_at.split('T')[0] : '';
                const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${i.type}_${createdDate}`;
                
                if (localInterventionIndex.has(key)) {
                    stats.intervention.skipped++;
                } else {
                    const newIntervention = { ...i };
                    delete newIntervention.id;
                    newIntervention.treatment_id = treatmentIdMap.get(i.treatment_id);
                    if (newIntervention.treatment_id) {
                        await DB.add('interventions', newIntervention);
                        localInterventionIndex.add(key);
                        stats.intervention.added++;
                    }
                }
            }
            
            // 顯示結果
            const resultHtml = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 18px; margin-bottom: 12px; color: var(--success);">[完成]</div>
                    <h3 style="margin-bottom: 16px;">同步完成</h3>
                    <div style="background: var(--bg); padding: 16px; border-radius: 8px; text-align: left;">
                        <div class="detail-row">
                            <span>病人</span>
                            <span>新增 <strong>${stats.patient.added}</strong> / 跳過 ${stats.patient.skipped}</span>
                        </div>
                        <div class="detail-row">
                            <span>療程</span>
                            <span>新增 <strong>${stats.treatment.added}</strong> / 跳過 ${stats.treatment.skipped}</span>
                        </div>
                        <div class="detail-row">
                            <span>體重</span>
                            <span>新增 <strong>${stats.weight.added}</strong> / 跳過 ${stats.weight.skipped}</span>
                        </div>
                        <div class="detail-row">
                            <span>副作用</span>
                            <span>新增 <strong>${stats.sideEffect.added}</strong> / 跳過 ${stats.sideEffect.skipped}</span>
                        </div>
                        <div class="detail-row">
                            <span>介入</span>
                            <span>新增 <strong>${stats.intervention.added}</strong> / 跳過 ${stats.intervention.skipped}</span>
                        </div>
                    </div>
                </div>
            `;
            
            closeModal();
            openModal('同步結果', resultHtml, [
                { text: '確定', class: 'btn-primary' }
            ]);
            
            App.refresh();
            
        } catch (e) {
            console.error('同步失敗:', e);
            showToast('同步失敗: ' + e.message, 'error');
        }
        
        // 清除 input
        document.getElementById('sync-file').value = '';
    },
    
    /**
     * 儲存病人端網址設定
     */
    async savePatientAppUrl() {
        const url = document.getElementById('patient-app-url').value.trim();
        await Settings.set('patient_app_url', url);
        showToast('病人端網址已儲存');
    },
    
    /**
     * 儲存滿意度調查設定
     */
    async saveSatisfactionEnabled() {
        const enabled = document.getElementById('satisfaction-enabled')?.checked ?? false;
        await Settings.set('satisfaction_enabled', enabled);
        showToast(enabled ? '滿意度調查已啟用' : '滿意度調查已停用');
    },
    
    /**
     * 儲存同步設定
     */
    async saveSyncSettings() {
        const syncOnStartup = document.getElementById('sync-on-startup')?.checked ?? true;
        const syncOnClose = document.getElementById('sync-on-close')?.checked ?? true;
        
        await Settings.set('sync_on_startup', syncOnStartup);
        await Settings.set('sync_on_close', syncOnClose);
        
        showToast('同步設定已儲存');
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
    
    /**
     * 還原測試資料
     */
    async resetToDemo() {
        if (!confirm('這將清除所有現有資料，並載入測試用的範例病人。確定繼續？')) return;
        
        // 清除所有資料
        await DB.clear('patients');
        await DB.clear('treatments');
        await DB.clear('weight_records');
        await DB.clear('interventions');
        
        const today = new Date();
        const dayMs = 24 * 60 * 60 * 1000;
        
        // 測試病人資料（15人）
        const demoPatients = [
            { medical_id: '1234567', name: '王大明', gender: 'M', birth_date: '1965-03-15', phone: '0912-345-678' },
            { medical_id: '2345678', name: '李小華', gender: 'F', birth_date: '1972-08-22', phone: '0923-456-789' },
            { medical_id: '3456789', name: '張美玲', gender: 'F', birth_date: '1958-11-08', phone: '0934-567-890' },
            { medical_id: '4567890', name: '陳志明', gender: 'M', birth_date: '1955-05-20', phone: '0945-678-901' },
            { medical_id: '5678901', name: '林淑芬', gender: 'F', birth_date: '1968-12-03', phone: '0956-789-012' },
            { medical_id: '6789012', name: '黃建國', gender: 'M', birth_date: '1960-07-18', phone: '0967-890-123' },
            { medical_id: '7890123', name: '吳美惠', gender: 'F', birth_date: '1975-09-25', phone: '0978-901-234' },
            { medical_id: '8901234', name: '周文杰', gender: 'M', birth_date: '1962-04-12', phone: '0989-012-345' },
            { medical_id: '9012345', name: '鄭雅琳', gender: 'F', birth_date: '1970-01-30', phone: '0910-123-456' },
            { medical_id: '0123456', name: '許志豪', gender: 'M', birth_date: '1958-06-14', phone: '0921-234-567' },
            { medical_id: '1122334', name: '楊淑娟', gender: 'F', birth_date: '1966-10-08', phone: '0932-345-678' },
            { medical_id: '2233445', name: '蔡明宏', gender: 'M', birth_date: '1963-02-28', phone: '0943-456-789' },
            { medical_id: '3344556', name: '劉佳玲', gender: 'F', birth_date: '1978-11-15', phone: '0954-567-890' },
            { medical_id: '4455667', name: '洪建華', gender: 'M', birth_date: '1952-08-05', phone: '0965-678-901' },
            { medical_id: '5566778', name: '謝雅婷', gender: 'F', birth_date: '1973-04-22', phone: '0976-789-012' }
        ];
        
        // 新增病人
        const patientIds = [];
        for (const p of demoPatients) {
            const result = await DB.add('patients', {
                ...p,
                created_at: new Date().toISOString()
            });
            patientIds.push(result.id);  // 取 id 而不是整個對象
        }
        
        // 療程資料（不同狀態、不同癌別）
        const demoTreatments = [
            // 治療中 - 有各種狀態
            { patientIdx: 0, cancer_type: 'head_neck', daysAgo: 35, baseline: 68.5, status: 'active' },   // 王大明 - 頭頸癌，體重下降
            { patientIdx: 1, cancer_type: 'breast', daysAgo: 20, baseline: 55.2, status: 'active' },      // 李小華 - 乳癌，穩定
            { patientIdx: 2, cancer_type: 'lung', daysAgo: 50, baseline: 52.0, status: 'active' },        // 張美玲 - 肺癌，待輸體重
            { patientIdx: 3, cancer_type: 'esophagus', daysAgo: 40, baseline: 62.0, status: 'active' },   // 陳志明 - 食道癌，嚴重下降
            { patientIdx: 4, cancer_type: 'colorectal', daysAgo: 28, baseline: 58.5, status: 'active' },  // 林淑芬 - 大腸癌，微降
            { patientIdx: 6, cancer_type: 'breast', daysAgo: 25, baseline: 60.0, status: 'active' },      // 吳美惠 - 乳癌，體重上升
            { patientIdx: 7, cancer_type: 'lung', daysAgo: 45, baseline: 70.0, status: 'active' },        // 周文杰 - 肺癌，已介入
            { patientIdx: 8, cancer_type: 'esophagus', daysAgo: 18, baseline: 48.5, status: 'active' },   // 鄭雅琳 - 食道癌，穩定
            { patientIdx: 9, cancer_type: 'colorectal', daysAgo: 30, baseline: 75.0, status: 'active' },  // 許志豪 - 大腸癌，待輸體重
            { patientIdx: 10, cancer_type: 'head_neck', daysAgo: 22, baseline: 50.0, status: 'active' },  // 楊淑娟 - 頭頸癌，中度下降
            { patientIdx: 12, cancer_type: 'lung', daysAgo: 5, baseline: 56.0, status: 'active' },        // 劉佳玲 - 肺癌，剛開始
            { patientIdx: 13, cancer_type: 'esophagus', daysAgo: 60, baseline: 65.0, status: 'active' },  // 洪建華 - 食道癌，極嚴重
            { patientIdx: 14, cancer_type: 'colorectal', daysAgo: 15, baseline: 53.0, status: 'active' }, // 謝雅婷 - 大腸癌，穩定
            // 暫停中
            { patientIdx: 5, cancer_type: 'head_neck', daysAgo: 40, baseline: 72.0, status: 'paused', pause_reason: 'side_effect' },  // 黃建國
            { patientIdx: 11, cancer_type: 'breast', daysAgo: 35, baseline: 67.0, status: 'paused', pause_reason: 'personal' }        // 蔡明宏
        ];
        
        const treatmentIds = [];
        for (const t of demoTreatments) {
            const startDate = new Date(today - t.daysAgo * dayMs);
            const data = {
                patient_id: patientIds[t.patientIdx],
                cancer_type: t.cancer_type,
                treatment_start: formatDate(startDate),
                baseline_weight: t.baseline,
                status: t.status,
                created_at: new Date().toISOString()
            };
            if (t.pause_reason) {
                data.pause_reason = t.pause_reason;
                data.paused_at = new Date().toISOString();
            }
            const result = await DB.add('treatments', data);
            treatmentIds.push(result.id);  // 取 id 而不是整個對象
        }
        
        // 體重記錄（各種變化趨勢）
        const weightRecords = [
            // 王大明 - 下降趨勢 (-4.8%)
            { tIdx: 0, daysAgo: 33, weight: 68.5 },
            { tIdx: 0, daysAgo: 26, weight: 67.8 },
            { tIdx: 0, daysAgo: 19, weight: 66.5 },
            { tIdx: 0, daysAgo: 12, weight: 65.8 },
            { tIdx: 0, daysAgo: 5, weight: 65.2 },
            
            // 李小華 - 穩定
            { tIdx: 1, daysAgo: 18, weight: 55.2 },
            { tIdx: 1, daysAgo: 11, weight: 55.0 },
            { tIdx: 1, daysAgo: 4, weight: 55.1 },
            
            // 張美玲 - 待輸體重（最後量測超過10天）
            { tIdx: 2, daysAgo: 45, weight: 52.0 },
            { tIdx: 2, daysAgo: 35, weight: 51.5 },
            { tIdx: 2, daysAgo: 25, weight: 51.0 },
            { tIdx: 2, daysAgo: 15, weight: 50.5 },
            
            // 陳志明 - 嚴重下降 (-8%)
            { tIdx: 3, daysAgo: 38, weight: 62.0 },
            { tIdx: 3, daysAgo: 31, weight: 60.5 },
            { tIdx: 3, daysAgo: 24, weight: 59.0 },
            { tIdx: 3, daysAgo: 17, weight: 58.0 },
            { tIdx: 3, daysAgo: 10, weight: 57.5 },
            { tIdx: 3, daysAgo: 3, weight: 57.0 },
            
            // 林淑芬 - 微降 (-2.5%)
            { tIdx: 4, daysAgo: 26, weight: 58.5 },
            { tIdx: 4, daysAgo: 19, weight: 58.0 },
            { tIdx: 4, daysAgo: 12, weight: 57.5 },
            { tIdx: 4, daysAgo: 5, weight: 57.0 },
            
            // 吳美惠 - 上升 (+2%)
            { tIdx: 5, daysAgo: 23, weight: 60.0 },
            { tIdx: 5, daysAgo: 16, weight: 60.5 },
            { tIdx: 5, daysAgo: 9, weight: 61.0 },
            { tIdx: 5, daysAgo: 2, weight: 61.2 },
            
            // 周文杰 - 下降後穩定 (-5.7%)
            { tIdx: 6, daysAgo: 43, weight: 70.0 },
            { tIdx: 6, daysAgo: 36, weight: 68.5 },
            { tIdx: 6, daysAgo: 29, weight: 67.0 },
            { tIdx: 6, daysAgo: 22, weight: 66.0 },
            { tIdx: 6, daysAgo: 15, weight: 66.0 },
            { tIdx: 6, daysAgo: 8, weight: 66.0 },
            
            // 鄭雅琳 - 穩定
            { tIdx: 7, daysAgo: 16, weight: 48.5 },
            { tIdx: 7, daysAgo: 9, weight: 48.3 },
            { tIdx: 7, daysAgo: 2, weight: 48.4 },
            
            // 許志豪 - 待輸體重
            { tIdx: 8, daysAgo: 28, weight: 75.0 },
            { tIdx: 8, daysAgo: 18, weight: 74.5 },
            
            // 楊淑娟 - 中度下降 (-4%)
            { tIdx: 9, daysAgo: 20, weight: 50.0 },
            { tIdx: 9, daysAgo: 13, weight: 49.0 },
            { tIdx: 9, daysAgo: 6, weight: 48.0 },
            
            // 劉佳玲 - 剛開始
            { tIdx: 10, daysAgo: 3, weight: 56.0 },
            
            // 洪建華 - 極嚴重下降 (-12%)
            { tIdx: 11, daysAgo: 55, weight: 65.0 },
            { tIdx: 11, daysAgo: 45, weight: 63.0 },
            { tIdx: 11, daysAgo: 35, weight: 61.0 },
            { tIdx: 11, daysAgo: 25, weight: 59.0 },
            { tIdx: 11, daysAgo: 15, weight: 57.5 },
            { tIdx: 11, daysAgo: 5, weight: 57.0 },
            
            // 謝雅婷 - 穩定
            { tIdx: 12, daysAgo: 13, weight: 53.0 },
            { tIdx: 12, daysAgo: 6, weight: 52.8 },
            
            // 黃建國（暫停）
            { tIdx: 13, daysAgo: 38, weight: 72.0 },
            { tIdx: 13, daysAgo: 28, weight: 71.0 },
            
            // 蔡明宏（暫停）
            { tIdx: 14, daysAgo: 33, weight: 67.0 },
            { tIdx: 14, daysAgo: 23, weight: 66.5 }
        ];
        
        for (const w of weightRecords) {
            await DB.add('weight_records', {
                treatment_id: treatmentIds[w.tIdx],
                measure_date: formatDate(new Date(today - w.daysAgo * dayMs)),
                weight: w.weight,
                created_at: new Date().toISOString()
            });
        }
        
        // 介入記錄（各種狀態）
        const interventions = [
            // 王大明 - 待處理 SDM
            { tIdx: 0, type: 'sdm', trigger_rate: -4.8, status: 'pending', daysAgo: 5 },
            
            // 陳志明 - 待處理營養師
            { tIdx: 3, type: 'nutrition', trigger_rate: -8.1, status: 'pending', daysAgo: 3 },
            
            // 林淑芬 - 已執行 SDM
            { tIdx: 4, type: 'sdm', trigger_rate: -3.5, status: 'executed', daysAgo: 10, executor: '護理師A' },
            
            // 周文杰 - 已執行營養師
            { tIdx: 6, type: 'nutrition', trigger_rate: -5.7, status: 'executed', daysAgo: 20, executor: '護理師B' },
            { tIdx: 6, type: 'sdm', trigger_rate: -4.3, status: 'executed', daysAgo: 25, executor: '護理師B' },
            
            // 楊淑娟 - 待處理 SDM
            { tIdx: 9, type: 'sdm', trigger_rate: -4.0, status: 'pending', daysAgo: 6 },
            
            // 洪建華 - 多次介入
            { tIdx: 11, type: 'sdm', trigger_rate: -3.1, status: 'executed', daysAgo: 40, executor: '護理師A' },
            { tIdx: 11, type: 'nutrition', trigger_rate: -6.2, status: 'executed', daysAgo: 30, executor: '護理師A' },
            { tIdx: 11, type: 'ng_tube', trigger_rate: -9.2, status: 'executed', daysAgo: 20, executor: '醫師' },
            { tIdx: 11, type: 'nutrition', trigger_rate: -12.3, status: 'pending', daysAgo: 5 }
        ];
        
        for (const i of interventions) {
            const data = {
                treatment_id: treatmentIds[i.tIdx],
                type: i.type,
                trigger_rate: i.trigger_rate,
                status: i.status,
                created_at: new Date(today - i.daysAgo * dayMs).toISOString()
            };
            if (i.status === 'executed') {
                data.executor = i.executor;
                data.executed_at = new Date(today - (i.daysAgo - 1) * dayMs).toISOString();
                data.execute_date = formatDate(new Date(today - (i.daysAgo - 1) * dayMs));
            }
            await DB.add('interventions', data);
        }
        
        showToast('測試資料已載入（15 位病人）');
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
