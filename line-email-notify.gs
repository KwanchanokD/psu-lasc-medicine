/**
 * ===========================================================================
 *  ตัวกลางแจ้งเตือนคำขอซื้อยาและเวชภัณฑ์ — ศูนย์บริการสัตว์ทดลอง ม.อ.
 *  Google Apps Script Web App
 * ===========================================================================
 *
 *  ทำหน้าที่รับข้อมูลคำขอจากแบบฟอร์ม request.html แล้วแจ้งเตือน 3 ทาง
 *    1. LINE Official Account  (broadcast ถึงทุกคนที่เป็นเพื่อนกับ OA)
 *    2. อีเมลถึงสัตวแพทย์
 *    3. บันทึกลง Google Sheets  (ถ้าตั้งค่า SHEET_ID ไว้ — ไม่บังคับ)
 *
 *  ทำไมต้องมีไฟล์นี้
 *  ----------------------------------------------------------------------
 *  Channel Access Token ของ LINE ห้ามฝังในหน้าเว็บ เพราะใครก็เปิดดูได้
 *  สคริปต์นี้รันบนเครื่องของ Google จึงเก็บ token ไว้ได้อย่างปลอดภัย
 *  และ Firebase แพ็กเกจฟรี (Spark) ส่งอีเมลเองไม่ได้ จึงใช้ตัวนี้ส่งแทน
 *
 *  การติดตั้ง — ดูขั้นตอนละเอียดพร้อมภาพในไฟล์ วิธีติดตั้ง-แจ้งเตือน.html
 *  ----------------------------------------------------------------------
 *   1. เปิด script.google.com → New project → วางโค้ดนี้ทั้งหมด
 *   2. แก้ค่าในฟังก์ชัน ตั้งค่าครั้งแรก() ด้านล่าง แล้วกดรันหนึ่งครั้ง
 *   3. Deploy → New deployment → Web app
 *        Execute as     : Me
 *        Who has access : Anyone
 *   4. คัดลอก Web app URL ไปใส่ใน firebase-config.js ที่ NOTIFY_WEBHOOK_URL
 *
 * ===========================================================================
 */

/* ---------------------------------------------------------------------------
 *  ตั้งค่าครั้งแรก — แก้ 4 ค่านี้ แล้วกด Run ฟังก์ชันนี้หนึ่งครั้ง
 *  ค่าจะถูกเก็บไว้ใน Script Properties ไม่ปรากฏในหน้าเว็บ
 * ------------------------------------------------------------------------ */
function ตั้งค่าครั้งแรก() {
  PropertiesService.getScriptProperties().setProperties({

    // Channel access token (long-lived) จาก LINE Developers Console
    LINE_TOKEN: 'วาง_CHANNEL_ACCESS_TOKEN_ที่นี่',

    // อีเมลที่จะรับแจ้งเตือน หลายคนคั่นด้วยจุลภาค เช่น 'a@psu.ac.th,b@psu.ac.th'
    VET_EMAIL: 'kwanchanok.d@psu.ac.th',

    // รหัสลับที่ต้องตรงกับค่า NOTIFY_SECRET ใน firebase-config.js
    // ตั้งเป็นอะไรก็ได้ที่เดายาก เช่น 'lasc-med-8f3kqz91'
    NOTIFY_SECRET: 'ตั้งรหัสลับของตัวเองที่นี่',

    // ไม่บังคับ — ถ้าต้องการบันทึกลง Google Sheets ให้ใส่ ID ของชีต
    // ID คือส่วนกลางของลิงก์ docs.google.com/spreadsheets/d/<<ID>>/edit
    // ไม่ใช้ก็เว้นเป็นค่าว่าง
    SHEET_ID: ''
  });
  Logger.log('บันทึกการตั้งค่าเรียบร้อยแล้ว');
}

const APP_URL = 'https://kwanchanokd.github.io/psu-lasc-medicine/';
const LEAD_DAYS = 14;   // เกณฑ์ยื่นล่วงหน้าตาม SOP MED101 ผังขั้นตอนข้อ 7

/* =========================================================================
 *  จุดรับข้อมูลจากแบบฟอร์ม
 * ====================================================================== */
