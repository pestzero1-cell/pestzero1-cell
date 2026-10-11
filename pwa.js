/* 앱처럼 설치(홈 화면 추가)·접속이 불안정할 때 최근 본 화면 보여주기. https 로 열렸을 때만 동작합니다. */
(function () {
  if (!("serviceWorker" in navigator) || window.SITE_PREVIEW) return;
  if (!/^https?:$/.test(location.protocol)) return;
  var cs = document.currentScript;
  if (!cs || !cs.src) return;
  window.addEventListener("load", function () {
    navigator.serviceWorker.register(new URL("sw.js", cs.src).href).catch(function () {});
  });
})();
