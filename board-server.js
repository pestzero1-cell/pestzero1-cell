/* 고객센터(서버 연결 버전): 공지사항 · 이용후기 · 1:1 문의.
 * content.js 의 inquiryEndpoint(서버 주소)가 있을 때 board.js 대신 이 화면이 쓰입니다.
 *  - 공지사항 / 이용후기: 사장님이 관리자 화면에서 올린 내용을 보여줍니다.
 *  - 후기 남기기: 고객이 쓰면 사장님이 승인한 뒤에 게시됩니다.
 *  - 1:1 문의: 사장님에게만 전달됩니다(다른 고객에게 보이지 않음). */
(function () {
  window.HRC_BOARD_SERVER = function () {
    var S = window.SITE || {}, B = S.board || {}, root = document.getElementById("board-root");
    if (!root) return;
    var e = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
    var st = { tab: "notice", open: -1, msg: "" };
    var data = function () { return { notices: S.notices || [], reviews: S.reviews || [] }; };
    var css = document.createElement("style");
    css.textContent = ".sb h3{margin:0 0 12px}.sb-n{border:1px solid var(--line);border-radius:12px;margin:8px 0;background:var(--bg)}.sb-n button{display:flex;width:100%;gap:10px;align-items:baseline;justify-content:space-between;text-align:left;background:none;border:0;padding:14px 16px;font:inherit;color:inherit;cursor:pointer}.sb-n b{font-weight:700}.sb-n .d{color:var(--muted);font-size:.85rem;white-space:nowrap}.sb-n .bd{padding:0 16px 16px;white-space:pre-wrap;color:var(--fg)}" +
      ".sb-r{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin:10px 0;background:var(--bg)}.sb-r .s{color:#f5a000;letter-spacing:2px}.sb-r .w{color:var(--muted);font-size:.88rem;margin-top:6px}" +
      ".sb form{display:grid;gap:10px;margin-top:16px;border-top:1px solid var(--line);padding-top:16px}.sb label{display:block;font-size:.88rem;color:var(--muted);font-weight:700}.sb input,.sb select,.sb textarea{width:100%;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:10px;padding:10px 12px;font:inherit;margin-top:4px}.sb textarea{min-height:110px}" +
      ".sb .go{justify-self:start;background:var(--brand);color:var(--on,#fff);border:0;border-radius:999px;padding:12px 26px;font-weight:700;cursor:pointer}.sb .ok{background:rgba(26,138,74,.14);color:#1a7a44;padding:10px 14px;border-radius:10px;font-weight:700;margin:0 0 12px}.sb .er{background:rgba(192,48,48,.14);color:#b02a2a;padding:10px 14px;border-radius:10px;font-weight:700;margin:0 0 12px}.sb .hp{position:absolute;left:0;top:0;width:0;height:0;opacity:0;pointer-events:none;border:0;padding:0}.sb .pn{color:var(--muted);font-size:.85rem}.sb .cs{display:flex;gap:8px;align-items:flex-start;font-size:.85rem;font-weight:400}.sb .cs input{width:auto;margin-top:3px;flex:none}.sb .cs a{text-decoration:underline}";
    document.head.appendChild(css);
    var TABS = [["notice", "공지사항"], ["review", "이용후기"], ["inq", "1:1 문의"]];
    function draw() {
      root.innerHTML = '<div class="wrap about" style="padding-block:24px 56px"><aside class="about-side"><p class="h2like">' + e(B.title || "고객센터") + '</p><div class="ptabs" id="btabs" role="tablist">' +
        TABS.map(function (t) { return '<button type="button" role="tab" data-b="' + t[0] + '" aria-selected="' + (st.tab === t[0]) + '">' + t[1] + "</button>"; }).join("") + '</div></aside><section class="about-main sb" id="sb-main" aria-live="polite"></section></div>';
      view();
    }
    function hp() { return '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">'; }
    function stars(n) { n = Math.max(1, Math.min(5, +n || 5)); return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }
    function view() {
      var m = document.getElementById("sb-main"), d = data(), msg = st.msg ? '<p class="' + (st.err ? "er" : "ok") + '">' + e(st.msg) + "</p>" : "";
      st.msg = ""; st.err = false;
      if (st.tab === "notice") {
        m.innerHTML = "<h3>공지사항</h3>" + (d.notices.length ? d.notices.map(function (n, i) { return '<div class="sb-n"><button type="button" data-o="' + i + '" aria-expanded="' + (st.open === i) + '"><b>' + e(n.title) + '</b><span class="d">' + e(n.date) + "</span></button>" + (st.open === i ? '<div class="bd">' + e(n.body) + "</div>" : "") + "</div>"; }).join("") : '<p class="pn">등록된 공지가 없습니다.</p>');
      } else if (st.tab === "review") {
        m.innerHTML = msg + "<h3>이용후기</h3>" + (d.reviews.length ? d.reviews.map(function (r) { return '<div class="sb-r"><span class="s" aria-label="별점 ' + (+r.stars || 5) + '점">' + stars(r.stars) + "</span><p style=\"margin:6px 0 0;max-width:none\">" + e(r.text) + '</p><p class="w">' + e(r.name) + (r.area ? " · " + e(r.area) : "") + "</p></div>"; }).join("") : '<p class="pn">아직 등록된 후기가 없습니다.</p>') +
          '<form id="rf"><h3 style="margin:0">후기 남기기</h3><label>이름<input name="name" required maxlength="20" autocomplete="name"></label><label>연락처 (사장님만 봅니다, 선택)<input name="phone" type="tel" maxlength="30" autocomplete="tel"></label><label>별점<select name="stars"><option value="5">★★★★★ 매우 만족</option><option value="4">★★★★☆ 만족</option><option value="3">★★★☆☆ 보통</option><option value="2">★★☆☆☆ 아쉬움</option><option value="1">★☆☆☆☆ 불만족</option></select></label><label>후기 내용<textarea name="text" required maxlength="600"></textarea></label>' + hp() + '<label class="cs"><input type="checkbox" name="consent" required> <span><a href="' + (window.SITE_BASE || "../") + 'privacy/" target="_blank" rel="noopener">개인정보 수집·이용</a>에 동의합니다. (이름·연락처·내용 / 응대·게시 확인 목적 / ' + e((S.privacy && S.privacy.retention) || "처리 완료 후 1년") + ' 보관)</span></label>' + '<p class="pn">남겨주신 후기는 확인 후 게시됩니다. 연락처는 공개되지 않습니다.</p><button class="go" type="submit">후기 보내기</button></form>';
      } else {
        m.innerHTML = msg + "<h3>1:1 문의</h3><p class=\"pn\" style=\"margin:0 0 4px\">남겨주신 내용은 사장님에게만 전달되며 다른 분께 보이지 않습니다. 급하시면 전화 " + e(S.phone) + "로 연락 주세요.</p>" +
          '<form id="qf"><label>문의 종류<select name="svc">' + (S.contactOptions || ["방역", "하수구", "기타"]).map(function (o) { return "<option>" + e(o) + "</option>"; }).join("") + '</select></label><label>이름<input name="name" required maxlength="20" autocomplete="name"></label><label>연락처<input name="phone" type="tel" required maxlength="30" autocomplete="tel"></label><label>문의 내용<textarea name="msg" required maxlength="1500" placeholder="지역과 증상을 간단히 적어주세요"></textarea></label>' + hp() + '<label class="cs"><input type="checkbox" name="consent" required> <span><a href="' + (window.SITE_BASE || "../") + 'privacy/" target="_blank" rel="noopener">개인정보 수집·이용</a>에 동의합니다. (이름·연락처·내용 / 응대·게시 확인 목적 / ' + e((S.privacy && S.privacy.retention) || "처리 완료 후 1년") + ' 보관)</span></label>' + '<button class="go" type="submit">문의 보내기</button></form>';
      }
    }
    function send(btn, fn, okMsg) {
      btn.disabled = true;
      fn().then(function () { st.msg = okMsg; st.err = false; view(); }).catch(function () { st.msg = "전송에 실패했습니다. 전화 " + S.phone + " 로 문의해 주세요."; st.err = true; view(); }).then(function () { btn.disabled = false; });
    }
    root.addEventListener("click", function (ev) {
      var t = ev.target.closest("[data-b]"); if (t) { st.tab = t.getAttribute("data-b"); st.open = -1; draw(); return; }
      var o = ev.target.closest("[data-o]"); if (o) { var i = +o.getAttribute("data-o"); st.open = st.open === i ? -1 : i; view(); }
    });
    root.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target, d = {}; new FormData(f).forEach(function (v, k) { d[k] = v; }); d.consent = d.consent ? 1 : 0;
      var btn = f.querySelector("button[type=submit]");
      if (f.id === "rf") send(btn, function () { return window.HRC_INQUIRY.sendAction("review_submit", d); }, "후기를 보내주셔서 감사합니다. 확인 후 게시됩니다.");
      else if (f.id === "qf") send(btn, function () { return window.HRC_INQUIRY.send("1:1문의", d); }, "문의가 접수되었습니다. 남겨주신 연락처로 답변드리겠습니다.");
    });
    draw();
    // 최신 공지·후기를 받아서 갱신
    if (window.HRC_OVERLAY) window.HRC_OVERLAY.fresh().then(function (j) { if (j) { if (j.notices) S.notices = j.notices; if (j.reviews) S.reviews = j.reviews; if (st.tab !== "notice" || st.open < 0) view(); } });
  };
})();
