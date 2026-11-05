/* 문의 전달: content.js 의 inquiryEndpoint(구글 시트 연결 주소)가 있으면 문의를 사장님 시트로 보냅니다. 없으면 아무것도 보내지 않습니다.
 * 스팸 방지: 보내기 전에 서버에서 "접수 표"를 받고 짧은 계산 퀴즈(브라우저가 자동으로 풂)를 풀어 함께 보냅니다. 사람에게는 보이지 않습니다.
 * window.HRC_INQUIRY.enabled / .send(종류, 내용) / .sendAction(동작, 내용) → Promise (실패하면 Error: busy · ticket · consent · …) */
(function () {
  var S = window.SITE || window.SITE_BOT || {};
  var url = /^https:\/\//.test(S.inquiryEndpoint || "") || /^http:\/\/localhost[:/]/.test(S.inquiryEndpoint || "") ? S.inquiryEndpoint : "";
  var gw = /^https:\/\//.test(S.gatewayUrl || "") || /^http:\/\/localhost[:/]/.test(S.gatewayUrl || "") ? String(S.gatewayUrl).replace(/\/+$/, "") : "";
  var siteKey = /^[0-9A-Za-z_-]{10,80}$/.test(S.turnstileSiteKey || "") ? S.turnstileSiteKey : "";
  var ready = null; // 미리 받아 둔 표(한 번 쓰면 새로 받음)
  var tokP = null;  // 미리 받아 둔 사람 확인 토큰(게이트웨이 모드)

  // ---- 게이트웨이 모드: 사람 확인(Turnstile, 선택) 후 게이트웨이로 전송 ----
  function loadTs() {
    return new Promise(function (res, rej) {
      if (window.turnstile) return res();
      var s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true; s.onload = res; s.onerror = function () { rej(new Error("human")); };
      document.head.appendChild(s);
    });
  }
  function humanToken() {
    if (!siteKey) return Promise.resolve("");
    if (tokP) return tokP;
    tokP = loadTs().then(function () {
      return new Promise(function (res, rej) {
        var box = document.createElement("div");
        box.style.cssText = "position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:300";
        document.body.appendChild(box);
        var done = function () { setTimeout(function () { box.remove(); }, 400); };
        window.turnstile.render(box, { sitekey: siteKey, appearance: "interaction-only", callback: function (t) { done(); res(t); }, "error-callback": function () { done(); rej(new Error("human")); } });
        setTimeout(function () { rej(new Error("human")); }, 90000);
      });
    }).catch(function (e) { tokP = null; throw e; });
    return tokP;
  }
  function postGw(payload) {
    return humanToken().then(function (tok) {
      tokP = null;                                                  // 토큰은 한 번만
      if (tok) payload.ts_token = tok;
      return fetch(gw + "/submit", { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "fail");
      return j;
    });
  }

  function lead(u8) { var c = 0; for (var i = 0; i < u8.length; i++) { if (u8[i] === 0) { c += 8; continue; } c += Math.clz32(u8[i]) - 24; break; } return c; }
  function solve(tk) {
    if (!window.crypto || !crypto.subtle) return Promise.reject(new Error("no-crypto"));
    var enc = new TextEncoder(), bits = tk.bits || 15, n = 0, BATCH = 256;
    return new Promise(function (res, rej) {
      (function step() {
        var jobs = [];
        for (var i = 0; i < BATCH; i++) jobs.push(crypto.subtle.digest("SHA-256", enc.encode(tk.t + ":" + tk.sig + ":" + (n + i))));
        Promise.all(jobs).then(function (hs) {
          for (var k = 0; k < hs.length; k++) if (lead(new Uint8Array(hs[k])) >= bits) return res(n + k);
          n += BATCH;
          if (n > 4000000) return rej(new Error("pow-fail"));
          setTimeout(step, 0);
        }, rej);
      })();
    });
  }
  function prepare() {
    if (gw) return humanToken().catch(function () {});
    if (!url) return Promise.reject(new Error("no endpoint"));
    if (ready) return ready;
    ready = fetch(url + (url.indexOf("?") < 0 ? "?" : "&") + "action=ticket", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "ticket");
      var got = Date.now();
      return solve(j).then(function (n) { return { t: j.t, sig: j.sig, n: n, got: got }; });
    }).catch(function (e) { ready = null; throw e; });
    return ready;
  }
  function post(payload) {
    if (gw) return postGw(payload);
    return prepare().then(function (tk) {
      ready = null;                                                  // 표는 한 번만 쓸 수 있음
      var wait = Math.max(0, 2800 - (Date.now() - tk.got));          // 서버는 발급 2.5초 뒤부터 받습니다
      return new Promise(function (r) { setTimeout(r, wait); }).then(function () {
        payload.tk = { t: tk.t, sig: tk.sig, n: tk.n };
        return fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) });
      });
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || "fail");
      return j;
    });
  }
  window.HRC_INQUIRY = {
    enabled: !!(url || gw),
    prepare: function () { return prepare().catch(function () {}); },
    sendAction: function (action, data) { return post({ action: action, data: data, page: location.pathname }); },
    send: function (type, data) { return post({ type: type, data: data, page: location.pathname, at: new Date().toISOString() }); }
  };
  // 양식에 손을 대는 순간 미리 표를 받아 두어, 보내기 버튼을 눌렀을 때 기다리지 않게 합니다.
  if (url || gw) document.addEventListener("focusin", function (e) { if (e.target && e.target.closest && e.target.closest("form")) window.HRC_INQUIRY.prepare(); });
})();
