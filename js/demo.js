/**
 * 演示數據模組
 * 產生 100 位測試病人及完整記錄，覆蓋所有功能場景
 * 收案時間範圍：2024-01-01 ~ 2026-04-03
 */

const DemoData = {
    surnames: ['王', '李', '張', '劉', '陳', '楊', '黃', '吳', '趙', '周', '林', '徐', '孫', '馬', '朱', '胡', '郭', '何', '高', '羅', '鄭', '許', '蔡', '謝', '洪'],
    givenNames: ['志明', '淑芬', '俊傑', '美玲', '建宏', '雅婷', '宗翰', '怡君', '冠宇', '佳蓉', '承恩', '詩涵', '家豪', '雨萱', '柏翰', '欣怡', '宥廷', '芷涵', '睿恩', '品妍', '志豪', '怡萱', '冠廷', '雅琪', '俊宏'],
    
    cancerTypes: [
        { code: 'head_neck', label: '頭頸癌' },
        { code: 'lung', label: '肺癌' },
        { code: 'esophagus', label: '食道癌' },
        { code: 'breast', label: '乳癌' },
        { code: 'prostate', label: '攝護腺癌' },
        { code: 'liver', label: '肝癌' },
        { code: 'other', label: '其他' }
    ],
    
    treatmentIntents: [
        { code: 'curative', label: '根治性' },
        { code: 'palliative', label: '緩和性' },
        { code: 'adjuvant', label: '輔助性' },
        { code: 'neoadjuvant', label: '前導性' }
    ],
    
    physicians: [
        { code: 'hsiung', name: '熊敬業' },
        { code: 'liu', name: '劉育昌' },
        { code: 'lin', name: '林伯儒' }
    ],
    
    stages: [
        { code: '0', label: '0期' },
        { code: '1', label: 'I期' },
        { code: '2', label: 'II期' },
        { code: '3', label: 'III期' },
        { code: '4', label: 'IV期' }
    ],
    
    sdmChoices: ['oral_supplement', 'ng_tube', 'peg_endoscopic', 'peg_fluoroscopic', 'oral_only', 'undecided', 'refused'],
    
    pauseReasons: ['身體不適', '治療副作用嚴重', '病人要求暫停', '等待其他檢查', '家庭因素'],
    terminateReasons: ['轉院', '放棄治療', '病情惡化', '病人過世', '經濟因素', '其他原因'],
    
    staff: ['王孝宇', '陳詩韻', '廖芝穎', '林廣軒', '吳美玉', '楊欣菊'],
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },
    
    // 從今天往前算 n 天
    daysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return this.formatDate(d);
    },
    
    // 產生指定範圍內的隨機日期（2024-01-01 ~ 2026-04-03）
    randomDateInRange(minDaysAgo, maxDaysAgo) {
        const days = minDaysAgo + Math.floor(Math.random() * (maxDaysAgo - minDaysAgo));
        return this.daysAgo(days);
    },
    
    randomPhone() {
        return `09${Math.floor(10000000 + Math.random() * 90000000)}`;
    },
    
    randomBirthDate() {
        const year = 1940 + Math.floor(Math.random() * 50);
        const month = String(1 + Math.floor(Math.random() * 12)).padStart(2, '0');
        const day = String(1 + Math.floor(Math.random() * 28)).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    async init() {
        const patientCount = await DB.count('patients');
        if (patientCount > 0) {
            console.log('已有資料，跳過演示數據初始化');
            return false;
        }
        
        console.log('開始產生 100 位測試病人（2024-2026 完整功能測試數據）...');
        
        // 初始化設定
        await this.initSettings();
        
        let treatmentId = 0;
        let weightId = 0;
        let seId = 0;
        let intId = 0;
        let satId = 0;
        
        // 今天日期
        const todayStr = this.formatDate(new Date());
        
        // 計算 2024-01-01 距今天數（約 820 天）
        const maxDaysAgo = Math.floor((new Date() - new Date('2024-01-01')) / (1000 * 60 * 60 * 24));
        
        /**
         * 病人分布設計（100位）：
         * 
         * === 治療中 ===
         * 0-9:   體重正常（10人）- 近期收案
         * 10-17: 需關注（8人）- 達 SDM 閾值，7天內有處置
         * 18-25: 需處理（8人）- 達 SDM 閾值，7天內無處置
         * 26-31: 營養師閾值（6人）
         * 32-35: 待輸體重（4人）- 超過7天沒量體重
         * 36-39: 待補資料（4人）- 缺少基準體重/醫師/劑量
         * 
         * === 待上線 ===
         * 40-42: 待上線（3人）- 首療日期在未來 1-14 天
         * 43-44: 本日上線（2人）- 首療日期是今天
         * 
         * === 歷史案例（2024-2025）===
         * 45-64: 已結案（20人）- 含滿意度調查
         * 65-79: 暫停中（15人）
         * 80-99: 已終止（20人）
         */
        
        for (let i = 0; i < 100; i++) {
            const surname = this.surnames[i % this.surnames.length];
            const given = this.givenNames[i % this.givenNames.length];
            const name = surname + given;
            const medicalId = `${113 + Math.floor(i / 50)}${String(1001 + i).padStart(4, '0')}`;
            const gender = Math.random() < 0.5 ? 'M' : 'F';
            
            // 建立病人
            const patient = await DB.add('patients', {
                medical_id: medicalId,
                name: name,
                gender: gender,
                birth_date: this.randomBirthDate(),
                phone: Math.random() < 0.7 ? this.randomPhone() : null,
                created_at: new Date().toISOString()
            });
            
            // 決定狀態和場景
            let status, startDaysAgo, endDate = null;
            let weightScenario = 'normal'; // 'normal', 'sdm', 'nutrition', 'overdue', 'none'
            let hasRecentIntervention = false;
            let pauseReason = null, terminateReason = null;
            let sdmChoice = null;
            let incompleteData = false;
            let futureStart = false;
            let todayStart = false;
            
            if (i < 10) {
                // 治療中，體重正常（近期收案）
                status = 'active';
                startDaysAgo = 7 + Math.floor(Math.random() * 28); // 7-35 天前
                weightScenario = 'normal';
            } else if (i < 18) {
                // 治療中，SDM 閾值，已處置（需關注）
                status = 'active';
                startDaysAgo = 21 + Math.floor(Math.random() * 28);
                weightScenario = 'sdm';
                hasRecentIntervention = true;
                sdmChoice = this.sdmChoices[i % this.sdmChoices.length];
            } else if (i < 26) {
                // 治療中，SDM 閾值，未處置（需處理）
                status = 'active';
                startDaysAgo = 21 + Math.floor(Math.random() * 21);
                weightScenario = 'sdm';
                hasRecentIntervention = false;
            } else if (i < 32) {
                // 治療中，營養師閾值
                status = 'active';
                startDaysAgo = 35 + Math.floor(Math.random() * 28);
                weightScenario = 'nutrition';
                hasRecentIntervention = Math.random() < 0.5;
                sdmChoice = this.sdmChoices[Math.floor(Math.random() * 5)];
            } else if (i < 36) {
                // 治療中，待輸體重（超過7天沒量）
                status = 'active';
                startDaysAgo = 21 + Math.floor(Math.random() * 21);
                weightScenario = 'overdue';
            } else if (i < 40) {
                // 治療中，待補資料
                status = 'active';
                startDaysAgo = 7 + Math.floor(Math.random() * 14);
                weightScenario = 'normal';
                incompleteData = true;
            } else if (i < 43) {
                // 待上線（首療日期在未來 1-14 天）
                status = 'active';
                startDaysAgo = -(1 + Math.floor(Math.random() * 14)); // 負數表示未來
                weightScenario = 'none';
                futureStart = true;
            } else if (i < 45) {
                // 本日上線（首療日期是今天）
                status = 'active';
                startDaysAgo = 0;
                weightScenario = 'none';
                todayStart = true;
            } else if (i < 65) {
                // 已結案（2024-2025 歷史案例）
                status = 'completed';
                startDaysAgo = 90 + Math.floor(Math.random() * (maxDaysAgo - 120)); // 90天~最遠
                endDate = this.daysAgo(30 + Math.floor(Math.random() * 60));
                weightScenario = Math.random() < 0.6 ? 'normal' : 'sdm';
                sdmChoice = Math.random() < 0.7 ? this.sdmChoices[Math.floor(Math.random() * 5)] : null;
            } else if (i < 80) {
                // 暫停中
                status = 'paused';
                startDaysAgo = 45 + Math.floor(Math.random() * 180);
                weightScenario = Math.random() < 0.5 ? 'normal' : 'sdm';
                pauseReason = this.pauseReasons[i % this.pauseReasons.length];
            } else {
                // 已終止（2024-2025 歷史案例）
                status = 'terminated';
                startDaysAgo = 60 + Math.floor(Math.random() * (maxDaysAgo - 90));
                endDate = this.daysAgo(14 + Math.floor(Math.random() * 45));
                weightScenario = 'sdm';
                terminateReason = this.terminateReasons[i % this.terminateReasons.length];
            }
            
            const cancer = this.cancerTypes[i % this.cancerTypes.length];
            const intent = this.treatmentIntents[i % this.treatmentIntents.length];
            const physician = this.physicians[i % this.physicians.length];
            const stage = this.stages[1 + Math.floor(Math.random() * 4)]; // I-IV 期
            const baseWeight = 50 + Math.floor(Math.random() * 30);
            
            // 放療劑量（頭頸癌、肺癌等通常有）
            let radiationDose = null, radiationFractions = null;
            if (!incompleteData && ['head_neck', 'lung', 'esophagus', 'prostate'].includes(cancer.code)) {
                radiationDose = 50 + Math.floor(Math.random() * 20); // 50-70 Gy
                radiationFractions = Math.round(radiationDose / 2); // 每次約 2 Gy
            }
            
            // 計算首療日期
            let treatmentStartDate;
            if (futureStart) {
                // 未來日期
                const futureDate = new Date();
                futureDate.setDate(futureDate.getDate() + Math.abs(startDaysAgo));
                treatmentStartDate = this.formatDate(futureDate);
            } else if (todayStart) {
                treatmentStartDate = todayStr;
            } else {
                treatmentStartDate = this.daysAgo(startDaysAgo);
            }
            
            const treatmentData = {
                patient_id: patient.id,
                cancer_type: cancer.code,
                cancer_type_label: cancer.label,
                treatment_intent: intent.code,
                physician: incompleteData && i % 2 === 0 ? null : physician.code,
                physician_name: incompleteData && i % 2 === 0 ? null : physician.name,
                stage: stage.code,
                treatment_start: treatmentStartDate,
                baseline_weight: incompleteData && i % 3 === 0 ? null : baseWeight,
                status: status,
                radiation_dose: incompleteData ? null : radiationDose,
                radiation_fractions: incompleteData ? null : radiationFractions,
                sdm_choice: sdmChoice,
                sdm_choice_date: sdmChoice ? this.daysAgo(Math.floor(Math.abs(startDaysAgo) / 2)) : null,
                created_at: new Date().toISOString()
            };
            
            if (endDate) {
                treatmentData.completed_at = status === 'completed' ? endDate + 'T10:00:00.000Z' : null;
                treatmentData.terminated_at = status === 'terminated' ? endDate + 'T10:00:00.000Z' : null;
            }
            if (pauseReason) {
                treatmentData.pause_reason = pauseReason;
                treatmentData.paused_at = this.daysAgo(3 + Math.floor(Math.random() * 5)) + 'T10:00:00.000Z';
            }
            if (terminateReason) {
                treatmentData.terminate_reason = terminateReason;
            }
            
            const treatment = await DB.add('treatments', treatmentData);
            treatmentId++;
            
            // 在迴圈外宣告 currentWeight，供後續介入記錄使用
            let currentWeight = baseWeight || 60;
            
            // 產生體重記錄（待上線、本日上線不產生）
            if (weightScenario !== 'none' && startDaysAgo > 0) {
                let numWeights;
                if (weightScenario === 'overdue') {
                    // 待輸體重：只產生早期幾筆，最後一筆在 8-14 天前
                    numWeights = 2 + Math.floor(Math.random() * 2);
                } else {
                    numWeights = Math.floor(startDaysAgo / 4) + 2;
                }
                
                // 根據場景決定體重趨勢
                let weightDelta;
                if (weightScenario === 'normal' || weightScenario === 'overdue') {
                    weightDelta = -0.05;
                } else if (weightScenario === 'sdm') {
                    weightDelta = -0.25;
                } else {
                    weightDelta = -0.45;
                }
                
                for (let w = 0; w < numWeights; w++) {
                    let measureDay;
                    if (weightScenario === 'overdue') {
                        // 待輸體重：最後一筆在 8-14 天前（確保超過 7 天）
                        measureDay = 8 + w * 7 + Math.floor(Math.random() * 3);
                    } else {
                        measureDay = startDaysAgo - Math.floor(w * (startDaysAgo / numWeights));
                    }
                    
                    currentWeight += weightDelta + (Math.random() - 0.5) * 0.2;
                    
                    const minWeight = (baseWeight || 60) * (weightScenario === 'nutrition' ? 0.92 : (weightScenario === 'sdm' ? 0.95 : 0.98));
                    currentWeight = Math.max(currentWeight, minWeight);
                    
                    // 計算變化率
                    const effectiveBase = baseWeight || 60;
                    const changeRate = ((currentWeight - effectiveBase) / effectiveBase) * 100;
                    
                    await DB.add('weight_records', {
                        treatment_id: treatment.id,
                        weight: parseFloat(currentWeight.toFixed(1)),
                        change_rate: parseFloat(changeRate.toFixed(1)),
                        measure_date: this.daysAgo(measureDay),
                        source: Math.random() < 0.4 ? 'patient' : 'staff',
                        created_at: new Date().toISOString()
                    });
                    weightId++;
                }
            }
            
            // 產生副作用評估（只有已開始治療的病人）
            if (!futureStart && !todayStart && Math.random() < 0.75) {
                const numSE = 2 + Math.floor(Math.random() * 4);
                for (let s = 0; s < numSE; s++) {
                    const assessDay = startDaysAgo - Math.floor(s * (startDaysAgo / numSE));
                    const symptoms = [];
                    
                    // 使用正確的症狀代碼
                    if (Math.random() < 0.5) symptoms.push({ code: 'N', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.6) symptoms.push({ code: 'F', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.4) symptoms.push({ code: 'O', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.5) symptoms.push({ code: 'S', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.4) symptoms.push({ code: 'D', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.4) symptoms.push({ code: 'A', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.3) symptoms.push({ code: 'R', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.5) symptoms.push({ code: 'P', level: Math.floor(Math.random() * 8) });
                    
                    if (symptoms.length > 0) {
                        await DB.add('side_effects', {
                            treatment_id: treatment.id,
                            assess_date: this.daysAgo(assessDay),
                            symptoms: symptoms,
                            source: Math.random() < 0.5 ? 'patient' : 'staff',
                            created_at: new Date().toISOString()
                        });
                        seId++;
                    }
                }
            }
            
            // 產生介入記錄（只有已開始治療且有體重記錄的病人）
            if (weightScenario !== 'none' && startDaysAgo > 0 && baseWeight) {
                const weightChange = ((currentWeight - baseWeight) / baseWeight) * 100;
                
                if (weightChange <= -3) {
                    // SDM 介入
                    let intStatus;
                    if (hasRecentIntervention) {
                        intStatus = 'executed';
                    } else if (Math.random() < 0.3) {
                        intStatus = 'contacted';
                    } else {
                        intStatus = 'pending';
                    }
                    
                    const createdDaysAgo = hasRecentIntervention ? 3 : 10; // 已處置的在7天內，未處置的在7天前
                    
                    const intData = {
                        treatment_id: treatment.id,
                        type: 'sdm',
                        trigger: 'weight_loss_3',
                        trigger_value: -3,
                        status: intStatus,
                        created_at: this.daysAgo(createdDaysAgo) + 'T10:00:00.000Z'
                    };
                    
                    if (intStatus !== 'pending') {
                        intData.contacted_at = this.daysAgo(hasRecentIntervention ? 2 : 8) + 'T14:00:00.000Z';
                        intData.contacted_by = this.staff[Math.floor(Math.random() * 3)];
                    }
                    if (intStatus === 'executed') {
                        intData.executed_at = this.daysAgo(hasRecentIntervention ? 1 : 7) + 'T16:00:00.000Z';
                        intData.executed_by = this.staff[Math.floor(Math.random() * 3)];
                    }
                    
                    await DB.add('interventions', intData);
                    intId++;
                }
                
                if (weightChange <= -5) {
                    // 營養師介入
                    const intStatus = Math.random() < 0.7 ? 'executed' : 'pending';
                    const intData = {
                        treatment_id: treatment.id,
                        type: 'nutrition',
                        trigger: 'weight_loss_5',
                        trigger_value: -5,
                        status: intStatus,
                        created_at: this.daysAgo(4) + 'T09:00:00.000Z'
                    };
                    
                    if (intStatus === 'executed') {
                        intData.contacted_at = this.daysAgo(3) + 'T11:00:00.000Z';
                        intData.contacted_by = this.staff[Math.floor(Math.random() * 3)];
                        intData.executed_at = this.daysAgo(2) + 'T15:00:00.000Z';
                        intData.executed_by = this.staff[Math.floor(Math.random() * 3)];
                    }
                    
                    await DB.add('interventions', intData);
                    intId++;
                }
            }
            
            // 產生滿意度 - 已結案 + 部分進行中
            if (status === 'completed' || (status === 'active' && i < 15)) {
                await DB.add('satisfaction', {
                    treatment_id: treatment.id,
                    q1: 3 + Math.floor(Math.random() * 3), // 3-5
                    q2: Math.random() < 0.25 ? 0 : (3 + Math.floor(Math.random() * 3)), // 25% 未使用
                    q3: 3 + Math.floor(Math.random() * 3), // 3-5
                    q4: 3 + Math.floor(Math.random() * 3), // 3-5
                    q5: 3 + Math.floor(Math.random() * 3), // 3-5 NPS
                    feedback: ['服務很好', '醫護人員很親切', 'APP 很方便使用', '感謝醫療團隊的照顧', ''][Math.floor(Math.random() * 5)],
                    created_at: (endDate || this.daysAgo(1)) + 'T10:00:00.000Z'
                });
                satId++;
            }
        }
        
        console.log(`演示數據初始化完成：`);
        console.log(`- 病人：100 位`);
        console.log(`- 療程：100 個`);
        console.log(`- 體重記錄：${weightId} 筆`);
        console.log(`- 副作用評估：${seId} 筆`);
        console.log(`- 介入記錄：${intId} 筆`);
        console.log(`- 滿意度：${satId} 筆`);
        console.log(`\n場景分布：`);
        console.log(`- 治療中（正常）：10 位`);
        console.log(`- 治療中（需關注）：8 位`);
        console.log(`- 治療中（需處理）：8 位`);
        console.log(`- 治療中（嚴重）：6 位`);
        console.log(`- 待輸體重：4 位`);
        console.log(`- 待補資料：4 位`);
        console.log(`- 待上線：3 位`);
        console.log(`- 本日上線：2 位`);
        console.log(`- 已結案：20 位`);
        console.log(`- 暫停中：15 位`);
        console.log(`- 已終止：20 位`);
        console.log(`\n收案時間範圍：2024-01-01 ~ 2026-04-03`);
        
        return true;
    },
    
    /**
     * 初始化系統設定
     */
    async initSettings() {
        // 癌別
        await Settings.set('cancer_types', this.cancerTypes);
        
        // 治療目的
        await Settings.set('treatment_intents', this.treatmentIntents);
        
        // 主治醫師
        await Settings.set('physicians', this.physicians);
        
        // 期別
        await Settings.set('stages', this.stages);
        
        // 人員（純字串陣列）
        await Settings.set('staff_list', this.staff);
        
        // 暫停原因
        await Settings.set('pause_reasons', this.pauseReasons.map(label => ({ 
            code: 'reason_' + Date.now() + Math.random(), 
            label 
        })));
        
        // 終止原因
        await Settings.set('terminate_reasons', this.terminateReasons.map(label => ({ 
            code: 'reason_' + Date.now() + Math.random(), 
            label 
        })));
        
        // 警示規則（格式：cancer_type, sdm_threshold, nutrition_threshold）
        await Settings.set('alert_rules', [
            { cancer_type: 'default', sdm_threshold: -3, nutrition_threshold: -5 }
        ]);
        
        console.log('系統設定初始化完成');
    }
};
