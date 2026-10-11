/* build.py 가 만드는 파일입니다. 직접 고치지 마세요. 내용이 바뀌면 버전이 바뀌어 옛 저장본이 지워집니다. */
const V = "hrc-ed10e1e101";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (ev) => {
  ev.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith("hrc-") && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// 항상 최신을 먼저 받고(인터넷 연결 시), 연결이 안 될 때만 저장본을 보여줍니다.
self.addEventListener("fetch", (ev) => {
  const r = ev.request;
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return;
  ev.respondWith(fetch(r).then((res) => {
    if (res.ok) { const c = res.clone(); caches.open(V).then((ch) => ch.put(r, c)); }
    return res;
  }).catch(() => caches.match(r).then((m) => m || caches.match("./index.html"))));
});
