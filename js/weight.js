/**
 * 彰濱放腫體重監控預防系統 - 體重記錄模組
 */

const Weight = {
    /**
     * 依療程取得體重記錄（依日期降序，排除已刪除）
     */
    async getByTreatment(treatmentId) {
        const records = await DB.getByIndex('weight_records', 'treatment_id', treatmentId);
        return records
            .filter(r => !r.deleted)
            .sort((a, b) => new Date(b.measure_date) - new Date(a.measure_date));
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
     * 刪除體重記錄（軟刪除）
     */
    async delete(id) {
        const record = await DB.get('weight_records', id);
        if (record) {
            record.deleted = true;
            record.deleted_at = new Date().toISOString();
            return DB.update('weight_records', record);
        }
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
        
        // 編輯時體重值固定到第一位
        const weightValue = record?.weight ? parseFloat(record.weight).toFixed(1) : '';
        
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
                               value="${weightValue}" 
                               placeholder="輸入體重" autofocus
                               onblur="if(this.value) this.value = parseFloat(this.value).toFixed(1)"
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
                    const weightInput = document.getElementById('weight').value;
                    const measureDate = document.getElementById('measure_date').value;
                    
                    if (!unableToMeasure) {
                        if (!weightInput) {
                            showToast('請輸入體重或勾選無法測量', 'error');
                            return;
                        }
                        
                        const w = parseFloat(weightInput);
                        if (w <= 0 || w > 300) {
                            showToast('體重數值不合理', 'error');
                            return;
                        }
                    }
                    
                    if (!measureDate) {
                        showToast('請選擇量測日期', 'error');
                        return;
                    }
                    
                    // 體重固定到小數點第一位
                    const weight = unableToMeasure ? null : parseFloat(weightInput).toFixed(1);
                    
                    try {
                        if (isEdit) {
                            await Weight.update(record.id, weight, measureDate, unableToMeasure);
                            showToast('記錄已更新');
                        } else {
                            await Weight.create(treatmentId, weight, measureDate, unableToMeasure);
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
        const sideEffects = await SideEffect.getByTreatment(treatmentId);
        
        // 建立副作用日期對照表
        const sideEffectsByDate = {};
        sideEffects.forEach(se => {
            sideEffectsByDate[se.assess_date] = se;
        });
        
        let listHtml = '';
        if (records.length === 0) {
            listHtml = '<p style="color: var(--text-hint); text-align: center; padding: 20px;">尚無體重記錄</p>';
        } else {
            listHtml = '<div class="weight-record-list">' + records.map(r => {
                const rateClass = getRateClass(r.change_rate);
                // 體重限制到小數點第一位
                const weightValue = r.weight !== null ? parseFloat(r.weight).toFixed(1) : null;
                const weightDisplay = r.unable_to_measure 
                    ? '<span class="weight-value" style="color: var(--text-hint);">無法測量</span>'
                    : `<span class="weight-value">${weightValue} kg</span>`;
                const rateDisplay = (!r.unable_to_measure && r.change_rate !== null)
                    ? `<span class="weight-rate ${rateClass}">${formatChangeRate(r.change_rate)}</span>`
                    : '';
                
                // 檢查該日是否有副作用評估
                const se = sideEffectsByDate[r.measure_date];
                const seDisplay = se ? SideEffect.formatSymptomTags(se.symptoms) : '';
                
                return `
                    <div class="weight-record-item">
                        <div class="weight-record-main">
                            <div class="weight-record-date">${formatDate(r.measure_date)}</div>
                            <div class="weight-record-value">
                                ${weightDisplay}
                                ${rateDisplay}
                            </div>
                            <div class="weight-record-actions">
                                <button class="btn-icon" onclick="Weight.showForm(${treatmentId}, {id: ${r.id}, weight: ${r.weight || 'null'}, measure_date: '${r.measure_date}', unable_to_measure: ${r.unable_to_measure || false}})" title="編輯">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="btn-icon" onclick="confirmDialog('確定刪除此記錄？', async () => { await Weight.delete(${r.id}); closeModal(); App.refresh(); showToast('記錄已刪除'); })" title="刪除">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        ${seDisplay ? `<div class="weight-record-se">${seDisplay}</div>` : ''}
                    </div>
                `;
            }).join('') + '</div>';
        }
        
        const html = `
            <div class="weight-list-header">
                <div class="weight-list-patient">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                </div>
                ${treatment.baseline_weight ? 
                    `<div class="weight-list-baseline">基準體重: ${parseFloat(treatment.baseline_weight).toFixed(1)} kg</div>` 
                    : ''}
            </div>
            ${listHtml}
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
