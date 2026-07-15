/**
 * RTO-QCC Service Worker
 * ────────────────────────────────────────────────
 * ⚠ 升版必改：CACHE_VERSION（坑 #14：版本號多檔同步）
 *   每次發版 = index.html header span + 全部 ?v= + 此處 CACHE_VERSION 一起改
 * ⚠ 相對路徑（坑 #39）：GitHub Pages 子路徑相容，所有資源不加開頭斜線
 * ⚠ 非 GET 一律放行（坑 #13）：Cache API 只支援 GET
 */

const CACHE_VERSION = 'rto-qcc-v7.3.0';

// 本地 App Shell（必快取，任一失敗則 install 失敗 → 確保核心完整）
const APP_SHELL = [
  'index.html',
  'patient.html',
  'manifest.json',
  'logo.png',
  'sela.svg',
  'css/style.css',
  'css/patient.css',
  'js/config.js',
  'js/db.js',
  'js/utils.js',
  'js/patient.js',
  'js/treatment.js',
  'js/weight.js',
  'js/sideeffect.js',
  'js/intervention.js',
  'js/report.js',
  'js/settings.js',
  'js/sync.js',
  'js/version-sync.js',
  'js/satisfaction.js',
  'js/dashboard.js',
  'js/patient-db.js',
  'js/demo.js',
  'js/app.js',
  'js/patient-app.js',
  'favicon/favicon.ico',
  'favicon/favicon-16x16.png',
  'favicon/favicon-32x32.png',
  'favicon/apple-touch-icon.png',
  'favicon/android-chrome-192x192.png',
  'favicon/android-chrome-512x512.png',
  'favicon/sela.svg',
  'favicon/site.webmanifest'
];

// CDN 函式庫（best-effort 預快取：醫院網路若封鎖 CDN，install 仍成功）
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js'
];

// ── install：預快取 ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      await cache.addAll(APP_SHELL);
      // CDN 逐一加入，失敗不影響安裝（封鎖 / 離線時降級為線上才載入）
      await Promise.allSettled(CDN_ASSETS.map((u) => cache.add(u)));
    }).then(() => self.skipWaiting())
  );
});

// ── activate：清掉舊版快取 ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── fetch：分流快取策略 ──
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // 坑 #13：非 GET（POST 體重、外部 API 寫入等）第一行就放行
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCDNLib = CDN_ASSETS.indexOf(url.href) !== -1;

  // 外部 API（天氣 open-meteo / 7timer、時間 timeapi、QR 產生器 qrserver）→ 放行走網路
  if (!sameOrigin && !isCDNLib) return;

  // CDN 函式庫：cache-first（離線可用）
  if (isCDNLib) {
    event.respondWith(
      caches.match(req).then((cached) =>
        cached || fetch(req).then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return resp;
        })
      )
    );
    return;
  }

  // 同源靜態：cache-first；ignoreSearch 讓 ?v=X.X.X 快取破壞參數仍命中（坑 #5）
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((resp) => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const copy = resp.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return resp;
      }).catch(() => {
        // 離線且未快取的導航請求 → 回首頁
        if (req.mode === 'navigate') return caches.match('index.html');
      });
    })
  );
});
