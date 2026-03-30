/**
 * 演示數據模組
 * 產生 50 位測試病人及完整記錄，用於展示系統所有功能
 */

const DemoData = {
    // 病人姓名庫
    surnames: ['王', '李', '張', '劉', '陳', '楊', '黃', '吳', '趙', '周', '林', '徐', '孫', '馬', '朱', '胡', '郭', '何', '高', '羅'],
    givenNames: ['志明', '淑芬', '俊傑', '美玲', '建宏', '雅婷', '宗翰', '怡君', '冠宇', '佳蓉', '承恩', '詩涵', '家豪', '雨萱', '柏翰', '欣怡', '宥廷', '芷涵', '睿恩', '品妍'],
    
    // 癌別設定
    cancerTypes: [
        { code: 'head_neck', label: '頭頸癌', weight: 35 },
        { code: 'lung', label: '肺癌', weight: 20 },
        { code: 'esophagus', label: '食道癌', weight: 15 },
        { code: 'breast', label: '乳癌', weight: 10 },
        { code: 'prostate', label: '攝護腺癌', weight: 8 },
        { code: 'liver', label: '肝癌', weight: 7 },
        { code: 'other', label: '其他', weight: 5 }
    ],
    
    // 執行人員
    staff: ['王孝宇', '陳詩韻', '廖芝穎'],
    
    /**
     * 產生隨機日期
     */
    randomDate(startDaysAgo, endDaysAgo) {
        const now = new Date();
        const start = new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000);
        const diff = end.getTime() - start.getTime();
        return new Date(start.getTime() + Math.random() * diff);
    },
    
    /**
     * 格式化日期為 YYYY-MM-DD
     */
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },
    
    /**
     * 根據權重隨機選擇癌別
     */
    randomCancerType() {
        const totalWeight = this.cancerTypes.reduce((sum, c) => sum + c.weight, 0);
        let random = Math.random() * totalWeight;
        for (const cancer of this.cancerTypes) {
            random -= cancer.weight;
            if (random <= 0) return cancer;
        }
        return this.cancerTypes[0];
    },
    
    /**
     * 產生隨機姓名
     */
    randomName() {
        const surname = this.surnames[Math.floor(Math.random() * this.surnames.length)];
        const given = this.givenNames[Math.floor(Math.random() * this.givenNames.length)];
        return surname + given;
    },
    
    /**
     * 產生隨機病歷號
     */
    randomMedicalId(index) {
        const year = 113 + Math.floor(Math.random() * 2);
        const num = String(10000 + index).slice(1);
        return `${year}${num}`;
    },
    
    /**
     * 產生演示數據
     */
    async generate() {
        const patients = [];
        const treatments = [];
        const weightRecords = [];
        const sideEffects = [];
        const interventions = [];
        const satisfactionRecords = [];
        
        // 產生 50 位病人
        for (let i = 0; i < 50; i++) {
            const patientId = i + 1;
            const medicalId = this.randomMedicalId(i);
            const name = this.randomName();
            
            patients.push({
                id: patientId,
                medical_id: medicalId,
                name: name,
                created_at: new Date().toISOString()
            });
            
            // 每位病人 1-2 個療程
            const numTreatments = i < 40 ? 1 : 2;
            
            for (let t = 0; t < numTreatments; t++) {
                const treatmentId = treatments.length + 1;
                const cancer = this.randomCancerType();
                
                // 決定療程狀態
                let status, startDaysAgo, endDate;
                const statusRoll = Math.random();
                
                if (i < 30) {
                    // 30 位進行中
                    status = 'active';
                    startDaysAgo = Math.floor(Math.random() * 28) + 7; // 7-35 天前開始
                    endDate = null;
                } else if (i < 38) {
                    // 8 位已結案
                    status = 'completed';
                    startDaysAgo = Math.floor(Math.random() * 60) + 35; // 35-95 天前開始
                    endDate = this.formatDate(this.randomDate(5, 30));
                } else if (i < 43) {
                    // 5 位暫停中
                    status = 'paused';
                    startDaysAgo = Math.floor(Math.random() * 30) + 14;
                    endDate = null;
                } else {
                    // 7 位終止
                    status = 'terminated';
                    startDaysAgo = Math.floor(Math.random() * 60) + 30;
                    endDate = this.formatDate(this.randomDate(5, 25));
                }
                
                const startDate = this.formatDate(this.randomDate(startDaysAgo, startDaysAgo));
                const baseWeight = 50 + Math.random() * 30; // 50-80 kg
                
                const treatment = {
                    id: treatmentId,
                    patient_id: patientId,
                    cancer_type: cancer.code,
                    cancer_type_label: cancer.label,
                    treatment_start: startDate,
                    base_weight: parseFloat(baseWeight.toFixed(1)),
                    status: status,
                    created_at: new Date().toISOString()
                };
                
                if (endDate) {
                    treatment.end_date = endDate;
                }
                
                if (status === 'paused') {
                    treatment.pause_reason = ['外出旅遊', '身體不適', '家庭因素', '其他'][Math.floor(Math.random() * 4)];
                    treatment.paused_at = this.formatDate(this.randomDate(3, 10));
                }
                
                treatments.push(treatment);
                
                // 產生體重記錄
                const numWeights = status === 'active' ? Math.floor(startDaysAgo / 3) : Math.floor(Math.random() * 10) + 5;
                let currentWeight = baseWeight;
                
                // 決定體重變化趨勢
                const trendRoll = Math.random();
                let weightTrend;
                if (trendRoll < 0.5) {
                    weightTrend = 'stable'; // 50% 維持
                } else if (trendRoll < 0.75) {
                    weightTrend = 'mild_loss'; // 25% 輕微下降 (< 3%)
                } else if (trendRoll < 0.9) {
                    weightTrend = 'moderate_loss'; // 15% 中度下降 (3-5%)
                } else {
                    weightTrend = 'severe_loss'; // 10% 嚴重下降 (> 5%)
                }
                
                for (let w = 0; w < numWeights; w++) {
                    const daysAfterStart = Math.floor((w + 1) * (startDaysAgo / numWeights));
                    const measureDate = this.formatDate(new Date(Date.now() - (startDaysAgo - daysAfterStart) * 24 * 60 * 60 * 1000));
                    
                    // 根據趨勢調整體重
                    if (weightTrend === 'stable') {
                        currentWeight += (Math.random() - 0.5) * 0.5;
                    } else if (weightTrend === 'mild_loss') {
                        currentWeight -= Math.random() * 0.3;
                    } else if (weightTrend === 'moderate_loss') {
                        currentWeight -= Math.random() * 0.5;
                    } else {
                        currentWeight -= Math.random() * 0.7;
                    }
                    
                    // 確保體重合理
                    currentWeight = Math.max(currentWeight, baseWeight * 0.85);
                    
                    const isPatientInput = Math.random() < 0.4;
                    
                    weightRecords.push({
                        id: weightRecords.length + 1,
                        treatment_id: treatmentId,
                        weight: parseFloat(currentWeight.toFixed(1)),
                        measure_date: measureDate,
                        source: isPatientInput ? 'patient' : 'staff',
                        created_at: new Date().toISOString()
                    });
                }
                
                // 產生副作用評估（約 60% 的療程有副作用記錄）
                if (Math.random() < 0.6) {
                    const numSE = Math.floor(Math.random() * 5) + 1;
                    for (let se = 0; se < numSE; se++) {
                        const daysAfterStart = Math.floor((se + 1) * (startDaysAgo / (numSE + 1)));
                        const assessDate = this.formatDate(new Date(Date.now() - (startDaysAgo - daysAfterStart) * 24 * 60 * 60 * 1000));
                        
                        const symptoms = [];
                        // 噁心
                        if (Math.random() < 0.4) symptoms.push({ code: 'N', level: Math.floor(Math.random() * 3) + 1 });
                        // 疲勞
                        if (Math.random() < 0.6) symptoms.push({ code: 'F', level: Math.floor(Math.random() * 3) + 1 });
                        // 口腔黏膜炎
                        if (cancer.code === 'head_neck' && Math.random() < 0.7) {
                            symptoms.push({ code: 'O', level: Math.floor(Math.random() * 3) + 1 });
                        }
                        // 皮膚反應
                        if (Math.random() < 0.5) symptoms.push({ code: 'S', level: Math.floor(Math.random() * 3) + 1 });
                        // 吞嚥困難
                        if ((cancer.code === 'head_neck' || cancer.code === 'esophagus') && Math.random() < 0.6) {
                            symptoms.push({ code: 'W', level: Math.floor(Math.random() * 3) + 1 });
                        }
                        // 食慾下降
                        if (Math.random() < 0.5) symptoms.push({ code: 'A', level: Math.floor(Math.random() * 3) + 1 });
                        // 腹瀉
                        if (Math.random() < 0.2) symptoms.push({ code: 'D', level: Math.floor(Math.random() * 3) + 1 });
                        // 疼痛
                        if (Math.random() < 0.4) symptoms.push({ code: 'P', level: Math.floor(Math.random() * 10) + 1 });
                        
                        if (symptoms.length > 0) {
                            sideEffects.push({
                                id: sideEffects.length + 1,
                                treatment_id: treatmentId,
                                assess_date: assessDate,
                                symptoms: symptoms,
                                source: Math.random() < 0.5 ? 'patient' : 'staff',
                                created_at: new Date().toISOString()
                            });
                        }
                    }
                }
                
                // 產生介入記錄
                const weightChange = ((currentWeight - baseWeight) / baseWeight) * 100;
                
                // 如果體重下降超過 3%，產生介入
                if (weightChange < -3) {
                    // SDM 介入
                    const sdmIntervention = {
                        id: interventions.length + 1,
                        treatment_id: treatmentId,
                        type: 'sdm',
                        trigger: 'weight_loss_3',
                        trigger_value: -3,
                        status: Math.random() < 0.7 ? 'executed' : (Math.random() < 0.5 ? 'contacted' : 'pending'),
                        created_at: this.formatDate(this.randomDate(1, Math.min(10, startDaysAgo))) + 'T10:00:00.000Z'
                    };
                    
                    if (sdmIntervention.status === 'contacted' || sdmIntervention.status === 'executed') {
                        sdmIntervention.contacted_at = new Date(Date.parse(sdmIntervention.created_at) + Math.random() * 12 * 60 * 60 * 1000).toISOString();
                        sdmIntervention.contacted_by = this.staff[Math.floor(Math.random() * this.staff.length)];
                    }
                    
                    if (sdmIntervention.status === 'executed') {
                        sdmIntervention.executed_at = new Date(Date.parse(sdmIntervention.contacted_at) + Math.random() * 24 * 60 * 60 * 1000).toISOString();
                        sdmIntervention.executed_by = this.staff[Math.floor(Math.random() * this.staff.length)];
                    }
                    
                    interventions.push(sdmIntervention);
                }
                
                if (weightChange < -5) {
                    // 營養師介入
                    const nutritionIntervention = {
                        id: interventions.length + 1,
                        treatment_id: treatmentId,
                        type: 'nutrition',
                        trigger: 'weight_loss_5',
                        trigger_value: -5,
                        status: Math.random() < 0.8 ? 'executed' : (Math.random() < 0.5 ? 'contacted' : 'pending'),
                        created_at: this.formatDate(this.randomDate(1, Math.min(8, startDaysAgo))) + 'T14:00:00.000Z'
                    };
                    
                    if (nutritionIntervention.status === 'contacted' || nutritionIntervention.status === 'executed') {
                        nutritionIntervention.contacted_at = new Date(Date.parse(nutritionIntervention.created_at) + Math.random() * 8 * 60 * 60 * 1000).toISOString();
                        nutritionIntervention.contacted_by = this.staff[Math.floor(Math.random() * this.staff.length)];
                    }
                    
                    if (nutritionIntervention.status === 'executed') {
                        nutritionIntervention.executed_at = new Date(Date.parse(nutritionIntervention.contacted_at) + Math.random() * 12 * 60 * 60 * 1000).toISOString();
                        nutritionIntervention.executed_by = this.staff[Math.floor(Math.random() * this.staff.length)];
                    }
                    
                    interventions.push(nutritionIntervention);
                }
                
                // 嚴重下降可能有鼻胃管或胃造廔
                if (weightChange < -8 && Math.random() < 0.3) {
                    const tubeType = Math.random() < 0.7 ? 'ng_tube' : 'gastrostomy';
                    interventions.push({
                        id: interventions.length + 1,
                        treatment_id: treatmentId,
                        type: tubeType,
                        trigger: 'manual',
                        status: 'executed',
                        executed_at: this.formatDate(this.randomDate(1, 5)) + 'T09:00:00.000Z',
                        executed_by: this.staff[Math.floor(Math.random() * this.staff.length)],
                        created_at: new Date().toISOString()
                    });
                }
                
                // 已結案療程產生滿意度（約 70%）
                if (status === 'completed' && Math.random() < 0.7) {
                    const hasNutrition = interventions.some(i => i.treatment_id === treatmentId && i.type === 'nutrition');
                    
                    satisfactionRecords.push({
                        id: satisfactionRecords.length + 1,
                        treatment_id: treatmentId,
                        q1: Math.floor(Math.random() * 2) + 4, // 4-5
                        q2: hasNutrition ? Math.floor(Math.random() * 2) + 4 : 0, // 4-5 或未使用
                        q3: Math.floor(Math.random() * 3) + 3, // 3-5
                        q4: Math.floor(Math.random() * 2) + 4, // 4-5
                        q5: Math.floor(Math.random() * 2) + 4, // 4-5 (NPS)
                        feedback: Math.random() < 0.3 ? ['服務很好', '醫護人員很親切', 'APP 很方便', '希望增加提醒功能'][Math.floor(Math.random() * 4)] : '',
                        created_at: endDate + 'T10:00:00.000Z'
                    });
                }
            }
        }
        
        return {
            patients,
            treatments,
            weightRecords,
            sideEffects,
            interventions,
            satisfactionRecords
        };
    },
    
    /**
     * 初始化演示數據到資料庫
     */
    async init() {
        try {
            // 檢查是否已有數據
            const existingPatients = await DB.getAll('patients');
            if (existingPatients.length > 0) {
                return false; // 已有數據，不重複初始化
            }
            
            console.log('正在產生演示數據...');
            const data = await this.generate();
            
            // 寫入病人
            for (const patient of data.patients) {
                await DB.add('patients', patient);
            }
            console.log(`已建立 ${data.patients.length} 位病人`);
            
            // 寫入療程
            for (const treatment of data.treatments) {
                await DB.add('treatments', treatment);
            }
            console.log(`已建立 ${data.treatments.length} 個療程`);
            
            // 寫入體重記錄
            for (const record of data.weightRecords) {
                await DB.add('weight_records', record);
            }
            console.log(`已建立 ${data.weightRecords.length} 筆體重記錄`);
            
            // 寫入副作用評估
            for (const se of data.sideEffects) {
                await DB.add('side_effects', se);
            }
            console.log(`已建立 ${data.sideEffects.length} 筆副作用評估`);
            
            // 寫入介入記錄
            for (const intervention of data.interventions) {
                await DB.add('interventions', intervention);
            }
            console.log(`已建立 ${data.interventions.length} 筆介入記錄`);
            
            // 寫入滿意度
            for (const sat of data.satisfactionRecords) {
                await DB.add('satisfaction', sat);
            }
            console.log(`已建立 ${data.satisfactionRecords.length} 筆滿意度回饋`);
            
            console.log('演示數據初始化完成');
            return true;
            
        } catch (e) {
            console.error('演示數據初始化失敗:', e);
            return false;
        }
    }
};
