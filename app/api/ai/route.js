import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(req) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
  }
  try {
    const body = await req.json();
    const { type, context, userInput } = body;
    let prompt = '';
    if (type === 'workflow') {
      prompt = `당신은 롯데웰푸드 팀장/매니저의 업무 설계를 돕는 조력자입니다.
아래 "임원이 정의한 AI 활용 영역"에 맞춰, 해당 업무의 워크플로우(업무 단계)를 구체적으로 나열해 주세요.
각 단계마다 제목과 한 줄 설명을 주고, AI 적용이 유력한 단계에는 "(AI 적용 가능)"이라고 표시해 주세요.
형식: 1. [제목] — [설명] (AI 적용 가능 여부)

임원 AI 활용 영역(또는 선택한 전략):
${context || '없음'}

사용자 추가 설명:
${userInput || '없음'}

한국어로만 답변하고, 번호 목록 형태로만 출력해 주세요.`;
    } else if (type === 'task') {
      prompt = `당신은 롯데웰푸드 팀장/매니저의 AI 과제 도출을 돕는 조력자입니다.
아래 워크플로우를 보고, 실행 가능한 "과제 후보"를 도출해 주세요.
반드시 **상위 과제**(전체 워크플로우 자동화, end-to-end 개선 등)와 **하위 과제**(특정 단계 자동화, 개별 업무 지원)를 구분해서 제시하세요.
각 과제는 한 줄 제목과 한 두 문장 설명으로 적고, [상위] 또는 [하위] 표시를 붙여 주세요.

형식 예:
[상위] 제목: ... 설명: ...
[하위] 제목: ... 설명: ...

워크플로우:
${context || '없음'}

사용자 추가 설명:
${userInput || '없음'}

한국어로만 답변하세요.`;
    } else if (type === 'workflow_split') {
      prompt = `당신은 롯데웰푸드 팀장/매니저의 업무 설계를 돕는 조력자입니다.
아래에 적힌 긴 업무 설명을 "워크플로우 단계"로 나누어 주세요. 각 단계는 제목과 한 줄 설명을 갖고, AI 적용이 유력한 단계에는 "(AI 적용 가능)"을 붙여 주세요.
형식: 1. [제목] — [설명] (AI 적용 가능 여부)

사용자가 적은 업무 설명:
${userInput || context || '없음'}

한국어로만, 번호 목록 형태로만 출력하세요.`;
    } else if (type === 'example') {
      prompt = `다음 AI 적용 영역에 맞는 "워크플로우 작성 예시"를 조직·실무자 관점으로 5단계 이내로 만들어 주세요.
각 단계: 제목 — 한 줄 설명 (AI 적용 가능 / 검토 필요)
영역: ${context || '없음'}
본부/맥락: ${userInput || ''}

한국어로만, 번호 목록 형태로만 출력하세요.`;
    } else {
      return NextResponse.json({ error: 'type은 workflow, task, workflow_split, example 중 하나여야 합니다.' }, { status: 400 });
    }
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: 'Gemini API 오류: ' + err }, { status: 502 });
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: String(e.message) }, { status: 500 });
  }
}
