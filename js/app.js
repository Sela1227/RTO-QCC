/**
 * 彰濱放腫體重監控預防系統 - 主程式
 * v3.3 Web 版
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
            
            // 載入首頁
            await this.refresh();
            
            console.log('彰濱放腫體重監控預防系統已啟動');
        } catch (e) {
            console.error('初始化失敗:', e);
            showToast('系統初始化失敗', 'error');
        }
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
        
        const results = await Patient.search(keyword);
        this.patientSearchKeyword = keyword;
        
        // 顯示清除按鈕
        document.getElementById('btn-patient-search-clear').style.display = 'inline-flex';
        
        // 渲染搜尋結果
        await this.renderPatientSearchResults(results, keyword);
    },
    
    /**
     * 清除病人搜尋
     */
    async clearPatientSearch() {
        document.getElementById('patient-search-input').value = '';
        document.getElementById('btn-patient-search-clear').style.display = 'none';
        this.patientSearchKeyword = null;
        await renderPatientList();
    },
    
    /**
     * 渲染病人搜尋結果
     */
    async renderPatientSearchResults(results, keyword) {
        const container = document.getElementById('patient-list');
        
        if (results.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 60px;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <p>找不到符合「${keyword}」的病人</p>
                    <button class="btn btn-primary" onclick="Patient.showForm()">新增病人</button>
                </div>
            `;
            return;
        }
        
        let html = `
            <div style="margin-bottom: 12px; color: var(--text-secondary);">
                找到 ${results.length} 筆符合「${keyword}」的結果
            </div>
            <table class="patient-table">
                <thead>
                    <tr>
                        <th>病歷號</th>
                        <th>姓名</th>
                        <th>性別</th>
                        <th>年齡</th>
                        <th>療程數</th>
                        <th>目前狀態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const p of results) {
            const treatments = await Treatment.getByPatient(p.id);
            const activeTreatment = treatments.find(t => t.status === 'active');
            const ongoingTreatment = treatments.find(t => t.status === 'active' || t.status === 'paused');
            const age = calculateAge(p.birth_date);
            
            let statusHtml = '<span class="tag tag-gray">無療程</span>';
            if (activeTreatment) {
                statusHtml = '<span class="tag tag-blue">治療中</span>';
            } else if (ongoingTreatment) {
                statusHtml = '<span class="tag tag-amber">暫停中</span>';
            } else if (treatments.length > 0) {
                statusHtml = '<span class="tag tag-green">已結案</span>';
            }
            
            html += `
                <tr>
                    <td><strong>${p.medical_id}</strong></td>
                    <td>${p.name}</td>
                    <td>${formatGender(p.gender)}</td>
                    <td>${age ? age + '歲' : '-'}</td>
                    <td>${treatments.length}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;" 
                                onclick="showPatientDetail(${p.id})">
                            查看
                        </button>
                    </td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        container.innerHTML = html;
    },
    
    /**
     * 渲染追蹤頁面
     */
    async renderTracking() {
        const listContainer = document.getElementById('tracking-list');
        const detailContainer = document.getElementById('tracking-detail');
        
        // 取得療程列表
        let treatments = [];
        if (this.currentTrackingTab === 'active') {
            treatments = await Treatment.getActive();
        } else {
            treatments = await Treatment.getPaused();
        }
        
        // 根據篩選條件過濾
        if (this.trackingFilter === 'pending') {
            treatments = treatments.filter(t => t.pending_interventions?.length > 0);
        } else if (this.trackingFilter === 'overdue') {
            treatments = treatments.filter(t => t.tracking_status?.status === 'overdue');
        }
        
        // 清除篩選狀態（只用一次）
        const currentFilter = this.trackingFilter;
        this.trackingFilter = null;
        
        // 顯示篩選提示
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
            listContainer.innerHTML = `
                ${filterNotice}
                <div class="empty-state" style="width: 100%;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <path d="M16 16s-1.5-2-4-2-4 2-4 2"></path>
                        <line x1="9" y1="9" x2="9.01" y2="9"></line>
                        <line x1="15" y1="9" x2="15.01" y2="9"></line>
                    </svg>
                    <p>目前沒有${this.currentTrackingTab === 'active' ? '治療中' : '暫停中'}的病人</p>
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
            
            let cardClass = 'patient-card';
            if (isSelected) cardClass += ' active';
            if (hasPending) cardClass += ' alert-warning';
            if (t.tracking_status?.class === 'red') cardClass += ' alert-danger';
            
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
                    <div class="detail-section-title">體重趨勢</div>
                    <div style="height: 120px; background: var(--bg); border-radius: 6px; padding: 6px;">
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
                    <button class="btn btn-outline" style="padding: 2px 6px; font-size: 11px;"
                            onclick="Weight.showList(${treatment.id})">
                        全部
                    </button>
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
    }
};

// 啟動應用程式
document.addEventListener('DOMContentLoaded', () => App.init());
