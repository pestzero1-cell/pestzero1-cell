/* 문의 전달: content.js 의 inquiryEndpoint(구글 시트 연결 주소)가 있으면 문의를 사장님 시트로 보냅니다. 없으면 아무것도 보내지 않습니다.
 * window.HRC_INQUIRY.enabled / .send(종류, 내용) → Promise */
(function () {
  var S = window.SITE || window.SITE_BOT || {};
  var url = /^https:\/\//.test(S.inquiryEndpoint || "") ? S.inquiryEndpoint : "";
  window.HRC_INQUIRY = {
    enabled: !!url,
    send: function (type, data) {
      if (!url) return Promise.reject(new Error("no endpoint"));
      var body = JSON.stringify({ type: type, data: data, page: location.pathname, at: new Date().toISOString() });
      // 구글 앱스스크립트는 브라우저 응답을 읽을 수 없어 no-cors 로 보냅니다. 전송 자체가 실패하면(오프라인 등) 오류가 납니다.
      return fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: body });
    }
  };
})();
