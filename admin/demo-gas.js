/* 체험(연습) 모드용 가짜 서버. 진짜 서버 코드(Code.gs)를 이 브라우저 안에서 그대로 실행하고, 데이터는 이 브라우저(localStorage)에만 저장합니다.
 * 실제 홈페이지·구글 시트에는 아무 영향이 없습니다. (admin/demo.html 에서만 쓰입니다) */
(function () {
  var KEY = "hrc_demo_db", DEMO_URL = "https://demo.invalid/exec", PW = "demo1234demo";
  var db = { sheets: {}, props: { ADMIN_PASSWORD: PW, EPOCH: "0" }, files: {} };
  function rep(k, v) { var o = this[k]; return o instanceof Date ? { $d: o.toISOString() } : v; }
  function rev(k, v) { return v && typeof v === "object" && v.$d ? new Date(v.$d) : v; }
  try { var s = localStorage.getItem(KEY); if (s) db = JSON.parse(s, rev); } catch (e) {}
  var fresh = !Object.keys(db.sheets).length;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(db, rep)); } catch (e) { alert("저장 공간이 부족합니다. 체험 데이터를 초기화해 주세요."); } }
  function sheetObj(name) {
    var rows = db.sheets[name];
    return {
      getLastRow: function () { return rows.length; },
      appendRow: function (r) { rows.push(r.slice()); save(); },
      deleteRow: function (i) { rows.splice(i - 1, 1); save(); },
      getRange: function (r, c, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        return {
          getValues: function () { var o = []; for (var i = 0; i < nr; i++) { var row = []; for (var j = 0; j < nc; j++) { var v = (rows[r - 1 + i] || [])[c - 1 + j]; row.push(v == null ? "" : v); } o.push(row); } return o; },
          getValue: function () { var v = (rows[r - 1] || [])[c - 1]; return v == null ? "" : v; },
          setValues: function (vv) { vv.forEach(function (row, i) { row.forEach(function (x, j) { (rows[r - 1 + i] = rows[r - 1 + i] || [])[c - 1 + j] = x; }); }); save(); },
          setValue: function (x) { (rows[r - 1] = rows[r - 1] || [])[c - 1] = x; save(); }
        };
      }
    };
  }
  var cacheKey = "hrc_demo_cache";
  function cacheLoad() { try { return JSON.parse(sessionStorage.getItem(cacheKey) || "{}"); } catch (e) { return {}; } }
  var services = {
    SpreadsheetApp: { getActive: function () { return { getSheetByName: function (n) { return db.sheets[n] ? sheetObj(n) : null; }, insertSheet: function (n) { db.sheets[n] = []; save(); return sheetObj(n); } }; } },
    PropertiesService: { getScriptProperties: function () { return { getProperty: function (k) { var v = db.props[k]; return v == null ? null : v; }, setProperty: function (k, v) { db.props[k] = v; save(); } }; } },
    CacheService: { getScriptCache: function () { return {
      get: function (k) { var c = cacheLoad(), e = c[k]; return e && e.exp > Date.now() ? e.v : null; },
      put: function (k, v, sec) { var c = cacheLoad(); c[k] = { v: v, exp: Date.now() + sec * 1000 }; try { sessionStorage.setItem(cacheKey, JSON.stringify(c)); } catch (e) {} },
      remove: function (k) { var c = cacheLoad(); delete c[k]; try { sessionStorage.setItem(cacheKey, JSON.stringify(c)); } catch (e) {} } }; } },
    LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
    Utilities: {
      sleep: function () {},
      getUuid: function () { return (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()); },
      base64Decode: function (s) { var b = atob(s), a = []; for (var i = 0; i < b.length; i++) a.push(b.charCodeAt(i)); return a; },
      newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; }
    },
    MailApp: { sendEmail: function () {} },
    ContentService: { MimeType: { JSON: "json" }, createTextOutput: function (t) { return { t: t, setMimeType: function () { return this; } }; } },
    DriveApp: { Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
      getFoldersByName: function () { return { hasNext: function () { return true; }, next: function () { return { createFile: function (b) {
        var id = "1" + Math.random().toString(36).slice(2).padEnd(24, "x").slice(0, 24) + Date.now().toString(36);
        var bin = ""; b.bytes.forEach(function (x) { bin += String.fromCharCode(x & 255); });
        db.files[id] = "data:" + b.mime + ";base64," + btoa(bin); save();
        return { getId: function () { return id; }, setSharing: function () {} }; } }; } }; },
      createFolder: function () { return {}; } }
  };
  var names = Object.keys(services);
  var gas = new Function(names.join(","), window.HRC_GAS_SRC + "\n;return {doGet:doGet,doPost:doPost};").apply(null, names.map(function (n) { return services[n]; }));
  function post(o) { gas.doPost({ postData: { contents: JSON.stringify(o) } }); }
  if (fresh) { // 처음 열면 보기용 샘플을 넣어 둡니다.
    [["문의", { svc: "방역 (홈로취케어)", name: "김민수", phone: "010-1234-5678", msg: "구로구 빌라인데 주방에서 바퀴벌레가 계속 나와요. 이번 주 방문 가능한 날짜 알려주세요.", consent: 1 }],
     ["문의", { svc: "배관·하수구 (헬로하수구)", name: "이영희", phone: "010-2222-3333", msg: "싱크대 물이 잘 안 내려가요. 비용이 궁금합니다.", consent: 1 }],
     ["1:1문의", { svc: "기타", name: "박철수", phone: "010-9876-5432", msg: "상가 정기방역 견적 문의드립니다.", consent: 1 }]].forEach(function (x) { post({ type: x[0], data: x[1], page: "/demo" }); });
    post({ action: "review_submit", data: { name: "최지은", stars: 5, text: "설명을 자세히 해주셔서 믿고 맡겼어요. 냄새가 싹 사라졌습니다.", consent: 1 } });
    post({ action: "review_submit", data: { name: "정대호", stars: 4, text: "약속 시간에 정확히 오셔서 깔끔하게 작업해 주셨어요.", consent: 1 } });
    db.sheets["콘텐츠"] = db.sheets["콘텐츠"] || []; save();
  }
  var realFetch = window.fetch;
  window.fetch = function (u, opt) {
    if (String(u).indexOf(DEMO_URL) === 0) {
      var out = opt && opt.method === "POST" ? gas.doPost({ postData: { contents: opt.body } }) : gas.doGet({ parameter: Object.fromEntries(new URL(u).searchParams) });
      return Promise.resolve(new Response(out.t, { status: 200, headers: { "Content-Type": "application/json" } }));
    }
    return realFetch.apply(this, arguments);
  };
  if (window.SITE) window.SITE.inquiryEndpoint = DEMO_URL;
  // 업로드한 사진은 이 브라우저 안에만 있으므로, 화면에 보일 때 데이터 주소로 바꿔 줍니다.
  window.HRC_DEMO_IMG = function (u) { var m = String(u || "").match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/); return m && db.files[m[1]] ? db.files[m[1]] : u; };
  window.HRC_DEMO_RESET = function () { try { localStorage.removeItem(KEY); sessionStorage.removeItem(cacheKey); } catch (e) {} location.reload(); };
  document.addEventListener("DOMContentLoaded", function () {
    var pw = document.getElementById("pw"); if (pw) pw.value = PW;
    var bar = document.createElement("div");
    bar.style.cssText = "background:#7a3b00;color:#fff;padding:10px 16px;font-size:.9rem;line-height:1.5;text-align:center;word-break:keep-all";
    bar.innerHTML = '🧪 <b>체험 모드</b> — 연습용입니다. 여기서 바꾼 내용은 <b>이 브라우저에만</b> 저장되고 실제 홈페이지에는 반영되지 않습니다. (비밀번호 <b>' + PW + '</b> 자동 입력됨) ' +
      '<a href="../index.html?demo=1" style="color:#ffd9a8;font-weight:700">체험 내용으로 홈페이지 보기 →</a> · <a href="#" id="demo-reset" style="color:#ffd9a8">체험 데이터 초기화</a>';
    document.body.insertBefore(bar, document.body.firstChild);
    document.getElementById("demo-reset").addEventListener("click", function (e) { e.preventDefault(); if (confirm("체험 중 바꾼 내용을 모두 지우고 처음 상태로 되돌립니다.")) window.HRC_DEMO_RESET(); });
  });
})();
