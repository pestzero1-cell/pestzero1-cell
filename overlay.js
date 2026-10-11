/* 관리자 화면에서 고친 내용(후기·현장갤러리·서비스지역·상단 안내 띠·공지)을 홈페이지에 반영합니다.
 * content.js 의 inquiryEndpoint(서버 주소)가 있을 때만 동작합니다. 서버에 연결하지 못하면 content.js 의 기본 내용을 그대로 보여줍니다.
 * 방식: 지난번에 받아 둔 내용을 먼저 보여주고, 뒤에서 최신 내용을 받아 저장합니다. 바뀐 게 있으면 한 번만 새로고침합니다. */
(function () {
  if (window.HRC_OVERLAY) return;
  var S = window.SITE || window.SITE_BOT || {};
  var url = /^https:\/\//.test(S.inquiryEndpoint || "") || /^http:\/\/localhost[:/]/.test(S.inquiryEndpoint || "") ? S.inquiryEndpoint : "";
  if (!url) return;
  var KEY = "hrc_overlay", FLAG = "hrc_overlay_reload";
  var cache = null;
  try { cache = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  var has = function (v) { return v !== null && v !== undefined; };
  function apply(d) {
    if (!d || !window.SITE) return;
    if (has(d.reviews)) window.SITE.reviews = d.reviews;
    if (has(d.gallery)) window.SITE.gallery = d.gallery;
    if (has(d.areas)) window.SITE.areas = d.areas;
    if (has(d.notices)) window.SITE.notices = d.notices;
    if (d.banner) window.SITE.banner = d.banner;
  }
  apply(cache);

  var fetching = null;
  function fresh() {
    if (fetching) return fetching;
    fetching = fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "action=public", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
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

  function paint(d) { if (!d) return; banner(d.banner); if (has(d.gallery)) paintGallery(d.gallery); }
  var ready = function (f) { if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", f); else f(); };
  ready(function () {
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
