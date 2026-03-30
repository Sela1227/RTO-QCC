/**
 * 滿意度調查模組
 * 用於收集療程結束後的病人滿意度回饋
 */

const Satisfaction = {
    /**
     * 問卷題目定義
     */
    QUESTIONS: [
        { id: 'q1', text: '對放射腫瘤科的整體服務滿意嗎？', label: '放射腫瘤科服務' },
        { id: 'q2', text: '營養師的協助對您有幫助嗎？', label: '營養師協助', optional: true },
        { id: 'q3', text: '體重追蹤 APP 操作容易嗎？', label: 'APP 操作' },
        { id: 'q4', text: '治療前的說明讓您了解療程嗎？', label: '療程說明' },
        { id: 'q5', text: '願意推薦這個服務給其他病友嗎？', label: '推薦意願 (NPS)' }
    ],
    
    /**
     * 評分標籤
     */
    RATING_LABELS: ['非常不滿意', '不太滿意', '普通', '滿意', '非常滿意'],
    RATING_EMOJIS: ['😞', '😐', '🙂', '😊', '🤩'],
    
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
                    <button type="button" class="satisfaction-btn ${active}" 
                            data-question="${q.id}" data-value="${level}" 
                            title="${this.RATING_LABELS[level-1]}">
                        ${this.RATING_EMOJIS[level-1]}
                    </button>
                `;
            }).join('');
            
            // 營養師問題加上「未使用」選項
            const naOption = q.optional ? `
                <button type="button" class="satisfaction-btn na-btn ${existingValue === 0 ? 'active' : ''}" 
                        data-question="${q.id}" data-value="0" title="未使用營養師服務">
                    ⊘
                </button>
            ` : '';
            
            return `
                <div class="satisfaction-question">
                    <div class="question-label">${index + 1}. ${q.text}</div>
                    <div class="satisfaction-buttons">
                        ${buttons}
                        ${naOption}
                    </div>
                </div>
            `;
        }).join('');
        
        const html = `
            <div class="satisfaction-form">
                <div style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px; text-align: center;">
                    <strong>${patient.medical_id}</strong> ${patient.name}
                    <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
                        ${treatment.cancer_type_label} · ${formatDate(treatment.treatment_start)}
                    </div>
                </div>
                
                ${questionsHtml}
                
                <div class="satisfaction-question">
                    <div class="question-label">其他建議（選填）</div>
                    <textarea id="satisfaction-feedback" placeholder="請輸入建議..." rows="3"
                              style="width: 100%; padding: 10px; border: 1px solid var(--border); border-radius: 6px; font-size: 14px;"
                    >${existing?.feedback || ''}</textarea>
                </div>
            </div>
            
            <style>
                .satisfaction-form { max-height: 60vh; overflow-y: auto; }
                .satisfaction-question { margin-bottom: 16px; }
                .question-label { font-size: 14px; font-weight: 500; margin-bottom: 8px; }
                .satisfaction-buttons { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
                .satisfaction-btn { 
                    width: 44px; height: 44px; border-radius: 50%; 
                    border: 2px solid var(--border); background: white; 
                    font-size: 20px; cursor: pointer; transition: all 0.2s;
                }
                .satisfaction-btn:hover { border-color: var(--primary); transform: scale(1.1); }
                .satisfaction-btn.active { border-color: var(--primary); background: rgba(91, 143, 185, 0.15); transform: scale(1.1); }
                .satisfaction-btn.na-btn { font-size: 16px; color: var(--text-hint); }
            </style>
        `;
        
        openModal('😊 滿意度調查', html, [
            { text: '取消', class: 'btn-outline' },
            { 
                text: existing ? '更新' : '儲存', 
                class: 'btn-primary',
                onClick: () => this.submitForm(treatmentId, existing?.id)
            }
        ]);
        
        // 綁定按鈕事件
        setTimeout(() => {
            document.querySelectorAll('.satisfaction-btn').forEach(btn => {
                btn.onclick = (e) => {
                    e.preventDefault();
                    const question = btn.dataset.question;
                    document.querySelectorAll(`.satisfaction-btn[data-question="${question}"]`).forEach(b => {
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
            const activeBtn = document.querySelector(`.satisfaction-btn.active[data-question="${q.id}"]`);
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
            showToast(existingId ? '滿意度已更新' : '感謝您的回饋！');
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
