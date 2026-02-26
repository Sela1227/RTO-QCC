/**
 * SELA 體重追蹤系統 - 介入管理模組
 */

const Intervention = {
    /**
     * 依療程取得介入記錄
     */
    async getByTreatment(treatmentId) {
        const records = await DB.getByIndex('interventions', 'treatment_id', treatmentId);
        return records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    
    /**
     * 依 ID 取得
     */
    async getById(id) {
        return DB.get('interventions', id);
    },
    
    /**
     * 取得所有待處理介入
     */
    async getPending() {
        const all = await DB.getByIndex('interventions', 'status', 'pending');
        
        // 擴充資料
        const enriched = [];
        for (const i of all) {
            const treatment = await Treatment.getById(i.treatment_id);
            if (!treatment || treatment.status !== 'active') continue;
            
            const patient = await Patient.getById(treatment.patient_id);
            if (!patient) continue;
            
            i.treatment = treatment;
            i.patient = patient;
            enriched.push(i);
        }
        
        return enriched;
    },
    
    /**
     * 新增介入
     */
    async create(data) {
        data.status = data.status || 'pending';
        return DB.add('interventions', data);
    },
    
    /**
     * 執行介入
     */
    async execute(id, executor = '', notes = '', executeDate = null) {
        const intervention = await this.getById(id);
        if (!intervention) throw new Error('找不到介入記錄');
        
        intervention.status = 'executed';
        intervention.executed_at = executeDate ? new Date(executeDate).toISOString() : new Date().toISOString();
        intervention.execute_date = executeDate || today();
        intervention.executor = executor;
        intervention.notes = notes;
        
        return DB.update('interventions', intervention);
    },
    
    /**
     * 跳過介入
     */
    async skip(id, reason = '') {
        const intervention = await this.getById(id);
        if (!intervention) throw new Error('找不到介入記錄');
        
        intervention.status = 'skipped';
        intervention.skipped_at = new Date().toISOString();
        intervention.skip_reason = reason;
        
        return DB.update('interventions', intervention);
    },
    
    /**
     * 新增手動介入
     */
    async createManual(treatmentId, notes = '') {
        return this.create({
            treatment_id: treatmentId,
            type: 'manual',
            notes: notes,
            status: 'executed',
            executed_at: new Date().toISOString()
        });
    },
    
    /**
     * 顯示執行介入對話框
     */
    async showExecuteForm(interventionId) {
        const intervention = await this.getById(interventionId);
        if (!intervention) return;
        
        const treatment = await Treatment.getById(intervention.treatment_id);
        const patient = await Patient.getById(treatment.patient_id);
        const staffList = await Settings.get('staff_list', []);
        
        const html = `
            <form id="execute-form">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}<br>
                    <span class="tag tag-amber">${formatInterventionType(intervention.type)}</span>
                    <span style="color: var(--text-secondary); margin-left: 8px;">
                        觸發變化率: ${formatChangeRate(intervention.trigger_rate)}
                    </span>
                </div>
                
                <div class="form-row">
                    ${createFormGroup('執行日期', `
                        <input type="date" class="form-input" id="execute_date" value="${today()}">
                    `, true)}
                    ${createFormGroup('執行人員', createSelect('executor', staffList))}
                </div>
                ${createFormGroup('備註', `
                    <textarea class="form-input" id="notes" rows="3" placeholder="輸入備註..."></textarea>
                `)}
            </form>
        `;
        
        openModal('執行介入', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '不執行',
                class: 'btn-outline',
                closeOnClick: false,
                onClick: async () => {
                    await Intervention.skip(interventionId, '手動跳過');
                    closeModal();
                    showToast('已標記為不執行');
                    App.refresh();
                }
            },
            {
                text: '確認執行',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const executeDate = document.getElementById('execute_date').value;
                    const executor = document.getElementById('executor').value;
                    const notes = document.getElementById('notes').value;
                    
                    if (!executeDate) {
                        showToast('請選擇執行日期', 'error');
                        return;
                    }
                    
                    try {
                        await Intervention.execute(interventionId, executor, notes, executeDate);
                        closeModal();
                        showToast('介入已執行');
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 顯示介入記錄列表
     */
    async showList(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const records = await this.getByTreatment(treatmentId);
        
        let listHtml = '';
        if (records.length === 0) {
            listHtml = '<p style="color: var(--text-hint); text-align: center;">尚無介入記錄</p>';
        } else {
            listHtml = records.map(r => {
                let statusTag = '';
                let dateDisplay = '';
                
                if (r.status === 'pending') {
                    statusTag = '<span class="tag tag-amber">待處理</span>';
                    dateDisplay = `建立: ${formatDate(r.created_at)}`;
                } else if (r.status === 'executed') {
                    statusTag = '<span class="tag tag-green">已執行</span>';
                    dateDisplay = `執行: ${formatDate(r.execute_date || r.executed_at)}`;
                } else {
                    statusTag = '<span class="tag tag-gray">不執行</span>';
                    dateDisplay = `${formatDate(r.skipped_at || r.created_at)}`;
                }
                
                return `
                    <div class="detail-row" style="align-items: flex-start;">
                        <div>
                            <strong>${formatInterventionType(r.type)}</strong>
                            ${statusTag}
                            <br>
                            <span style="color: var(--text-hint); font-size: 12px;">
                                ${dateDisplay}
                                ${r.executor ? ` · ${r.executor}` : ''}
                            </span>
                            ${r.notes ? `<br><span style="color: var(--text-secondary); font-size: 12px;">${r.notes}</span>` : ''}
                        </div>
                        ${r.status === 'pending' ? `
                            <button class="btn btn-primary" style="padding: 4px 12px; font-size: 12px;"
                                    onclick="Intervention.showExecuteForm(${r.id})">
                                執行
                            </button>
                        ` : ''}
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
            </div>
            <div class="detail-section">
                ${listHtml}
            </div>
        `;
        
        openModal('介入記錄', html, [
            { text: '關閉', class: 'btn-outline' },
            {
                text: '手動介入',
                class: 'btn-outline',
                closeOnClick: false,
                onClick: () => {
                    closeModal();
                    setTimeout(() => Intervention.showManualForm(treatmentId), 100);
                }
            }
        ]);
    },
    
    /**
     * 顯示手動介入對話框
     */
    async showManualForm(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const staffList = await Settings.get('staff_list', []);
        
        const html = `
            <form id="manual-intervention-form">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                </div>
                
                <div class="form-row">
                    ${createFormGroup('執行日期', `
                        <input type="date" class="form-input" id="manual_date" value="${today()}">
                    `, true)}
                    ${createFormGroup('執行人員', createSelect('manual_executor', staffList))}
                </div>
                ${createFormGroup('備註', `
                    <textarea class="form-input" id="manual_notes" rows="3" placeholder="輸入備註..."></textarea>
                `)}
            </form>
        `;
        
        openModal('手動介入', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '確認新增',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const executeDate = document.getElementById('manual_date').value;
                    const executor = document.getElementById('manual_executor').value;
                    const notes = document.getElementById('manual_notes').value;
                    
                    if (!executeDate) {
                        showToast('請選擇執行日期', 'error');
                        return;
                    }
                    
                    try {
                        await Intervention.create({
                            treatment_id: treatmentId,
                            type: 'manual',
                            notes: notes,
                            executor: executor,
                            status: 'executed',
                            execute_date: executeDate,
                            executed_at: new Date(executeDate).toISOString()
                        });
                        closeModal();
                        showToast('手動介入已新增');
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    }
};
