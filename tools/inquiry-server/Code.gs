/**
 * 홈로취케어 홈페이지 서버 (구글 앱스스크립트).  설정 방법: README.md  /  보안 설명: SECURITY.md
 *  - 고객 문의·후기 접수(구글 시트에 저장) · 사장님 관리자 화면(admin/)용 API
 *  - 후기·갤러리·공지·서비스지역·디자인(색상)·홈 구성을 관리자 화면에서 고치면 홈페이지에 반영
 * 비밀번호는 코드에 적지 않고 [프로젝트 설정 → 스크립트 속성]의 ADMIN_PASSWORD 에 넣습니다.
 */
var NOTIFY_EMAIL = "pestzero1@gmail.com";            // 새 문의·보안 경고를 메일로 받을 본인 메일 주소(권장). 비우면 시트에만 쌓입니다.
var SHEET_INQ = "문의", SHEET_REV = "후기대기", SHEET_CONTENT = "콘텐츠", SHEET_LOG = "기록", SHEET_BLOCK = "차단목록", SHEET_PRICE = "가격표";
var MAX = 2000;                   // 글자 수 제한
var SESSION_SEC = 6 * 3600;       // 로그인 유지 시간(6시간)
var STATUSES = ["신규", "상담중", "완료", "보류", "스팸"];
var INQ_HEAD = ["접수번호", "접수시각", "종류", "서비스", "성함", "연락처", "내용", "페이지", "상태", "메모", "처리시각", "IP"];
var REV_HEAD = ["번호", "접수시각", "성함", "연락처", "별점", "내용", "상태", "IP"];
var BLOCK_HEAD = ["IP", "차단시각", "사유"];
var LOG_HEAD = ["시각", "구분", "내용"];
var POW_BITS = 15;                // 스팸 방지 퀴즈 난이도(접수 1건당 휴대폰에서 약 0.3~1초). 올리면 스팸 비용이 커집니다.
var TICKET_MIN_MS = 2500, TICKET_MAX_MS = 2 * 3600 * 1000;   // 접수 표는 발급 2.5초 후~2시간 안에 한 번만 사용 가능
var SPAM_WORDS = /카지노|바카라|토토|먹튀|도박|슬롯\s*머신|불법\s*대출|대출\s*상담|비아그라|시알리스|야동|성인\s*용품|출장\s*안마|주식\s*리딩|코인\s*리딩|리딩방|텔레그램|텔레\s*@|톡방\s*입장|casino|viagra|cialis|backlink|seo\s*service|loan\s*offer|crypto\s*invest/i;   // 광고·사기 글에 자주 나오는 단어(필요하면 추가)
var MAX_ROWS = 20000;             // 시트가 이 이상 쌓이면 새 접수를 막습니다(폭주 방지)
var LIMITS = { inq: [40, 600], rev: [10, 600], tk: [200, 600], ev: [300, 600] };   // [최대 건수, 기준 시간(초)] — 이 시간 안에 이 건수를 넘으면 접수 거절

function doGet(e) {
  var a = e && e.parameter && e.parameter.action;
  if (a === "public") return json(publicData());
  if (a === "ticket") return json(newTicket());
  if (a === "price") return json(publicPrice());
  if (a === "info") return json(info());
  if (a === "blocklist") return json(blocklistFor(e));
  return text("홈로취케어 서버 작동 중");
}

function doPost(e) {
  try {
    var raw = (e.postData && e.postData.contents) || "";
    if (raw.length > 6 * 1024 * 1024) return json({ ok: false, error: "size" });
    var p = JSON.parse(raw || "{}");
    var act = p.action || (p.type ? "inquiry" : "");
    switch (act) {
      case "public": return json(publicData());
      case "ticket": return json(newTicket());
      case "price": return json(publicPrice());
      case "info": return json(info());
      case "inquiry": return json(addInquiry(p));
      case "review_submit": return json(addReview(p));
      case "login": return json(login(p));
      case "evt": return json(evt(p));
    }
    if (!checkToken(p.token)) return json({ ok: false, error: "auth" });
    switch (act) {
      case "logout": CacheService.getScriptCache().remove("t_" + p.token); return json({ ok: true });
      case "inq_list": return json(inqList());
      case "inq_update": return json(inqUpdate(p));
      case "inq_delete": audit("삭제", "문의 " + cut(p.id, 30)); return json(inqDelete(p));
      case "inq_purge": return json(inqPurge(p));
      case "rev_pending": return json(revPending());
      case "rev_decide": return json(revDecide(p));
      case "content_get": return json({ ok: true, content: readContent(), hasBackup: !!backupRaw() });
      case "content_set": return json(contentSet(p));
      case "content_restore": return json(contentRestore());
      case "upload": return json(upload(p));
      case "password_change": return json(passwordChange(p));
      case "audit_list": return json(auditList());
      case "price_set": return json(priceSet(p));
      case "price_reset": return json(priceReset(p));
      case "notify_status": return json(notifyStatus());
      case "notify_test": return json(notifyTest());
      case "stats": return json(statsGet());
      case "ip_block": return json(ipBlock(p));
      case "ip_unblock": return json(ipUnblock(p));
      case "ip_list": return json(ipList());
      case "ip_purge": return json({ ok: true, cleared: purgeIps(p.days) });
    }
    return json({ ok: false, error: "unknown" });
  } catch (err) {
    return json({ ok: false, error: "server" });
  }
}

