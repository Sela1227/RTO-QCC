/**
 * SELA 體重追蹤系統 - 工具函數
 */

/**
 * 日期格式化
 */
function formatDate(date, format = 'YYYY-MM-DD') {
    if (!date) return '-';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '-';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    
    if (format === 'YYYY-MM-DD') {
        return `${year}-${month}-${day}`;
    } else if (format === 'MM/DD') {
        return `${month}/${day}`;
    } else if (format === 'YYYY/MM/DD') {
        return `${year}/${month}/${day}`;
    }
    return `${year}-${month}-${day}`;
}

/**
 * 取得今天日期
 */
function today() {
    return formatDate(new Date());
}

/**
 * 計算天數差
 */
function daysBetween(date1, date2 = new Date()) {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2 - d1;
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 病歷號補 0 到 7 碼
 */
function padMedicalId(id) {
    if (!id) return '';
    return String(id).padStart(7, '0');
}

/**
 * 計算年齡
 */
function calculateAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    return age;
}

/**
 * 計算體重變化率
 */
function calculateWeightChangeRate(currentWeight, baselineWeight) {
    if (!currentWeight || !baselineWeight || baselineWeight === 0) return null;
    return ((currentWeight - baselineWeight) / baselineWeight) * 100;
}

/**
 * 格式化變化率顯示
 */
function formatChangeRate(rate) {
    if (rate === null || rate === undefined) return '-';
    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(1)}%`;
}

/**
 * 取得變化率 CSS 類別
 */
function getRateClass(rate) {
    if (rate === null || rate === undefined) return '';
    if (rate <= -5) return 'rate-danger';
    if (rate <= -3) return 'rate-warning';
    return 'rate-success';
}

/**
 * 性別顯示
 */
function formatGender(gender) {
    const map = { M: '男', F: '女', O: '其他' };
    return map[gender] || '-';
}

/**
 * 療程狀態顯示
 */
function formatTreatmentStatus(status) {
    const map = {
        active: '治療中',
        paused: '暫停中',
        completed: '已結案',
        terminated: '已終止'
    };
    return map[status] || status;
}

/**
 * 療程狀態標籤樣式
 */
function getStatusTagClass(status) {
    const map = {
        active: 'tag-blue',
        paused: 'tag-amber',
        completed: 'tag-green',
        terminated: 'tag-gray'
    };
    return map[status] || 'tag-gray';
}

/**
 * 介入類型顯示
 */
function formatInterventionType(type) {
    const map = {
        sdm: 'SDM',
        nutrition: '營養師轉介',
        manual: '手動介入'
    };
    return map[type] || type;
}

/**
 * 介入狀態顯示
 */
function formatInterventionStatus(status) {
    const map = {
        pending: '待處理',
        executed: '已執行',
        skipped: '不執行'
    };
    return map[status] || status;
}

/**
 * 顯示 Toast 通知
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

/**
 * 開啟對話框
 */
function openModal(title, bodyContent, footerButtons = []) {
    const overlay = document.getElementById('modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const modalFooter = document.getElementById('modal-footer');
    
    modalTitle.textContent = title;
    
    // 設定內容
    if (typeof bodyContent === 'string') {
        modalBody.innerHTML = bodyContent;
    } else {
        modalBody.innerHTML = '';
        modalBody.appendChild(bodyContent);
    }
    
    // 設定按鈕
    modalFooter.innerHTML = '';
    footerButtons.forEach(btn => {
        const button = document.createElement('button');
        button.className = `btn ${btn.class || 'btn-outline'}`;
        button.textContent = btn.text;
        button.onclick = () => {
            if (btn.onClick) btn.onClick();
            if (btn.closeOnClick !== false) closeModal();
        };
        modalFooter.appendChild(button);
    });
    
    overlay.classList.add('active');
}

/**
 * 關閉對話框
 */
function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    overlay.classList.remove('active');
}

/**
 * 確認對話框
 */
function confirmDialog(message, onConfirm, onCancel = null) {
    openModal('確認', `<p>${message}</p>`, [
        { text: '取消', class: 'btn-outline', onClick: onCancel },
        { text: '確認', class: 'btn-primary', onClick: onConfirm }
    ]);
}

/**
 * 建立表單 HTML
 */
function createFormGroup(label, inputHtml, required = false) {
    return `
        <div class="form-group">
            <label class="form-label">${label}${required ? ' *' : ''}</label>
            ${inputHtml}
        </div>
    `;
}

/**
 * 建立下拉選單 HTML
 */
function createSelect(id, options, selectedValue = '', placeholder = '請選擇') {
    let html = `<select class="form-select" id="${id}">`;
    html += `<option value="">${placeholder}</option>`;
    options.forEach(opt => {
        const value = typeof opt === 'object' ? opt.code || opt.value : opt;
        const label = typeof opt === 'object' ? opt.label || opt.text : opt;
        const selected = value === selectedValue ? 'selected' : '';
        html += `<option value="${value}" ${selected}>${label}</option>`;
    });
    html += '</select>';
    return html;
}

/**
 * 取得表單資料
 */
function getFormData(formId) {
    const form = document.getElementById(formId);
    if (!form) return {};
    
    const data = {};
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.id) {
            if (input.type === 'checkbox') {
                data[input.id] = input.checked;
            } else {
                data[input.id] = input.value;
            }
        }
    });
    return data;
}

/**
 * 驗證必填欄位
 */
function validateRequired(fields) {
    for (const field of fields) {
        const element = document.getElementById(field.id);
        if (!element || !element.value.trim()) {
            showToast(`請填寫${field.label}`, 'error');
            element?.focus();
            return false;
        }
    }
    return true;
}

/**
 * 下載 JSON 檔案
 */
function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * 讀取上傳的 JSON 檔案
 */
function readJSONFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                resolve(data);
            } catch (e) {
                reject(new Error('JSON 格式錯誤'));
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file);
    });
}

/**
 * 防抖函數
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 追蹤狀態計算
 */
function getTrackingStatus(lastMeasureDate) {
    if (!lastMeasureDate) return { status: 'overdue', label: '未量測', class: 'red' };
    
    const days = daysBetween(lastMeasureDate);
    
    if (days <= 5) {
        return { status: 'normal', label: '正常', class: 'green' };
    } else if (days <= 7) {
        return { status: 'pending', label: '待量測', class: 'amber' };
    } else {
        return { status: 'overdue', label: '逾期', class: 'red' };
    }
}

/**
 * 檢查是否需要觸發警示
 */
function checkAlertTrigger(rate, cancerType, alertRules) {
    const rule = alertRules.find(r => r.cancer_type === cancerType) || 
                 alertRules.find(r => r.cancer_type === 'default') ||
                 { sdm_threshold: -3, nutrition_threshold: -5 };
    
    if (rate <= rule.nutrition_threshold) {
        return { type: 'nutrition', label: '營養師轉介' };
    } else if (rate <= rule.sdm_threshold) {
        return { type: 'sdm', label: 'SDM' };
    }
    return null;
}

/**
 * 產生唯一 ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
