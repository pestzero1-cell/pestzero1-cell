// 홈 화면(index.html)의 내용을 미리 그려서 index.html 안에 넣어 둡니다. (검색엔진·느린 휴대폰에서 빠르게 보이도록)
// build.py 가 자동으로 실행합니다. 실행하려면 node 와 playwright 가 필요하고, 없으면 건너뜁니다(홈은 기존처럼 자바스크립트로 그려짐).
const fs = require("fs"), path = require("path");
const { chromium } = require("playwright");
(async () => {
  const root = path.resolve(__dirname, "..");
  const file = path.join(root, "index.html");
  const exe = process.env.PLAYWRIGHT_CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
  const b = await chromium.launch(exe ? { executablePath: exe } : {});
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto("file://" + file);
  await p.waitForSelector("#app .why-card, #app footer", { timeout: 15000 });
  const html = await p.evaluate(() => document.getElementById("app").innerHTML);
  await b.close();
  let src = fs.readFileSync(file, "utf8");
  const re = /<div id="app">[\s\S]*?<\/div>\s*(?=<script>window\.SITE_PREVIEW|<script src="content\.js">|<script>)/;
  const marker = /(<!--PRERENDER-START-->)[\s\S]*?(<!--PRERENDER-END-->)/;
  if (!marker.test(src)) { console.error("index.html 에 PRERENDER 표식이 없습니다."); process.exit(2); }
  src = src.replace(marker, (m, a, z) => a + "\n" + html + "\n" + z);
  fs.writeFileSync(file, src);
  console.log("prerender ok (" + html.length + " bytes)");
})().catch(e => { console.error(e.message); process.exit(1); });
