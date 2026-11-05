# 스팸 차단 관문(게이트웨이) + 접속 IP 기록 — Cloudflare Workers (무료)

## 왜 필요한가
- 구글 앱스스크립트(문의·후기 서버)는 **접속자 IP를 볼 수 없습니다.** 그래서 IP를 알 수도, IP별로 막을 수도 없습니다.
- 이 관문은 홈페이지와 구글 서버 **사이**에 서서 ① 접속 IP를 확인하고 ② 사람인지 확인하고(Turnstile, 선택) ③ IP별 접수 한도를 걸고 ④ 차단 IP를 걸러낸 뒤 ⑤ **서명해서** 구글 서버로 넘깁니다.
- 구글 서버는 이 서명이 있는 문의·후기만 받습니다. 구글 서버 주소를 알아내 **직접 보내는 스팸 프로그램은 전부 거절**됩니다.
- **도메인이 없어도 됩니다.** Cloudflare가 무료로 주는 `○○.workers.dev` 주소로 먼저 쓸 수 있습니다.

## 설정 (한 번만, 약 20분)
1. https://dash.cloudflare.com 에 가입(무료) → **Workers & Pages → Create → Worker** → 이름 예: `homeroach-gw` → 배포.
2. **Edit code** 를 눌러 `tools/edge-gateway/worker.js` 내용을 통째로 붙여 넣고 **Deploy**.
3. **Storage & Databases → KV → Create namespace**(이름 예: `homeroach-rl`). 그 뒤 Worker의 **Settings → Bindings → Add → KV namespace**, 변수 이름은 **`RL`**, 방금 만든 것을 선택.
4. Worker의 **Settings → Variables and Secrets** 에 추가:
   - `APPS_SCRIPT_URL` (일반 변수): 구글 웹앱 주소(`https://script.google.com/macros/s/…/exec`)
   - `ALLOWED_ORIGIN` (일반 변수): 내 사이트 주소. 도메인 전에는 임시 주소, 도메인 후에는 `https://내도메인.com` (쉼표로 여러 개 가능)
   - `GATEWAY_SECRET` (**시크릿**): 길고 무작위인 문자열(예: 비밀번호 생성기로 40자). **구글 쪽에도 똑같이** 넣습니다.
   - `TURNSTILE_SECRET` (**시크릿**, 선택): 아래 “사람 확인” 참고
5. **구글 Apps Script** → ⚙ 프로젝트 설정 → 스크립트 속성에 **`GATEWAY_SECRET`** 추가(위와 같은 값) → 코드(`Code.gs`)는 최신본으로 다시 붙여 넣고 **배포 → 배포 관리 → 새 버전**.
   - 이 속성을 넣는 순간부터 **게이트웨이를 거치지 않은 문의·후기는 모두 거절**됩니다.
6. `content.js` 의 `gatewayUrl` 에 Worker 주소(`https://homeroach-gw.내계정.workers.dev`, 끝에 `/` 없이)를 넣고 `python3 build.py` → 사이트 다시 올리기.
7. 시험: 홈페이지에서 문의를 보내 보고, `/admin/` 에서 해당 문의 카드에 **접속 IP**가 보이면 성공입니다.

### 사람 확인(Turnstile, 강력 추천)
1. Cloudflare → **Turnstile → Add site** → 사이트 이름, 호스트 이름(내 사이트 도메인; 임시 주소를 쓸 때는 그 주소) → 위젯 모드 **Managed** → 만들기.
2. 나온 **Site Key** 를 `content.js` 의 `turnstileSiteKey` 에, **Secret Key** 를 Worker 의 `TURNSTILE_SECRET` 에 넣습니다.
3. 방문자 대부분은 아무것도 보지 못하고(자동 확인), 의심스러운 경우에만 확인 창이 뜹니다. 문의 양식에 손을 대는 순간에만 Turnstile 스크립트를 불러옵니다.

