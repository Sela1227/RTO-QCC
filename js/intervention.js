/**
 * 彰濱放腫體重監控預防系統 - 介入管理模組
 */

const Intervention = {
    // 中文字體狀態
    fontLoaded: false,
    fontData: null,
    
    /**
     * 載入中文字體
     */
    async loadChineseFont() {
        if (this.fontLoaded && this.fontData) return true;
        
        try {
            // 使用 Google Fonts 的 Noto Sans TC
            const fontUrl = 'https://fonts.gstatic.com/s/notosanstc/v35/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_CpOtma3uNQ.ttf';
            
            const response = await fetch(fontUrl);
            if (!response.ok) throw new Error('Font fetch failed');
            
            const arrayBuffer = await response.arrayBuffer();
            
            // 轉換為 base64
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.length; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            this.fontData = btoa(binary);
            this.fontLoaded = true;
            
            console.log('中文字體載入完成');
            return true;
        } catch (e) {
            console.error('字體載入失敗:', e);
            return false;
        }
    },
    
    /**
     * 生成營養轉介單 PDF
     */
    async generateReferralPdf(treatmentId, options = {}) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const cancerTypes = await Settings.get('cancer_types', []);
        const cancerLabel = cancerTypes.find(c => c.code === treatment.cancer_type)?.label || treatment.cancer_type;
        
        const {
            referrer = '',
            phone = '',
            notes = '',
            referralNeeds = ['nutrition']
        } = options;
        
        // 載入中文字體
        showToast('正在載入字體...');
        const fontOk = await this.loadChineseFont();
        
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        
        // 註冊中文字體
        if (fontOk && this.fontData) {
            pdf.addFileToVFS('NotoSansTC.ttf', this.fontData);
            pdf.addFont('NotoSansTC.ttf', 'NotoSansTC', 'normal');
            pdf.setFont('NotoSansTC');
        }
        
        // 粉紅色背景
        pdf.setFillColor(255, 228, 236);
        pdf.rect(0, 0, pageWidth, 297, 'F');
        
        pdf.setTextColor(0, 0, 0);
        
        // === 頁首 ===
        pdf.setFontSize(9);
        pdf.text('用心、創新、追根究底', 15, 15);
        
        pdf.setFontSize(11);
        pdf.text('秀傳醫療財團法人彰濱秀傳紀念醫院', pageWidth - 15, 15, { align: 'right' });
        pdf.setFontSize(8);
        pdf.text('Chang Bing Show Chwan Memorial Hospital', pageWidth - 15, 20, { align: 'right' });
        
        // === 標題 ===
        pdf.setFontSize(16);
        pdf.text('癌症資源中心轉介單', pageWidth / 2, 35, { align: 'center' });
        
        // === 表格 ===
        const marginLeft = 15;
        const marginRight = pageWidth - 15;
        const tableWidth = marginRight - marginLeft;
        let y = 45;
        const rowH = 12;
        
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.3);
        
        // 第一行：日期 | 轉介同仁
        pdf.rect(marginLeft, y, tableWidth, rowH);
        pdf.line(marginLeft + 20, y, marginLeft + 20, y + rowH);
        pdf.line(marginLeft + 110, y, marginLeft + 110, y + rowH);
        
        const now = new Date();
        pdf.setFontSize(11);
        pdf.text('日期', marginLeft + 10, y + 8, { align: 'center' });
        pdf.text(`${now.getFullYear()}  年  ${now.getMonth() + 1}  月  ${now.getDate()}  日`, marginLeft + 65, y + 8, { align: 'center' });
        pdf.text(`轉介同仁  ${referrer}`, marginLeft + 115, y + 8);
        
        // 第二行：姓名 | 病歷號 | 癌別
        y += rowH;
        pdf.rect(marginLeft, y, tableWidth, rowH);
        pdf.line(marginLeft + 60, y, marginLeft + 60, y + rowH);
        pdf.line(marginLeft + 120, y, marginLeft + 120, y + rowH);
        
        const age = patient.birth_date ? calculateAge(patient.birth_date) : '';
        pdf.text(`姓名  ${patient.name}${age ? ` (${age}歲)` : ''}`, marginLeft + 5, y + 8);
        pdf.text(`病歷號  ${patient.medical_id}`, marginLeft + 65, y + 8);
        pdf.text(`癌別  ${cancerLabel}`, marginLeft + 125, y + 8);
        
        // 第三行：連絡電話
        y += rowH;
        pdf.rect(marginLeft, y, tableWidth, rowH);
        pdf.text(`連絡電話  ${phone}`, marginLeft + 5, y + 8);
        
        // 第四行：轉介需求（多行）
        y += rowH;
        const needH = 45;
        pdf.rect(marginLeft, y, tableWidth, needH);
        pdf.line(marginLeft + 20, y, marginLeft + 20, y + needH);
        
        pdf.text('轉介', marginLeft + 10, y + 12, { align: 'center' });
        pdf.text('需求', marginLeft + 10, y + 20, { align: 'center' });
        
        // 只顯示勾選的轉介需求
        pdf.setFontSize(10);
        const optX = marginLeft + 25;
        let optY = y + 10;
        const lineHeight = 8;
        
        const needLabels = {
            'assist': '輔助諮詢（經濟、營養品、居家照顧、義乳胸衣）',
            'nutrition': '營養諮詢',
            'wound': '傷口照護諮詢',
            'psychology': '心理支持',
            'rental': '租借（假髮、輔具）',
            'headwear': '頭巾/髮帽',
            'support_group': '病友團體',
            'other': '其他'
        };
        
        referralNeeds.forEach(need => {
            if (needLabels[need]) {
                pdf.text(`☑ ${needLabels[need]}`, optX, optY);
                optY += lineHeight;
            }
        });
        
        // 備註區
        y += needH;
        const noteH = 25;
        pdf.rect(marginLeft, y, tableWidth, noteH);
        pdf.line(marginLeft + 20, y, marginLeft + 20, y + noteH);
        
        pdf.setFontSize(11);
        pdf.text('備註', marginLeft + 10, y + 12, { align: 'center' });
        
        // 體重資訊
        pdf.setFontSize(10);
        let weightInfo = `基準：${treatment.baseline_weight || '-'} kg`;
        const weightRecords = await Weight.getByTreatment(treatmentId);
        const latestWeight = weightRecords.find(r => !r.unable_to_measure && r.weight);
        if (latestWeight) {
            weightInfo += ` → 目前：${latestWeight.weight} kg`;
            if (latestWeight.change_rate != null) {
                weightInfo += ` (${latestWeight.change_rate >= 0 ? '+' : ''}${latestWeight.change_rate.toFixed(1)}%)`;
            }
        }
        pdf.text(weightInfo, marginLeft + 25, y + 8);
        if (notes) {
            pdf.text(notes.substring(0, 50), marginLeft + 25, y + 18);
        }
        
        // 預約區
        y += noteH;
        pdf.rect(marginLeft, y, tableWidth, rowH);
        pdf.line(marginLeft + 20, y, marginLeft + 20, y + rowH);
        pdf.setFontSize(11);
        pdf.text('預約', marginLeft + 10, y + 8, { align: 'center' });
        
        // === 頁尾 ===
        pdf.setFontSize(9);
        pdf.text('彰濱秀傳紀念醫院癌症資源中心製  連絡電話：04-7813888 分機 70211', marginLeft, 280);
        
        // 下載
        const filename = `轉介單_${patient.medical_id}_${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}.pdf`;
        pdf.save(filename);
        
        return filename;
    },
    
    /**
     * 顯示生成轉介單對話框
     * @param {number} treatmentId - 療程 ID
     * @param {function} onComplete - 生成完成後的回調函數（可選）
     * @param {string} defaultReferrer - 預設轉介同仁（可選）
     */
    async showReferralForm(treatmentId, onComplete = null, defaultReferrer = '') {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const staffList = await Settings.get('staff_list', []);
        
        const html = `
            <form id="referral-form">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                </div>
                
                <div class="form-row">
                    ${createFormGroup('轉介同仁', createSelect('referrer', staffList, defaultReferrer), true)}
                    ${createFormGroup('病人電話', `
                        <input type="tel" class="form-input" id="referral_phone" placeholder="連絡電話">
                    `)}
                </div>
                
                <div class="form-group">
                    <label class="form-label">轉介需求</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                            <input type="checkbox" id="need_nutrition" checked> 營養諮詢
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                            <input type="checkbox" id="need_assist"> 輔助諮詢
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                            <input type="checkbox" id="need_wound"> 傷口照護
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                            <input type="checkbox" id="need_psychology"> 心理支持
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                            <input type="checkbox" id="need_rental"> 租借
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                            <input type="checkbox" id="need_headwear"> 頭巾/髮帽
                        </label>
                        <label style="display: flex; align-items: center; gap: 4px; font-size: 13px;">
                            <input type="checkbox" id="need_support_group"> 病友團體
                        </label>
                    </div>
                </div>
                
                ${createFormGroup('備註', `
                    <textarea class="form-input" id="referral_notes" rows="2" placeholder="其他備註..."></textarea>
                `)}
            </form>
        `;
        
        openModal('生成營養轉介單', html, [
            { text: '跳過', class: 'btn-outline' },
            {
                text: '生成 PDF',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const referrer = document.getElementById('referrer').value;
                    const phone = document.getElementById('referral_phone').value;
                    const notes = document.getElementById('referral_notes').value;
                    
                    // 收集勾選的需求
                    const referralNeeds = [];
                    if (document.getElementById('need_nutrition').checked) referralNeeds.push('nutrition');
                    if (document.getElementById('need_assist').checked) referralNeeds.push('assist');
                    if (document.getElementById('need_wound').checked) referralNeeds.push('wound');
                    if (document.getElementById('need_psychology').checked) referralNeeds.push('psychology');
                    if (document.getElementById('need_rental').checked) referralNeeds.push('rental');
                    if (document.getElementById('need_headwear').checked) referralNeeds.push('headwear');
                    if (document.getElementById('need_support_group').checked) referralNeeds.push('support_group');
                    
                    if (!referrer) {
                        showToast('請選擇轉介同仁', 'error');
                        return;
                    }
                    
                    try {
                        const filename = await Intervention.generateReferralPdf(treatmentId, {
                            referrer, phone, notes, referralNeeds
                        });
                        closeModal();
                        showToast(`已下載：${filename}`);
                        
                        // 如果有回調函數，執行它
                        if (onComplete) {
                            setTimeout(() => onComplete(), 200);
                        }
                    } catch (e) {
                        console.error(e);
                        showToast('生成失敗：' + e.message, 'error');
                    }
                }
            }
        ]);
    },
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
            // 檢查 treatment_id 是否有效
            if (!i.treatment_id || typeof i.treatment_id !== 'number') continue;
            
            const treatment = await Treatment.getById(i.treatment_id);
            if (!treatment || treatment.status !== 'active') continue;
            
            // 檢查 patient_id 是否有效
            if (!treatment.patient_id || typeof treatment.patient_id !== 'number') continue;
            
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
                        
                        // 如果是營養師介入，自動跳出生成轉介單
                        if (intervention.type === 'nutrition') {
                            setTimeout(() => {
                                Intervention.showReferralForm(treatment.id, null, executor);
                            }, 300);
                        }
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
                        <div style="flex: 1;">
                            <strong>${formatInterventionType(r.type)}</strong>
                            ${statusTag}
                            <br>
                            <span style="color: var(--text-hint); font-size: 12px;">
                                ${dateDisplay}
                                ${r.executor ? ` · ${r.executor}` : ''}
                            </span>
                            ${r.notes ? `<br><span style="color: var(--text-secondary); font-size: 12px;">${r.notes}</span>` : ''}
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                            ${r.status === 'pending' ? `
                                <button class="btn btn-primary" style="padding: 4px 12px; font-size: 12px;"
                                        onclick="Intervention.showExecuteForm(${r.id})">
                                    執行
                                </button>
                            ` : `
                                ${r.type === 'nutrition' && r.status === 'executed' ? `
                                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;"
                                            onclick="closeModal(); setTimeout(() => Intervention.showReferralForm(${treatmentId}, () => Intervention.showList(${treatmentId}), '${r.executor || ''}'), 100)">
                                        📄 轉介單
                                    </button>
                                ` : ''}
                                <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px;"
                                        onclick="Intervention.showEditForm(${r.id}, ${treatmentId})">
                                    編輯
                                </button>
                                <button class="btn btn-outline" style="padding: 4px 8px; font-size: 11px; color: var(--danger); border-color: var(--danger);"
                                        onclick="Intervention.confirmDelete(${r.id}, ${treatmentId})">
                                    刪除
                                </button>
                            `}
                        </div>
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
        
        // 手動介入類型選項
        const interventionTypes = [
            { code: 'sdm', label: 'SDM' },
            { code: 'nutrition', label: '營養師' },
            { code: 'ng_tube', label: '鼻胃管' },
            { code: 'gastrostomy', label: '胃造廔' }
        ];
        
        const html = `
            <form id="manual-intervention-form">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                </div>
                
                ${createFormGroup('介入類型', createSelect('manual_type', interventionTypes), true)}
                
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
                    const interventionType = document.getElementById('manual_type').value;
                    const executeDate = document.getElementById('manual_date').value;
                    const executor = document.getElementById('manual_executor').value;
                    const notes = document.getElementById('manual_notes').value;
                    
                    if (!interventionType) {
                        showToast('請選擇介入類型', 'error');
                        return;
                    }
                    
                    if (!executeDate) {
                        showToast('請選擇執行日期', 'error');
                        return;
                    }
                    
                    try {
                        await Intervention.create({
                            treatment_id: treatmentId,
                            type: interventionType,
                            notes: notes,
                            executor: executor,
                            status: 'executed',
                            execute_date: executeDate,
                            executed_at: new Date(executeDate).toISOString()
                        });
                        closeModal();
                        showToast('手動介入已新增');
                        App.refresh();
                        
                        // 如果是營養師介入，自動跳出生成轉介單，並帶入執行人員
                        if (interventionType === 'nutrition') {
                            setTimeout(() => {
                                Intervention.showReferralForm(treatmentId, null, executor);
                            }, 300);
                        }
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 顯示編輯介入對話框
     */
    async showEditForm(interventionId, treatmentId) {
        const intervention = await this.getById(interventionId);
        if (!intervention) return;
        
        const staffList = await Settings.get('staff_list', []);
        
        // 介入類型選項
        const interventionTypes = [
            { code: 'sdm', label: 'SDM' },
            { code: 'nutrition', label: '營養師' },
            { code: 'ng_tube', label: '鼻胃管' },
            { code: 'gastrostomy', label: '胃造廔' }
        ];
        
        const executeDate = intervention.execute_date || 
                           (intervention.executed_at ? intervention.executed_at.split('T')[0] : today());
        
        const html = `
            <form id="edit-intervention-form">
                ${createFormGroup('介入類型', createSelect('edit_type', interventionTypes, intervention.type), true)}
                
                <div class="form-row">
                    ${createFormGroup('執行日期', `
                        <input type="date" class="form-input" id="edit_date" value="${executeDate}">
                    `, true)}
                    ${createFormGroup('執行人員', createSelect('edit_executor', staffList, intervention.executor))}
                </div>
                ${createFormGroup('備註', `
                    <textarea class="form-input" id="edit_notes" rows="3">${intervention.notes || ''}</textarea>
                `)}
            </form>
        `;
        
        openModal('編輯介入記錄', html, [
            { text: '取消', class: 'btn-outline' },
            {
                text: '儲存',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const type = document.getElementById('edit_type').value;
                    const date = document.getElementById('edit_date').value;
                    const executor = document.getElementById('edit_executor').value;
                    const notes = document.getElementById('edit_notes').value;
                    
                    if (!type) {
                        showToast('請選擇介入類型', 'error');
                        return;
                    }
                    
                    try {
                        intervention.type = type;
                        intervention.execute_date = date;
                        intervention.executor = executor;
                        intervention.notes = notes;
                        
                        await DB.update('interventions', intervention);
                        closeModal();
                        showToast('介入記錄已更新');
                        
                        // 重新顯示列表
                        setTimeout(() => Intervention.showList(treatmentId), 100);
                        App.refresh();
                    } catch (e) {
                        showToast(e.message, 'error');
                    }
                }
            }
        ]);
    },
    
    /**
     * 確認刪除介入記錄
     */
    async confirmDelete(interventionId, treatmentId) {
        if (!confirm('確定要刪除此介入記錄嗎？')) return;
        
        try {
            await DB.delete('interventions', interventionId);
            showToast('介入記錄已刪除');
            
            // 重新顯示列表
            closeModal();
            setTimeout(() => Intervention.showList(treatmentId), 100);
            App.refresh();
        } catch (e) {
            showToast(e.message, 'error');
        }
    }
};
