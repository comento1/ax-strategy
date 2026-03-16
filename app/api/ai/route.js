import { NextResponse } from 'next/server';

const GEMINI_MODEL = 'gemini-3-flash-preview';
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
아래 **사용자가 앞서 작성한 워크플로우**를 반드시 참고하여, 해당 워크플로우에 기반한 실행 가능한 "과제 후보"를 다양하고 구체적으로 도출해 주세요.
각 과제는 한 줄 제목과 1~3문장 설명으로 적어 주세요. 제목과 설명이 구체적일수록 좋습니다.

형식: 제목: ... 설명: ... (한 줄에 하나씩, 번호 붙여서 나열)

사용자가 작성한 워크플로우:
${context || '없음'}

추가 맥락:
${userInput || '없음'}

한국어로 5개 이상 도출해 주세요.`;
    } else if (type === 'workflow_split') {
      prompt = `당신은 롯데웰푸드 팀장/매니저의 업무 설계를 돕는 조력자입니다.
아래 업무 설명을 "워크플로우 단계"로 나누어 주세요.
- 각 단계는 제목과 함께 **세부 내용**(구체적 행동, 산출물, 담당 역할, 참고 사항 등)을 1~3문장으로 포함할 것.
- AI 적용이 유력한 단계에는 끝에 "(AI 적용 가능)"을 붙일 것.
형식: 1. [제목] — [설명 및 세부 내용]. (AI 적용 가능 여부)

사용자가 적은 업무 설명:
${userInput || context || '없음'}

한국어로만, 번호 목록 형태로 출력하세요.`;
    } else if (type === 'idea_recommend') {
      const ideas = body.ideas || [];
      const ideasText = ideas.map((i, idx) => `[${idx + 1}] 제목: ${i.title || ''}\nAS-IS: ${i.asIs || ''}\nTO-BE: ${i.toBe || ''}\n유형: ${i.taskType === 'expand' ? '임원 범위 확장' : '신규'}`).join('\n\n');
      prompt = `당신은 롯데웰푸드 팀장/매니저의 과제 도출을 돕는 조력자입니다.
아래 직책자들이 적은 "아이디어" 목록을 검토한 뒤, 구체적인 과제로 다듬어 추천해 주세요.
각 추천은 한 줄 제목과 1~2문장 설명으로 적어 주세요. 5개 이내로 추천하세요.

입력된 아이디어:
${ideasText}

형식: 1. [과제 제목] — [설명]
한국어로만 출력하세요.`;
    } else if (type === 'example') {
      prompt = `당신은 롯데웰푸드 팀장/매니저의 업무 설계를 돕는 조력자입니다.
아래 AI 적용 영역에 맞는 "실제 워크플로우"만 마크다운으로 작성해 주세요.
- 가이드 문장·도입부는 쓰지 말고, 실행 가능한 워크플로우 단계만 작성할 것.
- 각 단계는 실행 가능한 가장 작은 단위로 쪼개어 구체적으로 나열할 것.
- 마크다운 문법 사용: ## 단계 제목, - 하위 항목, **강조**, 번호 목록 등.

형식 예시 (마크다운):
## 1. [단계 제목]
- [구체적 행동 1]
- [구체적 행동 2]
- [구체적 행동 3]

## 2. [다음 단계 제목]
- [구체적 행동]
...

AI 적용 영역: ${context || '없음'}
본부/맥락: ${userInput || ''}

한국어로만, 5~10단계 정도로, 위 형식의 마크다운만 출력하세요.`;
    } else {
      return NextResponse.json({ error: 'type은 workflow, task, workflow_split, example 중 하나여야 합니다.' }, { status: 400 });
    }
    const maxTokens = type === 'task' ? 2048 : 1024;
    const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: maxTokens },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: 'Gemini API 오류: ' + err }, { status: 502 });
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (type === 'idea_recommend' && text) {
      const lines = text.split('\n').filter((l) => /^\d+\./.test(l.trim()));
      const recommended = lines.map((line) => {
        const clean = line.replace(/^\d+\.\s*/, '').trim();
        const dash = clean.indexOf(' — ');
        const title = dash >= 0 ? clean.substring(0, dash).trim() : clean;
        const desc = dash >= 0 ? clean.substring(dash + 3).trim() : '';
        return { title, desc };
      });
      return NextResponse.json({ text, recommended });
    }
    return NextResponse.json({ text });
  } catch (e) {
    return NextResponse.json({ error: String(e.message) }, { status: 500 });
  }
}
