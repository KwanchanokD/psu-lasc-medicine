/* Service Worker — ระบบบริการยาและเวชภัณฑ์เพื่องานวิจัย PSU:LASC
   - HTML ดึงจากเครือข่ายเสมอ (bypass HTTP cache) เพื่อให้ได้เวอร์ชันล่าสุดทันทีที่อัปโหลดไฟล์ใหม่
   - ไฟล์อื่นใช้ network-first แล้ว fallback เป็น cache เมื่อออฟไลน์ */
const CACHE = 'psu-lasc-med-v6';
const ASSETS = [
  './',
  './index.html',
  './request.html',        /* แบบฟอร์มยื่นคำขอสำหรับนักวิจัย */
  './firebase-config.js',  /* ค่าเชื่อมต่อ Firebase ที่ทั้งสองหน้าใช้ร่วมกัน */
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './logo-medicine.png',   /* ตราสัญลักษณ์ระบบ — หัวแอปและหน้าเข้าสู่ระบบ */
  './logo-lasc.png'        /* ตราสัญลักษณ์ศูนย์ฯ — หัวจดหมายและลายน้ำบนเอกสารที่พิมพ์ */
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* หน้าเว็บสั่งให้ service worker ตัวใหม่เริ่มทำงานทันทีเมื่อผู้ใช้กดปุ่มอัปเดต */
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const isHTML = e.request.mode === 'navigate' ||
    (e.request.headers.get('accept') || '').includes('text/html');

  e.respondWith(
    fetch(isHTML ? new Request(e.request.url, { cache: 'reload' }) : e.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(e.request).then((res) => {
          if (res) return res;
          if (isHTML) return caches.match('./index.html');
          return Response.error();
        })
      )
  );
});
