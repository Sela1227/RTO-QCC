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
        
        // 9. 滿意度統計
        let satisfactionStats = null;
        try {
            satisfactionStats = await Satisfaction.calculateStats(startDate, endDate);
        } catch (e) {
            console.warn('滿意度統計計算失敗:', e);
        }
        
        // 10. SDM 選擇統計
        const sdmStats = this.calculateSDMStats(filteredTreatments);
        
        // 11. 暫停/終止原因統計
        const statusReasonStats = this.calculateStatusReasonStats(filteredTreatments);
        
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
            satisfactionStats,
            sdmStats,
            statusReasonStats,
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
     * 計算 SDM 選擇統計
     */
    calculateSDMStats(treatments) {
        const stats = {
            total: 0,           // 需要 SDM 的總人數（體重下降達閾值）
            completed: 0,       // 已完成 SDM 選擇
            choices: {}         // 各選項統計
        };
        
        const sdmLabels = {
            'oral_supplement': '口服營養補充',
            'ng_tube': '鼻胃管',
            'peg_endoscopic': 'PEG（內視鏡）',
            'peg_fluoroscopic': 'PEG（透視導引）',
            'undecided': '考慮中',
            'refused': '病人拒絕'
        };
        
        treatments.forEach(t => {
            // 判斷是否需要 SDM（體重下降達閾值）
            if (t.change_rate !== null && t.change_rate <= -3) {
                stats.total++;
                
                if (t.sdm_choice && t.sdm_choice !== '') {
                    stats.completed++;
                    
                    const choice = t.sdm_choice;
                    if (!stats.choices[choice]) {
                        stats.choices[choice] = {
                            count: 0,
                            label: sdmLabels[choice] || choice
                        };
                    }
                    stats.choices[choice].count++;
                }
            }
        });
        
        stats.completionRate = stats.total > 0 
            ? (stats.completed / stats.total * 100) 
            : 0;
        
        return stats;
    },
    
    /**
     * 計算暫停/終止原因統計
     */
    calculateStatusReasonStats(treatments) {
        const stats = {
            paused: { total: 0, reasons: {} },
            terminated: { total: 0, reasons: {} },
            completed: { total: 0 }
        };
        
        treatments.forEach(t => {
            if (t.status === 'paused') {
                stats.paused.total++;
                const reason = t.pause_reason || '未填寫';
                if (!stats.paused.reasons[reason]) {
                    stats.paused.reasons[reason] = 0;
                }
                stats.paused.reasons[reason]++;
            } else if (t.status === 'terminated') {
                stats.terminated.total++;
                const reason = t.terminate_reason || '未填寫';
                if (!stats.terminated.reasons[reason]) {
                    stats.terminated.reasons[reason] = 0;
                }
                stats.terminated.reasons[reason]++;
            } else if (t.status === 'completed') {
                stats.completed.total++;
            }
        });
        
        return stats;
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
        
        // SVG 圖示定義
        const icons = {
            users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
            check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
            clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
            phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
            scale: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3v18M5.5 8.5l13-5M18.5 8.5l-13-5"/><circle cx="5" cy="9" r="2"/><circle cx="19" cy="9" r="2"/></svg>',
            clipboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>',
            flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
            star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'
        };
        
        const kpis = [
            {
                icon: icons.users,
                iconClass: 'blue',
                value: s.trackedPatients,
                unit: '人',
                label: '追蹤人數'
            },
            {
                icon: icons.alert,
                iconClass: 'amber',
                value: s.alertsTriggered,
                unit: '次',
                label: '警示觸發'
            },
            {
                icon: icons.check,
                iconClass: 'green',
                value: s.completionRate.toFixed(1),
                unit: '%',
                label: '介入完成率',
                target: 95,
                achieved: s.completionRate >= 95
            },
            {
                icon: icons.clock,
                iconClass: 'purple',
                value: formatTime(s.avgResponseTime),
                unit: '',
                label: '平均反應時間',
                target: '< 24hr',
                achieved: s.avgResponseTime !== null && s.avgResponseTime <= 24
            },
            {
                icon: icons.phone,
                iconClass: 'blue',
                value: s.selfReportRate.toFixed(1),
                unit: '%',
                label: '病人自填率',
                target: 60,
                achieved: s.selfReportRate >= 60
            },
            {
                icon: icons.scale,
                iconClass: s.maintenanceRate >= 85 ? 'green' : 'amber',
                value: s.maintenanceRate.toFixed(1),
                unit: '%',
                label: '體重維持率',
                target: 85,
                achieved: s.maintenanceRate >= 85
            },
            {
                icon: icons.clipboard,
                iconClass: 'blue',
                value: s.seTrackingRate.toFixed(1),
                unit: '%',
                label: '副作用追蹤率',
                target: 80,
                achieved: s.seTrackingRate >= 80
            },
            {
                icon: icons.flag,
                iconClass: 'gray',
                value: s.completedTreatments,
                unit: '人',
                label: '已結案'
            },
            {
                icon: icons.star,
                iconClass: s.satisfactionStats?.overallAvg >= 4 ? 'green' : 'amber',
                value: s.satisfactionStats?.overallAvg?.toFixed(1) || '-',
                unit: s.satisfactionStats?.overallAvg ? '/5' : '',
                label: '滿意度',
                extra: s.satisfactionStats?.count ? `(${s.satisfactionStats.count}份)` : ''
            },
            {
                icon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="8.5" cy="7" r="4"/>
                    <polyline points="17 11 19 13 23 9"/>
                </svg>`,
                iconClass: s.sdmStats?.completionRate >= 80 ? 'green' : 'amber',
                value: s.sdmStats?.completionRate?.toFixed(1) || '0',
                unit: '%',
                label: 'SDM 完成率',
                target: 80,
                achieved: s.sdmStats?.completionRate >= 80,
                extra: s.sdmStats?.total ? `(${s.sdmStats.completed}/${s.sdmStats.total})` : ''
            }
        ];
        
        container.innerHTML = kpis.map(kpi => `
            <div class="kpi-card">
                <div class="kpi-icon ${kpi.iconClass}">${kpi.icon}</div>
                <div class="kpi-content">
                    <div class="kpi-value">
                        ${kpi.value}<span class="unit">${kpi.unit}</span>
                        ${kpi.extra ? `<span class="unit">${kpi.extra}</span>` : ''}
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
        
        // 滿意度各題分數
        let satisfactionHtml = '';
        if (s.satisfactionStats && s.satisfactionStats.count > 0) {
            const avgScores = s.satisfactionStats.avgScores;
            satisfactionHtml = `
                <div class="chart-card">
                    <div class="chart-title">滿意度分析 (${s.satisfactionStats.count} 份回饋)</div>
                    <div class="stats-list" style="padding: 16px 0;">
                        ${Object.values(avgScores).map(item => {
                            const pct = (item.avg / 5) * 100;
                            const color = item.avg >= 4 ? 'green' : item.avg >= 3 ? 'amber' : 'red';
                            return `
                                <div class="stats-item">
                                    <span class="stats-label">${item.label}</span>
                                    <div class="stats-bar-container">
                                        <div class="stats-bar ${color}" style="width: ${pct}%"></div>
                                    </div>
                                    <span class="stats-value">${item.avg.toFixed(1)}/5</span>
                                </div>
                            `;
                        }).join('')}
                        <div style="margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--border); display: flex; justify-content: space-around; text-align: center;">
                            <div>
                                <div style="font-size: 24px; font-weight: 700; color: ${s.satisfactionStats.overallAvg >= 4 ? 'var(--success)' : 'var(--warning)'}">
                                    ${s.satisfactionStats.overallAvg?.toFixed(1) || '-'}
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary);">整體平均</div>
                            </div>
                            <div>
                                <div style="font-size: 24px; font-weight: 700; color: ${s.satisfactionStats.nps >= 50 ? 'var(--success)' : s.satisfactionStats.nps >= 0 ? 'var(--warning)' : 'var(--danger)'}">
                                    ${s.satisfactionStats.nps !== null ? s.satisfactionStats.nps : '-'}
                                </div>
                                <div style="font-size: 12px; color: var(--text-secondary);">NPS 淨推薦值</div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            satisfactionHtml = `
                <div class="chart-card">
                    <div class="chart-title">滿意度分析</div>
                    <div style="text-align: center; padding: 40px 20px; color: var(--text-hint);">
                        <div style="font-size: 14px; margin-bottom: 8px;">[ 無資料 ]</div>
                        <div>尚無滿意度回饋</div>
                    </div>
                </div>
            `;
        }
        
        // SDM 選擇分布
        let sdmHtml = '';
        if (s.sdmStats && s.sdmStats.total > 0) {
            const choices = Object.values(s.sdmStats.choices).sort((a, b) => b.count - a.count);
            sdmHtml = `
                <div class="chart-card">
                    <div class="chart-title">SDM 選擇分布 (${s.sdmStats.completed}/${s.sdmStats.total} 人已選)</div>
                    <div class="stats-list" style="padding: 16px 0;">
                        ${choices.length > 0 ? choices.map(item => {
                            const pct = (item.count / s.sdmStats.completed) * 100;
                            return `
                                <div class="stats-item">
                                    <span class="stats-label">${item.label}</span>
                                    <div class="stats-bar-container">
                                        <div class="stats-bar blue" style="width: ${pct}%"></div>
                                    </div>
                                    <span class="stats-value">${item.count} (${pct.toFixed(0)}%)</span>
                                </div>
                            `;
                        }).join('') : '<div style="text-align: center; color: var(--text-hint); padding: 20px;">尚無選擇記錄</div>'}
                    </div>
                </div>
            `;
        }
        
        // 暫停/終止原因統計
        let statusReasonHtml = '';
        if (s.statusReasonStats) {
            const paused = s.statusReasonStats.paused;
            const terminated = s.statusReasonStats.terminated;
            
            if (paused.total > 0 || terminated.total > 0) {
                let reasonsHtml = '';
                
                if (paused.total > 0) {
                    const pauseReasons = Object.entries(paused.reasons)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count]) => {
                            const pct = (count / paused.total) * 100;
                            return `
                                <div class="stats-item">
                                    <span class="stats-label" style="color: var(--warning);">暫停：${reason}</span>
                                    <div class="stats-bar-container">
                                        <div class="stats-bar amber" style="width: ${pct}%"></div>
                                    </div>
                                    <span class="stats-value">${count}</span>
                                </div>
                            `;
                        }).join('');
                    reasonsHtml += pauseReasons;
                }
                
                if (terminated.total > 0) {
                    const terminateReasons = Object.entries(terminated.reasons)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count]) => {
                            const pct = (count / terminated.total) * 100;
                            return `
                                <div class="stats-item">
                                    <span class="stats-label" style="color: var(--danger);">終止：${reason}</span>
                                    <div class="stats-bar-container">
                                        <div class="stats-bar red" style="width: ${pct}%"></div>
                                    </div>
                                    <span class="stats-value">${count}</span>
                                </div>
                            `;
                        }).join('');
                    reasonsHtml += terminateReasons;
                }
                
                statusReasonHtml = `
                    <div class="chart-card">
                        <div class="chart-title">暫停/終止原因 (暫停 ${paused.total} 人、終止 ${terminated.total} 人)</div>
                        <div class="stats-list" style="padding: 16px 0;">
                            ${reasonsHtml}
                        </div>
                    </div>
                `;
            }
        }
        
        // 先建立圖表容器
        container.innerHTML = `
            <div class="chart-card">
                <div class="chart-title">月度趨勢</div>
                <div class="chart-container">
                    <canvas id="chart-monthly"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">癌別分布</div>
                <div class="chart-container small">
                    <canvas id="chart-cancer"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">介入類型</div>
                <div class="chart-container small">
                    <canvas id="chart-intervention"></canvas>
                </div>
            </div>
            <div class="chart-card">
                <div class="chart-title">反應時間分布</div>
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
            ${satisfactionHtml}
            ${sdmHtml}
            ${statusReasonHtml}
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
                maintainAspectRatio: true,
                aspectRatio: 1, // 保持正方形
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
                ['介入完成率', `${s.completionRate.toFixed(1)}%`, '>=95%', s.completionRate >= 95 ? 'V' : 'O'],
                ['平均反應時間', s.avgResponseTime ? `${s.avgResponseTime.toFixed(1)} 小時` : '-', '<=24小時', s.avgResponseTime && s.avgResponseTime <= 24 ? 'V' : 'O'],
                ['體重維持率', `${s.maintenanceRate.toFixed(1)}%`, '>=85%', s.maintenanceRate >= 85 ? 'V' : 'O'],
                ['副作用追蹤率', `${s.seTrackingRate.toFixed(1)}%`, '>=80%', s.seTrackingRate >= 80 ? 'V' : 'O'],
                ['病人自填率', `${s.selfReportRate.toFixed(1)}%`, '>=60%', s.selfReportRate >= 60 ? 'V' : 'O']
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
            
            y += 12;
            
            // === 圖表區 ===
            // 截取月度趨勢圖
            const monthlyCanvas = document.getElementById('chart-monthly');
            if (monthlyCanvas) {
                pdf.setFontSize(12);
                pdf.setTextColor(44, 62, 80);
                pdf.text('二、月度趨勢', 15, y);
                y += 5;
                
                try {
                    const monthlyImg = monthlyCanvas.toDataURL('image/png');
                    const imgWidth = 180;
                    const imgHeight = 60;
                    pdf.addImage(monthlyImg, 'PNG', 15, y, imgWidth, imgHeight);
                    y += imgHeight + 10;
                } catch (e) {
                    console.warn('月度趨勢圖截取失敗');
                    y += 5;
                }
            }
            
            // 檢查是否需要換頁
            if (y > pageHeight - 80) {
                pdf.addPage();
                y = 20;
            }
            
            // === 癌別與介入並排 ===
            pdf.setFontSize(12);
            pdf.setTextColor(44, 62, 80);
            pdf.text('三、癌別分布', 15, y);
            pdf.text('四、介入類型', 110, y);
            y += 5;
            
            // 截取癌別分布圖 - 保持正方形比例
            const cancerCanvas = document.getElementById('chart-cancer');
            if (cancerCanvas) {
                try {
                    const cancerImg = cancerCanvas.toDataURL('image/png');
                    // 使用正方形尺寸保持圓餅圖不變形
                    pdf.addImage(cancerImg, 'PNG', 15, y, 70, 70);
                } catch (e) {
                    console.warn('癌別分布圖截取失敗');
                }
            }
            
            // 截取介入類型圖 - 保持正方形比例
            const interventionCanvas = document.getElementById('chart-intervention');
            if (interventionCanvas) {
                try {
                    const interventionImg = interventionCanvas.toDataURL('image/png');
                    pdf.addImage(interventionImg, 'PNG', 110, y, 70, 70);
                } catch (e) {
                    console.warn('介入類型圖截取失敗');
                }
            }
            
            y += 78;
            
            // 檢查是否需要換頁
            if (y > pageHeight - 60) {
                pdf.addPage();
                y = 20;
            }
            
            // === 反應時間分布 ===
            pdf.setFontSize(12);
            pdf.setTextColor(44, 62, 80);
            pdf.text('五、反應時間分布', 15, y);
            y += 8;
            
            pdf.setFontSize(10);
            const rtColors = [[107, 191, 138], [228, 185, 90], [217, 123, 123]];
            s.responseTimeDistribution.forEach((item, i) => {
                // 繪製條形
                const barWidth = item.pct * 1.2;
                pdf.setFillColor(...rtColors[i]);
                pdf.rect(20, y - 4, barWidth, 5, 'F');
                
                // 標籤和數值
                pdf.setTextColor(44, 62, 80);
                pdf.text(`${item.label}：${item.count} 次 (${item.pct}%)`, 20 + barWidth + 5, y);
                y += 8;
            });
            
            y += 5;
            
            // === 滿意度摘要 ===
            if (s.satisfactionStats && s.satisfactionStats.count > 0) {
                // 檢查是否需要換頁
                if (y > pageHeight - 50) {
                    pdf.addPage();
                    y = 20;
                }
                
                pdf.setFontSize(12);
                pdf.setTextColor(44, 62, 80);
                pdf.text('六、滿意度分析', 15, y);
                y += 8;
                
                pdf.setFontSize(10);
                pdf.text(`回饋份數：${s.satisfactionStats.count} 份`, 20, y);
                y += 6;
                pdf.text(`整體平均：${s.satisfactionStats.overallAvg?.toFixed(1) || '-'} / 5 分`, 20, y);
                y += 6;
                pdf.text(`NPS 淨推薦值：${s.satisfactionStats.nps !== null ? s.satisfactionStats.nps : '-'}`, 20, y);
                y += 8;
                
                // 各題分數
                const avgScores = s.satisfactionStats.avgScores;
                if (avgScores && Object.keys(avgScores).length > 0) {
                    Object.values(avgScores).forEach(item => {
                        const barWidth = (item.avg / 5) * 80;
                        const color = item.avg >= 4 ? [107, 191, 138] : item.avg >= 3 ? [228, 185, 90] : [217, 123, 123];
                        
                        pdf.setFillColor(...color);
                        pdf.rect(20, y - 4, barWidth, 5, 'F');
                        
                        pdf.setTextColor(44, 62, 80);
                        pdf.text(`${item.label}：${item.avg.toFixed(1)}/5`, 105, y);
                        y += 7;
                    });
                }
            }
            
            // === 頁尾 ===
            const totalPages = pdf.internal.getNumberOfPages();
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i);
                pdf.setFontSize(8);
                pdf.setTextColor(150, 150, 150);
                pdf.text('彰濱秀傳紀念醫院 放射腫瘤科', pageWidth / 2, pageHeight - 10, { align: 'center' });
                pdf.text(`第 ${i} / ${totalPages} 頁`, pageWidth - 20, pageHeight - 10, { align: 'right' });
            }
            
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
