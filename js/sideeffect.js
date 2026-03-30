/**
 * 副作用評估模組
 * 處理病人回報的副作用評估資料
 * 嚴重程度參考 CTCAE v5.0 (Common Terminology Criteria for Adverse Events)
 */

const SideEffect = {
    // 症狀定義（疼痛使用 0-10 量表，其他使用 0-3）
    SYMPTOMS: {
        'N': { code: 'N', name: '噁心嘔吐', icon: '🤢', scale: 3 },
        'F': { code: 'F', name: '疲勞', icon: '😴', scale: 3 },
        'O': { code: 'O', name: '口腔黏膜炎', icon: '👄', scale: 3 },
        'S': { code: 'S', name: '皮膚反應', icon: '🔴', scale: 3 },
        'W': { code: 'W', name: '吞嚥困難', icon: '😣', scale: 3 },
        'A': { code: 'A', name: '食慾下降', icon: '🍽️', scale: 3 },
        'D': { code: 'D', name: '腹瀉', icon: '💩', scale: 3 },
        'P': { code: 'P', name: '疼痛', icon: '😖', scale: 10 }  // 0-10 量表
    },
    
    // 嚴重程度定義（CTCAE Grade 0-3）
    SEVERITY: {
        0: { level: 0, name: '無', class: 'normal', desc: '無症狀' },
        1: { level: 1, name: '輕微', class: 'mild', desc: '症狀輕微，不影響日常活動' },
        2: { level: 2, name: '中度', class: 'moderate', desc: '影響日常活動，但仍可自理' },
        3: { level: 3, name: '嚴重', class: 'severe', desc: '嚴重影響日常，需要協助或醫療處置' }
    },
    
    // 各症狀的 CTCAE 詳細定義
    CTCAE_DEFINITIONS: {
        'N': { // 噁心嘔吐
            1: '食慾下降但不影響進食',
            2: '進食量明顯減少，但無需靜脈輸液',
            3: '無法經口進食，需要靜脈輸液或住院'
        },
        'F': { // 疲勞
            1: '比平常稍感疲倦，仍可正常活動',
            2: '影響部分日常活動，需要休息',
            3: '影響大部分活動，生活起居需協助'
        },
        'O': { // 口腔黏膜炎
            1: '黏膜輕微紅腫，不影響進食',
            2: '疼痛影響進食，需要飲食調整',
            3: '嚴重疼痛，無法經口進食'
        },
        'S': { // 皮膚反應
            1: '輕微發紅或乾燥',
            2: '明顯發紅、脫皮或濕性皮膚炎',
            3: '嚴重皮膚反應，有潰瘍或出血'
        },
        'W': { // 吞嚥困難
            1: '吞嚥時稍有不適，不影響進食',
            2: '需改吃軟質或流質飲食',
            3: '無法吞嚥，需要管灌餵食'
        },
        'A': { // 食慾下降
            1: '食慾稍減，進食量略少',
            2: '進食量明顯減少，但無需營養支持',
            3: '需要營養補充或管灌餵食'
        },
        'D': { // 腹瀉
            1: '每日排便增加 1-3 次',
            2: '每日排便增加 4-6 次，影響日常',
            3: '每日排便增加 7 次以上或需要住院'
        }
    },
    
    /**
     * 取得疼痛等級 class
     */
    getPainClass(level) {
        if (level === 0) return 'normal';
        if (level <= 3) return 'mild';
        if (level <= 6) return 'moderate';
        return 'severe';
    },
    
    /**
     * 取得疼痛等級名稱
     */
    getPainName(level) {
        if (level === 0) return '無';
        if (level <= 3) return '輕微';
        if (level <= 6) return '中等';
        return '嚴重';
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
     * 取得療程的所有副作用評估（排除已刪除）
     */
    async getByTreatment(treatmentId) {
        const all = await DB.getAll('side_effects');
        return all
            .filter(r => r.treatment_id === treatmentId && !r.deleted)
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
     * 刪除評估記錄（軟刪除）
     */
    async delete(id) {
        const record = await DB.getById('side_effects', id);
        if (record) {
            record.deleted = true;
            record.deleted_at = new Date().toISOString();
            return DB.update('side_effects', record);
        }
    },
    
    /**
     * 格式化症狀顯示
     */
    formatSymptoms(symptoms) {
        if (!symptoms || symptoms.length === 0) return '無症狀';
        
        return symptoms
            .filter(s => s.level > 0)
            .map(s => {
                const symptom = this.SYMPTOMS[s.code] || { name: s.code, icon: '❓', scale: 3 };
                // 疼痛使用 0-10，其他使用 0-3
                if (s.code === 'P') {
                    return `${symptom.icon} ${symptom.name}(${s.level}/10)`;
                } else {
                    const severity = this.SEVERITY[s.level] || { name: s.level };
                    return `${symptom.icon} ${symptom.name}(${severity.name})`;
                }
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
                const symptom = this.SYMPTOMS[s.code] || { name: s.code, icon: '❓', scale: 3 };
                // 疼痛使用 0-10 量表
                if (s.code === 'P') {
                    const painClass = this.getPainClass(s.level);
                    return `<span class="side-effect-tag ${painClass}">${symptom.icon} ${s.level}/10</span>`;
                } else {
                    const severity = this.SEVERITY[s.level] || { name: s.level, class: 'unknown' };
                    return `<span class="side-effect-tag ${severity.class}">${symptom.icon} ${symptom.name}</span>`;
                }
            })
            .join('');
    },
    
    /**
     * 取得最嚴重的症狀等級（標準化為 0-3）
     */
    getMaxSeverity(symptoms) {
        if (!symptoms || symptoms.length === 0) return 0;
        
        let maxLevel = 0;
        symptoms.forEach(s => {
            if (s.code === 'P') {
                // 疼痛 0-10 轉換為 0-3
                const normalized = s.level === 0 ? 0 : (s.level <= 3 ? 1 : (s.level <= 6 ? 2 : 3));
                maxLevel = Math.max(maxLevel, normalized);
            } else {
                maxLevel = Math.max(maxLevel, s.level || 0);
            }
        });
        return maxLevel;
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
                                <button class="btn-icon" onclick="closeModal(); setTimeout(() => SideEffect.showForm(${treatmentId}, ${r.id}), 50)" title="編輯">
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
                <div style="font-size: 12px; color: var(--text-hint); margin-bottom: 8px;">嚴重程度說明（參考 CTCAE v5.0）</div>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px;">
                    <span><span class="side-effect-tag normal">無</span> 無症狀</span>
                    <span><span class="side-effect-tag mild">輕微</span> 不影響日常</span>
                    <span><span class="side-effect-tag moderate">中度</span> 影響日常但可自理</span>
                    <span><span class="side-effect-tag severe">嚴重</span> 需要協助或醫療處置</span>
                </div>
            </div>
        `;
        
        // 保存 treatmentId 供按鈕使用
        const tid = treatmentId;
        
        openModal('副作用評估記錄', html, [
            { text: '關閉', class: 'btn-outline' },
            { 
                text: '新增評估', 
                class: 'btn-primary',
                closeOnClick: false,
                onClick: () => {
                    closeModal();
                    setTimeout(() => SideEffect.showForm(tid), 50);
                }
            }
        ]);
    },
    
    /**
     * 顯示副作用評估表單
     */
    async showForm(treatmentId, recordId = null) {
        try {
            if (!treatmentId) {
                showToast('無效的療程 ID', 'error');
                return;
            }
            
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
                const currentLevel = symptomLevels[code] || 0;
                
                // 疼痛使用 0-10 量表
                if (code === 'P') {
                    return `
                        <div class="symptom-form-item symptom-pain">
                            <div class="symptom-form-label">
                                <span>${info.icon || '😖'}</span>
                                <span>${info.name || '疼痛'}</span>
                            </div>
                            <div class="pain-scale">
                                <input type="range" 
                                       id="pain-slider" 
                                       min="0" max="10" 
                                       value="${currentLevel}"
                                       class="pain-slider"
                                       oninput="document.getElementById('pain-value').textContent = this.value">
                                <div class="pain-labels">
                                    <span>0</span>
                                    <span id="pain-value" class="pain-current">${currentLevel}</span>
                                    <span>10</span>
                                </div>
                            </div>
                        </div>
                    `;
                }
                
                // 其他症狀使用 0-3 量表
                const severityButtons = [0, 1, 2, 3].map(level => {
                    const severityInfo = this.SEVERITY[level] || { name: String(level) };
                    // 取得該症狀的 CTCAE 定義
                    const ctcaeDef = this.CTCAE_DEFINITIONS[code];
                    const ctcaeDesc = level === 0 ? '無症狀' : (ctcaeDef && ctcaeDef[level]) || severityInfo.desc || '';
                    const titleText = `${severityInfo.name}：${ctcaeDesc}`;
                    return `
                        <button type="button" 
                                class="severity-select-btn ${currentLevel === level ? 'active' : ''}" 
                                data-code="${code}" 
                                data-level="${level}"
                                title="${titleText}">
                            ${level === 0 ? '無' : level}
                        </button>
                    `;
                }).join('');
                
                return `
                    <div class="symptom-form-item">
                        <div class="symptom-form-label">
                            <span>${info.icon || '❓'}</span>
                            <span>${info.name || code}</span>
                        </div>
                        <div class="symptom-form-buttons">
                            ${severityButtons}
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
                            <span style="font-size: 11px; color: var(--text-hint);">0無 / 1輕 / 2中 / 3重（長按查看說明）</span>
                        </div>
                        ${symptomsHtml}
                    </div>
                </form>
            `;
            
            // 保存 treatmentId 供後續使用
            const tid = treatmentId;
            const rid = recordId;
            
            openModal(recordId ? '編輯副作用評估' : '新增副作用評估', html, [
                { text: '取消', class: 'btn-outline' },
                { 
                    text: '儲存', 
                    class: 'btn-primary',
                    closeOnClick: false,
                    onClick: async () => {
                        await SideEffect.saveForm(tid, rid);
                    }
                }
            ]);
            
            // 綁定按鈕事件
            setTimeout(() => {
                document.querySelectorAll('.severity-select-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        e.preventDefault();
                        const code = btn.dataset.code;
                        // 移除同組其他按鈕的 active
                        document.querySelectorAll(`.severity-select-btn[data-code="${code}"]`).forEach(b => {
                            b.classList.remove('active');
                        });
                        btn.classList.add('active');
                    };
                });
            }, 100);
        } catch (e) {
            console.error('顯示副作用表單失敗:', e);
            showToast('開啟表單失敗: ' + e.message, 'error');
        }
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
        
        // 收集 0-3 量表症狀
        document.querySelectorAll('.severity-select-btn.active').forEach(btn => {
            const code = btn.dataset.code;
            const level = parseInt(btn.dataset.level);
            symptoms.push({ code, level });
        });
        
        // 收集疼痛 0-10 量表
        const painSlider = document.getElementById('pain-slider');
        if (painSlider) {
            symptoms.push({ code: 'P', level: parseInt(painSlider.value) });
        }
        
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
