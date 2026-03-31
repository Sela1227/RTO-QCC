/**
 * 彰濱放腫體重監控預防系統 - 主程式
 * v6.0.1 Web 版
 */

const App = {
    currentPage: 'home',
    currentTrackingTab: 'active',
    selectedTreatmentId: null,
    trackingFilter: null,
    weightChart: null,  // 體重趨勢圖實例
    patientSearchKeyword: null,  // 病人搜尋關鍵字
    // 追蹤清單篩選排序
    trackingFilterCancer: '',
    trackingFilterPhysician: '',
    trackingSort: 'name',
    trackingSortDir: 'asc',
    
    /**
     * 初始化應用程式
     */
    async init() {
        try {
            // 初始化資料庫
            await initDB();
            await initDefaultSettings();
            
            // 綁定事件
            this.bindEvents();
            
            // 綁定關閉前備份提示
            this.bindCloseEvent();
            
            // 初始化病人資料庫模組
            await PatientDB.init();
            
            // 初始化追蹤清單篩選選項
            await this.initTrackingFilters();
            
            // 檢查備份狀態（暫時關閉強制備份）
            // await this.checkBackupStatus();
            
            // 載入首頁
            await this.refresh();
            
            console.log('彰濱放腫體重監控預防系統已啟動');
            
            // 延遲顯示同步提示（讓畫面先載入）
            setTimeout(() => Sync.checkOnStartup(), 500);
            
        } catch (e) {
            console.error('初始化失敗:', e);
            showToast('系統初始化失敗', 'error');
        }
    },
    
    /**
     * 綁定關閉前事件
     */
    bindCloseEvent() {
        // 使用 visibilitychange 來處理（更可靠）
        let backupPromptShown = false;
        
        document.addEventListener('visibilitychange', async () => {
            if (document.visibilityState === 'hidden' && !backupPromptShown) {
                const enabled = await Settings.get('sync_on_close', true);
                if (enabled) {
                    // 無法在 visibilitychange 中顯示 modal
                    // 改用其他方式提醒
                }
            }
        });
        
        // 添加快捷鍵 Ctrl+S 備份
        document.addEventListener('keydown', async (e) => {
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                await Sync.backupToFile();
            }
        });
    },
    
    /**
     * 檢查備份狀態
     */
    async checkBackupStatus() {
        const lastBackupDate = await Settings.get('last_backup_date', null);
        const hasData = await this.hasAnyData();
        
        // 如果有資料但從未備份，強制備份
        if (hasData && !lastBackupDate) {
            await this.showForceBackupModal('首次使用');
            return;
        }
        
        // 如果有備份記錄，檢查是否超過 7 天
        if (hasData && lastBackupDate) {
            const lastDate = new Date(lastBackupDate);
            const now = new Date();
            const diffDays = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays >= 7) {
                await this.showForceBackupModal(`已超過 ${diffDays} 天未備份`);
            }
        }
    },
    
    /**
     * 檢查是否有任何資料
     */
    async hasAnyData() {
        const patients = await DB.getAll('patients');
        return patients.length > 0;
    },
    
    /**
     * 顯示強制備份對話框
     */
    async showForceBackupModal(reason) {
        const stats = await this.getDataStats();
        
        const html = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 24px; margin-bottom: 16px; color: var(--warning);">[!]</div>
                <h3 style="margin-bottom: 8px; color: var(--warning);">請先備份資料</h3>
                <p style="color: var(--text-secondary); margin-bottom: 20px;">
                    ${reason}，為避免資料遺失，請立即備份。
                </p>
                
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                    <div class="detail-row">
                        <span>病人數</span>
                        <strong>${stats.patientCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>療程數</span>
                        <strong>${stats.treatmentCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>體重記錄</span>
                        <strong>${stats.weightCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>介入記錄</span>
                        <strong>${stats.interventionCount}</strong>
                    </div>
                </div>
                
                <p style="font-size: 12px; color: var(--text-hint);">
                    備份檔案會下載到您的電腦，請妥善保存。
                </p>
            </div>
        `;
        
        return new Promise((resolve) => {
            openModal('資料備份提醒', html, [
                {
                    text: '立即備份',
                    class: 'btn-primary',
                    closeOnClick: false,
                    onClick: async () => {
                        await SettingsUI.exportData();
                        
                        // 恢復關閉按鈕
                        document.getElementById('modal-close').style.display = '';
                        document.getElementById('modal-overlay').onclick = (e) => {
                            if (e.target === e.currentTarget) closeModal();
                        };
                        
                        closeModal();
                        showToast('感謝您的備份！資料已安全保存。');
                        resolve();
                    }
                }
            ]);
            
            // 禁止關閉對話框（移除關閉按鈕和點擊外部關閉）
            document.getElementById('modal-close').style.display = 'none';
            document.getElementById('modal-overlay').onclick = null;
        });
    },
    
    /**
     * 取得資料統計
     */
    async getDataStats() {
        const patients = await DB.getAll('patients');
        const treatments = await DB.getAll('treatments');
        const weights = await DB.getAll('weight_records');
        const interventions = await DB.getAll('interventions');
        
        return {
            patientCount: patients.length,
            treatmentCount: treatments.length,
            weightCount: weights.length,
            interventionCount: interventions.length
        };
    },
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 導航選單
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => this.navigate(item.dataset.page);
        });
        
        // 設定按鈕
        document.getElementById('btn-settings').onclick = () => SettingsUI.show();
        
        // 對話框關閉
        document.getElementById('modal-close').onclick = closeModal;
        document.getElementById('modal-overlay').onclick = (e) => {
            if (e.target === e.currentTarget) closeModal();
        };
        
        // 新增病人按鈕
        document.getElementById('btn-new-patient').onclick = () => Patient.showForm();
        document.getElementById('btn-add-patient').onclick = () => Patient.showForm();
        
        // 病人頁搜尋
        document.getElementById('btn-patient-search').onclick = () => PatientDB.refresh();
        document.getElementById('patient-search-input').onkeypress = (e) => {
            if (e.key === 'Enter') PatientDB.refresh();
        };
        
        // 統計卡片點擊
        document.querySelectorAll('.stat-card').forEach(card => {
            card.onclick = () => {
                const filter = card.dataset.filter;
                this.navigate('tracking');
                
                // 直接切換到對應頁籤
                setTimeout(() => {
                    document.querySelectorAll('#page-tracking .tab').forEach(t => {
                        t.classList.toggle('active', t.dataset.tab === filter);
                    });
                    this.currentTrackingTab = filter;
                    this.renderTracking();
                }, 100);
            };
        });
        
        // 追蹤頁籤（使用事件委託）
        const trackingHeader = document.querySelector('#page-tracking .page-header');
        if (trackingHeader) {
            trackingHeader.addEventListener('click', (e) => {
                const tab = e.target.closest('.tab');
                if (tab) {
                    document.querySelectorAll('#page-tracking .tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                    this.currentTrackingTab = tab.dataset.tab;
                    this.renderTracking();
                }
            });
        }
        
        // 匯出 Excel
        document.getElementById('btn-export-excel').onclick = () => Report.exportExcel();
        
        // 匯出 PDF
        document.getElementById('btn-export-pdf').onclick = () => Report.exportPdf();
        
        // 追蹤清單篩選排序
        document.getElementById('tracking-filter-cancer').onchange = (e) => {
            this.trackingFilterCancer = e.target.value;
            this.renderTracking();
        };
        document.getElementById('tracking-filter-physician').onchange = (e) => {
            this.trackingFilterPhysician = e.target.value;
            this.renderTracking();
        };
        document.getElementById('tracking-sort').onchange = (e) => {
            this.trackingSort = e.target.value;
            this.renderTracking();
        };
        document.getElementById('tracking-sort-dir').onclick = () => {
            this.trackingSortDir = this.trackingSortDir === 'asc' ? 'desc' : 'asc';
            document.getElementById('tracking-sort-dir').classList.toggle('desc', this.trackingSortDir === 'desc');
            this.renderTracking();
        };
    },
    
    /**
     * 初始化追蹤清單篩選選項
     */
    async initTrackingFilters() {
        const cancerSelect = document.getElementById('tracking-filter-cancer');
        const physicianSelect = document.getElementById('tracking-filter-physician');
        
        if (!cancerSelect || !physicianSelect) return;
        
        // 取得所有癌別
        const cancerTypes = CONFIG.CANCER_TYPES || [];
        cancerSelect.innerHTML = '<option value="">全部癌別</option>' + 
            cancerTypes.map(c => `<option value="${c.code}">${c.label}</option>`).join('');
        
        // 取得所有醫師
        const physicians = await Settings.get('physicians', [
            { code: 'hsiung', name: '熊敬業' },
            { code: 'liu', name: '劉育昌' },
            { code: 'lin', name: '林伯儒' }
        ]);
        physicianSelect.innerHTML = '<option value="">全部醫師</option>' + 
            physicians.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
    },
    
    /**
     * 頁面導航
     */
    navigate(page) {
        this.currentPage = page;
        
        // 更新選單狀態
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        
        // 顯示對應頁面
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `page-${page}`);
        });
        
        // 載入頁面內容
        this.refresh();
    },
    
    /**
     * 重新整理目前頁面
     */
    async refresh() {
        await this.updateStats();
        await this.updateFooter();
        
        switch (this.currentPage) {
            case 'home':
                // 首頁已是靜態
                break;
            case 'tracking':
                await this.renderTracking();
                break;
            case 'patients':
                await PatientDB.refresh();
                break;
            case 'reports':
                await Report.initFilters();
                await Report.render();
                break;
            case 'dashboard':
                await Dashboard.refresh();
                break;
        }
    },
    
    /**
     * 更新統計數字
     */
    async updateStats() {
        const activeTreatments = await Treatment.getActive();
        const pausedTreatments = await Treatment.getPaused();
        const alertRules = await Settings.get('alert_rules', []);
        const allInterventions = await DB.getAll('interventions');
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // 判斷是否達警示閾值
        const reachesThreshold = (t) => {
            if (t.change_rate === null) return false;
            const rule = alertRules.find(r => r.cancer_type === t.cancer_type) || 
                         alertRules.find(r => r.cancer_type === 'default') ||
                         { sdm_threshold: -3, nutrition_threshold: -5 };
            return t.change_rate <= rule.sdm_threshold;
        };
        
        // 判斷7天內是否有處置
        const hasRecentIntervention = (treatmentId) => {
            return allInterventions.some(i => 
                i.treatment_id === treatmentId && 
                !i.deleted &&
                (i.status === 'executed' || i.contacted_at) &&
                new Date(i.executed_at || i.contacted_at) >= sevenDaysAgo
            );
        };
        
        // 需處理：達閾值且7天內未處置
        const pendingCount = activeTreatments.filter(t => 
            reachesThreshold(t) && !hasRecentIntervention(t.id)
        ).length;
        
        // 需關注：達閾值但7天內已處置
        const attentionCount = activeTreatments.filter(t => 
            reachesThreshold(t) && hasRecentIntervention(t.id)
        ).length;
        
        // 待輸體重
        const overdueCount = activeTreatments.filter(t => 
            t.tracking_status?.status === 'overdue'
        ).length;
        
        // 待補資料：重要欄位未填（基準體重、主治醫師、期別、放療劑量）
        const incompleteCount = activeTreatments.filter(t => 
            !t.baseline_weight || !t.physician || !t.stage || !t.radiation_dose
        ).length;
        
        document.getElementById('stat-active').textContent = activeTreatments.length;
        document.getElementById('stat-paused').textContent = pausedTreatments.length;
        document.getElementById('stat-pending').textContent = pendingCount;
        document.getElementById('stat-attention').textContent = attentionCount;
        document.getElementById('stat-overdue').textContent = overdueCount;
        document.getElementById('stat-incomplete').textContent = incompleteCount;
        
        // 檢查備份提醒
        await this.checkBackupReminder();
    },
    
    /**
     * 檢查備份提醒
     */
    async checkBackupReminder() {
        const reminder = document.getElementById('backup-reminder');
        if (!reminder) return;
        
        const lastBackup = await Settings.get('last_backup_time');
        const now = new Date();
        
        if (!lastBackup) {
            // 從未備份過
            reminder.style.display = 'flex';
            document.getElementById('backup-reminder-msg').textContent = '尚未建立備份';
            return;
        }
        
        const lastBackupDate = new Date(lastBackup);
        const daysSinceBackup = Math.floor((now - lastBackupDate) / (1000 * 60 * 60 * 24));
        
        if (daysSinceBackup >= 7) {
            reminder.style.display = 'flex';
            document.getElementById('backup-reminder-msg').textContent = 
                `上次備份：${daysSinceBackup} 天前`;
        } else {
            reminder.style.display = 'none';
        }
    },
    
    /**
     * 執行資料備份
     */
    async doBackup() {
        try {
            const data = await exportAllData();
            const filename = `weight_backup_${today()}.json`;
            downloadJSON(data, filename);
            
            // 記錄備份時間
            await Settings.set('last_backup_time', new Date().toISOString());
            
            showToast('備份已下載');
            
            // 隱藏提醒
            const reminder = document.getElementById('backup-reminder');
            if (reminder) {
                reminder.style.display = 'none';
            }
        } catch (e) {
            showToast('備份失敗: ' + e.message, 'error');
        }
    },
    
    /**
     * 點擊同步按鈕（開啟檔案選擇）
     */
    syncFromFile() {
        document.getElementById('home-sync-file').click();
    },
    
    /**
     * 執行同步
     */
    async doSyncFromFile(file) {
        if (!file) return;
        
        // 呼叫 SettingsUI.syncData 的邏輯
        await SettingsUI.syncData(file);
        
        // 清除 input
        document.getElementById('home-sync-file').value = '';
    },
    
    /**
     * 更新底部列
     */
    async updateFooter() {
        const activeCount = await DB.count('treatments');
        const stats = document.getElementById('footer-stats');
        stats.textContent = `${activeCount} 筆療程資料`;
    },
    
    /**
     * 搜尋病人（病人頁）
     */
    async searchPatients() {
        const keyword = document.getElementById('patient-search-input').value.trim();
        if (!keyword) {
            showToast('請輸入搜尋關鍵字', 'error');
            return;
        }
        
        // 顯示清除按鈕
        document.getElementById('btn-patient-search-clear').style.display = 'inline-flex';
        
        // 使用筛选功能
        await renderPatientList({ keyword });
    },
    
    /**
     * 清除病人搜尋
     */
    async clearPatientSearch() {
        document.getElementById('patient-search-input').value = '';
        document.getElementById('btn-patient-search-clear').style.display = 'none';
        await renderPatientList();
    },
    
    /**
     * 篩選病人
     */
    async filterPatients() {
        const keyword = document.getElementById('patient-search-input').value.trim();
        if (keyword) {
            document.getElementById('btn-patient-search-clear').style.display = 'inline-flex';
        }
        await renderPatientList({ keyword });
    },
    
    /**
     * 渲染追蹤頁面
     */
    async renderTracking() {
        const listContainer = document.getElementById('tracking-list');
        const detailContainer = document.getElementById('tracking-detail');
        
        // 取得療程列表
        let treatments = [];
        let tabTitle = '';
        const alertRules = await Settings.get('alert_rules', []);
        const allInterventions = await DB.getAll('interventions');
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        
        // 判斷是否達警示閾值
        const reachesThreshold = (t) => {
            if (t.change_rate === null) return false;
            const rule = alertRules.find(r => r.cancer_type === t.cancer_type) || 
                         alertRules.find(r => r.cancer_type === 'default') ||
                         { sdm_threshold: -3, nutrition_threshold: -5 };
            return t.change_rate <= rule.sdm_threshold;
        };
        
        // 判斷7天內是否有處置
        const hasRecentIntervention = (treatmentId) => {
            return allInterventions.some(i => 
                i.treatment_id === treatmentId && 
                !i.deleted &&
                (i.status === 'executed' || i.contacted_at) &&
                new Date(i.executed_at || i.contacted_at) >= sevenDaysAgo
            );
        };
        
        // 需處理：達閾值且7天內未處置
        const needsIntervention = (t) => {
            return reachesThreshold(t) && !hasRecentIntervention(t.id);
        };
        
        // 需關注：達閾值但7天內已處置
        const needsAttention = (t) => {
            return reachesThreshold(t) && hasRecentIntervention(t.id);
        };
        
        if (this.currentTrackingTab === 'active') {
            treatments = await Treatment.getActive();
            tabTitle = '治療中';
        } else if (this.currentTrackingTab === 'paused') {
            treatments = await Treatment.getPaused();
            tabTitle = '暫停中';
        } else if (this.currentTrackingTab === 'pending') {
            // 需處理：達閾值且7天內未處置
            treatments = await Treatment.getActive();
            treatments = treatments.filter(needsIntervention);
            tabTitle = '需處理';
        } else if (this.currentTrackingTab === 'attention') {
            // 需關注：達閾值但7天內已處置
            treatments = await Treatment.getActive();
            treatments = treatments.filter(needsAttention);
            tabTitle = '需關注';
        } else if (this.currentTrackingTab === 'overdue') {
            // 待輸體重：從治療中篩選超過追蹤週期的
            treatments = await Treatment.getActive();
            treatments = treatments.filter(t => t.tracking_status?.status === 'overdue');
            tabTitle = '待輸體重';
        } else if (this.currentTrackingTab === 'incomplete') {
            // 待補資料：重要欄位未填
            treatments = await Treatment.getActive();
            treatments = treatments.filter(t => 
                !t.baseline_weight || !t.physician || !t.stage || !t.radiation_dose
            );
            tabTitle = '待補資料';
        }
        
        // 應用篩選
        if (this.trackingFilterCancer) {
            treatments = treatments.filter(t => t.cancer_type === this.trackingFilterCancer);
        }
        if (this.trackingFilterPhysician) {
            treatments = treatments.filter(t => t.physician === this.trackingFilterPhysician);
        }
        
        // 應用排序
        const sortDir = this.trackingSortDir === 'asc' ? 1 : -1;
        treatments.sort((a, b) => {
            let valA, valB;
            switch (this.trackingSort) {
                case 'name':
                    valA = a.patient?.name || '';
                    valB = b.patient?.name || '';
                    return valA.localeCompare(valB, 'zh-TW') * sortDir;
                case 'start_date':
                    valA = a.treatment_start || '';
                    valB = b.treatment_start || '';
                    return valA.localeCompare(valB) * sortDir;
                case 'change_rate':
                    valA = a.change_rate ?? 999;
                    valB = b.change_rate ?? 999;
                    return (valA - valB) * sortDir;
                case 'medical_id':
                    valA = a.patient?.medical_id || '';
                    valB = b.patient?.medical_id || '';
                    return valA.localeCompare(valB) * sortDir;
                default:
                    return 0;
            }
        });
        
        if (treatments.length === 0) {
            let emptyMsg = `目前沒有${tabTitle}的病人`;
            
            listContainer.innerHTML = `
                <div class="empty-state" style="width: 100%;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M16 16s-1.5-2-4-2-4 2-4 2"></path>
                        <line x1="9" y1="9" x2="9.01" y2="9"></line>
                        <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                    <p>${emptyMsg}</p>
                </div>
            `;
            detailContainer.innerHTML = `
                <div class="empty-state">
                    <p>請先新增病人和療程</p>
                </div>
            `;
            return;
        }
        
        // 渲染卡片列表
        let cardsHtml = '';
        for (const t of treatments) {
            const rateClass = getRateClass(t.change_rate);
            const isSelected = t.id === this.selectedTreatmentId;
            const isOverdue = t.tracking_status?.status === 'overdue';
            
            // 取得此癌別的警示閾值
            const rule = alertRules.find(r => r.cancer_type === t.cancer_type) || 
                         alertRules.find(r => r.cancer_type === 'default') ||
                         { sdm_threshold: -3, nutrition_threshold: -5 };
            
            // 檢查體重變化是否達閾值
            const needsNutrition = t.change_rate !== null && t.change_rate <= rule.nutrition_threshold;
            const needsSdm = t.change_rate !== null && t.change_rate <= rule.sdm_threshold && !needsNutrition;
            const needsIntervention = needsNutrition || needsSdm;
            
            let cardClass = 'patient-card';
            if (isSelected) cardClass += ' active';
            if (needsNutrition) {
                cardClass += ' alert-danger';  // 營養師用紅色
            } else if (needsSdm) {
                cardClass += ' alert-warning'; // SDM 用橘色
            }
            if (isOverdue) cardClass += ' alert-overdue';
            
            // 生成標籤
            let tagsHtml = '';
            if (needsIntervention || isOverdue) {
                tagsHtml = '<div class="patient-card-tags">';
                if (needsNutrition) {
                    tagsHtml += '<span class="tag tag-red" style="font-size: 10px; padding: 1px 5px;">需營養師</span>';
                } else if (needsSdm) {
                    tagsHtml += '<span class="tag tag-amber" style="font-size: 10px; padding: 1px 5px;">需SDM</span>';
                }
                if (isOverdue) {
                    tagsHtml += '<span class="tag tag-purple" style="font-size: 10px; padding: 1px 5px;">待量體重</span>';
                }
                tagsHtml += '</div>';
            }
            
            cardsHtml += `
                <div class="${cardClass}" onclick="App.selectTreatment(${t.id})">
                    <div class="patient-card-header">
                        <span class="patient-card-id">${t.patient.medical_id}</span>
                        <span class="status-dot ${t.tracking_status?.class || 'green'}"></span>
                    </div>
                    <div class="patient-card-name">${t.patient.name}</div>
                    <div class="patient-card-info">
                        ${t.cancer_type_label}
                        ${t.change_rate !== null ? 
                            `<span class="patient-card-rate ${rateClass}">${formatChangeRate(t.change_rate)}</span>` 
                            : ''}
                    </div>
                    ${tagsHtml}
                </div>
            `;
        }
        listContainer.innerHTML = cardsHtml;
        
        // 如果有選中的，顯示詳情
        if (this.selectedTreatmentId) {
            const selected = treatments.find(t => t.id === this.selectedTreatmentId);
            if (selected) {
                this.renderTreatmentDetail(selected);
            } else {
                // 選中的不在目前列表，清除選擇
                this.selectedTreatmentId = null;
            }
        }
        
        // 如果沒選中，顯示提示
        if (!this.selectedTreatmentId) {
            detailContainer.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                    </svg>
                    <p>點選左側病人查看詳情</p>
                </div>
            `;
        }
    },
    
    /**
     * 選擇療程
     */
    selectTreatment(treatmentId) {
        this.selectedTreatmentId = treatmentId;
        this.renderTracking();
    },
    
    /**
     * 渲染療程詳情
     */
    async renderTreatmentDetail(treatment) {
        const container = document.getElementById('tracking-detail');
        const patient = treatment.patient;
        const age = calculateAge(patient.birth_date);
        
        // 取得更多統計資料
        const interventions = await Intervention.getByTreatment(treatment.id);
        const sideEffects = await DB.getAll('side_effects');
        const treatmentSE = sideEffects.filter(s => s.treatment_id === treatment.id && !s.deleted);
        
        // 計算療程天數
        const startDate = new Date(treatment.treatment_start);
        const endDate = treatment.completed_at || treatment.terminated_at || new Date();
        const dayCount = Math.floor((new Date(endDate) - startDate) / (1000 * 60 * 60 * 24));
        
        // 介入統計
        const interventionStats = {
            total: interventions.length,
            executed: interventions.filter(i => i.status === 'executed').length,
            pending: interventions.filter(i => i.status === 'pending' || i.status === 'contacted').length
        };
        
        // 取得待處理介入
        const pendingInterventions = interventions.filter(i => i.status === 'pending' || i.status === 'contacted');
        
        // 判斷是否需要介入（達閾值且7天內無處置）
        const rule = await Settings.get('alert_rule', { sdm_threshold: -3, nutrition_threshold: -5 });
        const needsNewIntervention = treatment.change_rate !== null && 
            treatment.change_rate <= rule.sdm_threshold && 
            pendingInterventions.length === 0;
        
        // 待處理介入或需新增介入提示
        let pendingHtml = '';
        if (pendingInterventions.length > 0) {
            pendingHtml = `
                <div style="background: rgba(228, 185, 90, 0.1); padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
                    <strong style="color: var(--warning); font-size: 12px;">待處理介入</strong>
                    ${pendingInterventions.map(i => {
                        const statusLabel = i.status === 'contacted' 
                            ? '<span class="tag tag-blue" style="font-size: 10px; padding: 1px 4px; margin-left: 4px;">已聯繫</span>'
                            : '';
                        const actionBtn = i.status === 'contacted'
                            ? `<button class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size: 11px;"
                                    onclick="Intervention.showExecuteForm(${i.id})">執行</button>`
                            : `<button class="btn btn-warning btn-sm" style="padding: 2px 8px; font-size: 11px;"
                                    onclick="Intervention.showExecuteForm(${i.id})">執行</button>`;
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                                <span style="font-size: 12px;">${formatInterventionType(i.type)}${statusLabel}</span>
                                ${actionBtn}
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } else if (needsNewIntervention) {
            const isNutrition = treatment.change_rate <= rule.nutrition_threshold;
            const alertType = isNutrition ? '需營養師介入' : '需 SDM 介入';
            const alertColor = isNutrition ? 'var(--danger)' : 'var(--warning)';
            const alertBg = isNutrition ? 'rgba(217, 123, 123, 0.1)' : 'rgba(228, 185, 90, 0.1)';
            pendingHtml = `
                <div style="background: ${alertBg}; padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
                    <strong style="color: ${alertColor}; font-size: 12px;">${alertType}</strong>
                    <p style="margin: 4px 0 0; font-size: 12px; color: var(--text-secondary);">
                        體重下降 ${Math.abs(treatment.change_rate).toFixed(1)}%，尚未建立介入記錄
                    </p>
                    <div style="margin-top: 8px;">
                        <button class="btn btn-outline btn-sm" style="padding: 4px 10px; font-size: 12px; color: ${alertColor}; border-color: ${alertColor};"
                                onclick="Intervention.showAddForm(${treatment.id})">
                            新增介入
                        </button>
                    </div>
                </div>
            `;
        }
        
        // 暫停/終止原因提示
        let statusReasonHtml = '';
        if (treatment.status === 'paused' && treatment.pause_reason) {
            statusReasonHtml = `
                <div style="background: rgba(228, 185, 90, 0.1); padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
                    <strong style="color: var(--warning); font-size: 12px;">暫停原因</strong>
                    <p style="margin: 4px 0 0; font-size: 12px;">${treatment.pause_reason}</p>
                    <p style="margin: 2px 0 0; font-size: 11px; color: var(--text-hint);">
                        ${formatDate(treatment.paused_at, 'YYYY-MM-DD HH:mm')}
                    </p>
                </div>
            `;
        } else if (treatment.status === 'terminated' && treatment.terminate_reason) {
            statusReasonHtml = `
                <div style="background: rgba(217, 123, 123, 0.1); padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
                    <strong style="color: var(--danger); font-size: 12px;">終止原因</strong>
                    <p style="margin: 4px 0 0; font-size: 12px;">${treatment.terminate_reason}</p>
                    <p style="margin: 2px 0 0; font-size: 11px; color: var(--text-hint);">
                        ${formatDate(treatment.terminated_at, 'YYYY-MM-DD HH:mm')}
                    </p>
                </div>
            `;
        }
        
        // 最近體重記錄（顯示3筆）
        let weightsHtml = '';
        if (treatment.weight_records?.length > 0) {
            const recent = treatment.weight_records.slice(0, 3);
            weightsHtml = recent.map(r => {
                const weightDisplay = r.unable_to_measure 
                    ? '<span style="color: var(--text-hint);">無法測量</span>'
                    : `${r.weight} kg`;
                const rateDisplay = (!r.unable_to_measure && r.change_rate !== null)
                    ? `<span class="${getRateClass(r.change_rate)}" style="margin-left: 4px;">${formatChangeRate(r.change_rate)}</span>`
                    : '';
                return `
                    <div class="detail-row" style="font-size: 12px;">
                        <span>${formatDate(r.measure_date, 'MM/DD')}</span>
                        <span>
                            ${weightDisplay}
                            ${rateDisplay}
                        </span>
                    </div>
                `;
            }).join('');
        } else {
            weightsHtml = '<p style="color: var(--text-hint); font-size: 12px;">尚無體重記錄</p>';
        }
        
        // 體重趨勢圖（有基準體重且至少1筆記錄才顯示）
        let chartHtml = '';
        if (treatment.baseline_weight && treatment.weight_records?.length >= 1) {
            chartHtml = `
                <div class="detail-section">
                    <div class="detail-section-title" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>體重趨勢</span>
                        <span style="font-size: 11px; color: var(--text-hint); font-weight: normal;">點擊放大</span>
                    </div>
                    <div style="height: 120px; background: var(--bg); border-radius: 6px; padding: 6px; cursor: pointer;"
                         onclick="App.showChartEnlarged(${treatment.id})" title="點擊放大">
                        <canvas id="weight-trend-chart"></canvas>
                    </div>
                </div>
            `;
        }
        
        // 治療目的標籤
        const intentLabel = {
            'curative': '根治性',
            'palliative': '緩和性',
            'adjuvant': '輔助性',
            'neoadjuvant': '前導性'
        }[treatment.treatment_intent] || treatment.treatment_intent || '-';
        
        container.innerHTML = `
            <div class="detail-header">
                <div>
                    <div class="detail-title">${patient.medical_id} ${patient.name}</div>
                    <div class="detail-subtitle">
                        ${formatGender(patient.gender)} · ${age}歲 · ${treatment.cancer_type_label}
                        <span class="tag ${getStatusTagClass(treatment.status)}" style="margin-left: 6px; font-size: 11px;">
                            ${formatTreatmentStatus(treatment.status)}
                        </span>
                    </div>
                </div>
                <button class="btn-icon" onclick="Treatment.showEditForm(${treatment.id})" title="編輯療程">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
            </div>
            
            <div class="detail-actions">
                <div class="action-row">
                    <button class="btn btn-outline btn-sm" onclick="Weight.showForm(${treatment.id})">
                        記錄體重
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="SideEffect.showList(${treatment.id})">
                        副作用
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="Intervention.showList(${treatment.id})">
                        介入記錄
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="Satisfaction.showForm(${treatment.id})">
                        滿意度
                    </button>
                    <button class="btn btn-outline btn-sm" onclick="App.showQRMenu(${treatment.id})">
                        QR
                    </button>
                </div>
                ${treatment.status === 'active' ? `
                <div class="action-row">
                    <button class="btn btn-outline btn-sm btn-warning" onclick="Treatment.confirmPause(${treatment.id})">
                        暫停療程
                    </button>
                    <button class="btn btn-outline btn-sm btn-success" onclick="Treatment.confirmComplete(${treatment.id})">
                        完成結案
                    </button>
                    <button class="btn btn-outline btn-sm btn-danger" onclick="Treatment.confirmTerminate(${treatment.id})">
                        終止療程
                    </button>
                </div>
                ` : ''}
                ${treatment.status === 'paused' ? `
                <div class="action-row">
                    <button class="btn btn-outline btn-sm btn-success" onclick="Treatment.confirmResume(${treatment.id})">
                        恢復療程
                    </button>
                    <button class="btn btn-outline btn-sm btn-danger" onclick="Treatment.confirmTerminate(${treatment.id})">
                        終止療程
                    </button>
                </div>
                ` : ''}
            </div>
            
            ${pendingHtml}
            ${statusReasonHtml}
            
            <div class="detail-section">
                <div class="detail-section-title">基本資訊</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 13px;">
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>治療目的</span>
                        <span>${intentLabel}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>療程天數</span>
                        <span>${dayCount} 天</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>基準體重</span>
                        <span>${treatment.baseline_weight ? treatment.baseline_weight + ' kg' : '-'}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>目前體重</span>
                        <span>${treatment.latest_weight ? treatment.latest_weight.weight + ' kg' : '-'}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>體重變化</span>
                        <span class="${getRateClass(treatment.change_rate)}">${formatChangeRate(treatment.change_rate)}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>開始日期</span>
                        <span>${formatDate(treatment.treatment_start, 'YYYY-MM-DD')}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>體重記錄</span>
                        <span>${treatment.weight_records?.length || 0} 筆</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>副作用評估</span>
                        <span>${treatmentSE.length} 筆</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>介入記錄</span>
                        <span>${interventionStats.executed}/${interventionStats.total} 已執行</span>
                    </div>
                    ${treatment.radiation_dose ? `
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>放療劑量</span>
                        <span>${treatment.radiation_dose} Gy${treatment.radiation_fractions ? ` / ${treatment.radiation_fractions} 次` : ''}</span>
                    </div>
                    ` : ''}
                    ${patient.phone ? `
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>聯絡電話</span>
                        <span><a href="tel:${patient.phone}" style="color: var(--primary);">${patient.phone}</a></span>
                    </div>
                    ` : ''}
                </div>
                
                <!-- SDM 選擇 -->
                <div class="detail-row" style="padding: 6px 0; margin-top: 4px; border-top: 1px solid var(--border);">
                    <span style="font-size: 13px;">SDM 選擇</span>
                    <span style="display: flex; align-items: center; gap: 6px; font-size: 13px;">
                        ${treatment.sdm_choice ? `
                            <span class="tag tag-blue" style="font-size: 11px;">${formatSDMChoice(treatment.sdm_choice)}</span>
                            ${treatment.sdm_choice_date ? `<span style="font-size: 10px; color: var(--text-hint);">${formatDate(treatment.sdm_choice_date, 'MM/DD')}</span>` : ''}
                        ` : '<span style="color: var(--text-hint);">未選擇</span>'}
                        <button class="btn-icon" style="padding: 2px;" onclick="Intervention.showSDMComparison(${treatment.id})" title="編輯 SDM 選擇">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    </span>
                </div>
            </div>
            
            ${chartHtml}
            
            <div class="detail-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span class="detail-section-title" style="margin-bottom: 0;">體重記錄</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;"
                                onclick="SideEffect.showList(${treatment.id})">
                            副作用
                        </button>
                        <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;"
                                onclick="Weight.showList(${treatment.id})">
                            全部
                        </button>
                    </div>
                </div>
                ${weightsHtml}
            </div>
        `;
        
        // 渲染體重趨勢圖
        if (treatment.baseline_weight && treatment.weight_records?.length >= 1) {
            setTimeout(() => this.renderWeightTrendChart(treatment), 100);
        }
    },
    
    /**
     * 渲染體重趨勢圖
     */
    renderWeightTrendChart(treatment) {
        const ctx = document.getElementById('weight-trend-chart');
        if (!ctx) return;
        
        // 過濾掉無法測量的記錄，只取有效體重
        const validRecords = treatment.weight_records
            .filter(r => !r.unable_to_measure && r.weight)
            .slice(0, 15)
            .reverse();
        
        const baseline = treatment.baseline_weight;
        
        // 標籤與體重資料
        const labels = [];
        const weights = [];
        const dates = []; // 用於計算預測
        
        // 判斷起始點：
        // 如果第一筆有效體重 = 基準體重，表示療程開始時無法量測，
        // 則起始日期用該體重記錄的日期；否則用療程開始日期
        let baselineDate = treatment.treatment_start;
        let baselineIsFromRecord = false;
        
        if (baseline && validRecords.length > 0) {
            const firstRecord = validRecords[0];
            // 檢查第一筆記錄的體重是否等於基準體重（允許小誤差）
            if (Math.abs(firstRecord.weight - baseline) < 0.01) {
                // 基準體重來自體重記錄，使用該記錄日期
                baselineDate = firstRecord.measure_date;
                baselineIsFromRecord = true;
            }
        }
        
        // 第一個點：基準值
        if (baseline) {
            labels.push(formatDate(baselineDate, 'MM/DD'));
            weights.push(baseline);
            dates.push(new Date(baselineDate));
        }
        
        // 後續體重記錄（如果基準來自記錄，則跳過第一筆避免重複）
        const recordsToPlot = baselineIsFromRecord ? validRecords.slice(1) : validRecords;
        recordsToPlot.forEach(r => {
            labels.push(formatDate(r.measure_date, 'MM/DD'));
            weights.push(r.weight);
            dates.push(new Date(r.measure_date));
        });
        
        // 計算警示線
        const threshold3 = baseline ? baseline * 0.97 : null;  // -3%
        const threshold5 = baseline ? baseline * 0.95 : null;  // -5%
        
        // ===== 線性迴歸預測 =====
        let predictionData = null;
        let predictionLabels = [];
        let allLabels = [...labels];
        let predictionSlope = 0;
        
        // 需要至少 3 個數據點才進行預測
        if (weights.length >= 3) {
            const prediction = this.calculateWeightPrediction(dates, weights, 14); // 預測 14 天
            if (prediction) {
                predictionData = prediction.values;
                predictionLabels = prediction.labels;
                allLabels = [...labels, ...predictionLabels];
                predictionSlope = prediction.slope;
            }
        }
        
        const datasets = [
            {
                label: '體重',
                data: weights,
                borderColor: '#5B8FB9',
                backgroundColor: 'rgba(91, 143, 185, 0.1)',
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#5B8FB9',
                order: 1
            }
        ];
        
        // 加入預測虛線
        if (predictionData && predictionData.length > 0) {
            // 預測線從最後一個實際點開始
            const predictionWithStart = [...new Array(weights.length - 1).fill(null), weights[weights.length - 1], ...predictionData];
            
            // 判斷預測趨勢方向（比較最後實際體重與預測最終體重）
            const lastWeight = weights[weights.length - 1];
            const finalPredictedWeight = predictionData[predictionData.length - 1];
            const changePercent = ((finalPredictedWeight - lastWeight) / lastWeight) * 100;
            
            // 判斷標準：>1% 下降、±1% 持平、>1% 上升
            let trendLabel = '持平';
            if (changePercent < -1) {
                trendLabel = '下降';
            } else if (changePercent > 1) {
                trendLabel = '上升';
            }
            
            datasets.push({
                label: `預測趨勢（${trendLabel}）`,
                data: predictionWithStart,
                borderColor: '#9CA3AF',
                borderDash: [4, 4],
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                tension: 0,
                order: 0
            });
        }
        
        // 加入警示線（延伸到預測區間）
        if (threshold3) {
            datasets.push({
                label: '-3% (SDM)',
                data: allLabels.map(() => threshold3),
                borderColor: '#E4B95A',
                borderDash: [6, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                order: 2
            });
        }
        
        if (threshold5) {
            datasets.push({
                label: '-5% (營養)',
                data: allLabels.map(() => threshold5),
                borderColor: '#D97B7B',
                borderDash: [6, 4],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
                order: 3
            });
        }
        
        // 銷毀舊圖表
        if (this.weightChart) {
            this.weightChart.destroy();
        }
        
        this.weightChart = new Chart(ctx, {
            type: 'line',
            data: { labels: allLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { 
                            boxWidth: 12,
                            font: { size: 10 },
                            padding: 8
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                if (value === null) return null;
                                if (label === '體重') {
                                    return `${label}: ${value.toFixed(1)} kg`;
                                }
                                if (label === '預測趨勢') {
                                    return `${label}: ${value.toFixed(1)} kg`;
                                }
                                return `${label}: ${value.toFixed(1)} kg`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10 } }
                    },
                    y: {
                        beginAtZero: false,
                        grid: { color: '#E8ECF1' },
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    },
    
    /**
     * 計算體重預測（線性迴歸）
     * @param {Date[]} dates - 日期陣列
     * @param {number[]} weights - 體重陣列
     * @param {number} daysToPredict - 預測天數
     * @returns {Object|null} { values: 預測值陣列, labels: 日期標籤陣列 }
     */
    calculateWeightPrediction(dates, weights, daysToPredict = 14) {
        if (dates.length < 3 || weights.length < 3) return null;
        
        // 取最近 7 筆資料進行迴歸（或全部如果不足 7 筆）
        const n = Math.min(7, dates.length);
        const recentDates = dates.slice(-n);
        const recentWeights = weights.slice(-n);
        
        // 將日期轉換為數值（從第一天開始的天數）
        const startDate = recentDates[0];
        const x = recentDates.map(d => (d - startDate) / (1000 * 60 * 60 * 24));
        const y = recentWeights;
        
        // 計算線性迴歸 y = mx + b
        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
        const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
        
        const m = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const b = (sumY - m * sumX) / n;
        
        // 如果斜率太小（幾乎持平），不顯示預測線
        if (Math.abs(m) < 0.01) return null;
        
        // 生成預測點（每 7 天一個點）
        const lastDate = dates[dates.length - 1];
        const lastX = (lastDate - startDate) / (1000 * 60 * 60 * 24);
        
        const predictionValues = [];
        const predictionLabels = [];
        
        // 預測 2 週，每週一個點
        for (let d = 7; d <= daysToPredict; d += 7) {
            const futureX = lastX + d;
            const predictedWeight = m * futureX + b;
            
            // 限制預測範圍（不超過 ±20%）
            const avgWeight = y.reduce((a, b) => a + b, 0) / y.length;
            if (predictedWeight < avgWeight * 0.8 || predictedWeight > avgWeight * 1.2) {
                break;
            }
            
            predictionValues.push(Math.round(predictedWeight * 10) / 10);
            
            // 生成日期標籤
            const futureDate = new Date(lastDate);
            futureDate.setDate(futureDate.getDate() + d);
            predictionLabels.push(formatDate(futureDate.toISOString().split('T')[0], 'MM/DD'));
        }
        
        if (predictionValues.length === 0) return null;
        
        return {
            values: predictionValues,
            labels: predictionLabels,
            slope: m,  // 每日變化量
            intercept: b
        };
    },
    
    /**
     * 顯示放大的體重趨勢圖
     */
    async showChartEnlarged(treatmentId) {
        const treatment = await Treatment.getWithDetails(treatmentId);
        if (!treatment) return;
        
        const patient = await Patient.getById(treatment.patient_id);
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
            </div>
            <div style="height: 350px; background: var(--bg); border-radius: 8px; padding: 12px;">
                <canvas id="enlarged-trend-chart"></canvas>
            </div>
        `;
        
        openModal('體重趨勢圖', html, [
            { text: '關閉', class: 'btn-outline' }
        ]);
        
        // 等待 modal 渲染完成
        setTimeout(() => {
            this.renderEnlargedChart(treatment);
        }, 100);
    },
    
    /**
     * 渲染放大版體重趨勢圖
     */
    renderEnlargedChart(treatment) {
        const ctx = document.getElementById('enlarged-trend-chart');
        if (!ctx) return;
        
        // 過濾掉無法測量的記錄，只取有效體重
        const validRecords = treatment.weight_records
            .filter(r => !r.unable_to_measure && r.weight)
            .slice(0, 30)  // 放大版顯示更多資料
            .reverse();
        
        const baseline = treatment.baseline_weight;
        
        // 標籤與體重資料
        const labels = [];
        const weights = [];
        const dates = [];
        
        // 判斷起始點
        let baselineDate = treatment.treatment_start;
        let baselineIsFromRecord = false;
        
        if (baseline && validRecords.length > 0) {
            const firstRecord = validRecords[0];
            if (Math.abs(firstRecord.weight - baseline) < 0.01) {
                baselineDate = firstRecord.measure_date;
                baselineIsFromRecord = true;
            }
        }
        
        // 第一個點：基準值
        if (baseline) {
            labels.push(formatDate(baselineDate, 'MM/DD'));
            weights.push(baseline);
            dates.push(new Date(baselineDate));
        }
        
        // 後續體重記錄
        const recordsToPlot = baselineIsFromRecord ? validRecords.slice(1) : validRecords;
        recordsToPlot.forEach(r => {
            labels.push(formatDate(r.measure_date, 'MM/DD'));
            weights.push(r.weight);
            dates.push(new Date(r.measure_date));
        });
        
        // 計算警示線
        const threshold3 = baseline ? baseline * 0.97 : null;
        const threshold5 = baseline ? baseline * 0.95 : null;
        
        // ===== 線性迴歸預測 =====
        let predictionData = null;
        let predictionLabels = [];
        let allLabels = [...labels];
        let predictionSlope = 0;
        
        if (weights.length >= 3) {
            const prediction = this.calculateWeightPrediction(dates, weights, 14);
            if (prediction) {
                predictionData = prediction.values;
                predictionLabels = prediction.labels;
                allLabels = [...labels, ...predictionLabels];
                predictionSlope = prediction.slope;
            }
        }
        
        const datasets = [
            {
                label: '體重 (kg)',
                data: weights,
                borderColor: '#5B8FB9',
                backgroundColor: 'rgba(91, 143, 185, 0.15)',
                fill: true,
                tension: 0.3,
                pointRadius: 5,
                pointBackgroundColor: '#5B8FB9',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                order: 1
            }
        ];
        
        // 加入預測虛線
        if (predictionData && predictionData.length > 0) {
            const predictionWithStart = [...new Array(weights.length - 1).fill(null), weights[weights.length - 1], ...predictionData];
            
            // 比較最後實際體重與預測最終體重
            const lastWeight = weights[weights.length - 1];
            const finalPredictedWeight = predictionData[predictionData.length - 1];
            const changePercent = ((finalPredictedWeight - lastWeight) / lastWeight) * 100;
            
            let predictionColor = '#9CA3AF';
            let trendText = '持平';
            if (changePercent < -1) {
                predictionColor = '#D97B7B';
                trendText = '下降';
            } else if (changePercent > 1) {
                predictionColor = '#6BBF8A';
                trendText = '上升';
            }
            
            datasets.push({
                label: `預測趨勢 (${trendText})`,
                data: predictionWithStart,
                borderColor: predictionColor,
                borderDash: [5, 5],
                borderWidth: 2.5,
                pointRadius: 3,
                pointBackgroundColor: predictionColor,
                fill: false,
                tension: 0,
                order: 0
            });
        }
        
        if (threshold3) {
            datasets.push({
                label: `-3% SDM (${threshold3.toFixed(1)} kg)`,
                data: allLabels.map(() => threshold3),
                borderColor: '#E4B95A',
                borderDash: [8, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 2
            });
        }
        
        if (threshold5) {
            datasets.push({
                label: `-5% 營養師 (${threshold5.toFixed(1)} kg)`,
                data: allLabels.map(() => threshold5),
                borderColor: '#D97B7B',
                borderDash: [8, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false,
                order: 3
            });
        }
        
        new Chart(ctx, {
            type: 'line',
            data: { labels: allLabels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { 
                            boxWidth: 16,
                            font: { size: 12 },
                            padding: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleFont: { size: 13 },
                        bodyFont: { size: 12 },
                        padding: 10,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y;
                                if (value === null) return null;
                                if (label.includes('體重')) {
                                    // 計算與基準的變化
                                    if (baseline) {
                                        const change = ((value - baseline) / baseline * 100);
                                        return `體重: ${value.toFixed(1)} kg (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`;
                                    }
                                    return `體重: ${value.toFixed(1)} kg`;
                                }
                                if (label.includes('預測')) {
                                    if (baseline) {
                                        const change = ((value - baseline) / baseline * 100);
                                        return `預測: ${value.toFixed(1)} kg (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`;
                                    }
                                    return `預測: ${value.toFixed(1)} kg`;
                                }
                                return `${label}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { 
                            font: { size: 11 },
                            maxRotation: 45
                        }
                    },
                    y: {
                        beginAtZero: false,
                        grid: { color: '#E8ECF1' },
                        ticks: { 
                            font: { size: 11 },
                            callback: function(value) {
                                return value.toFixed(1) + ' kg';
                            }
                        }
                    }
                }
            }
        });
    },
    
    /**
     * 顯示 QR Code 選單
     */
    async showQRMenu(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        
        const html = `
            <div style="text-align: center;">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                </div>
                
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <button class="btn btn-primary" onclick="closeModal(); App.showPatientQRCode(${treatmentId})">
                        產生 QR Code 給病人
                        <div style="font-size: 12px; font-weight: normal; margin-top: 4px; opacity: 0.8;">
                            讓病人掃描後可在手機記錄體重
                        </div>
                    </button>
                    
                    <button class="btn btn-outline" onclick="closeModal(); App.showImportPatientWeight(${treatmentId})">
                        掃描病人回傳的 QR Code
                        <div style="font-size: 12px; font-weight: normal; margin-top: 4px; opacity: 0.8;">
                            匯入病人在手機記錄的體重資料
                        </div>
                    </button>
                </div>
            </div>
        `;
        
        openModal('QR Code 功能', html, [
            { text: '取消', class: 'btn-outline' }
        ]);
    },
    
    /**
     * 顯示病人填報 QR Code
     */
    async showPatientQRCode(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const patientAppUrl = await Settings.get('patient_app_url', '');
        
        // 取得既有的體重記錄
        const weightRecords = await Weight.getByTreatment(treatmentId);
        
        // 將體重記錄轉為精簡格式 MMDD:體重
        const recordsStr = weightRecords
            .filter(r => r.weight) // 過濾無法量測的
            .sort((a, b) => new Date(a.measure_date) - new Date(b.measure_date))
            .slice(-45) // 最多45筆
            .map(r => {
                const d = new Date(r.measure_date);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                return `${mm}${dd}:${r.weight}`;
            })
            .join(',');
        
        // 準備 QR Code 資料（精簡格式）
        // 格式：I|病歷號|姓名|開始日期|基準體重|既有記錄
        let data = `I|${patient.medical_id}|${patient.name}|${treatment.treatment_start}|${treatment.baseline_weight || 0}`;
        if (recordsStr) {
            data += `|${recordsStr}`;
        }
        
        // 如果有設定網址，QR Code 包含完整 URL；否則只包含資料
        let qrContent;
        if (patientAppUrl) {
            // 有設定網址：QR Code 包含完整 URL，掃描後直接開啟
            qrContent = `${patientAppUrl}?d=${encodeURIComponent(data)}`;
        } else {
            // 沒有設定網址：QR Code 只包含資料
            qrContent = data;
        }
        
        const recordInfo = weightRecords.length > 0 
            ? `<p style="color: var(--text-secondary); font-size: 12px; margin-top: 8px;">含 ${weightRecords.length} 筆既有體重記錄</p>`
            : '';
        
        const html = `
            <div style="text-align: center;">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                    ${recordInfo}
                </div>
                <div id="patient-qr-container" style="background: white; padding: 16px; border-radius: 8px; display: inline-block; min-width: 200px; min-height: 200px;">
                </div>
                ${patientAppUrl ? `
                    <p style="color: var(--success); font-size: 13px; margin-top: 12px;">
                        V 掃描後會自動開啟填報網頁
                    </p>
                ` : `
                    <p style="color: var(--warning); font-size: 13px; margin-top: 12px;">
                        尚未設定病人端網址
                    </p>
                    <p style="color: var(--text-hint); font-size: 12px;">
                        請到設定 - 病人端 填入網址
                    </p>
                `}
            </div>
        `;
        
        openModal('病人填報 QR Code', html, [
            { 
                text: '列印', 
                class: 'btn-outline',
                closeOnClick: false,
                onClick: () => this.printPatientQRCode(patient, qrContent)
            },
            { text: '關閉', class: 'btn-primary' }
        ]);
        
        // 使用 qrcodejs 庫生成 QR Code
        setTimeout(() => {
            const container = document.getElementById('patient-qr-container');
            
            if (!container) {
                console.error('找不到 QR Code 容器');
                return;
            }
            
            // 清空容器
            container.innerHTML = '';
            
            // 檢查 QRCode 庫是否載入
            if (typeof QRCode !== 'undefined') {
                try {
                    new QRCode(container, {
                        text: qrContent,
                        width: 200,
                        height: 200,
                        colorDark: '#000000',
                        colorLight: '#ffffff',
                        correctLevel: QRCode.CorrectLevel.L
                    });
                    console.log('QR Code 生成成功');
                } catch (error) {
                    console.error('QR Code 生成失敗:', error);
                    // 回退到外部 API
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`;
                    container.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="display: block; width: 200px; height: 200px;">`;
                }
            } else {
                console.warn('QRCode 庫未載入，使用外部 API');
                const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`;
                container.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="display: block; width: 200px; height: 200px;">`;
            }
        }, 200);
    },
    
    /**
     * 列印病人 QR Code
     */
    printPatientQRCode(patient, qrContent) {
        // 使用外部 API 生成 QR Code URL 用於列印
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrContent)}`;
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>體重追蹤 QR Code - ${patient.name}</title>
                <style>
                    body { 
                        font-family: sans-serif; 
                        text-align: center; 
                        padding: 40px;
                    }
                    .title { font-size: 24px; margin-bottom: 20px; }
                    .patient-info { font-size: 18px; margin-bottom: 30px; }
                    .qr-code { margin-bottom: 30px; }
                    .qr-code img, .qr-code canvas { width: 250px; height: 250px; }
                    .instructions { 
                        font-size: 14px; 
                        color: #666; 
                        border: 1px solid #ddd;
                        padding: 15px;
                        border-radius: 8px;
                        max-width: 300px;
                        margin: 0 auto;
                    }
                    @media print {
                        body { padding: 20px; }
                    }
                </style>
                <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
            </head>
            <body>
                <div class="title">體重追蹤</div>
                <div class="patient-info">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                </div>
                <div class="qr-code">
                    <canvas id="print-qr-canvas"></canvas>
                </div>
                <div class="instructions">
                    <strong>使用說明</strong><br><br>
                    1. 用手機相機掃描 QR Code<br>
                    2. 開啟網頁後記錄體重<br>
                    3. 回診時出示 QR Code 給醫護人員
                </div>
                <script>
                    const canvas = document.getElementById('print-qr-canvas');
                    QRCode.toCanvas(canvas, ${JSON.stringify(qrContent)}, {
                        width: 250,
                        margin: 2,
                        errorCorrectionLevel: 'M'
                    }, function(error) {
                        if (error) {
                            // 回退到圖片
                            document.querySelector('.qr-code').innerHTML = '<img src="${qrUrl}" alt="QR Code">';
                        }
                        setTimeout(function() { window.print(); }, 500);
                    });
                <\/script>
            </body>
            </html>
        `);
        printWindow.document.close();
    },
    
    /**
     * 顯示匯入病人體重對話框
     */
    async showImportPatientWeight(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
            </div>
            
            <div style="margin-bottom: 20px;">
                <div style="font-weight: 500; margin-bottom: 8px;">方式一：條碼槍掃描</div>
                <input type="text" id="barcode-input" class="form-input" 
                       placeholder="游標在此，直接掃描病人 QR Code"
                       style="text-align: center;"
                       autofocus>
                <p style="color: var(--text-hint); font-size: 12px; margin-top: 4px;">
                    掃描後會自動處理
                </p>
            </div>
            
            <div style="text-align: center; color: var(--text-hint); margin: 16px 0;">
                ─────── 或 ───────
            </div>
            
            <div style="text-align: center;">
                <button class="btn btn-outline" onclick="App.startCameraScan(${treatmentId})">
                    📷 開啟相機掃描
                </button>
            </div>
            
            <div id="camera-scan-container" style="display: none; margin-top: 16px;">
                <div id="qr-reader" style="width: 100%;"></div>
            </div>
        `;
        
        openModal('匯入病人體重記錄', html, [
            { text: '取消', class: 'btn-outline' }
        ]);
        
        // 監聽條碼槍輸入
        setTimeout(() => {
            const input = document.getElementById('barcode-input');
            if (input) {
                input.focus();
                
                let buffer = '';
                let timeout = null;
                
                input.addEventListener('input', (e) => {
                    buffer = e.target.value;
                    
                    // 清除之前的 timeout
                    if (timeout) clearTimeout(timeout);
                    
                    // 設定 timeout，條碼槍掃描通常很快完成
                    timeout = setTimeout(() => {
                        // 檢查是否為有效格式（新格式 S|... 或舊格式 JSON）
                        if (buffer && (buffer.startsWith('S|') || (buffer.includes('{') && buffer.includes('}')))) {
                            this.processPatientQRData(buffer, treatmentId);
                        }
                    }, 300);
                });
            }
        }, 100);
    },
    
    /**
     * 開啟相機掃描
     */
    async startCameraScan(treatmentId) {
        const container = document.getElementById('camera-scan-container');
        const readerDiv = document.getElementById('qr-reader');
        
        if (!container || !readerDiv) return;
        
        container.style.display = 'block';
        
        // 停止之前的掃描器
        if (this.qrScanner) {
            try {
                await this.qrScanner.stop();
            } catch (e) {}
        }
        
        try {
            this.qrScanner = new Html5Qrcode('qr-reader');
            
            await this.qrScanner.start(
                { facingMode: 'environment' },
                { fps: 10, qrbox: { width: 200, height: 200 } },
                (decodedText) => {
                    this.stopCameraScan();
                    this.processPatientQRData(decodedText, treatmentId);
                },
                () => {}
            );
        } catch (e) {
            console.error('相機啟動失敗', e);
            showToast('無法啟動相機', 'error');
            container.style.display = 'none';
        }
    },
    
    /**
     * 停止相機掃描
     */
    async stopCameraScan() {
        if (this.qrScanner) {
            try {
                await this.qrScanner.stop();
                this.qrScanner.clear();
            } catch (e) {}
            this.qrScanner = null;
        }
    },
    
    /**
     * 處理病人 QR Code 資料
     */
    async processPatientQRData(text, treatmentId) {
        try {
            let pid, ts, weightRecords = [], assessmentRecords = [];
            
            // 檢查是否為新的精簡格式：S|病歷號|療程開始|體重資料|副作用資料
            if (text.startsWith('S|')) {
                const parts = text.split('|');
                if (parts.length >= 4) {
                    pid = parts[1];
                    ts = parts[2];
                    
                    // 解析體重記錄 (parts[3])
                    const weightStr = parts[3];
                    if (weightStr) {
                        weightRecords = weightStr.split(',').map(r => {
                            const [mmdd, weight] = r.split(':');
                            return { mmdd, weight: parseFloat(weight) };
                        }).filter(r => r.weight);
                    }
                    
                    // 解析副作用評估 (parts[4])
                    // 格式：MMDD:症狀碼嚴重度,...
                    // 例如：0301:N1F2P1,0305:N2F3
                    const assessmentStr = parts[4];
                    if (assessmentStr) {
                        const symptomNames = {
                            'N': '噁心嘔吐', 'F': '疲勞', 'O': '口腔黏膜炎', 'S': '皮膚反應',
                            'W': '吞嚥困難', 'A': '食慾下降', 'D': '腹瀉', 'P': '疼痛'
                        };
                        const severityNames = ['無', '輕微', '中等', '嚴重'];
                        
                        assessmentRecords = assessmentStr.split(',').map(r => {
                            const [mmdd, symptoms] = r.split(':');
                            if (!mmdd || !symptoms) return null;
                            
                            // 解析症狀碼：N1F2P1 -> [{code:'N',level:1}, ...]
                            const parsedSymptoms = [];
                            for (let i = 0; i < symptoms.length; i += 2) {
                                const code = symptoms[i];
                                const level = parseInt(symptoms[i + 1]) || 0;
                                if (code && level > 0) {
                                    parsedSymptoms.push({
                                        code,
                                        name: symptomNames[code] || code,
                                        level,
                                        levelName: severityNames[level] || level
                                    });
                                }
                            }
                            
                            return { mmdd, symptoms: parsedSymptoms };
                        }).filter(Boolean);
                    }
                } else {
                    showToast('QR Code 格式不正確', 'error');
                    return;
                }
            } else {
                // 舊的 JSON 格式（向後相容）
                const data = JSON.parse(text);
                if (data.v !== 1 || data.t !== 'sync') {
                    showToast('QR Code 格式不正確', 'error');
                    return;
                }
                pid = data.pid;
                ts = data.ts;
                weightRecords = (data.r || []).map(([mmdd, weight]) => ({ mmdd, weight }));
            }
            
            const treatment = await Treatment.getById(treatmentId);
            const patient = await Patient.getById(treatment.patient_id);
            
            // 驗證病歷號
            if (pid !== patient.medical_id) {
                showToast(`病歷號不符！預期 ${patient.medical_id}，實際 ${pid}`, 'error');
                return;
            }
            
            // 驗證療程開始日期
            if (ts !== treatment.treatment_start) {
                showToast('療程資料不符，可能是舊的填報', 'error');
                return;
            }
            
            // 取得現有體重記錄
            const existingWeights = await Weight.getByTreatment(treatmentId);
            const existingDates = new Set(existingWeights.map(w => w.measure_date));
            
            // 匯入體重記錄
            let weightAdded = 0;
            let weightSkipped = 0;
            const currentYear = new Date().getFullYear();
            
            for (const { mmdd, weight } of weightRecords) {
                const mm = mmdd.substring(0, 2);
                const dd = mmdd.substring(2, 4);
                const measureDate = `${currentYear}-${mm}-${dd}`;
                
                if (existingDates.has(measureDate)) {
                    weightSkipped++;
                    continue;
                }
                
                await Weight.create(treatmentId, weight, measureDate);
                weightAdded++;
                existingDates.add(measureDate);
            }
            
            // 匯入副作用評估到 side_effects 資料表
            let assessmentAdded = 0;
            let assessmentSkipped = 0;
            
            // 取得現有副作用評估
            const existingSideEffects = await SideEffect.getByTreatment(treatmentId);
            const existingAssessDates = new Set(existingSideEffects.map(s => s.assess_date));
            
            for (const { mmdd, symptoms } of assessmentRecords) {
                const mm = mmdd.substring(0, 2);
                const dd = mmdd.substring(2, 4);
                const assessDate = `${currentYear}-${mm}-${dd}`;
                
                // 檢查是否已存在
                if (existingAssessDates.has(assessDate)) {
                    assessmentSkipped++;
                    continue;
                }
                
                // 轉換格式並儲存
                const symptomData = symptoms.map(s => ({
                    code: s.code,
                    level: s.level
                }));
                
                await SideEffect.create(treatmentId, assessDate, symptomData);
                assessmentAdded++;
                existingAssessDates.add(assessDate);
            }
            
            closeModal();
            
            // 顯示結果
            const resultHtml = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 24px; margin-bottom: 12px; color: var(--success);">[OK]</div>
                    <h3 style="margin-bottom: 16px;">匯入成功</h3>
                    <div style="background: var(--bg); padding: 16px; border-radius: 8px;">
                        <div class="detail-row">
                            <span>病人</span>
                            <span><strong>${patient.name}</strong></span>
                        </div>
                        <div class="detail-row">
                            <span>體重新增</span>
                            <span><strong>${weightAdded}</strong> 筆</span>
                        </div>
                        ${weightSkipped > 0 ? `
                        <div class="detail-row">
                            <span>體重跳過（已存在）</span>
                            <span>${weightSkipped} 筆</span>
                        </div>
                        ` : ''}
                        ${assessmentRecords.length > 0 ? `
                        <div class="detail-row">
                            <span>副作用評估新增</span>
                            <span><strong>${assessmentAdded}</strong> 筆</span>
                        </div>
                        ${assessmentSkipped > 0 ? `
                        <div class="detail-row">
                            <span>副作用跳過（已存在）</span>
                            <span>${assessmentSkipped} 筆</span>
                        </div>
                        ` : ''}
                        ` : ''}
                    </div>
                </div>
            `;
            
            openModal('匯入結果', resultHtml, [
                { text: '確定', class: 'btn-primary' }
            ]);
            
            // 重新整理
            this.refresh();
            
        } catch (e) {
            console.error('處理失敗', e);
            showToast('QR Code 解析失敗: ' + e.message, 'error');
        }
    }
};

// 啟動應用程式
// 由登入驗證成功後調用 App.init()
// document.addEventListener('DOMContentLoaded', () => App.init());
