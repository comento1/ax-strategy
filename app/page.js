'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ax_workshop';

const WORKFLOW_GUIDE = '생각하시는 업무의 흐름을 작성해 주세요. 아래에서 "단계로 쪼개기"를 누르면 워크플로우 단계로 나눠 드립니다.';

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
  const [viewDepartment, setViewDepartment] = useState(''); // 리뷰 시 보기용 본부 (기본: 내 본부)
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
  const [participantName, setParticipantName] = useState(() => loadLocal()?.participantName || '');
  const [participantPosition, setParticipantPosition] = useState(() => loadLocal()?.participantPosition || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiType, setAiType] = useState('workflow');
  const [aiUserInput, setAiUserInput] = useState('');
  const [aiSplitInput, setAiSplitInput] = useState('');
  const [aiTaskInput, setAiTaskInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedPreworkId, setExpandedPreworkId] = useState(null);
  const [session1Step, setSession1Step] = useState('list'); // list | ice
  const [agreedTasks, setAgreedTasks] = useState(() => {
    const local = loadLocal();
    return local?.agreedTasks || [];
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [preworkStep, setPreworkStep] = useState(1); // 1: 워크플로우, 2: 과제 후보, 3: 질문
  const [workflowExample, setWorkflowExample] = useState(''); // 선택 영역별 예시 (API로 로드)
  const [questionSubmitted, setQuestionSubmitted] = useState(false); // 질문 제출 후 "등록되었습니다" 표시

  useEffect(() => {
    fetch('/api/logo')
      .then((r) => r.json())
      .then((d) => { if (d.logoUrl) setLogoUrl(d.logoUrl); })
      .catch(() => {});
  }, []);

  const persist = useCallback(() => {
    saveLocal({ prework, session1, session2, session3, currentPhase: phase, department, participantName, participantPosition, agreedTasks });
  }, [prework, session1, session2, session3, phase, department, participantName, participantPosition, agreedTasks]);

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
        .then((list) => {
          setSharedPrework(list);
          if (agreedTasks.length === 0 && list.length > 0) {
            const flat = list.flatMap((pw) => (pw.taskCandidates || []).map((t) => ({
              id: t.id,
              title: t.title,
              desc: t.desc,
              level: t.level,
              submissionId: pw.id,
              participantName: pw.participantName,
            })));
            const seen = new Set();
            setAgreedTasks(flat.filter((t) => { if (seen.has(t.id)) return false; seen.add(t.id); return true; }));
          }
        })
        .catch(() => setSharedPrework([]));
    }
  }, [phase, department]);

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
  const addTask = (level = 'low') => {
    setPrework((p) => ({
      ...p,
      taskCandidates: [...(p.taskCandidates || []), { id: id(), title: '', desc: '', level: level }],
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
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/prework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department,
          participantName: participantName || '익명',
          participantPosition: participantPosition || '',
          selectedStrategyId: prework.selectedStrategyId,
          strategyTitle: prework.strategyTitle,
          workflowSteps: prework.workflowSteps,
          taskCandidates: prework.taskCandidates,
          questions: prework.questions,
        }),
      });
      if (res.ok) setPhase('session1');
      else alert('제출에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };
  const callAi = async (type) => {
    const t = type || aiType;
    setAiType(t);
    setAiLoading(true);
    setAiResult('');
    try {
      const context = t === 'workflow' || t === 'workflow_split' ? (prework.strategyTitle || '') : (prework.workflowSteps || []).map((s) => `${s.title}: ${s.desc}`).join('\n');
      const userInput = t === 'workflow_split' ? aiSplitInput : t === 'task' ? aiTaskInput : t === 'example' ? (department || '') : aiUserInput;
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: t, context, userInput }),
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

  const loadWorkflowExample = async () => {
    if (!prework.strategyTitle?.trim()) return;
    setAiLoading(true);
    setWorkflowExample('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'example', context: prework.strategyTitle, userInput: department || '' }),
      });
      const data = await res.json();
      if (data.error) setWorkflowExample('예시 불러오기 실패: ' + data.error);
      else setWorkflowExample(data.text || '');
    } catch (e) {
      setWorkflowExample('예시 불러오기 실패: ' + e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const submitQuestionOnly = async (questionText) => {
    if (!questionText?.trim()) return;
    setSubmitting(true);
    setQuestionSubmitted(false);
    try {
      const res = await fetch('/api/prework', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'question',
          department: department || '',
          participantName: participantName || '익명',
          participantPosition: participantPosition || '',
          question: questionText.trim(),
        }),
      });
      if (res.ok) setQuestionSubmitted(true);
      else alert('질문 등록에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateAgreedTask = (taskId, field, value) => {
    setAgreedTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, [field]: value } : t)));
  };
  const moveAgreedTask = (taskId, dir) => {
    setAgreedTasks((prev) => {
      const i = prev.findIndex((t) => t.id === taskId);
      if (i < 0 || (dir === 'up' && i === 0) || (dir === 'down' && i === prev.length - 1)) return prev;
      const j = dir === 'up' ? i - 1 : i + 1;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const tasksForIce = agreedTasks.length > 0 ? agreedTasks : [
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
    const fromConf = conf.map((id) => tasksForIce.find((t) => t.id === id)).filter(Boolean);
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
          {logoUrl && <div className="entry-logo-wrap"><img src={logoUrl} alt="" className="app-logo entry-logo" /></div>}
          <h1>롯데웰푸드 AI 전환 과제 설계</h1>
          <p>작성본부와 참가자 정보를 입력한 뒤, AX 전략 리뷰 또는 본 워크숍으로 이동하세요.</p>
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
          <div className="entry-fields">
            <input type="text" className="entry-input" placeholder="이름" value={participantName} onChange={(e) => setParticipantName(e.target.value)} />
            <input type="text" className="entry-input" placeholder="직급 (예: 팀장, 매니저)" value={participantPosition} onChange={(e) => setParticipantPosition(e.target.value)} />
          </div>
          <p className="entry-hint">이름·직급은 본인이 작성한 데이터 수정 권한 확인에 사용됩니다.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary" disabled={!department || !participantName?.trim()} onClick={() => { setViewDepartment(department); setPhase('review'); }}>
              AX 전략 영역 리뷰 → 사전과제
            </button>
            <button className="btn" disabled={!department || !participantName?.trim()} onClick={() => setPhase('session1')}>
              본 워크숍 입장 (세션 1부터)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----- Strategy review (then prework): 보기 본부 선택, 상세는 시트 전체 필드 표시
  const strategyDetailFields = ['요약제목', '요약설명', '작성본부', 'AI 적용 기대영역', 'AI 적용 기대이유', '기대하는 변화의 모습', '수행 조직', '구현 간 고려사항'];
  if (phase === 'review') {
    const currentViewDept = viewDepartment || department;
    const listForView = (strategies.strategies || []).filter((s) => (s.작성본부 || '').trim() === currentViewDept);
    const canSelectForPrework = selectedStrategy && (selectedStrategy.작성본부 || '').trim() === (department || '').trim();
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-left">
            {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
            <span className="app-title">롯데웰푸드 AI 전략 구체화</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{participantName} · {department}</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-sm" onClick={() => setPhase('entry')}>본부/이름 변경</button>
        </header>
        <main className="app-main" style={{ padding: 20 }}>
          <div className="info-banner">
            <span className="icon">i</span>
            <div>
              <p className="title">임원진이 도출한 AX 전략</p>
              <p className="body">아래에서 <strong>보기 본부</strong>를 바꿔 다른 본부 과제도 볼 수 있습니다. 사전과제 진행은 <strong>본인 본부({department})</strong> 과제만 선택할 수 있습니다.</p>
            </div>
          </div>
          <div className="review-actions" style={{ marginBottom: 16, flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>보기 본부:</span>
            <select
              value={currentViewDept}
              onChange={(e) => setViewDepartment(e.target.value)}
              style={{ minWidth: 160, padding: '6px 10px' }}
            >
              <option value={department}>{department} (내 본부)</option>
              {(strategies.departments || []).filter((d) => d !== department).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="strategy-dept-block">
            <h3 className="strategy-dept-title">{currentViewDept}</h3>
            <div className="strategy-list-view">
              {listForView.map((s) => {
                const cardTitle = (s.요약제목 || s['AI 적용 기대영역'] || s.제목 || '').trim() || '(제목 없음)';
                const cardDesc = (s.요약설명 || s['AI 적용 기대이유'] || s.리스트설명 || s.내용 || '').trim();
                return (
                  <div key={s.id} className={`strategy-card strategy-card-full ${selectedStrategy?.id === s.id ? 'sel' : ''}`} onClick={() => setSelectedStrategy(selectedStrategy?.id === s.id ? null : s)}>
                    <div className="strategy-card-head">
                      <p className="strategy-card-title">{cardTitle}</p>
                      {cardDesc && <p className="strategy-card-desc">{cardDesc}</p>}
                    </div>
                    {(selectedStrategy?.id === s.id) && (
                      <div className="strategy-card-detail">
                        {strategyDetailFields.map((key) => (s[key] != null && String(s[key]).trim() !== '') && (
                          <div key={key} className="strategy-detail-row">
                            <span className="strategy-detail-label">{key}</span>
                            <span className="strategy-detail-value">{s[key]}</span>
                          </div>
                        ))}
                        {/* 시트에만 있는 그 외 컬럼도 표시 */}
                        {Object.keys(s).filter((k) => !strategyDetailFields.includes(k) && k !== 'id' && s[k] != null && String(s[k]).trim() !== '').map((key) => (
                          <div key={key} className="strategy-detail-row">
                            <span className="strategy-detail-label">{key}</span>
                            <span className="strategy-detail-value">{s[key]}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {listForView.length === 0 && <p className="section-sub">해당 본부에 등록된 전략이 없습니다.</p>}
          </div>
          <div className="review-actions">
            {selectedStrategy && !canSelectForPrework && (
              <p style={{ fontSize: 12, color: 'var(--color-warning)', marginBottom: 8 }}>본인 본부 과제만 사전과제로 선택할 수 있습니다. 위에서 내 본부({department})로 보기를 바꾼 뒤 우리 본부 과제를 선택하세요.</p>
            )}
            <button
              className="btn btn-primary"
              disabled={!canSelectForPrework}
              onClick={() => {
                const title = selectedStrategy.요약제목 || selectedStrategy['AI 적용 기대영역'] || selectedStrategy.제목 || '';
                setPrework((p) => ({ ...p, selectedStrategyId: selectedStrategy.id, strategyTitle: title, strategyFull: selectedStrategy }));
                setPreworkStep(1);
                setWorkflowExample('');
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

  // ----- Prework (단계: 1 워크플로우, 2 과제 후보, 3 질문하기)
  if (phase === 'prework') {
    const steps = (prework.workflowSteps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    const applySplitResult = () => {
      if (!aiResult || aiType !== 'workflow_split') return;
      const lines = aiResult.split('\n').filter((l) => /^\d+\./.test(l.trim()));
      const newSteps = lines.map((line, i) => {
        const clean = line.replace(/^\d+\.\s*/, '').trim();
        const dash = clean.indexOf(' — ');
        const title = dash >= 0 ? clean.substring(0, dash).trim() : clean;
        const rest = dash >= 0 ? clean.substring(dash + 3).trim() : '';
        const paren = rest.lastIndexOf('(');
        const desc = paren >= 0 ? rest.substring(0, paren).trim() : rest;
        const aiTag = (rest.indexOf('AI 적용 가능') >= 0) ? 'ai' : 'review';
        return { id: id(), order: i, title, desc, aiTag };
      });
      setPrework((p) => ({ ...p, workflowSteps: newSteps }));
      setAiResult('');
    };
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-left">
            {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
            <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          </div>
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
                <p className="one-liner">{prework.strategyTitle?.slice(0, 60) || '—'}{(prework.strategyTitle?.length || 0) > 60 ? '…' : ''}</p>
              </div>
              <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--color-border-tertiary)' }}>
                <p className="section-label">단계</p>
                <div className={`guide-row ${preworkStep === 1 ? 'active' : ''}`}><span className="guide-n">1</span><p className="guide-text">워크플로우 작성·단계로 쪼개기</p></div>
                <div className={`guide-row ${preworkStep === 2 ? 'active' : ''}`}><span className="guide-n">2</span><p className="guide-text">과제 후보 목록 도출</p></div>
                <div className={`guide-row ${preworkStep === 3 ? 'active' : ''}`} style={{ marginBottom: 0 }}><span className="guide-n">3</span><p className="guide-text">강사에게 질문하기</p></div>
              </div>
            </aside>
            <div className="prework-body">
              <div className="section-block" style={{ marginBottom: 16 }}>
                <div className="session1-step-tabs" style={{ marginBottom: 0 }}>
                  <button type="button" className={preworkStep === 1 ? 'active' : ''} onClick={() => setPreworkStep(1)}>1. 워크플로우</button>
                  <button type="button" className={preworkStep === 2 ? 'active' : ''} onClick={() => setPreworkStep(2)}>2. 과제 후보</button>
                  <button type="button" className={preworkStep === 3 ? 'active' : ''} onClick={() => setPreworkStep(3)}>3. 질문하기</button>
                </div>
              </div>

              {preworkStep === 1 && (
                <div className="section-block">
                  <p className="section-title">워크플로우</p>
                  <p className="section-sub wf-guide-text">{WORKFLOW_GUIDE}</p>
                  <div className="wf-example" style={{ marginBottom: 12 }}>
                    <strong>작성 예시 (선택한 영역 기준)</strong>
                    {workflowExample ? (
                      <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', fontSize: 11 }}>{workflowExample}</pre>
                    ) : (
                      <button type="button" className="btn btn-sm" disabled={aiLoading} onClick={loadWorkflowExample} style={{ marginTop: 8 }}>{aiLoading ? '불러오는 중…' : '예시 불러오기'}</button>
                    )}
                  </div>
                  <div className="ai-assist-box ai-box-split">
                    <p className="section-label">업무 흐름을 한 덩어리로 적은 뒤 단계로 쪼개기</p>
                    <textarea placeholder="생각하시는 업무의 흐름을 작성해 주세요" value={aiSplitInput} onChange={(e) => setAiSplitInput(e.target.value)} rows={4} style={{ width: '100%' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-sm btn-primary" disabled={aiLoading} onClick={() => callAi('workflow_split')}>{aiLoading ? '처리 중…' : '단계로 쪼개기'}</button>
                      {aiResult && aiType === 'workflow_split' && <button type="button" className="btn btn-sm" onClick={applySplitResult}>결과를 워크플로우에 반영</button>}
                    </div>
                    {aiResult && aiType === 'workflow_split' && <div className="result" style={{ marginTop: 8 }}>{aiResult}</div>}
                  </div>
                  <p className="section-label" style={{ marginTop: 16 }}>워크플로우 단계 (수정 가능)</p>
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
                  <button type="button" className="btn btn-sm" style={{ marginTop: 12 }} onClick={() => setPreworkStep(2)}>다음: 과제 후보 목록 →</button>
                </div>
              )}

              {preworkStep === 2 && (
                <div className="section-block">
                  <p className="section-title">과제 후보 목록</p>
                  <p className="section-sub">상위 과제(전체 흐름 개선·자동화)와 하위 과제(단계별 개선)를 구분해 도출하세요.</p>
                  <div className="ai-assist-box ai-box-task">
                    <p className="section-label">AI 과제 후보 제안 (상위·하위 구분)</p>
                    <textarea placeholder="추가 설명 (선택)" value={aiTaskInput} onChange={(e) => setAiTaskInput(e.target.value)} rows={2} />
                    <button type="button" className="btn btn-sm btn-primary" disabled={aiLoading} onClick={() => callAi('task')}>{aiLoading ? '생성 중…' : '과제 제안 받기'}</button>
                    {aiType === 'task' && aiResult && <div className="result">{aiResult}</div>}
                  </div>
                  <div className="task-add-buttons">
                    <button type="button" className="btn btn-sm" onClick={() => addTask('high')}>+ 상위 과제 추가</button>
                    <button type="button" className="btn btn-sm" onClick={() => addTask('low')}>+ 하위 과제 추가</button>
                  </div>
                  {(prework.taskCandidates || []).map((t) => (
                    <div key={t.id} className={`task-card task-level-${t.level || 'low'}`}>
                      <span className={`task-level-badge ${(t.level || 'low') === 'high' ? 'level-high' : 'level-low'}`}>{(t.level || 'low') === 'high' ? '상위' : '하위'}</span>
                      <div style={{ flex: 1 }}>
                        <input className="task-input-title" placeholder="과제 제목" value={t.title || ''} onChange={(e) => updateTask(t.id, 'title', e.target.value)} />
                        <input className="task-input-desc" placeholder="설명" value={t.desc || ''} onChange={(e) => updateTask(t.id, 'desc', e.target.value)} />
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => delTask(t.id)}>삭제</button>
                    </div>
                  ))}
                  <div style={{ marginTop: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-sm" onClick={() => setPreworkStep(1)}>← 워크플로우</button>
                    <button type="button" className="btn btn-sm" onClick={() => setPreworkStep(3)}>다음: 질문하기 →</button>
                    <button className="btn btn-primary" disabled={submitting || !prework.workflowSteps?.length || !prework.taskCandidates?.length} onClick={() => {
                      if (!prework.workflowSteps?.length || !prework.taskCandidates?.length) {
                        alert('워크플로우 단계와 과제 후보를 각각 1개 이상 입력해 주세요.');
                        return;
                      }
                      submitPreworkToServer();
                    }}>
                      {submitting ? '제출 중…' : '사전과제 제출 → 세션 1'}
                    </button>
                  </div>
                </div>
              )}

              {preworkStep === 3 && (
                <div className="section-block">
                  <div className="def-card">
                    <p className="section-title">강사에게 질문하기</p>
                    <p className="section-sub">질문을 입력하고 제출하면 구글 시트에 저장됩니다.</p>
                    <QuestionSubmitForm onSubmit={submitQuestionOnly} submitting={submitting} submitted={questionSubmitted} />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <button type="button" className="btn btn-sm" onClick={() => setPreworkStep(2)}>← 과제 후보</button>
                    {prework.workflowSteps?.length > 0 && prework.taskCandidates?.length > 0 && (
                      <button className="btn btn-primary" style={{ marginLeft: 8 }} disabled={submitting} onClick={() => submitPreworkToServer()}>
                        {submitting ? '제출 중…' : '사전과제 제출 → 세션 1'}
                      </button>
                    )}
                  </div>
                </div>
              )}
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
          <div className="app-header-left">
            {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
            <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          </div>
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
            <p className="session1-dept-note">같은 작성본부({department}) 제출 목록입니다. 카드를 클릭하면 워크플로우·과제 목록·질문을 펼쳐 볼 수 있습니다.</p>
            {sharedPrework.length === 0 && <p className="section-sub">제출된 사전과제가 없습니다. 사전과제를 제출한 뒤 새로고침하세요.</p>}
            {sharedPrework.map((pw) => (
              <div key={pw.id} className={`shared-prework-card ${expandedPreworkId === pw.id ? 'expanded' : ''}`} onClick={() => setExpandedPreworkId(expandedPreworkId === pw.id ? null : pw.id)}>
                <div className="shared-prework-head">
                  <p className="section-title">{pw.participantName || '익명'} · {pw.strategyTitle?.slice(0, 60)}{(pw.strategyTitle?.length || 0) > 60 ? '…' : ''}</p>
                  <p className="section-sub">워크플로우 {pw.workflowSteps?.length || 0}단계, 과제 후보 {pw.taskCandidates?.length || 0}개 · 클릭하여 펼치기</p>
                </div>
                {expandedPreworkId === pw.id && (
                  <div className="shared-prework-body">
                    <p className="section-label">워크플로우</p>
                    <ol className="shared-wf-list">{(pw.workflowSteps || []).map((s, i) => <li key={s.id || i}>{s.title} — {s.desc}</li>)}</ol>
                    <p className="section-label">과제 후보</p>
                    <ul className="shared-task-list">{(pw.taskCandidates || []).map((t, i) => <li key={t.id || i}><strong>{t.title}</strong> {t.desc}</li>)}</ul>
                    {(pw.questions || []).length > 0 && (<><p className="section-label">질문</p><ul className="shared-q-list">{(pw.questions || []).map((q, i) => <li key={i}>{q}</li>)}</ul></>)}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="section-block">
            <div className="session1-step-tabs">
              <button type="button" className={session1Step === 'list' ? 'active' : ''} onClick={() => setSession1Step('list')}>1. 과제 목록 통합·우선순위</button>
              <button type="button" className={session1Step === 'ice' ? 'active' : ''} onClick={() => setSession1Step('ice')}>2. ICE 정량 평가</button>
            </div>
            {session1Step === 'list' && (
              <>
                <h3>과제 목록 통합 및 우선순위·합의</h3>
                <p className="section-sub">본부 내 제출에서 모인 과제입니다. 순서를 정하고, 필요 시 제목·설명을 합의해 수정한 뒤, 2단계에서 ICE 평가를 진행하세요.</p>
                {tasksForIce.map((t, i) => (
                  <div key={t.id} className="agreed-task-row">
                    <span className="agreed-order">{i + 1}</span>
                    <div className="agreed-task-fields">
                      <input type="text" value={t.title || ''} onChange={(e) => updateAgreedTask(t.id, 'title', e.target.value)} placeholder="과제 제목" />
                      <input type="text" value={t.desc || ''} onChange={(e) => updateAgreedTask(t.id, 'desc', e.target.value)} placeholder="설명" />
                    </div>
                    <div className="agreed-task-actions">
                      <button type="button" className="btn btn-sm" onClick={() => moveAgreedTask(t.id, 'up')} disabled={i === 0}>↑</button>
                      <button type="button" className="btn btn-sm" onClick={() => moveAgreedTask(t.id, 'down')} disabled={i === tasksForIce.length - 1}>↓</button>
                    </div>
                  </div>
                ))}
                <button type="button" className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setSession1Step('ice')}>우선순위 반영 완료 → ICE 평가로</button>
              </>
            )}
            {session1Step === 'ice' && (
              <>
                <h3>현실성 검토 — ICE 정량 평가</h3>
                <p className="section-sub">각 과제에 대해 아래 세 가지를 1~10점으로 평가하세요. 점수는 드롭다운에서 선택합니다. 「우선 구현 과제로 선정」에 체크한 과제가 최종 구현 대상이 됩니다.</p>
                <ul className="ice-criteria-list">
                  <li><strong>전략 부합도</strong> — 임원진이 규명한 조직 문제를 해결하는가?</li>
                  <li><strong>구현 가능성</strong> — 사내 보안·인프라 환경 내에서 구현 가능한가?</li>
                  <li><strong>데이터 확보성</strong> — 필요한 데이터가 확보되어 있거나 확보 가능한가?</li>
                </ul>
                <div style={{ overflowX: 'auto' }}>
                  <table className="ice-table">
                    <thead>
                      <tr>
                        <th>과제</th>
                        <th>전략 부합도<br/><small>(1~10)</small></th>
                        <th>구현 가능성<br/><small>(1~10)</small></th>
                        <th>데이터 확보성<br/><small>(1~10)</small></th>
                        <th>ICE 점수</th>
                        <th>우선 구현 과제로 선정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tasksForIce.map((t) => (
                        <tr key={t.id}>
                          <td><strong>{t.title || '(제목 없음)'}</strong><br /><small>{t.desc}</small></td>
                          <td>
                            <select value={session1.evaluations?.[t.id]?.impact ?? ''} onChange={(e) => updateIce(t.id, 'impact', e.target.value)}>
                              <option value="">선택</option>
                              {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}점</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={session1.evaluations?.[t.id]?.ease ?? ''} onChange={(e) => updateIce(t.id, 'ease', e.target.value)}>
                              <option value="">선택</option>
                              {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}점</option>)}
                            </select>
                          </td>
                          <td>
                            <select value={session1.evaluations?.[t.id]?.confidence ?? ''} onChange={(e) => updateIce(t.id, 'confidence', e.target.value)}>
                              <option value="">선택</option>
                              {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>{n}점</option>)}
                            </select>
                          </td>
                          <td className="ice-score">{iceScore(session1.evaluations?.[t.id]) ?? '—'}</td>
                          <td><label className="ice-confirm-label"><input type="checkbox" checked={(session1.confirmedIds || []).includes(t.id)} onChange={() => toggleConfirm(t.id)} /> 우선 구현</label></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
          <div className="app-header-left">
            {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
            <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          </div>
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
        <div className="app-header-left">
          {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
          <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
        </div>
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

function QuestionSubmitForm({ onSubmit, submitting, submitted }) {
  const [text, setText] = useState('');
  const handleSubmit = () => {
    if (!text.trim()) return;
    onSubmit(text);
    setText('');
  };
  return (
    <>
      <textarea rows={3} placeholder="질문 입력..." value={text} onChange={(e) => setText(e.target.value)} style={{ width: '100%', padding: 8, marginBottom: 8 }} disabled={submitting} />
      <div style={{ textAlign: 'right' }}>
        <button type="button" className="btn btn-sm btn-primary" disabled={submitting || !text.trim()} onClick={handleSubmit}>{submitting ? '등록 중…' : '질문 등록'}</button>
      </div>
      {submitted && <p style={{ marginTop: 8, color: 'var(--color-text-success)', fontSize: 13 }}>등록되었습니다.</p>}
    </>
  );
}