// ---------- 공통 ----------
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function text(t) { return ContentService.createTextOutput(t); }
function cut(v, n) { return String(v == null ? "" : v).slice(0, n || MAX); }
// 시트에서 수식으로 실행되지 않게(=, +, -, @ 로 시작하는 글) 앞에 ' 를 붙여 글자로만 저장
function cell(v, n) { var s = cut(v, n); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
function sheet(name, head) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (head) sh.appendRow(head); }
  else if (head && sh.getLastRow() === 0) sh.appendRow(head);
  else if (head && String(sh.getRange(1, head.length).getValue() || "") !== head[head.length - 1]) sh.getRange(1, 1, 1, head.length).setValues([head]);   // 새 칸(IP 등)이 생기면 머리글 보강
  return sh;
}
function newId(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
function notifyEmail() { return NOTIFY_EMAIL || PropertiesService.getScriptProperties().getProperty("NOTIFY_EMAIL") || ""; }   // 코드에 적거나, 스크립트 속성 NOTIFY_EMAIL 에 넣어도 됩니다(속성이 공개 저장소에 안 남아 권장)
function mail(subject, body) { var to = notifyEmail(); if (to) { try { MailApp.sendEmail(to, subject, body); } catch (x) {} } }
// 일정 시간 안에 너무 많이 들어오면 막기 (스팸·도배 방지)
function allow(kind) {
  var c = CacheService.getScriptCache(), k = "rl_" + kind, n = Number(c.get(k) || 0), lim = LIMITS[kind];
  if (n >= lim[0]) return false;
  c.put(k, String(n + 1), lim[1]);
  return true;
}
function audit(kind, note) { try { sheet(SHEET_LOG, LOG_HEAD).appendRow([new Date(), kind, cell(note, 300)]); } catch (e) {} }

// ---------- 스팸 방지: 접수 표(서명) + 간단한 계산 퀴즈 ----------
// 접수하려면 ① 서버가 발급한 표(서명됨)를 먼저 받고 ② 휴대폰·PC가 짧은 계산 퀴즈를 풀어야 합니다. 표는 한 번만, 발급 2.5초 후부터 쓸 수 있습니다.
// 사람에게는 눈에 띄지 않지만, 자동 프로그램이 대량으로 보내려면 건마다 시간과 계산이 듭니다.
function secret() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty("TICKET_SECRET");
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty("TICKET_SECRET", s); }
  return s;
}
function hexOf(bytes) { var o = ""; for (var i = 0; i < bytes.length; i++) o += ("0" + (bytes[i] & 255).toString(16)).slice(-2); return o; }
function sha256hex(s) { return hexOf(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8)); }
function ticketSig(t) { return hexOf(Utilities.computeHmacSha256Signature(String(t), secret())); }
function newTicket() {
  if (!allow("tk")) return { ok: false, error: "busy" };
  var t = Date.now();
  return { ok: true, t: t, sig: ticketSig(t), bits: POW_BITS };
}
function zeroBits(h) { var n = 0; for (var i = 0; i < h.length; i++) { var v = parseInt(h.charAt(i), 16); if (v === 0) { n += 4; continue; } n += v < 2 ? 3 : v < 4 ? 2 : v < 8 ? 1 : 0; break; } return n; }
function checkTicket(tk) {
  tk = tk || {};
  var t = Number(tk.t), age = Date.now() - t;
  if (!(age >= TICKET_MIN_MS && age <= TICKET_MAX_MS)) return false;
  if (String(tk.sig || "") !== ticketSig(t)) return false;
  var c = CacheService.getScriptCache();
  if (c.get("u_" + tk.sig)) return false;                                  // 한 번 쓴 표는 다시 못 씀
  if (zeroBits(sha256hex(t + ":" + tk.sig + ":" + String(tk.n == null ? "" : tk.n))) < POW_BITS) return false;
  c.put("u_" + tk.sig, "1", 7200);
  return true;
}

// ---------- 스팸 글 걸러내기(광고·링크·사기 문구) ----------
function spamReason(text, name) {
  var t = String(text || "") + " " + String(name || "");
  var urls = (t.match(/https?:\/\/|www\.|\.(com|net|kr|xyz|top|ru|cn)\b\/?/gi) || []).length;
  if (urls >= 2) return "링크 여러 개";
  if (SPAM_WORDS.test(t)) return "광고성 단어";
  if (/(.)\1{11,}/.test(t)) return "같은 글자 반복";
  if (String(text || "").length >= 20 && !/[가-힣]/.test(text)) return "한글 없음";
  if ((t.match(/[\u0400-\u04FF\u4E00-\u9FFF\u0E00-\u0E7F]/g) || []).length >= 8) return "외국 문자 다수";
  return "";
}