function doPost(e) {
  try {
    const props = PropertiesService.getScriptProperties();
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    // ตรวจรหัสลับ กันคนนอกยิงข้อมูลขยะเข้ามา
    const secret = props.getProperty('NOTIFY_SECRET') || '';
    if (secret && body.secret !== secret) {
      return reply({ ok: false, error: 'unauthorized' });
    }

    // ตรวจความครบถ้วนขั้นต่ำ กันข้อมูลผิดรูปแบบ
    if (!body.ref || !body.name) {
      return reply({ ok: false, error: 'missing required fields' });
    }

    const result = { ok: true, ref: body.ref, line: 'skipped', mail: 'skipped', sheet: 'skipped' };

    try { result.line  = sendLine(body, props); }  catch (err) { result.line  = 'error: ' + err.message; }
    try { result.mail  = sendMail(body, props); }  catch (err) { result.mail  = 'error: ' + err.message; }
    try { result.sheet = appendSheet(body, props); } catch (err) { result.sheet = 'error: ' + err.message; }

    return reply(result);

  } catch (err) {
    return reply({ ok: false, error: String(err) });
  }
}

/* หน้าตรวจสอบว่า Web App ทำงานอยู่ — เปิด URL ด้วยเบราว์เซอร์จะเห็นข้อความนี้ */
function doGet() {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:Sarabun,Tahoma,sans-serif;padding:24px;line-height:1.8">' +
    '<h2 style="color:#0a5f4e">✅ ตัวกลางแจ้งเตือนทำงานปกติ</h2>' +
    '<p>ระบบบริการยาและเวชภัณฑ์ ศูนย์บริการสัตว์ทดลอง มหาวิทยาลัยสงขลานครินทร์</p>' +
    '<p style="color:#7f8c8d;font-size:14px">หน้านี้ใช้ตรวจสอบสถานะเท่านั้น ' +
    'การแจ้งเตือนจริงทำงานผ่านการส่งข้อมูลแบบ POST จากแบบฟอร์มยื่นคำขอ</p></div>'
  );
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* =========================================================================
 *  ตัวช่วยจัดรูปแบบ
 * ====================================================================== */
