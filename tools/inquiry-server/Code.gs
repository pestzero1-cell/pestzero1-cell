/**
 * 홈로취케어 홈페이지 서버 (구글 앱스스크립트).  설정 방법: README.md
 *  - 고객 문의 접수(구글 시트에 저장) · 사장님 관리자 화면(admin/)용 API
 *  - 후기·갤러리·공지·서비스지역을 관리자 화면에서 고치면 홈페이지에 반영
 * 비밀번호는 코드에 적지 않고 [프로젝트 설정 → 스크립트 속성]의 ADMIN_PASSWORD 에 넣습니다.
 */
var NOTIFY_EMAIL = "";            // 새 문의를 메일로도 받으려면 본인 메일 주소를 적으세요(선택).
var SHEET_INQ = "문의", SHEET_REV = "후기대기", SHEET_CONTENT = "콘텐츠";
var MAX = 2000;                   // 글자 수 제한(스팸 방지)
var SESSION_SEC = 6 * 3600;       // 로그인 유지 시간(6시간)
var STATUSES = ["신규", "상담중", "완료", "보류"];
var INQ_HEAD = ["접수번호", "접수시각", "종류", "서비스", "성함", "연락처", "내용", "페이지", "상태", "메모", "처리시각"];
var REV_HEAD = ["번호", "접수시각", "성함", "연락처", "별점", "내용", "상태"];

function doGet(e) {
  var a = e && e.parameter && e.parameter.action;
  if (a === "public") return json(publicData());
  return text("홈로취케어 서버 작동 중");
}

function doPost(e) {
  try {
    var p = JSON.parse((e.postData && e.postData.contents) || "{}");
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
      case "inq_delete": return json(inqDelete(p));
      case "rev_pending": return json(revPending());
      case "rev_decide": return json(revDecide(p));
      case "content_get": return json({ ok: true, content: readContent() });
      case "content_set": return json(contentSet(p));
      case "upload": return json(upload(p));
      case "password_change": return json(passwordChange(p));
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
function sheet(name, head) {
  var ss = SpreadsheetApp.getActive(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); if (head) sh.appendRow(head); }
  else if (head && sh.getLastRow() === 0) sh.appendRow(head);
  return sh;
}
function newId(prefix) { return prefix + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }

// ---------- 로그인 ----------
function login(p) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get("fails") || 0);
  if (fails >= 5) return { ok: false, error: "locked" };                 // 5회 틀리면 10분간 잠김
  var pw = PropertiesService.getScriptProperties().getProperty("ADMIN_PASSWORD");
  if (!pw) return { ok: false, error: "no_password" };
  if (!p.password || String(p.password) !== pw) { cache.put("fails", String(fails + 1), 600); return { ok: false, error: "bad_password" }; }
  cache.remove("fails");
  var t = Utilities.getUuid() + Utilities.getUuid();
  cache.put("t_" + t, "1", SESSION_SEC);
  return { ok: true, token: t };
}
function checkToken(t) { return !!t && !!CacheService.getScriptCache().get("t_" + t); }
function passwordChange(p) {
  var np = String(p.newPassword || "");
  if (np.length < 8) return { ok: false, error: "short" };
  var props = PropertiesService.getScriptProperties();
  if (String(p.oldPassword || "") !== props.getProperty("ADMIN_PASSWORD")) return { ok: false, error: "bad_password" };
  props.setProperty("ADMIN_PASSWORD", np);
  return { ok: true };
}

// ---------- 문의 ----------
function addInquiry(p) {
  var d = p.data || {};
  if (d.website) return { ok: true };                                    // 숨은 칸이 채워져 있으면 자동 스팸 → 조용히 무시
  var sh = sheet(SHEET_INQ, INQ_HEAD), id = newId("Q");
  var row = [id, new Date(), cut(p.type, 40), cut(d.svc || d.title, 100), cut(d.name || d.author, 40), cut(d.phone, 40), cut(d.msg || d.content), cut(p.page, 200), "신규", "", ""];
  sh.appendRow(row);
  if (NOTIFY_EMAIL) { try { MailApp.sendEmail(NOTIFY_EMAIL, "[홈페이지 문의] " + row[2] + " " + row[4], row.slice(2, 8).join("\n")); } catch (x) {} }
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
  sh.getRange(r, 9, 1, 3).setValues([[p.status, cut(p.memo, 1000), p.status === "완료" ? (old === "완료" ? sh.getRange(r, 11).getValue() : new Date()) : ""]]);
  return { ok: true };
}
function inqDelete(p) {
  var sh = sheet(SHEET_INQ, INQ_HEAD), r = findRow(sh, p.id);
  if (r < 0) return { ok: false, error: "notfound" };
  sh.deleteRow(r);
  return { ok: true };
}

