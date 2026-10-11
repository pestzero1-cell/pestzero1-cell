# 첫 화면 타일용 깔끔한 일러스트(images/ti-*.jpg) 생성. (python3 tools/art/make_tiles.py)
import pathlib, subprocess, os
OUT = pathlib.Path(__file__).resolve().parents[2] / "images"; HERE = pathlib.Path(__file__).parent
W, H = 800, 700
def wrap(c1, c2, body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{c1}"/><stop offset="1" stop-color="{c2}"/></linearGradient>
<linearGradient id="bl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7bff"/><stop offset="1" stop-color="#1b46b8"/></linearGradient>
<filter id="sd" x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0b2a6b" flood-opacity=".22"/></filter></defs>
<rect width="{W}" height="{H}" fill="url(#bg)"/><circle cx="700" cy="90" r="170" fill="#fff" opacity=".35"/><circle cx="60" cy="640" r="190" fill="#fff" opacity=".28"/>
<ellipse cx="400" cy="600" rx="270" ry="26" fill="#0b2a6b" opacity=".12"/>{body}</svg>'''
def ok(x, y, r=46):
    return f'<g filter="url(#sd)"><circle cx="{x}" cy="{y}" r="{r}" fill="url(#bl)"/><path d="M{x-r*.42} {y+2} L{x-r*.1} {y+r*.34} L{x+r*.46} {y-r*.32}" fill="none" stroke="#fff" stroke-width="{r*.22}" stroke-linecap="round" stroke-linejoin="round"/></g>'
def spark(x, y, s=1):
    return f'<path transform="translate({x} {y}) scale({s})" d="M0-22 L5-5 L22 0 L5 5 L0 22 L-5 5 L-22 0 L-5-5Z" fill="#fff"/>'
drop = lambda x, y, s=1: f'<path transform="translate({x} {y}) scale({s})" d="M0-34 C0-8 22 2 22 22 C22 40-22 40-22 22 C-22 2 0-8 0-34Z" fill="#3b9bff"/>'

laundry = wrap("#e8f6ff", "#bcdcff", f'''
<g filter="url(#sd)"><rect x="250" y="130" width="300" height="420" rx="34" fill="#fff"/><rect x="250" y="130" width="300" height="80" rx="34" fill="#dbe8ff"/><circle cx="300" cy="170" r="12" fill="#1b46b8"/><circle cx="340" cy="170" r="12" fill="#f26a21"/><circle cx="400" cy="360" r="108" fill="#c9d9f5"/><circle cx="400" cy="360" r="84" fill="#7fb0ff"/><circle cx="400" cy="360" r="84" fill="none" stroke="#fff" stroke-width="10" opacity=".5"/></g>
<path d="M330 360 q35-40 70 0 t70 0" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".8"/>
<rect x="190" y="560" width="420" height="22" rx="11" fill="#9db9e6"/>{drop(215,520,1.1)}{drop(590,500,.9)}{ok(590,170,44)}{spark(150,150,1.3)}{spark(660,360,1)}''')
toilet = wrap("#e6f0ff", "#c3d8ff", f'''
<g filter="url(#sd)"><rect x="300" y="110" width="200" height="190" rx="24" fill="#fff"/><rect x="320" y="130" width="160" height="26" rx="13" fill="#dbe8ff"/><circle cx="470" cy="270" r="14" fill="#f26a21"/>
<path d="M240 330 H560 C560 450 500 540 400 540 C300 540 240 450 240 330Z" fill="#fff"/><ellipse cx="400" cy="332" rx="160" ry="44" fill="#eef4ff"/><ellipse cx="400" cy="340" rx="118" ry="28" fill="#9ec3ff"/><rect x="350" y="530" width="100" height="56" rx="14" fill="#dbe8ff"/></g>
{drop(400,334,.8)}{ok(610,160,44)}{spark(170,200,1.3)}{spark(650,440,1)}''')
urinal = wrap("#e8f6ff", "#bddcff", f'''
<g filter="url(#sd)"><rect x="210" y="90" width="380" height="510" rx="26" fill="#d4e4fb"/><path d="M290 140 H510 V330 C510 470 450 540 400 540 C350 540 290 470 290 330Z" fill="#fff"/><path d="M330 180 H470 V330 C470 430 430 490 400 490 C370 490 330 430 330 330Z" fill="#e6f0ff"/><ellipse cx="400" cy="470" rx="26" ry="14" fill="#7fa6e6"/><rect x="380" y="80" width="40" height="70" rx="12" fill="#9fb4d4"/></g>
{drop(400,300,.9)}{ok(640,150,44)}{spark(150,220,1.3)}{spark(650,420,1)}''')
thaw = wrap("#e9f3ff", "#c6dcf7", f'''
<g filter="url(#sd)"><rect x="140" y="250" width="520" height="150" rx="75" fill="#fff"/><rect x="140" y="250" width="520" height="150" rx="75" fill="none" stroke="#c9d9f5" stroke-width="10"/><rect x="190" y="290" width="420" height="70" rx="35" fill="#dbe8ff"/></g>
{''.join(f'<g transform="translate({x} {y}) rotate({a})"><path d="M0-40V40M-35-20L35 20M-35 20L35-20" stroke="#6fb3ff" stroke-width="9" stroke-linecap="round"/><circle r="9" fill="#fff"/></g>' for x,y,a in [(230,160,0),(400,130,15),(570,165,-10),(300,500,10),(500,510,0)])}
<path d="M200 330 q30-30 60 0 t60 0 t60 0 t60 0 t60 0" stroke="#2a62d6" stroke-width="9" fill="none" stroke-linecap="round" opacity=".55"/>
{drop(250,440,1.1)}{drop(400,460,1.3)}{drop(550,440,1.1)}{ok(640,130,44)}''')
pipe = wrap("#e6f0ff", "#c3d8ff", f'''
<g filter="url(#sd)"><rect x="200" y="90" width="60" height="500" rx="12" fill="#8fa6cc"/><rect x="190" y="90" width="80" height="26" rx="8" fill="#6f87b3"/><rect x="190" y="560" width="80" height="26" rx="8" fill="#6f87b3"/>
<rect x="540" y="90" width="60" height="500" rx="12" fill="#8fa6cc"/><rect x="530" y="90" width="80" height="26" rx="8" fill="#6f87b3"/><rect x="530" y="560" width="80" height="26" rx="8" fill="#6f87b3"/>
<rect x="260" y="270" width="280" height="64" rx="10" fill="#8fa6cc"/><rect x="255" y="262" width="26" height="80" rx="8" fill="#6f87b3"/><rect x="519" y="262" width="26" height="80" rx="8" fill="#6f87b3"/>
<rect x="190" y="420" width="80" height="26" rx="8" fill="#6f87b3"/></g>
<rect x="228" y="130" width="4" height="420" fill="#fff" opacity=".35"/><rect x="568" y="130" width="4" height="420" fill="#fff" opacity=".35"/>
{drop(400,380,1.4)}{ok(400,160,50)}{spark(120,180,1.3)}{spark(690,500,1)}''')
items = {"ti-laundry": laundry, "ti-toilet": toilet, "ti-urinal": urinal, "ti-thaw": thaw, "ti-pipe": pipe}
for n, s in items.items(): (HERE / (n + ".svg")).write_text(s, encoding="utf-8")
js = """const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:800,height:700}});
for(const n of %s){await p.goto('file://%s/'+n+'.svg');await p.screenshot({path:'%s/'+n+'.jpg',type:'jpeg',quality:86});}await b.close()})()""" % (list(items), HERE, OUT)
(HERE / "_r.js").write_text(js)
subprocess.check_call(["node", str(HERE / "_r.js")], env={**os.environ, "NODE_PATH": subprocess.check_output(["npm", "root", "-g"]).decode().strip()})
(HERE / "_r.js").unlink()
for n in items: (HERE / (n + ".svg")).unlink()