// ---------- 사장님 알림: 이메일 + 문자(SMS) ----------
// 새 문의가 접수되면 ① 이메일(NOTIFY_EMAIL) ② 문자(솔라피 SMS 서비스, 선택)로 알려 드립니다.
// 문자는 스크립트 속성에 SMS_API_KEY · SMS_API_SECRET · SMS_FROM(등록한 발신번호) · SMS_TO(받을 휴대폰)를 넣으면 켜집니다. (README.md 참고)
// 요금 폭주 방지: 하루 SMS_DAILY_MAX(기본 30)건까지만 보내고, 스팸으로 걸러진 문의는 알리지 않습니다.
function digitsOf(s) { return String(s || "").replace(/\D/g, ""); }
function smsBytes(s) { var n = 0; s = String(s); for (var i = 0; i < s.length; i++) n += s.charCodeAt(i) > 127 ? 2 : 1; return n; }   // 한글 2바이트
function smsTrim(s, max) { s = String(s); while (smsBytes(s) > max) s = s.slice(0, -1); return s; }
function smsConfig() {
  var p = PropertiesService.getScriptProperties();
  var c = { key: p.getProperty("SMS_API_KEY"), secret: p.getProperty("SMS_API_SECRET"), from: digitsOf(p.getProperty("SMS_FROM")), to: digitsOf(p.getProperty("SMS_TO")),
            max: Number(p.getProperty("SMS_DAILY_MAX") || 30), long: p.getProperty("SMS_LONG") === "1" };
  c.ok = !!(c.key && c.secret && c.from && c.to);
  return c;
}
function smsDayKey() { return "sms_" + new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10); }   // 한국 날짜 기준
function smsAuth(key, secret) {
  var date = new Date().toISOString(), salt = Utilities.getUuid().replace(/-/g, "");
  return "HMAC-SHA256 apiKey=" + key + ", date=" + date + ", salt=" + salt + ", signature=" + hexOf(Utilities.computeHmacSha256Signature(date + salt, secret));
}
function sendSms(text, force) {
  var c = smsConfig();
  if (!c.ok) return { ok: false, error: "not_configured" };
  var pr = PropertiesService.getScriptProperties(), dk = smsDayKey(), n = Number(pr.getProperty(dk) || 0);
  if (!force && n >= c.max) return { ok: false, error: "daily_limit" };
  var lng = c.long || smsBytes(text) > 90;
  var msg = { to: c.to, from: c.from, text: smsTrim(text, lng ? 1900 : 90), type: lng ? "LMS" : "SMS" };
  if (lng) msg.subject = "홈페이지 문의";
  try {
    var res = UrlFetchApp.fetch("https://api.solapi.com/messages/v4/send-many", { method: "post", contentType: "application/json", headers: { Authorization: smsAuth(c.key, c.secret) }, payload: JSON.stringify({ messages: [msg] }), muteHttpExceptions: true });
    var code = res.getResponseCode();
    if (code >= 200 && code < 300) { pr.setProperty(dk, String(n + 1)); return { ok: true, code: code }; }
    audit("문자 알림 실패", code + " " + cut(res.getContentText(), 120));
    return { ok: false, error: "provider", code: code };
  } catch (e) { audit("문자 알림 오류", cut(e && e.message, 120)); return { ok: false, error: "exception" }; }
}
function notifyInquiry(kind, name, svc, phone, msg, ip) {
  mail("[홈페이지 문의] " + cut(kind, 20) + " " + cut(name, 20), cut(svc, 60) + "\n" + cut(name, 40) + " " + phone + "\n" + cut(msg, 500) + (ip ? "\n(IP " + ip + ")" : ""));
  var c = smsConfig();
  if (c.ok) {
    var head = "[문의]" + cut(name, 10) + " " + cut(phone, 14) + " ", body = String(msg).replace(/\s+/g, " ");
    sendSms(c.long ? head + cut(body, 600) : smsTrim(head + body, 90));          // 기본은 단문(90바이트, 건당 약 18원)에 맞춰 내용 앞부분만 보냄
  }
}
function notifyStatus() {
  var c = smsConfig(), n = Number(PropertiesService.getScriptProperties().getProperty(smsDayKey()) || 0);
  return { ok: true, email: !!notifyEmail(), sms: c.ok, smsToday: n, smsMax: c.max, smsLong: c.long, smsTo: c.ok ? c.to.slice(0, 3) + "****" + c.to.slice(-4) : "" };
}
function notifyTest() {
  var cache = CacheService.getScriptCache(), k = "nt", n = Number(cache.get(k) || 0);
  if (n >= 3) return { ok: false, error: "busy" };
  cache.put(k, String(n + 1), 3600);
  mail("[홈페이지] 알림 시험", "이 메일이 보이면 이메일 알림이 정상입니다.");
  var r = sendSms("[홈페이지] 문자 알림 시험입니다.", true);
  audit("알림 시험", "이메일 " + (notifyEmail() ? "발송" : "미설정") + " / 문자 " + (r.ok ? "발송" : (r.error || "실패")));
  return { ok: true, email: !!notifyEmail(), sms: r };
}

// ---------- 방문자 통계(개인정보 없음): 전화·카카오톡·문자 버튼을 누른 횟수만 날짜별로 셉니다 ----------
// 접속 기기·IP·쿠키를 저장하지 않고, 하루·종류별 숫자 하나만 저장합니다. 외부 분석 서비스를 쓰지 않습니다.
var EVT_TYPES = { call: "전화", kakao: "카카오톡", sms: "문자" };
function statDay(offset) { return new Date(Date.now() + 9 * 3600 * 1000 - (offset || 0) * 86400000).toISOString().slice(0, 10); }
function evt(p) {
  var t = String(p.t || "");
  if (!EVT_TYPES[t]) return { ok: false, error: "bad" };
  if (!allow("ev")) return { ok: false, error: "busy" };
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(3000);
    var pr = PropertiesService.getScriptProperties(), k = "ev_" + statDay(0) + "_" + t;
    pr.setProperty(k, String(Number(pr.getProperty(k) || 0) + 1));
  } catch (e) { return { ok: false, error: "busy" }; } finally { try { lock.releaseLock(); } catch (e2) {} }
  return { ok: true };
}
function statsGet() {
  var all = PropertiesService.getScriptProperties().getProperties(), days = [], i, t, row;
  for (i = 0; i < 30; i++) {
    var d = statDay(i); row = { d: d };
    for (t in EVT_TYPES) row[t] = Number(all["ev_" + d + "_" + t] || 0);
    days.push(row);
  }
  return { ok: true, types: EVT_TYPES, days: days };
}
function statsPurge() {   // 60일 지난 통계 삭제(트리거로 가끔 실행하거나 직접 실행)
  var pr = PropertiesService.getScriptProperties(), all = pr.getProperties(), cut = statDay(60), n = 0;
  for (var k in all) { var m = /^ev_(\d{4}-\d{2}-\d{2})_/.exec(k); if (m && m[1] < cut) { pr.deleteProperty(k); n++; } }
  return n;
}

