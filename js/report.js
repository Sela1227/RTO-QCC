/**
 * SELA 體重追蹤系統 - 報表模組
 */

const Report = {
    /**
     * 取得統計資料
     */
    async getStats() {
        const treatments = await Treatment.getActive();
        const pausedTreatments = await Treatment.getPaused();
        const allTreatments = await DB.getAll('treatments');
        const allPatients = await DB.getAll('patients');
        const allInterventions = await DB.getAll('interventions');
        
        // 治療中
        const activeCount = treatments.length;
        
        // 待介入
        const pendingInterventions = await Intervention.getPending();
        const pendingCount = pendingInterventions.length;
        
        // 逾期
        const overdueCount = treatments.filter(t => 
            t.tracking_status?.status === 'overdue'
        ).length;
        
        // 癌別分布
        const cancerTypes = await Settings.get('cancer_types', []);
        const cancerDistribution = {};
        treatments.forEach(t => {
            const label = cancerTypes.find(c => c.code === t.cancer_type)?.label || t.cancer_type;
            cancerDistribution[label] = (cancerDistribution[label] || 0) + 1;
        });
        
        // 體重變化分布
        const weightDistribution = {
            '正常 (≥0%)': 0,
            '輕微下降 (0~-3%)': 0,
            '中度下降 (-3~-5%)': 0,
            '嚴重下降 (<-5%)': 0
        };
        
        treatments.forEach(t => {
            const rate = t.change_rate;
            if (rate === null || rate === undefined) return;
            
            if (rate >= 0) {
                weightDistribution['正常 (≥0%)']++;
            } else if (rate > -3) {
                weightDistribution['輕微下降 (0~-3%)']++;
            } else if (rate > -5) {
                weightDistribution['中度下降 (-3~-5%)']++;
            } else {
                weightDistribution['嚴重下降 (<-5%)']++;
            }
        });
        
        // 介入統計
        const executedInterventions = allInterventions.filter(i => i.status === 'executed').length;
        const totalInterventions = allInterventions.length;
        const interventionRate = totalInterventions > 0 
            ? Math.round(executedInterventions / totalInterventions * 100) 
            : 0;
        
        return {
            activeCount,
            pendingCount,
            overdueCount,
            pausedCount: pausedTreatments.length,
            totalPatients: allPatients.length,
            totalTreatments: allTreatments.length,
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
            <div class="report-grid">
                <div class="report-card">
                    <div class="report-card-title">整體統計</div>
                    <div class="detail-row">
                        <span>病人總數</span>
                        <strong>${stats.totalPatients}</strong>
                    </div>
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
                        <span>介入執行率</span>
                        <strong>${stats.interventionRate}%</strong>
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
                    <div class="report-card-title">警示狀態</div>
                    <div class="detail-row">
                        <span>待介入</span>
                        <strong style="color: var(--warning);">${stats.pendingCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>逾期未量</span>
                        <strong style="color: var(--danger);">${stats.overdueCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>已執行介入</span>
                        <strong>${stats.executedInterventions}</strong>
                    </div>
                    <div class="detail-row">
                        <span>介入總數</span>
                        <strong>${stats.totalInterventions}</strong>
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
        
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#6BAF8D',
                        '#7BA7C9',
                        '#E4B95A',
                        '#D97B7B'
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
        
        new Chart(ctx, {
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
        const treatments = await Treatment.getActive();
        const data = [];
        
        for (const t of treatments) {
            const patient = t.patient;
            const weights = await Weight.getByTreatment(t.id);
            
            data.push({
                '病歷號': patient.medical_id,
                '姓名': patient.name,
                '性別': formatGender(patient.gender),
                '年齡': calculateAge(patient.birth_date),
                '癌別': t.cancer_type_label,
                '基準體重': t.baseline_weight,
                '目前體重': t.latest_weight?.weight || '-',
                '變化率': t.change_rate !== null ? formatChangeRate(t.change_rate) : '-',
                '最後量測': t.latest_weight?.measure_date || '-',
                '狀態': formatTreatmentStatus(t.status)
            });
        }
        
        // 建立工作表
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, '治療中病人');
        
        // 下載
        const filename = `體重追蹤報表_${today()}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast('Excel 已下載');
    }
};
