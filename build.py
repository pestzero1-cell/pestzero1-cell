#!/usr/bin/env python3
"""홈로취케어 정적 사이트 빌더.

사용법:  python3 build.py
- content.js 의 내용으로 메뉴별 개별 페이지(price/, system/, info/, drain/, about/)를 만듭니다.
- posts/*.md 글을 posts/<주소>/index.html 로 만들고, 글 목록·RSS·sitemap.xml·robots.txt 를 만듭니다.
- 결과 파일은 저장소 루트에 생기며, 그대로 GitHub Pages 등에 올리면 됩니다.
"""
import html, json, re, subprocess, sys, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent
TODAY = datetime.date.today().isoformat()


def load_site():
    js = "global.window={};require('./content.js');console.log(JSON.stringify(window.SITE))"
    out = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    return json.loads(out)


S = load_site()
SITE_URL = (S.get("siteUrl") or "").rstrip("/")
PLACEHOLDER = not SITE_URL
if PLACEHOLDER:
    SITE_URL = "https://YOUR-DOMAIN.example"
    print("⚠ content.js 의 siteUrl 이 비어 있어 sitemap/canonical 에 임시 주소를 썼습니다. 도메인이 정해지면 siteUrl 을 채우고 다시 빌드하세요.")

e = lambda t: html.escape(str(t if t is not None else ""), quote=True)
br = lambda t: e(t).replace("\n", "<br>")
bold = lambda t: re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", e(t)).replace("\n", "<br>")
BRAND = S.get("brand", "홈로취케어")

ICONS = {
    "monitor": '<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><rect x="8" y="10" width="48" height="34" rx="4"/><path d="M22 54h20M32 44v10"/></svg>',
    "click": '<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="10" width="44" height="32" rx="4"/><path d="M18 52h20M28 42v10M40 28l14 8-6 2 5 8-4 2-5-8-4 4z"/></svg>',
    "note": '<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 12h36v30L38 54H14z"/><path d="M38 54V42h12M22 8v8M32 8v8M42 8v8M22 26h20M22 34h14"/></svg>',
    "phone": '<svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10l8 2 4 10-6 4c3 8 7 12 14 16l4-6 10 4 2 8c-4 6-12 6-20 2C18 42 10 30 10 20c0-6 2-9 6-10z"/><path d="M40 8h14v10H46l-4 4z"/></svg>',
}

# ---------------------------------------------------------------- 공통 조각
def rel(depth):
    return "../" * depth if depth else ""


def img_src(path, depth):
    return rel(depth) + path if path and not re.match(r"^(https?:|/|data:)", path) else path


def text_of_section(sec):
    """페이지 설명(meta description)용 첫 문장."""
    for key in ("intro",):
        if sec.get(key):
            return sec[key]
    for key in ("bullets", "notes"):
        if sec.get(key):
            return sec[key][0]
    t = sec.get("table")
    if t and t.get("rows"):
        parts = []
        for c in t["rows"][0]:
            parts.append(c["t"] if isinstance(c, dict) and "t" in c else (c if isinstance(c, str) else ""))
        return " ".join(p for p in parts if p)
    return ""


def clip(t, n=120):
    t = re.sub(r"\s+", " ", re.sub(r"\*\*", "", str(t))).strip()
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


def cell(c, depth, boldcol=False):
    if isinstance(c, dict) and c.get("img"):
        return '<td style="text-align:center"><img class="cellimg" loading="lazy" src="%s" alt="%s"><br><span style="font-size:.85rem;color:var(--muted)">%s</span></td>' % (
            e(img_src(c["img"], depth)), e(c.get("t", "")), e(c.get("t", "")))
    o = isinstance(c, dict)
    t = br(c["t"] if o else c)
    attrs = ""
    if o and c.get("rs"):
        attrs += ' rowspan="%d"' % c["rs"]
    if o and c.get("cs"):
        attrs += ' colspan="%d"' % c["cs"]
    if boldcol or (o and c.get("b")):
        attrs += ' style="font-weight:700"'
    return "<td%s>%s</td>" % (attrs, t)


