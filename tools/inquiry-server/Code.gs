/**
 * 홈로취케어 홈페이지 서버 (구글 앱스스크립트).  설정 방법: README.md  /  보안 설명: SECURITY.md
 *  - 고객 문의·후기 접수(구글 시트에 저장) · 사장님 관리자 화면(admin/)용 API
 *  - 후기·갤러리·공지·서비스지역·디자인(색상)·홈 구성을 관리자 화면에서 고치면 홈페이지에 반영
 * 비밀번호는 코드에 적지 않고 [프로젝트 설정 → 스크립트 속성]의 ADMIN_PASSWORD 에 넣습니다.
 */
var NOTIFY_EMAIL = "";            // 새 문의·보안 경고를 메일로 받을 본인 메일 주소(권장). 비우면 시트에만 쌓입니다.
var SHEET_INQ = "문의", SHEET_REV = "후기대기", SHEET_CONTENT = "콘텐츠", SHEET_LOG = "기록";
var MAX = 2000;                   // 글자 수 제한
var SESSION_SEC = 6 * 3600;       // 로그인 유지 시간(6시간)
var STATUSES = ["신규", "상담중", "완료", "보류"];
var INQ_HEAD = ["접수번호", "접수시각", "종류", "서비스", "성함", "연락처", "내용", "페이지", "상태", "메모", "처리시각"];
var REV_HEAD = ["번호", "접수시각", "성함", "연락처", "별점", "내용", "상태"];
var LOG_HEAD = ["시각", "구분", "내용"];
var MAX_ROWS = 20000;             // 시트가 이 이상 쌓이면 새 접수를 막습니다(폭주 방지)
var LIMITS = { inq: [40, 600], rev: [10, 600] };   // [최대 건수, 기준 시간(초)] — 이 시간 안에 이 건수를 넘으면 접수 거절

function doGet(e) {
  var a = e && e.parameter && e.parameter.action;
  if (a === "public") return json(publicData());
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
      case "inquiry": return json(addInquiry(p));
      case "review_submit": return json(addReview(p));
      case "login": return json(login(p));
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
  return sh;
}
function newId(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }
function mail(subject, body) { if (NOTIFY_EMAIL) { try { MailApp.sendEmail(NOTIFY_EMAIL, subject, body); } catch (x) {} } }
// 일정 시간 안에 너무 많이 들어오면 막기 (스팸·도배 방지)
function allow(kind) {
  var c = CacheService.getScriptCache(), k = "rl_" + kind, n = Number(c.get(k) || 0), lim = LIMITS[kind];
  if (n >= lim[0]) return false;
  c.put(k, String(n + 1), lim[1]);
  return true;
}
function audit(kind, note) { try { sheet(SHEET_LOG, LOG_HEAD).appendRow([new Date(), kind, cell(note, 300)]); } catch (e) {} }

// ---------- 로그인 ----------
// 틀릴 때마다 응답을 늦추고(무차별 대입 방지), 5회 이상 틀리면 메일로 알립니다. 정상 사용자는 잠기지 않습니다.
function login(p) {
  var cache = CacheService.getScriptCache(), props = PropertiesService.getScriptProperties();
  var fails = Number(cache.get("fails") || 0);
  var pw = props.getProperty("ADMIN_PASSWORD");
  if (!pw) return { ok: false, error: "no_password" };
  if (!p.password || String(p.password) !== pw) {
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
function addInquiry(p) {
  var d = p.data || {};
  if (d.website) return { ok: true };                                    // 숨은 칸이 채워져 있으면 자동 스팸 → 조용히 무시
  if (!d.consent) return { ok: false, error: "consent" };               // 개인정보 수집·이용 동의 없으면 접수하지 않음
  var msg = cut(d.msg || d.content), phone = cut(d.phone, 40);
  if (!msg.trim() && !phone.trim()) return { ok: false, error: "empty" };
  var c = CacheService.getScriptCache(), dk = "d_" + hash(phone + "|" + msg);
  if (c.get(dk)) return { ok: true };                                    // 같은 내용을 연달아 보내면 한 번만
  if (!allow("inq")) return { ok: false, error: "busy" };
  var sh = sheet(SHEET_INQ, INQ_HEAD);
  if (sh.getLastRow() > MAX_ROWS) return { ok: false, error: "full" };
  c.put(dk, "1", 600);
  var id = newId("Q");
  sh.appendRow([id, new Date(), cell(p.type, 40), cell(d.svc || d.title, 100), cell(d.name || d.author, 40), cell(phone, 40), cell(msg), cell(p.page, 200), "신규", "", ""]);
  mail("[홈페이지 문의] " + cut(p.type, 20) + " " + cut(d.name, 20), cut(d.svc, 60) + "\n" + cut(d.name, 40) + " " + phone + "\n" + cut(msg, 500));
  return { ok: true };
}
function inqList() {
  var sh = sheet(SHEET_INQ, INQ_HEAD), n = sh.getLastRow();
  if (n < 2) return { ok: true, items: [] };
  var vals = sh.getRange(2, 1, n - 1, INQ_HEAD.length).getValues(), out = [];
  for (var i = vals.length - 1; i >= 0; i--) {
    var r = vals[i];
    out.push({ id: r[0], at: r[1] instanceof Date ? r[1].toISOString() : String(r[1]), type: r[2], svc: r[3], name: r[4], phone: r[5], msg: r[6], page: r[7], status: r[8] || "신규", memo: r[9], doneAt: r[10] instanceof Date ? r[10].toISOString() : String(r[10] || "") });
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
function addReview(p) {
  var d = p.data || p;
  if (d.website) return { ok: true };
  if (!d.consent) return { ok: false, error: "consent" };
  var text = cut(d.text, 600).trim(), name = cut(d.name, 20).trim();
  if (!text || !name) return { ok: false, error: "empty" };
  var c = CacheService.getScriptCache(), dk = "d_" + hash(name + "|" + text);
  if (c.get(dk)) return { ok: true };
  if (!allow("rev")) return { ok: false, error: "busy" };
  var sh = sheet(SHEET_REV, REV_HEAD);
  if (sh.getLastRow() > MAX_ROWS) return { ok: false, error: "full" };
  c.put(dk, "1", 600);
  var stars = Math.max(1, Math.min(5, Number(d.stars) || 5));
  sh.appendRow([newId("R"), new Date(), cell(name, 20), cell(d.phone, 40), stars, cell(text, 600), "대기"]);
  mail("[홈페이지] 새 후기가 도착했습니다", name + "\n" + text);
  return { ok: true };
}
function revPending() {
  var sh = sheet(SHEET_REV, REV_HEAD), n = sh.getLastRow(), out = [];
  if (n >= 2) {
    var v = sh.getRange(2, 1, n - 1, REV_HEAD.length).getValues();
    for (var i = v.length - 1; i >= 0; i--) if (v[i][6] === "대기") out.push({ id: v[i][0], at: v[i][1] instanceof Date ? v[i][1].toISOString() : String(v[i][1]), name: v[i][2], phone: v[i][3], stars: v[i][4], text: v[i][5] });
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
  return { ok: true, version: c.version || 0, reviews: c.reviews || null, gallery: c.gallery || null, areas: c.areas || null, banner: c.banner || null, notices: c.notices || [], theme: c.theme || null, layout: c.layout || null, social: c.social || null, shorts: c.shorts || null, slider: c.slider || null, hero: c.hero || null, why: c.why || null };
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
