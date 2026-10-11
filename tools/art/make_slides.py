# 메인 슬라이드용 깔끔한 일러스트(SVG)를 만들고 images/sl-*.jpg 로 저장합니다. (python3 tools/art/make_slides.py)
import pathlib, subprocess, sys
OUT = pathlib.Path(__file__).resolve().parents[2] / "images"
W, H = 960, 720
def wrap(bg1, bg2, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{bg1}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>
<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7bff"/><stop offset="1" stop-color="#1b46b8"/></linearGradient>
<linearGradient id="or" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff8a4a"/><stop offset="1" stop-color="#e5560f"/></linearGradient>
<filter id="sd" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0b2a6b" flood-opacity=".22"/></filter>
</defs>
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<circle cx="840" cy="110" r="190" fill="#fff" opacity=".35"/><circle cx="90" cy="650" r="230" fill="#fff" opacity=".28"/>
{body}</svg>'''
def spark(x, y, s=1, c="#fff"):
    return f'<path transform="translate({x} {y}) scale({s})" d="M0-22 L5-5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5-5Z" fill="{c}"/>'
def shield(x, y, s=1):
    return f'''<g transform="translate({x} {y}) scale({s})" filter="url(#sd)"><path d="M0-120 L100-84 V10 C100 76 52 118 0 140 C-52 118 -100 76 -100 10 V-84Z" fill="url(#sh)"/>
<path d="M0-96 L80-68 V8 C80 62 42 96 0 114 C-42 96 -80 62 -80 8 V-68Z" fill="#fff" opacity=".14"/>
<path d="M-42 6 L-12 38 L46 -28" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"/></g>'''

# 1. 집 + 방역 보호막
s1 = wrap("#e6f0ff", "#bcd3ff", f'''
<ellipse cx="480" cy="640" rx="360" ry="34" fill="#0b2a6b" opacity=".12"/>
<g filter="url(#sd)"><path d="M150 330 L480 110 L810 330 V610 H150Z" fill="#fff"/><path d="M110 340 L480 92 L850 340" fill="none" stroke="#1b46b8" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/></g>
<rect x="215" y="400" width="130" height="130" rx="14" fill="#dbe8ff"/><path d="M280 400V530M215 465H345" stroke="#fff" stroke-width="8"/>
<rect x="615" y="400" width="130" height="130" rx="14" fill="#dbe8ff"/><path d="M680 400V530M615 465H745" stroke="#fff" stroke-width="8"/>
<rect x="415" y="430" width="130" height="180" rx="14" fill="#f26a21"/><circle cx="525" cy="525" r="8" fill="#fff"/>
{shield(480, 280, 1.0)}
{spark(215, 215, 1.4)}{spark(745, 190, 1.1)}{spark(860, 470, 0.9)}{spark(100, 470, 0.8)}
<g transform="translate(760 560)" filter="url(#sd)"><rect x="-26" y="-50" width="52" height="96" rx="12" fill="url(#or)"/><rect x="-14" y="-78" width="28" height="30" rx="6" fill="#0f2d6b"/><rect x="-6" y="-92" width="44" height="12" rx="6" fill="#0f2d6b"/><circle cx="0" cy="-2" r="14" fill="#fff" opacity=".9"/></g>
''')

# 2. 싱크대 배수구 + 렌치
s2 = wrap("#e8f6ff", "#b9dcff", f'''
<ellipse cx="480" cy="650" rx="370" ry="30" fill="#0b2a6b" opacity=".12"/>
<g filter="url(#sd)"><rect x="140" y="410" width="680" height="220" rx="26" fill="#fff"/><rect x="190" y="440" width="430" height="150" rx="40" fill="#cfe3fb"/><rect x="215" y="465" width="380" height="100" rx="30" fill="#eaf3ff"/></g>
<ellipse cx="405" cy="520" rx="60" ry="22" fill="#9db9e6"/><ellipse cx="405" cy="520" rx="38" ry="12" fill="#6f90cc"/>
<g filter="url(#sd)"><path d="M330 410 V250 C330 190 380 170 430 170 H540 V225 H440 C410 225 395 235 395 260 V410Z" fill="#c9d6ea"/><rect x="520" y="150" width="70" height="96" rx="18" fill="#9fb4d4"/><rect x="540" y="236" width="30" height="30" rx="6" fill="#9fb4d4"/></g>
<path d="M555 266 C555 300 575 312 575 340 C575 365 535 365 535 340 C535 312 555 300 555 266Z" fill="#3b9bff"/>
<path d="M555 345 C555 372 590 380 590 405" stroke="#3b9bff" stroke-width="10" stroke-linecap="round" fill="none" opacity=".55"/>
<g transform="translate(700 330) rotate(-35)" filter="url(#sd)"><rect x="-14" y="-10" width="30" height="230" rx="14" fill="#7c8da8"/><path d="M-50 -10 H52 V-70 Q0 -120 -50 -70Z" fill="#7c8da8"/><circle cx="0" cy="-70" r="20" fill="#bcd3ff" opacity=".7"/></g>
<g filter="url(#sd)"><circle cx="205" cy="270" r="76" fill="url(#sh)"/><path d="M168 272 L196 302 L244 242" fill="none" stroke="#fff" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></g>
{spark(120, 140, 1.2)}{spark(840, 150, 1.0)}{spark(860, 330, 0.8)}
''')

# 3. 침대 + 보호막 (빈대)
s3 = wrap("#fff1e6", "#ffd6b8", f'''
<ellipse cx="480" cy="640" rx="370" ry="30" fill="#7a3200" opacity=".12"/>
<g filter="url(#sd)"><rect x="120" y="260" width="40" height="370" rx="14" fill="#8a4a1f"/><rect x="800" y="360" width="40" height="270" rx="14" fill="#8a4a1f"/>
<rect x="140" y="440" width="680" height="120" rx="24" fill="#fff"/><rect x="140" y="520" width="680" height="60" rx="14" fill="#1b46b8"/>
<rect x="170" y="390" width="190" height="80" rx="34" fill="#f6f9ff"/><rect x="380" y="410" width="400" height="80" rx="30" fill="#dbe8ff"/><path d="M420 410 V490 M520 410 V490 M620 410 V490 M720 410 V490" stroke="#fff" stroke-width="6" opacity=".6"/></g>
<rect x="150" y="580" width="40" height="50" rx="10" fill="#6b3512"/><rect x="770" y="580" width="40" height="50" rx="10" fill="#6b3512"/>
{shield(480, 235, 0.95)}
<g filter="url(#sd)"><circle cx="800" cy="150" r="58" fill="#ffd46b"/><circle cx="822" cy="136" r="48" fill="#ffecc0"/></g>
{spark(180, 170, 1.3, "#fff")}{spark(300, 100, 0.9, "#fff")}{spark(860, 300, 0.9, "#fff")}{spark(110, 400, 0.8, "#fff")}
''')

# 4. 단가표 클립보드 + 동전
rows = "".join(f'<rect x="270" y="{250+i*70}" width="46" height="46" rx="12" fill="#e4eeff"/><path d="M281 {273+i*70} l10 11 l17 -22" fill="none" stroke="#1b46b8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="340" y="{258+i*70}" width="{[260,210,300,180][i%4]}" height="14" rx="7" fill="#c9d9f5"/><rect x="340" y="{282+i*70}" width="{[160,130,180,110][i%4]}" height="12" rx="6" fill="#e1eafa"/>' for i in range(4))
s4 = wrap("#e6f0ff", "#c6dbff", f'''
<ellipse cx="480" cy="650" rx="330" ry="28" fill="#0b2a6b" opacity=".12"/>
<g filter="url(#sd)"><rect x="210" y="110" width="440" height="540" rx="30" fill="#fff"/><rect x="340" y="82" width="180" height="70" rx="22" fill="#0f2d6b"/><circle cx="430" cy="118" r="14" fill="#fff"/></g>
{rows}
<rect x="270" y="548" width="330" height="62" rx="16" fill="url(#or)"/><text x="435" y="592" text-anchor="middle" font-family="Noto Sans CJK KR, Noto Sans KR, sans-serif" font-size="34" font-weight="800" fill="#fff">투명한 가격 안내</text>
<g filter="url(#sd)"><circle cx="740" cy="330" r="100" fill="#ffd46b"/><circle cx="740" cy="330" r="76" fill="none" stroke="#e8a92a" stroke-width="8"/><text x="740" y="362" text-anchor="middle" font-family="Noto Sans CJK KR, sans-serif" font-size="96" font-weight="800" fill="#c98512">₩</text></g>
<g filter="url(#sd)"><circle cx="790" cy="510" r="64" fill="#ffe08f"/><circle cx="790" cy="510" r="48" fill="none" stroke="#e8a92a" stroke-width="6"/></g>
<g filter="url(#sd)"><circle cx="700" cy="590" r="46" fill="url(#sh)"/><path d="M679 592 L696 609 L724 572" fill="none" stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></g>
{spark(150, 220, 1.3)}{spark(830, 180, 1.0)}{spark(120, 520, 0.8)}
''')

names = ["sl-home", "sl-drain", "sl-bed", "sl-price"]
svgs = [s1, s2, s3, s4]
tmp = pathlib.Path(__file__).parent
for n, s in zip(names, svgs):
    (tmp / (n + ".svg")).write_text(s, encoding="utf-8")
js = """const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:960,height:720}});
for(const n of %s){await p.goto('file://%s/'+n+'.svg');await p.screenshot({path:'%s/'+n+'.jpg',type:'jpeg',quality:86});}await b.close()})()""" % (names, tmp, OUT)
(tmp / "_r.js").write_text(js)
subprocess.check_call(["node", str(tmp / "_r.js")], env={**__import__("os").environ, "NODE_PATH": subprocess.check_output(["npm", "root", "-g"]).decode().strip()})
(tmp / "_r.js").unlink()
for n in names: (tmp / (n + ".svg")).unlink()
print("ok", names)
