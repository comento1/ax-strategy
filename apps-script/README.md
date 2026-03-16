# 구글 시트 연동 — Apps Script

## 1. 시트에서 스크립트 열기

1. 구글 시트를 연다 (새로 만들어도 됨).
2. **확장프로그램** → **Google Apps Script** 클릭.
3. `Code.gs` 내용을 전부 복사해 기본 `function myFunction() {}` 를 **덮어쓴 뒤 저장**.

## 2. 웹 앱으로 배포

1. **배포** → **새 배포** 클릭.
2. **유형 선택** → **웹 앱** 선택.
3. 설정:
   - **설명**: 예) AX 사전과제 저장
   - **실행 사용자**: **나**
   - **액세스 권한**: **모든 사용자** (또는 조직 내)
4. **배포** 클릭 후 나오는 **웹 앱 URL** 복사.  
   형식: `https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/exec`

## 3. Next.js에 URL 설정

- 로컬: 프로젝트 루트 `.env` 에  
  `GOOGLE_APPS_SCRIPT_WEBAPP_URL=복사한_URL`
- Vercel: **Settings** → **Environment Variables** 에 동일하게 추가.

## 4. 시트 구조 (자동 생성)

**Prework** 시트가 없으면 첫 호출 시 자동으로 생성됩니다.

| Id | Department | ParticipantName | SelectedStrategyId | StrategyTitle | WorkflowSteps | TaskCandidates | Questions | CreatedAt |
|----|------------|-----------------|--------------------|--------------|--------------|----------------|-----------|-----------|
| pw-... | 영업본부 | 홍길동 | strat-1 | ... | [...] | [...] | [...] | ISO 날짜 |

- WorkflowSteps, TaskCandidates, Questions 는 JSON 문자열로 저장됩니다.
