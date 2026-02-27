/**
 * 彰濱放腫體重監控預防系統 - 報表模組
 */

const Report = {
    // 圖表實例
    weightChart: null,
    cancerChart: null,
    
    // 篩選狀態
    filters: {
        period: 'month',
        dateFrom: null,
        dateTo: null,
        cancerType: 'all'
    },
    
    /**
     * 初始化篩選器
     */
    async initFilters() {
        // 載入癌別選項
        const cancerTypes = await Settings.get('cancer_types', []);
        const select = document.getElementById('report-cancer-type');
        select.innerHTML = '<option value="all">全部</option>' + 
            cancerTypes.map(c => `<option value="${c.code}">${c.label}</option>`).join('');
        
        // 設定預設日期
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        document.getElementById('report-date-from').value = formatDate(monthStart);
        document.getElementById('report-date-to').value = formatDate(today);
        
        // 載入年份選項（從最早療程到今年）
        const allTreatments = await DB.getAll('treatments');
        const currentYear = today.getFullYear();
        let minYear = currentYear;
        
        allTreatments.forEach(t => {
            if (t.treatment_start) {
                const year = new Date(t.treatment_start).getFullYear();
                if (year < minYear) minYear = year;
            }
        });
        
        const yearSelect = document.getElementById('report-year');
        let yearOptions = '';
        for (let y = currentYear; y >= minYear; y--) {
            yearOptions += `<option value="${y}">${y} 年</option>`;
        }
        yearSelect.innerHTML = yearOptions;
    },
    
    /**
     * 篩選條件變更
     */
    onFilterChange() {
        const period = document.getElementById('report-period').value;
        this.filters.period = period;
        this.filters.cancerType = document.getElementById('report-cancer-type').value;
        
        // 顯示/隱藏相關欄位
        const showCustom = period === 'custom';
        const showYear = period === 'specific_year';
        
        document.getElementById('report-date-from-group').style.display = showCustom ? 'block' : 'none';
        document.getElementById('report-date-to-group').style.display = showCustom ? 'block' : 'none';
        document.getElementById('report-year-group').style.display = showYear ? 'block' : 'none';
        
        if (showCustom) {
            this.filters.dateFrom = document.getElementById('report-date-from').value;
            this.filters.dateTo = document.getElementById('report-date-to').value;
        } else if (showYear) {
            const selectedYear = parseInt(document.getElementById('report-year').value);
            this.filters.dateFrom = `${selectedYear}-01-01`;
            this.filters.dateTo = `${selectedYear}-12-31`;
        } else {
            // 計算日期範圍
            const today = new Date();
            let dateFrom = null;
            let dateTo = formatDate(today);
            
            switch (period) {
                case 'week':
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    dateFrom = formatDate(weekStart);
                    break;
                case 'month':
                    dateFrom = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
                    break;
                case 'year':
                    dateFrom = formatDate(new Date(today.getFullYear(), 0, 1));
                    break;
                case 'all':
                    dateFrom = null;
                    dateTo = null;
                    break;
            }
            
            this.filters.dateFrom = dateFrom;
            this.filters.dateTo = dateTo;
        }
        
        this.render();
    },
    
    /**
     * 取得篩選後的統計資料
     */
    async getStats() {
        const allTreatments = await DB.getAll('treatments');
        const allPatients = await DB.getAll('patients');
        const allInterventions = await DB.getAll('interventions');
        const allWeightRecords = await DB.getAll('weight_records');
        const cancerTypes = await Settings.get('cancer_types', []);
        
        // 篩選療程
        let filteredTreatments = allTreatments;
        
        // 癌別篩選
        if (this.filters.cancerType !== 'all') {
            filteredTreatments = filteredTreatments.filter(t => 
                t.cancer_type === this.filters.cancerType
            );
        }
        
        // 日期篩選（根據療程開始日期）
        if (this.filters.dateFrom) {
            filteredTreatments = filteredTreatments.filter(t => 
                t.treatment_start >= this.filters.dateFrom
            );
        }
        if (this.filters.dateTo) {
            filteredTreatments = filteredTreatments.filter(t => 
                t.treatment_start <= this.filters.dateTo
            );
        }
        
        const filteredTreatmentIds = new Set(filteredTreatments.map(t => t.id));
        
        // 篩選相關的體重記錄
        const filteredWeightRecords = allWeightRecords.filter(w => 
            filteredTreatmentIds.has(w.treatment_id)
        );
        
        // 篩選相關的介入
        const filteredInterventions = allInterventions.filter(i => 
            filteredTreatmentIds.has(i.treatment_id)
        );
        
        // 計算統計
        const activeCount = filteredTreatments.filter(t => t.status === 'active').length;
        const pausedCount = filteredTreatments.filter(t => t.status === 'paused').length;
        const completedCount = filteredTreatments.filter(t => t.status === 'completed').length;
        const terminatedCount = filteredTreatments.filter(t => t.status === 'terminated').length;
        
        // 待介入（只看治療中）
        const activeTreatmentIds = new Set(
            filteredTreatments.filter(t => t.status === 'active').map(t => t.id)
        );
        const pendingInterventions = filteredInterventions.filter(i => 
            i.status === 'pending' && activeTreatmentIds.has(i.treatment_id)
        );
        
        // 癌別分布
        const cancerDistribution = {};
        filteredTreatments.forEach(t => {
            const label = cancerTypes.find(c => c.code === t.cancer_type)?.label || t.cancer_type;
            cancerDistribution[label] = (cancerDistribution[label] || 0) + 1;
        });
        
        // 體重變化分布（只看有基準體重的）
        const weightDistribution = {
            '正常 (≥0%)': 0,
            '輕微 (0~-3%)': 0,
            '中度 (-3~-5%)': 0,
            '嚴重 (-5~-10%)': 0,
            '極嚴重 (<-10%)': 0
        };
        
        for (const t of filteredTreatments) {
            if (!t.baseline_weight) continue;
            
            // 找最新體重（排除無法測量的）
            const weights = filteredWeightRecords
                .filter(w => w.treatment_id === t.id && !w.unable_to_measure && w.weight)
                .sort((a, b) => new Date(b.measure_date) - new Date(a.measure_date));
            
            if (weights.length === 0) continue;
            
            const rate = calculateWeightChangeRate(weights[0].weight, t.baseline_weight);
            
            if (rate >= 0) {
                weightDistribution['正常 (≥0%)']++;
            } else if (rate > -3) {
                weightDistribution['輕微 (0~-3%)']++;
            } else if (rate > -5) {
                weightDistribution['中度 (-3~-5%)']++;
            } else if (rate > -10) {
                weightDistribution['嚴重 (-5~-10%)']++;
            } else {
                weightDistribution['極嚴重 (<-10%)']++;
            }
        }
        
        // 介入統計
        const executedInterventions = filteredInterventions.filter(i => i.status === 'executed').length;
        const totalInterventions = filteredInterventions.length;
        const interventionRate = totalInterventions > 0 
            ? Math.round(executedInterventions / totalInterventions * 100) 
            : 0;
        
        // 時間區間顯示
        let periodLabel = '';
        switch (this.filters.period) {
            case 'week': periodLabel = '本週'; break;
            case 'month': periodLabel = '本月'; break;
            case 'year': periodLabel = '本年'; break;
            case 'custom': 
                periodLabel = `${this.filters.dateFrom} ~ ${this.filters.dateTo}`; 
                break;
            default: periodLabel = '全部時間';
        }
        
        return {
            periodLabel,
            totalTreatments: filteredTreatments.length,
            activeCount,
            pausedCount,
            completedCount,
            terminatedCount,
            pendingCount: pendingInterventions.length,
            weightRecordCount: filteredWeightRecords.length,
            cancerDistribution,
            weightDistribution,
            interventionRate,
            executedInterventions,
            totalInterventions
        };
    },
    
    /**
     * 渲染報表頁面
     */
    async render() {
        const container = document.getElementById('report-content');
        const stats = await this.getStats();
        
        // 癌別分布圖表資料
        const cancerLabels = Object.keys(stats.cancerDistribution);
        const cancerData = Object.values(stats.cancerDistribution);
        
        // 體重分布圖表資料
        const weightLabels = Object.keys(stats.weightDistribution);
        const weightData = Object.values(stats.weightDistribution);
        
        container.innerHTML = `
            <div style="margin-bottom: 16px; color: var(--text-secondary);">
                統計區間：${stats.periodLabel}
                ${this.filters.cancerType !== 'all' ? ` · 癌別篩選中` : ''}
            </div>
            
            <div class="report-grid">
                <div class="report-card">
                    <div class="report-card-title">療程統計</div>
                    <div class="detail-row">
                        <span>療程總數</span>
                        <strong>${stats.totalTreatments}</strong>
                    </div>
                    <div class="detail-row">
                        <span>治療中</span>
                        <strong style="color: var(--primary);">${stats.activeCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>暫停中</span>
                        <strong style="color: var(--warning);">${stats.pausedCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>已結案</span>
                        <strong style="color: var(--success);">${stats.completedCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>已終止</span>
                        <strong>${stats.terminatedCount}</strong>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-card-title">體重變化分布</div>
                    <div class="chart-container">
                        <canvas id="weight-chart"></canvas>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-card-title">癌別分布</div>
                    <div class="chart-container">
                        <canvas id="cancer-chart"></canvas>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-card-title">介入統計</div>
                    <div class="detail-row">
                        <span>待介入</span>
                        <strong style="color: var(--warning);">${stats.pendingCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>已執行</span>
                        <strong style="color: var(--success);">${stats.executedInterventions}</strong>
                    </div>
                    <div class="detail-row">
                        <span>介入總數</span>
                        <strong>${stats.totalInterventions}</strong>
                    </div>
                    <div class="detail-row">
                        <span>執行率</span>
                        <strong>${stats.interventionRate}%</strong>
                    </div>
                    <div class="detail-row">
                        <span>體重記錄數</span>
                        <strong>${stats.weightRecordCount}</strong>
                    </div>
                </div>
            </div>
        `;
        
        // 渲染圖表
        setTimeout(() => {
            this.renderWeightChart(weightLabels, weightData);
            this.renderCancerChart(cancerLabels, cancerData);
        }, 100);
    },
    
    /**
     * 渲染體重分布圖
     */
    renderWeightChart(labels, data) {
        const ctx = document.getElementById('weight-chart');
        if (!ctx) return;
        
        // 銷毀舊圖表
        if (this.weightChart) {
            this.weightChart.destroy();
        }
        
        this.weightChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#6BAF8D',  // 正常 - 綠
                        '#7BA7C9',  // 輕微 - 藍
                        '#E4B95A',  // 中度 - 黃
                        '#D97B7B',  // 嚴重 - 淺紅
                        '#8B0000'   // 極嚴重 - 深紅
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 12,
                            font: { size: 11 }
                        }
                    }
                }
            }
        });
    },
    
    /**
     * 渲染癌別分布圖
     */
    renderCancerChart(labels, data) {
        const ctx = document.getElementById('cancer-chart');
        if (!ctx) return;
        
        // 銷毀舊圖表
        if (this.cancerChart) {
            this.cancerChart.destroy();
        }
        
        this.cancerChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: '#5B8FB9',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    },
    
    /**
     * 匯出 Excel
     */
    async exportExcel() {
        // 取得篩選後的療程
        const allTreatments = await DB.getAll('treatments');
        const cancerTypes = await Settings.get('cancer_types', []);
        
        let treatments = allTreatments;
        
        // 套用篩選
        if (this.filters.cancerType !== 'all') {
            treatments = treatments.filter(t => t.cancer_type === this.filters.cancerType);
        }
        if (this.filters.dateFrom) {
            treatments = treatments.filter(t => t.treatment_start >= this.filters.dateFrom);
        }
        if (this.filters.dateTo) {
            treatments = treatments.filter(t => t.treatment_start <= this.filters.dateTo);
        }
        
        const data = [];
        
        for (const t of treatments) {
            const patient = await Patient.getById(t.patient_id);
            if (!patient) continue;
            
            const weights = await Weight.getByTreatment(t.id);
            const latestWeight = weights[0];
            
            let changeRate = null;
            if (latestWeight && t.baseline_weight) {
                changeRate = calculateWeightChangeRate(latestWeight.weight, t.baseline_weight);
            }
            
            const cancerLabel = cancerTypes.find(c => c.code === t.cancer_type)?.label || t.cancer_type;
            
            data.push({
                '病歷號': patient.medical_id,
                '姓名': patient.name,
                '性別': formatGender(patient.gender),
                '年齡': calculateAge(patient.birth_date),
                '癌別': cancerLabel,
                '治療開始': t.treatment_start,
                '基準體重': t.baseline_weight || '-',
                '目前體重': latestWeight?.weight || '-',
                '變化率': changeRate !== null ? formatChangeRate(changeRate) : '-',
                '最後量測': latestWeight?.measure_date || '-',
                '狀態': formatTreatmentStatus(t.status)
            });
        }
        
        // 建立工作表
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '療程報表');
        
        // 檔名含篩選條件
        let filename = `體重追蹤報表_${today()}`;
        if (this.filters.cancerType !== 'all') {
            const cancerLabel = cancerTypes.find(c => c.code === this.filters.cancerType)?.label;
            filename += `_${cancerLabel}`;
        }
        filename += '.xlsx';
        
        XLSX.writeFile(wb, filename);
        showToast('Excel 已下載');
    },
    
    /**
     * 匯出 PDF（截圖報表區域）
     */
    async exportPdf() {
        const reportContent = document.getElementById('report-content');
        if (!reportContent) {
            showToast('找不到報表內容', 'error');
            return;
        }
        
        showToast('正在產生 PDF...');
        
        try {
            // 使用 html2canvas 截圖
            const canvas = await html2canvas(reportContent, {
                scale: 2,
                useCORS: true,
                logging: false,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            
            // 建立 PDF
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // 計算圖片尺寸
            const imgWidth = pageWidth - 20; // 左右留 10mm 邊距
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            let heightLeft = imgHeight;
            let position = 10; // 上方留 10mm
            
            // 第一頁
            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            heightLeft -= (pageHeight - 20);
            
            // 如果內容超過一頁，自動分頁
            while (heightLeft > 0) {
                position = heightLeft - imgHeight + 10;
                pdf.addPage();
                pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
                heightLeft -= (pageHeight - 20);
            }
            
            // 檔名
            const cancerTypes = await Settings.get('cancer_types', []);
            let filename = `體重統計報表_${today()}`;
            if (this.filters.cancerType !== 'all') {
                const cancerLabel = cancerTypes.find(c => c.code === this.filters.cancerType)?.label;
                filename += `_${cancerLabel}`;
            }
            filename += '.pdf';
            
            pdf.save(filename);
            showToast('PDF 已下載');
        } catch (e) {
            console.error('PDF 匯出失敗:', e);
            showToast('PDF 匯出失敗', 'error');
        }
    }
};