def table(t, depth):
    if not t:
        return ""
    cap = '<tr><th colspan="%d">%s</th></tr>' % (len(t["head"]), e(t["caption"])) if t.get("caption") else ""
    head = "".join("<th>%s</th>" % e(h) for h in t["head"])
    bc = t.get("boldCols") or []
    rows = "".join("<tr>%s</tr>" % "".join(cell(c, depth, i in bc) for i, c in enumerate(r)) for r in t["rows"])
    return '<div class="tbl"><table><thead>%s<tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (cap, head, rows)


def bullets(b):
    return '<ul class="bl">%s</ul>' % "".join("<li>%s</li>" % e(x) for x in b) if b else ""


def section_html(s, depth):
    out = []
    if s.get("imageTop"):
        out.append('<img class="pimg" loading="lazy" src="%s" alt="">' % e(img_src(s["imageTop"], depth)))
    if s.get("heading"):
        out.append('<h2 class="ph">%s</h2>' % e(s["heading"]))
    if s.get("intro"):
        out.append('<p class="introbox">%s</p>' % br(s["intro"]))
    if s.get("lead"):
        out.append('<p class="safe" style="margin:8px 0 14px">◆ %s</p>' % e(s["lead"]))
    for n in s.get("notes") or []:
        out.append('<p class="red">※ %s</p>' % e(n))
    if s.get("bulletsFirst"):
        out.append(bullets(s.get("bullets")))
    out.append(table(s.get("table"), depth))
    if s.get("afterNote"):
        out.append('<p class="red">※ %s</p>' % e(s["afterNote"]))
    if not s.get("bulletsFirst"):
        out.append(bullets(s.get("bullets")))
    if s.get("images"):
        out.append('<div class="pgrid">%s</div>' % "".join('<img loading="lazy" src="%s" alt="">' % e(img_src(x, depth)) for x in s["images"]))
    if s.get("image"):
        out.append('<img class="pimg" loading="lazy" src="%s" alt="">' % e(img_src(s["image"], depth)))
    if s.get("footer"):
        out.append('<p class="safe">◆ %s</p>' % e(s["footer"]))
    if s.get("steps"):
        out.append('<div class="sysSteps">%s</div>' % "".join(
            '<div><b>0%d</b>%s<p>%s</p></div>' % (i + 1, ICONS.get(x.get("icon"), ""), bold(x["text"])) for i, x in enumerate(s["steps"])))
    if s.get("contact"):
        c = s["contact"]
        st = ' style="background-image:url(\'%s\')"' % e(img_src(c["image"], depth)) if c.get("image") else ""
        out.append('<div class="contact-card"><div><b>%s</b><span class="bigtel">%s</span></div><div class="cc-img"%s></div></div>' % (e(c["label"]), e(c["phone"]), st))
    return "".join(out)


# ---------------------------------------------------------------- 페이지 뼈대
def about_items():
    a = S["about"]
    g, o = a["greeting"], a["org"]
    greeting = {"slug": "greeting", "label": g["title"], "custom": (
        '<p class="lead">%s<br><em>%s</em></p>%s' % (e(g["headline"]), e(g["highlight"]), "".join("<p>%s</p>" % e(p) for p in g["paragraphs"])),
        g["headline"] + " " + g["highlight"])}
    teams = "".join('<div class="team"><h3>%s</h3><ul style="padding:0">%s</ul></div>' % (e(t["name"]), "".join("<li>%s</li>" % e(m) for m in t["members"])) for t in o["teams"])
    org = {"slug": "organization", "label": o["title"], "custom": (
        '<p class="slogan">%s</p><div class="ceo">%s</div><div class="teams">%s</div>' % (e(o["slogan"]), e(o["ceo"]), teams), o["slogan"])}
    return [greeting, org]


SECTIONS = []  # (key, title, dir, items)
SECTIONS.append(("about", S["about"]["title"], "about", about_items()))
for key, d in (("price", "price"), ("system", "system"), ("info", "info"), ("drain", "drain")):
    SECTIONS.append((key, S[key]["title"], d, S[key]["items"]))

MENU_TARGET = {}  # 섹션 key → 첫 페이지 경로
for key, title, d, items in SECTIONS:
    MENU_TARGET[key] = "%s/%s/" % (d, items[0]["slug"])


