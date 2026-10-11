// Code.gs 를 구글 없이 내 컴퓨터에서 그대로 돌려 보는 시험용 서버입니다. (구글 서비스는 가짜로 흉내냄)
// 사용: node gas-local.js [포트] [관리자비밀번호]   → http://localhost:포트/exec
const fs = require("fs"), vm = require("vm"), http = require("http"), path = require("path"), crypto = require("crypto");
const port = Number(process.argv[2] || 8787), PW = process.argv[3] || "test-password-1";
const sleepLog = [], sentMail = [];
const sheets = {}, props = { ADMIN_PASSWORD: PW }, cacheData = {}, files = {};
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
  console, Date, JSON, Math, Number, String, Array, Error, Object,
  SpreadsheetApp: { getActive: () => ({ getSheetByName: (n) => sheets[n] || null, insertSheet: (n) => (sheets[n] = mkSheet(n)) }) },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => { props[k] = v; } }) },
  CacheService: { getScriptCache: () => ({ get: (k) => (cacheData[k] && cacheData[k].exp > Date.now() ? cacheData[k].v : null), put: (k, v, s) => { cacheData[k] = { v, exp: Date.now() + s * 1000 }; }, remove: (k) => { delete cacheData[k]; } }) },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  Utilities: { sleep: (ms) => { sleepLog.push(ms); }, getUuid: () => crypto.randomUUID(), base64Decode: (s) => Array.from(Buffer.from(s, "base64")), newBlob: (bytes, mime, name) => ({ bytes, mime, name }) },
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
    if (u.pathname === "/_debug") { res.writeHead(200, cors); return res.end(JSON.stringify({ sleepLog, sentMail, props: Object.keys(props), logs: (sheets["기록"] ? sheets["기록"]._rows : []) })); }
    const out = req.method === "POST" ? ctx.doPost({ postData: { contents: body } }) : ctx.doGet({ parameter: Object.fromEntries(u.searchParams) });
    res.writeHead(200, { ...cors, "Content-Type": "text/plain;charset=utf-8" });
    res.end(out.t);
  });
}).listen(port, () => console.log("local GAS on :" + port));
