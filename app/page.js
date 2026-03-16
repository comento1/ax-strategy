'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ax_workshop';
const WORKFLOW_EXAMPLE = `1. 시장·고객 데이터 수집 — 구매 데이터, 고객 피드백, 시장 트렌드 데이터를 채널별로 수집 (AI 적용 가능)
2. 타겟 고객 세그먼테이션 — 수집 데이터 기반 고객 그룹 분류 및 타겟 세그먼트 도출 (AI 적용 가능)
3. 캠페인 기획 및 콘텐츠 제작 — 타겟별 맞춤 마케팅 메시지 및 캠페인 자료 기획·제작 (AI 적용 가능)
4. 채널별 캠페인 집행 — 온·오프라인 채널에 맞게 캠페인 운영 및 실시간 모니터링 (검토 필요)
5. 성과 측정 및 리포팅 — KPI 기반 캠페인 성과 분석 및 개선사항 도출 (AI 적용 가능)`;

function id() {
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function loadLocal() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return null;
  }
}

function saveLocal(data) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadLocal(), ...data }));
}

export default function Home() {
  const [department, setDepartment] = useState('');
  const [strategies, setStrategies] = useState({ departments: [], strategies: [] });
  const [selectedStrategy, setSelectedStrategy] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list | stream
  const [phase, setPhase] = useState('entry'); // entry | review | prework | session1 | session2 | session3
  const [prework, setPrework] = useState(() => {
    const local = loadLocal();
    return local?.prework || {
      selectedStrategyId: null,
      strategyTitle: '',
      workflowSteps: [],
      taskCandidates: [],
      questions: [],
    };
  });
  const [session1, setSession1] = useState(() => {
    const local = loadLocal();
    return local?.session1 || { evaluations: {}, confirmedIds: [] };
  });
  const [session2, setSession2] = useState(() => {
    const local = loadLocal();
    return local?.session2 || { track: 'A', extraA: [], extraB: [] };
  });
  const [session3, setSession3] = useState(() => {
    const local = loadLocal();
    return local?.session3 || { definitions: {} };
  });
  const [sharedPrework, setSharedPrework] = useState([]);
  const [participantName, setParticipantName] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiType, setAiType] = useState('workflow');
  const [aiUserInput, setAiUserInput] = useState('');

  const persist = useCallback(() => {
    saveLocal({ prework, session1, session2, session3, currentPhase: phase, department });
  }, [prework, session1, session2, session3, phase, department]);

  useEffect(() => {
    fetch('/api/strategies')
      .then((r) => r.json())
      .then(setStrategies)
      .catch(() => setStrategies({ departments: [], strategies: [] }));
  }, []);

  useEffect(() => {
    if (phase === 'session1' && department) {
      fetch(`/api/prework?department=${encodeURIComponent(department)}`)
        .then((r) => r.json())
        .then(setSharedPrework)
        .catch(() => setSharedPrework([]));
    }
  }, [phase, department]);

  const filteredStrategies = strategies.strategies?.filter(
    (s) => s.작성본부 === department
  ) || [];

  const addWfStep = () => {
    setPrework((p) => ({
      ...p,
      workflowSteps: [...(p.workflowSteps || []), { id: id(), order: p.workflowSteps?.length || 0, title: '', desc: '', aiTag: 'ai' }],
    }));
  };
  const updateWf = (stepId, field, value) => {
    setPrework((p) => ({
      ...p,
      workflowSteps: (p.workflowSteps || []).map((s) => (s.id === stepId ? { ...s, [field]: value } : s)),
    }));
  };
  const toggleWfTag = (stepId) => {
    setPrework((p) => ({
      ...p,
      workflowSteps: (p.workflowSteps || []).map((s) => (s.id === stepId ? { ...s, aiTag: s.aiTag === 'review' ? 'ai' : 'review' } : s)),
    }));
  };
  const delWf = (stepId) => {
    setPrework((p) => ({ ...p, workflowSteps: (p.workflowSteps || []).filter((s) => s.id !== stepId) }));
  };
  const addTask = () => {
    setPrework((p) => ({
      ...p,
      taskCandidates: [...(p.taskCandidates || []), { id: id(), title: '', desc: '' }],
    }));
  };
  const updateTask = (taskId, field, value) => {
    setPrework((p) => ({
      ...p,
      taskCandidates: (p.taskCandidates || []).map((t) => (t.id === taskId ? { ...t, [field]: value } : t)),
    }));
  };
  const delTask = (taskId) => {
    setPrework((p) => ({ ...p, taskCandidates: (p.taskCandidates || []).filter((t) => t.id !== taskId) }));
  };
  const addQuestion = (text) => {
    if (!text?.trim()) return;
    setPrework((p) => ({ ...p, questions: [...(p.questions || []), text.trim()] }));
  };
  const submitPreworkToServer = async () => {
    await fetch('/api/prework', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        department,
        participantName: participantName || '익명',
        selectedStrategyId: prework.selectedStrategyId,
        strategyTitle: prework.strategyTitle,
        workflowSteps: prework.workflowSteps,
        taskCandidates: prework.taskCandidates,
        questions: prework.questions,
      }),
    });
  };
  const callAi = async () => {
    setAiLoading(true);
    setAiResult('');
    try {
      const context = aiType === 'workflow' ? (prework.strategyTitle || selectedStrategy?.제목 || '') : (prework.workflowSteps || []).map((s) => `${s.title}: ${s.desc}`).join('\n');
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: aiType, context, userInput: aiUserInput }),
      });
      const data = await res.json();
      if (data.error) setAiResult('오류: ' + data.error);
      else setAiResult(data.text || '');
    } catch (e) {
      setAiResult('오류: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const allTasks = [
    ...(prework.taskCandidates || []),
    ...(session2.extraA || []).map((t) => ({ ...t, source: 'extraA' })),
    ...(session2.extraB || []).map((t) => ({ ...t, source: 'extraB' })),
  ];
  const updateIce = (taskId, field, value) => {
    setSession1((s) => ({
      ...s,
      evaluations: { ...(s.evaluations || {}), [taskId]: { ...(s.evaluations?.[taskId] || {}), [field]: value === '' ? undefined : Number(value) } },
    }));
  };
  const toggleConfirm = (taskId) => {
    setSession1((s) => {
      const ids = s.confirmedIds || [];
      const idx = ids.indexOf(taskId);
      const next = idx >= 0 ? ids.filter((_, i) => i !== idx) : [...ids, taskId];
      return { ...s, confirmedIds: next };
    });
  };
  const iceScore = (ev) => {
    if (!ev || ev.impact == null || ev.ease == null || ev.confidence == null) return null;
    return Math.round(((ev.impact + ev.ease + ev.confidence) / 3) * 10) / 10;
  };

  const addExtra = (track) => {
    const entry = { id: id(), title: track === 'A' ? '확장 과제' : '신규 과제', desc: '' };
    if (track === 'A') setSession2((s) => ({ ...s, extraA: [...(s.extraA || []), entry] }));
    else setSession2((s) => ({ ...s, extraB: [...(s.extraB || []), entry] }));
  };
  const updateExtra = (track, taskId, field, value) => {
    setSession2((s) => {
      const arr = track === 'A' ? (s.extraA || []) : (s.extraB || []);
      const next = arr.map((t) => (t.id === taskId ? { ...t, [field]: value } : t));
      return track === 'A' ? { ...s, extraA: next } : { ...s, extraB: next };
    });
  };
  const delExtra = (track, taskId) => {
    setSession2((s) => ({
      ...s,
      extraA: track === 'A' ? (s.extraA || []).filter((t) => t.id !== taskId) : (s.extraA || []),
      extraB: track === 'B' ? (s.extraB || []).filter((t) => t.id !== taskId) : (s.extraB || []),
    }));
  };

  const finalTasks = (() => {
    const conf = session1.confirmedIds || [];
    const fromConf = conf.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean);
    const restA = (session2.extraA || []).filter((t) => !conf.includes(t.id));
    const restB = (session2.extraB || []).filter((t) => !conf.includes(t.id));
    const list = [...fromConf, ...restA.map((t) => ({ ...t, source: 'extraA' })), ...restB.map((t) => ({ ...t, source: 'extraB' }))];
    if (list.length === 0 && (prework.taskCandidates || []).length > 0) return prework.taskCandidates.map((t) => ({ ...t, source: 'exec' }));
    return list;
  })();

  const updateDef = (taskId, field, value) => {
    setSession3((s) => ({ ...s, definitions: { ...(s.definitions || {}), [taskId]: { ...(s.definitions?.[taskId] || {}), [field]: value } } }));
  };

  useEffect(() => persist(), [persist]);

  // ----- Entry
  if (phase === 'entry') {
    return (
      <div className="app-shell">
        <div className="entry-screen">
          <h1>롯데웰푸드 AI 전환 과제 설계</h1>
          <p>작성본부를 선택한 뒤, AX 전략 리뷰 또는 본 워크숍 세션으로 이동하세요.</p>
          <select
            className="dept-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">작성본부 선택</option>
            {(strategies.departments || []).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-primary"
              disabled={!department}
              onClick={() => setPhase('review')}
            >
              AX 전략 영역 리뷰 → 사전과제
            </button>
            <button
              className="btn"
              disabled={!department}
              onClick={() => {
                setPhase('session1');
              }}
            >
              본 워크숍 입장 (세션 1부터)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Strategy review (then prework)
  if (phase === 'review') {
    return (
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{department} · AX 전략 리뷰</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-sm" onClick={() => setPhase('entry')}>본부 다시 선택</button>
        </header>
        <main className="app-main" style={{ padding: 20 }}>
          <div className="info-banner">
            <span className="icon">i</span>
            <div>
              <p className="title">임원진이 도출한 AX 전략을 확인하세요</p>
              <p className="body">아래는 <strong>{department}</strong> 작성본부의 전략 목록입니다. 하나를 선택한 뒤 사전과제(워크플로우 분석·과제 후보 도출)를 진행합니다.</p>
            </div>
          </div>
          <div className="view-toggle">
            <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')}>한 문장 요약 리스트</button>
            <button className={viewMode === 'stream' ? 'active' : ''} onClick={() => setViewMode('stream')}>전체 내용 보기</button>
          </div>
          <div className="strategy-list-view">
            {filteredStrategies.map((s) => (
              <div
                key={s.id}
                className={`strategy-card ${selectedStrategy?.id === s.id ? 'sel' : ''}`}
                onClick={() => setSelectedStrategy(s)}
              >
                <p className="one-liner">{s.요약 || s.제목}</p>
                {(viewMode === 'stream' || selectedStrategy?.id === s.id) && (
                  <p className="full-text">{s.제목}\n{s.내용}</p>
                )}
              </div>
            ))}
          </div>
          {filteredStrategies.length === 0 && <p className="section-sub">이 본부에 등록된 전략이 없습니다. data/executive-strategies.json을 확인하세요.</p>}
          <div style={{ marginTop: 20 }}>
            <button
              className="btn btn-primary"
              disabled={!selectedStrategy}
              onClick={() => {
                setPrework((p) => ({ ...p, selectedStrategyId: selectedStrategy.id, strategyTitle: selectedStrategy.제목 + ' — ' + (selectedStrategy.내용 || '').slice(0, 200) }));
                setPhase('prework');
              }}
            >
              선택한 전략으로 사전과제 진행 →
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ----- Prework
  if (phase === 'prework') {
    const steps = (prework.workflowSteps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    return (
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{department} · 사전과제</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="phase-pill ph-active">사전과제</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session1')}>세션 1</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session2')}>세션 2</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session3')}>세션 3</button>
        </header>
        <main className="app-main">
          <div className="prework-layout">
            <aside className="prework-side">
              <p className="section-label">선택한 AX 전략</p>
              <div className="strategy-card sel" style={{ cursor: 'default' }}>
                <p className="one-liner">{prework.strategyTitle?.slice(0, 60) || '—'}…</p>
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border-tertiary)' }}>
                <p className="section-label">수행 가이드</p>
                <div className="guide-row"><span className="guide-n">1</span><p className="guide-text">전략에 맞는 <strong>업무 단계</strong>를 순서대로 입력하세요</p></div>
                <div className="guide-row"><span className="guide-n">2</span><p className="guide-text">각 단계에서 <strong>AI 적용 가능 과제</strong>를 도출하세요</p></div>
                <div className="guide-row" style={{ marginBottom: 0 }}><span className="guide-n">3</span><p className="guide-text">강사에게 <strong>질문사항</strong>을 등록할 수 있습니다</p></div>
              </div>
            </aside>
            <div className="prework-body">
              <div className="section-block">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div>
                    <p className="section-title">워크플로우 분석</p>
                    <p className="section-sub">현재 우리 팀의 실제 업무 흐름을 단계별로 입력하세요. 직접 작성하거나 AI 지원을 사용하세요.</p>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={addWfStep}>단계 추가</button>
                </div>
                <div className="wf-example">
                  <strong>예시 (영업·마케팅)</strong>
                  <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', fontSize: 11 }}>{WORKFLOW_EXAMPLE}</pre>
                </div>
                <div className="ai-assist-box">
                  <p className="section-label">AI로 워크플로우/과제 후보 초안 받기</p>
                  <select value={aiType} onChange={(e) => setAiType(e.target.value)} style={{ marginBottom: 8 }}>
                    <option value="workflow">워크플로우 단계 제안</option>
                    <option value="task">과제 후보 제안</option>
                  </select>
                  <textarea placeholder="추가로 설명할 내용 (선택)" value={aiUserInput} onChange={(e) => setAiUserInput(e.target.value)} />
                  <button type="button" className="btn btn-sm btn-primary" disabled={aiLoading} onClick={callAi}>{aiLoading ? '생성 중…' : 'AI 제안 받기'}</button>
                  {aiResult && <div className="result">{aiResult}</div>}
                </div>
                {steps.map((s, i) => (
                  <div key={s.id} className="wf-card">
                    <div className="step-n">{i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <input className="wf-input-title" placeholder="단계 제목" value={s.title || ''} onChange={(e) => updateWf(s.id, 'title', e.target.value)} />
                      <input className="wf-input-desc" placeholder="설명" value={s.desc || ''} onChange={(e) => updateWf(s.id, 'desc', e.target.value)} />
                    </div>
                    <span className={`tag ${s.aiTag === 'review' ? 'tag-review' : 'tag-ai'}`}>{s.aiTag === 'review' ? '검토 필요' : 'AI 적용 가능'}</span>
                    <button type="button" className="btn btn-sm" onClick={() => toggleWfTag(s.id)}>태그</button>
                    <button type="button" className="btn btn-sm" onClick={() => delWf(s.id)}>삭제</button>
                  </div>
                ))}
                <div className="add-row" onClick={addWfStep}>+ 단계 추가하기</div>
              </div>
              <div className="section-block">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <p className="section-title">과제 후보 목록</p>
                  <button type="button" className="btn btn-sm" onClick={addTask}>과제 후보 추가</button>
                </div>
                {(prework.taskCandidates || []).map((t, i) => (
                  <div key={t.id} className="task-card">
                    <div className="task-dot" />
                    <div style={{ flex: 1 }}>
                      <input className="task-input-title" placeholder="과제 제목" value={t.title || ''} onChange={(e) => updateTask(t.id, 'title', e.target.value)} />
                      <input className="task-input-desc" placeholder="설명" value={t.desc || ''} onChange={(e) => updateTask(t.id, 'desc', e.target.value)} />
                    </div>
                    <span className={`prio-badge ${i === 0 ? 'prio-1' : 'prio-n'}`}>후보 {i + 1}</span>
                    <button type="button" className="btn btn-sm" onClick={() => delTask(t.id)}>삭제</button>
                  </div>
                ))}
                <div className="add-row" onClick={addTask}>+ 과제 후보 추가</div>
              </div>
              <div className="section-block">
                <div className="def-card">
                  <p className="section-title">강사에게 질문하기</p>
                  <p className="section-sub">사전과제 중 질문을 남기세요.</p>
                  <QuestionForm onSubmit={addQuestion} />
                  <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {(prework.questions || []).map((q, i) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <input type="text" placeholder="참가자 이름 (선택)" value={participantName} onChange={(e) => setParticipantName(e.target.value)} style={{ padding: '6px 10px', width: 180 }} />
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    if (!prework.workflowSteps?.length || !prework.taskCandidates?.length) {
                      alert('워크플로우 단계와 과제 후보를 각각 1개 이상 입력해 주세요.');
                      return;
                    }
                    await submitPreworkToServer();
                    setPhase('session1');
                  }}
                >
                  사전과제 제출 → 세션 1
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ----- Session 1
  if (phase === 'session1') {
    return (
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{department} · 세션 1</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="phase-pill" onClick={() => setPhase('prework')}>사전과제</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill ph-active">세션 1</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session2')}>세션 2</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session3')}>세션 3</button>
        </header>
        <main className="app-main" style={{ padding: 20 }}>
          <div className="info-banner">
            <span className="icon">1</span>
            <div>
              <p className="title">세션 1 — 워크플로우 기반 실행 가능 과제로 전환</p>
              <p className="body">본부(<strong>{department}</strong>) 내에서 작성된 사전과제를 살펴보고, 과제 후보를 ICE로 평가한 뒤 구현 주제를 확정하세요.</p>
            </div>
          </div>
          <div className="section-block">
            <h3>본부 내 사전과제 공유</h3>
            <p className="session1-dept-note">아래는 같은 작성본부({department})로 제출된 사전과제입니다.</p>
            {sharedPrework.length === 0 && <p className="section-sub">아직 제출된 사전과제가 없거나 서버 저장이 비어 있습니다. 사전과제를 제출한 뒤 새로고침하세요.</p>}
            {sharedPrework.map((pw) => (
              <div key={pw.id} className="shared-prework-card">
                <p className="section-title">{pw.participantName} · {pw.strategyTitle?.slice(0, 50)}…</p>
                <p className="section-sub">워크플로우 {pw.workflowSteps?.length || 0}단계, 과제 후보 {pw.taskCandidates?.length || 0}개</p>
              </div>
            ))}
          </div>
          <div className="section-block">
            <h3>현실성 검토 — ICE 정량 평가</h3>
            <p className="section-sub">과제 후보별 1~10점 입력. ICE = (전략 부합도 + 구현 가능성 + 데이터 확보성) ÷ 3</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="ice-table">
                <thead>
                  <tr>
                    <th>과제 후보</th>
                    <th>전략 부합도</th>
                    <th>구현 가능성</th>
                    <th>데이터 확보성</th>
                    <th>ICE</th>
                    <th>확정</th>
                  </tr>
                </thead>
                <tbody>
                  {allTasks.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.title || '(제목 없음)'}</strong><br /><small>{t.desc}</small></td>
                      <td><input type="number" min={1} max={10} value={session1.evaluations?.[t.id]?.impact ?? ''} onChange={(e) => updateIce(t.id, 'impact', e.target.value)} /></td>
                      <td><input type="number" min={1} max={10} value={session1.evaluations?.[t.id]?.ease ?? ''} onChange={(e) => updateIce(t.id, 'ease', e.target.value)} /></td>
                      <td><input type="number" min={1} max={10} value={session1.evaluations?.[t.id]?.confidence ?? ''} onChange={(e) => updateIce(t.id, 'confidence', e.target.value)} /></td>
                      <td className="ice-score">{iceScore(session1.evaluations?.[t.id]) ?? '—'}</td>
                      <td><input type="checkbox" checked={(session1.confirmedIds || []).includes(t.id)} onChange={() => toggleConfirm(t.id)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setPhase('session2')}>세션 2로 이동</button>
            <button className="btn btn-primary" onClick={() => setPhase('session3')}>세션 3으로 이동</button>
          </div>
        </main>
      </div>
    );
  }

  // ----- Session 2
  if (phase === 'session2') {
    const track = session2.track || 'A';
    const extra = track === 'A' ? (session2.extraA || []) : (session2.extraB || []);
    return (
      <div className="app-shell">
        <header className="app-header">
          <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="phase-pill" onClick={() => setPhase('prework')}>사전과제</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session1')}>세션 1</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill ph-active">세션 2 (선택)</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session3')}>세션 3</button>
        </header>
        <main className="app-main" style={{ padding: 20 }}>
          <div className="info-banner">
            <span className="icon">2</span>
            <div>
              <p className="title">세션 2 (선택) — 직책자 관점 추가 과제</p>
              <p className="body">Track A: 세션1 확장 / Track B: 임원 범위 외 신규 과제</p>
            </div>
          </div>
          <div className="track-tabs">
            <button type="button" className={`track-tab ${track === 'A' ? 'active' : ''}`} onClick={() => setSession2((s) => ({ ...s, track: 'A' }))}>Track A · 임원 범위 확장</button>
            <button type="button" className={`track-tab ${track === 'B' ? 'active' : ''}`} onClick={() => setSession2((s) => ({ ...s, track: 'B' }))}>Track B · 신규 과제</button>
          </div>
          <p className="section-sub">{track === 'A' ? '세션1 결과 기반 추가 과제를 적어 주세요.' : '임원이 정의하지 않은 영역의 과제를 도출하세요.'}</p>
          {extra.map((t) => (
            <div key={t.id} className="task-card">
              <div className="task-dot" />
              <div style={{ flex: 1 }}>
                <input className="extra-title" placeholder="과제 제목" value={t.title || ''} onChange={(e) => updateExtra(track, t.id, 'title', e.target.value)} />
                <input className="extra-desc" placeholder="설명" value={t.desc || ''} onChange={(e) => updateExtra(track, t.id, 'desc', e.target.value)} />
              </div>
              <button type="button" className="btn btn-sm" onClick={() => delExtra(track, t.id)}>삭제</button>
            </div>
          ))}
          <div className="add-row" onClick={() => addExtra(track)}>+ {track === 'A' ? '확장' : '신규'} 과제 추가</div>
          <div style={{ marginTop: 16 }}>
            <button className="btn btn-primary" onClick={() => setPhase('session3')}>세션 3으로 이동</button>
          </div>
        </main>
      </div>
    );
  }

  // ----- Session 3
  const defFields = [
    { key: 'title', label: '과제명', type: 'text' },
    { key: 'background', label: '배경 및 목표', type: 'textarea' },
    { key: 'scope', label: '범위·수준', type: 'textarea' },
    { key: 'workflowSummary', label: '관련 워크플로우 요약', type: 'textarea' },
    { key: 'constraints', label: '제약·요건', type: 'textarea' },
    { key: 'keyMan', label: 'Key Man·담당', type: 'text' },
    { key: 'dataStrategy', label: '데이터 확보 전략', type: 'textarea' },
    { key: 'securityNotes', label: '보안·인프라 메모', type: 'textarea' },
  ];
  const wfSummary = (prework.workflowSteps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((s) => s.title).join(' → ');

  return (
    <div className="app-shell">
      <header className="app-header">
        <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
        <div style={{ flex: 1 }} />
        <button type="button" className="phase-pill" onClick={() => setPhase('session1')}>세션 1</button>
        <span className="ph-sep" />
        <button type="button" className="phase-pill" onClick={() => setPhase('session2')}>세션 2</button>
        <span className="ph-sep" />
        <button type="button" className="phase-pill ph-active">세션 3</button>
      </header>
      <main className="app-main" style={{ padding: 20 }}>
        <div className="info-banner">
          <span className="icon">3</span>
          <div>
            <p className="title">세션 3 — 과제 리스트업 및 과업인계서</p>
            <p className="body">전체 과제를 정리하고 과제정의서를 작성한 뒤 인쇄/PDF로 인계하세요.</p>
          </div>
        </div>
        <div className="section-block">
          <h3>전체 과제 리스트</h3>
          {finalTasks.map((t, i) => (
            <div key={t.id} className="task-card">
              <div className="task-dot" />
              <div style={{ flex: 1 }}>
                <p className="title">{i + 1}. {t.title || '(제목 없음)'}</p>
                <p className="desc">{t.desc} <small>[{t.source === 'extraA' ? '세션2 확장' : t.source === 'extraB' ? '세션2 신규' : '임원 기반'}]</small></p>
              </div>
            </div>
          ))}
        </div>
        <div className="section-block">
          <h3>과제정의서 작성</h3>
          {finalTasks.map((t) => {
            const d = session3.definitions?.[t.id] || {};
            if (!d.title) d.title = t.title;
            if (!d.workflowSummary) d.workflowSummary = wfSummary;
            return (
              <div key={t.id} className="def-card">
                <p className="section-title">과제: {t.title}</p>
                {defFields.map((f) => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <label>{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea value={d[f.key] ?? ''} onChange={(e) => updateDef(t.id, f.key, e.target.value)} rows={3} />
                    ) : (
                      <input type="text" value={d[f.key] ?? ''} onChange={(e) => updateDef(t.id, f.key, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
        <div className="no-print">
          <button type="button" className="btn btn-primary" onClick={() => window.print()}>과제정의서 인쇄 / PDF 저장</button>
        </div>
      </main>
    </div>
  );
}

function QuestionForm({ onSubmit }) {
  const [text, setText] = useState('');
  return (
    <>
      <textarea rows={3} placeholder="질문 입력..." value={text} onChange={(e) => setText(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} />
      <div style={{ textAlign: 'right' }}>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => { onSubmit(text); setText(''); }}>질문 제출</button>
      </div>
    </>
  );
}