def nav_html(depth, current_key=None):
    links = [
        ("회사소개", MENU_TARGET["about"], "about"),
        ("서비스단가표", MENU_TARGET["price"], "price"),
        ("서비스시스템", MENU_TARGET["system"], "system"),
        ("소독/해충정보", MENU_TARGET["info"], "info"),
        ("하수구막힘 뚫음", MENU_TARGET["drain"], "drain"),
        ("현장일지", "posts/", "posts"),
        ("고객센터", "index.html#support", "support"),
    ]
    return "".join('<a href="%s%s"%s>%s</a>' % (rel(depth), h, ' aria-current="page"' if k == current_key else "", e(l)) for l, h, k in links)


def head(title, desc, path, depth, og_image=None, extra="", jsonld=None):
    canon = "%s/%s" % (SITE_URL, path)
    img = og_image or S.get("ogImage") or S.get("logo") or ""
    og_img = "%s/%s" % (SITE_URL, img) if img and not img.startswith("http") else img
    verify = ""
    if S.get("naverVerification"):
        verify += '<meta name="naver-site-verification" content="%s">\n' % e(S["naverVerification"])
    if S.get("googleVerification"):
        verify += '<meta name="google-site-verification" content="%s">\n' % e(S["googleVerification"])
    ld = '<script type="application/ld+json">%s</script>\n' % json.dumps(jsonld, ensure_ascii=False) if jsonld else ""
    return """<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%s</title>
<meta name="description" content="%s">
<link rel="canonical" href="%s">
<meta property="og:type" content="website">
<meta property="og:site_name" content="%s">
<meta property="og:title" content="%s">
<meta property="og:description" content="%s">
<meta property="og:url" content="%s">
%s%s%s<link rel="alternate" type="application/rss+xml" title="%s 현장일지" href="%sposts/rss.xml">
<link rel="stylesheet" href="%sassets/site.css">
%s</head>
""" % (e(title), e(desc), e(canon), e(BRAND), e(title), e(desc), e(canon),
       ('<meta property="og:image" content="%s">\n' % e(og_img)) if og_img else "", verify, extra, e(BRAND), rel(depth), rel(depth), ld)


def header_footer(depth, current_key=None):
    logo = ('<img class="logo-img" src="%s%s" alt="%s — %s">' % (rel(depth), e(S["logo"]), e(BRAND), e(S.get("tagline", "")))) if S.get("logo") else '<span class="mark">H</span><span><b>%s</b></span>' % e(BRAND)
    top = ('<header><div class="wrap top"><a class="logo" href="%sindex.html" aria-label="%s 홈">%s</a><a class="tel" href="tel:%s">☎ %s</a></div>'
           '<nav class="bar" aria-label="주 메뉴"><div class="wrap">%s</div></nav></header>') % (
        rel(depth), e(BRAND), logo, e(re.sub(r"[^0-9+]", "", S["phone"])), e(S["phone"]), nav_html(depth, current_key))
    c = S.get("company") or {}
    blogs = " · ".join('<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>' % (e(b["url"]), e(b["label"])) for b in S.get("blogs", []))
    foot = ('<footer><div class="wrap"><b>%s</b><br>대표 %s · 전화 <a href="tel:%s">%s</a><br>사업자등록번호 %s · 통신판매업신고번호 %s<br>%s<br>%s<br>© %s All rights reserved.</div></footer>') % (
        e(S["pageTitle"]), e(S["owner"]), e(re.sub(r"[^0-9]", "", S["phone"])), e(S["phone"]), e(c.get("bizNo", "")), e(c.get("mailOrderNo", "")), e(c.get("address", "")), blogs, datetime.date.today().year)
    return top, foot


def kakao_fab():
    """카카오톡 채널 주소가 있을 때만 떠 있는 버튼을 만듭니다."""
    u = S.get("kakaoUrl") or ""
    if not re.match(r"^https?://", u):
        return ""
    return '<a class="kk kkfab" href="%s" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#191600" d="M12 3C6.5 3 2 6.6 2 11c0 2.8 1.8 5.3 4.6 6.7l-1 3.6c-.1.3.2.5.5.4l4.2-2.8c.6.1 1.1.1 1.7.1 5.5 0 10-3.6 10-8S17.5 3 12 3z"/></svg>%s</a>' % (e(u), e(S.get("kakaoLabel", "카카오톡 상담")))