// ---------- 접속 IP 확인(게이트웨이를 쓸 때) · 차단 목록 ----------
// 구글 앱스스크립트는 접속자 IP를 알 수 없습니다. 그래서 Cloudflare 게이트웨이(tools/edge-gateway/)가 IP를 확인해 "서명"해서 전달합니다.
// GATEWAY_SECRET(스크립트 속성)을 설정하면 문의·후기는 게이트웨이를 통한 것만 받습니다(주소를 알아도 직접 보내는 프로그램은 거절).
function gwSecret() { return PropertiesService.getScriptProperties().getProperty("GATEWAY_SECRET") || ""; }
function checkGateway(gw) {
  var s = gwSecret(); gw = gw || {};
  var ts = Number(gw.ts), ip = String(gw.ip || "").slice(0, 64);
  if (!s || !ip || !(Math.abs(Date.now() - ts) <= 5 * 60 * 1000)) return "";
  if (String(gw.sig || "") !== hexOf(Utilities.computeHmacSha256Signature(ip + "|" + ts + "|" + String(gw.n || ""), s))) return "";
  var c = CacheService.getScriptCache();
  if (c.get("g_" + gw.sig)) return "";                                      // 한 번 쓴 서명은 재사용 불가
  c.put("g_" + gw.sig, "1", 600);
  return ip + (/^[A-Za-z]{2}$/.test(String(gw.cc || "")) ? " (" + String(gw.cc).toUpperCase() + ")" : "");
}
function blockedMap() {
  var c = CacheService.getScriptCache(), raw = c.get("blk");
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  var sh = sheet(SHEET_BLOCK, BLOCK_HEAD), n = sh.getLastRow(), m = {};
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).getValues().forEach(function (r) { if (r[0]) m[String(r[0])] = 1; });
  c.put("blk", JSON.stringify(m), 60);
  return m;
}
function ipOnly(s) { return String(s || "").split(" ")[0]; }
function ipBlock(p) {
  var ip = ipOnly(p.ip).slice(0, 64);
  if (!/^[0-9a-fA-F:.]{3,64}$/.test(ip)) return { ok: false, error: "ip" };
  var sh = sheet(SHEET_BLOCK, BLOCK_HEAD);
  if (findRow(sh, ip) < 0) sh.appendRow([ip, new Date(), cell(p.reason || "수동 차단", 100)]);
  CacheService.getScriptCache().remove("blk");
  audit("IP 차단", ip);
  return { ok: true };
}
function ipUnblock(p) {
  var sh = sheet(SHEET_BLOCK, BLOCK_HEAD), r = findRow(sh, ipOnly(p.ip));
  if (r > 0) sh.deleteRow(r);
  CacheService.getScriptCache().remove("blk");
  audit("IP 차단 해제", ipOnly(p.ip));
  return { ok: true };
}
function ipList() {
  var sh = sheet(SHEET_BLOCK, BLOCK_HEAD), n = sh.getLastRow(), out = [];
  if (n >= 2) sh.getRange(2, 1, n - 1, 3).getValues().forEach(function (r) { out.push({ ip: r[0], at: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), reason: r[2] }); });
  return { ok: true, items: out.reverse(), gateway: !!gwSecret() };
}
// 게이트웨이가 차단 목록을 받아 갈 때 쓰는 주소(서명 필요)
function blocklistFor(e) {
  var s = gwSecret(), ts = Number(e.parameter.ts || 0);
  if (!s || !(Math.abs(Date.now() - ts) <= 5 * 60 * 1000) || String(e.parameter.sig || "") !== hexOf(Utilities.computeHmacSha256Signature("blocklist|" + ts, s))) return { ok: false };
  return { ok: true, ips: Object.keys(blockedMap()) };
}
// 개인정보 보관기간: 지정한 일수가 지난 접수의 IP 기록을 지웁니다. (트리거로 매일 실행하거나 관리자 화면에서 실행)
function purgeIps(days) {
  var cutoff = new Date(Date.now() - Math.max(1, Number(days) || 90) * 86400000), cleared = 0;
  [[SHEET_INQ, INQ_HEAD], [SHEET_REV, REV_HEAD]].forEach(function (x) {
    var sh = sheet(x[0], x[1]), n = sh.getLastRow(), col = x[1].length;
    if (n < 2) return;
    var v = sh.getRange(2, 1, n - 1, col).getValues();
    for (var i = 0; i < v.length; i++) if (v[i][1] instanceof Date && v[i][1] < cutoff && v[i][col - 1]) { sh.getRange(i + 2, col).setValue(""); cleared++; }
  });
  audit("IP 기록 정리", cleared + "건");
  return cleared;
}
function purgeIpsDaily() { purgeIps(90); }

// ---------- 관리자 2단계 인증(선택): 구글 OTP 같은 인증 앱의 6자리 코드 ----------
function b32dec(s) {
  var al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bits = "", out = [];
  s = String(s || "").replace(/[\s=]/g, "").toUpperCase();
  for (var i = 0; i < s.length; i++) { var x = al.indexOf(s.charAt(i)); if (x >= 0) bits += ("00000" + x.toString(2)).slice(-5); }
  for (var j = 0; j + 8 <= bits.length; j += 8) { var b = parseInt(bits.substr(j, 8), 2); out.push(b > 127 ? b - 256 : b); }
  return out;
}
function totpAt(secretB32, counter) {
  var sg = function (b) { return b > 127 ? b - 256 : b; };
  var msg = [0, 0, 0, 0, sg((counter >>> 24) & 255), sg((counter >>> 16) & 255), sg((counter >>> 8) & 255), sg(counter & 255)];
  var sig = Utilities.computeHmacSha1Signature(msg, b32dec(secretB32));
  var off = sig[19] & 15;
  var bin = ((sig[off] & 127) << 24) | ((sig[off + 1] & 255) << 16) | ((sig[off + 2] & 255) << 8) | (sig[off + 3] & 255);
  return ("000000" + (bin % 1000000)).slice(-6);
}
function checkTotp(code) {
  var s = PropertiesService.getScriptProperties().getProperty("TOTP_SECRET");
  if (!s) return true;                                                     // 설정 전에는 비밀번호만
  code = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  var step = Math.floor(Date.now() / 30000), c = CacheService.getScriptCache();
  for (var d = -1; d <= 1; d++) {
    if (totpAt(s, step + d) === code) {
      if (c.get("tu_" + (step + d) + code)) return false;                  // 같은 코드 재사용 금지
      c.put("tu_" + (step + d) + code, "1", 180);
      return true;
    }
  }
  return false;
}
function info() { var pr = PropertiesService.getScriptProperties(); return { ok: true, totp: !!pr.getProperty("TOTP_SECRET"), gateway: !!pr.getProperty("GATEWAY_SECRET") }; }
// Apps Script 편집기에서 직접 한 번 실행하세요: 2단계 인증 켜기. (실행 후 [실행 로그]에 나오는 키를 인증 앱에 등록)
function setupTotp() {
  var h = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").slice(0, 40), al = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567", bits = "", s = "";
  for (var i = 0; i < h.length; i += 2) bits += ("00000000" + parseInt(h.substr(i, 2), 16).toString(2)).slice(-8);
  for (var j = 0; j + 5 <= bits.length; j += 5) s += al.charAt(parseInt(bits.substr(j, 5), 2));
  PropertiesService.getScriptProperties().setProperty("TOTP_SECRET", s);
  Logger.log("2단계 인증이 켜졌습니다.\n인증 앱(구글 OTP, Microsoft Authenticator 등)에서 [키 직접 입력]으로 아래 키를 등록하세요.\n키: " + s + "\n이 키는 다른 사람에게 보여주지 마세요. 등록 후 이 로그는 닫으세요.");
}
function disableTotp() { PropertiesService.getScriptProperties().deleteProperty("TOTP_SECRET"); Logger.log("2단계 인증을 껐습니다."); }

