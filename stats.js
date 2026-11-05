/* 방문자 통계(개인정보 없음): 전화·카카오톡·문자 버튼을 누른 횟수만 사장님 구글 시트 서버에 숫자로 셉니다.
   접속 기기·IP·쿠키를 저장하지 않고, 하루·종류별 숫자 하나만 올라갑니다. 서버(inquiryEndpoint)가 연결돼 있을 때만 동작합니다. */
(function () {
  var S = window.SITE || window.SITE_BOT || {};
  var url = /^https:\/\//.test(S.inquiryEndpoint || "") || /^http:\/\/localhost[:/]/.test(S.inquiryEndpoint || "") ? S.inquiryEndpoint : "";
  if (!url || window.SITE_PREVIEW || window.SITE_DEMO) return;
  try { if (localStorage.getItem("hrc_nostat")) return; } catch (e) {}   // 사장님이 관리자에 로그인한 기기에서는 세지 않습니다
  var last = {};
  function send(t) {
    var now = Date.now();
    if (last[t] && now - last[t] < 10000) return;
    last[t] = now;
    try {
      var body = JSON.stringify({ action: "evt", t: t });
      if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "text/plain;charset=utf-8" }));
      else fetch(url, { method: "POST", body: body, keepalive: true, mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" } });
    } catch (e) {}
  }
  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest("a[href]") : null;
    if (!a) return;
    var h = a.getAttribute("href") || "";
    if (/^tel:/i.test(h)) send("call");
    else if (/^sms:/i.test(h)) send("sms");
    else if (/pf\.kakao\.com|kakao\.com\/o\//i.test(h)) send("kakao");
  }, true);
})();
