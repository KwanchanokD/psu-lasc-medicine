/* =====================================================================
   การตั้งค่าเชื่อมต่อ Firebase — ไฟล์เดียวที่ใช้ร่วมกันทั้งระบบ
   ใช้โดย  index.html  (ระบบหลักของสัตวแพทย์)
          request.html (แบบฟอร์มยื่นคำขอของนักวิจัย)

   ───────────────────────────────────────────────────────────────────
   สถานะปัจจุบัน: ใช้โปรเจกต์ psu-lasc-medicine ซึ่งแยกเฉพาะระบบยาแล้ว
   บัญชีผู้ใช้ กฎความปลอดภัย และข้อมูล แยกขาดจากระบบใบเสนอราคา
   และระบบตรวจติดตามการดำเนินการต่อสัตว์ฯ

   ขั้นตอนด้านล่างเก็บไว้อ้างอิง หากต้องตั้งค่าใหม่หรือย้ายโปรเจกต์ในอนาคต
   (คู่มือฉบับเต็มพร้อมภาพ: เปิดไฟล์ วิธีติดตั้ง-firebase.html)
   ───────────────────────────────────────────────────────────────────
   1. สร้างโปรเจกต์ใหม่ที่ https://console.firebase.google.com
      ตั้งชื่อเช่น  psu-lasc-medicine
   2. เปิดใช้งาน 2 บริการ
         Build → Authentication → Sign-in method → เปิด Email/Password
         Build → Realtime Database → Create Database → เลือก Singapore
                 (asia-southeast1) → Start in locked mode
   3. Project settings (ไอคอนเฟือง) → เลื่อนลงหา Your apps → กดไอคอน </>
      ตั้งชื่อแอปว่า  psu-lasc-medicine → Register app
   4. คัดลอกค่าใน firebaseConfig ที่ Firebase แสดงให้ มาวางทับค่าด้านล่างนี้
      ให้ครบทุกบรรทัด โดยเฉพาะ databaseURL ซึ่งบางครั้งไม่แสดงในหน้านั้น
      หาได้จากหน้า Realtime Database (ข้อความด้านบนของตาราง)
   5. Authentication → Settings → Authorized domains → Add domain
      ใส่  kwanchanokd.github.io
   6. วางกฎความปลอดภัยจากไฟล์ firebase-rules.json ที่
      Realtime Database → Rules → Publish
   7. Authentication → Users → Add user  สร้างบัญชีสัตวแพทย์พร้อมรหัสผ่าน
      แล้วคัดลอก User UID ไปเพิ่มใต้ allowed ในหน้า Realtime Database → Data
      (ดูขั้นตอนละเอียดในไฟล์ README.md)
   8. อัปโหลดไฟล์นี้ขึ้น GitHub ทับไฟล์เดิม

   ไม่ต้องแก้ index.html หรือ request.html — ทั้งสองไฟล์อ่านค่าจากที่นี่
   ───────────────────────────────────────────────────────────────────
   หมายเหตุด้านความปลอดภัย: ค่าชุดนี้ไม่ใช่ความลับ Firebase ออกแบบมาให้
   ฝังในหน้าเว็บได้ สิ่งที่ปกป้องข้อมูลจริง ๆ คือกฎใน firebase-rules.json
   ===================================================================== */

/* โปรเจกต์ PSU-LASC-Medicine — แยกเฉพาะระบบบริการยาและเวชภัณฑ์
   ตั้งค่าเมื่อ 5 ตุลาคม 2569 · ฐานข้อมูลอยู่ที่สิงคโปร์ (asia-southeast1) */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyAFTiwHtxXZP5_3dcfHUPFbMrp-VlvLces",
  authDomain: "psu-lasc-medicine.firebaseapp.com",
  databaseURL: "https://psu-lasc-medicine-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "psu-lasc-medicine",
  storageBucket: "psu-lasc-medicine.firebasestorage.app",
  messagingSenderId: "424344018804",
  appId: "1:424344018804:web:b2a144000db6752e349621"
};

/* เส้นทางที่เก็บข้อมูลของระบบยาในฐานข้อมูล
   คงไว้เป็น data/medicine เพื่อให้ใช้ได้ทั้งแบบโปรเจกต์ร่วมและโปรเจกต์แยก
   ถ้าเปลี่ยนค่านี้ ต้องแก้ firebase-rules.json ให้ตรงกันด้วย */
window.MEDICINE_ROOT = 'data/medicine';

/* ที่อยู่ของระบบเมื่อเผยแพร่แล้ว — ใช้ในข้อความแจ้งเตือนและลิงก์แบบฟอร์ม */
window.MEDICINE_APP_URL = 'https://kwanchanokd.github.io/psu-lasc-medicine/';

/* ---------------------------------------------------------------------------
   การแจ้งเตือนอัตโนมัติเมื่อมีคำขอใหม่ (LINE OA + อีเมล)
   ---------------------------------------------------------------------------
   ปล่อยว่างทั้งคู่ = ไม่แจ้งเตือน ระบบยังทำงานครบทุกอย่างตามปกติ
   สัตวแพทย์ยังเห็นคำขอในแท็บ “คำขอเข้าใหม่” เสมอ

   วิธีเปิดใช้งาน (ดูขั้นตอนละเอียดในไฟล์ วิธีติดตั้ง-แจ้งเตือน.html)
     1. สร้าง LINE Official Account และเปิด Messaging API
     2. นำโค้ดในไฟล์ line-email-notify.gs ไปวางที่ script.google.com
        แล้ว Deploy เป็น Web app
     3. นำ Web app URL มาใส่ที่ NOTIFY_WEBHOOK_URL ด้านล่าง
     4. ตั้ง NOTIFY_SECRET ให้ตรงกับค่าที่ใส่ในสคริปต์

   หมายเหตุ: รหัสลับนี้กันการยิงข้อมูลขยะเข้ามาเท่านั้น ไม่ใช่กุญแจของ LINE
   กุญแจจริงของ LINE เก็บอยู่ฝั่ง Google Apps Script ไม่ปรากฏในหน้าเว็บ
   ------------------------------------------------------------------------ */
window.NOTIFY_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxHL0rQzMmqNn5rYg_SUNiaKmvAYDat2QVApmlBZx-wH9duThEQZIWLmia0wiyvLj8bGw/exec';
window.NOTIFY_SECRET = 'lasc-med-7k2pq9xw';
