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
        const terminateReasons = await Settings.get('terminate_reasons', []);
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
                        <button class="settings-tab" data-settings-tab="terminate">
                            <span class="settings-tab-icon">⏹️</span>
                            <span class="settings-tab-text">終止</span>
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
                
                <!-- 終止原因設定 -->
                <div class="settings-panel" id="settings-terminate" style="display: none;">
                    <div class="settings-panel-header">
                        <span class="settings-panel-title">終止原因</span>
                        <span class="settings-panel-desc">提早終止療程時可快速選擇的原因</span>
                    </div>
                    <div class="settings-list" id="terminate-list">
                        ${terminateReasons.map((r, i) => `
                            <div class="settings-item" data-index="${i}">
                                <span class="settings-item-text">${r.label}</span>
                                <span class="settings-item-actions">
                                    <button class="btn-mini" onclick="SettingsUI.moveTerminateReason(${i}, -1)" title="上移">▲</button>
                                    <button class="btn-mini" onclick="SettingsUI.moveTerminateReason(${i}, 1)" title="下移">▼</button>
                                    <button class="btn-mini" onclick="SettingsUI.editTerminateReason(${i})" title="編輯">✎</button>
                                    <button class="btn-mini btn-mini-danger" onclick="SettingsUI.deleteTerminateReason(${i})" title="刪除">✕</button>
                                </span>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-outline btn-sm" style="margin-top: 12px;" onclick="SettingsUI.addTerminateReason()">
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
        await DB.clear('side_effects');
        await DB.clear('interventions');
        await DB.clear('satisfaction');
        
        showToast('所有資料已清除，重新整理頁面將載入演示數據');
        closeModal();
        
        // 延遲後重新整理頁面以重新初始化演示數據
        setTimeout(() => {
            location.reload();
        }, 1500);
    },
    
    /**
     * 還原測試資料（50位病人）
     */
    async resetToDemo() {
        if (!confirm('這將清除所有現有資料，並載入 50 位測試病人。確定繼續？')) return;
        
        showToast('正在清除並重建資料...', 'info');
        
        // 清除所有資料
        await DB.clear('patients');
        await DB.clear('treatments');
        await DB.clear('weight_records');
        await DB.clear('side_effects');
        await DB.clear('interventions');
        await DB.clear('satisfaction');
        
        // 使用 DemoData 模組重建
        if (typeof DemoData !== 'undefined') {
            await DemoData.init();
            showToast('已載入 50 位測試病人');
        } else {
            showToast('演示數據模組未載入', 'error');
        }
        
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
    },
    
    // === 終止原因管理 ===
    
    async addTerminateReason() {
        const name = prompt('請輸入終止原因：');
        if (!name) return;
        
        const terminateReasons = await Settings.get('terminate_reasons', []);
        const code = 'custom_' + Date.now();
        terminateReasons.push({ code, label: name });
        await Settings.set('terminate_reasons', terminateReasons);
        
        showToast('終止原因已新增');
        this.show();
        setTimeout(() => {
            document.querySelector('[data-settings-tab="terminate"]')?.click();
        }, 100);
    },
    
    async editTerminateReason(index) {
        const terminateReasons = await Settings.get('terminate_reasons', []);
        const current = terminateReasons[index];
        
        const name = prompt('請輸入新名稱：', current.label);
        if (!name) return;
        
        terminateReasons[index].label = name;
        await Settings.set('terminate_reasons', terminateReasons);
        
        showToast('終止原因已更新');
        this.show();
        setTimeout(() => {
            document.querySelector('[data-settings-tab="terminate"]')?.click();
        }, 100);
    },
    
    async deleteTerminateReason(index) {
        if (!confirm('確定刪除此終止原因？')) return;
        
        const terminateReasons = await Settings.get('terminate_reasons', []);
        terminateReasons.splice(index, 1);
        await Settings.set('terminate_reasons', terminateReasons);
        
        showToast('終止原因已刪除');
        this.show();
        setTimeout(() => {
            document.querySelector('[data-settings-tab="terminate"]')?.click();
        }, 100);
    },
    
    async moveTerminateReason(index, direction) {
        const terminateReasons = await Settings.get('terminate_reasons', []);
        const newIndex = index + direction;
        
        if (newIndex < 0 || newIndex >= terminateReasons.length) return;
        
        [terminateReasons[index], terminateReasons[newIndex]] = [terminateReasons[newIndex], terminateReasons[index]];
        await Settings.set('terminate_reasons', terminateReasons);
        
        this.show();
        setTimeout(() => {
            document.querySelector('[data-settings-tab="terminate"]')?.click();
        }, 100);
    }
};

/**
 * 系統設定頁面模組（側邊欄版本）
 */
const SettingsPage = {
    currentTab: 'cancer',
    
    /**
     * 初始化設定頁面
     */
    async init() {
        this.currentTab = 'cancer';
        await this.render();
    },
    
    /**
     * 切換 Tab
     */
    async switchTab(tab) {
        this.currentTab = tab;
        
        // 更新 Tab 按鈕狀態
        document.querySelectorAll('.settings-page-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        
        await this.render();
    },
    
    /**
     * 渲染內容
     */
    async render() {
        const container = document.getElementById('settings-page-content');
        if (!container) return;
        
        let html = '';
        
        switch (this.currentTab) {
            case 'cancer':
                html = await this.renderCancerTypes();
                break;
            case 'staff':
                html = await this.renderStaff();
                break;
            case 'alert':
                html = await this.renderAlertRules();
                break;
            case 'reasons':
                html = await this.renderReasons();
                break;
            case 'backup':
                html = await this.renderBackup();
                break;
            case 'other':
                html = await this.renderOther();
                break;
        }
        
        container.innerHTML = html;
    },
    
    /**
     * 癌別管理
     */
    async renderCancerTypes() {
        const cancerTypes = await Settings.get('cancer_types', []);
        
        return `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3>癌別管理</h3>
                    <button class="btn btn-primary btn-sm" onclick="SettingsPage.addCancerType()">新增癌別</button>
                </div>
                <div class="settings-card-body">
                    ${cancerTypes.length === 0 ? '<p class="text-hint">尚未設定癌別</p>' : `
                        <table class="settings-table">
                            <thead>
                                <tr>
                                    <th style="width: 80px;">代碼</th>
                                    <th>名稱</th>
                                    <th style="width: 120px;">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${cancerTypes.map((c, i) => `
                                    <tr>
                                        <td><code>${c.code}</code></td>
                                        <td>${c.label}</td>
                                        <td>
                                            <button class="btn-mini" onclick="SettingsPage.moveCancerType(${i}, -1)" title="上移">▲</button>
                                            <button class="btn-mini" onclick="SettingsPage.moveCancerType(${i}, 1)" title="下移">▼</button>
                                            <button class="btn-mini" onclick="SettingsPage.editCancerType(${i})" title="編輯">✎</button>
                                            <button class="btn-mini btn-mini-danger" onclick="SettingsPage.deleteCancerType(${i})" title="刪除">✕</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    },
    
    /**
     * 人員管理
     */
    async renderStaff() {
        const staffList = await Settings.get('staff_list', []);
        
        return `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3>人員管理</h3>
                    <button class="btn btn-primary btn-sm" onclick="SettingsPage.addStaff()">新增人員</button>
                </div>
                <div class="settings-card-body">
                    ${staffList.length === 0 ? '<p class="text-hint">尚未設定人員</p>' : `
                        <table class="settings-table">
                            <thead>
                                <tr>
                                    <th>姓名</th>
                                    <th style="width: 120px;">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${staffList.map((s, i) => `
                                    <tr>
                                        <td>${s}</td>
                                        <td>
                                            <button class="btn-mini" onclick="SettingsPage.moveStaff(${i}, -1)" title="上移">▲</button>
                                            <button class="btn-mini" onclick="SettingsPage.moveStaff(${i}, 1)" title="下移">▼</button>
                                            <button class="btn-mini" onclick="SettingsPage.editStaff(${i})" title="編輯">✎</button>
                                            <button class="btn-mini btn-mini-danger" onclick="SettingsPage.deleteStaff(${i})" title="刪除">✕</button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    },
    
    /**
     * 警示規則
     */
    async renderAlertRules() {
        const alertRules = await Settings.get('alert_rules', []);
        const cancerTypes = await Settings.get('cancer_types', []);
        
        return `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3>警示規則</h3>
                    <button class="btn btn-primary btn-sm" onclick="SettingsPage.addAlertRule()">新增癌別規則</button>
                </div>
                <div class="settings-card-body">
                    <p style="margin-bottom: 16px; color: var(--text-secondary); font-size: 13px;">
                        體重下降達閾值時自動觸發介入提醒
                    </p>
                    ${alertRules.length === 0 ? '<p class="text-hint">尚未設定警示規則</p>' : `
                        <table class="settings-table">
                            <thead>
                                <tr>
                                    <th>適用癌別</th>
                                    <th style="width: 100px;">SDM 閾值</th>
                                    <th style="width: 100px;">營養師閾值</th>
                                    <th style="width: 120px;">操作</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${alertRules.map((r, i) => {
                                    const label = r.cancer_type === 'default' ? '預設規則' : 
                                        (cancerTypes.find(c => c.code === r.cancer_type)?.label || r.cancer_type);
                                    return `
                                    <tr>
                                        <td>${label}</td>
                                        <td>${r.sdm_threshold}%</td>
                                        <td>${r.nutrition_threshold}%</td>
                                        <td>
                                            <button class="btn-mini" onclick="SettingsPage.moveAlertRule(${i}, -1)" title="上移">▲</button>
                                            <button class="btn-mini" onclick="SettingsPage.moveAlertRule(${i}, 1)" title="下移">▼</button>
                                            <button class="btn-mini" onclick="SettingsPage.editAlertRule(${i})" title="編輯">✎</button>
                                            ${r.cancer_type !== 'default' ? `<button class="btn-mini btn-mini-danger" onclick="SettingsPage.deleteAlertRule(${i})" title="刪除">✕</button>` : ''}
                                        </td>
                                    </tr>
                                `}).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;
    },
    
    /**
     * 暫停/終止原因
     */
    async renderReasons() {
        const pauseReasons = await Settings.get('pause_reasons', []);
        const terminateReasons = await Settings.get('terminate_reasons', []);
        
        return `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3>暫停原因</h3>
                    <button class="btn btn-primary btn-sm" onclick="SettingsPage.addPauseReason()">新增</button>
                </div>
                <div class="settings-card-body">
                    ${pauseReasons.length === 0 ? '<p class="text-hint">尚未設定</p>' : `
                        <div class="settings-list">
                            ${pauseReasons.map((r, i) => `
                                <div class="settings-list-item">
                                    <span>${r.label || r}</span>
                                    <div>
                                        <button class="btn-mini" onclick="SettingsPage.movePauseReason(${i}, -1)">▲</button>
                                        <button class="btn-mini" onclick="SettingsPage.movePauseReason(${i}, 1)">▼</button>
                                        <button class="btn-mini" onclick="SettingsPage.editPauseReason(${i})">✎</button>
                                        <button class="btn-mini btn-mini-danger" onclick="SettingsPage.deletePauseReason(${i})">✕</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
            
            <div class="settings-card" style="margin-top: 16px;">
                <div class="settings-card-header">
                    <h3>終止原因</h3>
                    <button class="btn btn-primary btn-sm" onclick="SettingsPage.addTerminateReason()">新增</button>
                </div>
                <div class="settings-card-body">
                    ${terminateReasons.length === 0 ? '<p class="text-hint">尚未設定</p>' : `
                        <div class="settings-list">
                            ${terminateReasons.map((r, i) => `
                                <div class="settings-list-item">
                                    <span>${r.label || r}</span>
                                    <div>
                                        <button class="btn-mini" onclick="SettingsPage.moveTerminateReason(${i}, -1)">▲</button>
                                        <button class="btn-mini" onclick="SettingsPage.moveTerminateReason(${i}, 1)">▼</button>
                                        <button class="btn-mini" onclick="SettingsPage.editTerminateReason(${i})">✎</button>
                                        <button class="btn-mini btn-mini-danger" onclick="SettingsPage.deleteTerminateReason(${i})">✕</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    `}
                </div>
            </div>
        `;
    },
    
    /**
     * 備份還原
     */
    async renderBackup() {
        const lastBackup = await Settings.get('last_backup_date', null);
        const lastSync = await Settings.get('last_sync_time', null);
        const isConnected = VersionSync.isConnected();
        const folderName = VersionSync.getFolderName();
        
        return `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3>資料備份</h3>
                </div>
                <div class="settings-card-body">
                    <p style="margin-bottom: 16px; color: var(--text-secondary);">
                        上次備份：${lastBackup ? formatDate(new Date(lastBackup)) : '從未備份'}
                    </p>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="SettingsPage.exportBackup()">
                            匯出備份檔
                        </button>
                        <button class="btn btn-outline" onclick="SettingsPage.importBackup()">
                            匯入備份檔
                        </button>
                    </div>
                    <input type="file" id="settings-import-file" accept=".json" style="display: none;" 
                           onchange="SettingsPage.doImportBackup(this.files[0])">
                </div>
            </div>
            
            <div class="settings-card" style="margin-top: 16px;">
                <div class="settings-card-header">
                    <h3>資料同步</h3>
                </div>
                <div class="settings-card-body">
                    <p style="margin-bottom: 12px; color: var(--text-secondary);">
                        上次同步：${lastSync ? formatDate(new Date(lastSync)) : '從未同步'}
                    </p>
                    <p style="margin-bottom: ${isConnected ? '8px' : '16px'}; color: var(--text-secondary);">
                        共享資料夾：${isConnected ? '<span style="color: var(--success);">已連接</span>' : '未連接'}
                    </p>
                    ${isConnected && folderName ? `
                        <p style="margin-bottom: 16px; color: var(--text-hint); font-size: 12px;">
                            路徑：${folderName}/RTO-QCC-DATA.json
                        </p>
                    ` : ''}
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="VersionSync.connectAndSync().then(() => SettingsPage.render())">
                            ${isConnected ? '重新連接' : '連接共享資料夾'}
                        </button>
                        ${isConnected ? `
                            <button class="btn btn-outline" onclick="VersionSync.save()">
                                立即同步
                            </button>
                            <button class="btn btn-outline" onclick="VersionSync.disconnect().then(() => SettingsPage.render())">
                                斷開連接
                            </button>
                        ` : ''}
                    </div>
                </div>
            </div>
            
            <div class="settings-card" style="margin-top: 16px; border-color: var(--danger);">
                <div class="settings-card-header">
                    <h3 style="color: var(--danger);">危險區域</h3>
                </div>
                <div class="settings-card-body">
                    <p style="margin-bottom: 16px; color: var(--text-secondary);">
                        清除所有資料將無法復原，請先備份！
                    </p>
                    <button class="btn btn-danger" onclick="SettingsPage.clearAllData()">
                        清除所有資料
                    </button>
                </div>
            </div>
        `;
    },
    
    /**
     * 其他設定
     */
    async renderOther() {
        const patientAppUrl = await Settings.get('patient_app_url', '');
        const satisfactionEnabled = await Settings.get('satisfaction_enabled', false);
        
        return `
            <div class="settings-card">
                <div class="settings-card-header">
                    <h3>病人端設定</h3>
                </div>
                <div class="settings-card-body">
                    <div class="form-group">
                        <label class="form-label">病人端網址</label>
                        <input type="text" class="form-input" id="settings-patient-url" 
                               value="${patientAppUrl}" placeholder="https://example.com/patient.html"
                               onchange="SettingsPage.savePatientUrl()">
                        <p class="form-hint">用於產生病人端 QR Code</p>
                    </div>
                </div>
            </div>
            
            <div class="settings-card" style="margin-top: 16px;">
                <div class="settings-card-header">
                    <h3>功能開關</h3>
                </div>
                <div class="settings-card-body">
                    <label class="toggle-item">
                        <input type="checkbox" ${satisfactionEnabled ? 'checked' : ''} 
                               onchange="SettingsPage.toggleSatisfaction(this.checked)">
                        <span>啟用滿意度調查</span>
                    </label>
                </div>
            </div>
            
            <div class="settings-card" style="margin-top: 16px;">
                <div class="settings-card-header">
                    <h3>演示資料</h3>
                </div>
                <div class="settings-card-body">
                    <p style="margin-bottom: 16px; color: var(--text-secondary);">
                        載入 100 位測試病人資料，用於功能展示
                    </p>
                    <button class="btn btn-outline" onclick="SettingsPage.loadDemoData()">
                        載入演示資料
                    </button>
                </div>
            </div>
        `;
    },
    
    // ==================== 操作函數 ====================
    
    // 癌別
    async addCancerType() {
        const code = prompt('請輸入癌別代碼（如 HNC）：');
        if (!code) return;
        const label = prompt('請輸入癌別名稱（如 頭頸癌）：');
        if (!label) return;
        
        const cancerTypes = await Settings.get('cancer_types', []);
        cancerTypes.push({ code: code.toUpperCase(), label });
        await Settings.set('cancer_types', cancerTypes);
        this.render();
        showToast('已新增癌別', 'success');
    },
    
    async editCancerType(index) {
        const cancerTypes = await Settings.get('cancer_types', []);
        const item = cancerTypes[index];
        
        const code = prompt('癌別代碼：', item.code);
        if (!code) return;
        const label = prompt('癌別名稱：', item.label);
        if (!label) return;
        
        cancerTypes[index] = { code: code.toUpperCase(), label };
        await Settings.set('cancer_types', cancerTypes);
        this.render();
    },
    
    async deleteCancerType(index) {
        if (!confirm('確定要刪除此癌別？')) return;
        
        const cancerTypes = await Settings.get('cancer_types', []);
        cancerTypes.splice(index, 1);
        await Settings.set('cancer_types', cancerTypes);
        this.render();
        showToast('已刪除', 'success');
    },
    
    async moveCancerType(index, direction) {
        const cancerTypes = await Settings.get('cancer_types', []);
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= cancerTypes.length) return;
        
        [cancerTypes[index], cancerTypes[newIndex]] = [cancerTypes[newIndex], cancerTypes[index]];
        await Settings.set('cancer_types', cancerTypes);
        this.render();
    },
    
    // 人員
    async addStaff() {
        const name = prompt('請輸入人員姓名：');
        if (!name) return;
        
        const staffList = await Settings.get('staff_list', []);
        staffList.push(name);
        await Settings.set('staff_list', staffList);
        this.render();
        showToast('已新增人員', 'success');
    },
    
    async editStaff(index) {
        const staffList = await Settings.get('staff_list', []);
        const name = prompt('人員姓名：', staffList[index]);
        if (!name) return;
        
        staffList[index] = name;
        await Settings.set('staff_list', staffList);
        this.render();
    },
    
    async deleteStaff(index) {
        if (!confirm('確定要刪除此人員？')) return;
        
        const staffList = await Settings.get('staff_list', []);
        staffList.splice(index, 1);
        await Settings.set('staff_list', staffList);
        this.render();
        showToast('已刪除', 'success');
    },
    
    async moveStaff(index, direction) {
        const staffList = await Settings.get('staff_list', []);
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= staffList.length) return;
        
        [staffList[index], staffList[newIndex]] = [staffList[newIndex], staffList[index]];
        await Settings.set('staff_list', staffList);
        this.render();
    },
    
    // 警示規則
    async addAlertRule() {
        const cancerTypes = await Settings.get('cancer_types', []);
        const options = cancerTypes.map(c => c.code).join(', ');
        
        const cancerType = prompt(`請輸入癌別代碼（${options}）：`);
        if (!cancerType) return;
        
        const sdmThreshold = prompt('SDM 閾值（負數，如 -3）：', '-3');
        if (!sdmThreshold) return;
        
        const nutritionThreshold = prompt('營養師閾值（負數，如 -5）：', '-5');
        if (!nutritionThreshold) return;
        
        const alertRules = await Settings.get('alert_rules', []);
        alertRules.push({ 
            cancer_type: cancerType, 
            sdm_threshold: parseFloat(sdmThreshold), 
            nutrition_threshold: parseFloat(nutritionThreshold) 
        });
        await Settings.set('alert_rules', alertRules);
        this.render();
        showToast('已新增規則', 'success');
    },
    
    async editAlertRule(index) {
        const alertRules = await Settings.get('alert_rules', []);
        const item = alertRules[index];
        
        const sdmThreshold = prompt('SDM 閾值：', item.sdm_threshold);
        if (sdmThreshold === null) return;
        
        const nutritionThreshold = prompt('營養師閾值：', item.nutrition_threshold);
        if (nutritionThreshold === null) return;
        
        alertRules[index] = { 
            ...item, 
            sdm_threshold: parseFloat(sdmThreshold), 
            nutrition_threshold: parseFloat(nutritionThreshold) 
        };
        await Settings.set('alert_rules', alertRules);
        this.render();
    },
    
    async deleteAlertRule(index) {
        if (!confirm('確定要刪除此規則？')) return;
        
        const alertRules = await Settings.get('alert_rules', []);
        alertRules.splice(index, 1);
        await Settings.set('alert_rules', alertRules);
        this.render();
        showToast('已刪除', 'success');
    },
    
    async moveAlertRule(index, direction) {
        const alertRules = await Settings.get('alert_rules', []);
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= alertRules.length) return;
        
        [alertRules[index], alertRules[newIndex]] = [alertRules[newIndex], alertRules[index]];
        await Settings.set('alert_rules', alertRules);
        this.render();
    },
    
    // 暫停原因
    async addPauseReason() {
        const label = prompt('請輸入暫停原因：');
        if (!label) return;
        
        const code = 'pause_' + Date.now();
        const reasons = await Settings.get('pause_reasons', []);
        reasons.push({ code, label });
        await Settings.set('pause_reasons', reasons);
        this.render();
        showToast('已新增', 'success');
    },
    
    async editPauseReason(index) {
        const reasons = await Settings.get('pause_reasons', []);
        const item = reasons[index];
        const label = prompt('暫停原因：', item.label || item);
        if (!label) return;
        
        reasons[index] = typeof item === 'object' ? { ...item, label } : { code: 'pause_' + index, label };
        await Settings.set('pause_reasons', reasons);
        this.render();
    },
    
    async deletePauseReason(index) {
        if (!confirm('確定要刪除？')) return;
        
        const reasons = await Settings.get('pause_reasons', []);
        reasons.splice(index, 1);
        await Settings.set('pause_reasons', reasons);
        this.render();
        showToast('已刪除', 'success');
    },
    
    async movePauseReason(index, direction) {
        const reasons = await Settings.get('pause_reasons', []);
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= reasons.length) return;
        
        [reasons[index], reasons[newIndex]] = [reasons[newIndex], reasons[index]];
        await Settings.set('pause_reasons', reasons);
        this.render();
    },
    
    // 終止原因
    async addTerminateReason() {
        const label = prompt('請輸入終止原因：');
        if (!label) return;
        
        const code = 'terminate_' + Date.now();
        const reasons = await Settings.get('terminate_reasons', []);
        reasons.push({ code, label });
        await Settings.set('terminate_reasons', reasons);
        this.render();
        showToast('已新增', 'success');
    },
    
    async editTerminateReason(index) {
        const reasons = await Settings.get('terminate_reasons', []);
        const item = reasons[index];
        const label = prompt('終止原因：', item.label || item);
        if (!label) return;
        
        reasons[index] = typeof item === 'object' ? { ...item, label } : { code: 'terminate_' + index, label };
        await Settings.set('terminate_reasons', reasons);
        this.render();
    },
    
    async deleteTerminateReason(index) {
        if (!confirm('確定要刪除？')) return;
        
        const reasons = await Settings.get('terminate_reasons', []);
        reasons.splice(index, 1);
        await Settings.set('terminate_reasons', reasons);
        this.render();
        showToast('已刪除', 'success');
    },
    
    async moveTerminateReason(index, direction) {
        const reasons = await Settings.get('terminate_reasons', []);
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= reasons.length) return;
        
        [reasons[index], reasons[newIndex]] = [reasons[newIndex], reasons[index]];
        await Settings.set('terminate_reasons', reasons);
        this.render();
    },
    
    // 備份還原
    async exportBackup() {
        try {
            const data = await exportAllData();
            const filename = `RTO-QCC-備份-${formatDate(new Date())}.json`;
            await downloadJSON(data, filename);
            await Settings.set('last_backup_date', new Date().toISOString());
            showToast('備份已匯出', 'success');
            this.render();
        } catch (e) {
            showToast('匯出失敗: ' + e.message, 'error');
        }
    },
    
    importBackup() {
        document.getElementById('settings-import-file').click();
    },
    
    async doImportBackup(file) {
        if (!file) return;
        if (!confirm('匯入將覆蓋現有資料，確定要繼續？')) return;
        
        try {
            const data = await readJSONFile(file);
            await importAllData(data);
            showToast('匯入成功', 'success');
            this.render();
            document.getElementById('settings-import-file').value = '';
        } catch (e) {
            showToast('匯入失敗: ' + e.message, 'error');
        }
    },
    
    async clearAllData() {
        // 產生隨機四碼
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const input = prompt(`此操作無法復原！請輸入 ${code} 確認清除所有資料：`);
        
        if (input !== code) {
            if (input !== null) {
                showToast('驗證碼不正確，操作已取消', 'error');
            }
            return;
        }
        
        try {
            await DB.clear('patients');
            await DB.clear('treatments');
            await DB.clear('weight_records');
            await DB.clear('side_effects');
            await DB.clear('interventions');
            await DB.clear('satisfaction');
            showToast('資料已清除', 'success');
            location.reload();
        } catch (e) {
            showToast('清除失敗: ' + e.message, 'error');
        }
    },
    
    // 其他設定
    async savePatientUrl() {
        const url = document.getElementById('settings-patient-url').value;
        await Settings.set('patient_app_url', url);
        showToast('已儲存', 'success');
    },
    
    async toggleSatisfaction(enabled) {
        await Settings.set('satisfaction_enabled', enabled);
        showToast(enabled ? '已啟用滿意度調查' : '已停用滿意度調查', 'success');
    },
    
    async loadDemoData() {
        if (!confirm('載入演示資料將新增 100 位測試病人，確定？')) return;
        
        try {
            await loadDemoData();
            showToast('演示資料已載入', 'success');
            location.reload();
        } catch (e) {
            showToast('載入失敗: ' + e.message, 'error');
        }
    }
};
