/**
 * 彰濱放腫體重監控預防系統 - 主程式
 * v5.9.1 Web 版
 */

const App = {
    currentPage: 'home',
    currentTrackingTab: 'active',
    selectedTreatmentId: null,
    trackingFilter: null,
    weightChart: null,  // 體重趨勢圖實例
    patientSearchKeyword: null,  // 病人搜尋關鍵字
    
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
            
            // 檢查備份狀態（暫時關閉強制備份）
            // await this.checkBackupStatus();
            
            // 載入首頁
            await this.refresh();
            
            console.log('彰濱放腫體重監控預防系統已啟動');
        } catch (e) {
            console.error('初始化失敗:', e);
            showToast('系統初始化失敗', 'error');
        }
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
                <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
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
        document.getElementById('btn-patient-search').onclick = () => this.searchPatients();
        document.getElementById('patient-search-input').onkeypress = (e) => {
            if (e.key === 'Enter') this.searchPatients();
        };
        document.getElementById('btn-patient-search-clear').onclick = () => this.clearPatientSearch();
        
        // 統計卡片點擊
        document.querySelectorAll('.stat-card').forEach(card => {
            card.onclick = () => {
                const filter = card.dataset.filter;
                this.navigate('tracking');
                
                // 根據 filter 切換頁籤或篩選
                setTimeout(() => {
                    if (filter === 'active') {
                        // 切換到治療中頁籤
                        document.querySelectorAll('#page-tracking .tab').forEach(t => {
                            t.classList.toggle('active', t.dataset.tab === 'active');
                        });
                        this.currentTrackingTab = 'active';
                        this.renderTracking();
                    } else if (filter === 'paused') {
                        // 切換到暫停中頁籤
                        document.querySelectorAll('#page-tracking .tab').forEach(t => {
                            t.classList.toggle('active', t.dataset.tab === 'paused');
                        });
                        this.currentTrackingTab = 'paused';
                        this.renderTracking();
                    } else if (filter === 'pending' || filter === 'overdue') {
                        // 需處理或待輸體重，保持在治療中頁籤但標記篩選狀態
                        document.querySelectorAll('#page-tracking .tab').forEach(t => {
                            t.classList.toggle('active', t.dataset.tab === 'active');
                        });
                        this.currentTrackingTab = 'active';
                        this.trackingFilter = filter;
                        this.renderTracking();
                    }
                }, 100);
            };
        });
        
        // 追蹤頁籤
        document.querySelectorAll('#page-tracking .tab').forEach(tab => {
            tab.onclick = () => {
                document.querySelectorAll('#page-tracking .tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTrackingTab = tab.dataset.tab;
                this.renderTracking();
            };
        });
        
        // 匯出 Excel
        document.getElementById('btn-export-excel').onclick = () => Report.exportExcel();
        
        // 匯出 PDF
        document.getElementById('btn-export-pdf').onclick = () => Report.exportPdf();
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
                await renderPatientList();
                break;
            case 'reports':
                await Report.initFilters();
                await Report.render();
                break;
        }
    },
    
    /**
     * 更新統計數字
     */
    async updateStats() {
        const activeTreatments = await Treatment.getActive();
        const pausedTreatments = await Treatment.getPaused();
        const pendingInterventions = await Intervention.getPending();
        
        const overdueCount = activeTreatments.filter(t => 
            t.tracking_status?.status === 'overdue'
        ).length;
        
        document.getElementById('stat-active').textContent = activeTreatments.length;
        document.getElementById('stat-paused').textContent = pausedTreatments.length;
        document.getElementById('stat-pending').textContent = pendingInterventions.length;
        document.getElementById('stat-overdue').textContent = overdueCount;
        
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
        
        if (this.currentTrackingTab === 'active') {
            treatments = await Treatment.getActive();
            tabTitle = '治療中';
        } else if (this.currentTrackingTab === 'paused') {
            treatments = await Treatment.getPaused();
            tabTitle = '暫停中';
        } else if (this.currentTrackingTab === 'pending') {
            // 需處理：從治療中篩選有待處理介入的
            treatments = await Treatment.getActive();
            treatments = treatments.filter(t => t.pending_interventions?.length > 0);
            tabTitle = '需處理';
        } else if (this.currentTrackingTab === 'overdue') {
            // 待輸體重：從治療中篩選超過追蹤週期的
            treatments = await Treatment.getActive();
            treatments = treatments.filter(t => t.tracking_status?.status === 'overdue');
            tabTitle = '待輸體重';
        }
        
        // 如果是從儀表板來的篩選（相容舊邏輯）
        if (this.trackingFilter === 'pending') {
            treatments = treatments.filter(t => t.pending_interventions?.length > 0);
        } else if (this.trackingFilter === 'overdue') {
            treatments = treatments.filter(t => t.tracking_status?.status === 'overdue');
        }
        
        // 清除篩選狀態（只用一次）
        const currentFilter = this.trackingFilter;
        this.trackingFilter = null;
        
        // 顯示篩選提示（從儀表板來的）
        let filterNotice = '';
        if (currentFilter === 'pending') {
            filterNotice = `<div style="padding: 8px 12px; background: rgba(228, 185, 90, 0.1); border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: var(--warning);">
                顯示需處理的病人（${treatments.length} 人）
            </div>`;
        } else if (currentFilter === 'overdue') {
            filterNotice = `<div style="padding: 8px 12px; background: rgba(217, 123, 123, 0.1); border-radius: 8px; margin-bottom: 12px; font-size: 13px; color: var(--danger);">
                顯示待輸體重的病人（${treatments.length} 人）
            </div>`;
        }
        
        if (treatments.length === 0) {
            let emptyMsg = `目前沒有${tabTitle}的病人`;
            
            listContainer.innerHTML = `
                ${filterNotice}
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
        let cardsHtml = filterNotice;
        for (const t of treatments) {
            const rateClass = getRateClass(t.change_rate);
            const isSelected = t.id === this.selectedTreatmentId;
            const hasPending = t.pending_interventions?.length > 0;
            const isOverdue = t.tracking_status?.status === 'overdue';
            
            // 檢查介入類型
            const hasNutrition = t.pending_interventions?.some(i => i.type === 'nutrition');
            const hasSdm = t.pending_interventions?.some(i => i.type === 'sdm');
            
            let cardClass = 'patient-card';
            if (isSelected) cardClass += ' active';
            if (hasNutrition) {
                cardClass += ' alert-danger';  // 營養師用紅色
            } else if (hasSdm) {
                cardClass += ' alert-warning'; // SDM 用橘色
            }
            if (isOverdue) cardClass += ' alert-overdue';
            
            // 生成標籤
            let tagsHtml = '';
            if (hasPending || isOverdue) {
                tagsHtml = '<div class="patient-card-tags">';
                if (hasNutrition) {
                    tagsHtml += '<span class="tag tag-red" style="font-size: 10px; padding: 1px 5px;">需營養師</span>';
                } else if (hasSdm) {
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
        
        // 待處理介入
        let pendingHtml = '';
        if (treatment.pending_interventions?.length > 0) {
            pendingHtml = `
                <div style="background: rgba(228, 185, 90, 0.1); padding: 8px 10px; border-radius: 6px; margin-bottom: 10px;">
                    <strong style="color: var(--warning); font-size: 12px;">待處理介入</strong>
                    ${treatment.pending_interventions.map(i => `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
                            <span style="font-size: 12px;">${formatInterventionType(i.type)}</span>
                            <button class="btn btn-warning btn-sm" style="padding: 2px 8px; font-size: 11px;"
                                    onclick="Intervention.showExecuteForm(${i.id})">
                                執行
                            </button>
                        </div>
                    `).join('')}
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
            
            <div class="action-group" style="flex-wrap: wrap; margin-bottom: 10px; gap: 6px;">
                <button class="btn btn-primary btn-sm" onclick="Weight.showForm(${treatment.id})">
                    記錄體重
                </button>
                <button class="btn btn-outline btn-sm" onclick="SideEffect.showList(${treatment.id})">
                    📋 副作用
                </button>
                <button class="btn btn-outline btn-sm" onclick="App.showQRMenu(${treatment.id})" title="QR Code 功能">
                    📱 QR
                </button>
                <button class="btn btn-outline btn-sm" onclick="Intervention.showList(${treatment.id})">
                    介入記錄
                </button>
                ${treatment.status === 'active' ? `
                    <button class="btn btn-outline btn-sm" style="color: var(--warning); border-color: var(--warning);" 
                            onclick="Treatment.confirmPause(${treatment.id})">
                        暫停
                    </button>
                    <button class="btn btn-outline btn-sm" style="color: var(--success); border-color: var(--success);" 
                            onclick="Treatment.confirmComplete(${treatment.id})">
                        完成
                    </button>
                    <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" 
                            onclick="Treatment.confirmTerminate(${treatment.id})">
                        終止
                    </button>
                ` : ''}
                ${treatment.status === 'paused' ? `
                    <button class="btn btn-outline btn-sm" style="color: var(--success); border-color: var(--success);" 
                            onclick="Treatment.confirmResume(${treatment.id})">
                        恢復
                    </button>
                    <button class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" 
                            onclick="Treatment.confirmTerminate(${treatment.id})">
                        終止
                    </button>
                ` : ''}
            </div>
            
            ${pendingHtml}
            
            <div class="detail-section">
                <div class="detail-section-title">基本資訊</div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; font-size: 13px;">
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>基準</span>
                        <span>${treatment.baseline_weight ? treatment.baseline_weight + ' kg' : '-'}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>目前</span>
                        <span>${treatment.latest_weight ? treatment.latest_weight.weight + ' kg' : '-'}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>變化</span>
                        <span class="${getRateClass(treatment.change_rate)}">${formatChangeRate(treatment.change_rate)}</span>
                    </div>
                    <div class="detail-row" style="padding: 2px 0;">
                        <span>開始</span>
                        <span>${formatDate(treatment.treatment_start, 'MM/DD')}</span>
                    </div>
                </div>
            </div>
            
            ${chartHtml}
            
            <div class="detail-section">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span class="detail-section-title" style="margin-bottom: 0;">體重記錄</span>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn btn-outline" style="padding: 2px 8px; font-size: 11px;"
                                onclick="SideEffect.showList(${treatment.id})">
                            📋 副作用
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
        }
        
        // 後續體重記錄（如果基準來自記錄，則跳過第一筆避免重複）
        const recordsToPlot = baselineIsFromRecord ? validRecords.slice(1) : validRecords;
        recordsToPlot.forEach(r => {
            labels.push(formatDate(r.measure_date, 'MM/DD'));
            weights.push(r.weight);
        });
        
        // 計算警示線
        const threshold3 = baseline ? baseline * 0.97 : null;  // -3%
        const threshold5 = baseline ? baseline * 0.95 : null;  // -5%
        
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
        
        // 加入警示線
        if (threshold3) {
            datasets.push({
                label: '-3% (SDM)',
                data: labels.map(() => threshold3),
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
                data: labels.map(() => threshold5),
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
            data: { labels, datasets },
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
                                if (label === '體重') {
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
        }
        
        // 後續體重記錄
        const recordsToPlot = baselineIsFromRecord ? validRecords.slice(1) : validRecords;
        recordsToPlot.forEach(r => {
            labels.push(formatDate(r.measure_date, 'MM/DD'));
            weights.push(r.weight);
        });
        
        // 計算警示線
        const threshold3 = baseline ? baseline * 0.97 : null;
        const threshold5 = baseline ? baseline * 0.95 : null;
        
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
        
        if (threshold3) {
            datasets.push({
                label: `-3% SDM (${threshold3.toFixed(1)} kg)`,
                data: labels.map(() => threshold3),
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
                data: labels.map(() => threshold5),
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
            data: { labels, datasets },
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
                                if (label.includes('體重')) {
                                    // 計算與基準的變化
                                    if (baseline) {
                                        const change = ((value - baseline) / baseline * 100);
                                        return `體重: ${value.toFixed(1)} kg (${change >= 0 ? '+' : ''}${change.toFixed(1)}%)`;
                                    }
                                    return `體重: ${value.toFixed(1)} kg`;
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
                        📤 產生 QR Code 給病人
                        <div style="font-size: 12px; font-weight: normal; margin-top: 4px; opacity: 0.8;">
                            讓病人掃描後可在手機記錄體重
                        </div>
                    </button>
                    
                    <button class="btn btn-outline" onclick="closeModal(); App.showImportPatientWeight(${treatmentId})">
                        📥 掃描病人回傳的 QR Code
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
        
        // 使用 QR Server API 生成 QR Code
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrContent)}`;
        
        const recordInfo = weightRecords.length > 0 
            ? `<p style="color: var(--text-secondary); font-size: 12px; margin-top: 8px;">含 ${weightRecords.length} 筆既有體重記錄</p>`
            : '';
        
        const html = `
            <div style="text-align: center;">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                    ${recordInfo}
                </div>
                <div id="patient-qr-container" style="background: white; padding: 16px; border-radius: 8px; display: inline-block;">
                    <img src="${qrUrl}" alt="QR Code" style="display: block; width: 200px; height: 200px;">
                </div>
                ${patientAppUrl ? `
                    <p style="color: var(--success); font-size: 13px; margin-top: 12px;">
                        ✓ 掃描後會自動開啟填報網頁
                    </p>
                ` : `
                    <p style="color: var(--warning); font-size: 13px; margin-top: 12px;">
                        ⚠️ 尚未設定病人端網址
                    </p>
                    <p style="color: var(--text-hint); font-size: 12px;">
                        請到設定 → 病人端 填入網址
                    </p>
                `}
            </div>
        `;
        
        openModal('病人填報 QR Code', html, [
            { 
                text: '列印', 
                class: 'btn-outline',
                onClick: () => this.printPatientQRCode(patient, qrUrl)
            },
            { text: '關閉', class: 'btn-primary' }
        ]);
    },
    
    /**
     * 列印病人 QR Code
     */
    printPatientQRCode(patient, qrUrl) {
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
                    .qr-code img { width: 250px; height: 250px; }
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
            </head>
            <body>
                <div class="title">🏥 體重追蹤</div>
                <div class="patient-info">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                </div>
                <div class="qr-code">
                    <img src="${qrUrl}" alt="QR Code">
                </div>
                <div class="instructions">
                    <strong>使用說明</strong><br><br>
                    1. 用手機相機掃描 QR Code<br>
                    2. 開啟網頁後記錄體重<br>
                    3. 回診時出示 QR Code 給醫護人員
                </div>
            </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
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
                    <div style="font-size: 36px; margin-bottom: 12px;">✅</div>
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
