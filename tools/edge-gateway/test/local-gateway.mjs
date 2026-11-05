// 게이트웨이(worker.js)를 내 컴퓨터에서 http 서버로 띄워 브라우저 시험에 쓰는 도구. 사용: node local-gateway.mjs [포트]
import http from "node:http";
import worker from "../worker.js";
const port = Number(process.argv[2] || 8788), kv = new Map();
const env = { RL: { get: async (k) => kv.get(k) ?? null, put: async (k, v) => { kv.set(k, String(v)); } }, APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || "http://localhost:8787/exec", GATEWAY_SECRET: process.env.GATEWAY_SECRET || "gw-test-secret-xyz", ALLOWED_ORIGIN: process.env.ALLOWED_ORIGIN || "http://localhost:8765", ALLOW_LOCALHOST: "1" };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const h = new Headers(); for (const [k, v] of Object.entries(req.headers)) h.set(k, String(v));
  h.set("CF-Connecting-IP", String(req.headers["x-test-ip"] || (req.socket.remoteAddress || "").replace("::ffff:", "")));
  const r = await worker.fetch(new Request("http://gw" + req.url, { method: req.method, headers: h, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log("local gateway on :" + port));
