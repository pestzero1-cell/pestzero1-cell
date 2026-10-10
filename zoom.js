/* 사진 확대 보기: 본문 사진을 누르면 전체 화면으로 열리고, 두 손가락으로 확대·축소, 한 손가락으로 이동합니다.
 * 컴퓨터에서는 + / − 버튼, 더블클릭, 마우스 끌기를 쓸 수 있습니다. 링크가 걸린 사진은 제외합니다. */
(function () {
  var SEL = ".pimg,.pgrid img,.pbody img,.shot img,.cellimg,.sl-img img,.tiles img,.svc-media:not(a) img,.about-main img";
  var MAX = 5, MIN = 1;
  var st = document.createElement("style");
  st.textContent =
    "img[data-zoomable]{cursor:zoom-in}" +
    ".zv{position:fixed;inset:0;z-index:100;background:rgba(0,0,0,.97);display:none;flex-direction:column;color:#fff;font-family:inherit}" +
    ".zv.open{display:flex}" +
    ".zv-bar{display:flex;align-items:center;gap:8px;padding:10px 12px calc(10px) 12px;padding-top:calc(10px + env(safe-area-inset-top,0px));background:rgba(0,0,0,.55);flex:none}" +
    ".zv-bar span{flex:1;font-size:.85rem;opacity:.85;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
    ".zv-bar button{background:rgba(255,255,255,.16);border:0;color:#fff;width:42px;height:42px;border-radius:10px;font:700 1.3rem/1 inherit;cursor:pointer}" +
    ".zv-bar button:hover{background:rgba(255,255,255,.3)}.zv-bar button:focus-visible{outline:2px solid #fff}" +
    ".zv-stage{flex:1;overflow:auto;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch;display:grid;place-items:center;padding:0;overscroll-behavior:contain}" +
    ".zv-stage img{display:block;max-width:none;user-select:none;-webkit-user-drag:none;margin:auto;touch-action:pan-x pan-y}" +
    ".zv-stage.drag{cursor:grabbing}.zv-stage.can{cursor:grab}" +
    ".zv-hint{position:absolute;left:0;right:0;bottom:calc(14px + env(safe-area-inset-bottom,0px));text-align:center;font-size:.8rem;opacity:.75;pointer-events:none}";
  document.head.appendChild(st);

  var root = document.createElement("div");
  root.className = "zv";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-label", "사진 확대 보기");
  root.innerHTML = '<div class="zv-bar"><span class="zv-cap"></span><button type="button" data-a="out" aria-label="축소">−</button><button type="button" data-a="in" aria-label="확대">+</button><button type="button" data-a="close" aria-label="닫기">×</button></div><div class="zv-stage"><img alt=""></div><p class="zv-hint">두 손가락으로 확대·축소, 한 손가락으로 이동 · 두 번 누르면 확대</p>';
  document.body.appendChild(root);
  var stage = root.querySelector(".zv-stage"), img = stage.querySelector("img"), cap = root.querySelector(".zv-cap"), hint = root.querySelector(".zv-hint");
  var BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";
  img.src = BLANK;
  var z = 1, lastFocus = null;

  function baseW() { return Math.min(stage.clientWidth, (stage.clientHeight * img.naturalWidth) / Math.max(1, img.naturalHeight)) || stage.clientWidth; }
  function apply(nz, px, py) {
    nz = Math.max(MIN, Math.min(MAX, nz));
    var oldW = img.offsetWidth || 1, oldH = img.offsetHeight || 1;
    px = px == null ? stage.clientWidth / 2 : px; py = py == null ? stage.clientHeight / 2 : py;
    var fx = (stage.scrollLeft + px - img.offsetLeft) / oldW, fy = (stage.scrollTop + py - img.offsetTop) / oldH;
    z = nz;
    img.style.width = Math.round(baseW() * z) + "px";
    img.style.height = "auto";
    var nw = img.offsetWidth, nh = img.offsetHeight;
    stage.scrollLeft = fx * nw - px + img.offsetLeft;
    stage.scrollTop = fy * nh - py + img.offsetTop;
    stage.classList.toggle("can", z > 1.01);
  }
  function open(src, alt, from) {
    lastFocus = from || document.activeElement;
    img.onload = function () { apply(1); };
    img.src = src; img.alt = alt || ""; cap.textContent = alt || "";
    z = 1; img.style.width = "100%"; img.style.height = "auto";
    root.classList.add("open"); document.documentElement.style.overflow = "hidden";
    hint.style.display = "";
    setTimeout(function () { hint.style.display = "none"; }, 3500);
    if (img.complete) apply(1);
    root.querySelector('[data-a="close"]').focus();
  }
  function close() {
    root.classList.remove("open"); document.documentElement.style.overflow = ""; img.src = BLANK;
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {}
  }

  // ---- 열기 (이벤트 위임, 나중에 그려지는 사진도 대응) ----
  function mark() {
    document.querySelectorAll(SEL).forEach(function (im) {
      if (im.closest("a[href]") || im.hasAttribute("data-zoomable") || im.closest(".zv")) return;
      im.setAttribute("data-zoomable", "");
      im.setAttribute("tabindex", "0"); im.setAttribute("role", "button");
      im.setAttribute("aria-label", (im.alt ? im.alt + " " : "") + "사진 확대");
    });
  }
  mark();
  new MutationObserver(mark).observe(document.body, { childList: true, subtree: true });
  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("img[data-zoomable]");
    if (!t) return;
    ev.preventDefault();
    open(t.currentSrc || t.src, t.alt, t);
  });
  document.addEventListener("keydown", function (ev) {
    if (root.classList.contains("open")) {
      if (ev.key === "Escape") close();
      else if (ev.key === "+" || ev.key === "=") apply(z * 1.4);
      else if (ev.key === "-") apply(z / 1.4);
      return;
    }
    var t = ev.target;
    if ((ev.key === "Enter" || ev.key === " ") && t && t.matches && t.matches("img[data-zoomable]")) { ev.preventDefault(); open(t.currentSrc || t.src, t.alt, t); }
  });

  // ---- 버튼·더블클릭 ----
  root.querySelector(".zv-bar").addEventListener("click", function (ev) {
    var a = ev.target.closest("button"); if (!a) return;
    var k = a.getAttribute("data-a");
    if (k === "close") close(); else if (k === "in") apply(z * 1.5); else if (k === "out") apply(z / 1.5);
  });
  stage.addEventListener("dblclick", function (ev) {
    var r = stage.getBoundingClientRect();
    apply(z > 1.2 ? 1 : 2.5, ev.clientX - r.left, ev.clientY - r.top);
  });
  stage.addEventListener("click", function (ev) { if (ev.target === stage && z <= 1.01) close(); });
  stage.addEventListener("wheel", function (ev) {
    if (!ev.ctrlKey && !ev.metaKey) return;
    ev.preventDefault();
    var r = stage.getBoundingClientRect();
    apply(z * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), ev.clientX - r.left, ev.clientY - r.top);
  }, { passive: false });
  window.addEventListener("resize", function () { if (root.classList.contains("open")) apply(z); });

  // ---- 두 손가락 확대·축소 ----
  var pin = null;
  function dist(t) { var dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY; return Math.sqrt(dx * dx + dy * dy); }
  stage.addEventListener("touchstart", function (ev) {
    if (ev.touches.length === 2) pin = { d: dist(ev.touches), z: z };
  }, { passive: true });
  stage.addEventListener("touchmove", function (ev) {
    if (ev.touches.length === 2 && pin) {
      ev.preventDefault();
      var r = stage.getBoundingClientRect(), cx = (ev.touches[0].clientX + ev.touches[1].clientX) / 2 - r.left, cy = (ev.touches[0].clientY + ev.touches[1].clientY) / 2 - r.top;
      apply(pin.z * dist(ev.touches) / pin.d, cx, cy);
    }
  }, { passive: false });
  stage.addEventListener("touchend", function (ev) { if (ev.touches.length < 2) pin = null; }, { passive: true });

  // ---- 마우스로 끌어서 이동 ----
  var drag = null;
  stage.addEventListener("mousedown", function (ev) {
    if (z <= 1.01 || ev.button !== 0) return;
    drag = { x: ev.clientX, y: ev.clientY, l: stage.scrollLeft, t: stage.scrollTop }; stage.classList.add("drag"); ev.preventDefault();
  });
  window.addEventListener("mousemove", function (ev) { if (drag) { stage.scrollLeft = drag.l - (ev.clientX - drag.x); stage.scrollTop = drag.t - (ev.clientY - drag.y); } });
  window.addEventListener("mouseup", function () { drag = null; stage.classList.remove("drag"); });
})();
