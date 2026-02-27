/**
 * 彰濱放腫體重監控預防系統 - 療程管理模組
 */

const Treatment = {
    /**
     * 依 ID 取得療程
     */
    async getById(id) {
        const treatment = await DB.get('treatments', id);
        if (treatment) {
            // 附加癌別標籤
            const cancerTypes = await Settings.get('cancer_types', []);
            const ct = cancerTypes.find(c => c.code === treatment.cancer_type);
            treatment.cancer_type_label = ct ? ct.label : treatment.cancer_type;
            
            // 附加治療目的標籤
            const intents = await Settings.get('treatment_intents', []);
            const intent = intents.find(i => i.code === treatment.treatment_intent);
            treatment.treatment_intent_label = intent ? intent.label : treatment.treatment_intent;
        }
        return treatment;
    },
    
    /**
     * 依病人取得療程
     */
    async getByPatient(patientId) {
        const treatments = await DB.getByIndex('treatments', 'patient_id', patientId);
        const cancerTypes = await Settings.get('cancer_types', []);
        
        return treatments.map(t => {
            const ct = cancerTypes.find(c => c.code === t.cancer_type);
            t.cancer_type_label = ct ? ct.label : t.cancer_type;
            return t;
        }).sort((a, b) => new Date(b.treatment_start) - new Date(a.treatment_start));
    },
    
    /**
     * 取得所有進行中療程
     */
    async getActive() {
        const all = await DB.getByIndex('treatments', 'status', 'active');
        return this.enrichTreatments(all);
    },
    
    /**
     * 取得所有暫停中療程
     */
    async getPaused() {
        const all = await DB.getByIndex('treatments', 'status', 'paused');
        return this.enrichTreatments(all);
    },
    
    /**
     * 擴充療程資料（加入病人資訊、最新體重等）
     */
    async enrichTreatments(treatments) {
        const cancerTypes = await Settings.get('cancer_types', []);
        const alertRules = await Settings.get('alert_rules', []);
        
        const enriched = [];
        for (const t of treatments) {
            // 病人資料
            const patient = await Patient.getById(t.patient_id);
            if (!patient) continue;
            
            t.patient = patient;
            
            // 癌別標籤
            const ct = cancerTypes.find(c => c.code === t.cancer_type);
            t.cancer_type_label = ct ? ct.label : t.cancer_type;
            
            // 最新體重記錄
            const weights = await Weight.getByTreatment(t.id);
            t.weight_records = weights;
            t.latest_weight = weights[0] || null;
            
            // 計算變化率
            if (t.latest_weight && t.baseline_weight) {
                t.change_rate = calculateWeightChangeRate(t.latest_weight.weight, t.baseline_weight);
            } else {
                t.change_rate = null;
            }
            
            // 追蹤狀態
            const lastDate = t.latest_weight?.measure_date || t.treatment_start;
            t.tracking_status = getTrackingStatus(lastDate);
            
            // 待處理介入
            const interventions = await Intervention.getByTreatment(t.id);
            t.pending_interventions = interventions.filter(i => i.status === 'pending');
            
            enriched.push(t);
        }
        
        // 依病歷號排序
        return enriched.sort((a, b) => 
            a.patient.medical_id.localeCompare(b.patient.medical_id)
        );
    },
    
    /**
     * 新增療程
     */
    async create(data) {
        // 檢查是否有未結束療程
        const existing = await this.getByPatient(data.patient_id);
        const ongoing = existing.find(t => t.status === 'active' || t.status === 'paused');
        
        if (ongoing) {
            const statusText = ongoing.status === 'active' ? '進行中' : '暫停中';
            throw new Error(`此病人已有${statusText}的療程，請先結案或終止`);
        }
        
        data.status = 'active';
        return DB.add('treatments', data);
    },
    
    /**
     * 更新療程
     */
    async update(data) {
        return DB.update('treatments', data);
    },
    
    /**
     * 暫停療程
     */
    async pause(treatmentId, reason = '') {
        const treatment = await this.getById(treatmentId);
        if (!treatment) throw new Error('找不到療程');
        
        treatment.status = 'paused';
        treatment.pause_reason = reason;
        treatment.paused_at = new Date().toISOString();
        
        return this.update(treatment);
    },
    
    /**
     * 確認暫停療程
     */
    async confirmPause(treatmentId) {
        const treatment = await this.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const pauseReasons = await Settings.get('pause_reasons', []);
        
        // 建立原因選項
        const reasonOptions = pauseReasons.map(r => 
            `<option value="${r.label}">${r.label}</option>`
        ).join('');
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
            </div>
            ${createFormGroup('暫停原因', `
                <select class="form-select" id="pause_reason_select" onchange="Treatment.onPauseReasonChange()">
                    <option value="">請選擇原因</option>
                    ${reasonOptions}
                </select>
            `)}
            <div id="pause_reason_custom_group" style="display: none;">
                ${createFormGroup('自訂原因', `
                    <input type="text" class="form-input" id="pause_reason_custom" 
                           placeholder="請輸入暫停原因">
                `)}
            </div>
            <p style="color: var(--text-hint); font-size: 12px;">
                暫停後病人會從「治療中」移到「暫停中」清單
            </p>
        `;
        
        openModal('暫停療程', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '確定暫停',
                class: 'btn-warning',
                closeOnClick: false,
                onClick: async () => {
                    const selectVal = document.getElementById('pause_reason_select').value;
                    const customVal = document.getElementById('pause_reason_custom').value.trim();
                    
                    // 判斷使用哪個原因
                    let reason = selectVal;
                    if (selectVal.includes('其他') || selectVal.includes('手填')) {
                        reason = customVal || selectVal;
                    }
                    
                    try {
                        await Treatment.pause(treatmentId, reason);
                        closeModal();
                        showToast('療程已暫停');
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 暫停原因選擇變更
     */
    onPauseReasonChange() {
        const select = document.getElementById('pause_reason_select');
        const customGroup = document.getElementById('pause_reason_custom_group');
        
        // 如果選擇包含「其他」或「手填」，顯示自訂輸入框
        if (select.value.includes('其他') || select.value.includes('手填')) {
            customGroup.style.display = 'block';
            document.getElementById('pause_reason_custom').focus();
        } else {
            customGroup.style.display = 'none';
        }
    },
    
    /**
     * 確認恢復療程
     */
    async confirmResume(treatmentId) {
        const treatment = await this.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        
        let pauseInfo = '';
        if (treatment.pause_reason) {
            pauseInfo = `<p style="color: var(--text-secondary); margin-top: 8px;">暫停原因：${treatment.pause_reason}</p>`;
        }
        if (treatment.paused_at) {
            pauseInfo += `<p style="color: var(--text-hint); font-size: 12px;">暫停時間：${formatDate(treatment.paused_at)}</p>`;
        }
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
                ${pauseInfo}
            </div>
            <p>確定要恢復此療程嗎？</p>
            <p style="color: var(--text-hint); font-size: 12px; margin-top: 8px;">
                恢復後病人會回到「治療中」清單
            </p>
        `;
        
        openModal('恢復療程', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '確定恢復',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    try {
                        await Treatment.resume(treatmentId);
                        closeModal();
                        showToast('療程已恢復');
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 恢復療程
     */
    async resume(treatmentId) {
        const treatment = await this.getById(treatmentId);
        if (!treatment) throw new Error('找不到療程');
        
        treatment.status = 'active';
        treatment.pause_reason = null;
        treatment.paused_at = null;
        
        return this.update(treatment);
    },
    
    /**
     * 結案療程
     */
    async complete(treatmentId) {
        const treatment = await this.getById(treatmentId);
        if (!treatment) throw new Error('找不到療程');
        
        treatment.status = 'completed';
        treatment.treatment_end = today();
        
        return this.update(treatment);
    },
    
    /**
     * 確認結案療程
     */
    async confirmComplete(treatmentId) {
        const treatment = await this.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
            </div>
            <p>確定要結案此療程嗎？</p>
            <p style="color: var(--text-hint); font-size: 12px; margin-top: 8px;">
                結案後療程將標記為「已完成」
            </p>
        `;
        
        openModal('結案療程', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '確定結案',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    try {
                        await Treatment.complete(treatmentId);
                        closeModal();
                        showToast('療程已結案');
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 終止療程
     */
    async terminate(treatmentId, reason = '') {
        const treatment = await this.getById(treatmentId);
        if (!treatment) throw new Error('找不到療程');
        
        treatment.status = 'terminated';
        treatment.treatment_end = today();
        treatment.terminate_reason = reason;
        
        return this.update(treatment);
    },
    
    /**
     * 確認終止療程
     */
    async confirmTerminate(treatmentId) {
        const treatment = await this.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
            </div>
            ${createFormGroup('終止原因（選填）', `
                <input type="text" class="form-input" id="terminate_reason" 
                       placeholder="例如：轉院、放棄治療">
            `)}
            <p style="color: var(--danger); font-size: 12px; margin-top: 8px;">
                終止後療程將標記為「已終止」
            </p>
        `;
        
        openModal('提早終止療程', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '確定終止',
                class: 'btn-danger',
                closeOnClick: false,
                onClick: async () => {
                    const reason = document.getElementById('terminate_reason').value.trim();
                    try {
                        await Treatment.terminate(treatmentId, reason);
                        closeModal();
                        showToast('療程已終止');
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 顯示新增療程對話框
     */
    async showForm(patient, treatment = null) {
        const isEdit = !!treatment;
        const title = isEdit ? '編輯療程' : '新增療程';
        
        const cancerTypes = await Settings.get('cancer_types', []);
        const intents = await Settings.get('treatment_intents', []);
        
        const isUnableToMeasure = treatment?.unable_to_measure || false;
        
        const html = `
            <form id="treatment-form">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                    <span style="color: var(--text-secondary); margin-left: 8px;">
                        ${formatGender(patient.gender)} · ${calculateAge(patient.birth_date)}歲
                    </span>
                </div>
                
                <div class="form-row">
                    ${createFormGroup('治療目的', createSelect('treatment_intent', intents, treatment?.treatment_intent), true)}
                    ${createFormGroup('癌別', createSelect('cancer_type', cancerTypes, treatment?.cancer_type), true)}
                </div>
                
                ${createFormGroup('開始日期', `
                    <input type="date" class="form-input" id="treatment_start" 
                           value="${treatment?.treatment_start || today()}">
                `, true)}
                
                <div class="form-row">
                    ${createFormGroup('基準體重 (kg)', `
                        <input type="number" step="0.1" class="form-input" id="baseline_weight" 
                               value="${isUnableToMeasure ? '' : (treatment?.baseline_weight || '')}" 
                               placeholder="輸入體重"
                               ${isUnableToMeasure ? 'disabled' : ''}>
                    `)}
                    <div class="form-group" style="display: flex; align-items: flex-end; padding-bottom: 8px;">
                        <label class="form-checkbox">
                            <input type="checkbox" id="unable_to_measure" 
                                   ${isUnableToMeasure ? 'checked' : ''}
                                   onchange="Treatment.toggleWeightInput(this.checked)">
                            <span>無法測量</span>
                        </label>
                    </div>
                </div>
            </form>
        `;
        
        openModal(title, html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: isEdit ? '儲存' : '建立療程',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const valid = validateRequired([
                        { id: 'treatment_intent', label: '治療目的' },
                        { id: 'cancer_type', label: '癌別' },
                        { id: 'treatment_start', label: '開始日期' }
                    ]);
                    if (!valid) return;
                    
                    const unableToMeasure = document.getElementById('unable_to_measure').checked;
                    const baselineWeight = document.getElementById('baseline_weight').value;
                    
                    // 驗證：無法測量時不能填體重
                    if (unableToMeasure && baselineWeight) {
                        showToast('勾選無法測量時不能填寫體重', 'error');
                        return;
                    }
                    
                    // 驗證：必須二擇一
                    if (!unableToMeasure && !baselineWeight) {
                        showToast('請輸入基準體重或勾選無法測量', 'error');
                        return;
                    }
                    
                    const data = {
                        patient_id: patient.id,
                        treatment_intent: document.getElementById('treatment_intent').value,
                        cancer_type: document.getElementById('cancer_type').value,
                        treatment_start: document.getElementById('treatment_start').value,
                        baseline_weight: baselineWeight ? parseFloat(baselineWeight) : null,
                        unable_to_measure: unableToMeasure
                    };
                    
                    try {
                        if (isEdit) {
                            data.id = treatment.id;
                            data.status = treatment.status;
                            data.created_at = treatment.created_at;
                            await Treatment.update(data);
                            showToast('療程已更新');
                        } else {
                            await Treatment.create(data);
                            showToast('療程已建立');
                        }
                        closeModal();
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 切換體重輸入框狀態
     */
    toggleWeightInput(isUnableToMeasure) {
        const weightInput = document.getElementById('baseline_weight');
        if (isUnableToMeasure) {
            weightInput.value = '';
            weightInput.disabled = true;
            weightInput.placeholder = '無法測量';
        } else {
            weightInput.disabled = false;
            weightInput.placeholder = '輸入體重';
        }
    },
    
    /**
     * 顯示療程操作選單
     */
    async showActions(treatmentId) {
        const treatment = await this.getById(treatmentId);
        if (!treatment) return;
        
        const patient = await Patient.getById(treatment.patient_id);
        
        let actionsHtml = '';
        
        if (treatment.status === 'active') {
            actionsHtml = `
                <button class="btn btn-outline" style="width: 100%; margin-bottom: 8px;" 
                        onclick="Treatment.pause(${treatmentId}, '').then(() => { closeModal(); App.refresh(); showToast('療程已暫停'); })">
                    暫停療程
                </button>
                <button class="btn btn-outline" style="width: 100%; margin-bottom: 8px;"
                        onclick="Treatment.complete(${treatmentId}).then(() => { closeModal(); App.refresh(); showToast('療程已結案'); })">
                    結案
                </button>
                <button class="btn btn-danger" style="width: 100%;"
                        onclick="Treatment.terminate(${treatmentId}).then(() => { closeModal(); App.refresh(); showToast('療程已終止'); })">
                    終止療程
                </button>
            `;
        } else if (treatment.status === 'paused') {
            actionsHtml = `
                <button class="btn btn-primary" style="width: 100%; margin-bottom: 8px;"
                        onclick="Treatment.resume(${treatmentId}).then(() => { closeModal(); App.refresh(); showToast('療程已恢復'); })">
                    恢復療程
                </button>
                <button class="btn btn-outline" style="width: 100%; margin-bottom: 8px;"
                        onclick="Treatment.complete(${treatmentId}).then(() => { closeModal(); App.refresh(); showToast('療程已結案'); })">
                    結案
                </button>
                <button class="btn btn-danger" style="width: 100%;"
                        onclick="Treatment.terminate(${treatmentId}).then(() => { closeModal(); App.refresh(); showToast('療程已終止'); })">
                    終止療程
                </button>
            `;
        }
        
        const html = `
            <div style="text-align: center; margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}<br>
                <span class="tag ${getStatusTagClass(treatment.status)}">${formatTreatmentStatus(treatment.status)}</span>
            </div>
            ${actionsHtml}
        `;
        
        openModal('療程操作', html, [
            { text: '關閉', class: 'btn-outline' }
        ]);
    },
    
    /**
     * 顯示編輯療程對話框（從追蹤頁呼叫）
     */
    async showEditForm(treatmentId) {
        const treatment = await this.getById(treatmentId);
        if (!treatment) {
            showToast('找不到療程', 'error');
            return;
        }
        
        const patient = await Patient.getById(treatment.patient_id);
        if (!patient) {
            showToast('找不到病人', 'error');
            return;
        }
        
        // 呼叫原有的 showForm
        await this.showForm(patient, treatment);
    }
};
