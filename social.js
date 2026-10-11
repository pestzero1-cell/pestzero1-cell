/* 푸터에 인스타그램·유튜브 링크를 보여줍니다. 주소는 content.js 의 social (서버 연결 시 관리자 화면에서 바꾼 값). 주소가 없으면 아무것도 안 보입니다. */
(function () {
  var S = window.SITE || window.SITE_BOT || {};
  var IG = /^https:\/\/(www\.)?instagram\.com\/[^\s"'<>]+$/i, YT = /^https:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\/[^\s"'<>]+$/i;
  var ICON = {
    ig: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zM17.2 6a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"/></svg>',
    yt: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>'
  };
  var st = document.createElement("style");
  st.textContent = ".hrc-social{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 12px}.hrc-social a{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:999px;border:1px solid var(--line,#dfe8e3);background:var(--bg,#fff);color:var(--fg,#1c2b25);font-weight:700;font-size:.88rem;text-decoration:none}.hrc-social a:hover{border-color:var(--brand,#12408f);color:var(--brand,#12408f)}.hrc-social .ig svg{color:#d6249f}.hrc-social .yt svg{color:#f00}";
  document.head.appendChild(st);
  function paint(sc) {
    var old = document.querySelector(".hrc-social");
    if (old) old.remove();
    sc = sc || {};
    var items = [];
    if (IG.test(sc.instagram || "")) items.push('<a class="ig" href="' + sc.instagram.replace(/"/g, "") + '" target="_blank" rel="noopener noreferrer">' + ICON.ig + " 인스타그램</a>");
    if (YT.test(sc.youtube || "")) items.push('<a class="yt" href="' + sc.youtube.replace(/"/g, "") + '" target="_blank" rel="noopener noreferrer">' + ICON.yt + " 유튜브</a>");
    var wrap = document.querySelector("footer .wrap");
    if (!items.length || !wrap) return;
    var d = document.createElement("div");
    d.className = "hrc-social";
    d.innerHTML = items.join("");
    wrap.insertBefore(d, wrap.firstChild);
  }
  window.HRC_SOCIAL = { paint: paint };
  var ov = (window.HRC_OVERLAY && window.HRC_OVERLAY.get && window.HRC_OVERLAY.get()) || {};
  paint(ov.social || S.social);
})();
