/**
 * 體重追蹤 - 病人端應用程式
 * v1.0
 */

const PatientApp = {
    // 資料
    data: null,
    chart: null,
    scanner: null,
    reminderInterval: null,
    
    // 常數
    STORAGE_KEY: 'weight_tracker_patient',
    
    /**
     * 初始化
     */
    async init() {
        // 載入資料
        this.loadData();
        
        // 綁定事件
        this.bindEvents();
        
        // 檢查是否已初始化
        if (this.data) {
            this.showScreen('main-screen');
            this.render();
            this.startReminderCheck();
        } else {
            this.showScreen('init-screen');
        }
        
        // 設定今日日期
        document.getElementById('record-date').value = this.today();
        
        console.log('病人端應用程式已啟動');
    },
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 初始化掃描
        document.getElementById('btn-scan-init').onclick = () => this.startScan('init');
        
        // 記錄體重
        document.getElementById('btn-record').onclick = () => this.recordWeight();
        
        // 體重輸入框 Enter
        document.getElementById('weight-input').onkeypress = (e) => {
            if (e.key === 'Enter') this.recordWeight();
        };
        
        // 提醒設定
        document.getElementById('btn-reminder').onclick = () => this.showReminderScreen();
        document.getElementById('btn-reminder-back').onclick = () => this.showScreen('main-screen');
        document.getElementById('btn-save-reminder').onclick = () => this.saveReminder();
        
        // 生成 QR Code
        document.getElementById('btn-generate-qr').onclick = () => this.generateQRCode();
        document.getElementById('btn-close-qr').onclick = () => this.showScreen('main-screen');
        
        // 設定
        document.getElementById('btn-settings').onclick = () => this.showSettingsScreen();
        document.getElementById('btn-settings-back').onclick = () => this.showScreen('main-screen');
        document.getElementById('btn-rescan').onclick = () => this.startScan('init');
        document.getElementById('btn-clear-data').onclick = () => this.clearData();
        
        // 掃描返回
        document.getElementById('btn-scanner-back').onclick = () => this.stopScan();
    },
    
    /**
     * 顯示畫面
     */
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
        document.getElementById(screenId).style.display = 'block';
    },
    
    /**
     * 載入資料
     */
    loadData() {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
            try {
                this.data = JSON.parse(stored);
            } catch (e) {
                console.error('資料解析失敗', e);
                this.data = null;
            }
        }
    },
    
    /**
     * 儲存資料
     */
    saveData() {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
    },
    
    /**
     * 開始掃描
     */
    async startScan(mode) {
        this.showScreen('scanner-screen');
        
        try {
            this.scanner = new Html5Qrcode('scanner-container');
            
            await this.scanner.start(
                { facingMode: 'environment' },
                {
                    fps: 10,
                    qrbox: { width: 250, height: 250 }
                },
                (decodedText) => {
                    this.handleScanResult(decodedText, mode);
                },
                (errorMessage) => {
                    // 掃描中...
                }
            );
        } catch (e) {
            console.error('相機啟動失敗', e);
            this.showToast('無法啟動相機', 'error');
            this.stopScan();
        }
    },
    
    /**
     * 停止掃描
     */
    async stopScan() {
        if (this.scanner) {
            try {
                await this.scanner.stop();
                this.scanner.clear();
            } catch (e) {
                console.error('停止掃描失敗', e);
            }
            this.scanner = null;
        }
        
        if (this.data) {
            this.showScreen('main-screen');
        } else {
            this.showScreen('init-screen');
        }
    },
    
    /**
     * 處理掃描結果
     */
    async handleScanResult(text, mode) {
        await this.stopScan();
        
        try {
            const data = JSON.parse(text);
            
            // 驗證資料格式
            if (data.t === 'init' && data.v === 1) {
                // 初始化資料
                this.data = {
                    patient_id: data.pid,
                    name: data.name,
                    treatment_start: data.ts,
                    baseline_weight: data.bw,
                    cancer_type: data.ct || '',
                    sdm_threshold: data.sdm || -3,
                    nutrition_threshold: data.nut || -5,
                    records: [],
                    reminder: {
                        enabled: false,
                        time: '08:00',
                        frequency: 'daily'
                    }
                };
                
                this.saveData();
                this.showScreen('main-screen');
                this.render();
                this.showToast('設定成功！', 'success');
            } else {
                this.showToast('QR Code 格式不正確', 'error');
            }
        } catch (e) {
            console.error('解析失敗', e);
            this.showToast('無法解析 QR Code', 'error');
        }
    },
    
    /**
     * 渲染主畫面
     */
    render() {
        if (!this.data) return;
        
        // 病人資訊
        document.getElementById('display-name').textContent = this.data.name;
        document.getElementById('display-pid').textContent = this.data.patient_id;
        document.getElementById('display-baseline').textContent = this.data.baseline_weight;
        
        // 歷史記錄
        this.renderHistory();
        
        // 圖表
        this.renderChart();
        
        // 警示
        this.checkAlert();
    },
    
    /**
     * 渲染歷史記錄
     */
    renderHistory() {
        const container = document.getElementById('history-list');
        const countEl = document.getElementById('record-count');
        const records = this.data.records || [];
        
        countEl.textContent = `${records.length} 筆`;
        
        if (records.length === 0) {
            container.innerHTML = '<div class="history-empty">尚無記錄</div>';
            return;
        }
        
        // 按日期倒序
        const sorted = [...records].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        container.innerHTML = sorted.map(r => {
            const rate = this.calcRate(r.weight);
            const rateClass = this.getRateClass(rate);
            const dateStr = this.formatDate(r.date);
            
            return `
                <div class="history-item">
                    <span class="history-date">${dateStr}</span>
                    <span class="history-weight">${r.weight} kg</span>
                    <span class="history-rate ${rateClass}">${this.formatRate(rate)}</span>
                </div>
            `;
        }).join('');
    },
    
    /**
     * 渲染圖表
     */
    renderChart() {
        const canvas = document.getElementById('weight-chart');
        const records = this.data.records || [];
        
        // 銷毀舊圖表
        if (this.chart) {
            this.chart.destroy();
        }
        
        if (records.length < 2) {
            // 資料不足，不顯示圖表
            return;
        }
        
        // 按日期排序
        const sorted = [...records].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        const labels = sorted.map(r => this.formatDate(r.date, 'short'));
        const weights = sorted.map(r => r.weight);
        const baseline = this.data.baseline_weight;
        const sdmLine = baseline * (1 + this.data.sdm_threshold / 100);
        const nutLine = baseline * (1 + this.data.nutrition_threshold / 100);
        
        this.chart = new Chart(canvas, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: '體重',
                        data: weights,
                        borderColor: '#4A90D9',
                        backgroundColor: 'rgba(74, 144, 217, 0.1)',
                        borderWidth: 2,
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: '基準',
                        data: Array(labels.length).fill(baseline),
                        borderColor: '#6BBF8A',
                        borderWidth: 1,
                        borderDash: [5, 5],
                        pointRadius: 0
                    },
                    {
                        label: '-3%',
                        data: Array(labels.length).fill(sdmLine),
                        borderColor: '#E4B95A',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0
                    },
                    {
                        label: '-5%',
                        data: Array(labels.length).fill(nutLine),
                        borderColor: '#D97B7B',
                        borderWidth: 1,
                        borderDash: [3, 3],
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#a8a8b8', font: { size: 10 } }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.1)' },
                        ticks: { color: '#a8a8b8', font: { size: 10 } }
                    }
                }
            }
        });
    },
    
    /**
     * 記錄體重
     */
    recordWeight() {
        const input = document.getElementById('weight-input');
        const dateInput = document.getElementById('record-date');
        const weight = parseFloat(input.value);
        const date = dateInput.value;
        
        if (!weight || weight < 20 || weight > 200) {
            this.showToast('請輸入有效的體重（20-200 kg）', 'error');
            return;
        }
        
        if (!date) {
            this.showToast('請選擇日期', 'error');
            return;
        }
        
        // 檢查是否已有該日期記錄
        const existingIndex = this.data.records.findIndex(r => r.date === date);
        if (existingIndex >= 0) {
            // 更新現有記錄
            this.data.records[existingIndex].weight = weight;
            this.showToast('已更新體重記錄', 'success');
        } else {
            // 新增記錄
            this.data.records.push({
                date: date,
                weight: weight
            });
            this.showToast('體重已記錄', 'success');
        }
        
        this.saveData();
        this.render();
        
        // 清空輸入
        input.value = '';
    },
    
    /**
     * 檢查警示
     */
    checkAlert() {
        const records = this.data.records || [];
        if (records.length === 0) {
            document.getElementById('alert-banner').style.display = 'none';
            return;
        }
        
        // 找最新記錄
        const sorted = [...records].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        const latest = sorted[0];
        const rate = this.calcRate(latest.weight);
        
        const banner = document.getElementById('alert-banner');
        const message = document.getElementById('alert-message');
        
        if (rate <= this.data.nutrition_threshold) {
            banner.style.display = 'flex';
            banner.className = 'alert-banner';
            message.textContent = `您的體重已下降 ${Math.abs(rate).toFixed(1)}%，建議儘快回診諮詢`;
        } else if (rate <= this.data.sdm_threshold) {
            banner.style.display = 'flex';
            banner.className = 'alert-banner warning';
            message.textContent = `您的體重已下降 ${Math.abs(rate).toFixed(1)}%，請注意飲食攝取`;
        } else {
            banner.style.display = 'none';
        }
    },
    
    /**
     * 生成回傳 QR Code
     */
    generateQRCode() {
        if (!this.data || this.data.records.length === 0) {
            this.showToast('尚無體重記錄可回傳', 'error');
            return;
        }
        
        // 準備資料
        const records = this.data.records.map(r => {
            // 日期格式：MMDD
            const d = new Date(r.date);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return [mm + dd, r.weight];
        });
        
        // 限制最多 50 筆
        const limitedRecords = records.slice(-50);
        
        const payload = {
            v: 1,
            t: 'sync',
            pid: this.data.patient_id,
            ts: this.data.treatment_start,
            r: limitedRecords
        };
        
        // 計算校驗碼（簡單 hash）
        const jsonStr = JSON.stringify(payload);
        let hash = 0;
        for (let i = 0; i < jsonStr.length; i++) {
            hash = ((hash << 5) - hash) + jsonStr.charCodeAt(i);
            hash = hash & hash;
        }
        payload.ck = Math.abs(hash).toString(16).substring(0, 4);
        
        // 生成 QR Code
        this.showScreen('qr-display-screen');
        document.getElementById('qr-info').textContent = `共 ${limitedRecords.length} 筆體重記錄`;
        
        const container = document.getElementById('qr-canvas-container');
        container.innerHTML = '';
        
        QRCode.toCanvas(JSON.stringify(payload), {
            width: 256,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff'
            }
        }, (err, canvas) => {
            if (err) {
                console.error('QR Code 生成失敗', err);
                this.showToast('QR Code 生成失敗', 'error');
                return;
            }
            container.appendChild(canvas);
        });
    },
    
    /**
     * 顯示提醒設定畫面
     */
    showReminderScreen() {
        this.showScreen('reminder-screen');
        
        // 載入設定
        const reminder = this.data?.reminder || {};
        document.getElementById('reminder-enabled').checked = reminder.enabled || false;
        document.getElementById('reminder-time').value = reminder.time || '08:00';
        
        const freq = reminder.frequency || 'daily';
        document.querySelector(`input[name="frequency"][value="${freq}"]`).checked = true;
        
        // 檢查通知權限
        this.updateNotificationStatus();
    },
    
    /**
     * 更新通知權限狀態
     */
    async updateNotificationStatus() {
        const statusEl = document.getElementById('notification-status');
        
        if (!('Notification' in window)) {
            statusEl.textContent = '此瀏覽器不支援通知功能';
            statusEl.className = 'notification-status denied';
            return;
        }
        
        if (Notification.permission === 'granted') {
            statusEl.textContent = '✓ 通知權限已開啟';
            statusEl.className = 'notification-status granted';
        } else if (Notification.permission === 'denied') {
            statusEl.textContent = '✕ 通知權限已被拒絕，請到瀏覽器設定開啟';
            statusEl.className = 'notification-status denied';
        } else {
            statusEl.innerHTML = '<button class="btn btn-outline btn-block" onclick="PatientApp.requestNotification()">開啟通知權限</button>';
            statusEl.className = 'notification-status';
        }
    },
    
    /**
     * 請求通知權限
     */
    async requestNotification() {
        const result = await Notification.requestPermission();
        this.updateNotificationStatus();
        
        if (result === 'granted') {
            this.showToast('通知權限已開啟', 'success');
        }
    },
    
    /**
     * 儲存提醒設定
     */
    saveReminder() {
        const enabled = document.getElementById('reminder-enabled').checked;
        const time = document.getElementById('reminder-time').value;
        const frequency = document.querySelector('input[name="frequency"]:checked').value;
        
        this.data.reminder = { enabled, time, frequency };
        this.saveData();
        
        // 重啟提醒檢查
        this.startReminderCheck();
        
        this.showToast('提醒設定已儲存', 'success');
        this.showScreen('main-screen');
    },
    
    /**
     * 開始提醒檢查
     */
    startReminderCheck() {
        // 清除舊的
        if (this.reminderInterval) {
            clearInterval(this.reminderInterval);
        }
        
        if (!this.data?.reminder?.enabled) return;
        
        // 每分鐘檢查一次
        this.reminderInterval = setInterval(() => {
            this.checkReminder();
        }, 60000);
        
        // 立即檢查一次
        this.checkReminder();
    },
    
    /**
     * 檢查是否該提醒
     */
    checkReminder() {
        const reminder = this.data?.reminder;
        if (!reminder?.enabled) return;
        
        const now = new Date();
        const [hours, minutes] = reminder.time.split(':').map(Number);
        
        // 檢查時間是否符合
        if (now.getHours() !== hours || now.getMinutes() !== minutes) {
            return;
        }
        
        // 檢查頻率
        if (reminder.frequency === 'weekly') {
            // 每週：只在週一提醒
            if (now.getDay() !== 1) return;
        }
        
        // 檢查今天是否已記錄
        const todayStr = this.today();
        const hasToday = this.data.records.some(r => r.date === todayStr);
        
        if (!hasToday) {
            this.sendNotification();
        }
    },
    
    /**
     * 發送通知
     */
    sendNotification() {
        if (Notification.permission !== 'granted') return;
        
        new Notification('體重追蹤提醒', {
            body: '請記得量體重並記錄！',
            icon: '🏥',
            tag: 'weight-reminder'
        });
    },
    
    /**
     * 顯示設定畫面
     */
    showSettingsScreen() {
        this.showScreen('settings-screen');
        
        if (this.data) {
            document.getElementById('settings-name').textContent = this.data.name;
            document.getElementById('settings-pid').textContent = this.data.patient_id;
            document.getElementById('settings-start').textContent = this.data.treatment_start;
            document.getElementById('settings-baseline').textContent = this.data.baseline_weight + ' kg';
        }
    },
    
    /**
     * 清除資料
     */
    clearData() {
        this.showConfirm('確定要清除所有資料嗎？', () => {
            localStorage.removeItem(this.STORAGE_KEY);
            this.data = null;
            this.showScreen('init-screen');
            this.showToast('資料已清除', 'success');
        });
    },
    
    // === 工具函數 ===
    
    /**
     * 計算變化率
     */
    calcRate(weight) {
        const baseline = this.data?.baseline_weight;
        if (!baseline) return 0;
        return ((weight - baseline) / baseline) * 100;
    },
    
    /**
     * 取得變化率樣式類別
     */
    getRateClass(rate) {
        if (rate <= this.data?.nutrition_threshold) return 'danger';
        if (rate <= this.data?.sdm_threshold) return 'warning';
        return 'normal';
    },
    
    /**
     * 格式化變化率
     */
    formatRate(rate) {
        const sign = rate >= 0 ? '+' : '';
        return `${sign}${rate.toFixed(1)}%`;
    },
    
    /**
     * 取得今天日期
     */
    today() {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },
    
    /**
     * 格式化日期
     */
    formatDate(dateStr, format = 'full') {
        const d = new Date(dateStr);
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        
        if (format === 'short') {
            return `${month}/${day}`;
        }
        return `${month}/${day}`;
    },
    
    /**
     * 顯示 Toast
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        
        setTimeout(() => {
            toast.className = 'toast';
        }, 2500);
    },
    
    /**
     * 確認對話框
     */
    showConfirm(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const msgEl = document.getElementById('confirm-message');
        
        msgEl.textContent = message;
        modal.style.display = 'flex';
        
        document.getElementById('confirm-ok').onclick = () => {
            modal.style.display = 'none';
            onConfirm();
        };
        
        document.getElementById('confirm-cancel').onclick = () => {
            modal.style.display = 'none';
        };
    }
};

// 啟動
document.addEventListener('DOMContentLoaded', () => {
    PatientApp.init();
});
