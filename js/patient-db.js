/**
 * 病人資料庫模組
 * 處理篩選、排序、顯示
 */
const PatientDB = {
    // 當前狀態
    period: 'all',
    sortFields: [
        { field: 'treatment_start', dir: 'desc' },
        { field: '', dir: 'asc' }
    ],
    
    // 快取資料
    allPatients: [],
    allTreatments: [],
    
    /**
     * 初始化
     */
    async init() {
        // 載入癌別選項
        const cancerTypes = await Settings.get('cancer_types', []);
        const cancerSelect = document.getElementById('patient-filter-cancer');
        if (cancerSelect) {
            cancerSelect.innerHTML = '<option value="all">全部</option>' +
                cancerTypes.map(c => `<option value="${c.code}">${c.label}</option>`).join('');
        }
        
        // 載入主治醫師選項
        const physicians = await Settings.get('physicians', [
            { code: 'hsiung', name: '熊敬業' },
            { code: 'liu', name: '劉育昌' },
            { code: 'lin', name: '林伯儒' }
        ]);
        const physicianSelect = document.getElementById('patient-filter-physician');
        if (physicianSelect) {
            physicianSelect.innerHTML = '<option value="all">全部</option>' +
                physicians.map(p => `<option value="${p.code}">${p.name}</option>`).join('');
        }
        
        // 載入年份選項
        this.initYearOptions();
        
        // 設定預設日期
        const today = new Date();
        document.getElementById('db-date-to').value = today.toISOString().split('T')[0];
        document.getElementById('db-date-from').value = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        
        // 設定預設排序
        document.getElementById('db-sort-1').value = 'treatment_start';
        
        // 標記預設期間按鈕
        this.updatePeriodButtons();
    },
    
    /**
     * 初始化年份選項
     */
    initYearOptions() {
        const yearSelect = document.getElementById('db-year');
        const currentYear = new Date().getFullYear();
        let html = '';
        for (let y = currentYear; y >= currentYear - 5; y--) {
            html += `<option value="${y}">${y} 年</option>`;
        }
        yearSelect.innerHTML = html;
    },
    
    /**
     * 設定期間
     */
    setPeriod(period) {
        this.period = period;
        this.updatePeriodButtons();
        this.updateDateRangeVisibility();
        this.refresh();
    },
    
    /**
     * 更新期間按鈕狀態
     */
    updatePeriodButtons() {
        document.querySelectorAll('.filter-quick-btns .btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.period === this.period);
        });
    },
    
    /**
     * 更新日期區間顯示
     */
    updateDateRangeVisibility() {
        const dateRange = document.getElementById('db-date-range');
        const yearGroup = document.getElementById('db-year-group');
        const fromGroup = document.getElementById('db-date-from-group');
        const toGroup = document.getElementById('db-date-to-group');
        const sep = document.getElementById('db-date-sep');
        
        if (this.period === 'specific_year') {
            dateRange.style.display = 'block';
            yearGroup.style.display = 'block';
            fromGroup.style.display = 'none';
            toGroup.style.display = 'none';
            sep.style.display = 'none';
        } else if (this.period === 'custom') {
            dateRange.style.display = 'block';
            yearGroup.style.display = 'none';
            fromGroup.style.display = 'block';
            toGroup.style.display = 'block';
            sep.style.display = 'inline';
        } else {
            dateRange.style.display = 'none';
        }
    },
    
    /**
     * 計算日期範圍
     */
    getDateRange() {
        const today = new Date();
        let from, to;
        
        switch (this.period) {
            case 'week':
                // 本週（週一到今天）
                const dayOfWeek = today.getDay() || 7;
                from = new Date(today);
                from.setDate(today.getDate() - dayOfWeek + 1);
                to = today;
                break;
            case 'month':
                // 本月
                from = new Date(today.getFullYear(), today.getMonth(), 1);
                to = today;
                break;
            case 'quarter':
                // 本季
                const quarter = Math.floor(today.getMonth() / 3);
                from = new Date(today.getFullYear(), quarter * 3, 1);
                to = today;
                break;
            case 'year':
                // 本年
                from = new Date(today.getFullYear(), 0, 1);
                to = today;
                break;
            case 'specific_year':
                // 指定年
                const year = parseInt(document.getElementById('db-year').value);
                from = new Date(year, 0, 1);
                to = new Date(year, 11, 31);
                break;
            case 'custom':
                // 指定區間
                const fromStr = document.getElementById('db-date-from').value;
                const toStr = document.getElementById('db-date-to').value;
                from = fromStr ? new Date(fromStr) : null;
                to = toStr ? new Date(toStr) : null;
                break;
            case 'all':
            default:
                return { from: null, to: null };
        }
        
        return {
            from: from ? from.toISOString().split('T')[0] : null,
            to: to ? to.toISOString().split('T')[0] : null
        };
    },
    
    /**
     * 切換排序方向
     */
    toggleSortDir(index) {
        const field = this.sortFields[index - 1];
        field.dir = field.dir === 'asc' ? 'desc' : 'asc';
        
        // 更新按鈕圖標
        const btn = document.getElementById(`db-sort-${index}-dir`);
        if (field.dir === 'asc') {
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 19V5M5 12l7-7 7 7"/>
            </svg>`;
            btn.title = '升序';
        } else {
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12l7 7 7-7"/>
            </svg>`;
            btn.title = '降序';
        }
        
        this.refresh();
    },
    
    /**
     * 刷新列表
     */
    async refresh() {
        try {
            // 載入資料
            this.allPatients = await Patient.getAll();
            this.allTreatments = await Treatment.getAll();
            
            console.log('PatientDB: 載入', this.allPatients.length, '位病人,', this.allTreatments.length, '筆療程');
            
            // 取得篩選條件
            const statusFilter = document.getElementById('patient-filter-status')?.value || 'all';
            const cancerFilter = document.getElementById('patient-filter-cancer')?.value || 'all';
            const physicianFilter = document.getElementById('patient-filter-physician')?.value || 'all';
            const searchInput = document.getElementById('patient-search-input')?.value?.trim().toLowerCase() || '';
            
            // 日期範圍
            const dateRange = this.getDateRange();
            
            // 排序欄位
            this.sortFields[0].field = document.getElementById('db-sort-1')?.value || '';
            this.sortFields[1].field = document.getElementById('db-sort-2')?.value || '';
            
            // 為每個病人加上療程資訊
            let patients = this.allPatients.map(p => {
                const treatments = this.allTreatments.filter(t => t.patient_id === p.id);
                const activeTreatment = treatments.find(t => t.status === 'active');
                const pausedTreatment = treatments.find(t => t.status === 'paused');
                const sortedTreatments = [...treatments].sort((a, b) => 
                    new Date(a.treatment_start) - new Date(b.treatment_start)
                );
                const firstTreatment = sortedTreatments[0];
                
                return {
                    ...p,
                    treatments,
                    activeTreatment,
                    pausedTreatment,
                    firstTreatment,
                    hasActive: !!activeTreatment,
                    hasPaused: !!pausedTreatment,
                    // 用於排序的欄位
                    _treatment_start: firstTreatment?.treatment_start || '',
                    _cancer_type: firstTreatment?.cancer_type || '',
                    _cancer_type_label: firstTreatment?.cancer_type_label || '',
                    _physician: firstTreatment?.physician || '',
                    _physician_name: firstTreatment?.physician_name || '',
                    _stage: firstTreatment?.stage || ''
                };
            });
        
        // 篩選：療程狀態
        if (statusFilter === 'has_active') {
            patients = patients.filter(p => p.hasActive);
        } else if (statusFilter === 'has_paused') {
            patients = patients.filter(p => p.hasPaused);
        } else if (statusFilter === 'no_active') {
            patients = patients.filter(p => !p.hasActive && !p.hasPaused);
        }
        
        // 篩選：癌別
        if (cancerFilter !== 'all') {
            patients = patients.filter(p => 
                p.treatments.some(t => t.cancer_type === cancerFilter)
            );
        }
        
        // 篩選：主治醫師
        if (physicianFilter !== 'all') {
            patients = patients.filter(p => 
                p.treatments.some(t => t.physician === physicianFilter)
            );
        }
        
        // 篩選：收案日期範圍
        if (dateRange.from || dateRange.to) {
            patients = patients.filter(p => {
                if (!p._treatment_start) return false;
                const startDate = p._treatment_start;
                if (dateRange.from && startDate < dateRange.from) return false;
                if (dateRange.to && startDate > dateRange.to) return false;
                return true;
            });
        }
        
        // 篩選：搜尋
        if (searchInput) {
            patients = patients.filter(p => 
                p.medical_id.toLowerCase().includes(searchInput) ||
                p.name.toLowerCase().includes(searchInput)
            );
        }
        
        // 排序
        patients = this.sortPatients(patients);
        
        // 更新結果數量
        document.getElementById('db-result-count').textContent = `共 ${patients.length} 筆`;
        
        // 渲染列表
        this.renderList(patients);
        
        } catch (e) {
            console.error('PatientDB.refresh 錯誤:', e);
        }
    },
    
    /**
     * 多重排序
     */
    sortPatients(patients) {
        const fields = this.sortFields.filter(f => f.field);
        if (fields.length === 0) return patients;
        
        return patients.sort((a, b) => {
            for (const { field, dir } of fields) {
                let valA, valB;
                
                switch (field) {
                    case 'medical_id':
                        valA = a.medical_id || '';
                        valB = b.medical_id || '';
                        break;
                    case 'treatment_start':
                        valA = a._treatment_start || '';
                        valB = b._treatment_start || '';
                        break;
                    case 'name':
                        valA = a.name || '';
                        valB = b.name || '';
                        break;
                    case 'cancer_type':
                        valA = a._cancer_type_label || '';
                        valB = b._cancer_type_label || '';
                        break;
                    case 'physician':
                        valA = a._physician_name || '';
                        valB = b._physician_name || '';
                        break;
                    case 'stage':
                        valA = a._stage || '';
                        valB = b._stage || '';
                        break;
                    default:
                        continue;
                }
                
                let cmp = 0;
                if (typeof valA === 'string') {
                    cmp = valA.localeCompare(valB, 'zh-TW');
                } else {
                    cmp = valA - valB;
                }
                
                if (cmp !== 0) {
                    return dir === 'asc' ? cmp : -cmp;
                }
            }
            return 0;
        });
    },
    
    /**
     * 渲染列表
     */
    renderList(patients) {
        const container = document.getElementById('patient-list');
        
        if (patients.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 60px 20px;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.5">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                        <circle cx="9" cy="7" r="4"/>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                    <p>無符合條件的病人</p>
                </div>
            `;
            return;
        }
        
        // 表格形式
        let html = `
            <table class="patient-table">
                <thead>
                    <tr>
                        <th>病歷號</th>
                        <th>姓名</th>
                        <th>性別</th>
                        <th>年齡</th>
                        <th>主治醫師</th>
                        <th>癌別</th>
                        <th>期別</th>
                        <th>首療月份</th>
                        <th>狀態</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        for (const p of patients) {
            const age = calculateAge(p.birth_date);
            const firstTx = p.firstTreatment;
            const startMonth = firstTx?.treatment_start 
                ? formatDate(firstTx.treatment_start, 'YYYY-MM') 
                : '-';
            
            // 狀態標籤
            let statusTag = '';
            if (p.hasActive) {
                statusTag = '<span class="tag tag-blue">治療中</span>';
            } else if (p.hasPaused) {
                statusTag = '<span class="tag tag-purple">暫停中</span>';
            } else if (p.treatments.length > 0) {
                statusTag = '<span class="tag tag-gray">已結案</span>';
            } else {
                statusTag = '<span class="tag tag-gray">無療程</span>';
            }
            
            html += `
                <tr onclick="App.selectPatient(${p.id})" style="cursor: pointer;">
                    <td><strong>${p.medical_id}</strong></td>
                    <td>${p.name}</td>
                    <td>${formatGender(p.gender)}</td>
                    <td>${age}歲</td>
                    <td>${firstTx?.physician_name || '-'}</td>
                    <td>${firstTx?.cancer_type_label || '-'}</td>
                    <td>${firstTx?.stage ? formatStage(firstTx.stage) : '-'}</td>
                    <td>${startMonth}</td>
                    <td>${statusTag}</td>
                    <td>
                        <button class="btn-icon" onclick="event.stopPropagation(); Patient.showForm(${p.id})" title="編輯">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                            </svg>
                        </button>
                    </td>
                </tr>
            `;
        }
        
        html += '</tbody></table>';
        container.innerHTML = html;
    }
};

/**
 * 格式化期別
 */
function formatStage(stage) {
    const stageMap = {
        '0': '0期',
        '1': 'I期',
        '2': 'II期',
        '3': 'III期',
        '4': 'IV期'
    };
    return stageMap[stage] || stage;
}
