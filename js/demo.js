/**
 * 演示數據模組
 * 產生 50 位測試病人及完整記錄
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
    
    staff: ['王孝宇', '陳詩韻', '廖芝穎'],
    
    formatDate(date) {
        return date.toISOString().split('T')[0];
    },
    
    daysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return this.formatDate(d);
    },
    
    async init() {
        const patientCount = await DB.count('patients');
        if (patientCount > 0) {
            console.log('已有資料，跳過演示數據初始化');
            return false;
        }
        
        console.log('開始產生 50 位測試病人...');
        
        let treatmentId = 0;
        let weightId = 0;
        let seId = 0;
        let intId = 0;
        let satId = 0;
        
        for (let i = 0; i < 50; i++) {
            const surname = this.surnames[i % this.surnames.length];
            const given = this.givenNames[i % this.givenNames.length];
            const name = surname + given;
            const medicalId = `${113 + Math.floor(i / 25)}${String(1001 + i).padStart(4, '0')}`;
            
            // 建立病人
            const patient = await DB.add('patients', {
                medical_id: medicalId,
                name: name,
                created_at: new Date().toISOString()
            });
            
            // 決定狀態分布：30 進行中、10 已結案、5 暫停、5 終止
            let status, startDaysAgo, endDate = null;
            if (i < 30) {
                status = 'active';
                startDaysAgo = 7 + Math.floor(Math.random() * 28);
            } else if (i < 40) {
                status = 'completed';
                startDaysAgo = 45 + Math.floor(Math.random() * 30);
                endDate = this.daysAgo(5 + Math.floor(Math.random() * 10));
            } else if (i < 45) {
                status = 'paused';
                startDaysAgo = 14 + Math.floor(Math.random() * 21);
            } else {
                status = 'terminated';
                startDaysAgo = 30 + Math.floor(Math.random() * 30);
                endDate = this.daysAgo(5 + Math.floor(Math.random() * 15));
            }
            
            const cancer = this.cancerTypes[i % this.cancerTypes.length];
            const baseWeight = 50 + Math.floor(Math.random() * 30);
            
            const treatmentData = {
                patient_id: patient.id,
                cancer_type: cancer.code,
                cancer_type_label: cancer.label,
                treatment_start: this.daysAgo(startDaysAgo),
                baseline_weight: baseWeight,
                status: status,
                created_at: new Date().toISOString()
            };
            
            if (endDate) treatmentData.end_date = endDate;
            if (status === 'paused') {
                treatmentData.pause_reason = '身體不適';
                treatmentData.paused_at = this.daysAgo(3);
            }
            
            const treatment = await DB.add('treatments', treatmentData);
            treatmentId++;
            
            // 產生體重記錄 (每 3-5 天一筆)
            const numWeights = Math.floor(startDaysAgo / 4) + 2;
            let currentWeight = baseWeight;
            
            // 決定體重趨勢
            const trend = Math.random();
            let weightDelta;
            if (trend < 0.4) {
                weightDelta = 0; // 維持
            } else if (trend < 0.65) {
                weightDelta = -0.2; // 輕微下降
            } else if (trend < 0.85) {
                weightDelta = -0.4; // 中度下降
            } else {
                weightDelta = -0.6; // 嚴重下降
            }
            
            for (let w = 0; w < numWeights; w++) {
                const measureDay = startDaysAgo - Math.floor(w * (startDaysAgo / numWeights));
                currentWeight += weightDelta + (Math.random() - 0.5) * 0.3;
                currentWeight = Math.max(currentWeight, baseWeight * 0.85);
                
                await DB.add('weight_records', {
                    treatment_id: treatment.id,
                    weight: parseFloat(currentWeight.toFixed(1)),
                    measure_date: this.daysAgo(measureDay),
                    source: Math.random() < 0.4 ? 'patient' : 'staff',
                    created_at: new Date().toISOString()
                });
                weightId++;
            }
            
            // 產生副作用評估 (70% 的療程有)
            if (Math.random() < 0.7) {
                const numSE = 2 + Math.floor(Math.random() * 4);
                for (let s = 0; s < numSE; s++) {
                    const assessDay = startDaysAgo - Math.floor(s * (startDaysAgo / numSE));
                    const symptoms = [];
                    
                    if (Math.random() < 0.5) symptoms.push({ code: 'N', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.6) symptoms.push({ code: 'F', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.4) symptoms.push({ code: 'O', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.5) symptoms.push({ code: 'S', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.4) symptoms.push({ code: 'A', level: 1 + Math.floor(Math.random() * 3) });
                    if (Math.random() < 0.3) symptoms.push({ code: 'P', level: 1 + Math.floor(Math.random() * 10) });
                    
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
            
            if (weightChange < -3) {
                const intStatus = Math.random() < 0.6 ? 'executed' : (Math.random() < 0.5 ? 'contacted' : 'pending');
                const intData = {
                    treatment_id: treatment.id,
                    type: 'sdm',
                    trigger: 'weight_loss_3',
                    trigger_value: -3,
                    status: intStatus,
                    created_at: this.daysAgo(Math.floor(Math.random() * 5)) + 'T10:00:00.000Z'
                };
                
                if (intStatus !== 'pending') {
                    intData.contacted_at = this.daysAgo(Math.floor(Math.random() * 3)) + 'T14:00:00.000Z';
                    intData.contacted_by = this.staff[Math.floor(Math.random() * 3)];
                }
                if (intStatus === 'executed') {
                    intData.executed_at = this.daysAgo(Math.floor(Math.random() * 2)) + 'T16:00:00.000Z';
                    intData.executed_by = this.staff[Math.floor(Math.random() * 3)];
                }
                
                await DB.add('interventions', intData);
                intId++;
            }
            
            if (weightChange < -5) {
                const intStatus = Math.random() < 0.7 ? 'executed' : 'pending';
                const intData = {
                    treatment_id: treatment.id,
                    type: 'nutrition',
                    trigger: 'weight_loss_5',
                    trigger_value: -5,
                    status: intStatus,
                    created_at: this.daysAgo(Math.floor(Math.random() * 4)) + 'T09:00:00.000Z'
                };
                
                if (intStatus === 'executed') {
                    intData.contacted_at = this.daysAgo(2) + 'T11:00:00.000Z';
                    intData.contacted_by = this.staff[Math.floor(Math.random() * 3)];
                    intData.executed_at = this.daysAgo(1) + 'T15:00:00.000Z';
                    intData.executed_by = this.staff[Math.floor(Math.random() * 3)];
                }
                
                await DB.add('interventions', intData);
                intId++;
            }
            
            // 產生滿意度 - 所有已結案 + 部分進行中
            if (status === 'completed' || (status === 'active' && i < 10)) {
                await DB.add('satisfaction', {
                    treatment_id: treatment.id,
                    q1: 4 + Math.floor(Math.random() * 2), // 4-5
                    q2: Math.random() < 0.3 ? 0 : (4 + Math.floor(Math.random() * 2)), // 30% 未使用
                    q3: 3 + Math.floor(Math.random() * 3), // 3-5
                    q4: 4 + Math.floor(Math.random() * 2), // 4-5
                    q5: 4 + Math.floor(Math.random() * 2), // 4-5 NPS
                    feedback: ['服務很好', '醫護人員很親切', 'APP 很方便', ''][Math.floor(Math.random() * 4)],
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
        
        return true;
    }
};
