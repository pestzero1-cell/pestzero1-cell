# 자동응답에 AI 답변 붙이기 (선택, 아직 실제 환경에서 시험하지 못했습니다)

지금 도우미는 **키워드 자동응답**입니다. 아래를 설정하면 **키워드로 답하지 못한 질문만** AI가 답합니다. (가격·빈대 등 정해 둔 답은 그대로 키워드 답변이 나갑니다.)

**필요한 것:** Cloudflare 계정(무료 플랜 가능), Anthropic API 키(사용량만큼 요금). **API 키는 홈페이지 파일에 절대 넣지 마세요.** 서버(Worker)에만 보관합니다.

1. Cloudflare → Workers & Pages → Worker 만들기 → `worker.js` 내용을 붙여 넣고 배포.
2. Worker → 설정 → 변수 및 시크릿에 `ANTHROPIC_API_KEY`(시크릿), `ALLOWED_ORIGIN`(내 도메인, 예: `https://내도메인.com`) 추가.
3. 나온 Worker 주소(`https://….workers.dev`)를 `content.js` 의 `bot.aiEndpoint` 에 넣고 `python3 build.py` 후 다시 올립니다.
4. Anthropic 콘솔에서 **월 사용 한도**를 꼭 걸어 두세요(악용 방지).

주의: AI 답변에는 "AI가 작성한 안내이며 정확한 진단·견적은 전화로 확인" 문구가 자동으로 붙습니다. 안내 규칙은 `worker.js` 의 SYSTEM 문구에서 고칩니다.
