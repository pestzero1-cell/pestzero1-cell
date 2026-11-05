// 게이트웨이(worker.js) + 구글 서버 코드(Code.gs)를 내 컴퓨터에서 함께 돌려 보는 시험.
// 사용: GATEWAY_SECRET=테스트비밀 node ../../inquiry-server/test/gas-local.js 8787 test-password-1234567  (다른 창)  →  GATEWAY_SECRET=테스트비밀 node gateway.test.mjs
const SECRET = process.env.GATEWAY_SECRET || "gw-test-secret-xyz";
const A = "http://localhost:8787/exec", PW = "test-password-1234567", ORIGIN = "https://example.com";
let fails = 0;
const ok = (c, m) => { console.log((c ? "PASS " : "FAIL ") + m); if (!c) fails++; };
const realFetch = globalThis.fetch;
globalThis.fetch = (u, o) => {                                   // 사람 확인(Turnstile) 서버는 흉내
  if (String(u).startsWith("https://challenges.cloudflare.com/")) { const t = new URLSearchParams(o.body).get("response"); return Promise.resolve(new Response(JSON.stringify({ success: t === "good" }))); }
  return realFetch(u, o);
};
const kv = () => { const m = new Map(); return { get: async (k) => m.get(k) ?? null, put: async (k, v) => { m.set(k, String(v)); } }; };
const mod = async (tag) => (await import(`../worker.js?${tag}`)).default;
const call = (w, env, body, { ip = "9.9.9.9", origin = ORIGIN, cc } = {}) => {
  const h = { "Content-Type": "text/plain" }; if (origin) h.Origin = origin; if (ip) h["CF-Connecting-IP"] = ip;
  const rq = new Request("https://gw.example.workers.dev/submit", { method: "POST", headers: h, body: JSON.stringify(body) });
  if (cc) Object.defineProperty(rq, "cf", { value: { country: cc } });          // Cloudflare 가 붙여 주는 접속 국가를 흉내
  return w.fetch(rq, env).then(async (r) => ({ status: r.status, ...(await r.json()) }));
};
const mk = (extra = {}) => ({ RL: kv(), APPS_SCRIPT_URL: A, GATEWAY_SECRET: SECRET, ALLOWED_ORIGIN: ORIGIN, ...extra });
const inq = (n, msg, phone) => ({ type: "문의", data: { name: n, phone: phone || "010-1234-" + String(Math.floor(Math.random() * 9000) + 1000), msg, consent: 1 }, page: "/" });
const api = (b) => realFetch(A, { method: "POST", body: JSON.stringify(b) }).then((r) => r.json());

