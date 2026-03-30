/**
 * 成效儀表板模組
 * 顯示系統 KPI 和統計圖表
 */

const Dashboard = {
    // 圖表實例
    charts: {},
    
    // 快取的統計資料
    stats: null,
    
    /**
     * 初始化儀表板
     */
    async init() {
        this.bindEvents();
        await this.refresh();
    },
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 期間選擇器變更
        const periodSelect = document.getElementById('dashboard-period');
        if (periodSelect) {
            periodSelect.addEventListener('change', () => this.onPeriodChange());
        }
    },
    
    /**
     * 期間選擇變更
     */
    onPeriodChange() {
        const period = document.getElementById('dashboard-period').value;
        const fromGroup = document.getElementById('dashboard-date-from-group');
        const toGroup = document.getElementById('dashboard-date-to-group');
        
        if (period === 'custom') {
            fromGroup.style.display = 'block';
            toGroup.style.display = 'block';
            
            // 設定預設日期
            const today = new Date();
            const monthAgo = new Date(today);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            
            document.getElementById('dashboard-date-from').value = monthAgo.toISOString().split('T')[0];
            document.getElementById('dashboard-date-to').value = today.toISOString().split('T')[0];
        } else {
            fromGroup.style.display = 'none';
            toGroup.style.display = 'none';
        }
        
        this.refresh();
    },
    
    /**
     * 取得篩選的日期範圍
     */
    getDateRange() {
        const period = document.getElementById('dashboard-period')?.value || 'all';
        const today = new Date();
        let startDate = null;
        let endDate = today.toISOString().split('T')[0];
        
        switch (period) {
            case 'month':
                startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                break;
            case 'quarter':
                const quarter = Math.floor(today.getMonth() / 3);
                startDate = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
                break;
            case 'year':
                startDate = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
                break;
            case 'custom':
                startDate = document.getElementById('dashboard-date-from')?.value || null;
                endDate = document.getElementById('dashboard-date-to')?.value || endDate;
                break;
            default: // 'all'
                startDate = null;
                endDate = null;
        }
        
        return { startDate, endDate };
    },
    
    /**
     * 重新整理儀表板
     */
    async refresh() {
        try {
            const { startDate, endDate } = this.getDateRange();
            this.stats = await this.calculateStats(startDate, endDate);
            
            this.renderKPI();
            this.renderCharts();
        } catch (e) {
            console.error('儀表板載入失敗:', e);
        }
    },
    
    /**
     * 計算統計數據
     */
    async calculateStats(startDate, endDate) {
        // 取得所有資料
        const allPatients = await DB.getAll('patients');
        const allTreatments = await DB.getAll('treatments');
        const allWeights = await DB.getAll('weight_records');
        const allInterventions = await DB.getAll('interventions');
        const allSideEffects = await DB.getAll('side_effects');
        
        // 過濾已刪除
        const patients = allPatients.filter(p => !p.deleted);
        const treatments = allTreatments.filter(t => !t.deleted);
        const weights = allWeights.filter(w => !w.deleted);
        const interventions = allInterventions.filter(i => !i.deleted);
        const sideEffects = allSideEffects.filter(s => !s.deleted);
        
        // 日期篩選
        const filterByDate = (items, dateField) => {
            if (!startDate && !endDate) return items;
            return items.filter(item => {
                const date = item[dateField];
                if (!date) return false;
                if (startDate && date < startDate) return false;
                if (endDate && date > endDate) return false;
                return true;
            });
        };
        
        // 篩選期間內的療程
        const filteredTreatments = filterByDate(treatments, 'treatment_start');
        const treatmentIds = new Set(filteredTreatments.map(t => t.id));
        
        // 篩選期間內的介入
        const filteredInterventions = interventions.filter(i => {
            if (startDate || endDate) {
                const date = i.created_at?.split('T')[0];
                if (!date) return false;
                if (startDate && date < startDate) return false;
                if (endDate && date > endDate) return false;
            }
            return true;
        });
        
        // 篩選期間內的體重記錄
        const filteredWeights = filterByDate(weights, 'measure_date');
        
        // 篩選期間內的副作用評估
        const filteredSideEffects = filterByDate(sideEffects, 'assess_date');
        
        // ===== 計算 KPI =====
        
        // 1. 追蹤人數（期間內有療程的病人數）
        const trackedPatientIds = new Set(filteredTreatments.map(t => t.patient_id));
        const trackedPatients = trackedPatientIds.size;
        
        // 2. 警示觸發次數
        const alertsTriggered = filteredInterventions.filter(i => 
            i.type === 'nutrition' || i.type === 'sdm'
        ).length;
        
        // 3. 介入完成率
        const completedInterventions = filteredInterventions.filter(i => 
            i.status === 'executed' || i.status === 'completed'
        ).length;
        const totalNeedIntervention = filteredInterventions.filter(i => 
            i.status !== 'skipped'
        ).length;
        const completionRate = totalNeedIntervention > 0 
            ? (completedInterventions / totalNeedIntervention * 100) 
            : 0;
        
        // 4. 平均反應時間
        const responseTimes = [];
        for (const i of filteredInterventions) {
            if (i.contacted_at || i.executed_at) {
                const start = new Date(i.created_at);
                const end = new Date(i.contacted_at || i.executed_at);
                const hours = (end - start) / (1000 * 60 * 60);
                if (hours >= 0 && hours < 720) { // 排除異常值（超過30天）
                    responseTimes.push(hours);
                }
            }
        }
        const avgResponseTime = responseTimes.length > 0
            ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
            : null;
        
        // 5. 病人自填率（來自 QR Code 的體重記錄）
        const selfReportedWeights = filteredWeights.filter(w => w.source === 'qr_scan').length;
        const totalWeights = filteredWeights.length;
        const selfReportRate = totalWeights > 0 
            ? (selfReportedWeights / totalWeights * 100) 
            : 0;
        
        // 6. 體重維持率（維持在 95% 以上）
        let maintainedCount = 0;
        let totalWithBaseline = 0;
        
        for (const t of filteredTreatments) {
            if (!t.baseline_weight) continue;
            
            const tWeights = weights.filter(w => w.treatment_id === t.id && !w.unable_to_measure);
            if (tWeights.length === 0) continue;
            
            totalWithBaseline++;
            const latestWeight = tWeights.sort((a, b) => 
                new Date(b.measure_date) - new Date(a.measure_date)
            )[0];
            
            const changeRate = (latestWeight.weight - t.baseline_weight) / t.baseline_weight * 100;
            if (changeRate >= -5) {
                maintainedCount++;
            }
        }
        const maintenanceRate = totalWithBaseline > 0 
            ? (maintainedCount / totalWithBaseline * 100) 
            : 0;
        
        // 7. 副作用追蹤率
        const treatmentsWithSE = new Set(filteredSideEffects.map(s => s.treatment_id));
        const seTrackingRate = filteredTreatments.length > 0
            ? (treatmentsWithSE.size / filteredTreatments.length * 100)
            : 0;
        
        // 8. 結案人數
        const completedTreatments = filteredTreatments.filter(t => t.status === 'completed').length;
        
        // ===== 計算圖表資料 =====
        
        // 月度趨勢
        const monthlyStats = this.calculateMonthlyStats(filteredTreatments, weights, interventions);
        
        // 癌別分布
        const cancerStats = this.calculateCancerStats(filteredTreatments);
        
        // 介入類型分布
        const interventionTypeStats = this.calculateInterventionTypeStats(filteredInterventions);
        
        // 反應時間分布
        const responseTimeDistribution = this.calculateResponseTimeDistribution(responseTimes);
        
        return {
            trackedPatients,
            alertsTriggered,
            completionRate,
            avgResponseTime,
            selfReportRate,
            maintenanceRate,
            seTrackingRate,
            completedTreatments,
            totalTreatments: filteredTreatments.length,
            monthlyStats,
            cancerStats,
            interventionTypeStats,
            responseTimeDistribution,
            // 原始數據供報告使用
            raw: {
                treatments: filteredTreatments,
                interventions: filteredInterventions,
                weights: filteredWeights,
                sideEffects: filteredSideEffects
            }
        };
    },
    
    /**
     * 計算月度統計
     */
    calculateMonthlyStats(treatments, weights, interventions) {
        const months = {};
        
        // 統計各月療程數
        treatments.forEach(t => {
            const month = t.treatment_start?.substring(0, 7);
            if (!month) return;
            if (!months[month]) {
                months[month] = { treatments: 0, maintained: 0, interventions: 0 };
            }
            months[month].treatments++;
        });
        
        // 統計各月介入數
        interventions.forEach(i => {
            const month = i.created_at?.substring(0, 7);
            if (!month || !months[month]) return;
            months[month].interventions++;
        });
        
        // 轉換為陣列並排序
        const result = Object.entries(months)
            .map(([month, data]) => ({
                month,
                label: month.substring(5) + '月',
                ...data,
                maintenanceRate: data.treatments > 0 
                    ? Math.round(data.maintained / data.treatments * 100) 
                    : 0
            }))
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-12); // 最近12個月
        
        return result;
    },
    
    /**
     * 計算癌別統計
     */
    calculateCancerStats(treatments) {
        const stats = {};
        
        treatments.forEach(t => {
            const type = t.cancer_type || 'other';
            if (!stats[type]) {
                stats[type] = { count: 0, label: type };
            }
            stats[type].count++;
        });
        
        return Object.values(stats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    },
    
    /**
     * 計算介入類型統計
     */
    calculateInterventionTypeStats(interventions) {
        const stats = {};
        
        interventions.forEach(i => {
            const type = i.type || 'other';
            if (!stats[type]) {
                stats[type] = { count: 0, type };
            }
            stats[type].count++;
        });
        
        return Object.values(stats).sort((a, b) => b.count - a.count);
    },
    
    /**
     * 計算反應時間分布
     */
    calculateResponseTimeDistribution(responseTimes) {
        const distribution = {
            '<4hr': 0,
            '4-24hr': 0,
            '>24hr': 0
        };
        
        responseTimes.forEach(hours => {
            if (hours < 4) {
                distribution['<4hr']++;
            } else if (hours <= 24) {
                distribution['4-24hr']++;
            } else {
                distribution['>24hr']++;
            }
        });
        
        const total = responseTimes.length || 1;
        return [
            { label: '< 4 小時', count: distribution['<4hr'], pct: Math.round(distribution['<4hr'] / total * 100) },
            { label: '4-24 小時', count: distribution['4-24hr'], pct: Math.round(distribution['4-24hr'] / total * 100) },
            { label: '> 24 小時', count: distribution['>24hr'], pct: Math.round(distribution['>24hr'] / total * 100) }
        ];
    },
    
    /**
     * 渲染 KPI 卡片
     */
    renderKPI() {
        const container = document.getElementById('dashboard-kpi');
        if (!container || !this.stats) return;
        
        const s = this.stats;
        
        const formatTime = (hours) => {
            if (hours === null) return '-';
            if (hours < 1) return `${Math.round(hours * 60)} 分`;
            if (hours < 24) return `${hours.toFixed(1)} 時`;
            return `${(hours / 24).toFixed(1)} 天`;
        };
        
        const kpis = [
            {
                icon: '📊',
                iconClass: 'blue',
                value: s.trackedPatients,
                unit: '人',
                label: '追蹤人數'
            },
            {
                icon: '⚠️',
                iconClass: 'amber',
                value: s.alertsTriggered,
                unit: '次',
                label: '警示觸發'
            },
            {
                icon: '✅',
                iconClass: 'green',
                value: s.completionRate.toFixed(1),
                unit: '%',
                label: '介入完成率',
                target: 95,
                achieved: s.completionRate >= 95
            },
            {
                icon: '⏱️',
                iconClass: 'purple',
                value: formatTime(s.avgResponseTime),
                unit: '',
                label: '平均反應時間',
                target: '< 24hr',
                achieved: s.avgResponseTime !== null && s.avgResponseTime <= 24
            },
            {
                icon: '📱',
                iconClass: 'blue',
                value: s.selfReportRate.toFixed(1),
                unit: '%',
                label: '病人自填率',
                target: 60,
                achieved: s.selfReportRate >= 60
            },
            {
                icon: '💪',
                iconClass: s.maintenanceRate >= 85 ? 'green' : 'amber',
                value: s.maintenanceRate.toFixed(1),
                unit: '%',
                label: '體重維持率',
                target: 85,
                achieved: s.maintenanceRate >= 85
            },
            {
                icon: '📝',
                iconClass: 'blue',
                value: s.seTrackingRate.toFixed(1),
                unit: '%',
                label: '副作用追蹤率',
                target: 80,
                achieved: s.seTrackingRate >= 80
            },
            {
                icon: '🏁',
                iconClass: 'gray',
                value: s.completedTreatments,
                unit: '人',
                label: '已結案'
            }
        ];
        
        container.innerHTML = kpis.map(kpi => `
            <div class="kpi-card">
                <div class="kpi-icon ${kpi.iconClass}">${kpi.icon}</div>
                <div class="kpi-content">
                    <div class="kpi-value">
                        ${kpi.value}<span class="unit">${kpi.unit}</span>
                    </div>
                    <div class="kpi-label">${kpi.label}</div>
                    ${kpi.target !== undefined ? `
                        <div class="kpi-trend ${kpi.achieved ? 'up' : 'down'}">
                            ${kpi.achieved ? '✓' : '○'} 目標 ${typeof kpi.target === 'number' ? kpi.target + '%' : kpi.target}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
    },
    
    /**
     * 渲染圖表
     */
    renderCharts() {
        const container = document.getElementById('dashboard-charts');
        if (!container || !this.stats) return;
        
        const s = this.stats;
        
        // 先建立圖表容器
        container.innerHTML = `
            <div class="chart-card">
                <div class="chart-title">📈 月度趨勢</div>
                <div class="chart-container">
                    <canvas id="chart-monthly"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">🏥 癌別分布</div>
                <div class="chart-container small">
                    <canvas id="chart-cancer"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">🔧 介入類型</div>
                <div class="chart-container small">
                    <canvas id="chart-intervention"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">⏱️ 反應時間分布</div>
                <div class="stats-list" style="padding: 20px 0;">
                    ${s.responseTimeDistribution.map((item, i) => {
                        const colors = ['green', 'amber', 'red'];
                        return `
                            <div class="stats-item">
                                <span class="stats-label">${item.label}</span>
                                <div class="stats-bar-container">
                                    <div class="stats-bar ${colors[i]}" style="width: ${item.pct}%"></div>
                                </div>
                                <span class="stats-value">${item.count} (${item.pct}%)</span>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        // 延遲渲染圖表
        setTimeout(() => {
            this.renderMonthlyChart(s.monthlyStats);
            this.renderCancerChart(s.cancerStats);
            this.renderInterventionChart(s.interventionTypeStats);
        }, 100);
    },
    
    /**
     * 渲染月度趨勢圖
     */
    renderMonthlyChart(data) {
        const ctx = document.getElementById('chart-monthly');
        if (!ctx || data.length === 0) return;
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }
        
        this.charts.monthly = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.label),
                datasets: [
                    {
                        label: '新增療程',
                        data: data.map(d => d.treatments),
                        borderColor: '#5B8FB9',
                        backgroundColor: 'rgba(91, 143, 185, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'y'
                    },
                    {
                        label: '介入次數',
                        data: data.map(d => d.interventions),
                        borderColor: '#E4B95A',
                        backgroundColor: 'transparent',
                        borderDash: [5, 5],
                        tension: 0.3,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { font: { size: 10 } }
                    },
                    x: {
                        ticks: { font: { size: 10 } }
                    }
                }
            }
        });
    },
    
    /**
     * 渲染癌別分布圖
     */
    renderCancerChart(data) {
        const ctx = document.getElementById('chart-cancer');
        if (!ctx || data.length === 0) return;
        
        if (this.charts.cancer) {
            this.charts.cancer.destroy();
        }
        
        const colors = ['#5B8FB9', '#6BAF8D', '#E4B95A', '#D97B7B', '#9370DB'];
        
        this.charts.cancer = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(d => d.label),
                datasets: [{
                    data: data.map(d => d.count),
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { boxWidth: 12, font: { size: 11 } }
                    }
                }
            }
        });
    },
    
    /**
     * 渲染介入類型圖
     */
    renderInterventionChart(data) {
        const ctx = document.getElementById('chart-intervention');
        if (!ctx || data.length === 0) return;
        
        if (this.charts.intervention) {
            this.charts.intervention.destroy();
        }
        
        const typeLabels = {
            'nutrition': '營養諮詢',
            'sdm': 'SDM 諮詢',
            'ng_tube': '鼻胃管',
            'gastrostomy': '胃造廔',
            'manual': '其他'
        };
        
        this.charts.intervention = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(d => typeLabels[d.type] || d.type),
                datasets: [{
                    label: '次數',
                    data: data.map(d => d.count),
                    backgroundColor: '#5B8FB9',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: { font: { size: 10 } }
                    },
                    y: {
                        ticks: { font: { size: 11 } }
                    }
                }
            }
        });
    },
    
    /**
     * 匯出 PDF 報告
     */
    async exportPDF() {
        if (!this.stats) {
            showToast('請先載入統計資料', 'error');
            return;
        }
        
        showToast('正在產生報告...', 'info');
        
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            // 嘗試載入中文字體
            let fontLoaded = false;
            try {
                const fontUrl = 'https://fonts.gstatic.com/s/notosanstc/v35/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_CpOtma3uNQ.ttf';
                const response = await fetch(fontUrl);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const uint8Array = new Uint8Array(arrayBuffer);
                    let binary = '';
                    for (let i = 0; i < uint8Array.length; i++) {
                        binary += String.fromCharCode(uint8Array[i]);
                    }
                    const fontData = btoa(binary);
                    pdf.addFileToVFS('NotoSansTC.ttf', fontData);
                    pdf.addFont('NotoSansTC.ttf', 'NotoSansTC', 'normal');
                    pdf.setFont('NotoSansTC');
                    fontLoaded = true;
                }
            } catch (e) {
                console.warn('字體載入失敗，使用預設字體');
            }
            
            const s = this.stats;
            const { startDate, endDate } = this.getDateRange();
            const dateRange = startDate && endDate 
                ? `${startDate} ~ ${endDate}`
                : '全部期間';
            
            let y = 20;
            
            // === 標題 ===
            pdf.setFontSize(18);
            pdf.setTextColor(44, 62, 80);
            pdf.text('SELA 體重監控預防系統', pageWidth / 2, y, { align: 'center' });
            y += 8;
            
            pdf.setFontSize(14);
            pdf.text('成效報告', pageWidth / 2, y, { align: 'center' });
            y += 10;
            
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`報告期間：${dateRange}`, pageWidth / 2, y, { align: 'center' });
            y += 5;
            pdf.text(`產出日期：${new Date().toLocaleDateString('zh-TW')}`, pageWidth / 2, y, { align: 'center' });
            y += 15;
            
            // === 關鍵指標 ===
            pdf.setFontSize(12);
            pdf.setTextColor(44, 62, 80);
            pdf.text('一、關鍵指標', 15, y);
            y += 8;
            
            pdf.setFontSize(10);
            const kpiData = [
                ['指標', '數值', '目標', '達成'],
                ['追蹤人數', `${s.trackedPatients} 人`, '-', '-'],
                ['警示觸發', `${s.alertsTriggered} 次`, '-', '-'],
                ['介入完成率', `${s.completionRate.toFixed(1)}%`, '≥95%', s.completionRate >= 95 ? '✓' : '○'],
                ['平均反應時間', s.avgResponseTime ? `${s.avgResponseTime.toFixed(1)} 小時` : '-', '≤24小時', s.avgResponseTime && s.avgResponseTime <= 24 ? '✓' : '○'],
                ['體重維持率', `${s.maintenanceRate.toFixed(1)}%`, '≥85%', s.maintenanceRate >= 85 ? '✓' : '○'],
                ['副作用追蹤率', `${s.seTrackingRate.toFixed(1)}%`, '≥80%', s.seTrackingRate >= 80 ? '✓' : '○'],
                ['病人自填率', `${s.selfReportRate.toFixed(1)}%`, '≥60%', s.selfReportRate >= 60 ? '✓' : '○']
            ];
            
            // 繪製表格
            const colWidths = [50, 40, 40, 30];
            const rowHeight = 7;
            let tableX = 15;
            
            kpiData.forEach((row, rowIndex) => {
                let x = tableX;
                row.forEach((cell, colIndex) => {
                    // 表頭背景
                    if (rowIndex === 0) {
                        pdf.setFillColor(91, 143, 185);
                        pdf.rect(x, y - 5, colWidths[colIndex], rowHeight, 'F');
                        pdf.setTextColor(255, 255, 255);
                    } else {
                        pdf.setTextColor(44, 62, 80);
                    }
                    
                    pdf.text(cell, x + 2, y);
                    x += colWidths[colIndex];
                });
                y += rowHeight;
            });
            
            y += 10;
            
            // === 癌別分析 ===
            pdf.setFontSize(12);
            pdf.setTextColor(44, 62, 80);
            pdf.text('二、癌別分析', 15, y);
            y += 8;
            
            pdf.setFontSize(10);
            s.cancerStats.forEach(item => {
                const pct = s.totalTreatments > 0 ? (item.count / s.totalTreatments * 100).toFixed(1) : 0;
                pdf.text(`• ${item.label}：${item.count} 人 (${pct}%)`, 20, y);
                y += 6;
            });
            
            y += 8;
            
            // === 介入分析 ===
            pdf.setFontSize(12);
            pdf.text('三、介入分析', 15, y);
            y += 8;
            
            const typeLabels = {
                'nutrition': '營養諮詢',
                'sdm': 'SDM 諮詢',
                'ng_tube': '鼻胃管',
                'gastrostomy': '胃造廔',
                'manual': '其他'
            };
            
            pdf.setFontSize(10);
            s.interventionTypeStats.forEach(item => {
                pdf.text(`• ${typeLabels[item.type] || item.type}：${item.count} 次`, 20, y);
                y += 6;
            });
            
            y += 8;
            
            // === 反應時間 ===
            pdf.setFontSize(12);
            pdf.text('四、反應時間分布', 15, y);
            y += 8;
            
            pdf.setFontSize(10);
            s.responseTimeDistribution.forEach(item => {
                pdf.text(`• ${item.label}：${item.count} 次 (${item.pct}%)`, 20, y);
                y += 6;
            });
            
            // === 頁尾 ===
            pdf.setFontSize(8);
            pdf.setTextColor(150, 150, 150);
            pdf.text('彰濱秀傳紀念醫院 放射腫瘤科', pageWidth / 2, pageHeight - 10, { align: 'center' });
            
            // 儲存 PDF
            const filename = `SELA_成效報告_${new Date().toISOString().split('T')[0]}.pdf`;
            pdf.save(filename);
            
            showToast('報告已匯出');
        } catch (e) {
            console.error('PDF 匯出失敗:', e);
            showToast('匯出失敗: ' + e.message, 'error');
        }
    }
};