def bot_scripts(depth):
    """정적 페이지에 자동응답 도우미를 붙입니다. (bot.enabled 가 true 일 때만)"""
    if not (S.get("bot") or {}).get("enabled", True) or not S.get("bot"):
        return ""
    r = rel(depth)
    return '<script>window.SITE_BASE="%s";</script><script src="%sassets/bot-data.js"></script><script src="%schatbot.js" defer></script>' % (r, r, r)


def crumbs(items, depth):
    return '<nav class="crumbs" aria-label="현재 위치">%s</nav>' % " › ".join(
        '<a href="%s">%s</a>' % (rel(depth) + h, e(t)) if h else "<span>%s</span>" % e(t) for t, h in items)


def build_section_page(key, sec_title, d, items, idx):
    it = items[idx]
    depth = 2
    if it.get("custom"):
        body, d_text = it["custom"]
    else:
        secs = it.get("sections") or []
        body = "".join(section_html(s, depth) for s in secs) or '<p class="soon">내용 준비 중입니다. 전화 %s 로 문의해 주세요.</p>' % e(S["phone"])
        d_text = next((text_of_section(s) for s in secs if text_of_section(s)), "")
    label = it["label"]
    title = "%s | %s | %s" % (label, sec_title, BRAND)
    desc = clip("%s — %s" % (label, d_text) if d_text else "%s 안내. %s %s" % (label, BRAND, S["phone"]))
    path = "%s/%s/" % (d, it["slug"])
    side = "".join('<a href="%s../%s/"%s>%s</a>' % (rel(1) if False else "", x["slug"], ' aria-current="true"' if i == idx else "", e(x["label"])) for i, x in enumerate(items))
    top, foot = header_footer(depth, key)
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": BRAND, "item": SITE_URL + "/"},
        {"@type": "ListItem", "position": 2, "name": sec_title, "item": "%s/%s/%s/" % (SITE_URL, d, items[0]["slug"])},
        {"@type": "ListItem", "position": 3, "name": label, "item": "%s/%s" % (SITE_URL, path)}]}
    page = head(title, desc, path, depth, jsonld=ld) + "<body>\n" + top + """
<main>
<div class="wrap">%s</div>
<div class="wrap about" style="padding-block:24px 56px">
<aside class="about-side"><p class="h2like">%s</p><nav class="ptabs side" aria-label="%s 메뉴">%s</nav></aside>
<article class="about-main"><h1>%s</h1>%s</article>
</div>
</main>
%s
%s
<a class="btn fab" href="tel:%s">📞 %s</a>
</body>
</html>
""" % (crumbs([(BRAND, "index.html"), (sec_title, None), (label, None)], depth), e(sec_title), e(sec_title), side, e(label), body, foot,
       kakao_fab(), e(re.sub(r"[^0-9]", "", S["phone"])), e(S["phone"]))
    page = page.replace("</body>", bot_scripts(depth) + "\n</body>")
    out = ROOT / d / it["slug"]
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page, encoding="utf-8")
    return path, label


# ---------------------------------------------------------------- 현장일지(글)
def inline_md(t):
    t = e(t)
    t = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", lambda m: '<img loading="lazy" src="%s" alt="%s">' % (m.group(2), m.group(1)), t)
    t = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener noreferrer">\1</a>', t)
    t = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", t)
    return t


def md_to_html(md, depth):
    out, para, lst = [], [], []

    def flush():
        nonlocal para, lst
        if para:
            out.append("<p>%s</p>" % "<br>".join(inline_md(x) for x in para))
            para = []
        if lst:
            out.append("<ul>%s</ul>" % "".join("<li>%s</li>" % inline_md(x) for x in lst))
            lst = []

    for line in md.splitlines():
        s = line.rstrip()
        if not s.strip():
            flush(); continue
        m = re.match(r"^(#{2,3})\s+(.*)", s)
        if m:
            flush(); n = len(m.group(1)); out.append("<h%d>%s</h%d>" % (n, inline_md(m.group(2)), n)); continue
        if re.match(r"^[-*]\s+", s):
            if para: flush()
            lst.append(re.sub(r"^[-*]\s+", "", s)); continue
        im = re.match(r"^!\[([^\]]*)\]\(([^)\s]+)\)$", s.strip())
        if im:
            flush(); out.append('<figure><img loading="lazy" src="%s" alt="%s">%s</figure>' % (e(img_src(im.group(2), depth)), e(im.group(1)), ("<figcaption>%s</figcaption>" % e(im.group(1))) if im.group(1) else "")); continue
        if lst: flush()
        para.append(s)
    flush()
    return "\n".join(out)


