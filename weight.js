/**
 * 滿意度調查模組
 * 用於收集療程結束後的病人滿意度回饋
 */

const Satisfaction = {
    /**
     * 問卷題目定義
     */
    QUESTIONS: [
        { id: 'q1', text: '對放射腫瘤科的整體服務滿意嗎？', label: '科部服務' },
        { id: 'q2', text: '營養師的協助對您有幫助嗎？', label: '營養師協助', optional: true },
        { id: 'q3', text: '體重追蹤 APP 操作容易嗎？', label: 'APP 操作' },
        { id: 'q4', text: '治療前的說明讓您了解療程嗎？', label: '療程說明' },
        { id: 'q5', text: '願意推薦這個服務給其他病友嗎？', label: '推薦意願' }
    ],
    
    /**
     * 評分標籤
     */
    RATING_LABELS: ['非常不滿意', '不太滿意', '普通', '滿意', '非常滿意'],
    
    /**
     * 取得指定療程的滿意度
     */
    async getByTreatment(treatmentId) {
        const all = await DB.getAll('satisfaction');
        return all.find(s => s.treatment_id === treatmentId && !s.deleted);
    },
    
    /**
     * 儲存滿意度
     */
    async save(data) {
        if (data.id) {
            return await DB.update('satisfaction', data);
        } else {
            data.created_at = new Date().toISOString();
            return await DB.add('satisfaction', data);
        }
    },
    
    /**
     * 取得所有滿意度（排除已刪除）
     */
    async getAll() {
        const all = await DB.getAll('satisfaction');
        return all.filter(s => !s.deleted);
    },
    
    /**
     * 顯示滿意度填寫表單
     */
    async showForm(treatmentId) {
        const treatment = await Treatment.getById(treatmentId);
        const patient = await Patient.getById(treatment.patient_id);
        const existing = await this.getByTreatment(treatmentId);
        
        const questionsHtml = this.QUESTIONS.map((q, index) => {
            const existingValue = existing?.[q.id] ?? null;
            
            const buttons = [1, 2, 3, 4, 5].map(level => {
                const active = existingValue === level ? 'active' : '';
                return `
                    <label class="rating-option ${active}" data-question="${q.id}" data-value="${level}">
                        <span class="rating-number">${level}</span>
                        <span class="rating-label">${this.RATING_LABELS[level-1]}</span>
                    </label>
                `;
            }).join('');
            
            // 營養師問題加上「未使用」選項
            const naOption = q.optional ? `
                <label class="rating-option na-option ${existingValue === 0 ? 'active' : ''}" 
                       data-question="${q.id}" data-value="0">
                    <span class="rating-number">-</span>
                    <span class="rating-label">未使用</span>
                </label>
            ` : '';
            
            return `
                <div class="satisfaction-question">
                    <div class="question-number">${index + 1}</div>
                    <div class="question-content">
                        <div class="question-text">${q.text}</div>
                        <div class="rating-options">
                            ${buttons}
                            ${naOption}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        const html = `
            <div class="satisfaction-form">
                <div class="satisfaction-header">
                    <div class="patient-info">
                        <strong>${patient.medical_id}</strong> ${patient.name}
                    </div>
                    <div class="treatment-info">
                        ${treatment.cancer_type_label} | ${formatDate(treatment.treatment_start)}
                    </div>
                </div>
                
                <div class="satisfaction-intro">
                    請依您的實際感受評分，1 分最低、5 分最高
                </div>
                
                ${questionsHtml}
                
                <div class="satisfaction-feedback">
                    <div class="feedback-label">其他建議（選填）</div>
                    <textarea id="satisfaction-feedback" placeholder="請輸入您的建議..." rows="3">${existing?.feedback || ''}</textarea>
                </div>
            </div>
            
            <style>
                .satisfaction-form { max-height: 65vh; overflow-y: auto; }
                .satisfaction-header { 
                    background: var(--bg); 
                    padding: 12px 16px; 
                    border-radius: 8px; 
                    margin-bottom: 16px;
                    text-align: center;
                }
                .patient-info { font-size: 15px; margin-bottom: 4px; }
                .treatment-info { font-size: 12px; color: var(--text-secondary); }
                .satisfaction-intro {
                    text-align: center;
                    font-size: 13px;
                    color: var(--text-secondary);
                    margin-bottom: 20px;
                    padding-bottom: 16px;
                    border-bottom: 1px solid var(--border);
                }
                .satisfaction-question { 
                    display: flex; 
                    gap: 12px; 
                    margin-bottom: 20px;
                    align-items: flex-start;
                }
                .question-number {
                    width: 24px;
                    height: 24px;
                    background: var(--primary);
                    color: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    font-weight: 600;
                    flex-shrink: 0;
                }
                .question-content { flex: 1; }
                .question-text { 
                    font-size: 14px; 
                    font-weight: 500; 
                    margin-bottom: 10px;
                    color: var(--text);
                }
                .rating-options { 
                    display: flex; 
                    gap: 6px; 
                    flex-wrap: wrap;
                }
                .rating-option {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 8px 10px;
                    border: 2px solid var(--border);
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                    min-width: 52px;
                }
                .rating-option:hover { border-color: var(--primary); }
                .rating-option.active { 
                    border-color: var(--primary); 
                    background: rgba(91, 143, 185, 0.1);
                }
                .rating-number {
                    font-size: 18px;
                    font-weight: 700;
                    color: var(--text);
                }
                .rating-option.active .rating-number { color: var(--primary); }
                .rating-label {
                    font-size: 10px;
                    color: var(--text-hint);
                    margin-top: 2px;
                    white-space: nowrap;
                }
                .rating-option.na-option { 
                    border-style: dashed;
                    opacity: 0.7;
                }
                .rating-option.na-option:hover,
                .rating-option.na-option.active { opacity: 1; }
                .satisfaction-feedback { margin-top: 16px; }
                .feedback-label { 
                    font-size: 13px; 
                    font-weight: 500; 
                    margin-bottom: 8px;
                }
                .satisfaction-feedback textarea {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    font-size: 14px;
                    font-family: inherit;
                    resize: vertical;
                }
            </style>
        `;
        
        openModal('滿意度調查', html, [
            { text: '取消', class: 'btn-outline' },
            { 
                text: existing ? '更新' : '儲存', 
                class: 'btn-primary',
                onClick: () => this.submitForm(treatmentId, existing?.id)
            }
        ]);
        
        // 綁定按鈕事件
        setTimeout(() => {
            document.querySelectorAll('.rating-option').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const question = btn.dataset.question;
                    document.querySelectorAll(`.rating-option[data-question="${question}"]`).forEach(b => {
                        b.classList.remove('active');
                    });
                    btn.classList.add('active');
                };
            });
        }, 100);
    },
    
    /**
     * 送出滿意度表單
     */
    async submitForm(treatmentId, existingId = null) {
        const answers = {};
        let allAnswered = true;
        
        this.QUESTIONS.forEach(q => {
            const activeBtn = document.querySelector(`.rating-option.active[data-question="${q.id}"]`);
            if (activeBtn) {
                answers[q.id] = parseInt(activeBtn.dataset.value);
            } else if (!q.optional) {
                allAnswered = false;
            }
        });
        
        if (!allAnswered) {
            showToast('請回答所有必填問題', 'error');
            return;
        }
        
        const feedback = document.getElementById('satisfaction-feedback')?.value.trim() || '';
        
        const data = {
            treatment_id: treatmentId,
            ...answers,
            feedback
        };
        
        if (existingId) {
            data.id = existingId;
            data.updated_at = new Date().toISOString();
        }
        
        try {
            await this.save(data);
            closeModal();
            showToast(existingId ? '滿意度已更新' : '感謝您的回饋');
        } catch (e) {
            console.error('儲存失敗:', e);
            showToast('儲存失敗', 'error');
        }
    },
    
    /**
     * 計算統計數據
     */
    async calculateStats(startDate = null, endDate = null) {
        const all = await this.getAll();
        
        // 日期篩選
        let filtered = all;
        if (startDate || endDate) {
            filtered = all.filter(s => {
                const date = s.created_at?.split('T')[0];
                if (!date) return false;
                if (startDate && date < startDate) return false;
                if (endDate && date > endDate) return false;
                return true;
            });
        }
        
        if (filtered.length === 0) {
            return {
                count: 0,
                avgScores: {},
                overallAvg: null,
                nps: null,
                distribution: {}
            };
        }
        
        // 計算各題平均分
        const avgScores = {};
        this.QUESTIONS.forEach(q => {
            const validScores = filtered
                .map(s => s[q.id])
                .filter(v => v !== null && v !== undefined && v > 0);
            
            if (validScores.length > 0) {
                avgScores[q.id] = {
                    avg: validScores.reduce((a, b) => a + b, 0) / validScores.length,
                    count: validScores.length,
                    label: q.label
                };
            }
        });
        
        // 計算總體平均
        const allScores = Object.values(avgScores).map(s => s.avg);
        const overallAvg = allScores.length > 0 
            ? allScores.reduce((a, b) => a + b, 0) / allScores.length 
            : null;
        
        // 計算 NPS (淨推薦值) - 基於 q5
        const q5Scores = filtered.map(s => s.q5).filter(v => v > 0);
        let nps = null;
        if (q5Scores.length > 0) {
            const promoters = q5Scores.filter(s => s >= 4).length;
            const detractors = q5Scores.filter(s => s <= 2).length;
            nps = Math.round((promoters - detractors) / q5Scores.length * 100);
        }
        
        // 分數分布
        const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        filtered.forEach(s => {
            this.QUESTIONS.forEach(q => {
                const score = s[q.id];
                if (score >= 1 && score <= 5) {
                    distribution[score]++;
                }
            });
        });
        
        return {
            count: filtered.length,
            avgScores,
            overallAvg,
            nps,
            distribution
        };
    },
    
    /**
     * 檢查療程是否已有滿意度
     */
    async hasSubmitted(treatmentId) {
        const existing = await this.getByTreatment(treatmentId);
        return !!existing;
    }
};