const w = await mod("a"), env = mk();
// 구글 서버는 게이트웨이를 거치지 않은 접수를 거절
ok((await api({ type: "문의", data: { name: "봇", phone: "010-1", msg: "직접 전송", consent: 1 } })).error === "gateway", "구글 서버로 직접 보낸 접수는 거절");
// 정상
let r = await call(w, env, inq("홍길동", "구로구 싱크대가 막혔어요. 방문 가능한가요?"), { ip: "1.2.3.4" });
ok(r.ok === true, "게이트웨이를 거친 정상 접수");
const t = (await api({ action: "login", password: PW })).token;
let list = (await api({ action: "inq_list", token: t })).items;
ok(list[0] && list[0].ip === "1.2.3.4", "접수에 접속 IP 기록: " + (list[0] && list[0].ip));
// 출처·IP
ok((await call(w, env, inq("a", "다른 사이트에서"), { origin: "https://evil.example" })).status === 403, "허용되지 않은 사이트에서 온 요청 거절");
ok((await call(w, env, inq("a", "IP 없음"), { ip: "" })).status === 400, "IP를 알 수 없는 요청 거절");
// 재전송(replay)
const sigBody = { type: "문의", data: { name: "재전송", phone: "010-0000-0000", msg: "서명 재사용", consent: 1 }, gw: { ip: "5.5.5.5", ts: Date.now(), n: "abc" } };
const crypto = await import("node:crypto");
sigBody.gw.sig = crypto.createHmac("sha256", SECRET).update(`5.5.5.5|${sigBody.gw.ts}|abc`).digest("hex");
ok((await api(sigBody)).ok === true, "올바른 서명은 통과(게이트웨이 역할을 흉내)");
ok((await api(sigBody)).error === "gateway", "같은 서명 재사용(replay) 거절");
const forged = { ...sigBody, gw: { ...sigBody.gw, n: "zzz", sig: crypto.createHmac("sha256", "wrong-secret").update(`5.5.5.5|${sigBody.gw.ts}|zzz`).digest("hex") } };
ok((await api(forged)).error === "gateway", "비밀값이 다른 위조 서명 거절");
const stale = { ...sigBody, gw: { ip: "5.5.5.5", ts: Date.now() - 3600000, n: "old" } }; stale.gw.sig = crypto.createHmac("sha256", SECRET).update(`5.5.5.5|${stale.gw.ts}|old`).digest("hex");
ok((await api(stale)).error === "gateway", "오래된 서명 거절");
// 스팸 내용
r = await call(w, env, inq("광고", "카지노 바카라 http://spam.com http://spam2.com 대박"), { ip: "2.2.2.2" });
ok(r.ok === false && r.error === "content", "광고·링크 글 거절");
r = await call(w, env, inq("광고2", "무료 코인 리딩방 입장 텔레그램 @spam"), { ip: "2.2.2.2" });
ok(r.error === "content", "리딩방·텔레그램 광고 거절");
r = await call(w, env, inq("영문", "Please visit my website for the best offers and deals today"), { ip: "2.2.2.2" });
ok(r.error === "content", "한글 없는 긴 글 거절");
list = (await api({ action: "inq_list", token: t })).items;
ok(!list.some((x) => /카지노|리딩방|best offers/.test(x.msg)), "스팸은 시트에 쌓이지 않음");
// 반복 위반 → 자동 차단
let lastOk; for (let i = 0; i < 14; i++) lastOk = await call(w, env, inq("광고" + i, "카지노 바카라 사이트 " + i), { ip: "3.3.3.3" });
r = await call(w, env, inq("정상처럼", "이제는 정상 문장으로 보냅니다 " + Math.random()), { ip: "3.3.3.3" });
list = (await api({ action: "inq_list", token: t })).items;
ok(!list.some((x) => x.msg.startsWith("이제는 정상 문장")), "반복 위반 IP는 자동 차단(이후 정상 글도 저장 안 됨)");
// IP별 한도
let okc = 0, busy = 0; for (let i = 0; i < 8; i++) { const x = await call(w, env, inq("한도" + i, "한도 시험 문장 번호 " + i + " " + Math.random()), { ip: "4.4.4.4" }); if (x.ok) okc++; else if (x.error === "busy") busy++; }
ok(okc === 5 && busy === 3, `IP별 1시간 5건 한도 (접수 ${okc}, 차단 ${busy})`);
// 관리자 차단 → 게이트웨이 차단목록 반영
await api({ action: "ip_block", token: t, ip: "6.6.6.6", reason: "시험" });
const w2 = await mod("b"), env2 = mk();
r = await call(w2, env2, inq("차단", "차단된 IP에서 보낸 글 " + Math.random()), { ip: "6.6.6.6" });
list = (await api({ action: "inq_list", token: t })).items;
ok(r.ok === true && !list.some((x) => x.msg.startsWith("차단된 IP에서")), "관리자가 차단한 IP는 접수되지 않음(차단 사실을 알려주지 않음)");
ok((await api({ action: "ip_list", token: t })).items.some((x) => x.ip === "6.6.6.6"), "차단 목록 조회");
await api({ action: "ip_unblock", token: t, ip: "6.6.6.6" });
ok(!(await api({ action: "ip_list", token: t })).items.some((x) => x.ip === "6.6.6.6"), "차단 해제");
const bl = await (await realFetch(A + "?action=blocklist&ts=" + Date.now() + "&sig=bad")).json();
ok(bl.ok === false, "차단 목록은 서명 없이 못 가져감");
// Turnstile
const w3 = await mod("c"), env3 = mk({ TURNSTILE_SECRET: "x" });
r = await call(w3, env3, inq("사람확인", "사람 확인 없이 보낸 글 " + Math.random()), { ip: "7.7.7.7" });
ok(r.error === "human", "사람 확인 토큰이 없으면 거절");
r = await call(w3, env3, { ...inq("사람확인", "틀린 토큰 " + Math.random()), ts_token: "bad" }, { ip: "7.7.7.7" });
ok(r.error === "human", "틀린 토큰 거절");
r = await call(w3, env3, { ...inq("사람확인", "맞는 토큰으로 보낸 정상 문의 " + Math.random()), ts_token: "good" }, { ip: "7.7.7.7" });
ok(r.ok === true, "맞는 토큰이면 접수");
// 후기
r = await call(w, env, { action: "review_submit", data: { name: "김후기", stars: 5, text: "친절하고 꼼꼼하게 작업해 주셨습니다.", consent: 1 } }, { ip: "8.8.8.8" });
ok(r.ok === true, "후기도 게이트웨이를 거쳐 접수");
r = await call(w, env, { action: "review_submit", data: { name: "광고", stars: 5, text: "카지노 토토 사이트 http://a.com http://b.com", consent: 1 } }, { ip: "8.8.4.4" });
ok(r.error === "content", "광고 후기 거절");
ok((await api({ action: "rev_pending", token: t })).items.some((x) => x.ip === "8.8.8.8"), "대기 후기에도 접속 IP 기록");
// 해외 IP 차단
{
  const wg = await mod("geo"), eg = mk();
  let g = await call(wg, eg, inq("해외", "미국에서 보낸 문의입니다 " + Math.random()), { ip: "11.1.1.1", cc: "US" });
  ok(g.error === "geo" && g.status === 403, "해외(US) 접속은 문의 거절");
  g = await call(wg, eg, inq("국내", "한국에서 보낸 정상 문의입니다 " + Math.random()), { ip: "11.1.1.2", cc: "KR" });
  ok(g.ok === true, "국내(KR) 접속은 접수");
  g = await call(wg, eg, inq("모름", "국가를 알 수 없는 정상 문의 " + Math.random()), { ip: "11.1.1.3" });
  ok(g.ok === true, "국가 정보가 없으면 접수(시험·내부 환경)");
  g = await call(wg, mk({ ALLOWED_COUNTRIES: "KR,JP" }), inq("일본", "일본에서 보낸 문의입니다 " + Math.random()), { ip: "11.1.1.4", cc: "JP" });
  ok(g.ok === true, "허용 국가 목록(KR,JP)에 있으면 접수");
  g = await call(wg, mk({ ALLOWED_COUNTRIES: "*" }), inq("전체", "모든 국가 허용 설정 문의 " + Math.random()), { ip: "11.1.1.5", cc: "US" });
  ok(g.ok === true, "ALLOWED_COUNTRIES=* 이면 모든 국가 허용");
  g = await call(wg, eg, inq("토르", "토르망 접속 문의입니다 " + Math.random()), { ip: "11.1.1.6", cc: "T1" });
  ok(g.error === "geo", "Tor 망(T1) 접속 거절");
}
console.log(fails ? "FAILURES " + fails : "ALL PASS");
process.exit(fails ? 1 : 0);
