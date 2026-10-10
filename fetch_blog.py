#!/usr/bin/env python3
"""네이버 블로그 RSS 에서 최신글 '제목·날짜·짧은 요약·링크'만 가져와 홈페이지용 데이터로 만듭니다.

사용법
  python3 fetch_blog.py            # RSS 를 가져와 blog-feed.json / blog-feed-data.js 생성
  python3 fetch_blog.py --sample   # 예시 데이터로 채우기 (RSS 연결 전 화면 확인용)
  python3 fetch_blog.py --file a.xml --source giberga1   # 저장해 둔 RSS 파일로 시험

안전 원칙
  - 본문 전체를 가져오지 않습니다. 요약은 짧게(기본 90자) 잘라 쓰고, 항상 블로그 원문으로 링크합니다.
  - 링크는 blog.naver.com 주소만 허용합니다. (다른 주소는 버립니다)
  - 사진은 가져오지 않습니다. (남의 서버에서 직접 불러오는 이미지 사용 방지)
  - 가져오기에 실패하면 기존 데이터를 그대로 두고 종료합니다. (홈페이지가 비는 일이 없습니다)
"""
import argparse, datetime, email.utils, html, json, pathlib, re, subprocess, sys, urllib.request
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent
ALLOWED_HOSTS = {"blog.naver.com", "m.blog.naver.com"}


def load_config():
    js = "global.window={};require('./content.js');console.log(JSON.stringify(window.SITE.blogFeed||null))"
    out = subprocess.run(["node", "-e", js], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    cfg = json.loads(out)
    if not cfg:
        sys.exit("content.js 에 blogFeed 설정이 없습니다.")
    return cfg


def clean_text(raw, limit):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", raw or "", flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", " ", t)
    t = html.unescape(t)
    t = re.sub(r"\s+", " ", t).strip()
    if len(t) <= limit:
        return t
    cut = t[:limit].rsplit(" ", 1)[0] if " " in t[:limit] else t[:limit]
    return cut.rstrip(" .,·-") + "…"


def clean_link(link, blog_id):
    """https://blog.naver.com/<id>/<번호> 형태로 정리 (추적용 쿼리 제거). 허용되지 않은 주소는 None."""
    try:
        m = re.match(r"^https?://([^/]+)(/[^?#]*)", link.strip())
    except AttributeError:
        return None
    if not m or m.group(1).lower() not in ALLOWED_HOSTS:
        return None
    host, path = "blog.naver.com", m.group(2)
    return "https://%s%s" % (host, path)


def parse_date(s):
    try:
        return email.utils.parsedate_to_datetime(s).astimezone(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat()
    except Exception:
        m = re.search(r"(\d{4})[-./](\d{1,2})[-./](\d{1,2})", s or "")
        return "%s-%02d-%02d" % (m.group(1), int(m.group(2)), int(m.group(3))) if m else ""


def parse_rss(xml_bytes, src, cfg):
    root = ET.fromstring(xml_bytes)
    items = []
    for it in root.iter("item"):
        title = clean_text((it.findtext("title") or ""), 80)
        link = clean_link(it.findtext("link") or "", src["id"])
        if not title or not link:
            continue
        items.append({
            "title": title,
            "link": link,
            "date": parse_date(it.findtext("pubDate") or ""),
            "excerpt": clean_text(it.findtext("description") or "", cfg.get("excerptLength", 90)),
            "source": src["id"],
            "sourceLabel": src["label"],
            "tag": src.get("tag", ""),
            "sample": False,
        })
        if len(items) >= cfg.get("perSource", 3):
            break
    return items


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (homepage blog-feed fetcher)"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return r.read()


def sample_items(cfg):
    base = [
        ("싱크대 배수구 막힘, 원인부터 확인한 현장 기록", "기름 찌꺼기로 막힌 배관을 내시경으로 확인하고 고압 세척으로 해결한 과정을 정리했습니다."),
        ("겨울철 필로티 세탁실 배수구 동파 해빙 작업", "한파로 얼어붙은 배수구를 해빙하고 역류를 막은 작업을 기록했습니다."),
        ("화장실 하수구 냄새 차단, 트랩 설치 후기", "냄새와 해충이 올라오던 배수구에 트랩을 설치한 현장 사례입니다."),
        ("원룸 바퀴벌레 유입 경로 확인과 방제 후기", "배수구와 싱크대 아래 틈새를 확인하고 독먹이와 트랩으로 시공한 현장 사례입니다."),
        ("상가 정기방역 현장일지, 개미와 바퀴 관리", "정기 방문으로 해충 발생을 관리하는 과정을 기록했습니다."),
        ("숙소 빈대 의심 상담부터 방제까지", "발견 시기와 위치를 확인하고 전문가 상담으로 진행한 작업 순서를 정리했습니다."),
    ]
    order = {0: [0, 1, 2], 1: [3, 4, 5]}
    out = []
    for si, src in enumerate(cfg["sources"]):
        for i in range(cfg.get("perSource", 3)):
            t, e = base[order.get(si, [0, 1, 2])[i % 3]]
            d = datetime.date.today() - datetime.timedelta(days=3 + i * 6 + si)
            out.append({"title": t + " (예시)", "link": src["url"], "date": d.isoformat(), "excerpt": e,
                        "source": src["id"], "sourceLabel": src["label"], "tag": src.get("tag", ""), "sample": True})
    return out


def write(items, cfg, note):
    items = sorted(items, key=lambda x: x["date"], reverse=True)[: cfg.get("maxItems", 6)]
    data = {"updated": datetime.date.today().isoformat(), "note": note, "items": items}
    (ROOT / "blog-feed.json").write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / "blog-feed-data.js").write_text("// fetch_blog.py 가 자동으로 만드는 파일입니다. 직접 고치지 마세요.\nwindow.BLOG_FEED=%s;\n" % json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print("저장: %d개 (%s)" % (len(items), note))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sample", action="store_true")
    ap.add_argument("--file")
    ap.add_argument("--source")
    a = ap.parse_args()
    cfg = load_config()
    if a.sample:
        write(sample_items(cfg), cfg, "sample")
        return
    items, errors = [], []
    for src in cfg["sources"]:
        try:
            if a.file and (not a.source or a.source == src["id"]):
                xml = pathlib.Path(a.file).read_bytes()
            elif a.file:
                continue
            else:
                xml = fetch(src["rss"])
            got = parse_rss(xml, src, cfg)
            print("%s: %d개" % (src["label"], len(got)))
            items += got
        except Exception as e:  # 네트워크·형식 오류
            errors.append("%s: %s" % (src["label"], e))
    if errors:
        print("⚠ 일부 실패 — " + " / ".join(errors))
    if not items:
        print("가져온 글이 없어 기존 데이터를 그대로 둡니다.")
        sys.exit(1 if errors else 0)
    write(items, cfg, "rss")


main()
