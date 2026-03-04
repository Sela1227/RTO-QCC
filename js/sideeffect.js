/**
 * 副作用評估模組
 * 處理病人回報的副作用評估資料
 */

const SideEffect = {
    // 症狀定義
    SYMPTOMS: {
        'N': { code: 'N', name: '噁心嘔吐', icon: '🤢' },
        'F': { code: 'F', name: '疲勞', icon: '😴' },
        'O': { code: 'O', name: '口腔黏膜炎', icon: '👄' },
        'S': { code: 'S', name: '皮膚反應', icon: '🔴' },
        'W': { code: 'W', name: '吞嚥困難', icon: '😣' },
        'A': { code: 'A', name: '食慾下降', icon: '🍽️' },
        'D': { code: 'D', name: '腹瀉', icon: '💩' },
        'P': { code: 'P', name: '疼痛', icon: '😖' }
    },
    
    // 嚴重程度定義
    SEVERITY: {
        0: { level: 0, name: '無', class: 'normal' },
        1: { level: 1, name: '輕微', class: 'mild' },
        2: { level: 2, name: '中等', class: 'moderate' },
        3: { level: 3, name: '嚴重', class: 'severe' }
    },
    
    /**
     * 新增副作用評估記錄
     */
    async create(treatmentId, assessDate, symptoms) {
        const record = {
            treatment_id: treatmentId,
            assess_date: assessDate,
            symptoms: symptoms, // [{code, level}, ...]
            created_at: new Date().toISOString()
        };
        
        return DB.add('side_effects', record);
    },
    
    /**
     * 取得療程的所有副作用評估
     */
    async getByTreatment(treatmentId) {
        const all = await DB.getAll('side_effects');
        return all
            .filter(r => r.treatment_id === treatmentId)
            .sort((a, b) => new Date(b.assess_date) - new Date(a.assess_date)); // 倒序
    },
    
    /**
     * 取得特定日期的評估
     */
    async getByDate(treatmentId, assessDate) {
        const records = await this.getByTreatment(treatmentId);
        return records.find(r => r.assess_date === assessDate);
    },
    
    /**
     * 更新評估記錄
     */
    async update(id, data) {
        const record = await DB.getById('side_effects', id);
        if (!record) throw new Error('找不到記錄');
        
        Object.assign(record, data);
        record.updated_at = new Date().toISOString();
        
        return DB.update('side_effects', record);
    },
    
    /**
     * 刪除評估記錄
     */
    async delete(id) {
        return DB.delete('side_effects', id);
    },
    
    /**
     * 格式化症狀顯示
     */
    formatSymptoms(symptoms) {
        if (!symptoms || symptoms.length === 0) return '無症狀';
        
        return symptoms
            .filter(s => s.level > 0)
            .map(s => {
                const symptom = this.SYMPTOMS[s.code] || { name: s.code, icon: '❓' };
                const severity = this.SEVERITY[s.level] || { name: s.level };
                return `${symptom.icon} ${symptom.name}(${severity.name})`;
            })
            .join('、');
    },
    
    /**
     * 格式化症狀標籤 HTML
     */
    formatSymptomTags(symptoms) {
        if (!symptoms || symptoms.length === 0) {
            return '<span class="side-effect-tag normal">無症狀</span>';
        }
        
        return symptoms
            .filter(s => s.level > 0)
            .map(s => {
                const symptom = this.SYMPTOMS[s.code] || { name: s.code, icon: '❓' };
                const severity = this.SEVERITY[s.level] || { name: s.level, class: 'unknown' };
                return `<span class="side-effect-tag ${severity.class}">${symptom.icon} ${symptom.name}</span>`;
            })
            .join('');
    },
    
    /**
     * 取得最嚴重的症狀等級
     */
    getMaxSeverity(symptoms) {
        if (!symptoms || symptoms.length === 0) return 0;
        return Math.max(...symptoms.map(s => s.level || 0));
    },
    
    /**
     * 檢查是否有需要關注的症狀（等級 >= 2）
     */
    hasWarning(symptoms) {
        return this.getMaxSeverity(symptoms) >= 2;
    },
    
    /**
     * 檢查是否有嚴重症狀（等級 >= 3）
     */
    hasSevere(symptoms) {
        return this.getMaxSeverity(symptoms) >= 3;
    },
    
    /**
     * 顯示副作用評估列表
     */
    async showList(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const records = await this.getByTreatment(treatmentId);
        
        let listHtml = '';
        if (records.length === 0) {
            listHtml = '<p style="color: var(--text-hint); text-align: center; padding: 24px 0;">尚無副作用評估記錄</p>';
        } else {
            listHtml = records.map(r => {
                const maxSeverity = this.getMaxSeverity(r.symptoms);
                const severityClass = maxSeverity >= 3 ? 'severe' : (maxSeverity >= 2 ? 'moderate' : '');
                
                return `
                    <div class="side-effect-record ${severityClass}">
                        <div class="side-effect-record-header">
                            <span class="side-effect-date">${formatDate(r.assess_date)}</span>
                            <div class="side-effect-actions">
                                <button class="btn-icon" onclick="SideEffect.showForm(${treatmentId}, ${r.id})" title="編輯">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="btn-icon" onclick="SideEffect.confirmDelete(${r.id}, ${treatmentId})" title="刪除">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="side-effect-symptoms">
                            ${this.formatSymptomTags(r.symptoms)}
                        </div>
                    </div>
                `;
            }).join('');
        }
        
        const html = `
            <div style="margin-bottom: 16px;">
                <strong>${patient.medical_id}</strong> ${patient.name}
            </div>
            <div class="side-effect-list">
                ${listHtml}
            </div>
            <div class="severity-legend" style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
                <div style="font-size: 12px; color: var(--text-hint); margin-bottom: 8px;">嚴重程度說明</div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px;">
                    <span><span class="side-effect-tag normal">無</span></span>
                    <span><span class="side-effect-tag mild">輕微</span></span>
                    <span><span class="side-effect-tag moderate">中等</span></span>
                    <span><span class="side-effect-tag severe">嚴重</span></span>
                </div>
            </div>
        `;
        
        openModal('副作用評估記錄', html, [
            { text: '關閉', class: 'btn-outline' },
            { 
                text: '新增評估', 
                class: 'btn-primary',
                onClick: () => this.showForm(treatmentId)
            }
        ]);
    },
    
    /**
     * 顯示副作用評估表單
     */
    async showForm(treatmentId, recordId = null) {
        let existingRecord = null;
        let assessDate = new Date().toISOString().split('T')[0];
        let symptomLevels = {};
        
        // 初始化所有症狀為 0
        Object.keys(this.SYMPTOMS).forEach(code => {
            symptomLevels[code] = 0;
        });
        
        // 如果是編輯，載入現有資料
        if (recordId) {
            existingRecord = await DB.getById('side_effects', recordId);
            if (existingRecord) {
                assessDate = existingRecord.assess_date;
                existingRecord.symptoms.forEach(s => {
                    symptomLevels[s.code] = s.level;
                });
            }
        }
        
        const symptomsHtml = Object.entries(this.SYMPTOMS).map(([code, info]) => {
            const currentLevel = symptomLevels[code];
            return `
                <div class="symptom-form-item">
                    <div class="symptom-form-label">
                        <span>${info.icon}</span>
                        <span>${info.name}</span>
                    </div>
                    <div class="symptom-form-buttons">
                        ${[0, 1, 2, 3].map(level => `
                            <button type="button" 
                                    class="severity-select-btn ${currentLevel === level ? 'active' : ''}" 
                                    data-code="${code}" 
                                    data-level="${level}"
                                    title="${this.SEVERITY[level].name}">
                                ${level === 0 ? '無' : level}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
        
        const html = `
            <form id="side-effect-form">
                <div class="form-group">
                    <label>評估日期</label>
                    <input type="date" id="se-assess-date" value="${assessDate}" required>
                </div>
                
                <div class="symptom-form-section">
                    <div class="symptom-form-header">
                        <span>症狀項目</span>
                        <span style="font-size: 11px; color: var(--text-hint);">無 / 輕 / 中 / 重</span>
                    </div>
                    ${symptomsHtml}
                </div>
            </form>
        `;
        
        openModal(recordId ? '編輯副作用評估' : '新增副作用評估', html, [
            { text: '取消', class: 'btn-outline' },
            { 
                text: '儲存', 
                class: 'btn-primary',
                onClick: () => this.saveForm(treatmentId, recordId)
            }
        ]);
        
        // 綁定按鈕事件
        setTimeout(() => {
            document.querySelectorAll('.severity-select-btn').forEach(btn => {
                btn.onclick = () => {
                    const code = btn.dataset.code;
                    // 移除同組其他按鈕的 active
                    document.querySelectorAll(`.severity-select-btn[data-code="${code}"]`).forEach(b => {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                };
            });
        }, 100);
    },
    
    /**
     * 儲存副作用評估表單
     */
    async saveForm(treatmentId, recordId) {
        const assessDate = document.getElementById('se-assess-date').value;
        
        if (!assessDate) {
            showToast('請選擇評估日期', 'error');
            return;
        }
        
        // 收集症狀資料
        const symptoms = [];
        document.querySelectorAll('.severity-select-btn.active').forEach(btn => {
            const code = btn.dataset.code;
            const level = parseInt(btn.dataset.level);
            symptoms.push({ code, level });
        });
        
        try {
            if (recordId) {
                // 更新現有記錄
                await this.update(recordId, {
                    assess_date: assessDate,
                    symptoms: symptoms
                });
                showToast('評估已更新', 'success');
            } else {
                // 檢查日期是否重複
                const existing = await this.getByDate(treatmentId, assessDate);
                if (existing) {
                    showToast('該日期已有評估記錄，請選擇其他日期或編輯現有記錄', 'error');
                    return;
                }
                
                // 新增記錄
                await this.create(treatmentId, assessDate, symptoms);
                showToast('評估已新增', 'success');
            }
            
            closeModal();
            this.showList(treatmentId);
            
        } catch (e) {
            console.error('儲存失敗', e);
            showToast('儲存失敗: ' + e.message, 'error');
        }
    },
    
    /**
     * 確認刪除
     */
    confirmDelete(recordId, treatmentId) {
        confirmDialog('確定要刪除此評估記錄嗎？', async () => {
            await this.delete(recordId);
            showToast('記錄已刪除', 'success');
            this.showList(treatmentId);
        });
    }
};
