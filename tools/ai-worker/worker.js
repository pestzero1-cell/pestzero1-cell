// 홈로취케어 도우미용 AI 답변 서버 (Cloudflare Workers 예시). 설정 방법: README.md
// 환경 변수(Secrets): ANTHROPIC_API_KEY  / 일반 변수: ALLOWED_ORIGIN (예: https://내도메인.com)
const SYSTEM = `당신은 방역·하수구 전문업체 "홈로취케어"(대표번호 1661-6179)의 홈페이지 상담 도우미입니다.
규칙:
- 한국어로, 3~5문장 이내로 쉽고 친절하게 답합니다.
- 확실하지 않은 내용은 추측하지 말고 전화 1661-6179 상담을 안내합니다.
- 가격은 확정해서 말하지 않습니다. "현장 상황에 따라 달라질 수 있어 전문가 확인이 필요합니다"라고 안내합니다.
- 빈대 문의는 반드시 전문가 상담(1661-6179)을 안내합니다.
- 서비스: 바퀴벌레·개미·쥐·기타해충 방제, 소독, 하수구 막힘 뚫음, 하수구 트랩(냄새·해충 차단). 출장비 0원, 미해결시 0원.
- 의료·법률 판단, 다른 업체 비교·비방, 업무와 무관한 질문에는 답하지 않고 정중히 사양합니다.`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const ok = !env.ALLOWED_ORIGIN || origin === env.ALLOWED_ORIGIN;
    const cors = { "Access-Control-Allow-Origin": ok ? origin || "*" : "null", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (req.method === "OPTIONS") return new Response(null, { headers: cors });
    if (req.method !== "POST" || !ok) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: cors });
    let msg = "";
    try { msg = String((await req.json()).message || "").slice(0, 500); } catch (e) {}
    if (!msg.trim()) return new Response(JSON.stringify({ error: "empty" }), { status: 400, headers: cors });
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-5-5", max_tokens: 400, system: SYSTEM, messages: [{ role: "user", content: msg }] }),
    });
    if (!r.ok) return new Response(JSON.stringify({ error: "upstream" }), { status: 502, headers: cors });
    const j = await r.json();
    const answer = (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    return new Response(JSON.stringify({ answer }), { headers: { ...cors, "content-type": "application/json" } });
  },
};
