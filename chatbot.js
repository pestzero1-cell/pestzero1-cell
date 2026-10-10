/* 홈로취케어 자동응답 도우미 — 서버·AI 없이 동작하는 키워드 챗봇.
 * 설정은 content.js 의 bot 항목에서 합니다. 이 파일은 고칠 필요가 없습니다.
 * 읽는 값: window.SITE.bot (홈페이지) 또는 window.SITE_BOT (정적 페이지), window.SITE_BASE (사이트 루트까지의 상대경로) */
(function () {
  var S = window.SITE || window.SITE_BOT;
  var B = S && S.bot;
  if (!B || B.enabled === false) return;
  var BASE = window.SITE_BASE || "";
  var PHONE = S.phone || "";
  var TEL = "tel:" + String(PHONE).replace(/[^0-9+]/g, "");
  var KAKAO = /^https?:\/\//.test(S.kakaoUrl || "") ? S.kakaoUrl : "";
  var PREVIEW = !!window.SITE_PREVIEW;

  var esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var rich = function (t) { return esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>"); };
  var norm = function (t) { return String(t || "").toLowerCase().replace(/[\s.,!?~·\-_/()]+/g, ""); };
  var money = function (n) { return n.toLocaleString("ko-KR") + "원"; };

  var css = '' +
    '.hb-launch{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:30;display:flex;align-items:center;gap:8px;background:var(--brand,#12408f);color:var(--on,#fff);border:0;border-radius:999px;padding:12px 18px;font:700 .92rem/1 inherit;font-family:inherit;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28)}' +
    '.hb-launch:hover{filter:brightness(1.08)}.hb-launch svg{width:20px;height:20px}' +
    '.hb-panel{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:40;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100dvh - 32px));display:none;flex-direction:column;background:var(--bg,#fff);color:var(--fg,#1c2b25);border:1px solid var(--line,#dfe8e3);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.28);overflow:hidden;font-family:inherit}' +
    '.hb-panel.open{display:flex}.hb-launch.hide{display:none}' +
    '.hb-head{background:var(--brand,#12408f);color:var(--on,#fff);padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '.hb-head b{font-size:1rem;flex:1}.hb-head small{display:block;font-weight:400;opacity:.85;font-size:.76rem}' +
    '.hb-x{background:transparent;border:0;color:inherit;font-size:1.4rem;line-height:1;cursor:pointer;padding:4px 8px;border-radius:6px}.hb-x:hover{background:rgba(255,255,255,.18)}' +
    '.hb-log{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--card,#f3f8f5)}' +
    '.hb-m{max-width:88%;padding:10px 13px;border-radius:14px;font-size:.92rem;line-height:1.55;word-break:keep-all;overflow-wrap:anywhere}' +
    '.hb-m.bot{background:var(--bg,#fff);border:1px solid var(--line,#dfe8e3);border-top-left-radius:4px;align-self:flex-start}' +
    '.hb-m.me{background:var(--brand,#12408f);color:var(--on,#fff);border-top-right-radius:4px;align-self:flex-end}' +
    '.hb-links{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}' +
    '.hb-links a{display:inline-block;background:var(--card,#f3f8f5);border:1px solid var(--line,#dfe8e3);color:var(--brand,#12408f);border-radius:999px;padding:5px 11px;font-size:.82rem;font-weight:700;text-decoration:none}' +
    '.hb-links a:hover{border-color:var(--brand,#12408f)}' +
    '.hb-links a.call{background:var(--accent,#e5531d);color:#fff;border-color:transparent}.hb-links a.kk{background:#fee500;color:#191600;border-color:transparent}' +
    '.hb-chips{display:flex;flex-wrap:nowrap;overflow-x:auto;gap:6px;padding:8px 14px 2px;background:var(--card,#f3f8f5);scrollbar-width:thin}.hb-chips:empty{display:none}' +
    '.hb-chips button{white-space:nowrap;flex:none;background:var(--bg,#fff);border:1px solid var(--brand,#12408f);color:var(--brand,#12408f);border-radius:999px;padding:6px 12px;font:600 .82rem/1.2 inherit;font-family:inherit;cursor:pointer}' +
    '.hb-chips button:hover{background:var(--brand,#12408f);color:var(--on,#fff)}' +
    '.hb-form{display:flex;gap:8px;padding:10px 12px;border-top:1px solid var(--line,#dfe8e3);background:var(--bg,#fff)}' +
    '.hb-form input{flex:1;min-width:0;border:1px solid var(--line,#dfe8e3);border-radius:999px;padding:10px 14px;font:inherit;font-size:.92rem;background:var(--bg,#fff);color:var(--fg,#1c2b25)}' +
    '.hb-form button{border:0;border-radius:999px;background:var(--accent,#e5531d);color:#fff;font:700 .9rem/1 inherit;font-family:inherit;padding:0 16px;cursor:pointer}' +
    '.hb-expert{margin-top:10px;border:2px solid var(--accent,#e5531d);border-radius:12px;padding:10px 12px;background:var(--bg,#fff)}.hb-expert b{color:var(--accent,#e5531d);display:block;margin-bottom:4px}.hb-expert .hb-bigcall{display:block;text-align:center;background:var(--accent,#e5531d);color:#fff;border-radius:999px;padding:11px 14px;margin-top:8px;font-weight:800;font-size:1rem;text-decoration:none}.hb-expert .hb-bigcall:hover{filter:brightness(.92)}.hb-expert .hb-sub{display:block;text-align:center;margin-top:6px;font-size:.78rem;color:var(--muted,#5d6b64)}.hb-note{font-size:.72rem;color:var(--muted,#5d6b64);text-align:center;padding:0 12px 8px;background:var(--bg,#fff)}' +
    '.hb-typing{display:inline-flex;gap:4px;align-items:center;padding:12px 14px}.hb-typing i{width:6px;height:6px;border-radius:50%;background:var(--muted,#5d6b64);animation:hbb 1s infinite}.hb-typing i:nth-child(2){animation-delay:.15s}.hb-typing i:nth-child(3){animation-delay:.3s}' +
    '@keyframes hbb{0%,60%,100%{opacity:.25;transform:none}30%{opacity:1;transform:translateY(-3px)}}' +
    '@media(prefers-reduced-motion:reduce){.hb-typing i{animation:none}}' +
    '@media(max-width:480px){.hb-panel{left:8px;right:8px;width:auto;bottom:calc(8px + env(safe-area-inset-bottom,0px));height:min(78dvh,620px)}}';
  var st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);

  var root = document.createElement("div");
  root.innerHTML =
    '<button type="button" class="hb-launch" aria-haspopup="dialog" aria-controls="hb-panel"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg><span>' + esc(B.launcher || "무엇이든 물어보세요") + '</span></button>' +
    '<div class="hb-panel" id="hb-panel" role="dialog" aria-label="' + esc(B.name) + '"><div class="hb-head"><b>' + esc(B.name) + '<small>자동응답 · 정확한 금액은 상담으로 확정</small></b><button type="button" class="hb-x" aria-label="닫기">×</button></div>' +
    '<div class="hb-log" role="log" aria-live="polite"></div><div class="hb-chips"></div>' +
    '<form class="hb-form"><input type="text" maxlength="100" placeholder="궁금한 내용을 입력하세요" aria-label="질문 입력" autocomplete="off"><button type="submit">보내기</button></form>' +
    '<p class="hb-note">AI가 아닌 정해진 안내 문구로 답하는 자동응답입니다.</p></div>';
  document.body.appendChild(root);

  var launch = root.querySelector(".hb-launch"), panel = root.querySelector(".hb-panel"), log = root.querySelector(".hb-log"),
    chips = root.querySelector(".hb-chips"), form = root.querySelector(".hb-form"), input = form.querySelector("input");
  var state = { step: "idle", svc: null, started: false };

  function scroll() { log.scrollTop = log.scrollHeight; }
  function linkHtml(links, withContact) {
    var out = (links || []).map(function (l) {
      var ext = /^https?:\/\//.test(l.href), href = ext ? l.href : BASE + l.href;
      if (PREVIEW && !ext) { var seg = l.href.split("/")[0]; href = "#" + ({ posts: "journal", price: "price", system: "system", info: "info", drain: "drain", about: "about" }[seg] || "top"); }
      return '<a href="' + esc(href) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + esc(l.label) + "</a>";
    });
    if (withContact) {
      out.push('<a class="call" href="' + esc(TEL) + '">☎ ' + esc(PHONE) + "</a>");
      if (KAKAO) out.push('<a class="kk" href="' + esc(KAKAO) + '" target="_blank" rel="noopener noreferrer">카카오톡 상담</a>');
    }
    return out.length ? '<div class="hb-links">' + out.join("") + "</div>" : "";
  }
  function add(kind, html) {
    var d = document.createElement("div");
    d.className = "hb-m " + kind;
    d.innerHTML = html;
    log.appendChild(d);
    scroll();
    return d;
  }
  function setChips(list) {
    chips.innerHTML = (list || []).map(function (t) { return '<button type="button">' + esc(t) + "</button>"; }).join("");
    chips.scrollLeft = 0;
  }
  function botSay(html, then, delay) {
    var t = add("bot", '<span class="hb-typing"><i></i><i></i><i></i></span>');
    setTimeout(function () { t.innerHTML = html; scroll(); if (then) then(); }, delay == null ? 450 : delay);
  }

  // ---------------- 견적 흐름 ----------------
  function startEstimate() {
    state = { step: "svc", svc: null, started: true };
    botSay(rich("어떤 해충 때문에 문의하시나요? 아래에서 골라 주세요.\n(하수구·배관 막힘은 현장 확인 후 견적이라, 증상을 전화나 카카오톡으로 알려주세요.)"), function () {
      setChips(B.estimate.services.map(function (s) { return s.label; }).concat(["다른 해충·하수구"]));
    });
  }
  function askSize(svc) {
    state.step = "size"; state.svc = svc;
    botSay(rich("**" + svc.label + "** 퇴치를 선택하셨어요. (" + svc.note + ")\n집 크기를 **평수 숫자**로 입력해 주세요. 예) 24 / 원룸이라면 '원룸'"), function () {
      setChips(svc.tiers[0] && svc.tiers[0][0] == null ? ["원룸", "20평", "30평", "40평", "60평"] : ["20평", "30평", "40평", "60평"]);
      input.focus();
    });
  }
  function answerSize(text) {
    var svc = state.svc, e = B.estimate, price = null, label = "";
    if (/원룸/.test(text) && svc.tiers[0] && svc.tiers[0][0] == null) { price = svc.tiers[0][1]; label = svc.tiers[0][2]; }
    else {
      var m = text.match(/(\d+(?:\.\d+)?)/);
      if (!m) { botSay(rich("평수를 숫자로 알려 주세요. 예) 24"), null, 250); return; }
      var py = parseFloat(m[1]);
      if (py > 100) { price = null; label = "101평 이상"; }
      else {
        for (var i = 0; i < svc.tiers.length; i++) { var t = svc.tiers[i]; if (t[0] != null && py <= t[0]) { price = t[1]; label = t[2]; break; } }
      }
    }
    var raw;
    if (price == null) raw = "**" + svc.label + " · " + label + "**\n" + e.over + "\n" + e.tail;
    else {
      raw = "**" + svc.label + " 퇴치 · " + label + "**\n대략 **" + money(price) + "** 정도예요. (" + svc.note + ")";
      if (svc.tiers[0] && svc.tiers[0][0] == null && label !== "원룸" && parseFloat((text.match(/(\d+)/) || [0, 99])[1]) <= 12) raw += "\n원룸이라면 " + money(svc.tiers[0][1]) + "입니다.";
      raw += "\n" + e.tail;
    }
    state.step = "idle";
    botSay(rich(raw) + linkHtml([{ label: svc.label + " 단가표", href: "price/" + (svc.label === "바퀴벌레" ? "roach" : svc.label === "개미" ? "ant" : "rat") + "/" }], true), function () { setChips(["다른 견적", "신청 방법", "출장비"]); });
  }

  // ---------------- 키워드 매칭 ----------------
  function findIntent(text) {
    text = text + " ";
    var q = norm(text), best = null, bestScore = 0;
    B.intents.forEach(function (it) {
      var s = 0;
      it.keywords.forEach(function (k) {
        var nk = norm(k); if (!nk) return;
        var hit;
        if (/^[a-z\/ ]+$/i.test(k) && nk.length <= 4) hit = new RegExp("(^|[^a-z])" + k.toLowerCase().replace(/\//g, "\\/?") + "([^a-z]|$)", "i").test(String(text).toLowerCase());
        else hit = q.indexOf(nk) >= 0;
        if (hit) s += nk.length >= 3 ? 3 : nk.length === 2 ? 2 : 1;
      });
      if (q === norm(it.label)) s += 5;
      if (s > bestScore) { best = it; bestScore = s; }
    });
    return bestScore >= 2 ? best : null;
  }
  function handle(text) {
    text = text.trim();
    if (!text) return;
    add("me", esc(text));
    input.value = "";
    setChips([]);
    var q = norm(text);
    if (state.step === "svc") {
      var sv = B.estimate.services.filter(function (s) { return q.indexOf(norm(s.label)) >= 0; })[0];
      if (sv) { askSize(sv); return; }
      var ex = findIntent(text);
      if (ex && ex.expert) { state.step = "idle"; handleIntent(ex); return; }
      if (/다른|하수구|배관|기타/.test(text)) { state.step = "idle"; handleIntent(findIntent(text) || B.intents.filter(function (i) { return i.id === "drain"; })[0]); return; }
      botSay(rich("목록에서 골라 주시거나 바퀴벌레 / 개미 / 쥐 중 하나를 입력해 주세요."), function () { setChips(B.estimate.services.map(function (s) { return s.label; }).concat(["다른 해충·하수구"])); }, 250);
      return;
    }
    if (state.step === "size") {
      var ex2 = findIntent(text);
      if (ex2 && ex2.expert) { state.step = "idle"; handleIntent(ex2); return; }
      answerSize(text); return;
    }
    if (/견적|얼마|가격|비용|금액|요금|단가/.test(text) && !findIntent(text)) { startEstimate(); return; }
    if (/^(견적알아보기|다른견적)$/.test(q)) { startEstimate(); return; }
    var hit = findIntent(text);
    if (/견적알아보기|다른견적/.test(q)) { startEstimate(); return; }
    if (hit) handleIntent(hit);
    else botSay(rich(B.fallback) + linkHtml([], true), function () { setChips(B.chips); });
  }
  function expertBox() {
    return '<div class="hb-expert"><b>⚠ 전문가 상담 필수</b>정확한 진단과 견적은 전문가와 통화 후 안내됩니다.' +
      '<a class="hb-bigcall" href="' + esc(TEL) + '">☎ 전문가 상담 연결 ' + esc(PHONE) + '</a><span class="hb-sub">모바일에서 누르면 바로 전화가 연결돼요</span>' +
      (KAKAO ? '<div class="hb-links"><a class="kk" href="' + esc(KAKAO) + '" target="_blank" rel="noopener noreferrer">카카오톡으로 사진 보내기</a></div>' : "") + "</div>";
  }
  function handleIntent(it) {
    if (it.expert) {
      botSay(rich(it.answer) + linkHtml(it.links, false) + expertBox(), function () { setChips(B.chips.filter(function (c) { return norm(c) !== norm(it.label); }).slice(0, 5)); });
      return;
    }
    botSay(rich(it.answer) + linkHtml(it.links, it.id === "apply" || it.id === "urgent" || it.id === "area" || it.id === "drain" || it.id === "bedbug" || it.id === "smell" || it.id === "hello"), function () {
      setChips(B.chips.filter(function (c) { return norm(c) !== norm(it.label); }).slice(0, 5));
    });
  }

  // ---------------- 열기/닫기 ----------------
  function open() {
    panel.classList.add("open"); launch.classList.add("hide");
    if (!state.started) {
      state.started = true;
      add("bot", rich(B.greeting));
      setChips(B.chips);
    }
    setTimeout(function () { input.focus(); }, 50);
  }
  function close() { panel.classList.remove("open"); launch.classList.remove("hide"); launch.focus(); }
  launch.addEventListener("click", open);
  root.querySelector(".hb-x").addEventListener("click", close);
  panel.addEventListener("keydown", function (ev) { if (ev.key === "Escape") close(); });
  form.addEventListener("submit", function (ev) { ev.preventDefault(); handle(input.value); });
  chips.addEventListener("click", function (ev) {
    var b = ev.target.closest("button"); if (!b) return;
    var t = b.textContent;
    if (state.step === "size") { handle(t); return; }
    handle(t);
  });
  // 링크를 눌러도 같은 페이지 이동이면 패널은 그대로 두고, 다른 페이지면 자연스럽게 이동
})();