def parse_post(p):
    raw = p.read_text(encoding="utf-8")
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", raw, re.S)
    meta, body = {}, raw
    if m:
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip().strip('"')
        body = m.group(2)
    slug = meta.get("slug") or re.sub(r"[^a-z0-9가-힣]+", "-", p.stem.lower()).strip("-")
    return {"slug": slug, "title": meta.get("title", p.stem), "date": meta.get("date", TODAY), "description": meta.get("description", ""),
            "image": meta.get("image", ""), "tags": [t.strip() for t in meta.get("tags", "").split(",") if t.strip()],
            "sample": meta.get("sample", "").lower() == "true", "body": body}


posts = []
pdir = ROOT / "posts"
if pdir.exists():
    for f in sorted(pdir.glob("*.md")):
        if f.name.startswith("_"):
            continue
        posts.append(parse_post(f))
posts.sort(key=lambda x: x["date"], reverse=True)


def plain(md):
    return re.sub(r"\s+", " ", re.sub(r"[#*`>\[\]!()\-]", "", re.sub(r"!\[[^\]]*\]\([^)]*\)", "", md))).strip()


def build_post(i, p):
    depth = 2
    path = "posts/%s/" % p["slug"]
    desc = clip(p["description"] or plain(p["body"]))
    body = md_to_html(p["body"], depth)
    top, foot = header_footer(depth, "posts")
    prev_ = posts[i + 1] if i + 1 < len(posts) else None
    next_ = posts[i - 1] if i > 0 else None
    pn = "".join('<a href="../%s/"><small>%s</small><br>%s</a>' % (e(x["slug"]), lab, e(x["title"])) for lab, x in (("이전 글", prev_), ("다음 글", next_)) if x)
    tags = "".join('<span class="tagchip">#%s</span>' % e(t) for t in p["tags"])
    blogs = "".join('<a class="btn ghost" href="%s" target="_blank" rel="noopener noreferrer">%s ↗</a>' % (e(b["url"]), e(b["label"])) for b in S.get("blogs", []))
    ld = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"], "datePublished": p["date"], "dateModified": p["date"],
          "description": desc, "author": {"@type": "Organization", "name": BRAND}, "publisher": {"@type": "Organization", "name": BRAND},
          "mainEntityOfPage": "%s/%s" % (SITE_URL, path)}
    if p["image"]:
        ld["image"] = "%s/%s" % (SITE_URL, p["image"])
    sample = '<p class="sampletag">예시 글입니다 — posts/%s.md 를 실제 내용으로 바꿔 주세요</p>' % e(p["slug"]) if p["sample"] else ""
    page = head("%s | 현장일지 | %s" % (p["title"], BRAND), desc, path, depth, og_image=p["image"] or None, jsonld=ld) + "<body>\n" + top + """
<main><div class="wrap">%s</div>
<article class="wrap post"><h1>%s</h1>%s<p class="pmeta"><time datetime="%s">%s</time> %s</p>
%s<div class="pbody">%s</div>
<aside class="pcta"><b>%s 상담</b><p>증상과 지역을 알려 주시면 빠르게 안내해 드립니다.</p><a class="btn" href="tel:%s">☎ %s</a> %s%s</aside>
<nav class="pn" aria-label="이전 다음 글">%s</nav>
<p><a class="bbtn" href="../">← 현장일지 목록</a></p></article></main>
%s
</body>
</html>
""" % (crumbs([(BRAND, "index.html"), ("현장일지", "posts/"), (p["title"], None)], depth), e(p["title"]), sample, e(p["date"]), e(p["date"].replace("-", ".")), tags,
       ('<img class="phero" src="%s" alt="%s">' % (e(img_src(p["image"], depth)), e(p["title"]))) if p["image"] else "", body,
       e(BRAND), e(re.sub(r"[^0-9]", "", S["phone"])), e(S["phone"]), kakao_fab().replace("kkfab", ""), blogs, pn, foot)
    page = page.replace("</body>", bot_scripts(depth) + "\n</body>")
    out = ROOT / "posts" / p["slug"]
    out.mkdir(parents=True, exist_ok=True)
    (out / "index.html").write_text(page, encoding="utf-8")
    return path


