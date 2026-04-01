/**
 * 演示數據模組
 * 產生 80 位測試病人及完整記錄，覆蓋所有功能場景
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
    
    staff: ['王孝宇', '陳詩韻', '廖芝穎', '張雅婷', '李佳蓉'],
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },
    
    daysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return this.formatDate(d);
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
        
        console.log('開始產生 80 位測試病人（含完整功能測試數據）...');
        
        // 初始化設定
        await this.initSettings();
        
        let treatmentId = 0;
        let weightId = 0;
        let seId = 0;
        let intId = 0;
        let satId = 0;
        
        /**
         * 病人分布設計（80位）：
         * 0-15:  治療中，體重正常（測試基本功能）
         * 16-27: 治療中，體重下降達 SDM 閾值，已處置（測試「需關注」）
         * 28-39: 治療中，體重下降達 SDM 閾值，未處置（測試「需處理」）
         * 40-49: 治療中，體重下降達營養師閾值（測試嚴重警示）
         * 50-63: 已結案（測試結案統計、滿意度）
         * 64-73: 暫停中（測試暫停原因）
         * 74-79: 已終止（測試終止原因）
         */
        
        for (let i = 0; i < 80; i++) {
            const surname = this.surnames[i % this.surnames.length];
            const given = this.givenNames[i % this.givenNames.length];
            const name = surname + given;
            const medicalId = `${113 + Math.floor(i / 40)}${String(1001 + i).padStart(4, '0')}`;
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
            let weightScenario; // 'normal', 'sdm', 'nutrition'
            let hasRecentIntervention = false;
            let pauseReason = null, terminateReason = null;
            let sdmChoice = null;
            
            if (i < 16) {
                // 治療中，體重正常
                status = 'active';
                startDaysAgo = 14 + Math.floor(Math.random() * 21);
                weightScenario = 'normal';
            } else if (i < 28) {
                // 治療中，SDM 閾值，已處置（需關注）
                status = 'active';
                startDaysAgo = 21 + Math.floor(Math.random() * 21);
                weightScenario = 'sdm';
                hasRecentIntervention = true;
                sdmChoice = this.sdmChoices[i % this.sdmChoices.length];
            } else if (i < 40) {
                // 治療中，SDM 閾值，未處置（需處理）
                status = 'active';
                startDaysAgo = 21 + Math.floor(Math.random() * 14);
                weightScenario = 'sdm';
                hasRecentIntervention = false;
            } else if (i < 50) {
                // 治療中，營養師閾值
                status = 'active';
                startDaysAgo = 28 + Math.floor(Math.random() * 21);
                weightScenario = 'nutrition';
                hasRecentIntervention = Math.random() < 0.5;
                sdmChoice = this.sdmChoices[Math.floor(Math.random() * 5)]; // 前5個是實際選擇
            } else if (i < 64) {
                // 已結案
                status = 'completed';
                startDaysAgo = 50 + Math.floor(Math.random() * 30);
                endDate = this.daysAgo(5 + Math.floor(Math.random() * 15));
                weightScenario = Math.random() < 0.6 ? 'normal' : 'sdm';
                sdmChoice = Math.random() < 0.7 ? this.sdmChoices[Math.floor(Math.random() * 5)] : null;
            } else if (i < 74) {
                // 暫停中
                status = 'paused';
                startDaysAgo = 21 + Math.floor(Math.random() * 28);
                weightScenario = Math.random() < 0.5 ? 'normal' : 'sdm';
                pauseReason = this.pauseReasons[i % this.pauseReasons.length];
            } else {
                // 已終止
                status = 'terminated';
                startDaysAgo = 35 + Math.floor(Math.random() * 30);
                endDate = this.daysAgo(3 + Math.floor(Math.random() * 20));
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
            if (['head_neck', 'lung', 'esophagus', 'prostate'].includes(cancer.code)) {
                radiationDose = 50 + Math.floor(Math.random() * 20); // 50-70 Gy
                radiationFractions = Math.round(radiationDose / 2); // 每次約 2 Gy
            }
            
            const treatmentData = {
                patient_id: patient.id,
                cancer_type: cancer.code,
                cancer_type_label: cancer.label,
                treatment_intent: intent.code,
                physician: physician.code,
                physician_name: physician.name,
                stage: stage.code,
                treatment_start: this.daysAgo(startDaysAgo),
                baseline_weight: baseWeight,
                status: status,
                radiation_dose: radiationDose,
                radiation_fractions: radiationFractions,
                sdm_choice: sdmChoice,
                sdm_choice_date: sdmChoice ? this.daysAgo(Math.floor(startDaysAgo / 2)) : null,
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
            
            // 產生體重記錄
            const numWeights = Math.floor(startDaysAgo / 4) + 2;
            let currentWeight = baseWeight;
            
            // 根據場景決定體重趨勢
            let weightDelta;
            if (weightScenario === 'normal') {
                weightDelta = -0.05; // 輕微下降或維持
            } else if (weightScenario === 'sdm') {
                weightDelta = -0.25; // 達到 -3% ~ -5%
            } else {
                weightDelta = -0.45; // 達到 -5% 以上
            }
            
            for (let w = 0; w < numWeights; w++) {
                const measureDay = startDaysAgo - Math.floor(w * (startDaysAgo / numWeights));
                currentWeight += weightDelta + (Math.random() - 0.5) * 0.2;
                
                // 限制最低體重
                const minWeight = weightScenario === 'nutrition' 
                    ? baseWeight * 0.92 
                    : (weightScenario === 'sdm' ? baseWeight * 0.95 : baseWeight * 0.98);
                currentWeight = Math.max(currentWeight, minWeight);
                
                await DB.add('weight_records', {
                    treatment_id: treatment.id,
                    weight: parseFloat(currentWeight.toFixed(1)),
                    measure_date: this.daysAgo(measureDay),
                    source: Math.random() < 0.4 ? 'patient' : 'staff',
                    created_at: new Date().toISOString()
                });
                weightId++;
            }
            
            // 產生副作用評估
            if (Math.random() < 0.75) {
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
            
            // 產生介入記錄
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
        console.log(`- 病人：50 位`);
        console.log(`- 療程：50 個`);
        console.log(`- 體重記錄：${weightId} 筆`);
        console.log(`- 副作用評估：${seId} 筆`);
        console.log(`- 介入記錄：${intId} 筆`);
        console.log(`- 滿意度：${satId} 筆`);
        console.log(`\n場景分布：`);
        console.log(`- 治療中（正常）：10 位`);
        console.log(`- 治療中（需關注）：8 位`);
        console.log(`- 治療中（需處理）：7 位`);
        console.log(`- 治療中（嚴重）：5 位`);
        console.log(`- 已結案：8 位`);
        console.log(`- 暫停中：6 位`);
        console.log(`- 已終止：6 位`);
        
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
