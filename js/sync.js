/**
 * 彰濱放腫體重監控預防系統 - 同步模組
 * 處理多電腦間的病人資料同步
 */

const Sync = {
    // 衝突暫存
    conflicts: [],
    currentConflictIndex: 0,
    resolvedConflicts: [],
    syncContext: null,
    
    /**
     * 啟動時檢查是否需要同步
     */
    async checkOnStartup() {
        const enabled = await Settings.get('sync_on_startup', true);
        if (!enabled) return;
        
        // 檢查是否有資料（首次使用不提示）
        const patients = await DB.getAll('patients');
        if (patients.length === 0) return;
        
        // 顯示同步提示
        this.showStartupPrompt();
    },
    
    /**
     * 顯示啟動同步提示
     */
    showStartupPrompt() {
        const html = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 48px; margin-bottom: 16px;">🔄</div>
                <p style="margin-bottom: 16px;">是否從網芳同步最新資料？</p>
                <p style="font-size: 13px; color: var(--text-secondary);">
                    建議每天上班時先同步，確保資料最新
                </p>
            </div>
        `;
        
        openModal('同步提示', html, [
            { 
                text: '跳過', 
                class: 'btn-outline',
                onClick: () => {}
            },
            { 
                text: '選擇檔案同步', 
                class: 'btn-primary',
                closeOnClick: false,
                onClick: () => {
                    closeModal();
                    this.selectAndSync();
                }
            }
        ]);
    },
    
    /**
     * 選擇檔案並同步
     */
    async selectAndSync() {
        // 建立隱藏的 file input
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.syncFromFile(file);
            }
        };
        
        input.click();
    },
    
    /**
     * 從檔案同步（含衝突檢測）
     */
    async syncFromFile(file) {
        try {
            showToast('正在分析資料...', 'info');
            
            const importData = await readJSONFile(file);
            
            // 取得本地資料
            const localData = {
                patients: await DB.getAll('patients'),
                treatments: await DB.getAll('treatments'),
                weights: await DB.getAll('weight_records'),
                sideEffects: await DB.getAll('side_effects'),
                interventions: await DB.getAll('interventions'),
                satisfaction: await DB.getAll('satisfaction')
            };
            
            // 分析同步內容
            const analysis = await this.analyzeSync(importData, localData);
            
            // 如果有衝突，先處理衝突
            if (analysis.conflicts.length > 0) {
                this.conflicts = analysis.conflicts;
                this.currentConflictIndex = 0;
                this.resolvedConflicts = [];
                this.syncContext = { importData, localData, analysis };
                this.showConflictDialog();
            } else {
                // 沒有衝突，直接執行同步
                await this.executeSync(importData, localData, analysis, []);
            }
            
        } catch (e) {
            console.error('同步失敗:', e);
            showToast('同步失敗: ' + e.message, 'error');
        }
    },
    
    /**
     * 分析同步內容，找出新增項目和衝突
     */
    async analyzeSync(importData, localData) {
        const result = {
            toAdd: { patients: [], treatments: [], weights: [], sideEffects: [], interventions: [], satisfaction: [] },
            toDelete: { patients: [], treatments: [], weights: [], sideEffects: [], interventions: [], satisfaction: [] },
            toSkip: { patients: 0, treatments: 0, weights: 0, sideEffects: 0, interventions: 0, satisfaction: 0 },
            conflicts: []
        };
        
        const importPatients = importData.patients || [];
        const importTreatments = importData.treatments || [];
        const importWeights = importData.weight_records || [];
        const importSideEffects = importData.side_effects || [];
        const importInterventions = importData.interventions || [];
        const importSatisfaction = importData.satisfaction || [];
        
        // 建立本地索引（包含已刪除的，用於同步刪除狀態）
        const localPatientMap = new Map(localData.patients.map(p => [p.medical_id, p]));
        
        const localTreatmentMap = new Map();
        for (const t of localData.treatments) {
            const patient = localData.patients.find(p => p.id === t.patient_id);
            if (patient) {
                const key = `${patient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
                localTreatmentMap.set(key, t);
            }
        }
        
        const localWeightMap = new Map();
        for (const w of localData.weights) {
            const treatment = localData.treatments.find(t => t.id === w.treatment_id);
            if (treatment) {
                const patient = localData.patients.find(p => p.id === treatment.patient_id);
                if (patient) {
                    const key = `${patient.medical_id}_${treatment.treatment_start}_${w.measure_date}`;
                    localWeightMap.set(key, w);
                }
            }
        }
        
        const localSideEffectMap = new Map();
        for (const se of localData.sideEffects) {
            const treatment = localData.treatments.find(t => t.id === se.treatment_id);
            if (treatment) {
                const patient = localData.patients.find(p => p.id === treatment.patient_id);
                if (patient) {
                    const key = `${patient.medical_id}_${treatment.treatment_start}_${se.assess_date}`;
                    localSideEffectMap.set(key, se);
                }
            }
        }
        
        const localInterventionMap = new Map();
        for (const i of localData.interventions) {
            const treatment = localData.treatments.find(t => t.id === i.treatment_id);
            if (treatment) {
                const patient = localData.patients.find(p => p.id === treatment.patient_id);
                if (patient) {
                    const createdDate = i.created_at ? i.created_at.split('T')[0] : '';
                    const key = `${patient.medical_id}_${treatment.treatment_start}_${i.type}_${createdDate}`;
                    localInterventionMap.set(key, i);
                }
            }
        }
        
        // ID 對應表
        const patientIdMap = new Map();
        const treatmentIdMap = new Map();
        
        // 分析病人
        for (const p of importPatients) {
            if (localPatientMap.has(p.medical_id)) {
                const localP = localPatientMap.get(p.medical_id);
                patientIdMap.set(p.id, localP.id);
                
                // 處理刪除同步：匯入已刪除，本地未刪除
                if (p.deleted && !localP.deleted) {
                    result.toDelete.patients.push({
                        local: localP,
                        import: p
                    });
                }
                // 檢查是否有差異（名字不同視為衝突，只在雙方都未刪除時）
                else if (!p.deleted && !localP.deleted && localP.name !== p.name) {
                    result.conflicts.push({
                        type: 'patient',
                        key: p.medical_id,
                        label: `病人 ${p.medical_id}`,
                        local: localP,
                        import: p,
                        localDisplay: localP.name,
                        importDisplay: p.name
                    });
                }
                result.toSkip.patients++;
            } else if (!p.deleted) {
                // 只新增未刪除的
                result.toAdd.patients.push(p);
                patientIdMap.set(p.id, 'new_' + p.id);
            }
        }
        
        // 分析療程
        for (const t of importTreatments) {
            const importPatient = importPatients.find(p => p.id === t.patient_id);
            if (!importPatient) continue;
            
            const key = `${importPatient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
            
            if (localTreatmentMap.has(key)) {
                const localT = localTreatmentMap.get(key);
                treatmentIdMap.set(t.id, localT.id);
                result.toSkip.treatments++;
            } else {
                result.toAdd.treatments.push({ ...t, _importPatientId: t.patient_id });
                treatmentIdMap.set(t.id, 'new_' + t.id);
            }
        }
        
        // 分析體重記錄
        for (const w of importWeights) {
            const importTreatment = importTreatments.find(t => t.id === w.treatment_id);
            if (!importTreatment) continue;
            
            const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
            if (!importPatient) continue;
            
            const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${w.measure_date}`;
            
            if (localWeightMap.has(key)) {
                const localW = localWeightMap.get(key);
                
                // 處理刪除同步
                if (w.deleted && !localW.deleted) {
                    result.toDelete.weights.push({
                        local: localW,
                        import: w
                    });
                }
                // 檢查體重是否不同（只在雙方都未刪除時）
                else if (!w.deleted && !localW.deleted && localW.weight !== w.weight) {
                    result.conflicts.push({
                        type: 'weight',
                        key: key,
                        label: `${importPatient.name} ${w.measure_date} 體重`,
                        local: localW,
                        import: w,
                        localDisplay: localW.weight ? `${localW.weight} kg` : '無法量測',
                        importDisplay: w.weight ? `${w.weight} kg` : '無法量測'
                    });
                }
                result.toSkip.weights++;
            } else if (!w.deleted) {
                // 只新增未刪除的
                result.toAdd.weights.push({ ...w, _importTreatmentId: w.treatment_id });
            }
        }
        
        // 分析副作用評估
        for (const se of importSideEffects) {
            const importTreatment = importTreatments.find(t => t.id === se.treatment_id);
            if (!importTreatment) continue;
            
            const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
            if (!importPatient) continue;
            
            const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${se.assess_date}`;
            
            if (localSideEffectMap.has(key)) {
                const localSE = localSideEffectMap.get(key);
                
                // 處理刪除同步
                if (se.deleted && !localSE.deleted) {
                    result.toDelete.sideEffects.push({
                        local: localSE,
                        import: se
                    });
                }
                // 檢查症狀是否不同（只在雙方都未刪除時）
                else if (!se.deleted && !localSE.deleted) {
                    const localSymptoms = JSON.stringify(localSE.symptoms?.sort((a,b) => a.code.localeCompare(b.code)));
                    const importSymptoms = JSON.stringify(se.symptoms?.sort((a,b) => a.code.localeCompare(b.code)));
                    
                    if (localSymptoms !== importSymptoms) {
                        result.conflicts.push({
                            type: 'sideEffect',
                            key: key,
                            label: `${importPatient.name} ${se.assess_date} 副作用評估`,
                            local: localSE,
                            import: se,
                            localDisplay: this.formatSymptomsSummary(localSE.symptoms),
                            importDisplay: this.formatSymptomsSummary(se.symptoms)
                        });
                    }
                }
                result.toSkip.sideEffects++;
            } else if (!se.deleted) {
                // 只新增未刪除的
                result.toAdd.sideEffects.push({ ...se, _importTreatmentId: se.treatment_id });
            }
        }
        
        // 分析介入記錄
        for (const i of importInterventions) {
            const importTreatment = importTreatments.find(t => t.id === i.treatment_id);
            if (!importTreatment) continue;
            
            const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
            if (!importPatient) continue;
            
            const createdDate = i.created_at ? i.created_at.split('T')[0] : '';
            const key = `${importPatient.medical_id}_${importTreatment.treatment_start}_${i.type}_${createdDate}`;
            
            if (localInterventionMap.has(key)) {
                const localI = localInterventionMap.get(key);
                
                // 處理刪除同步
                if (i.deleted && !localI.deleted) {
                    result.toDelete.interventions.push({
                        local: localI,
                        import: i
                    });
                }
                result.toSkip.interventions++;
            } else if (!i.deleted) {
                // 只新增未刪除的
                result.toAdd.interventions.push({ ...i, _importTreatmentId: i.treatment_id });
            }
        }
        
        // 分析滿意度調查
        const localSatisfactionMap = new Map();
        for (const s of (localData.satisfaction || [])) {
            const treatment = localData.treatments.find(t => t.id === s.treatment_id);
            if (treatment) {
                const patient = localData.patients.find(p => p.id === treatment.patient_id);
                if (patient) {
                    const key = `${patient.medical_id}_${treatment.treatment_start}`;
                    localSatisfactionMap.set(key, s);
                }
            }
        }
        
        for (const s of importSatisfaction) {
            const importTreatment = importTreatments.find(t => t.id === s.treatment_id);
            if (!importTreatment) continue;
            
            const importPatient = importPatients.find(p => p.id === importTreatment.patient_id);
            if (!importPatient) continue;
            
            const key = `${importPatient.medical_id}_${importTreatment.treatment_start}`;
            
            if (localSatisfactionMap.has(key)) {
                const localS = localSatisfactionMap.get(key);
                
                // 處理刪除同步
                if (s.deleted && !localS.deleted) {
                    result.toDelete.satisfaction.push({
                        local: localS,
                        import: s
                    });
                }
                result.toSkip.satisfaction++;
            } else if (!s.deleted) {
                // 只新增未刪除的
                result.toAdd.satisfaction.push({ ...s, _importTreatmentId: s.treatment_id });
            }
        }
        
        return result;
    },
    
    /**
     * 格式化症狀摘要
     */
    formatSymptomsSummary(symptoms) {
        if (!symptoms || symptoms.length === 0) return '無症狀';
        
        const names = {
            'N': '噁心', 'F': '疲勞', 'O': '口腔', 'S': '皮膚',
            'W': '吞嚥', 'A': '食慾', 'D': '腹瀉', 'P': '疼痛'
        };
        
        return symptoms
            .filter(s => s.level > 0)
            .map(s => `${names[s.code] || s.code}:${s.level}`)
            .join(', ') || '無症狀';
    },
    
    /**
     * 顯示衝突對話框
     */
    showConflictDialog() {
        const conflict = this.conflicts[this.currentConflictIndex];
        const total = this.conflicts.length;
        const current = this.currentConflictIndex + 1;
        
        const html = `
            <div style="padding: 8px 0;">
                <div style="text-align: center; margin-bottom: 16px;">
                    <span style="background: var(--warning); color: white; padding: 4px 12px; border-radius: 12px; font-size: 12px;">
                        衝突 ${current} / ${total}
                    </span>
                </div>
                
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-weight: 600; margin-bottom: 8px;">${conflict.label}</div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                    <div style="background: var(--bg); padding: 12px; border-radius: 8px; border: 2px solid transparent;" id="conflict-local">
                        <div style="font-size: 12px; color: var(--text-hint); margin-bottom: 8px;">📍 本地資料</div>
                        <div style="font-size: 15px; font-weight: 500;">${conflict.localDisplay}</div>
                    </div>
                    <div style="background: var(--bg); padding: 12px; border-radius: 8px; border: 2px solid transparent;" id="conflict-import">
                        <div style="font-size: 12px; color: var(--text-hint); margin-bottom: 8px;">📥 匯入資料</div>
                        <div style="font-size: 15px; font-weight: 500;">${conflict.importDisplay}</div>
                    </div>
                </div>
            </div>
        `;
        
        openModal('⚠️ 發現資料衝突', html, [
            { 
                text: '保留本地', 
                class: 'btn-outline',
                closeOnClick: false,
                onClick: () => this.resolveConflict('local')
            },
            { 
                text: '使用匯入', 
                class: 'btn-primary',
                closeOnClick: false,
                onClick: () => this.resolveConflict('import')
            }
        ]);
    },
    
    /**
     * 解決單一衝突
     */
    resolveConflict(choice) {
        const conflict = this.conflicts[this.currentConflictIndex];
        this.resolvedConflicts.push({
            ...conflict,
            resolution: choice
        });
        
        this.currentConflictIndex++;
        
        if (this.currentConflictIndex < this.conflicts.length) {
            // 還有衝突，繼續處理
            closeModal();
            setTimeout(() => this.showConflictDialog(), 100);
        } else {
            // 所有衝突已處理，執行同步
            closeModal();
            const { importData, localData, analysis } = this.syncContext;
            this.executeSync(importData, localData, analysis, this.resolvedConflicts);
        }
    },
    
    /**
     * 執行同步
     */
    async executeSync(importData, localData, analysis, resolvedConflicts) {
        try {
            showToast('正在同步...', 'info');
            
            const stats = {
                added: { patients: 0, treatments: 0, weights: 0, sideEffects: 0, interventions: 0, satisfaction: 0 },
                updated: { patients: 0, treatments: 0, weights: 0, sideEffects: 0, interventions: 0, satisfaction: 0 },
                deleted: { patients: 0, treatments: 0, weights: 0, sideEffects: 0, interventions: 0, satisfaction: 0 },
                skipped: analysis.toSkip
            };
            
            const importPatients = importData.patients || [];
            const importTreatments = importData.treatments || [];
            
            // ID 對應表
            const patientIdMap = new Map();
            const treatmentIdMap = new Map();
            
            // 建立本地索引
            const localPatientMap = new Map(localData.patients.map(p => [p.medical_id, p]));
            const localTreatmentMap = new Map();
            for (const t of localData.treatments) {
                const patient = localData.patients.find(p => p.id === t.patient_id);
                if (patient) {
                    const key = `${patient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
                    localTreatmentMap.set(key, t);
                }
            }
            
            // 1. 處理病人衝突
            for (const resolved of resolvedConflicts.filter(r => r.type === 'patient')) {
                if (resolved.resolution === 'import') {
                    // 使用匯入資料更新本地
                    await DB.update('patients', { 
                        ...resolved.import, 
                        id: resolved.local.id 
                    });
                    stats.updated.patients++;
                }
                patientIdMap.set(resolved.import.id, resolved.local.id);
            }
            
            // 2. 同步刪除病人（軟刪除）
            for (const item of analysis.toDelete.patients) {
                item.local.deleted = true;
                item.local.deleted_at = item.import.deleted_at;
                await DB.update('patients', item.local);
                stats.deleted.patients++;
            }
            
            // 3. 新增病人
            for (const p of analysis.toAdd.patients) {
                const newPatient = { ...p };
                delete newPatient.id;
                const newId = await DB.add('patients', newPatient);
                patientIdMap.set(p.id, newId);
                stats.added.patients++;
            }
            
            // 4. 映射已存在的病人 ID
            for (const p of importPatients) {
                if (!patientIdMap.has(p.id) && localPatientMap.has(p.medical_id)) {
                    patientIdMap.set(p.id, localPatientMap.get(p.medical_id).id);
                }
            }
            
            // 5. 新增療程
            for (const t of analysis.toAdd.treatments) {
                const newTreatment = { ...t };
                delete newTreatment.id;
                delete newTreatment._importPatientId;
                newTreatment.patient_id = patientIdMap.get(t._importPatientId);
                if (newTreatment.patient_id) {
                    const newId = await DB.add('treatments', newTreatment);
                    treatmentIdMap.set(t.id, newId);
                    stats.added.treatments++;
                }
            }
            
            // 6. 映射已存在的療程 ID
            for (const t of importTreatments) {
                if (!treatmentIdMap.has(t.id)) {
                    const importPatient = importPatients.find(p => p.id === t.patient_id);
                    if (importPatient) {
                        const key = `${importPatient.medical_id}_${t.treatment_start}_${t.cancer_type}`;
                        if (localTreatmentMap.has(key)) {
                            treatmentIdMap.set(t.id, localTreatmentMap.get(key).id);
                        }
                    }
                }
            }
            
            // 7. 處理體重衝突
            for (const resolved of resolvedConflicts.filter(r => r.type === 'weight')) {
                if (resolved.resolution === 'import') {
                    await DB.update('weight_records', { 
                        ...resolved.import, 
                        id: resolved.local.id,
                        treatment_id: resolved.local.treatment_id
                    });
                    stats.updated.weights++;
                }
            }
            
            // 8. 同步刪除體重（軟刪除）
            for (const item of analysis.toDelete.weights) {
                item.local.deleted = true;
                item.local.deleted_at = item.import.deleted_at;
                await DB.update('weight_records', item.local);
                stats.deleted.weights++;
            }
            
            // 9. 新增體重
            for (const w of analysis.toAdd.weights) {
                const newWeight = { ...w };
                delete newWeight.id;
                const treatmentId = treatmentIdMap.get(w._importTreatmentId);
                delete newWeight._importTreatmentId;
                newWeight.treatment_id = treatmentId;
                if (newWeight.treatment_id) {
                    await DB.add('weight_records', newWeight);
                    stats.added.weights++;
                }
            }
            
            // 10. 處理副作用衝突
            for (const resolved of resolvedConflicts.filter(r => r.type === 'sideEffect')) {
                if (resolved.resolution === 'import') {
                    await DB.update('side_effects', { 
                        ...resolved.import, 
                        id: resolved.local.id,
                        treatment_id: resolved.local.treatment_id
                    });
                    stats.updated.sideEffects++;
                }
            }
            
            // 11. 同步刪除副作用（軟刪除）
            for (const item of analysis.toDelete.sideEffects) {
                item.local.deleted = true;
                item.local.deleted_at = item.import.deleted_at;
                await DB.update('side_effects', item.local);
                stats.deleted.sideEffects++;
            }
            
            // 12. 新增副作用
            for (const se of analysis.toAdd.sideEffects) {
                const newSE = { ...se };
                delete newSE.id;
                const treatmentId = treatmentIdMap.get(se._importTreatmentId);
                delete newSE._importTreatmentId;
                newSE.treatment_id = treatmentId;
                if (newSE.treatment_id) {
                    await DB.add('side_effects', newSE);
                    stats.added.sideEffects++;
                }
            }
            
            // 13. 同步刪除介入（軟刪除）
            for (const item of analysis.toDelete.interventions) {
                item.local.deleted = true;
                item.local.deleted_at = item.import.deleted_at;
                await DB.update('interventions', item.local);
                stats.deleted.interventions++;
            }
            
            // 14. 新增介入
            for (const i of analysis.toAdd.interventions) {
                const newI = { ...i };
                delete newI.id;
                const treatmentId = treatmentIdMap.get(i._importTreatmentId);
                delete newI._importTreatmentId;
                newI.treatment_id = treatmentId;
                if (newI.treatment_id) {
                    await DB.add('interventions', newI);
                    stats.added.interventions++;
                }
            }
            
            // 15. 同步刪除滿意度（軟刪除）
            for (const item of (analysis.toDelete.satisfaction || [])) {
                item.local.deleted = true;
                item.local.deleted_at = item.import.deleted_at;
                await DB.update('satisfaction', item.local);
                stats.deleted.satisfaction++;
            }
            
            // 16. 新增滿意度
            for (const s of (analysis.toAdd.satisfaction || [])) {
                const newS = { ...s };
                delete newS.id;
                const treatmentId = treatmentIdMap.get(s._importTreatmentId);
                delete newS._importTreatmentId;
                newS.treatment_id = treatmentId;
                if (newS.treatment_id) {
                    await DB.add('satisfaction', newS);
                    stats.added.satisfaction++;
                }
            }
            
            // 顯示結果
            this.showSyncResult(stats, resolvedConflicts.length);
            
            // 記錄同步時間
            await Settings.set('last_sync_time', new Date().toISOString());
            
            App.refresh();
            
        } catch (e) {
            console.error('同步執行失敗:', e);
            showToast('同步失敗: ' + e.message, 'error');
        }
    },
    
    /**
     * 顯示同步結果
     */
    showSyncResult(stats, conflictCount) {
        const totalAdded = stats.added.patients + stats.added.treatments + 
                          stats.added.weights + stats.added.sideEffects + stats.added.interventions + stats.added.satisfaction;
        const totalUpdated = stats.updated.patients + stats.updated.treatments + 
                            stats.updated.weights + stats.updated.sideEffects + stats.updated.interventions + stats.updated.satisfaction;
        const totalDeleted = stats.deleted.patients + stats.deleted.treatments + 
                            stats.deleted.weights + stats.deleted.sideEffects + stats.deleted.interventions + stats.deleted.satisfaction;
        
        // 格式化統計行
        const formatRow = (label, added, updated, deleted) => {
            const parts = [];
            if (added > 0) parts.push(`<span style="color: var(--success);">+${added}</span>`);
            if (updated > 0) parts.push(`<span style="color: var(--primary);">↻${updated}</span>`);
            if (deleted > 0) parts.push(`<span style="color: var(--danger);">-${deleted}</span>`);
            return `<div class="detail-row"><span>${label}</span><span>${parts.length > 0 ? parts.join(' ') : '-'}</span></div>`;
        };
        
        const html = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
                <h3 style="margin-bottom: 16px;">同步完成</h3>
                
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; text-align: left;">
                    ${formatRow('病人', stats.added.patients, stats.updated.patients, stats.deleted.patients)}
                    ${formatRow('療程', stats.added.treatments, stats.updated.treatments, stats.deleted.treatments)}
                    ${formatRow('體重記錄', stats.added.weights, stats.updated.weights, stats.deleted.weights)}
                    ${formatRow('副作用評估', stats.added.sideEffects, stats.updated.sideEffects, stats.deleted.sideEffects)}
                    ${formatRow('介入記錄', stats.added.interventions, stats.updated.interventions, stats.deleted.interventions)}
                </div>
                
                ${conflictCount > 0 ? `
                    <p style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">
                        已處理 ${conflictCount} 筆衝突
                    </p>
                ` : ''}
                
                ${totalAdded === 0 && totalUpdated === 0 && totalDeleted === 0 ? `
                    <p style="margin-top: 12px; font-size: 13px; color: var(--text-secondary);">
                        本地資料已是最新
                    </p>
                ` : ''}
            </div>
        `;
        
        openModal('同步結果', html, [
            { text: '確定', class: 'btn-primary' }
        ]);
    },
    
    /**
     * 備份到網芳（使用 File System Access API）
     */
    async backupToFile() {
        const data = await exportPatientData();
        
        // 使用建議的檔名
        const filename = 'SELA_RTO_病人資料.json';
        
        const result = await downloadJSON(data, filename);
        
        if (result) {
            await Settings.set('last_backup_time', new Date().toISOString());
            showToast('備份完成', 'success');
        }
    },
    
    /**
     * 關閉前檢查是否需要備份
     */
    async checkOnClose() {
        const enabled = await Settings.get('sync_on_close', true);
        if (!enabled) return true;
        
        // 這裡只是設定 flag，實際的提示在 beforeunload 事件處理
        return true;
    },
    
    /**
     * 顯示關閉備份提示
     */
    showClosePrompt() {
        return new Promise((resolve) => {
            const html = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 48px; margin-bottom: 16px;">💾</div>
                    <p style="margin-bottom: 16px;">是否備份資料到網芳？</p>
                    <p style="font-size: 13px; color: var(--text-secondary);">
                        建議每天下班前備份，確保資料安全
                    </p>
                </div>
            `;
            
            openModal('備份提示', html, [
                { 
                    text: '不備份', 
                    class: 'btn-outline',
                    onClick: () => resolve(false)
                },
                { 
                    text: '備份後關閉', 
                    class: 'btn-primary',
                    closeOnClick: false,
                    onClick: async () => {
                        closeModal();
                        await this.backupToFile();
                        resolve(true);
                    }
                }
            ]);
        });
    }
};
