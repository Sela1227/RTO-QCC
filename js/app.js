/**
 * SELA 體重追蹤系統 - 主程式
 * v2.2 Web 版
 */

const App = {
    currentPage: 'home',
    currentTrackingTab: 'active',
    selectedTreatmentId: null,
    weightChart: null,  // 體重趨勢圖實例
    
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
            
            console.log('SELA 體重追蹤系統已啟動');
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
        
        // 首頁搜尋
        document.getElementById('btn-search').onclick = () => this.search();
        document.getElementById('search-input').onkeypress = (e) => {
            if (e.key === 'Enter') this.search();
        };
        
        // 新增病人按鈕
        document.getElementById('btn-new-patient').onclick = () => Patient.showForm();
        document.getElementById('btn-add-patient').onclick = () => Patient.showForm();
        
        // 統計卡片點擊
        document.querySelectorAll('.stat-card').forEach(card => {
            card.onclick = () => {
                const filter = card.dataset.filter;
                this.navigate('tracking');
                // TODO: 根據 filter 篩選
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
                await Report.render();
                break;
        }
    },
    
    /**
     * 更新統計數字
     */
    async updateStats() {
        const treatments = await Treatment.getActive();
        const pendingInterventions = await Intervention.getPending();
        
        const overdueCount = treatments.filter(t => 
            t.tracking_status?.status === 'overdue'
        ).length;
        
        document.getElementById('stat-active').textContent = treatments.length;
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
     * 搜尋病人
     */
    async search() {
        const keyword = document.getElementById('search-input').value.trim();
        if (!keyword) return;
        
        const results = await Patient.search(keyword);
        const container = document.getElementById('search-result');
        
        if (results.length === 0) {
            container.innerHTML = `
                <p style="color: var(--text-hint);">找不到符合的病人</p>
                <button class="btn btn-outline" onclick="Patient.showForm()">新增病人</button>
            `;
            return;
        }
        
        let html = '<div style="display: flex; flex-wrap: wrap; gap: 8px;">';
        
        for (const p of results) {
            const patientWithTreatments = await Patient.getWithTreatments(p.id);
            const hasOngoing = !!patientWithTreatments.ongoing_treatment;
            
            html += `
                <div class="patient-card" onclick="App.handleSearchResult(${p.id}, ${hasOngoing})">
                    <div class="patient-card-header">
                        <span class="patient-card-id">${p.medical_id}</span>
                    </div>
                    <div class="patient-card-name">${p.name}</div>
                    <div class="patient-card-info">
                        ${formatGender(p.gender)} · ${calculateAge(p.birth_date)}歲
                    </div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    },
    
    /**
     * 處理搜尋結果點擊
     */
    async handleSearchResult(patientId, hasOngoing) {
        const patient = await Patient.getWithTreatments(patientId);
        
        if (hasOngoing) {
            // 有進行中療程 → 顯示追蹤頁並選中
            this.selectedTreatmentId = patient.ongoing_treatment.id;
            this.navigate('tracking');
        } else {
            // 無進行中療程 → 詢問是否開新療程
            showPatientDetail(patientId);
        }
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
        
        if (treatments.length === 0) {
            listContainer.innerHTML = `
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
        let cardsHtml = '';
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
                <div style="background: rgba(228, 185, 90, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong style="color: var(--warning);">待處理介入</strong>
                    ${treatment.pending_interventions.map(i => `
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px;">
                            <span>${formatInterventionType(i.type)}</span>
                            <button class="btn btn-warning" style="padding: 4px 12px; font-size: 12px;"
                                    onclick="Intervention.showExecuteForm(${i.id})">
                                執行
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        }
        
        // 最近體重記錄
        let weightsHtml = '';
        if (treatment.weight_records?.length > 0) {
            const recent = treatment.weight_records.slice(0, 5);
            weightsHtml = recent.map(r => `
                <div class="detail-row">
                    <span>${formatDate(r.measure_date, 'MM/DD')}</span>
                    <span>
                        ${r.weight} kg
                        ${r.change_rate !== null ? 
                            `<span class="${getRateClass(r.change_rate)}" style="margin-left: 4px;">${formatChangeRate(r.change_rate)}</span>` 
                            : ''}
                    </span>
                </div>
            `).join('');
        } else {
            weightsHtml = '<p style="color: var(--text-hint);">尚無體重記錄</p>';
        }
        
        // 體重趨勢圖（有基準體重且至少1筆記錄才顯示）
        let chartHtml = '';
        if (treatment.baseline_weight && treatment.weight_records?.length >= 1) {
            chartHtml = `
                <div class="detail-section">
                    <div class="detail-section-title">體重趨勢</div>
                    <div style="height: 200px; background: var(--bg); border-radius: 8px; padding: 8px;">
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
                        <span class="tag ${getStatusTagClass(treatment.status)}" style="margin-left: 8px;">
                            ${formatTreatmentStatus(treatment.status)}
                        </span>
                    </div>
                </div>
                <div style="display: flex; gap: 4px;">
                    <button class="btn-icon" onclick="Treatment.showEditForm(${treatment.id})" title="編輯療程">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-icon" onclick="Treatment.showActions(${treatment.id})" title="療程操作">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="1"></circle>
                            <circle cx="19" cy="12" r="1"></circle>
                            <circle cx="5" cy="12" r="1"></circle>
                        </svg>
                    </button>
                </div>
            </div>
            
            ${pendingHtml}
            
            <div class="detail-section">
                <div class="detail-section-title">基本資訊</div>
                <div class="detail-row">
                    <span>基準體重</span>
                    <span>${treatment.baseline_weight ? treatment.baseline_weight + ' kg' : '-'}</span>
                </div>
                <div class="detail-row">
                    <span>目前體重</span>
                    <span>${treatment.latest_weight ? treatment.latest_weight.weight + ' kg' : '-'}</span>
                </div>
                <div class="detail-row">
                    <span>變化率</span>
                    <span class="${getRateClass(treatment.change_rate)}">${formatChangeRate(treatment.change_rate)}</span>
                </div>
                <div class="detail-row">
                    <span>開始日期</span>
                    <span>${formatDate(treatment.treatment_start)}</span>
                </div>
            </div>
            
            ${chartHtml}
            
            <div class="detail-section">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="detail-section-title">體重記錄</span>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;"
                            onclick="Weight.showList(${treatment.id})">
                        全部
                    </button>
                </div>
                ${weightsHtml}
            </div>
            
            <div class="action-group">
                <button class="btn btn-primary" onclick="Weight.showForm(${treatment.id})">
                    記錄體重
                </button>
                <button class="btn btn-outline" onclick="Intervention.showList(${treatment.id})">
                    介入記錄
                </button>
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
        
        // 準備資料：從基準值開始
        const records = treatment.weight_records.slice(0, 15).reverse();
        const baseline = treatment.baseline_weight;
        
        // 標籤：治療開始日 + 各量測日
        const labels = [];
        const weights = [];
        
        // 第一個點：基準值（治療開始日）
        if (baseline) {
            labels.push(formatDate(treatment.treatment_start, 'MM/DD'));
            weights.push(baseline);
        }
        
        // 後續體重記錄
        records.forEach(r => {
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