// ---------- 로그인 ----------
// 틀릴 때마다 응답을 늦추고(무차별 대입 방지), 5회 이상 틀리면 메일로 알립니다. 정상 사용자는 잠기지 않습니다.
function login(p) {
  var cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  var fails = Number(cache.get("fails") || 0);
  var pw = props.getProperty("ADMIN_PASSWORD");
  if (!pw) return { ok: false, error: "no_password" };
  if (!p.password || String(p.password) !== pw || !checkTotp(p.code)) {
    cache.put("fails", String(fails + 1), 900);
    Utilities.sleep(fails >= 4 ? 4000 : 1500);
    if (fails + 1 === 5 && !cache.get("alerted")) { cache.put("alerted", "1", 3600); mail("[홈페이지] 관리자 로그인 실패가 반복되고 있습니다", "최근 15분간 로그인 실패가 5회 이상 있었습니다. 본인이 아니라면 ADMIN_PASSWORD 를 바꾸세요."); }
    audit("로그인 실패", fails + 1 + "회째");
    return { ok: false, error: "bad_password" };
  }
  cache.remove("fails");
  var t = Utilities.getUuid() + Utilities.getUuid();
  cache.put("t_" + t, epoch(), SESSION_SEC);
  audit("로그인", "성공");
  return { ok: true, token: t };
}
function epoch() { return PropertiesService.getScriptProperties().getProperty("EPOCH") || "0"; }
function checkToken(t) { return !!t && CacheService.getScriptCache().get("t_" + t) === epoch(); }
function passwordChange(p) {
  var np = String(p.newPassword || "");
  if (np.length < 12) return { ok: false, error: "short" };
  var props = PropertiesService.getScriptProperties();
  if (String(p.oldPassword || "") !== props.getProperty("ADMIN_PASSWORD")) { Utilities.sleep(1500); return { ok: false, error: "bad_password" }; }
  props.setProperty("ADMIN_PASSWORD", np);
  props.setProperty("EPOCH", String(Number(epoch()) + 1));      // 다른 곳의 로그인은 모두 끊김
  audit("비밀번호 변경", "");
  mail("[홈페이지] 관리자 비밀번호가 변경되었습니다", "본인이 한 것이 아니라면 즉시 확인하세요.");
  return { ok: true, relogin: true };
}

// ---------- 문의 ----------
function gate(p, skipTicket) {           // 접수 자격 확인: 게이트웨이를 쓰면 게이트웨이 서명, 아니면 접수 표+계산 퀴즈. 통과하면 { ip } 반환
  if (skipTicket) return { ip: "" };
  if (gwSecret()) {
    var ip = checkGateway(p.gw);
    if (!ip) return { error: "gateway" };
    if (blockedMap()[ipOnly(ip)]) return { error: "blocked" };
    return { ip: ip };
  }
  return checkTicket(p.tk) ? { ip: "" } : { error: "ticket" };
}
function addInquiry(p, skipTicket) {
  var d = p.data || {};
  if (d.website) return { ok: true };                                    // 숨은 칸이 채워져 있으면 자동 스팸 → 조용히 무시
  if (!d.consent) return { ok: false, error: "consent" };
  var gt = gate(p, skipTicket);
  if (gt.error) return gt.error === "blocked" ? { ok: true } : { ok: false, error: gt.error };
  var msg = cut(d.msg || d.content), phone = cut(d.phone, 40);
  if (!msg.trim() && !phone.trim()) return { ok: false, error: "empty" };
  if (!skipTicket) {
    var why = spamReason(msg, (d.name || "") + " " + (d.svc || ""));
    if (why) { audit("스팸 차단", why + " " + gt.ip); return { ok: false, error: "content" }; }
  }
  var c = CacheService.getScriptCache(), dk = "d_" + hash(phone + "|" + msg);
  if (c.get(dk)) return { ok: true };                                    // 같은 내용을 연달아 보내면 한 번만
  var pk = "p_" + hash(phone.replace(/\D/g, "")), pn = Number(c.get(pk) || 0);
  if (phone.replace(/\D/g, "").length >= 7) { if (pn >= 5) return { ok: false, error: "busy" }; c.put(pk, String(pn + 1), 3600); }   // 같은 번호로 1시간에 5건까지
  if (!allow("inq")) return { ok: false, error: "busy" };
  var sh = sheet(SHEET_INQ, INQ_HEAD);
  if (sh.getLastRow() > MAX_ROWS) return { ok: false, error: "full" };
  c.put(dk, "1", 600);
  var id = newId("Q");
  sh.appendRow([id, new Date(), cell(p.type, 40), cell(d.svc || d.title, 100), cell(d.name || d.author, 40), cell(phone, 40), cell(msg), cell(p.page, 200), "신규", "", "", cell(gt.ip, 70)]);
  notifyInquiry(p.type, d.name || d.author, d.svc || d.title, phone, msg, gt.ip);
  return { ok: true };
}
function inqList() {
  var sh = sheet(SHEET_INQ, INQ_HEAD), n = sh.getLastRow();
  if (n < 2) return { ok: true, items: [] };
  var vals = sh.getRange(2, 1, n - 1, INQ_HEAD.length).getValues(), out = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    var r = vals[i];
    out.push({ id: r[0], at: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), type: r[2], svc: r[3], name: r[4], phone: r[5], msg: r[6], page: r[7], status: r[8] || "신규", memo: r[9], doneAt: r[10] instanceof Date ? r[10].toISOString() : String(r[10] || ""), ip: r[11] || "" });
  }
  return { ok: true, items: out };
}
function findRow(sh, id, col) {
  var n = sh.getLastRow(); if (n < 2) return -1;
  var ids = sh.getRange(2, col || 1, n - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 2;
  return -1;
}
function inqUpdate(p) {
  var sh = sheet(SHEET_INQ, INQ_HEAD), r = findRow(sh, p.id);
  if (r < 0) return { ok: false, error: "notfound" };
  if (STATUSES.indexOf(p.status) < 0) return { ok: false, error: "status" };
  var old = sh.getRange(r, 9).getValue();
  sh.getRange(r, 9, 1, 3).setValues([[p.status, cell(p.memo, 1000), p.status === "완료" ? (old === "완료" ? sh.getRange(r, 11).getValue() : new Date()) : ""]]);
  return { ok: true };
}
function inqDelete(p) {
  var sh = sheet(SHEET_INQ, INQ_HEAD), r = findRow(sh, p.id);
  if (r < 0) return { ok: false, error: "notfound" };
  sh.deleteRow(r);
  return { ok: true };
}
// 개인정보 보관기간 관리: 처리 완료된 문의 중 N개월 지난 것을 지웁니다.
function inqPurge(p) {
  var months = Math.max(1, Math.min(60, Number(p.months) || 12)), cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - months);
  var sh = sheet(SHEET_INQ, INQ_HEAD), n = sh.getLastRow(), del = 0;
  if (n >= 2) {
    var v = sh.getRange(2, 1, n - 1, INQ_HEAD.length).getValues();
    for (var i = v.length - 1; i >= 0; i--) {
      var done = v[i][10];
      if (v[i][8] === "완료" && done instanceof Date && done < cutoff) { sh.deleteRow(i + 2); del++; }
    }
  }
  audit("정리", months + "개월 지난 완료 문의 " + del + "건 삭제");
  return { ok: true, deleted: del };
}