## 이 관문이 해 주는 것
| 기능 | 내용 |
|---|---|
| 접속 IP·국가 기록 | 문의·후기마다 접속 IP(와 국가)가 시트에 저장되어 관리자 화면에 표시됩니다 |
| IP별 한도 | IP 하나당 1시간 5건·하루 15건 (`worker.js` 맨 위 숫자로 조절) |
| 자동 차단 | 광고 글·동의 없는 요청이 하루 12번 거절되면 그 IP를 24시간 자동 차단 |
| 수동 차단 | 관리자 화면에서 문의를 “스팸으로 표시” → IP 차단 / 보안 탭에서 차단 해제 |
| 조용한 차단 | 차단된 IP에는 “차단됨”을 알려 주지 않고 성공처럼 보이게 해서, 스팸 제작자가 우회법을 찾지 못하게 합니다 |
| 출처 검사 | 내 사이트(`ALLOWED_ORIGIN`)가 아닌 **웹사이트**에서 온 요청은 거절 (스팸 프로그램은 이 표시를 흉내낼 수 있으므로 이것만 믿지 않고, 아래 Turnstile·IP 한도·서명이 본 방어입니다) |
| 광고 문구 필터 | 링크 2개 이상, 카지노·리딩방·텔레그램 등 광고 단어, 한글 없는 긴 글, 같은 글자 반복을 구글 서버가 거절 (`Code.gs` 의 `SPAM_WORDS` 에서 단어 추가) |

## IP 추적에 대해 (솔직하게)
- **할 수 있는 것:** 스팸·악성 접수의 접속 IP와 국가를 기록하고, 그 IP를 차단하고, 같은 IP에서 온 접수를 모아 볼 수 있습니다.
- **할 수 없는 것:** IP만으로 **사람의 이름·정확한 위치를 알 수는 없습니다.** IP는 통신사가 가진 가입자 정보와 연결되며, 신원 확인은 경찰 등 수사기관이 통신사에 요청해야 가능합니다(고소·신고 시 이 IP 기록이 증거 자료가 됩니다).
- VPN·프록시·휴대폰 망(여러 사람이 같은 IP를 공유)을 쓰면 추적이 어렵거나 무고한 사람이 같이 막힐 수 있어, 자동 차단은 24시간으로 짧게 두었습니다.
- **법적 주의:** IP 주소도 개인정보입니다. 개인정보처리방침(`/privacy/`)과 문의 양식의 동의 문구에 “접속 IP(부정 이용 방지, 90일 보관)”이 **자동으로 추가**됩니다. 관리자 > 보안 > “90일 지난 IP 기록 지우기”로 정기적으로 지우세요(Apps Script에서 `purgeIpsDaily` 를 매일 실행하는 트리거를 만들면 자동). 
- “원천 차단”은 현실적으로 불가능합니다(사람이 직접 쓰는 스팸은 막기 어렵습니다). 이 구성은 **자동 프로그램 대부분을 막고, 남은 것을 빠르게 찾아내 차단하는 것**이 목표입니다.

## 비용·한도
- Workers 무료 플랜: 하루 10만 요청, KV 무료 한도 내(문의 몇 백 건 규모에서는 무료로 충분).
- 접수가 갑자기 늘어도 구글 서버로는 한도를 통과한 것만 전달됩니다.

## 시험해 보기 (Cloudflare 없이 내 컴퓨터에서)
```
# 창 1: 구글 서버 코드(Code.gs) 흉내
cd tools/inquiry-server/test && GATEWAY_SECRET=gw-test-secret-xyz node gas-local.js 8787 test-password-1234567
# 창 2: 게이트웨이 시험(25개 항목)
cd tools/edge-gateway/test && GATEWAY_SECRET=gw-test-secret-xyz node gateway.test.mjs
# 브라우저로 시험하려면: node local-gateway.mjs 8788 (게이트웨이를 http 서버로 띄움) + content.js 에 임시로 gatewayUrl 지정
```
Cloudflare 실제 환경(Turnstile 포함)에서는 아직 시험하지 못했습니다. 연결할 때 위 7번 시험을 꼭 해 보세요.
