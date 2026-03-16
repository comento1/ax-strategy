# 롯데웰푸드 AX 전략 구체화 웹 서비스

팀장/매니저가 **작성본부**를 선택한 뒤, **임원이 도출한 AX 전략**을 리뷰하고, 사전과제(워크플로우 분석·과제 후보 도출)를 수행한 후, 본 워크숍에서 본부 내 제출 내용을 공유·ICE 평가·과제정의서까지 진행하는 웹 서비스입니다.

## 플로우 요약

1. **진입** → 작성본부 선택
2. **AX 전략 영역 리뷰** → 본부별 전략 목록(한 문장 요약 리스트 / 전체 스트림 보기)에서 **1개 선택**
3. **사전과제** → 워크플로우 분석(직접 작성 또는 **AI 지원**), 과제 후보 도출(AI 지원 가능), 강사 질문 → 제출
4. **본 워크숍 입장** → 세션 1: **본부 내** 제출된 사전과제 공유 → ICE 정량 평가 → 구현 주제 확정
5. 세션 2 (선택) → Track A/B 추가 과제
6. 세션 3 → 과제 리스트업, 과제정의서 작성, 인쇄/PDF

## 로컬 실행

```bash
npm install
cp .env.example .env
# .env 에 GEMINI_API_KEY=본인키 입력 (API 키는 .env에만 두고 커밋하지 마세요)
npm run dev
```

브라우저에서 http://localhost:3000 접속.

## Vercel 배포 (GitHub 연동)

1. 이 저장소를 GitHub에 푸시합니다.
2. [Vercel](https://vercel.com) 로그인 → **Add New Project** → 해당 GitHub 저장소 선택.
3. **Environment Variables**에 아래 변수 추가 후 Deploy.

### Vercel에서 설정할 환경 변수

| 변수명 | 값 | 비고 |
|--------|-----|------|
| `GEMINI_API_KEY` | (Google AI Gemini API 키) | AI 워크플로우/과제 제안용. [Google AI Studio](https://aistudio.google.com/apikey)에서 발급 |
| `GOOGLE_APPS_SCRIPT_WEBAPP_URL` | `https://script.google.com/macros/s/AKfycbwr42APUmvtfqFJpy8a32bqve6yQDsowomFMTYh8fVDK0mJDb6qWdbF_CRB0ZTOQS3bXw/exec` | 사전과제 저장용 구글 시트 Web App URL |

> **API 키 보안**: `GEMINI_API_KEY`는 Vercel 환경 변수에만 넣고, 코드·GitHub에는 올리지 마세요.

## 엑셀 데이터 반영 (임원 전략 목록)

엑셀 파일 `롯데웰푸드_임원 과정 사전 주제도출 결과 (원본).xlsx` 가 있다면:

1. 프로젝트 루트에 해당 xlsx 파일을 두거나, 경로를 지정해서 실행:
   ```bash
   npm install
   node scripts/xlsx-to-json.mjs "경로/롯데웰푸드_임원 과정 사전 주제도출 결과 (원본).xlsx"
   ```
2. 생성된 `data/executive-strategies.json` 이 서비스에서 사용됩니다.
3. 엑셀 컬럼명이 다르면 `scripts/xlsx-to-json.mjs` 안의 `colMap` 또는 컬럼 매핑 부분을 수정하세요. (작성본부, 제목/전략, 내용/상세, 요약 등)

직접 JSON을 수정해도 됩니다. 형식은 아래와 같습니다.

```json
{
  "departments": ["영업본부", "마케팅본부", ...],
  "strategies": [
    {
      "id": "strat-1",
      "작성본부": "영업본부",
      "제목": "...",
      "내용": "...",
      "요약": "한 문장 요약"
    }
  ]
}
```

## AI 지원 (Gemini)

- **워크플로우 제안**: 선택한 AX 전략 문맥을 바탕으로 업무 단계 목록을 생성합니다.
- **과제 후보 제안**: 입력한 워크플로우를 바탕으로 실행 가능한 과제 후보를 제안합니다.

사전과제 화면의 "AI로 워크플로우/과제 후보 초안 받기"에서 타입을 선택하고 **AI 제안 받기**를 누르면 됩니다.

## 정량 평가(ICE)

- **전략 부합도** (1~10): 임원이 규명한 조직 문제 해결 여부
- **구현 가능성** (1~10): 보안/인프라 내 구현 가능 여부
- **데이터 확보성** (1~10): 필요 데이터 확보 가능 여부  
- **ICE 점수** = (위 3항목 합) ÷ 3

## 구글 시트 연동 (사전과제 저장)

사전과제 제출 내용은 **구글 시트**에 저장됩니다.

1. **시트 준비**: 새 구글 시트를 만들거나 기존 시트를 연다.
2. **Apps Script**: 확장프로그램 → Google Apps Script → `apps-script/Code.gs` 내용을 붙여넣고 저장.
3. **배포**: 배포 → 새 배포 → 유형 **웹 앱**  
   - 실행 사용자: **나**  
   - 앱에 액세스할 수 있는 사용자: **모든 사용자** (또는 조직 내)
4. 배포 후 나오는 **웹 앱 URL** 복사 (예: `https://script.google.com/macros/s/xxxx/exec`).
5. 로컬 `.env` 또는 Vercel 환경 변수에 추가:
   - `GOOGLE_APPS_SCRIPT_WEBAPP_URL` = 위 URL

시트에 **Prework** 시트가 없으면 스크립트가 자동으로 만들고, 컬럼은 Id, Department, ParticipantName, SelectedStrategyId, StrategyTitle, WorkflowSteps, TaskCandidates, Questions, CreatedAt 입니다.

## 프로젝트 구조 (Next.js)

- `app/page.js` — 메인 클라이언트 (진입·리뷰·사전과제·세션1·2·3)
- `app/layout.js`, `app/globals.css` — 레이아웃·스타일
- `app/api/strategies/route.js` — 전략 JSON 제공
- `app/api/ai/route.js` — Gemini API 호출 (서버에서만 키 사용)
- `app/api/prework/route.js` — 사전과제 저장/조회 (구글 시트 Web App URL 호출)
- `apps-script/Code.gs` — 구글 시트 연동용 Apps Script (복사해 시트에 붙여넣기)
- `data/executive-strategies.json` — 임원 전략 데이터 (엑셀 변환 결과 또는 수동 편집)
- `scripts/xlsx-to-json.mjs` — 엑셀 → JSON 변환

기존 정적 HTML 목업은 `index.html`, `css/style.css`, `js/` 에 있으며 참고용으로 둘 수 있습니다.