// ---------- 후기 (고객 제출 → 사장님 승인 → 홈페이지 게시) ----------
function addReview(p) {
  var d = p.data || p;
  if (d.website) return { ok: true };
  var text = cut(d.text, 600).trim(), name = cut(d.name, 20).trim();
  if (!text || !name) return { ok: false, error: "empty" };
  var stars = Math.max(1, Math.min(5, Number(d.stars) || 5));
  sheet(SHEET_REV, REV_HEAD).appendRow([newId("R"), new Date(), name, cut(d.phone, 40), stars, text, "대기"]);
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
    c.reviews.unshift({ name: maskName(v[2]), area: cut(p.area, 30), stars: v[4], text: v[5] });
    writeContent(c);
    sh.getRange(r, 7).setValue("게시");
  } else sh.getRange(r, 7).setValue("거절");
  return { ok: true };
}
function maskName(n) { n = String(n || "").trim(); return n.length <= 1 ? n : n.charAt(0) + "○" + (n.length > 2 ? n.slice(2) : "") + " 고객님"; }

// ---------- 홈페이지에 반영되는 내용 ----------
function readContent() {
  var sh = sheet(SHEET_CONTENT), v = sh.getRange(1, 1).getValue();
  try { return v ? JSON.parse(v) : {}; } catch (e) { return {}; }
}
function writeContent(c) {
  c.version = Date.now();
  var s = JSON.stringify(c);
  if (s.length > 45000) throw new Error("too big");
  sheet(SHEET_CONTENT).getRange(1, 1).setValue(s);
}
function clean(arr, fields, max) {
  var out = [];
  (Array.isArray(arr) ? arr : []).slice(0, max || 100).forEach(function (x) {
    var o = {};
    fields.forEach(function (f) { o[f] = typeof x[f] === "number" ? x[f] : cut(x[f], f === "text" || f === "body" ? 1200 : 300); });
    out.push(o);
  });
  return out;
}
function publicData() {
  var c = readContent();
  return { ok: true, version: c.version || 0, reviews: c.reviews || null, gallery: c.gallery || null, areas: c.areas || null, banner: c.banner || null, notices: c.notices || [] };
}
function contentSet(p) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var c = readContent(), n = p.content || {};
    if ("reviews" in n) c.reviews = clean(n.reviews, ["name", "area", "stars", "text"], 100);
    if ("gallery" in n) c.gallery = clean(n.gallery, ["image", "title", "area", "tag", "text"], 60);
    if ("areas" in n) c.areas = (Array.isArray(n.areas) ? n.areas : []).slice(0, 60).map(function (a) { return cut(a, 30); }).filter(String);
    if ("banner" in n) c.banner = n.banner ? { text: cut(n.banner.text, 120), href: cut(n.banner.href, 300) } : null;
    if ("notices" in n) c.notices = clean(n.notices, ["title", "date", "body"], 100);
    writeContent(c);
    return { ok: true, version: c.version };
  } finally { lock.releaseLock(); }
}

// ---------- 사진 업로드 (구글 드라이브 폴더에 저장, 링크로 보기 가능) ----------
function upload(p) {
  var mime = String(p.mime || "");
  if (!/^image\/(jpeg|png|webp)$/.test(mime)) return { ok: false, error: "type" };
  var bytes = Utilities.base64Decode(String(p.b64 || ""));
  if (bytes.length > 4 * 1024 * 1024) return { ok: false, error: "size" };
  var it = DriveApp.getFoldersByName("홈페이지 사진"), folder = it.hasNext() ? it.next() : DriveApp.createFolder("홈페이지 사진");
  var f = folder.createFile(Utilities.newBlob(bytes, mime, "p" + Date.now() + (mime === "image/png" ? ".png" : mime === "image/webp" ? ".webp" : ".jpg")));
  f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: "https://lh3.googleusercontent.com/d/" + f.getId() + "=w1200" };
}
