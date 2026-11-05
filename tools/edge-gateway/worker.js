// 홈로취케어 문의·후기 접수 관문(게이트웨이) — Cloudflare Workers (무료 플랜 가능). 설정 방법: README.md
// 하는 일: ① 접속자 IP 확인(CF-Connecting-IP) ② 사람 확인(Turnstile, 선택) ③ IP별 접수 한도 ④ 차단 IP 거르기 ⑤ 서명해서 구글 서버(Apps Script)로 전달
// 구글 서버는 이 서명이 있는 접수만 받으므로, 주소를 알아내 직접 보내는 스팸 프로그램은 구글 서버에서 거절됩니다.
//
// 필요한 설정 — 변수/시크릿:  APPS_SCRIPT_URL(구글 웹앱 주소), GATEWAY_SECRET(시크릿, 구글 스크립트 속성의 GATEWAY_SECRET 과 같은 값),
//                           ALLOWED_ORIGIN(내 사이트 주소, 쉼표로 여러 개 가능), TURNSTILE_SECRET(시크릿, 선택)
//            KV 연결:       RL  (IP별 접수 횟수 저장용 KV 네임스페이스)
const LIMITS = { hour: 5, day: 15 };          // IP 하나가 1시간 5건, 하루 15건까지 (가정·사무실 공용 IP를 고려해 넉넉하게)
const BAN_AFTER = 12;                          // 하루에 이만큼 거절당하면 24시간 자동 차단
const MAX_BODY = 20000;

const enc = new TextEncoder();
async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return [...new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(msg)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const rnd = () => [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
const stamp = (d) => d.toISOString().slice(0, 13).replace(/\D/g, "");          // 2026110510 (시간 단위)

function allowedOrigin(req, env) {
  const o = req.headers.get("Origin") || "";
  const list = String(env.ALLOWED_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (list.includes(o)) return o;
  if (env.ALLOW_LOCALHOST === "1" && /^http:\/\/localhost(:\d+)?$/.test(o)) return o;
  return "";
}
function reply(obj, origin, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": origin || "null", "Vary": "Origin", "Cache-Control": "no-store" } });
}

let blockCache = { at: 0, set: new Set() };
async function blocklist(env) {
  if (Date.now() - blockCache.at < 60000) return blockCache.set;
  try {
    const ts = Date.now();
    const sig = await hmacHex(env.GATEWAY_SECRET, "blocklist|" + ts);
    const r = await fetch(env.APPS_SCRIPT_URL + (env.APPS_SCRIPT_URL.includes("?") ? "&" : "?") + `action=blocklist&ts=${ts}&sig=${sig}`);
    const j = await r.json();
    if (j && j.ok) blockCache = { at: Date.now(), set: new Set(j.ips || []) };
  } catch (e) { blockCache.at = Date.now() - 30000; }             // 실패하면 30초 뒤 재시도, 그동안은 이전 목록 사용
  return blockCache.set;
}
async function bump(env, key, ttl) {
  const n = Number((await env.RL.get(key)) || 0) + 1;
  await env.RL.put(key, String(n), { expirationTtl: ttl });
  return n;
}
async function strike(env, ip) {                                    // 거절당할 때마다 쌓아서, 많으면 24시간 자동 차단
  const day = stamp(new Date()).slice(0, 8);
  const n = await bump(env, `s:${ip}:${day}`, 90000);
  if (n >= BAN_AFTER) await env.RL.put(`ban:${ip}`, "1", { expirationTtl: 86400 });
}

export default {
  async fetch(req, env) {
    const origin = allowedOrigin(req, env);
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": origin || "null", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600", "Vary": "Origin" } });
    }
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/submit") return reply({ ok: false, error: "notfound" }, origin, 404);
    if (!origin) return reply({ ok: false, error: "origin" }, "", 403);                 // 우리 사이트가 아닌 곳에서 온 요청 거절
    const ip = req.headers.get("CF-Connecting-IP") || "";
    if (!ip) return reply({ ok: false, error: "noip" }, origin, 400);

    const raw = await req.text();
    if (raw.length > MAX_BODY) return reply({ ok: false, error: "size" }, origin, 413);
    let p;
    try { p = JSON.parse(raw); } catch (e) { return reply({ ok: false, error: "json" }, origin, 400); }
    const d = p.data || {};
    if (d.website) return reply({ ok: true }, origin);                                   // 숨은 칸(봇)은 조용히 성공처럼 응답

    // 1) 차단된 IP
    if (await env.RL.get(`ban:${ip}`) || (await blocklist(env)).has(ip)) return reply({ ok: true }, origin);   // 차단됐다는 걸 알려주지 않음

    // 2) IP별 접수 한도
    const hour = await bump(env, `h:${ip}:${stamp(new Date())}`, 4000), day = await bump(env, `d:${ip}:${stamp(new Date()).slice(0, 8)}`, 90000);
    if (hour > LIMITS.hour || day > LIMITS.day) { await strike(env, ip); return reply({ ok: false, error: "busy" }, origin, 429); }

    // 3) 사람 확인(Turnstile)
    if (env.TURNSTILE_SECRET) {
      const tok = String(p.ts_token || "");
      let pass = false;
      if (tok) {
        const f = new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: tok, remoteip: ip });
        try { pass = !!(await (await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: f })).json()).success; } catch (e) {}
      }
      if (!pass) { await strike(env, ip); return reply({ ok: false, error: "human" }, origin, 403); }
    }

    // 4) 서명해서 구글 서버로 전달 (구글 서버는 이 서명이 없는 접수를 받지 않음)
    delete p.ts_token; delete p.tk; delete p.gw;
    const ts = Date.now(), n = rnd();
    p.gw = { ip, ts, n, cc: (req.cf && req.cf.country) || "", sig: await hmacHex(env.GATEWAY_SECRET, `${ip}|${ts}|${n}`) };
    let j;
    try {
      const r = await fetch(env.APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(p) });
      j = await r.json();
    } catch (e) { return reply({ ok: false, error: "upstream" }, origin, 502); }
    if (!j.ok && (j.error === "content" || j.error === "consent")) await strike(env, ip);      // 광고 글·동의 없는 요청을 반복하면 점점 차단 쪽으로
    return reply(j, origin);
  },
};
