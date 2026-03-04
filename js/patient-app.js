/**
 * 體重追蹤 - 病人端應用程式
 * v1.1
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
        
        // 檢查 URL 參數（從 QR Code 掃描來的）
        const urlParams = new URLSearchParams(window.location.search);
        const dataParam = urlParams.get('d');
        
        if (dataParam && !this.data) {
            // 有 URL 參數且尚未初始化，自動處理
            await this.handleScanResult(dataParam, 'url');
        }
        
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
        
        // 切換病人
        document.getElementById('btn-switch-patient').onclick = () => this.startScan('init');
        
        // 加到主畫面
        document.getElementById('btn-install').onclick = () => this.handleInstall();
        this.setupInstallPrompt();
        
        // 掃描返回
        document.getElementById('btn-scanner-back').onclick = () => this.stopScan();
        
        // 分頁籤切換
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => this.switchTab(btn.dataset.tab);
        });
        
        // 食物照片
        document.getElementById('btn-take-photo').onclick = () => this.takePhoto();
        document.getElementById('btn-choose-photo').onclick = () => this.choosePhoto();
        document.getElementById('food-photo-input').onchange = (e) => this.handlePhotoSelected(e);
    },
    
    /**
     * 切換分頁籤
     */
    switchTab(tabName) {
        // 更新按鈕狀態
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });
        
        // 更新內容顯示
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.toggle('active', panel.id === `tab-${tabName}`);
        });
        
        // 切換到營養諮詢時刷新列表
        if (tabName === 'nutrition') {
            this.renderFoodRecords();
        }
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
        // 先停止之前的掃描器（如果有）
        await this.stopScannerOnly();
        
        this.showScreen('scanner-screen');
        
        const container = document.getElementById('scanner-container');
        if (!container) {
            this.showToast('找不到掃描容器', 'error');
            return;
        }
        
        // 清空並設定尺寸
        container.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--text-hint);">正在啟動相機...</div>';
        
        // 延遲一下再初始化掃描器
        setTimeout(async () => {
            container.innerHTML = '';
            
            try {
                this.scanner = new Html5Qrcode('scanner-container');
                
                await this.scanner.start(
                    { facingMode: 'environment' },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1
                    },
                    (decodedText) => {
                        this.handleScanResult(decodedText, mode);
                    },
                    (errorMessage) => {
                        // 掃描中...忽略錯誤
                    }
                );
            } catch (e) {
                console.error('相機啟動失敗', e);
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: var(--danger); margin-bottom: 16px;">無法啟動相機</p>
                        <p style="color: var(--text-hint); font-size: 13px; margin-bottom: 16px;">${e.message || '請確認已授予相機權限'}</p>
                        <button class="btn btn-outline" onclick="PatientApp.startScan('${mode}')">重試</button>
                    </div>
                `;
            }
        }, 200);
    },
    
    /**
     * 只停止掃描器（不切換畫面）
     */
    async stopScannerOnly() {
        if (this.scanner) {
            try {
                await this.scanner.stop();
            } catch (e) {
                // 可能已經停止了
            }
            try {
                this.scanner.clear();
            } catch (e) {}
            this.scanner = null;
        }
    },
    
    /**
     * 停止掃描
     */
    async stopScan() {
        await this.stopScannerOnly();
        
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
        // 停止掃描器（不切換畫面）
        if (mode !== 'url') {
            await this.stopScannerOnly();
        }
        
        try {
            let patientId, name, treatmentStart, baselineWeight;
            let existingRecords = []; // 從 QR Code 帶來的既有記錄
            let dataText = text;
            
            // 如果掃到的是完整 URL，提取 d 參數
            if (text.startsWith('http://') || text.startsWith('https://')) {
                try {
                    const url = new URL(text);
                    const dParam = url.searchParams.get('d');
                    if (dParam) {
                        dataText = dParam;
                    } else {
                        this.showToast('QR Code 格式不正確', 'error');
                        return;
                    }
                } catch (e) {
                    this.showToast('QR Code 格式不正確', 'error');
                    return;
                }
            }
            
            // 檢查是否為新的精簡格式：I|病歷號|姓名|開始日期|基準體重|既有記錄
            if (dataText.startsWith('I|')) {
                const parts = dataText.split('|');
                if (parts.length >= 5) {
                    patientId = parts[1];
                    name = parts[2];
                    treatmentStart = parts[3];
                    baselineWeight = parseFloat(parts[4]) || 0;
                    
                    // 解析既有記錄（如果有）
                    if (parts.length >= 6 && parts[5]) {
                        const recordParts = parts[5].split(',');
                        const currentYear = new Date().getFullYear();
                        for (const rp of recordParts) {
                            const [mmdd, weight] = rp.split(':');
                            if (mmdd && weight) {
                                const mm = mmdd.substring(0, 2);
                                const dd = mmdd.substring(2, 4);
                                existingRecords.push({
                                    date: `${currentYear}-${mm}-${dd}`,
                                    weight: parseFloat(weight)
                                });
                            }
                        }
                    }
                } else {
                    this.showToast('QR Code 格式不正確', 'error');
                    return;
                }
            } else {
                // 舊的 JSON 格式（向後相容）
                const data = JSON.parse(dataText);
                if (data.t === 'init' && data.v === 1) {
                    patientId = data.pid;
                    name = data.name;
                    treatmentStart = data.ts;
                    baselineWeight = data.bw;
                } else {
                    this.showToast('QR Code 格式不正確', 'error');
                    return;
                }
            }
            
            // 檢查是否已有同一病人的資料（合併記錄）
            if (this.data && this.data.patient_id === patientId) {
                // 同一病人，合併既有記錄
                const currentRecords = this.data.records || [];
                const currentDates = new Set(currentRecords.map(r => r.date));
                
                let addedCount = 0;
                for (const record of existingRecords) {
                    if (!currentDates.has(record.date)) {
                        currentRecords.push(record);
                        addedCount++;
                    }
                }
                
                this.data.records = currentRecords;
                this.saveData();
                this.render();
                
                if (addedCount > 0) {
                    this.showToast(`已同步 ${addedCount} 筆記錄`, 'success');
                } else {
                    this.showToast('資料已是最新', 'success');
                }
                this.showScreen('main-screen');
                return;
            }
            
            // 檢查是否已有其他病人的資料（需要四碼確認）
            if (this.data && this.data.patient_id !== patientId) {
                const code = Math.floor(1000 + Math.random() * 9000).toString();
                const input = prompt(
                    `目前已有 ${this.data.name} 的資料。\n\n` +
                    `確定要切換到 ${name} 嗎？\n` +
                    `（原有的體重記錄將被清除）\n\n` +
                    `請輸入 ${code} 確認：`
                );
                
                if (input !== code) {
                    if (input !== null) {
                        this.showToast('確認碼不正確', 'error');
                    }
                    this.showScreen('main-screen');
                    return;
                }
            }
            
            // 初始化資料（新病人或確認切換）
            this.data = {
                patient_id: patientId,
                name: name,
                treatment_start: treatmentStart,
                baseline_weight: baselineWeight,
                sdm_threshold: -3,
                nutrition_threshold: -5,
                records: existingRecords, // 帶入既有記錄
                reminder: {
                    enabled: false,
                    time: '08:00',
                    frequency: 'daily'
                }
            };
            
            this.saveData();
            this.showScreen('main-screen');
            this.render();
            
            const recordMsg = existingRecords.length > 0 
                ? `已載入 ${existingRecords.length} 筆記錄` 
                : '設定成功！';
            this.showToast(recordMsg, 'success');
            
            // 提示加到主畫面（僅首次且在手機上）
            setTimeout(() => {
                this.promptAddToHomeScreen();
            }, 1500);
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
        
        container.innerHTML = sorted.map((r, index) => {
            const rate = this.calcRate(r.weight);
            const rateClass = this.getRateClass(rate);
            const dateStr = this.formatDate(r.date);
            
            return `
                <div class="history-item" data-date="${r.date}">
                    <div class="history-main">
                        <span class="history-date">${dateStr}</span>
                        <span class="history-weight">${r.weight} kg</span>
                        <span class="history-rate ${rateClass}">${this.formatRate(rate)}</span>
                    </div>
                    <div class="history-actions">
                        <button class="btn-mini" onclick="PatientApp.editRecord('${r.date}')" title="編輯">✎</button>
                        <button class="btn-mini btn-mini-danger" onclick="PatientApp.deleteRecord('${r.date}')" title="刪除">✕</button>
                    </div>
                </div>
            `;
        }).join('');
    },
    
    /**
     * 渲染圖表
     */
    renderChart() {
        const chartSection = document.querySelector('.chart-section');
        if (!chartSection) return;
        
        const records = this.data.records || [];
        const baseline = this.data.baseline_weight;
        const treatmentStart = this.data.treatment_start;
        
        // 銷毀舊圖表
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // 沒有基準體重，顯示提示
        if (!baseline) {
            chartSection.innerHTML = `
                <h2>體重趨勢</h2>
                <div class="chart-container" style="display: flex; align-items: center; justify-content: center; color: var(--text-hint);">
                    尚無基準體重
                </div>
            `;
            return;
        }
        
        // 計算警示線
        const sdmLine = baseline * (1 + this.data.sdm_threshold / 100);
        const nutLine = baseline * (1 + this.data.nutrition_threshold / 100);
        
        // 重建 canvas（每次都重建以確保正確）
        chartSection.innerHTML = `
            <h2>體重趨勢</h2>
            <div class="chart-container">
                <canvas id="weight-chart"></canvas>
            </div>
            <div class="chart-legend" style="display: flex; justify-content: center; gap: 16px; margin-top: 12px; font-size: 12px;">
                <span style="color: #6BBF8A;">━ 基準 ${baseline} kg</span>
                <span style="color: #E4B95A;">╴╴ -3% SDM (${sdmLine.toFixed(1)} kg)</span>
                <span style="color: #D97B7B;">╴╴ -5% 營養師 (${nutLine.toFixed(1)} kg)</span>
            </div>
        `;
        
        const chartCanvas = document.getElementById('weight-chart');
        if (!chartCanvas) return;
        
        // 準備資料：基準體重 + 記錄
        const sorted = [...records].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );
        
        // 基準日期使用療程開始日期
        const baselineLabel = treatmentStart ? this.formatDate(treatmentStart, 'short') : '基準';
        
        // 組合標籤和數據：基準日期 + 所有記錄日期
        const labels = [baselineLabel, ...sorted.map(r => this.formatDate(r.date, 'short'))];
        const weights = [baseline, ...sorted.map(r => r.weight)];
        
        try {
            this.chart = new Chart(chartCanvas, {
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
        } catch (e) {
            console.error('圖表渲染失敗', e);
        }
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
        
        // 準備資料（精簡格式）
        // 格式：S|病歷號|療程開始|MMDD:體重,MMDD:體重,...
        const records = this.data.records.map(r => {
            const d = new Date(r.date);
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${mm}${dd}:${r.weight}`;
        });
        
        // 限制最多 30 筆（確保 QR Code 容量足夠）
        const limitedRecords = records.slice(-30);
        
        const payload = `S|${this.data.patient_id}|${this.data.treatment_start}|${limitedRecords.join(',')}`;
        
        // 使用 QR Server API 生成 QR Code
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(payload)}`;
        
        // 顯示 QR Code
        this.showScreen('qr-display-screen');
        document.getElementById('qr-info').textContent = `共 ${limitedRecords.length} 筆體重記錄`;
        
        const container = document.getElementById('qr-canvas-container');
        container.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="display: block;">`;
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
     * 清除資料（需輸入隨機四碼確認）
     */
    clearData() {
        // 生成隨機四碼
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const input = prompt(`確定要清除所有資料嗎？\n\n此操作無法復原！\n\n請輸入 ${code} 確認：`);
        
        if (input === code) {
            localStorage.removeItem(this.STORAGE_KEY);
            this.data = null;
            this.showScreen('init-screen');
            this.showToast('資料已清除', 'success');
        } else if (input !== null) {
            this.showToast('確認碼不正確', 'error');
        }
    },
    
    /**
     * 編輯記錄
     */
    editRecord(date) {
        const record = this.data.records.find(r => r.date === date);
        if (!record) return;
        
        const newWeight = prompt(`編輯 ${this.formatDate(date)} 的體重記錄：`, record.weight);
        if (newWeight === null) return;
        
        const weight = parseFloat(newWeight);
        if (!weight || weight < 20 || weight > 200) {
            this.showToast('請輸入有效的體重（20-200 kg）', 'error');
            return;
        }
        
        record.weight = weight;
        this.saveData();
        this.render();
        this.showToast('記錄已更新', 'success');
    },
    
    /**
     * 刪除記錄
     */
    deleteRecord(date) {
        const record = this.data.records.find(r => r.date === date);
        if (!record) return;
        
        if (confirm(`確定要刪除 ${this.formatDate(date)} 的記錄（${record.weight} kg）嗎？`)) {
            this.data.records = this.data.records.filter(r => r.date !== date);
            this.saveData();
            this.render();
            this.showToast('記錄已刪除', 'success');
        }
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
    },
    
    /**
     * 首次設定成功後提示加到主畫面
     */
    promptAddToHomeScreen() {
        // 檢查是否已經是 PWA 模式或已經提示過
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true ||
            localStorage.getItem('install_prompted')) {
            return;
        }
        
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (!isIOS && !isAndroid) return;
        
        // 標記已提示
        localStorage.setItem('install_prompted', '1');
        
        // 顯示安裝提示 Modal
        this.showInstallModal();
    },
    
    /**
     * 顯示安裝提示 Modal
     */
    showInstallModal() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        
        const modal = document.createElement('div');
        modal.className = 'install-modal';
        modal.innerHTML = `
            <div class="install-modal-content">
                <div class="install-modal-header">
                    <span style="font-size: 32px;">📱</span>
                    <h3>加到主畫面</h3>
                </div>
                <p>將此頁面加到主畫面，<br>下次可以像 APP 一樣直接開啟！</p>
                ${isIOS ? `
                    <div class="install-steps">
                        <div class="install-step">
                            <span class="step-icon">1</span>
                            <span>點擊底部的 <strong>分享按鈕</strong> <span style="border: 1px solid; padding: 2px 6px; border-radius: 4px;">↑</span></span>
                        </div>
                        <div class="install-step">
                            <span class="step-icon">2</span>
                            <span>選擇 <strong>「加入主畫面」</strong></span>
                        </div>
                        <div class="install-step">
                            <span class="step-icon">3</span>
                            <span>點擊 <strong>「新增」</strong></span>
                        </div>
                    </div>
                ` : `
                    <div class="install-steps">
                        <div class="install-step">
                            <span class="step-icon">1</span>
                            <span>點擊右上角的 <strong>選單 ⋮</strong></span>
                        </div>
                        <div class="install-step">
                            <span class="step-icon">2</span>
                            <span>選擇 <strong>「加到主畫面」</strong></span>
                        </div>
                    </div>
                `}
                <div class="install-modal-buttons">
                    <button class="btn btn-outline" onclick="this.closest('.install-modal').remove()">稍後再說</button>
                    <button class="btn btn-primary" onclick="PatientApp.handleInstallFromModal(this)">我知道了</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    /**
     * 從 Modal 處理安裝
     */
    handleInstallFromModal(btn) {
        const modal = btn.closest('.install-modal');
        
        // Android 且有 deferredPrompt，直接安裝
        if (this.deferredPrompt) {
            this.deferredPrompt.prompt();
            this.deferredPrompt.userChoice.then(result => {
                if (result.outcome === 'accepted') {
                    this.showToast('已加到主畫面！', 'success');
                }
                this.deferredPrompt = null;
            });
        }
        
        modal.remove();
    },
    
    /**
     * 設定安裝提示
     */
    setupInstallPrompt() {
        const installSection = document.getElementById('install-section');
        const installBtn = document.getElementById('btn-install');
        const instructions = document.getElementById('install-instructions');
        
        // 檢查是否已經是 PWA 模式（已安裝）
        if (window.matchMedia('(display-mode: standalone)').matches || 
            window.navigator.standalone === true) {
            // 已經是 APP 模式，隱藏安裝區塊
            if (installSection) installSection.style.display = 'none';
            return;
        }
        
        // 檢測平台
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isAndroid = /Android/.test(navigator.userAgent);
        
        if (isIOS) {
            // iOS Safari：顯示操作說明
            instructions.innerHTML = `
                <strong>iOS 安裝步驟：</strong><br>
                1. 點擊 Safari 底部的 <strong>分享按鈕</strong> 
                   <span style="display: inline-block; width: 20px; height: 20px; border: 1px solid currentColor; border-radius: 4px; text-align: center; line-height: 18px;">↑</span><br>
                2. 向下滑動，選擇 <strong>「加入主畫面」</strong><br>
                3. 點擊右上角的 <strong>「新增」</strong>
            `;
            installBtn.textContent = '查看安裝說明';
            installBtn.onclick = () => {
                instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
            };
        } else if (isAndroid) {
            // Android Chrome：嘗試捕獲 beforeinstallprompt
            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                this.deferredPrompt = e;
                installBtn.style.display = 'block';
            });
            
            // 如果沒有捕獲到事件，顯示手動說明
            setTimeout(() => {
                if (!this.deferredPrompt) {
                    instructions.innerHTML = `
                        <strong>Android 安裝步驟：</strong><br>
                        1. 點擊瀏覽器右上角的 <strong>選單（⋮）</strong><br>
                        2. 選擇 <strong>「加到主畫面」</strong> 或 <strong>「安裝應用程式」</strong>
                    `;
                    installBtn.textContent = '查看安裝說明';
                    installBtn.onclick = () => {
                        instructions.style.display = instructions.style.display === 'none' ? 'block' : 'none';
                    };
                }
            }, 2000);
        } else {
            // 桌面或其他：隱藏安裝區塊
            if (installSection) installSection.style.display = 'none';
        }
    },
    
    /**
     * 處理安裝按鈕點擊
     */
    async handleInstall() {
        if (this.deferredPrompt) {
            // Android：觸發安裝提示
            this.deferredPrompt.prompt();
            const { outcome } = await this.deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                this.showToast('已加到主畫面！', 'success');
            }
            this.deferredPrompt = null;
        }
    },
    
    // ========== 食物照片功能 ==========
    
    FOOD_STORAGE_KEY: 'sela_food_records',
    
    /**
     * 拍攝照片
     */
    takePhoto() {
        const input = document.getElementById('food-photo-input');
        input.setAttribute('capture', 'environment');
        input.click();
    },
    
    /**
     * 從相簿選擇
     */
    choosePhoto() {
        const input = document.getElementById('food-photo-input');
        input.removeAttribute('capture');
        input.click();
    },
    
    /**
     * 處理選擇的照片
     */
    async handlePhotoSelected(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        // 檢查檔案類型
        if (!file.type.startsWith('image/')) {
            this.showToast('請選擇圖片檔案', 'error');
            return;
        }
        
        // 顯示預覽並讓用戶添加備註
        this.showPhotoPreview(file);
        
        // 清空 input 以便下次選擇同一檔案也能觸發
        e.target.value = '';
    },
    
    /**
     * 顯示照片預覽
     */
    showPhotoPreview(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;
            
            const modal = document.createElement('div');
            modal.className = 'note-input-modal';
            modal.innerHTML = `
                <div class="note-input-content">
                    <h3>📷 新增餐點記錄</h3>
                    <img src="${imageData}" style="width: 100%; max-height: 200px; object-fit: cover; border-radius: 8px; margin-bottom: 12px;">
                    <input type="text" id="food-note-input" placeholder="餐點說明（選填，如：早餐）" maxlength="50">
                    <div class="note-input-buttons">
                        <button class="btn btn-outline" onclick="this.closest('.note-input-modal').remove()">取消</button>
                        <button class="btn btn-primary" id="btn-save-food">儲存</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            document.getElementById('btn-save-food').onclick = () => {
                const note = document.getElementById('food-note-input').value.trim();
                this.saveFoodRecord(imageData, note);
                modal.remove();
            };
        };
        reader.readAsDataURL(file);
    },
    
    /**
     * 儲存食物記錄
     */
    saveFoodRecord(imageData, note) {
        // 壓縮圖片
        this.compressImage(imageData, (compressedData) => {
            const records = this.getFoodRecords();
            const now = new Date();
            
            records.push({
                id: Date.now(),
                date: now.toISOString().split('T')[0],
                time: now.toTimeString().substring(0, 5),
                image: compressedData,
                note: note
            });
            
            // 最多保留 50 筆
            while (records.length > 50) {
                records.shift();
            }
            
            localStorage.setItem(this.FOOD_STORAGE_KEY, JSON.stringify(records));
            this.renderFoodRecords();
            this.showToast('餐點已記錄', 'success');
        });
    },
    
    /**
     * 壓縮圖片
     */
    compressImage(dataUrl, callback) {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxSize = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > height && width > maxSize) {
                height = (height * maxSize) / width;
                width = maxSize;
            } else if (height > maxSize) {
                width = (width * maxSize) / height;
                height = maxSize;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            callback(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = dataUrl;
    },
    
    /**
     * 取得食物記錄
     */
    getFoodRecords() {
        try {
            return JSON.parse(localStorage.getItem(this.FOOD_STORAGE_KEY) || '[]');
        } catch {
            return [];
        }
    },
    
    /**
     * 渲染食物記錄列表
     */
    renderFoodRecords() {
        const container = document.getElementById('food-records-list');
        const countEl = document.getElementById('food-record-count');
        const records = this.getFoodRecords();
        
        countEl.textContent = `${records.length} 筆`;
        
        if (records.length === 0) {
            container.innerHTML = '<div class="empty-hint">尚無餐點記錄<br>點擊上方按鈕開始記錄</div>';
            return;
        }
        
        // 按日期倒序
        const sorted = [...records].sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateB - dateA;
        });
        
        container.innerHTML = sorted.map(r => `
            <div class="food-record-item" data-id="${r.id}">
                <img src="${r.image}" alt="餐點照片" onclick="PatientApp.viewFoodPhoto('${r.id}')">
                <div class="food-record-info">
                    <div class="food-record-date">${this.formatDate(r.date)}</div>
                    <div class="food-record-time">${r.time}</div>
                    ${r.note ? `<div class="food-record-note">${r.note}</div>` : ''}
                </div>
                <div class="food-record-actions">
                    <button class="btn-mini" onclick="PatientApp.editFoodNote('${r.id}')" title="編輯備註">✎</button>
                    <button class="btn-mini btn-mini-danger" onclick="PatientApp.deleteFoodRecord('${r.id}')" title="刪除">✕</button>
                </div>
            </div>
        `).join('');
    },
    
    /**
     * 查看食物照片
     */
    viewFoodPhoto(id) {
        const records = this.getFoodRecords();
        const record = records.find(r => r.id == id);
        if (!record) return;
        
        const modal = document.createElement('div');
        modal.className = 'photo-preview-modal';
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        modal.innerHTML = `
            <img src="${record.image}" alt="餐點照片">
            <div style="margin-top: 12px; color: white; text-align: center;">
                <div>${this.formatDate(record.date)} ${record.time}</div>
                ${record.note ? `<div style="margin-top: 4px; opacity: 0.8;">${record.note}</div>` : ''}
            </div>
            <div class="photo-preview-actions">
                <button class="btn btn-outline" onclick="this.closest('.photo-preview-modal').remove()">關閉</button>
            </div>
        `;
        document.body.appendChild(modal);
    },
    
    /**
     * 編輯食物備註
     */
    editFoodNote(id) {
        const records = this.getFoodRecords();
        const record = records.find(r => r.id == id);
        if (!record) return;
        
        const newNote = prompt('編輯備註：', record.note || '');
        if (newNote === null) return;
        
        record.note = newNote.trim();
        localStorage.setItem(this.FOOD_STORAGE_KEY, JSON.stringify(records));
        this.renderFoodRecords();
        this.showToast('備註已更新', 'success');
    },
    
    /**
     * 刪除食物記錄
     */
    deleteFoodRecord(id) {
        if (!confirm('確定要刪除這筆餐點記錄嗎？')) return;
        
        let records = this.getFoodRecords();
        records = records.filter(r => r.id != id);
        localStorage.setItem(this.FOOD_STORAGE_KEY, JSON.stringify(records));
        this.renderFoodRecords();
        this.showToast('已刪除', 'success');
    }
};

// 啟動
document.addEventListener('DOMContentLoaded', () => {
    PatientApp.init();
});
