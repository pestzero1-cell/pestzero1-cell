// Code.gs 를 구글 없이 내 컴퓨터에서 그대로 돌려 보는 시험용 서버입니다. (구글 서비스는 가짜로 흉내냄)
// 사용: node gas-local.js [포트] [관리자비밀번호]   → http://localhost:포트/exec
const fs = require("fs"), vm = require("vm"), http = require("http"), path = require("path"), crypto = require("crypto");
const port = Number(process.argv[2] || 8787), PW = process.argv[3] || "test-password-1";
const sleepLog = [], sentMail = [], fetches = [], ghFiles = {};
let fetchStatus = 200;
const sheets = {}, props = { ADMIN_PASSWORD: PW, ...(process.env.SMS_TEST ? { SMS_API_KEY: "NCSTESTKEY", SMS_API_SECRET: "testsecret", SMS_FROM: "010-9999-8888", SMS_TO: "010-1234-5678", SMS_DAILY_MAX: process.env.SMS_DAILY_MAX || "30" } : {}), ...(process.env.GH_TEST ? { GITHUB_TOKEN: "TESTTOKEN", GITHUB_REPO: "me/site", GITHUB_BRANCH: "main" } : {}), ...(process.env.GATEWAY_SECRET ? { GATEWAY_SECRET: process.env.GATEWAY_SECRET } : {}) }, cacheData = {}, files = {};
function mkSheet(name) {
  const rows = [];
  const sh = {
    getLastRow: () => rows.length,
    appendRow: (r) => { rows.push(r.slice()); },
    deleteRow: (i) => { rows.splice(i - 1, 1); },
    getRange: (r, c, nr = 1, nc = 1) => ({
      getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (rows[r - 1 + i] || [])[c - 1 + j] ?? "")),
      getValue: () => (rows[r - 1] || [])[c - 1] ?? "",
      setValues: (v) => v.forEach((row, i) => row.forEach((x, j) => { (rows[r - 1 + i] = rows[r - 1 + i] || [])[c - 1 + j] = x; })),
      setValue: (x) => { (rows[r - 1] = rows[r - 1] || [])[c - 1] = x; },
    }),
    _rows: rows,
  };
  return sh;
}
const ctx = {
  Logger: { log: (m) => console.log("[Logger]", m) },
  console, Date, JSON, Math, Number, String, Array, Error, Object,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mkSheet(n)) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: (k) => { delete props[k]; }, getProperties: () => ({ ...props }) }) },
  CacheService: { getScriptCache: () => ({ get: (k) => (cacheData[k] && cacheData[k].exp > Date.now() ? cacheData[k].v : null), put: (k, v, s) => { cacheData[k] = { v, exp: Date.now() + s * 1000 }; }, remove: (k) => { delete cacheData[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
    computeDigest: (alg, s) => Array.from(crypto.createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : Buffer.from(s)).digest()).map((b) => (b > 127 ? b - 256 : b)),
    computeHmacSha256Signature: (v, k) => Array.from(crypto.createHmac("sha256", typeof k === "string" ? Buffer.from(k, "utf8") : Buffer.from(k.map((b) => b & 255))).update(typeof v === "string" ? Buffer.from(v, "utf8") : Buffer.from(v.map((b) => b & 255))).digest()).map((b) => (b > 127 ? b - 256 : b)),
    computeHmacSha1Signature: (v, k) => Array.from(crypto.createHmac("sha1", Buffer.from(k.map((b) => b & 255))).update(Buffer.from(v.map((b) => b & 255))).digest()).map((b) => (b > 127 ? b - 256 : b)),
    sleep: (ms) => { sleepLog.push(ms); }, getUuid: () => crypto.randomUUID(), base64Decode: (s) => Array.from(Buffer.from(s, "base64")), base64Encode: (x, cs) => (typeof x === "string" ? Buffer.from(x, "utf8") : Buffer.from(x.map((b) => b & 255))).toString("base64"), newBlob: (bytes, mime, name) => ({ bytes, mime, name, getDataAsString: () => Buffer.from(bytes.map((b) => b & 255)).toString("utf8") }) },
  UrlFetchApp: { fetch: (u, o) => {
    fetches.push({ u, o });
    const m = /^https:\/\/api\.github\.com\/repos\/([^/]+\/[^/]+)\/contents\/([^?]*)(\?.*)?$/.exec(u);
    if (m) {   // 모의 GitHub 저장소(contents API)
      const path = decodeURIComponent(m[2]).replace(/\/$/, ""), meth = String(o.method || "get").toLowerCase(), R = (c, j) => ({ getResponseCode: () => c, getContentText: () => JSON.stringify(j) });
      if ((o.headers || {}).Authorization !== "Bearer TESTTOKEN") return R(401, { message: "Bad credentials" });
      if (meth === "get") {
        if (ghFiles[path] !== undefined) return R(200, { type: "file", sha: "sha" + ghFiles[path].length, content: ghFiles[path].replace(/(.{60})/g, "$1\n"), encoding: "base64" });
        const kids = Object.keys(ghFiles).filter((k) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/"));
        return kids.length ? R(200, kids.map((k) => ({ type: "file", name: k.slice(path.length + 1), path: k }))) : R(404, { message: "Not Found" });
      }
      const body = JSON.parse(o.payload || "{}");
      if (meth === "put") { if (ghFiles[path] !== undefined && body.sha !== "sha" + ghFiles[path].length) return R(409, { message: "sha mismatch" }); const had = ghFiles[path] !== undefined; ghFiles[path] = body.content; return R(had ? 200 : 201, { content: { path } }); }
      if (meth === "delete") { if (ghFiles[path] === undefined || body.sha !== "sha" + ghFiles[path].length) return R(409, {}); delete ghFiles[path]; return R(200, {}); }
    }
    return { getResponseCode: () => fetchStatus, getContentText: () => "{}" };
  } },
  MailApp: { sendEmail: (...a) => { sentMail.push(a); } },
  ContentService: { MimeType: { JSON: "json" }, createTextOutput: (t) => ({ t, setMimeType() { return this; } }) },
  DriveApp: { Access: { ANYONE_WITH_LINK: 1 }, Permission: { VIEW: 1 },
    getFoldersByName: () => ({ hasNext: () => true, next: () => ({ createFile: (b) => { const id = "1" + crypto.randomBytes(16).toString("hex") + Object.keys(files).length; files[id] = b; return { getId: () => id, setSharing() {} }; } }) }),
    createFolder: () => ({}) },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "Code.gs"), "utf8"), ctx);
http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
  if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
  const u = new URL(req.url, "http://x");
  let body = "";
  req.on("data", (d) => (body += d));
  req.on("end", () => {
    if (u.pathname === "/_repo") { res.writeHead(200, cors); return res.end(JSON.stringify(ghFiles)); }
    if (u.pathname === "/_fetch") { if (u.searchParams.get("status")) fetchStatus = Number(u.searchParams.get("status")); res.writeHead(200, cors); return res.end(JSON.stringify({ fetches, props })); }
    if (u.pathname === "/_run") { const fn = u.searchParams.get("fn"); res.writeHead(200, cors); return res.end(JSON.stringify({ r: ctx[fn] ? ctx[fn]() : null, props })); }
    if (u.pathname === "/_debug") { res.writeHead(200, cors); return res.end(JSON.stringify({ sleepLog, sentMail, props: Object.keys(props), logs: (sheets["기록"] ? sheets["기록"]._rows : []) })); }
    const out = req.method === "POST" ? ctx.doPost({ postData: { contents: body } }) : ctx.doGet({ parameter: Object.fromEntries(u.searchParams) });
    res.writeHead(200, { ...cors, "Content-Type": "text/plain;charset=utf-8" });
    res.end(out.t);
  });
}).listen(port, () => console.log("local GAS on :" + port));
