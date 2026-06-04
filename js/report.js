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
    
    // 當前選中的 Tab
    selectedTabs: ['all'],
    
    /**
     * Tab 選擇變更
     */
    onTabChange(e) {
        const container = document.querySelector('#page-reports .dashboard-tabs');
        if (!container) return;
        
        const checkboxes = container.querySelectorAll('input[type="checkbox"]');
        const allCheckbox = container.querySelector('input[value="all"]');
        const clickedCheckbox = e?.target || event?.target;
        
        // 如果點擊「全部」
        if (clickedCheckbox?.value === 'all' && clickedCheckbox.checked) {
            // 取消其他所有選項
            checkboxes.forEach(cb => {
                if (cb.value !== 'all') {
                    cb.checked = false;
                    cb.closest('.dashboard-tab-check').classList.remove('active');
                }
            });
            allCheckbox.closest('.dashboard-tab-check').classList.add('active');
            this.selectedTabs = ['all'];
        } else {
            // 點擊其他選項時，取消「全部」
            if (allCheckbox) {
                allCheckbox.checked = false;
                allCheckbox.closest('.dashboard-tab-check').classList.remove('active');
            }
            
            // 收集選中的項目
            this.selectedTabs = [];
            checkboxes.forEach(cb => {
                const label = cb.closest('.dashboard-tab-check');
                if (cb.checked && cb.value !== 'all') {
                    this.selectedTabs.push(cb.value);
                    label.classList.add('active');
                } else if (cb.value !== 'all') {
                    label.classList.remove('active');
                }
            });
            
            // 如果沒有選中任何項目，自動選「全部」
            if (this.selectedTabs.length === 0) {
                allCheckbox.checked = true;
                allCheckbox.closest('.dashboard-tab-check').classList.add('active');
                this.selectedTabs = ['all'];
            }
        }
        
        this.render();
    },
    
    /**
     * 初始化篩選器
     */
    async initFilters() {
        // 載入癌別選項
        const cancerTypes = await Settings.get('cancer_types', []);
        const select = document.getElementById('report-cancer-type');
        select.innerHTML = '<option value="all">全部癌別</option>' + 
            cancerTypes.map(c => `<option value="${c.code}">${c.label}</option>`).join('');
        
        // 設定預設日期
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        document.getElementById('report-date-from').value = formatDate(monthStart);
        document.getElementById('report-date-to').value = formatDate(today);
        
        // 載入年份選項（從最早療程到今年，至少顯示 5 年）
        const allTreatments = await DB.getAll('treatments');
        const currentYear = today.getFullYear();
        let minYear = currentYear - 4; // 預設至少顯示 5 年
        
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
        
        // 預設選擇「全部」
        this.setPeriod('all');
    },
    
    /**
     * 篩選條件變更
     */
    onFilterChange() {
        this.filters.cancerType = document.getElementById('report-cancer-type').value;
        
        const period = this.filters.period;
        
        if (period === 'custom') {
            this.filters.dateFrom = document.getElementById('report-date-from').value;
            this.filters.dateTo = document.getElementById('report-date-to').value;
        } else if (period === 'specific_year') {
            const selectedYear = parseInt(document.getElementById('report-year').value);
            this.filters.dateFrom = `${selectedYear}-01-01`;
            this.filters.dateTo = `${selectedYear}-12-31`;
        }
        
        this.render();
    },
    
    /**
     * 設定期間（按鈕點擊）
     */
    setPeriod(period) {
        this.filters.period = period;
        
        // 更新按鈕狀態
        const container = document.querySelector('#page-reports .db-period-btns');
        if (container) {
            container.querySelectorAll('.btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.period === period);
            });
        }
        
        // 顯示/隱藏日期選擇器
        const dateRange = document.getElementById('report-date-range');
        const yearSelect = document.getElementById('report-year');
        const dateFrom = document.getElementById('report-date-from');
        const dateTo = document.getElementById('report-date-to');
        const dateSep = document.getElementById('report-date-sep');
        
        if (period === 'specific_year') {
            dateRange.style.display = 'flex';
            yearSelect.style.display = 'block';
            dateFrom.style.display = 'none';
            dateSep.style.display = 'none';
            dateTo.style.display = 'none';
            
            const selectedYear = parseInt(yearSelect.value);
            this.filters.dateFrom = `${selectedYear}-01-01`;
            this.filters.dateTo = `${selectedYear}-12-31`;
        } else if (period === 'custom') {
            dateRange.style.display = 'flex';
            yearSelect.style.display = 'none';
            dateFrom.style.display = 'block';
            dateSep.style.display = 'inline';
            dateTo.style.display = 'block';
            
            this.filters.dateFrom = dateFrom.value;
            this.filters.dateTo = dateTo.value;
        } else {
            dateRange.style.display = 'none';
            
            // 計算日期範圍
            const today = new Date();
            let dateFromVal = null;
            let dateToVal = formatDate(today);
            
            switch (period) {
                case 'week':
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - today.getDay());
                    dateFromVal = formatDate(weekStart);
                    break;
                case 'month':
                    dateFromVal = formatDate(new Date(today.getFullYear(), today.getMonth(), 1));
                    break;
                case 'quarter':
                    const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
                    dateFromVal = formatDate(new Date(today.getFullYear(), quarterMonth, 1));
                    break;
                case 'year':
                    dateFromVal = formatDate(new Date(today.getFullYear(), 0, 1));
                    break;
                case 'all':
                    dateFromVal = null;
                    dateToVal = null;
                    break;
            }
            
            this.filters.dateFrom = dateFromVal;
            this.filters.dateTo = dateToVal;
        }
        
        this.render();;
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
        
        // 篩選相關的副作用評估
        const allSideEffects = await DB.getAll('side_effects');
        const filteredSideEffects = allSideEffects.filter(se => 
            filteredTreatmentIds.has(se.treatment_id)
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
        const skippedInterventions = filteredInterventions.filter(i => i.status === 'skipped').length;
        const pendingInterventionsCount = filteredInterventions.filter(i => i.status === 'pending').length;
        const totalInterventions = filteredInterventions.length;
        const interventionRate = totalInterventions > 0 
            ? Math.round(executedInterventions / totalInterventions * 100) 
            : 0;
        
        // 介入反應時間統計（從觸發到執行的天數）
        let totalResponseTime = 0;
        let responseTimeCount = 0;
        let minResponseTime = Infinity;
        let maxResponseTime = 0;
        
        filteredInterventions.filter(i => i.status === 'executed' && i.created_at && i.executed_at).forEach(i => {
            const created = new Date(i.created_at);
            const executed = new Date(i.executed_at);
            const days = Math.round((executed - created) / (1000 * 60 * 60 * 24));
            if (days >= 0) {
                totalResponseTime += days;
                responseTimeCount++;
                if (days < minResponseTime) minResponseTime = days;
                if (days > maxResponseTime) maxResponseTime = days;
            }
        });
        
        const avgResponseTime = responseTimeCount > 0 ? (totalResponseTime / responseTimeCount).toFixed(1) : '-';
        const within24h = filteredInterventions.filter(i => {
            if (i.status !== 'executed' || !i.created_at || !i.executed_at) return false;
            const created = new Date(i.created_at);
            const executed = new Date(i.executed_at);
            const hours = (executed - created) / (1000 * 60 * 60);
            return hours <= 24;
        }).length;
        const within24hRate = executedInterventions > 0 ? Math.round(within24h / executedInterventions * 100) : 0;
        
        // 主治醫師統計
        const physicianStats = {};
        filteredTreatments.forEach(t => {
            const name = t.physician_name || '未指定';
            if (!physicianStats[name]) {
                physicianStats[name] = { active: 0, paused: 0, completed: 0, total: 0 };
            }
            physicianStats[name].total++;
            if (t.status === 'active') physicianStats[name].active++;
            else if (t.status === 'paused') physicianStats[name].paused++;
            else if (t.status === 'completed') physicianStats[name].completed++;
        });
        
        // 介入類型統計（只統計已執行的）
        const interventionByType = {
            'SDM': 0,
            '營養師': 0,
            '鼻胃管': 0,
            '胃造廔': 0,
            '其他': 0
        };
        
        const typeLabels = {
            'sdm': 'SDM',
            'nutrition': '營養師',
            'ng_tube': '鼻胃管',
            'gastrostomy': '胃造廔'
        };
        
        filteredInterventions.filter(i => i.status === 'executed').forEach(i => {
            const label = typeLabels[i.type] || '其他';
            interventionByType[label] = (interventionByType[label] || 0) + 1;
        });
        
        // 移除數量為0的類型
        Object.keys(interventionByType).forEach(key => {
            if (interventionByType[key] === 0) delete interventionByType[key];
        });
        
        // === 新增統計 ===
        
        // 建立病人 ID 映射
        const patientMap = {};
        allPatients.forEach(p => patientMap[p.id] = p);
        
        // 年齡分布
        const ageDistribution = {
            '< 40 歲': 0,
            '40-49 歲': 0,
            '50-59 歲': 0,
            '60-69 歲': 0,
            '70-79 歲': 0,
            '≥ 80 歲': 0
        };
        
        // 性別分布
        const genderDistribution = { '男': 0, '女': 0 };
        
        // 體重相關統計
        let totalBaselineWeight = 0;
        let baselineWeightCount = 0;
        let totalChangeRate = 0;
        let changeRateCount = 0;
        let minChangeRate = 0;
        let maxChangeRate = 0;
        
        // 療程時長統計（已結案的）
        let totalDuration = 0;
        let durationCount = 0;
        
        filteredTreatments.forEach(t => {
            const patient = patientMap[t.patient_id];
            if (!patient) return;
            
            // 年齡分布
            if (patient.birth_date) {
                const age = calculateAge(patient.birth_date);
                if (age < 40) ageDistribution['< 40 歲']++;
                else if (age < 50) ageDistribution['40-49 歲']++;
                else if (age < 60) ageDistribution['50-59 歲']++;
                else if (age < 70) ageDistribution['60-69 歲']++;
                else if (age < 80) ageDistribution['70-79 歲']++;
                else ageDistribution['≥ 80 歲']++;
            }
            
            // 性別分布
            if (patient.gender === 'M') genderDistribution['男']++;
            else if (patient.gender === 'F') genderDistribution['女']++;
            
            // 基準體重
            if (t.baseline_weight) {
                totalBaselineWeight += t.baseline_weight;
                baselineWeightCount++;
            }
            
            // 體重變化率
            const weights = filteredWeightRecords
                .filter(w => w.treatment_id === t.id && !w.unable_to_measure && w.weight)
                .sort((a, b) => new Date(b.measure_date) - new Date(a.measure_date));
            
            if (weights.length > 0 && t.baseline_weight) {
                const rate = calculateWeightChangeRate(weights[0].weight, t.baseline_weight);
                totalChangeRate += rate;
                changeRateCount++;
                if (rate < minChangeRate) minChangeRate = rate;
                if (rate > maxChangeRate) maxChangeRate = rate;
            }
            
            // 療程時長（已結案）
            if ((t.status === 'completed' || t.status === 'terminated') && t.treatment_start && t.treatment_end) {
                const start = new Date(t.treatment_start);
                const end = new Date(t.treatment_end);
                const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
                if (days > 0) {
                    totalDuration += days;
                    durationCount++;
                }
            }
        });
        
        // 移除空的年齡分布
        Object.keys(ageDistribution).forEach(key => {
            if (ageDistribution[key] === 0) delete ageDistribution[key];
        });
        
        const avgBaselineWeight = baselineWeightCount > 0 ? (totalBaselineWeight / baselineWeightCount).toFixed(1) : '-';
        const avgChangeRate = changeRateCount > 0 ? (totalChangeRate / changeRateCount).toFixed(1) : '-';
        const avgDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : '-';
        
        // === 副作用統計 ===
        const sideEffectStats = {
            total: filteredSideEffects.length,
            bySymptom: {},
            byMaxSeverity: { mild: 0, moderate: 0, severe: 0 },
            avgPainScore: 0
        };
        
        // 症狀名稱對照
        const symptomNames = {
            'N': '噁心嘔吐', 'F': '疲勞', 'O': '口腔黏膜炎', 'S': '皮膚反應',
            'W': '吞嚥困難', 'A': '食慾下降', 'D': '腹瀉', 'P': '疼痛'
        };
        
        let totalPainScore = 0;
        let painCount = 0;
        
        filteredSideEffects.forEach(se => {
            if (!se.symptoms) return;
            
            let maxLevel = 0;
            
            se.symptoms.forEach(s => {
                // 統計各症狀出現次數（有症狀的）
                if (s.level > 0) {
                    const name = symptomNames[s.code] || s.code;
                    sideEffectStats.bySymptom[name] = (sideEffectStats.bySymptom[name] || 0) + 1;
                }
                
                // 疼痛分數統計
                if (s.code === 'P' && s.level > 0) {
                    totalPainScore += s.level;
                    painCount++;
                    // 疼痛轉換為標準化等級
                    const painNormalized = s.level <= 3 ? 1 : (s.level <= 6 ? 2 : 3);
                    maxLevel = Math.max(maxLevel, painNormalized);
                } else if (s.level > 0) {
                    maxLevel = Math.max(maxLevel, s.level);
                }
            });
            
            // 統計最嚴重程度分布
            if (maxLevel === 1) sideEffectStats.byMaxSeverity.mild++;
            else if (maxLevel === 2) sideEffectStats.byMaxSeverity.moderate++;
            else if (maxLevel >= 3) sideEffectStats.byMaxSeverity.severe++;
        });
        
        sideEffectStats.avgPainScore = painCount > 0 ? (totalPainScore / painCount).toFixed(1) : '-';
        
        // 滿意度統計
        let satisfactionStats = null;
        const allSatisfaction = await DB.getAll('satisfaction');
        const treatmentIds = filteredTreatments.map(t => t.id);
        const filteredSatisfaction = allSatisfaction.filter(s => treatmentIds.includes(s.treatment_id));
        
        if (filteredSatisfaction.length > 0) {
            let q1Sum = 0, q2Sum = 0, q2Count = 0, q3Sum = 0, q4Sum = 0, q5Sum = 0;
            
            filteredSatisfaction.forEach(s => {
                q1Sum += s.q1 || 0;
                if (s.q2 && s.q2 > 0) {
                    q2Sum += s.q2;
                    q2Count++;
                }
                q3Sum += s.q3 || 0;
                q4Sum += s.q4 || 0;
                q5Sum += s.q5 || 0;
            });
            
            const count = filteredSatisfaction.length;
            satisfactionStats = {
                count,
                q1Avg: count > 0 ? q1Sum / count : null,
                q2Avg: q2Count > 0 ? q2Sum / q2Count : null,
                q3Avg: count > 0 ? q3Sum / count : null,
                q4Avg: count > 0 ? q4Sum / count : null,
                q5Avg: count > 0 ? q5Sum / count : null,
                overallAvg: count > 0 ? (q1Sum + q3Sum + q4Sum + q5Sum) / (count * 4) : null
            };
        }
        
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
        
        // SDM 選擇統計
        const sdmStats = {
            total: 0,
            completed: 0,
            choices: {}
        };
        
        const sdmChoiceLabels = {
            'oral_supplement': '口服營養補充',
            'ng_tube': '鼻胃管',
            'peg_endoscopic': '經皮內視鏡胃造廔術',
            'peg_fluoroscopic': '經皮透視導引胃造廔術',
            'undecided': '尚在考慮中',
            'refused': '病人拒絕'
        };
        
        filteredTreatments.forEach(t => {
            // 檢查是否有體重下降達閾值（需要 SDM）
            const records = filteredWeightRecords.filter(r => r.treatment_id === t.id);
            if (records.length > 0 && t.baseline_weight) {
                const latestWeight = records.sort((a, b) => new Date(b.measure_date) - new Date(a.measure_date))[0];
                const changeRate = ((latestWeight.weight - t.baseline_weight) / t.baseline_weight) * 100;
                
                if (changeRate <= -3) {
                    sdmStats.total++;
                    
                    if (t.sdm_choice && t.sdm_choice !== 'undecided') {
                        sdmStats.completed++;
                        
                        const label = sdmChoiceLabels[t.sdm_choice] || t.sdm_choice;
                        if (!sdmStats.choices[t.sdm_choice]) {
                            sdmStats.choices[t.sdm_choice] = { code: t.sdm_choice, label, count: 0 };
                        }
                        sdmStats.choices[t.sdm_choice].count++;
                    }
                }
            }
        });
        
        sdmStats.completionRate = sdmStats.total > 0 ? (sdmStats.completed / sdmStats.total) * 100 : 0;
        
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
            skippedInterventions,
            pendingInterventionsCount,
            totalInterventions,
            interventionByType,
            // 介入反應時間
            avgResponseTime,
            minResponseTime: responseTimeCount > 0 ? minResponseTime : '-',
            maxResponseTime: responseTimeCount > 0 ? maxResponseTime : '-',
            within24hRate,
            responseTimeCount,
            // 主治醫師統計
            physicianStats,
            // 新增統計
            ageDistribution,
            genderDistribution,
            avgBaselineWeight,
            avgChangeRate,
            minChangeRate: changeRateCount > 0 ? minChangeRate.toFixed(1) : '-',
            maxChangeRate: changeRateCount > 0 ? maxChangeRate.toFixed(1) : '-',
            avgDuration,
            patientCount: new Set(filteredTreatments.map(t => t.patient_id)).size,
            // 副作用統計
            sideEffectStats,
            // 滿意度統計
            satisfactionStats,
            // SDM 選擇統計
            sdmStats
        };
    },
    
    /**
     * 渲染報表頁面
     */
    async render() {
        const container = document.getElementById('report-content');
        const stats = await this.getStats();
        const tabs = this.selectedTabs;
        const showAll = tabs.includes('all');
        
        // 癌別分布圖表資料
        const cancerLabels = Object.keys(stats.cancerDistribution);
        const cancerData = Object.values(stats.cancerDistribution);
        
        // 體重分布圖表資料
        const weightLabels = Object.keys(stats.weightDistribution);
        const weightData = Object.values(stats.weightDistribution);
        
        let html = `
            <div style="margin-bottom: 16px; color: var(--text-secondary);">
                統計區間：${stats.periodLabel}
                ${this.filters.cancerType !== 'all' ? ` · 癌別篩選中` : ''}
            </div>
            <div class="report-grid">
        `;
        
        // 療程統計
        if (showAll || tabs.includes('treatment')) {
            html += `
                <div class="report-card">
                    <div class="report-card-title">療程統計</div>
                    <div class="detail-row">
                        <span>病人數</span>
                        <strong>${stats.patientCount}</strong>
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
                        <span>已結案</span>
                        <strong style="color: var(--success);">${stats.completedCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>已終止</span>
                        <strong>${stats.terminatedCount}</strong>
                    </div>
                    ${stats.avgDuration !== '-' ? `
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                        <div class="detail-row">
                            <span>平均療程</span>
                            <strong>${stats.avgDuration} 天</strong>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // 癌別分布
        if (showAll || tabs.includes('cancer')) {
            html += `
                <div class="report-card">
                    <div class="report-card-title">癌別分布</div>
                    <div class="chart-container">
                        <canvas id="cancer-chart"></canvas>
                    </div>
                </div>
            `;
        }
        
        // 體重變化分布
        if (showAll || tabs.includes('weight')) {
            html += `
                <div class="report-card">
                    <div class="report-card-title">體重變化分布</div>
                    <div class="chart-container">
                        <canvas id="weight-chart"></canvas>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-card-title">體重統計</div>
                    <div class="detail-row">
                        <span>平均基準體重</span>
                        <strong>${stats.avgBaselineWeight} kg</strong>
                    </div>
                    <div class="detail-row">
                        <span>平均變化率</span>
                        <strong class="${parseFloat(stats.avgChangeRate) < -3 ? 'text-danger' : ''}">${stats.avgChangeRate}%</strong>
                    </div>
                    <div class="detail-row">
                        <span>最大下降</span>
                        <strong class="text-danger">${stats.minChangeRate}%</strong>
                    </div>
                    <div class="detail-row">
                        <span>最大上升</span>
                        <strong style="color: var(--success);">${stats.maxChangeRate}%</strong>
                    </div>
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                    <div class="detail-row">
                        <span>體重記錄數</span>
                        <strong>${stats.weightRecordCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>平均每療程</span>
                        <strong>${stats.totalTreatments > 0 ? (stats.weightRecordCount / stats.totalTreatments).toFixed(1) : 0} 筆</strong>
                    </div>
                </div>
            `;
        }
        
        // 介入統計
        if (showAll || tabs.includes('intervention')) {
            html += `
                <div class="report-card">
                    <div class="report-card-title">介入統計</div>
                    <div class="detail-row">
                        <span>待處理</span>
                        <strong style="color: var(--warning);">${stats.pendingCount}</strong>
                    </div>
                    <div class="detail-row">
                        <span>已執行</span>
                        <strong style="color: var(--success);">${stats.executedInterventions}</strong>
                    </div>
                    <div class="detail-row">
                        <span>不執行</span>
                        <strong style="color: var(--text-hint);">${stats.skippedInterventions}</strong>
                    </div>
                    <div class="detail-row">
                        <span>介入總數</span>
                        <strong>${stats.totalInterventions}</strong>
                    </div>
                    <div class="detail-row">
                        <span>執行率</span>
                        <strong>${stats.interventionRate}%</strong>
                    </div>
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                    <div class="report-card-title" style="font-size: 12px; margin-bottom: 4px;">已執行介入類型</div>
                    ${Object.entries(stats.interventionByType).map(([type, count]) => `
                        <div class="detail-row" style="font-size: 13px;">
                            <span>${type}</span>
                            <strong>${count}</strong>
                        </div>
                    `).join('') || '<div style="color: var(--text-hint); font-size: 12px;">無資料</div>'}
                </div>
                
                <div class="report-card">
                    <div class="report-card-title">介入反應時間</div>
                    <div class="detail-row">
                        <span>平均反應時間</span>
                        <strong>${stats.avgResponseTime !== '-' ? stats.avgResponseTime + ' 天' : '-'}</strong>
                    </div>
                    <div class="detail-row">
                        <span>最短反應</span>
                        <strong style="color: var(--success);">${stats.minResponseTime !== '-' ? stats.minResponseTime + ' 天' : '-'}</strong>
                    </div>
                    <div class="detail-row">
                        <span>最長反應</span>
                        <strong style="color: var(--warning);">${stats.maxResponseTime !== '-' ? stats.maxResponseTime + ' 天' : '-'}</strong>
                    </div>
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                    <div class="detail-row">
                        <span>24小時內執行</span>
                        <strong style="color: var(--success);">${stats.within24hRate}%</strong>
                    </div>
                    <div class="detail-row">
                        <span>統計樣本數</span>
                        <strong>${stats.responseTimeCount}</strong>
                    </div>
                </div>
                
                <div class="report-card">
                    <div class="report-card-title">SDM 選擇統計</div>
                    <div class="detail-row">
                        <span>需 SDM 人數</span>
                        <strong>${stats.sdmStats.total}</strong>
                    </div>
                    <div class="detail-row">
                        <span>已完成選擇</span>
                        <strong style="color: var(--success);">${stats.sdmStats.completed}</strong>
                    </div>
                    <div class="detail-row">
                        <span>完成率</span>
                        <strong>${stats.sdmStats.completionRate.toFixed(1)}%</strong>
                    </div>
                    ${Object.keys(stats.sdmStats.choices).length > 0 ? `
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                        <div class="report-card-title" style="font-size: 12px; margin-bottom: 4px;">選擇分布</div>
                        ${Object.values(stats.sdmStats.choices).sort((a, b) => b.count - a.count).map(item => `
                            <div class="detail-row" style="font-size: 13px;">
                                <span>${item.label}</span>
                                <strong>${item.count}</strong>
                            </div>
                        `).join('')}
                    ` : ''}
                </div>
            `;
        }
        
        // 主治醫師統計
        if (showAll || tabs.includes('physician')) {
            html += `
                <div class="report-card">
                    <div class="report-card-title">主治醫師統計</div>
                    ${Object.keys(stats.physicianStats).length > 0 ?
                        Object.entries(stats.physicianStats)
                            .sort((a, b) => b[1].total - a[1].total)
                            .map(([name, data]) => `
                                <div class="detail-row" style="font-size: 13px;">
                                    <span>${name}</span>
                                    <span>
                                        <span style="color: var(--primary);">${data.active}</span> /
                                        <span style="color: var(--warning);">${data.paused}</span> /
                                        <span style="color: var(--success);">${data.completed}</span>
                                        <span style="color: var(--text-hint); margin-left: 4px;">(${data.total})</span>
                                    </span>
                                </div>
                            `).join('') + `
                        <div style="font-size: 11px; color: var(--text-hint); margin-top: 8px; text-align: right;">
                            治療中 / 暫停中 / 結案 (總數)
                        </div>
                    ` : '<div style="color: var(--text-hint); font-size: 12px;">無資料</div>'}
                </div>
            `;
        }
        
        // 人口統計（年齡、性別）
        if (showAll || tabs.includes('demographic')) {
            html += `
                <div class="report-card">
                    <div class="report-card-title">年齡分布</div>
                    ${Object.entries(stats.ageDistribution).length > 0 ? 
                        Object.entries(stats.ageDistribution).map(([age, count]) => `
                            <div class="detail-row" style="font-size: 13px;">
                                <span>${age}</span>
                                <strong>${count}</strong>
                            </div>
                        `).join('') : 
                        '<div style="color: var(--text-hint); font-size: 12px;">無資料</div>'
                    }
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                    <div class="report-card-title" style="font-size: 12px; margin-bottom: 4px;">性別分布</div>
                    <div class="detail-row" style="font-size: 13px;">
                        <span>男</span>
                        <strong>${stats.genderDistribution['男']}</strong>
                    </div>
                    <div class="detail-row" style="font-size: 13px;">
                        <span>女</span>
                        <strong>${stats.genderDistribution['女']}</strong>
                    </div>
                </div>
            `;
        }
        
        // 副作用評估統計
        if (showAll || tabs.includes('sideeffect')) {
            html += `
                <div class="report-card">
                    <div class="report-card-title">副作用評估統計</div>
                    <div class="detail-row">
                        <span>評估記錄數</span>
                        <strong>${stats.sideEffectStats.total}</strong>
                    </div>
                    <div class="detail-row">
                        <span>平均疼痛分數</span>
                        <strong>${stats.sideEffectStats.avgPainScore}/10</strong>
                    </div>
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                    <div class="report-card-title" style="font-size: 12px; margin-bottom: 4px;">最嚴重程度分布</div>
                    <div class="detail-row" style="font-size: 13px;">
                        <span style="color: #6BBF8A;">輕微</span>
                        <strong>${stats.sideEffectStats.byMaxSeverity.mild}</strong>
                    </div>
                    <div class="detail-row" style="font-size: 13px;">
                        <span style="color: #E4B95A;">中等</span>
                        <strong>${stats.sideEffectStats.byMaxSeverity.moderate}</strong>
                    </div>
                    <div class="detail-row" style="font-size: 13px;">
                        <span style="color: #D97B7B;">嚴重</span>
                        <strong>${stats.sideEffectStats.byMaxSeverity.severe}</strong>
                    </div>
                    <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                    <div class="report-card-title" style="font-size: 12px; margin-bottom: 4px;">常見症狀</div>
                    ${Object.entries(stats.sideEffectStats.bySymptom).length > 0 ? 
                        Object.entries(stats.sideEffectStats.bySymptom)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                            .map(([symptom, count]) => `
                                <div class="detail-row" style="font-size: 13px;">
                                    <span>${symptom}</span>
                                    <strong>${count}</strong>
                                </div>
                            `).join('') : 
                        '<div style="color: var(--text-hint); font-size: 12px;">無資料</div>'
                    }
                </div>
            `;
        }
        
        // 滿意度
        if (showAll || tabs.includes('satisfaction')) {
            if (stats.satisfactionStats) {
                html += `
                    <div class="report-card">
                        <div class="report-card-title">滿意度統計</div>
                        <div class="detail-row">
                            <span>填寫份數</span>
                            <strong>${stats.satisfactionStats.count}</strong>
                        </div>
                        <div class="detail-row">
                            <span>整體滿意度</span>
                            <strong>${stats.satisfactionStats.overallAvg?.toFixed(1) || '-'}/5</strong>
                        </div>
                        <hr style="margin: 8px 0; border: none; border-top: 1px solid var(--border);">
                        <div class="report-card-title" style="font-size: 12px; margin-bottom: 4px;">各題平均</div>
                        <div class="detail-row" style="font-size: 13px;">
                            <span>科部服務</span>
                            <strong>${stats.satisfactionStats.q1Avg?.toFixed(1) || '-'}</strong>
                        </div>
                        <div class="detail-row" style="font-size: 13px;">
                            <span>營養師協助</span>
                            <strong>${stats.satisfactionStats.q2Avg?.toFixed(1) || '-'}</strong>
                        </div>
                        <div class="detail-row" style="font-size: 13px;">
                            <span>APP 操作</span>
                            <strong>${stats.satisfactionStats.q3Avg?.toFixed(1) || '-'}</strong>
                        </div>
                        <div class="detail-row" style="font-size: 13px;">
                            <span>療程說明</span>
                            <strong>${stats.satisfactionStats.q4Avg?.toFixed(1) || '-'}</strong>
                        </div>
                        <div class="detail-row" style="font-size: 13px;">
                            <span>推薦意願 (NPS)</span>
                            <strong>${stats.satisfactionStats.q5Avg?.toFixed(1) || '-'}</strong>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="report-card">
                        <div class="report-card-title">滿意度統計</div>
                        <div style="color: var(--text-hint); font-size: 12px; padding: 20px 0; text-align: center;">尚無滿意度資料</div>
                    </div>
                `;
            }
        }
        
        html += '</div>';
        
        // 如果沒有任何內容
        if (!showAll && tabs.length === 0) {
            html = '<div style="text-align: center; padding: 40px; color: var(--text-hint);">請選擇至少一個統計分類</div>';
        }
        
        container.innerHTML = html;
        
        // 渲染圖表
        setTimeout(() => {
            if (showAll || tabs.includes('cancer')) {
                this.renderCancerChart(cancerLabels, cancerData);
            }
            if (showAll || tabs.includes('weight')) {
                this.renderWeightChart(weightLabels, weightData);
            }
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
                'SDM選擇': formatSDMChoice(t.sdm_choice),
                'SDM選擇日期': t.sdm_choice_date ? formatDate(t.sdm_choice_date, 'YYYY-MM-DD') : '-',
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
        
        const result = await downloadExcel(wb, filename);
        if (result) {
            showToast('Excel 已下載');
        }
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
