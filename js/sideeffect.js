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
            .sort((a, b) => new Date(a.assess_date) - new Date(b.assess_date));
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
    }
};
