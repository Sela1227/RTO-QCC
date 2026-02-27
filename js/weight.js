/**
 * 彰濱放腫體重監控預防系統 - 體重記錄模組
 */

const Weight = {
    /**
     * 依療程取得體重記錄（依日期降序）
     */
    async getByTreatment(treatmentId) {
        const records = await DB.getByIndex('weight_records', 'treatment_id', treatmentId);
        return records.sort((a, b) => new Date(b.measure_date) - new Date(a.measure_date));
    },
    
    /**
     * 依 ID 取得記錄
     */
    async getById(id) {
        return DB.get('weight_records', id);
    },
    
    /**
     * 新增體重記錄
     */
    async create(treatmentId, weight, measureDate = today(), unableToMeasure = false) {
        // 檢查日期是否重複
        const existing = await this.getByTreatment(treatmentId);
        const duplicate = existing.find(r => r.measure_date === measureDate);
        if (duplicate) {
            throw new Error('該日期已有記錄');
        }
        
        const treatment = await Treatment.getById(treatmentId);
        if (!treatment) throw new Error('找不到療程');
        
        const data = {
            treatment_id: treatmentId,
            measure_date: measureDate,
            unable_to_measure: unableToMeasure
        };
        
        if (unableToMeasure) {
            // 無法量測
            data.weight = null;
            data.change_rate = null;
        } else {
            data.weight = parseFloat(weight);
            
            // 如果療程開始時是無法量測且尚無基準體重，將此體重設為基準
            if (!treatment.baseline_weight && treatment.unable_to_measure) {
                treatment.baseline_weight = data.weight;
                treatment.unable_to_measure = false;
                await Treatment.update(treatment);
                showToast('已設定為基準體重');
            }
            
            // 計算變化率
            if (treatment.baseline_weight) {
                data.change_rate = calculateWeightChangeRate(data.weight, treatment.baseline_weight);
            }
        }
        
        const record = await DB.add('weight_records', data);
        
        // 檢查是否需要觸發警示（只有實際體重才觸發）
        if (!unableToMeasure && data.change_rate !== null && data.change_rate !== undefined) {
            await this.checkAndTriggerAlert(treatmentId, data.change_rate, treatment.cancer_type);
        }
        
        return record;
    },
    
    /**
     * 更新體重記錄
     */
    async update(id, weight, measureDate, unableToMeasure = false) {
        const record = await this.getById(id);
        if (!record) throw new Error('找不到記錄');
        
        const treatment = await Treatment.getById(record.treatment_id);
        
        // 檢查日期是否與其他記錄重複
        const existing = await this.getByTreatment(record.treatment_id);
        const duplicate = existing.find(r => r.measure_date === measureDate && r.id !== id);
        if (duplicate) {
            throw new Error('該日期已有記錄');
        }
        
        record.measure_date = measureDate;
        record.unable_to_measure = unableToMeasure;
        
        if (unableToMeasure) {
            record.weight = null;
            record.change_rate = null;
        } else {
            record.weight = parseFloat(weight);
            
            if (treatment.baseline_weight) {
                record.change_rate = calculateWeightChangeRate(record.weight, treatment.baseline_weight);
            }
        }
        
        return DB.update('weight_records', record);
    },
    
    /**
     * 刪除體重記錄
     */
    async delete(id) {
        return DB.delete('weight_records', id);
    },
    
    /**
     * 檢查並觸發警示
     */
    async checkAndTriggerAlert(treatmentId, changeRate, cancerType) {
        const alertRules = await Settings.get('alert_rules', []);
        const alert = checkAlertTrigger(changeRate, cancerType, alertRules);
        
        if (alert) {
            // 檢查是否已有待處理的同類型介入
            const existing = await Intervention.getByTreatment(treatmentId);
            const pending = existing.find(i => 
                i.type === alert.type && i.status === 'pending'
            );
            
            if (!pending) {
                // 建立新的介入提醒
                await Intervention.create({
                    treatment_id: treatmentId,
                    type: alert.type,
                    trigger_rate: changeRate,
                    status: 'pending'
                });
            }
        }
    },
    
    /**
     * 顯示記錄體重對話框
     */
    async showForm(treatmentId, record = null) {
        const isEdit = !!record;
        const title = isEdit ? '編輯體重記錄' : '記錄體重';
        
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        
        // 取得最近一次體重記錄
        const allRecords = await this.getByTreatment(treatmentId);
        const lastValidRecord = allRecords.find(r => !r.unable_to_measure && r.weight);
        
        // 檢查是否需要設定基準體重（療程開始時無法量測且尚無基準體重）
        const needsBaseline = !treatment.baseline_weight && treatment.unable_to_measure;
        
        let baselineInfo = '';
        if (treatment.baseline_weight) {
            baselineInfo = `<br><span style="color: var(--text-secondary);">基準體重: ${treatment.baseline_weight} kg</span>`;
        } else if (treatment.unable_to_measure) {
            baselineInfo = `<br><span style="color: var(--warning);">⚠ 尚無基準體重，此次記錄將作為基準</span>`;
        }
        
        // 最近體重資訊
        let lastWeightInfo = '';
        if (!isEdit && lastValidRecord) {
            const rateText = lastValidRecord.change_rate !== null 
                ? ` (${formatChangeRate(lastValidRecord.change_rate)})` 
                : '';
            lastWeightInfo = `
                <div style="background: var(--bg); padding: 10px 12px; border-radius: 6px; margin-bottom: 16px; font-size: 13px;">
                    <span style="color: var(--text-secondary);">最近記錄：</span>
                    <strong>${lastValidRecord.weight} kg</strong>${rateText}
                    <span style="color: var(--text-hint); margin-left: 8px;">${formatDate(lastValidRecord.measure_date)}</span>
                </div>
            `;
        }
        
        const html = `
            <form id="weight-form">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                    ${baselineInfo}
                </div>
                ${lastWeightInfo}
                <div class="form-row">
                    ${createFormGroup('體重 (kg)', `
                        <input type="number" step="0.1" class="form-input" id="weight" 
                               value="${record?.weight || ''}" 
                               placeholder="輸入體重" autofocus
                               ${record?.unable_to_measure ? 'disabled' : ''}>
                    `)}
                    ${createFormGroup('量測日期', `
                        <input type="date" class="form-input" id="measure_date" 
                               value="${record?.measure_date || today()}">
                    `, true)}
                </div>
                <div class="form-group">
                    <label class="form-checkbox">
                        <input type="checkbox" id="weight_unable_to_measure" 
                               ${record?.unable_to_measure ? 'checked' : ''}
                               onchange="Weight.toggleWeightInput(this.checked)">
                        <span>無法測量</span>
                    </label>
                </div>
            </form>
        `;
        
        openModal(title, html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: isEdit ? '儲存' : '記錄',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const unableToMeasure = document.getElementById('weight_unable_to_measure').checked;
                    const weight = document.getElementById('weight').value;
                    const measureDate = document.getElementById('measure_date').value;
                    
                    if (!unableToMeasure) {
                        if (!weight) {
                            showToast('請輸入體重或勾選無法測量', 'error');
                            return;
                        }
                        
                        const w = parseFloat(weight);
                        if (w <= 0 || w > 300) {
                            showToast('體重數值不合理', 'error');
                            return;
                        }
                    }
                    
                    if (!measureDate) {
                        showToast('請選擇量測日期', 'error');
                        return;
                    }
                    
                    try {
                        if (isEdit) {
                            await Weight.update(record.id, unableToMeasure ? null : weight, measureDate, unableToMeasure);
                            showToast('記錄已更新');
                        } else {
                            await Weight.create(treatmentId, unableToMeasure ? null : weight, measureDate, unableToMeasure);
                            showToast(unableToMeasure ? '已記錄無法測量' : '體重已記錄');
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
        const weightInput = document.getElementById('weight');
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
     * 顯示體重記錄列表
     */
    async showList(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const records = await this.getByTreatment(treatmentId);
        
        let listHtml = '';
        if (records.length === 0) {
            listHtml = '<p style="color: var(--text-hint); text-align: center;">尚無體重記錄</p>';
        } else {
            listHtml = records.map(r => {
                const rateClass = getRateClass(r.change_rate);
                const weightDisplay = r.unable_to_measure 
                    ? '<span style="color: var(--text-hint);">無法測量</span>'
                    : `<strong>${r.weight}</strong> kg`;
                const rateDisplay = (!r.unable_to_measure && r.change_rate !== null)
                    ? `<span class="${rateClass}" style="margin-left: 8px;">${formatChangeRate(r.change_rate)}</span>`
                    : '';
                
                return `
                    <div class="detail-row">
                        <span>${formatDate(r.measure_date)}</span>
                        <span>
                            ${weightDisplay}
                            ${rateDisplay}
                        </span>
                        <span>
                            <button class="btn-icon" onclick="Weight.showForm(${treatmentId}, {id: ${r.id}, weight: ${r.weight || 'null'}, measure_date: '${r.measure_date}', unable_to_measure: ${r.unable_to_measure || false}})">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                            </button>
                            <button class="btn-icon" onclick="confirmDialog('確定刪除此記錄？', async () => { await Weight.delete(${r.id}); closeModal(); App.refresh(); showToast('記錄已刪除'); })">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        </span>
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
                ${treatment.baseline_weight ? 
                    `<br><span style="color: var(--text-secondary);">基準體重: ${treatment.baseline_weight} kg</span>` 
                    : ''}
            </div>
            <div class="detail-section">
                ${listHtml}
            </div>
        `;
        
        openModal('體重記錄', html, [
            { text: '關閉', class: 'btn-outline' },
            { 
                text: '新增記錄', 
                class: 'btn-primary',
                onClick: () => Weight.showForm(treatmentId)
            }
        ]);
    }
};