def build_posts_index():
    depth = 1
    top, foot = header_footer(depth, "posts")
    cards = "".join(
        '<article class="pcard"><a href="%s/">%s<h2>%s</h2><p>%s</p><span class="pmeta"><time datetime="%s">%s</time>%s</span></a></article>' % (
            e(p["slug"]), ('<img loading="lazy" src="%s" alt="">' % e(img_src(p["image"], depth))) if p["image"] else '<div class="pnoimg">현장일지</div>',
            e(p["title"]), e(clip(p["description"] or plain(p["body"]), 90)), e(p["date"]), e(p["date"].replace("-", ".")), " · 예시" if p["sample"] else "")
        for p in posts) or '<p class="soon">아직 글이 없습니다. posts/ 폴더에 .md 파일을 추가하고 python3 build.py 를 실행하세요.</p>'
    desc = "홈로취케어·헬로하수구 현장일지. 방역, 하수구 막힘, 배관 현장에서 직접 겪은 사례와 대처법을 기록합니다."
    ld = {"@context": "https://schema.org", "@type": "Blog", "name": "%s 현장일지" % BRAND, "url": "%s/posts/" % SITE_URL}
    page = head("현장일지 | %s" % BRAND, desc, "posts/", depth, jsonld=ld) + "<body>\n" + top + """
<main><div class="wrap">%s<h1 style="margin:10px 0 6px">현장일지</h1><p class="sub">현장에서 직접 해결한 사례와 방역·배관 정보를 기록합니다.</p>
<div class="pgrid2">%s</div></div></main>
%s
</body>
</html>
""" % (crumbs([(BRAND, "index.html"), ("현장일지", None)], depth), cards, foot)
    page = page.replace("</body>", bot_scripts(depth) + "\n</body>")
    (pdir).mkdir(exist_ok=True)
    (pdir / "index.html").write_text(page, encoding="utf-8")


def build_rss():
    items = "".join(
        "<item><title>%s</title><link>%s/posts/%s/</link><guid>%s/posts/%s/</guid><pubDate>%s</pubDate><description>%s</description></item>" % (
            e(p["title"]), SITE_URL, e(p["slug"]), SITE_URL, e(p["slug"]),
            datetime.datetime.strptime(p["date"], "%Y-%m-%d").strftime("%a, %d %b %Y 09:00:00 +0900"), e(clip(p["description"] or plain(p["body"]))))
        for p in posts)
    (pdir / "rss.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>%s 현장일지</title><link>%s/posts/</link><description>방역·하수구·배관 현장일지</description><language>ko</language>%s</channel></rss>\n' % (
            e(BRAND), SITE_URL, items), encoding="utf-8")


def build_bot_data():
    data = {"phone": S["phone"], "kakaoUrl": S.get("kakaoUrl", ""), "bot": S.get("bot")}
    (ROOT / "assets").mkdir(exist_ok=True)
    (ROOT / "assets" / "bot-data.js").write_text("// build.py 가 자동으로 만드는 파일입니다. 직접 고치지 마세요.\nwindow.SITE_BOT=%s;\n" % json.dumps(data, ensure_ascii=False), encoding="utf-8")