const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function thDate(iso) {
  if (!iso) return '-';
  const p = String(iso).split('-');
  if (p.length !== 3) return String(iso);
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  if (isNaN(d.getTime())) return String(iso);
  return d.getDate() + ' ' + TH_MONTHS[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}

function dayDiff(a, b) {
  if (!a || !b) return null;
  const pa = String(a).split('-'), pb = String(b).split('-');
  const da = new Date(+pa[0], +pa[1] - 1, +pa[2]);
  const db = new Date(+pb[0], +pb[1] - 1, +pb[2]);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return null;
  return Math.round((db - da) / 86400000);
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function itemList(body) {
  return (body.items || []).map(function (it, i) {
    return (i + 1) + '. ' + it.name +
      (it.strength ? ' (' + it.strength + ')' : '') +
      ' — ' + it.qty + ' ' + (it.unit || '');
  });
}

function leadOf(body) {
  return dayDiff(String(body.createdAt || '').slice(0, 10), body.startUse);
}

/* =========================================================================
 *  1. แจ้งเตือนทาง LINE Official Account
 *     ใช้ broadcast จึงส่งถึงทุกคนที่เป็นเพื่อนกับ OA โดยไม่ต้องรู้ user id
 * ====================================================================== */
function sendLine(body, props) {
  const token = props.getProperty('LINE_TOKEN');
  if (!token || token.indexOf('วาง_') === 0) return 'skipped (ยังไม่ได้ตั้ง LINE_TOKEN)';

  const lead = leadOf(body);
  const lines = [
    '🔔 คำขอซื้อยาและเวชภัณฑ์ใหม่',
    '────────────────────',
    'รหัสอ้างอิง ' + body.ref,
    '',
    '👤 ' + body.name,
    '🏛 ' + (body.org || '-'),
    '📞 ' + (body.phone || '-'),
    '📅 เริ่มใช้ยา ' + thDate(body.startUse) +
      (lead != null ? ' (อีก ' + lead + ' วัน)' : ''),
    '',
    '💊 รายการที่ขอ',
  ].concat(itemList(body));

  if (lead != null && lead < LEAD_DAYS) {
    lines.push('', '⚠️ ยื่นล่วงหน้าเพียง ' + lead + ' วัน');
    lines.push('น้อยกว่าเกณฑ์ SOP 6.1 (' + LEAD_DAYS + ' วัน)');
  }
  if (body.note) lines.push('', '📝 ' + body.note);

  lines.push('', '────────────────────', 'เปิดระบบเพื่อตรวจสอบ', APP_URL);

  const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify({
      messages: [{ type: 'text', text: lines.join('\n').slice(0, 4900) }]
    }),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  return (code === 200) ? 'sent' : 'http ' + code + ' ' + res.getContentText().slice(0, 200);
}

/* =========================================================================
 *  2. แจ้งเตือนทางอีเมล
 * ====================================================================== */
function sendMail(body, props) {
  const to = props.getProperty('VET_EMAIL');
  if (!to) return 'skipped (ยังไม่ได้ตั้ง VET_EMAIL)';

  const lead = leadOf(body);
  const TD = 'border:1px solid #999;padding:5px 9px';
  const rows = (body.items || []).map(function (it, i) {
    return '<tr>' +
      '<td style="' + TD + ';text-align:center">' + (i + 1) + '</td>' +
      '<td style="' + TD + '"><b>' + esc(it.name) + '</b></td>' +
      '<td style="' + TD + '">' + esc(it.strength || '-') + '</td>' +
      '<td style="' + TD + ';text-align:right">' + esc(it.qty) + '</td>' +
      '<td style="' + TD + '">' + esc(it.unit || '-') + '</td>' +
      '<td style="' + TD + '">' + esc(it.note || '') + '</td></tr>';
  }).join('');

  const warn = (lead != null && lead < LEAD_DAYS)
    ? '<div style="background:#fdecea;border:1px solid #f5c6cb;color:#9c0006;' +
      'padding:10px 14px;border-radius:8px;margin:12px 0">' +
      '<b>⚠ ยื่นล่วงหน้าเพียง ' + lead + ' วัน</b> — น้อยกว่าเกณฑ์ที่ SOP 6.1 กำหนด (' +
      LEAD_DAYS + ' วัน) อาจจัดหายาไม่ทันวันเริ่มการทดลอง</div>'
    : '';

  const kv = function (k, v) {
    return '<tr><td style="' + TD + ';background:#f4f6f9;width:190px">' + k +
           '</td><td style="' + TD + '">' + v + '</td></tr>';
  };

  const html =
    '<div style="font-family:Sarabun,Tahoma,sans-serif;font-size:14px;color:#2c3e50;max-width:720px">' +
    '<h2 style="color:#0a5f4e;font-size:18px;margin:0 0 4px">มีคำขอซื้อยาและเวชภัณฑ์ใหม่</h2>' +
    '<p style="margin:0 0 12px;color:#7f8c8d">รหัสอ้างอิง ' +
      '<b style="color:#0a5f4e;letter-spacing:1px">' + esc(body.ref) + '</b></p>' +
    warn +
    '<table style="border-collapse:collapse;width:100%;font-size:13.5px">' +
    kv('นักวิจัยผู้สั่งซื้อยา', esc(body.name)) +
    kv('หน่วยงาน / คณะ', esc(body.org || '-')) +
    kv('เลขที่ใบอนุญาตใช้สัตว์ทดลอง', esc(body.license || '-')) +
    kv('ติดต่อ', esc(body.phone || '-') + ' · ' + esc(body.email || '-')) +
    kv('งานวิจัย', esc(body.studyNo || '-') +
       (body.studyTitle ? ' · ' + esc(body.studyTitle) : '')) +
    (body.animals ? kv('สัตว์ทดลองที่ใช้', esc(body.animals)) : '') +
    kv('วันที่ยื่น', esc(thDate(String(body.createdAt || '').slice(0, 10)))) +
    kv('วันที่เริ่มใช้ยา', esc(thDate(body.startUse)) +
       (lead != null ? ' (ล่วงหน้า ' + lead + ' วัน)' : '')) +
    (body.tax ? kv('ออกใบเสร็จในนาม', esc(body.bill || body.name) +
       ' · เลขผู้เสียภาษี ' + esc(body.tax)) : '') +
    (body.note ? kv('หมายเหตุจากผู้ขอ', esc(body.note)) : '') +
    '</table>' +
    '<h3 style="color:#0a5f4e;font-size:15px;margin:16px 0 6px">รายการยาที่ขอ</h3>' +
    '<table style="border-collapse:collapse;width:100%;font-size:13.5px">' +
    '<tr style="background:#e5f4f0">' +
    '<th style="' + TD + ';width:34px">ที่</th>' +
    '<th style="' + TD + ';text-align:left">ชื่อยา</th>' +
    '<th style="' + TD + ';text-align:left">ความเข้มข้น</th>' +
    '<th style="' + TD + '">จำนวน</th>' +
    '<th style="' + TD + ';text-align:left">หน่วย</th>' +
    '<th style="' + TD + ';text-align:left">หมายเหตุ</th></tr>' +
    rows + '</table>' +
    '<p style="margin:18px 0 0"><a href="' + APP_URL + '" ' +
      'style="background:#0e7c66;color:#fff;text-decoration:none;padding:10px 20px;' +
      'border-radius:8px;display:inline-block;font-weight:600">' +
      'เปิดระบบเพื่อตรวจสอบและรับเข้าระบบ</a></p>' +
    '<p style="font-size:12.5px;color:#7f8c8d;margin-top:10px">' +
      'คำขอนี้ยังไม่เข้าทะเบียนจนกว่าจะกด “รับเข้าระบบ” ในแท็บ “คำขอเข้าใหม่”</p>' +
    '<p style="font-size:12px;color:#7f8c8d;border-top:1px solid #dfe6ee;' +
      'padding-top:8px;margin-top:18px">' +
      'ส่งอัตโนมัติจากระบบบริการยาและเวชภัณฑ์ ศูนย์บริการสัตว์ทดลอง ' +
      'มหาวิทยาลัยสงขลานครินทร์ ตาม SOP MED101</p></div>';

  const subject = '📥 คำขอซื้อยาใหม่ ' + body.ref + ' — ' + body.name +
    ((lead != null && lead < LEAD_DAYS) ? ' [ยื่นกระชั้น ' + lead + ' วัน]' : '');

  MailApp.sendEmail({
    to: to,
    subject: subject,
    htmlBody: html,
    name: 'ระบบบริการยาและเวชภัณฑ์ PSU:LASC'
  });
  return 'sent to ' + to;
}

/* =========================================================================
 *  3. บันทึกลง Google Sheets (ไม่บังคับ)
 *     คอลัมน์เรียงตามชีททะเบียนเดิมของหน่วยงาน
 * ====================================================================== */
function appendSheet(body, props) {
  const id = props.getProperty('SHEET_ID');
  if (!id) return 'skipped (ไม่ได้ตั้ง SHEET_ID)';

  const ss = SpreadsheetApp.openById(id);
  let sh = ss.getSheetByName('คำขอ');
  if (!sh) {
    sh = ss.insertSheet('คำขอ');
    sh.appendRow([
      'รหัสอ้างอิง', 'วันที่ยื่น', 'ชื่อ-นามสกุล', 'หน่วยงาน',
      'เลขที่ใบอนุญาตใช้สัตว์ทดลอง', 'โทรศัพท์', 'อีเมล',
      'เลขที่งานวิจัย', 'ชื่องานวิจัย', 'สัตว์ทดลอง',
      'วันที่เริ่มใช้ยา', 'ล่วงหน้า (วัน)', 'รายการยา', 'จำนวน', 'หมายเหตุ'
    ]);
    sh.getRange(1, 1, 1, 15).setFontWeight('bold').setBackground('#e5f4f0');
    sh.setFrozenRows(1);
  }

  const items = body.items || [];
  sh.appendRow([
    body.ref,
    thDate(String(body.createdAt || '').slice(0, 10)),
    body.name || '', body.org || '', body.license || '',
    body.phone || '', body.email || '',
    body.studyNo || '', body.studyTitle || '', body.animals || '',
    thDate(body.startUse),
    leadOf(body),
    items.map(function (i) { return i.name; }).join(' / '),
    items.map(function (i) { return i.qty + ' ' + (i.unit || ''); }).join(' / '),
    body.note || ''
  ]);
  return 'appended';
}

/* =========================================================================
 *  ทดสอบ — กด Run ฟังก์ชันนี้เพื่อส่งข้อมูลตัวอย่างโดยไม่ต้องกรอกฟอร์มจริง
 * ====================================================================== */
function ทดสอบการแจ้งเตือน() {
  const props = PropertiesService.getScriptProperties();
  const today = new Date();
  const iso = function (d) {
    return d.getFullYear() + '-' +
      ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  };
  const soon = new Date(today.getTime() + 5 * 86400000);

  const demo = {
    ref: 'REQ-' + iso(today).replace(/-/g, '') + '-TEST',
    createdAt: today.toISOString(),
    name: 'อ.ทดสอบ ระบบ',
    org: 'คณะวิทยาศาสตร์ ภาควิชาชีววิทยา',
    license: '2569-SCI06-013',
    phone: '081-000-0000',
    email: 'test@psu.ac.th',
    studyNo: 'S-TEST-01',
    studyTitle: 'โครงการทดสอบระบบแจ้งเตือน',
    animals: 'หนูแรท Wistar 24 ตัว',
    startUse: iso(soon),
    items: [
      { name: 'Isoflurane', strength: '250 mL', qty: '2', unit: 'ขวด', note: '' },
      { name: 'Thiopental sodium', strength: '20 mL', qty: '1', unit: 'ขวด', note: 'ต้องการด่วน' }
    ],
    note: 'ข้อความทดสอบ — ลบทิ้งได้'
  };

  Logger.log('LINE  : ' + (function () { try { return sendLine(demo, props); }  catch (e) { return 'error ' + e.message; } })());
  Logger.log('MAIL  : ' + (function () { try { return sendMail(demo, props); }  catch (e) { return 'error ' + e.message; } })());
  Logger.log('SHEET : ' + (function () { try { return appendSheet(demo, props); } catch (e) { return 'error ' + e.message; } })());
}
