/* 모바일 하단 고정 상담 바: 전화 / 도우미 / 카카오(채널 주소가 있을 때만). 휴대폰(너비 700px 이하)에서만 보입니다.
 * 전화번호·카카오 주소는 content.js 값을 씁니다. */
(function () {
  var S = window.SITE || window.SITE_BOT || {};
  var tel = String(S.phone || "").replace(/[^0-9]/g, "");
  if (!tel) return;
  var kk = /^https?:\/\//.test(S.kakaoUrl || "") ? S.kakaoUrl : "";
  var st = document.createElement("style");
  st.textContent =
    ".cbar{display:none}" +
    "@media(max-width:700px){" +
    ".cbar{position:fixed;left:0;right:0;bottom:0;z-index:25;display:flex;gap:8px;padding:8px 10px calc(8px + env(safe-area-inset-bottom,0px));background:rgba(255,255,255,.96);border-top:1px solid #dfe6f1;box-shadow:0 -6px 18px rgba(10,30,70,.12)}" +
    ".cbar a,.cbar button{flex:1;display:flex;align-items:center;justify-content:center;gap:6px;min-height:46px;border:0;border-radius:12px;font:700 .95rem/1.1 inherit;text-decoration:none;cursor:pointer;word-break:keep-all;text-align:center}" +
    ".cbar .c-tel{flex:2;background:var(--accent,#e5531d);color:#fff;font-size:1.02rem}" +
    ".cbar .c-bot{background:var(--brand,#12408f);color:#fff}" +
    ".cbar .c-kk{background:#fee500;color:#191600}" +
    "body{padding-bottom:calc(66px + env(safe-area-inset-bottom,0px))}" +
    ".fabs,.fab,.kkfab,.hb-launch{display:none!important}}";
  document.head.appendChild(st);
  var bar = document.createElement("div");
  bar.className = "cbar";
  bar.setAttribute("role", "navigation");
  bar.setAttribute("aria-label", "빠른 상담");
  bar.innerHTML = '<a class="c-tel" href="tel:' + tel + '">📞 전화상담 ' + (S.phone || "") + '</a>' +
    '<button type="button" class="c-bot" hidden>💬 도우미</button>' +
    (kk ? '<a class="c-kk" href="' + kk + '" target="_blank" rel="noopener noreferrer">카카오톡</a>' : "");
  document.body.appendChild(bar);
  var bt = bar.querySelector(".c-bot");
  bt.addEventListener("click", function () { var l = document.querySelector(".hb-launch"); if (l) l.click(); });
  // 도우미(chatbot.js)가 늦게 뜨므로 잠시 기다렸다가 버튼을 보여줍니다.
  var n = 0, t = setInterval(function () {
    if (document.querySelector(".hb-launch")) { bt.hidden = false; clearInterval(t); }
    else if (++n > 40) clearInterval(t);
  }, 250);
})();