// ---------- 후기 (고객 제출 → 사장님 승인 → 홈페이지 게시) ----------
function addReview(p, skipTicket) {
  var d = p.data || p;
  if (d.website) return { ok: true };
  if (!d.consent) return { ok: false, error: "consent" };
  var gt = gate(p, skipTicket);
  if (gt.error) return gt.error === "blocked" ? { ok: true } : { ok: false, error: gt.error };
  var text = cut(d.text, 600).trim(), name = cut(d.name, 20).trim();
  if (!text || !name) return { ok: false, error: "empty" };
  if (!skipTicket) {
    var why = spamReason(text, name);
    if (why) { audit("스팸 차단(후기)", why + " " + gt.ip); return { ok: false, error: "content" }; }
  }
  var c = CacheService.getScriptCache(), dk = "d_" + hash(name + "|" + text);
  if (c.get(dk)) return { ok: true };
  if (!allow("rev")) return { ok: false, error: "busy" };
  var sh = sheet(SHEET_REV, REV_HEAD);
  if (sh.getLastRow() > MAX_ROWS) return { ok: false, error: "full" };
  c.put(dk, "1", 600);
  var stars = Math.max(1, Math.min(5, Number(d.stars) || 5));
  sh.appendRow([newId("R"), new Date(), cell(name, 20), cell(d.phone, 40), stars, cell(text, 600), "대기", cell(gt.ip, 70)]);
  mail("[홈페이지] 새 후기가 도착했습니다", name + "\n" + text);
  return { ok: true };
}
function revPending() {
  var sh = sheet(SHEET_REV, REV_HEAD), n = sh.getLastRow(), out = [];
  if (n >= 2) {
    var v = sh.getRange(2, 1, n - 1, REV_HEAD.length).getValues();
    for (var i = v.length - 1; i >= 0; i--) if (v[i][6] === "대기") out.push({ id: v[i][0], at: v[i][1] instanceof Date ? v[i][1].toISOString() : String(v[i][1]), name: v[i][2], phone: v[i][3], stars: v[i][4], text: v[i][5], ip: v[i][7] || "" });
  }
  return { ok: true, items: out };
}
function revDecide(p) {
  var sh = sheet(SHEET_REV, REV_HEAD), r = findRow(sh, p.id);
  if (r < 0) return { ok: false, error: "notfound" };
  var v = sh.getRange(r, 1, 1, REV_HEAD.length).getValues()[0];
  if (p.approve) {
    var c = readContent(); c.reviews = c.reviews || [];
    c.reviews.unshift({ name: maskName(v[2]), area: cut(p.area, 30), stars: v[4], text: String(v[5]).replace(/^'/, "") });
    writeContent(c);
    sh.getRange(r, 7).setValue("게시");
    audit("후기 게시", cut(p.id, 30));
  } else sh.getRange(r, 7).setValue("거절");
  return { ok: true };
}
function maskName(n) { n = String(n || "").replace(/^'/, "").trim(); return n.length <= 1 ? n : n.charAt(0) + "○" + (n.length > 2 ? n.slice(2) : "") + " 고객님"; }

// ---------- 홈페이지에 반영되는 내용 ----------
function readContent() {
  var v = sheet(SHEET_CONTENT).getRange(1, 1).getValue();
  try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; }
}
function backupRaw() { return sheet(SHEET_CONTENT).getRange(2, 1).getValue(); }
function writeContent(c) {
  var sh = sheet(SHEET_CONTENT), prev = sh.getRange(1, 1).getValue();
  c.version = Date.now();
  var s = JSON.stringify(c);
  if (s.length > 45000) throw new Error("too big");
  if (prev) sh.getRange(2, 1).setValue(prev);                  // 저장 직전 상태를 한 단계 보관(되돌리기용)
  sh.getRange(1, 1).setValue(s);
}
function contentRestore() {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var b = backupRaw(); if (!b) return { ok: false, error: "nobackup" };
    var c = JSON.parse(b), cur = sheet(SHEET_CONTENT).getRange(1, 1).getValue();
    c.version = Date.now();
    sheet(SHEET_CONTENT).getRange(2, 1).setValue(cur);
    sheet(SHEET_CONTENT).getRange(1, 1).setValue(JSON.stringify(c));
    audit("되돌리기", "이전 저장 상태로 복원");
    return { ok: true };
  } finally { lock.releaseLock(); }
}
// 사진·링크 주소 검사: 우리 사이트 안의 사진(images/…)이거나 구글 드라이브에 올린 사진만 허용
function okImg(u) { u = String(u || ""); return u === "" || /^images\/[A-Za-z0-9_.\-\/가-힣]{1,120}$/.test(u) || /^https:\/\/lh3\.googleusercontent\.com\/d\/[A-Za-z0-9_\-]{10,80}(=w\d{2,4})?$/.test(u); }
function okLink(u) { u = String(u || ""); return u === "" || (/^(https?:\/\/[^\s<>"']+|\/[^\s<>"']*|[a-z0-9_.\-\/#]+)$/i.test(u) && !/^(javascript|data|vbscript):/i.test(u)); }
function okIg(u) { u = String(u || ""); return u === "" || /^https:\/\/(www\.)?instagram\.com\/[^\s"'<>]{1,200}$/i.test(u); }
function okYt(u) { u = String(u || ""); return u === "" || /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[^\s"'<>]{1,200}$/i.test(u); }
function okColor(c) { return /^#[0-9a-fA-F]{6}$/.test(String(c || "")); }
var HOME_SECTIONS = ["slider", "hero", "trust", "services", "quick", "why", "guarantee", "gallery", "shorts", "reviews", "about", "journal", "faq", "contact", "directory"];
var THEMES = ["blue", "navy", "warm"];
function cleanSlider(s) {
  var out = [];
  (Array.isArray(s && s.slides) ? s.slides : []).slice(0, 8).forEach(function (x) {
    if (!x) return;
    var imgs = (Array.isArray(x.images) ? x.images : []).slice(0, 3).filter(function (u) { return u && okImg(u); });
    out.push({ theme: THEMES.indexOf(x.theme) >= 0 ? x.theme : "blue", kicker: cut(x.kicker, 60), title: cut(x.title, 80), sub: cut(x.sub, 100), text: cut(x.text, 300),
      button: x.button && x.button.label && okLink(x.button.href) && x.button.href ? { label: cut(x.button.label, 40), href: cut(x.button.href, 300) } : null, images: imgs });
  });
  return { slides: out };
}
function cleanHero(h) {
  h = h || {};
  var tiles = (Array.isArray(h.tiles) ? h.tiles : []).slice(0, 8).map(function (t) { t = t || {}; return { label: cut(t.label, 30), image: okImg(t.image) ? cut(t.image, 250) : "" }; });
  return { badge: cut(h.badge, 40), kicker: cut(h.kicker, 40), deal: cut(h.deal, 60), title: cut(h.title, 40), highlight: cut(h.highlight, 40),
    bullets: (Array.isArray(h.bullets) ? h.bullets : []).slice(0, 5).map(function (b) { return cut(b, 100); }).filter(String), button1: cut(h.button1, 30), button2: cut(h.button2, 30), tiles: tiles };
}
function cleanWhy(a) {
  return (Array.isArray(a) ? a : []).slice(0, 6).filter(Boolean).map(function (x) { return { title: cut(x.title, 40), text: cut(x.text, 120), image: okImg(x.image) ? cut(x.image, 250) : "" }; });
}
function clean(arr, fields, max) {
  var out = [];
  (Array.isArray(arr) ? arr : []).slice(0, max || 100).forEach(function (x) {
    var o = {};
    fields.forEach(function (f) { o[f] = typeof x[f] === "number" ? x[f] : cut(x[f], f === "text" || f === "body" ? 1200 : 300); });
    if ("image" in o && !okImg(o.image)) o.image = "";
    out.push(o);
  });
  return out;
}
function publicData() {
  var c = readContent();
  return { ok: true, version: c.version || 0, reviews: c.reviews || null, gallery: c.gallery || null, areas: c.areas || null, banner: c.banner || null, notices: c.notices || [], theme: c.theme || null, layout: c.layout || null, social: c.social || null, shorts: c.shorts || null, slider: c.slider || null, hero: c.hero || null, why: c.why || null, faq: c.faq || null, trust: c.trust || null, services: c.services || null, hours: c.hours == null ? null : c.hours };
}
function contentSet(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var c = readContent(), n = p.content || {};
    if ("reviews" in n) c.reviews = clean(n.reviews, ["name", "area", "stars", "text"], 100);
    if ("gallery" in n) c.gallery = clean(n.gallery, ["image", "title", "area", "tag", "text"], 60);
    if ("areas" in n) c.areas = (Array.isArray(n.areas) ? n.areas : []).slice(0, 60).map(function (a) { return cut(a, 30); }).filter(String);
    if ("banner" in n) c.banner = n.banner && n.banner.text ? { text: cut(n.banner.text, 120), href: okLink(n.banner.href) ? cut(n.banner.href, 300) : "" } : null;
    if ("notices" in n) c.notices = clean(n.notices, ["title", "date", "body"], 100);
    if ("theme" in n) c.theme = n.theme && okColor(n.theme.brand) && okColor(n.theme.accent) ? { brand: n.theme.brand, accent: n.theme.accent } : null;
    if ("social" in n) { var s = n.social || {}; c.social = { instagram: okIg(s.instagram) ? cut(s.instagram, 250) : "", youtube: okYt(s.youtube) ? cut(s.youtube, 250) : "" }; }
    if ("shorts" in n) c.shorts = (Array.isArray(n.shorts) ? n.shorts : []).slice(0, 12).filter(function (v) { return v && /^[A-Za-z0-9_-]{11}$/.test(String(v.id || "")); }).map(function (v) { return { id: String(v.id), title: cut(v.title, 60) }; });
    if ("faq" in n) c.faq = n.faq ? (Array.isArray(n.faq) ? n.faq : []).slice(0, 30).filter(function (x) { return x && x.q; }).map(function (x) { return { q: cut(x.q, 120), a: cut(x.a, 800) }; }) : null;
    if ("trust" in n) c.trust = n.trust ? (Array.isArray(n.trust) ? n.trust : []).slice(0, 6).filter(function (x) { return x && x.value; }).map(function (x) { return { value: cut(x.value, 20), label: cut(x.label, 30) }; }) : null;
    if ("services" in n) c.services = n.services ? (Array.isArray(n.services) ? n.services : []).slice(0, 4).filter(Boolean).map(function (x) { return { tag: cut(x.tag, 10), name: cut(x.name, 30), image: okImg(x.image) ? cut(x.image, 250) : "", items: (Array.isArray(x.items) ? x.items : []).slice(0, 6).map(function (i) { return cut(i, 60); }).filter(String) }; }) : null;
    if ("hours" in n) c.hours = n.hours == null ? null : cut(n.hours, 80);
    if ("slider" in n) c.slider = n.slider ? cleanSlider(n.slider) : null;
    if ("hero" in n) c.hero = n.hero ? cleanHero(n.hero) : null;
    if ("why" in n) c.why = n.why ? cleanWhy(n.why) : null;
    if ("layout" in n) {
      var l = n.layout || {};
      c.layout = { order: (Array.isArray(l.order) ? l.order : []).filter(function (k, i, a) { return HOME_SECTIONS.indexOf(k) >= 0 && a.indexOf(k) === i; }), hidden: (Array.isArray(l.hidden) ? l.hidden : []).filter(function (k) { return HOME_SECTIONS.indexOf(k) >= 0; }) };
    }
    writeContent(c);
    audit("내용 저장", Object.keys(n).join(", "));
    return { ok: true, version: c.version };
  } finally { lock.releaseLock(); }
}

// ---------- 가격표(서비스단가표) 수정 ----------
// 페이지(slug)별로 바뀐 칸만 저장합니다. 방문자 화면에서는 기본 내용 위에 덧씌워 보입니다.
function readPrice() {
  var v = sheet(SHEET_PRICE).getRange(1, 1).getValue();
  try { return v ? JSON.parse(v) : { items: {} }; } catch (e) { return { items: {} }; }
}
function writePrice(d) {
  d.version = Date.now();
  var s = JSON.stringify(d);
  if (s.length > 45000) throw new Error("too big");
  sheet(SHEET_PRICE).getRange(1, 1).setValue(s);
}
function publicPrice() { var d = readPrice(); return { ok: true, version: d.version || 0, items: d.items || {} }; }
function cleanCell(c) {
  if (c && typeof c === "object") {
    var o = { t: cut(c.t, 400) };
    if (c.b) o.b = true;
    if (c.rs && Number(c.rs) > 1) o.rs = Math.min(9, Math.floor(Number(c.rs)));
    if (c.cs && Number(c.cs) > 1) o.cs = Math.min(9, Math.floor(Number(c.cs)));
    if (c.img && okImg(c.img)) o.img = String(c.img);
    return o;
  }
  return cut(c, 400);
}
function cleanPriceSection(s) {
  var o = { i: Math.max(0, Math.min(11, Math.floor(Number(s.i) || 0))) };
  ["heading", "lead", "afterNote", "footer"].forEach(function (k) { if (s[k] != null) o[k] = cut(s[k], 300); });
  ["notes", "bullets"].forEach(function (k) { if (Array.isArray(s[k])) o[k] = s[k].slice(0, 20).map(function (x) { return cut(x, 400); }).filter(String); });
  if (s.table && Array.isArray(s.table.head) && Array.isArray(s.table.rows)) {
    var t = { head: s.table.head.slice(0, 8).map(function (h) { return cut(h, 60); }), rows: s.table.rows.slice(0, 40).map(function (r) { return (Array.isArray(r) ? r : []).slice(0, 8).map(cleanCell); }) };
    if (s.table.caption != null) t.caption = cut(s.table.caption, 100);
    if (Array.isArray(s.table.boldCols)) t.boldCols = s.table.boldCols.slice(0, 8).map(function (n) { return Math.max(0, Math.min(7, Math.floor(Number(n) || 0))); });
    o.table = t;
  }
  return o;
}
function priceSet(p) {
  var slug = String(p.slug || "");
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return { ok: false, error: "slug" };
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var d = readPrice(); d.items = d.items || {};
    d.items[slug] = { sections: (Array.isArray(p.sections) ? p.sections : []).slice(0, 12).filter(Boolean).map(cleanPriceSection) };
    writePrice(d);
    audit("가격표 저장", slug);
    return { ok: true, version: d.version };
  } catch (e) { return { ok: false, error: "too_big" }; } finally { lock.releaseLock(); }
}
function priceReset(p) {
  var slug = String(p.slug || "");
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try { var d = readPrice(); if (d.items) delete d.items[slug]; writePrice(d); audit("가격표 기본값 복원", slug); return { ok: true }; } finally { lock.releaseLock(); }
}

// ---------- 사진 업로드 (구글 드라이브 폴더에 저장, 링크로 보기 가능) ----------
function sniff(b) {                                           // 파일 앞부분으로 진짜 이미지인지 확인
  if (b.length > 12 && (b[0] & 255) === 0xFF && (b[1] & 255) === 0xD8) return "image/jpeg";
  if (b.length > 8 && (b[0] & 255) === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return "image/png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return "";
}
function upload(p) {
  var bytes = Utilities.base64Decode(String(p.b64 || ""));
  if (bytes.length > 4 * 1024 * 1024) return { ok: false, error: "size" };
  var mime = sniff(bytes);
  if (!mime) return { ok: false, error: "type" };
  var it = DriveApp.getFoldersByName("홈페이지 사진"), folder = it.hasNext() ? it.next() : DriveApp.createFolder("홈페이지 사진");
  var f = folder.createFile(Utilities.newBlob(bytes, mime, "p" + Date.now() + (mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg")));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  audit("사진 업로드", "");
  return { ok: true, url: "https://lh3.googleusercontent.com/d/" + f.getId() + "=w1200" };
}

// ---------- 활동 기록 ----------
function auditList() {
  var sh = sheet(SHEET_LOG, LOG_HEAD), n = sh.getLastRow(), out = [];
  if (n >= 2) {
    var v = sh.getRange(Math.max(2, n - 59), 1, Math.min(60, n - 1), 3).getValues();
    for (var i = v.length - 1; i >= 0; i--) out.push({ at: v[i][0] instanceof Date ? v[i][0].toISOString() : String(v[i][0]), kind: v[i][1], note: v[i][2] });
  }
  return { ok: true, items: out };
}