def build_posts_data():
    data = [{"slug": p["slug"], "title": p["title"], "date": p["date"], "description": clip(p["description"] or plain(p["body"]), 80), "image": p["image"], "sample": p["sample"]} for p in posts[:6]]
    (ROOT / "posts-data.js").write_text("// build.py 가 자동으로 만드는 파일입니다. 직접 고치지 마세요.\nwindow.POSTS=%s;\n" % json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")


def build_css():
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    css = re.search(r"<style>(.*?)</style>", src, re.S).group(1)
    extra = """
/* ---- 정적 페이지 전용 ---- */
.kkfab{position:fixed;right:16px;bottom:calc(84px + env(safe-area-inset-bottom,0px));z-index:20;box-shadow:0 6px 18px rgba(0,0,0,.25)}
.crumbs{font-size:.85rem;color:var(--muted);padding:14px 0 0}.crumbs a:hover{color:var(--brand);text-decoration:underline}
.ptabs.side{display:flex;flex-wrap:wrap}.ptabs.side a{flex:1 1 auto;padding:13px 18px;border-bottom:1px solid var(--line);color:var(--fg)}
.ptabs.side a[aria-current]{background:var(--card);color:var(--brand);font-weight:700}
@media(min-width:1000px){.ptabs.side{flex-direction:column}}
.about-side .h2like{background:var(--brand);color:var(--on);padding:28px 22px;margin:0;border-radius:4px 4px 0 0;font-size:1.5rem;font-weight:700}
.about-main h1{font-size:1.6rem;padding-bottom:14px;border-bottom:1px solid var(--line);margin-bottom:22px}
.about-main h2.ph{font-size:1.2rem;color:var(--brand);margin:28px 0 10px}.about-main h2.ph:first-of-type{margin-top:0}
.team h3{text-align:center;padding:10px;background:var(--card);border-top:3px solid var(--brand);font-size:1rem}
.sub{color:var(--muted)}
.post{max-width:760px;padding-block:20px 56px}.post h1{font-size:clamp(1.5rem,4vw,2rem);line-height:1.3;margin:10px 0 8px;text-wrap:balance}
.pmeta{color:var(--muted);font-size:.88rem;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.tagchip{background:var(--card);border:1px solid var(--line);border-radius:999px;padding:1px 10px}
.phero{width:100%;height:auto;border-radius:10px;margin:16px 0}
.pbody{font-size:1.02rem;line-height:1.85}.pbody p{margin:0 0 1.1em;max-width:none}.pbody h2{margin:1.8em 0 .6em;font-size:1.3rem}.pbody h3{margin:1.4em 0 .5em}
.pbody ul{padding-left:1.2em;margin:0 0 1.1em}.pbody img{max-width:100%;height:auto;border-radius:8px}.pbody figure{margin:1.2em 0}.pbody figcaption{font-size:.85rem;color:var(--muted);text-align:center}
.pcta{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:18px 20px;margin:30px 0}
.pcta p{margin:6px 0 12px}.pn{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));margin:20px 0}
.pn a{border:1px solid var(--line);border-radius:8px;padding:12px 14px}.pn a:hover{border-color:var(--brand)}.pn small{color:var(--muted)}
.sampletag{background:var(--accent);color:#3a2800;display:inline-block;padding:3px 10px;border-radius:4px;font-size:.82rem;font-weight:700}
.pgrid2{display:grid;gap:18px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));padding-block:20px 56px}
.pcard a{display:block;border:1px solid var(--line);border-radius:12px;overflow:hidden;height:100%;background:var(--bg)}.pcard a:hover{box-shadow:0 8px 24px rgba(18,64,143,.12)}
.pcard img,.pnoimg{width:100%;aspect-ratio:16/9;object-fit:cover;display:grid;place-items:center;background:var(--card);color:var(--muted)}
.pcard h2{font-size:1.1rem;margin:12px 16px 4px;line-height:1.35}.pcard p{margin:0 16px 8px;color:var(--muted);font-size:.92rem}.pcard .pmeta{margin:0 16px 14px}
"""
    (ROOT / "assets").mkdir(exist_ok=True)
    (ROOT / "assets" / "site.css").write_text(css + extra, encoding="utf-8")


def inject_home():
    """index.html 의 SEO 표식 구간을 검색엔진이 읽을 수 있는 정적 내용으로 채웁니다."""
    p = ROOT / "index.html"
    h = p.read_text(encoding="utf-8")
    title = "%s | 소독·방역·하수구 막힘 뚫음·냄새차단" % BRAND
    desc = S.get("description") or "소독·방역·하수구 막힘 뚫음·냄새차단 전문 %s" % BRAND
    h = re.sub(r"<title>.*?</title>", "<title>%s</title>" % e(title), h, count=1, flags=re.S)
    h = re.sub(r'<meta name="description" content="[^"]*">', '<meta name="description" content="%s">' % e(desc), h, count=1)
    c = S.get("company") or {}
    ld = {"@context": "https://schema.org", "@type": "LocalBusiness", "name": BRAND, "description": desc, "telephone": S["phone"], "url": SITE_URL + "/",
          "address": {"@type": "PostalAddress", "streetAddress": c.get("address", ""), "addressCountry": "KR"},
          "sameAs": [b["url"] for b in S.get("blogs", [])], "image": "%s/%s" % (SITE_URL, S.get("ogImage", S.get("logo", "")))}
    verify = ""
    if S.get("naverVerification"):
        verify += '<meta name="naver-site-verification" content="%s">\n' % e(S["naverVerification"])
    if S.get("googleVerification"):
        verify += '<meta name="google-site-verification" content="%s">\n' % e(S["googleVerification"])
    headseo = ('<link rel="canonical" href="%s/">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="%s">\n<meta property="og:title" content="%s">\n'
               '<meta property="og:description" content="%s">\n<meta property="og:url" content="%s/">\n<meta property="og:image" content="%s/%s">\n%s'
               '<link rel="alternate" type="application/rss+xml" title="%s 현장일지" href="posts/rss.xml">\n<script type="application/ld+json">%s</script>\n') % (
        SITE_URL, e(BRAND), e(title), e(desc), SITE_URL, SITE_URL, e(S.get("ogImage", "")), verify, e(BRAND), json.dumps(ld, ensure_ascii=False))
    h = re.sub(r"<!--HEAD-SEO-START-->.*?<!--HEAD-SEO-END-->", lambda m: "<!--HEAD-SEO-START-->\n" + headseo + "<!--HEAD-SEO-END-->", h, flags=re.S)
    lis = ""
    for key, sec_title, d, items in SECTIONS:
        lis += "<h2>%s</h2><ul>%s</ul>" % (e(sec_title), "".join('<li><a href="%s/%s/">%s</a></li>' % (d, it["slug"], e(it["label"])) for it in items))
    lis += '<h2>현장일지</h2><ul><li><a href="posts/">현장일지 전체</a></li>%s</ul>' % "".join('<li><a href="posts/%s/">%s</a></li>' % (e(p["slug"]), e(p["title"])) for p in posts)
    bodyseo = '<noscript><div class="wrap" style="padding:24px 16px"><h1>%s</h1><p>%s</p><p>전화 %s</p>%s<p>자바스크립트를 켜면 전체 화면을 볼 수 있습니다.</p></div></noscript>' % (e(BRAND), e(desc), e(S["phone"]), lis)
    h = re.sub(r"<!--BODY-SEO-START-->.*?<!--BODY-SEO-END-->", lambda m: "<!--BODY-SEO-START-->\n" + bodyseo + "\n<!--BODY-SEO-END-->", h, flags=re.S)
    p.write_text(h, encoding="utf-8")


# ---------------------------------------------------------------- 실행
def main():
    inject_home()
    build_css()
    urls = [("", "1.0")]
    for key, sec_title, d, items in SECTIONS:
        for i in range(len(items)):
            path, _ = build_section_page(key, sec_title, d, items, i)
            urls.append((path, "0.8"))
    build_posts_index()
    urls.append(("posts/", "0.7"))
    for i, p in enumerate(posts):
        urls.append((build_post(i, p), "0.6"))
    build_rss()
    build_posts_data()
    build_bot_data()
    sm = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n%s</urlset>\n' % "".join(
        "<url><loc>%s/%s</loc><lastmod>%s</lastmod><priority>%s</priority></url>\n" % (SITE_URL, u, TODAY, pr) for u, pr in urls)
    (ROOT / "sitemap.xml").write_text(sm, encoding="utf-8")
    (ROOT / "robots.txt").write_text("User-agent: *\nAllow: /\n\nSitemap: %s/sitemap.xml\n" % SITE_URL, encoding="utf-8")
    print("완료: 페이지 %d개, 글 %d개, sitemap.xml · robots.txt · posts/rss.xml 생성" % (len(urls), len(posts)))


main()
