/* 관리자 화면에서 고친 내용(후기·현장갤러리·서비스지역·상단 안내 띠·공지)을 홈페이지에 반영합니다.
 * content.js 의 inquiryEndpoint(서버 주소)가 있을 때만 동작합니다. 서버에 연결하지 못하면 content.js 의 기본 내용을 그대로 보여줍니다.
 * 방식: 지난번에 받아 둔 내용을 먼저 보여주고, 뒤에서 최신 내용을 받아 저장합니다. 바뀐 게 있으면 한 번만 새로고침합니다. */
(function () {
  if (window.HRC_OVERLAY) return;
  var S = window.SITE || window.SITE_BOT || {};
  var url = /^https:\/\//.test(S.inquiryEndpoint || "") || /^http:\/\/localhost[:/]/.test(S.inquiryEndpoint || "") ? S.inquiryEndpoint : "";
  // 체험 모드: 주소 뒤에 ?demo=1 을 붙여 열면, 관리자 체험 화면(admin/demo.html)에서 바꾼 내용(이 브라우저에만 저장)으로 홈페이지를 미리 볼 수 있습니다.
  var DEMO = false;
  try { if (/[?&]demo=1(&|$)/.test(location.search)) sessionStorage.setItem("hrc_demo", "1"); if (/[?&]demo=0(&|$)/.test(location.search)) sessionStorage.removeItem("hrc_demo"); DEMO = sessionStorage.getItem("hrc_demo") === "1" && localStorage.getItem("hrc_demo_db") != null; } catch (e) {}
  var demoDb = null;
  if (DEMO) { try { demoDb = JSON.parse(localStorage.getItem("hrc_demo_db")); } catch (e) { DEMO = false; } }
  if (!url && !DEMO) return;
  var KEY = DEMO ? "hrc_overlay_demo" : "hrc_overlay", FLAG = DEMO ? "hrc_overlay_reload_demo" : "hrc_overlay_reload";
  var cache = null;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  var has = function (v) { return v !== null && v !== undefined; };
  var okImg = function (u) { u = String(u || ""); return u === "" || /^images\/[A-Za-z0-9_.\-\/가-힣]{1,120}$/.test(u) || /^https:\/\/lh3\.googleusercontent\.com\/d\/[A-Za-z0-9_\-]{10,80}(=w\d{2,4})?$/.test(u); };
  var demoImg = function (u) { var m = String(u || "").match(/lh3\.googleusercontent\.com\/d\/([A-Za-z0-9_-]+)/); return DEMO && m && demoDb.files && demoDb.files[m[1]] ? demoDb.files[m[1]] : u; };
  var cleanG = function (l) { return (l || []).map(function (g) { var x = Object.assign({}, g); if (!okImg(x.image)) x.image = ""; else x.image = demoImg(x.image); return x; }); };
  function apply(d) {
    if (!d || !window.SITE) return;
    if (has(d.reviews)) window.SITE.reviews = d.reviews;
    if (has(d.gallery)) window.SITE.gallery = cleanG(d.gallery);
    if (has(d.areas)) window.SITE.areas = d.areas;
    if (has(d.notices)) window.SITE.notices = d.notices;
    if (d.banner) window.SITE.banner = d.banner;
    if (d.social) window.SITE.social = d.social;
    if (has(d.shorts)) window.SITE.shorts = d.shorts;
  }
  apply(cache);

  var fetching = null;
  function fresh() {
    if (fetching) return fetching;
    var src = DEMO ? new Promise(function (res) {
      var c = {}; try { var rows = (JSON.parse(localStorage.getItem("hrc_demo_db")).sheets["콘텐츠"] || []); c = JSON.parse((rows[0] || [])[0] || "{}"); } catch (e) {}
      res({ ok: true, version: c.version || 0, reviews: c.reviews || null, gallery: c.gallery || null, areas: c.areas || null, banner: c.banner || null, notices: c.notices || [], theme: c.theme || null, layout: c.layout || null, social: c.social || null, shorts: c.shorts || null });
    }) : fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "action=public", { cache: "no-store" }).then(function (r) { return r.json(); });
    fetching = src.then(function (j) {
      fetching = null;
      if (!j || !j.ok) return cache;
      var changed = !cache || cache.version !== j.version;
      try { localStorage.setItem(KEY, JSON.stringify(j)); } catch (e) {}
      cache = j;
      return Object.assign({ _changed: changed }, j);
    }).catch(function () { fetching = null; return cache; });
    return fetching;
  }
  window.HRC_OVERLAY = { get: function () { return cache; }, fresh: fresh, enabled: true };

  // ---- 상단 안내 띠 ----
  function banner(b) {
    var old = document.getElementById("hrc-banner");
    if (old) old.remove();
    if (!b || !b.text) return;
    var el = document.createElement("div");
    el.id = "hrc-banner";
    el.setAttribute("role", "status");
    el.style.cssText = "background:#12408f;color:#fff;text-align:center;font-size:.9rem;font-weight:700;padding:8px 14px;line-height:1.4;word-break:keep-all";
    var href = b.href && /^(https?:\/\/|\/|[a-z0-9_.\-\/#]+$)/i.test(b.href) && !/^javascript:/i.test(b.href) ? b.href : "";
    if (href) { var a = document.createElement("a"); a.href = href; a.textContent = b.text; a.style.cssText = "color:#fff;text-decoration:underline"; el.appendChild(a); }
    else el.textContent = b.text;
    document.body.insertBefore(el, document.body.firstChild);
  }

  // ---- 현장갤러리 페이지(gallery/) 다시 그리기 ----
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function paintGallery(list) {
    var grid = document.querySelector(".ggrid");
    if (!grid || !Array.isArray(list)) return;
    var base = (window.SITE_BASE != null ? window.SITE_BASE : "../");
    var src = function (p) { return !p ? "" : /^(https?:|data:)/.test(p) ? p : base + p; };
    grid.innerHTML = list.length ? list.map(function (g) {
      return '<div class="card gcard" data-t="' + esc(g.tag) + '"><div class="shot">' + (g.image ? '<img loading="lazy" src="' + esc(src(g.image)) + '" alt="' + esc(g.title) + '">' : "사진 자리") + '</div><span class="tag">' + esc(g.tag) + '</span><h2 class="gt">' + esc(g.title) + '</h2><p class="meta">' + esc(g.area) + "</p><p>" + esc(g.text) + "</p></div>";
    }).join("") : '<p class="muted">등록된 사례가 없습니다.</p>';
    var tags = [];
    list.forEach(function (g) { if (g.tag && tags.indexOf(g.tag) < 0) tags.push(g.tag); });
    var chips = document.querySelector(".gfilter");
    if (chips) chips.remove();
    if (tags.length > 1) {
      chips = document.createElement("div");
      chips.className = "gfilter"; chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "분류");
      chips.innerHTML = '<button type="button" class="on" data-t="">전체</button>' + tags.map(function (t) { return '<button type="button" data-t="' + esc(t) + '">' + esc(t) + "</button>"; }).join("");
      grid.parentNode.insertBefore(chips, grid);
      chips.addEventListener("click", function (ev) {
        var b = ev.target.closest("button"); if (!b) return;
        chips.querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
        var t = b.getAttribute("data-t");
        grid.querySelectorAll(".gcard").forEach(function (c) { c.hidden = !!t && c.getAttribute("data-t") !== t; });
      });
    }
  }


  // ---- 디자인(색상): 관리자 화면 > 디자인에서 고른 색을 사이트 전체에 적용 (밝은 화면 기준) ----
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), c = function (v) { return Math.max(0, Math.min(255, Math.round(v * f))).toString(16).padStart(2, "0"); }; return "#" + c(n >> 16) + c((n >> 8) & 255) + c(n & 255); }
  function theme(t) {
    var s = document.getElementById("hrc-theme");
    if (s) s.remove();
    if (!t || !/^#[0-9a-fA-F]{6}$/.test(t.brand || "") || !/^#[0-9a-fA-F]{6}$/.test(t.accent || "")) return;
    s = document.createElement("style");
    s.id = "hrc-theme";
    s.textContent = "@media (prefers-color-scheme:light){:root{--brand:" + t.brand + ";--brand-d:" + shade(t.brand, .72) + ";--accent:" + t.accent + "}}";
    document.head.appendChild(s);
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute("content", t.brand);
  }
  // ---- 홈 구성: 섹션 순서·표시 여부 ----
  var PICK = { slider: "#slider", hero: ".hero", trust: ".trust", services: "#services", quick: "#quick", why: "#why", guarantee: "#guarantee", gallery: "#gallery", shorts: "#shorts", reviews: "#reviews", about: "#about", journal: "#journal", faq: "#faq", contact: "#contact", directory: "#directory" };
  function layout(l) {
    var main = document.getElementById("top");
    if (!l || !main || !document.getElementById("app")) return;
    var els = {}, cur = [];
    Object.keys(PICK).forEach(function (k) { var el = main.querySelector(":scope > " + PICK[k]) || document.querySelector("main " + PICK[k]); if (el && el.parentNode === main) els[k] = el; });
    [].forEach.call(main.children, function (c) { Object.keys(els).forEach(function (k) { if (els[k] === c) cur.push(k); }); });
    var want = (l.order || []).filter(function (k) { return els[k]; });
    cur.forEach(function (k) { if (want.indexOf(k) < 0) want.push(k); });             // 목록에 없는 건 기존 순서대로 뒤에
    var anchors = cur.map(function (k) { var a = document.createComment("s"); main.insertBefore(a, els[k]); return a; });
    want.forEach(function (k, i) { main.insertBefore(els[k], anchors[i].nextSibling); });
    anchors.forEach(function (a) { a.remove(); });
    Object.keys(els).forEach(function (k) { els[k].hidden = (l.hidden || []).indexOf(k) >= 0; });
  }

  function paint(d) { if (!d) return; banner(d.banner); if (has(d.gallery)) paintGallery(cleanG(d.gallery)); theme(d.theme || (window.SITE && window.SITE.theme)); layout(d.layout); if (window.HRC_SOCIAL) window.HRC_SOCIAL.paint(d.social || (window.SITE && window.SITE.social)); }
  function demoBar() {
    if (!DEMO) return;
    var el = document.createElement("div");
    el.style.cssText = "background:#7a3b00;color:#fff;text-align:center;font-size:.85rem;padding:7px 12px;line-height:1.4;word-break:keep-all;position:relative;z-index:50";
    el.innerHTML = '🧪 체험 모드로 보는 중입니다 (관리자 체험 화면에서 바꾼 내용). <a href="?demo=0" style="color:#ffd9a8;font-weight:700">체험 끄기</a>';
    document.body.insertBefore(el, document.body.firstChild);
  }
  var ready = function (f) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", f); else f(); };
  ready(function () {
    demoBar();
    paint(cache);
    fresh().then(function (d) {
      if (!d) return;
      paint(d);
      // 홈페이지(js 로 그리는 화면)는 바뀐 내용이 있으면 한 번만 새로고침해서 최신 내용으로 보여줍니다.
      if (d._changed && d.version && document.getElementById("app")) {
        var done = ""; try { done = sessionStorage.getItem(FLAG); } catch (e) {}
        if (String(done) !== String(d.version)) { try { sessionStorage.setItem(FLAG, String(d.version)); } catch (e) {} location.reload(); }
      }
    });
  });
})();
