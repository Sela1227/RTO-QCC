/**
 * 彰濱放腫體重監控預防系統 - 病人管理模組
 */

const Patient = {
    /**
     * 取得所有病人（依病歷號排序，排除已刪除）
     */
    async getAll() {
        const patients = await DB.getAll('patients');
        return patients
            .filter(p => !p.deleted)
            .sort((a, b) => a.medical_id.localeCompare(b.medical_id));
    },
    
    /**
     * 依 ID 取得病人
     */
    async getById(id) {
        // 檢查 id 是否有效
        if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
            return null;
        }
        return DB.get('patients', id);
    },
    
    /**
     * 依病歷號取得病人
     */
    async getByMedicalId(medicalId) {
        const padded = padMedicalId(medicalId);
        return DB.getOneByIndex('patients', 'medical_id', padded);
    },
    
    /**
     * 搜尋病人（排除已刪除）
     */
    async search(keyword) {
        if (!keyword) return [];
        
        const all = await this.getAll();
        const kw = keyword.toLowerCase();
        const kwPadded = padMedicalId(keyword);
        
        return all.filter(p => 
            p.medical_id.includes(kw) ||
            p.medical_id.includes(kwPadded) ||
            p.name.toLowerCase().includes(kw)
        );
    },
    
    /**
     * 新增病人
     */
    async create(data) {
        // 病歷號補 0
        data.medical_id = padMedicalId(data.medical_id);
        
        // 檢查病歷號是否已存在
        const existing = await this.getByMedicalId(data.medical_id);
        if (existing) {
            // 返回現有病人資料，讓呼叫端處理
            const error = new Error('病歷號已存在');
            error.existingPatient = existing;
            throw error;
        }
        
        return DB.add('patients', data);
    },
    
    /**
     * 更新病人
     */
    async update(data) {
        return DB.update('patients', data);
    },
    
    /**
     * 刪除病人（軟刪除，連同療程、體重記錄、副作用、介入記錄）
     */
    async delete(patientId) {
        const deletedAt = new Date().toISOString();
        
        // 取得所有療程
        const treatments = await DB.getByIndex('treatments', 'patient_id', patientId);
        
        for (const t of treatments) {
            // 軟刪除體重記錄
            const weights = await DB.getByIndex('weight_records', 'treatment_id', t.id);
            for (const w of weights) {
                w.deleted = true;
                w.deleted_at = deletedAt;
                await DB.update('weight_records', w);
            }
            
            // 軟刪除副作用記錄
            const sideEffects = await DB.getAll('side_effects');
            for (const se of sideEffects.filter(s => s.treatment_id === t.id)) {
                se.deleted = true;
                se.deleted_at = deletedAt;
                await DB.update('side_effects', se);
            }
            
            // 軟刪除介入記錄
            const interventions = await DB.getByIndex('interventions', 'treatment_id', t.id);
            for (const i of interventions) {
                i.deleted = true;
                i.deleted_at = deletedAt;
                await DB.update('interventions', i);
            }
            
            // 軟刪除療程
            t.deleted = true;
            t.deleted_at = deletedAt;
            await DB.update('treatments', t);
        }
        
        // 軟刪除病人
        const patient = await DB.get('patients', patientId);
        if (patient) {
            patient.deleted = true;
            patient.deleted_at = deletedAt;
            return DB.update('patients', patient);
        }
    },
    
    /**
     * 雙重確認刪除病人
     */
    async confirmDelete(patientId, medicalId, name) {
        closeModal();
        
        setTimeout(() => {
            const html = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 24px; margin-bottom: 16px; color: var(--warning);">[!]</div>
                    <p style="margin-bottom: 8px;">確定要刪除此病人嗎？</p>
                    <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin: 16px 0;">
                        <strong>${medicalId}</strong> ${name}
                    </div>
                    <p style="color: var(--danger); font-size: 13px;">
                        此操作將同時刪除所有療程、體重記錄、介入記錄<br>
                        <strong>刪除後無法復原！</strong>
                    </p>
                </div>
            `;
            
            openModal('確認刪除', html, [
                { text: '取消', class: 'btn-outline' },
                {
                    text: '確定刪除',
                    class: 'btn-danger',
                    closeOnClick: false,
                    onClick: () => Patient.confirmDeleteStep2(patientId, medicalId, name)
                }
            ]);
        }, 100);
    },
    
    /**
     * 雙重確認刪除 - 第二步
     */
    async confirmDeleteStep2(patientId, medicalId, name) {
        closeModal();
        
        setTimeout(() => {
            const html = `
                <div style="text-align: center; padding: 16px 0;">
                    <div style="font-size: 24px; margin-bottom: 16px; color: var(--danger);">[X]</div>
                    <p style="margin-bottom: 16px; color: var(--danger); font-weight: 600;">
                        再次確認：真的要刪除嗎？
                    </p>
                    <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
                        <strong>${medicalId}</strong> ${name}
                    </div>
                    <p style="font-size: 13px; color: var(--text-secondary);">
                        請輸入病歷號以確認刪除
                    </p>
                    <input type="text" class="form-input" id="confirm-medical-id" 
                           placeholder="輸入 ${medicalId}" 
                           style="text-align: center; margin-top: 8px;">
                </div>
            `;
            
            openModal('最終確認', html, [
                { text: '取消', class: 'btn-outline' },
                {
                    text: '永久刪除',
                    class: 'btn-danger',
                    closeOnClick: false,
                    onClick: async () => {
                        const input = document.getElementById('confirm-medical-id').value.trim();
                        if (input !== medicalId) {
                            showToast('病歷號不符，取消刪除', 'error');
                            return;
                        }
                        
                        try {
                            await Patient.delete(patientId);
                            closeModal();
                            showToast('病人已刪除');
                            App.refresh();
                        } catch (e) {
                            showToast('刪除失敗: ' + e.message, 'error');
                        }
                    }
                }
            ]);
        }, 100);
    },
    
    /**
     * 取得病人完整資料（包含療程）
     */
    async getWithTreatments(patientId) {
        const patient = await this.getById(patientId);
        if (!patient) return null;
        
        patient.treatments = await Treatment.getByPatient(patientId);
        patient.active_treatment = patient.treatments.find(t => t.status === 'active');
        patient.ongoing_treatment = patient.treatments.find(t => 
            t.status === 'active' || t.status === 'paused'
        );
        
        return patient;
    },
    
    /**
     * 顯示新增/編輯病人對話框
     */
    async showForm(patient = null) {
        const isEdit = !!patient;
        const title = isEdit ? '編輯病人' : '新增病人';
        
        const html = `
            <form id="patient-form">
                <div class="form-row">
                    ${createFormGroup('病歷號', `
                        <input type="text" class="form-input" id="medical_id" 
                               value="${patient?.medical_id || ''}" 
                               ${isEdit ? 'readonly' : ''} 
                               placeholder="輸入病歷號">
                    `, true)}
                    ${createFormGroup('姓名', `
                        <input type="text" class="form-input" id="name" 
                               value="${patient?.name || ''}" 
                               placeholder="輸入姓名">
                    `, true)}
                </div>
                <div class="form-row">
                    ${createFormGroup('性別', `
                        <select class="form-select" id="gender">
                            <option value="">請選擇</option>
                            <option value="M" ${patient?.gender === 'M' ? 'selected' : ''}>男</option>
                            <option value="F" ${patient?.gender === 'F' ? 'selected' : ''}>女</option>
                        </select>
                    `, true)}
                    ${createFormGroup('生日', `
                        <input type="date" class="form-input" id="birth_date" 
                               value="${patient?.birth_date || ''}">
                    `, true)}
                </div>
            </form>
        `;
        
        openModal(title, html, [
            { text: '取消', class: 'btn-outline' },
            { 
                text: isEdit ? '儲存' : '新增', 
                class: 'btn-primary',
                closeOnClick: false,
                onClick: async () => {
                    const valid = validateRequired([
                        { id: 'medical_id', label: '病歷號' },
                        { id: 'name', label: '姓名' },
                        { id: 'gender', label: '性別' },
                        { id: 'birth_date', label: '生日' }
                    ]);
                    if (!valid) return;
                    
                    const data = {
                        medical_id: document.getElementById('medical_id').value,
                        name: document.getElementById('name').value,
                        gender: document.getElementById('gender').value,
                        birth_date: document.getElementById('birth_date').value
                    };
                    
                    try {
                        if (isEdit) {
                            data.id = patient.id;
                            data.created_at = patient.created_at;
                            await Patient.update(data);
                            showToast('病人資料已更新');
                            closeModal();
                            App.refresh();
                        } else {
                            const newPatient = await Patient.create(data);
                            showToast('病人已新增');
                            closeModal();
                            // 新增病人後，詢問是否開療程
                            setTimeout(() => {
                                Patient.askCreateTreatment(newPatient);
                            }, 300);
                        }
                    } catch (e) {
                        // 檢查是否為病歷號重複
                        if (e.existingPatient) {
                            closeModal();
                            setTimeout(() => {
                                Patient.showExistingPatientDialog(e.existingPatient);
                            }, 100);
                        } else {
                            showToast(e.message, 'error');
                        }
                    }
                }
            }
        ]);
    },
    
    /**
     * 顯示已存在病人的對話框
     */
    async showExistingPatientDialog(patient) {
        const patientWithTreatments = await Patient.getWithTreatments(patient.id);
        const age = calculateAge(patient.birth_date);
        const hasOngoing = !!patientWithTreatments.ongoing_treatment;
        
        let statusText = '';
        if (hasOngoing) {
            const status = patientWithTreatments.ongoing_treatment.status === 'active' ? '治療中' : '暫停中';
            statusText = `<span class="tag tag-blue">${status}</span>`;
        } else if (patientWithTreatments.treatments.length > 0) {
            statusText = '<span class="tag tag-green">已結案</span>';
        } else {
            statusText = '<span class="tag tag-gray">無療程</span>';
        }
        
        const html = `
            <div style="text-align: center; padding: 16px 0;">
                <div style="font-size: 24px; margin-bottom: 16px; color: var(--warning);">[!]</div>
                <p style="margin-bottom: 16px;">此病歷號已有資料：</p>
                <div style="background: var(--bg); padding: 16px; border-radius: 8px; text-align: left;">
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 8px;">
                        ${patient.medical_id} ${patient.name}
                    </div>
                    <div style="color: var(--text-secondary);">
                        ${formatGender(patient.gender)} · ${age ? age + '歲' : '-'}
                    </div>
                    <div style="margin-top: 8px;">
                        ${statusText}
                        <span style="color: var(--text-hint); margin-left: 8px;">
                            ${patientWithTreatments.treatments.length} 筆療程
                        </span>
                    </div>
                </div>
            </div>
        `;
        
        const buttons = [
            { text: '關閉', class: 'btn-outline' },
            { 
                text: '查看詳情', 
                class: 'btn-outline',
                closeOnClick: false,
                onClick: () => {
                    closeModal();
                    setTimeout(() => showPatientDetail(patient.id), 100);
                }
            }
        ];
        
        // 如果沒有進行中療程，可以開新療程
        if (!hasOngoing) {
            buttons.push({
                text: '開新療程',
                class: 'btn-primary',
                closeOnClick: false,
                onClick: () => {
                    closeModal();
                    setTimeout(() => Treatment.showForm(patient), 100);
                }
            });
        }
        
        openModal('病歷號已存在', html, buttons);
    },
    
    /**
     * 詢問是否建立療程
     */
    async askCreateTreatment(patient) {
        openModal('建立療程', `
            <p style="margin-bottom: 16px;">
                已新增病人 <strong>${patient.medical_id} ${patient.name}</strong>
            </p>
            <p>是否要立即建立療程？</p>
        `, [
            { 
                text: '稍後再說', 
                class: 'btn-outline',
                onClick: () => App.refresh()
            },
            { 
                text: '建立療程', 
                class: 'btn-primary',
                onClick: () => Treatment.showForm(patient)
            }
        ]);
    }
};

/**
 * 渲染病人列表頁面
 */
async function renderPatientList(filters = {}) {
    const container = document.getElementById('patient-list');
    let patients = await Patient.getAll();
    
    // 初始化癌別篩選下拉選單
    const cancerSelect = document.getElementById('patient-filter-cancer');
    if (cancerSelect && cancerSelect.options.length <= 1) {
        const cancerTypes = await Settings.get('cancer_types', []);
        cancerTypes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.code;
            opt.textContent = c.label;
            cancerSelect.appendChild(opt);
        });
    }
    
    // 取得篩選條件
    const statusFilter = filters.status || document.getElementById('patient-filter-status')?.value || 'all';
    const cancerFilter = filters.cancer || document.getElementById('patient-filter-cancer')?.value || 'all';
    const keyword = filters.keyword || '';
    
    // 載入每個病人的療程資料
    const patientsWithTreatments = [];
    for (const p of patients) {
        const treatments = await Treatment.getByPatient(p.id);
        const activeTreatment = treatments.find(t => t.status === 'active');
        const pausedTreatment = treatments.find(t => t.status === 'paused');
        const cancerTypes = treatments.map(t => t.cancer_type);
        
        patientsWithTreatments.push({
            ...p,
            treatments,
            activeTreatment,
            pausedTreatment,
            cancerTypes,
            hasActive: !!activeTreatment,
            hasPaused: !!pausedTreatment
        });
    }
    
    // 套用篩選
    let filtered = patientsWithTreatments;
    
    // 狀態篩選
    if (statusFilter === 'has_active') {
        filtered = filtered.filter(p => p.hasActive);
    } else if (statusFilter === 'has_paused') {
        filtered = filtered.filter(p => p.hasPaused);
    } else if (statusFilter === 'no_active') {
        filtered = filtered.filter(p => !p.hasActive && !p.hasPaused);
    }
    
    // 癌別篩選
    if (cancerFilter !== 'all') {
        filtered = filtered.filter(p => p.cancerTypes.includes(cancerFilter));
    }
    
    // 關鍵字搜尋
    if (keyword) {
        const kw = keyword.toLowerCase();
        const kwPadded = padMedicalId(keyword);
        filtered = filtered.filter(p => 
            p.medical_id.includes(kw) ||
            p.medical_id.includes(kwPadded) ||
            p.name.toLowerCase().includes(kw)
        );
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 60px;">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <p>${patients.length > 0 ? '沒有符合條件的病人' : '尚無病人資料'}</p>
                ${patients.length === 0 ? '<button class="btn btn-primary" onclick="Patient.showForm()">新增第一位病人</button>' : ''}
            </div>
        `;
        return;
    }
    
    let html = `
        <div style="margin-bottom: 8px; color: var(--text-secondary); font-size: 13px;">
            共 ${filtered.length} 位病人
        </div>
        <table class="patient-table">
            <thead>
                <tr>
                    <th>病歷號</th>
                    <th>姓名</th>
                    <th>性別</th>
                    <th>年齡</th>
                    <th>療程數</th>
                    <th>目前狀態</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    for (const p of filtered) {
        const age = calculateAge(p.birth_date);
        
        let statusHtml = '<span class="tag tag-gray">無療程</span>';
        if (p.hasActive) {
            statusHtml = '<span class="tag tag-blue">治療中</span>';
        } else if (p.hasPaused) {
            statusHtml = '<span class="tag tag-amber">暫停中</span>';
        } else if (p.treatments.length > 0) {
            statusHtml = '<span class="tag tag-green">已結案</span>';
        }
        
        html += `
            <tr>
                <td><strong>${p.medical_id}</strong></td>
                <td>${p.name}</td>
                <td>${formatGender(p.gender)}</td>
                <td>${age ? age + '歲' : '-'}</td>
                <td>${p.treatments.length}</td>
                <td>${statusHtml}</td>
                <td>
                    <button class="btn btn-outline" style="padding: 4px 8px; font-size: 12px;" 
                            onclick="showPatientDetail(${p.id})">
                        查看
                    </button>
                </td>
            </tr>
        `;
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * 顯示病人詳情對話框
 */
async function showPatientDetail(patientId) {
    const patient = await Patient.getWithTreatments(patientId);
    if (!patient) {
        showToast('找不到病人', 'error');
        return;
    }
    
    const age = calculateAge(patient.birth_date);
    
    let treatmentsHtml = '';
    if (patient.treatments.length > 0) {
        treatmentsHtml = patient.treatments.map(t => `
            <div class="detail-row" style="cursor: pointer;" onclick="showTreatmentDetail(${t.id})">
                <span>
                    ${t.cancer_type_label || t.cancer_type}
                    <span style="color: var(--text-hint); font-size: 12px; margin-left: 8px;">
                        ${formatDate(t.treatment_start)}
                    </span>
                </span>
                <span class="tag ${getStatusTagClass(t.status)}">${formatTreatmentStatus(t.status)}</span>
            </div>
        `).join('');
    } else {
        treatmentsHtml = '<p style="color: var(--text-hint);">尚無療程</p>';
    }
    
    const html = `
        <div class="detail-header">
            <div>
                <div class="detail-title">${patient.medical_id} ${patient.name}</div>
                <div class="detail-subtitle">${formatGender(patient.gender)} · ${age ? age + '歲' : '-'}</div>
            </div>
        </div>
        <div class="detail-section">
            <div class="detail-section-title">療程記錄（點擊查看詳情）</div>
            ${treatmentsHtml}
        </div>
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
            <button class="btn btn-outline" style="color: var(--danger); border-color: var(--danger);" 
                    onclick="Patient.confirmDelete(${patient.id}, '${patient.medical_id}', '${patient.name}')">
                刪除病人
            </button>
        </div>
    `;
    
    const buttons = [
        { text: '關閉', class: 'btn-outline' },
        { 
            text: '編輯病人', 
            class: 'btn-outline', 
            closeOnClick: false,
            onClick: () => {
                closeModal();
                setTimeout(() => Patient.showForm(patient), 100);
            }
        }
    ];
    
    // 如果沒有進行中療程，可以開新療程
    if (!patient.ongoing_treatment) {
        buttons.push({
            text: '開新療程',
            class: 'btn-primary',
            closeOnClick: false,
            onClick: () => {
                closeModal();
                setTimeout(() => Treatment.showForm(patient), 100);
            }
        });
    }
    
    openModal('病人詳情', html, buttons);
}

/**
 * 顯示療程詳情對話框（可編輯）
 */
async function showTreatmentDetail(treatmentId) {
    const treatment = await Treatment.getById(treatmentId);
    if (!treatment) {
        showToast('找不到療程', 'error');
        return;
    }
    
    const patient = await Patient.getById(treatment.patient_id);
    const weights = await Weight.getByTreatment(treatmentId);
    const interventions = await Intervention.getByTreatment(treatmentId);
    
    // 計算變化率
    let changeRate = null;
    if (weights.length > 0 && treatment.baseline_weight) {
        changeRate = calculateWeightChangeRate(weights[0].weight, treatment.baseline_weight);
    }
    
    const html = `
        <div class="detail-header">
            <div>
                <div class="detail-title">${patient.medical_id} ${patient.name}</div>
                <div class="detail-subtitle">
                    ${treatment.cancer_type_label || treatment.cancer_type}
                    <span class="tag ${getStatusTagClass(treatment.status)}" style="margin-left: 8px;">
                        ${formatTreatmentStatus(treatment.status)}
                    </span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <div class="detail-section-title">療程資訊</div>
            <div class="detail-row">
                <span>治療目的</span>
                <span>${treatment.treatment_intent_label || treatment.treatment_intent || '-'}</span>
            </div>
            <div class="detail-row">
                <span>開始日期</span>
                <span>${formatDate(treatment.treatment_start)}</span>
            </div>
            <div class="detail-row">
                <span>基準體重</span>
                <span>${treatment.baseline_weight ? treatment.baseline_weight + ' kg' : '-'}</span>
            </div>
            <div class="detail-row">
                <span>目前體重</span>
                <span>${weights.length > 0 ? weights[0].weight + ' kg' : '-'}</span>
            </div>
            <div class="detail-row">
                <span>變化率</span>
                <span class="${getRateClass(changeRate)}">${formatChangeRate(changeRate)}</span>
            </div>
            <div class="detail-row">
                <span>體重記錄數</span>
                <span>${weights.length}</span>
            </div>
            <div class="detail-row">
                <span>介入記錄數</span>
                <span>${interventions.length}</span>
            </div>
        </div>
    `;
    
    const buttons = [
        { text: '關閉', class: 'btn-outline' },
        { 
            text: '編輯療程', 
            class: 'btn-outline', 
            onClick: () => Treatment.showForm(patient, treatment)
        }
    ];
    
    // 根據狀態顯示不同操作
    if (treatment.status === 'active') {
        buttons.push({
            text: '記錄體重',
            class: 'btn-primary',
            onClick: () => Weight.showForm(treatmentId)
        });
    } else if (treatment.status === 'paused') {
        buttons.push({
            text: '恢復療程',
            class: 'btn-primary',
            onClick: async () => {
                await Treatment.resume(treatmentId);
                showToast('療程已恢復');
                closeModal();
                App.refresh();
            }
        });
    }
    
    openModal('療程詳情', html, buttons);
}
