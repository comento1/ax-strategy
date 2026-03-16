'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'ax_workshop';

const WORKFLOW_GUIDE = '업무 흐름을 한 덩어리로 적은 뒤 「단계로 쪼개기」를 누르면 단계별로 정리됩니다.';

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
    return local?.session1 || { evaluations: {}, priorityRanks: {} };
  });
  const [session2, setSession2] = useState(() => {
    const local = loadLocal();
    return local?.session2 || { ideas: [], recommended: [], extraB: [] };
  });
  const [session3, setSession3] = useState(() => {
    const local = loadLocal();
    return local?.session3 || { definitions: {} };
  });
  const [sharedPrework, setSharedPrework] = useState([]);
  const [participantName, setParticipantName] = useState('');
  const [participantPosition, setParticipantPosition] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState('');
  const [aiType, setAiType] = useState('workflow');
  const [aiUserInput, setAiUserInput] = useState('');
  const [aiSplitInput, setAiSplitInput] = useState('');
  const [aiTaskInput, setAiTaskInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedPreworkId, setExpandedPreworkId] = useState(null);
  const [agreedTasks, setAgreedTasks] = useState(() => {
    const local = loadLocal();
    return local?.agreedTasks || [];
  });
  const [logoUrl, setLogoUrl] = useState('');
  const [preworkStep, setPreworkStep] = useState(1); // 1: 워크플로우, 2: 과제 후보, 3: 질문
  const [workflowExample, setWorkflowExample] = useState(''); // 선택 영역별 예시 (API로 로드)
  const [questionSubmitted, setQuestionSubmitted] = useState(false); // 질문 제출 후 "등록되었습니다" 표시
  const [detailModalStrategy, setDetailModalStrategy] = useState(null); // 리뷰/사전과제에서 전략 상세 모달
  const [session3SelectedTaskId, setSession3SelectedTaskId] = useState(null); // 세션3에서 선택한 과제(정의서 보기)

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
  const applySplitFromText = (text) => {
    const lines = (text || '').split('\n').filter((l) => /^\d+\./.test(l.trim()));
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
      else {
        if (t === 'workflow_split' && data.text) {
          applySplitFromText(data.text);
          setAiResult('');
        } else setAiResult(data.text || '');
      }
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
  const iceScore = (ev) => {
    if (!ev || ev.impact == null || ev.ease == null || ev.confidence == null) return null;
    return Math.round(((ev.impact + ev.ease + ev.confidence) / 3) * 10) / 10;
  };
  const tasksForIceRaw = agreedTasks.length > 0 ? agreedTasks : [
    ...(prework.taskCandidates || []),
    ...(session2.extraB || []).map((t) => ({ ...t, source: 'extraB' })),
  ];
  const iceScoreForTask = (t) => iceScore(session1.evaluations?.[t.id]);
  const tasksForIce = [...tasksForIceRaw].sort((a, b) => {
    const sa = iceScoreForTask(a);
    const sb = iceScoreForTask(b);
    if (sa == null && sb == null) return 0;
    if (sa == null) return 1;
    if (sb == null) return -1;
    return sa - sb;
  });
  const updateIce = (taskId, field, value) => {
    setSession1((s) => ({
      ...s,
      evaluations: { ...(s.evaluations || {}), [taskId]: { ...(s.evaluations?.[taskId] || {}), [field]: value === '' ? undefined : Number(value) } },
    }));
  };
  const setPriorityRank = (taskId, rank) => {
    setSession1((s) => {
      const prev = s.priorityRanks || {};
      if (rank === '') {
        const next = { ...prev }; delete next[taskId]; return { ...s, priorityRanks: next };
      }
      const num = Number(rank);
      const next = { ...prev };
      Object.keys(next).forEach((id) => { if (next[id] === num && id !== taskId) delete next[id]; });
      next[taskId] = num;
      return { ...s, priorityRanks: next };
    });
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
  const addIdea = () => {
    setSession2((s) => ({ ...s, ideas: [...(s.ideas || []), { id: id(), title: '', asIs: '', toBe: '', taskType: 'new' }] }));
  };
  const updateIdea = (ideaId, field, value) => {
    setSession2((s) => ({ ...s, ideas: (s.ideas || []).map((i) => (i.id === ideaId ? { ...i, [field]: value } : i)) }));
  };
  const delIdea = (ideaId) => {
    setSession2((s) => ({ ...s, ideas: (s.ideas || []).filter((i) => i.id !== ideaId) }));
  };
  const addRecommendedToExtra = (item) => {
    setSession2((s) => ({ ...s, extraB: [...(s.extraB || []), { id: id(), title: item.title || '', desc: item.desc || '' }] }));
  };

  const priorityRanks = session1.priorityRanks || {};
  const finalTasks = (() => {
    const ranked = tasksForIceRaw.filter((t) => priorityRanks[t.id] != null).sort((a, b) => (priorityRanks[a.id] || 99) - (priorityRanks[b.id] || 99));
    return ranked.length > 0 ? ranked : [];
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

  const strategyDetailOrder = ['AI 적용 기대영역', 'AI 적용 기대이유', '기대하는 변화의 모습', '요약제목', '요약설명', '수행 조직', '구현 간 고려사항'];
  const strategyDetailExclude = ['작성본부', '핵심 한 줄 요약', 'id', '_G열'];
  const renderStrategyDetailCards = (s) => {
    if (!s) return null;
    const ordered = strategyDetailOrder.filter((key) => s[key] != null && String(s[key]).trim() !== '');
    const rest = Object.keys(s).filter((k) => !strategyDetailOrder.includes(k) && !strategyDetailExclude.includes(k) && s[k] != null && String(s[k]).trim() !== '');
    return (
      <>
        {ordered.map((key) => (
          <div key={key} className="strategy-detail-card">
            <span className="strategy-detail-label">{key}</span>
            <span className="strategy-detail-value">{s[key]}</span>
          </div>
        ))}
        {rest.map((key) => (
          <div key={key} className="strategy-detail-card">
            <span className="strategy-detail-label">{key}</span>
            <span className="strategy-detail-value">{s[key]}</span>
          </div>
        ))}
      </>
    );
  };

  // ----- Strategy review: 카드 뉴스 가로 배치, 더 읽어보기 → 모달
  if (phase === 'review') {
    const currentViewDept = viewDepartment || department;
    const listForView = (strategies.strategies || []).filter((s) => (s.작성본부 || '').trim() === currentViewDept);
    const canSelectForPrework = selectedStrategy && (selectedStrategy.작성본부 || '').trim() === (department || '').trim();
    const goToPrework = (strategy) => {
      const s = strategy || selectedStrategy;
      if (!s) return;
      if ((s.작성본부 || '').trim() !== (department || '').trim()) {
        alert('본인 본부 과제만 선택할 수 있습니다. 보기 본부를 「' + department + ' (내 본부)」로 바꾼 뒤, 우리 본부 과제에서 「이 전략으로 진행」을 선택해 주세요.');
        return;
      }
      const title = s.요약제목 || s['AI 적용 기대영역'] || s.제목 || '';
      setPrework((p) => ({ ...p, selectedStrategyId: s.id, strategyTitle: title, strategyFull: s }));
      setPreworkStep(1);
      setWorkflowExample('');
      setDetailModalStrategy(null);
      setSelectedStrategy(s);
      setPhase('prework');
    };
    return (
      <div className="app-shell">
        <header className="app-header app-header-review">
          <div className="app-header-left">
            {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
            <span className="app-title">롯데웰푸드 AI 전략 구체화</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{participantName || '참가자'} · {department}</span>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-sm" onClick={() => setPhase('entry')}>본부/이름 변경</button>
        </header>
        <main className="app-main review-main" style={{ padding: 20 }}>
          <div className="info-banner">
            <span className="icon">i</span>
            <div>
              <p className="title">임원진이 도출한 AX 전략</p>
              <p className="body">임원진이 도출한 AX 전략 중 하나를 선택해 주세요! 도출된 전략을 살펴보고, 우리 팀에서 구체화하고 싶은 주제를 선택하여 다음 단계를 진행해 주세요.</p>
            </div>
          </div>
          <div className="view-dept-wrap">
            <label className="view-dept-label">보기 본부</label>
            <select className="view-dept-select" value={currentViewDept} onChange={(e) => setViewDepartment(e.target.value)}>
              <option value={department}>{department} (내 본부)</option>
              {(strategies.departments || []).filter((d) => d !== department).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="strategy-dept-block">
            <h3 className="strategy-dept-title">{currentViewDept}</h3>
            <div className="strategy-card-news">
              {listForView.map((s) => {
                const cardTitle = (s.요약제목 || s['AI 적용 기대영역'] || s.제목 || s['핵심 한 줄 요약'] || '').trim() || '(제목 없음)';
                const cardDesc = (s._G열 || s.요약설명 || s.리스트설명 || s.내용 || '').trim();
                const isMyDept = (s.작성본부 || '').trim() === (department || '').trim();
                return (
                  <div key={s.id} className="strategy-card-news-item">
                    <div className="card-news-body">
                      <p className="card-news-title">{cardTitle}</p>
                      {cardDesc && <p className="card-news-desc">{cardDesc}</p>}
                      <button type="button" className="btn btn-card-read" onClick={(e) => { e.stopPropagation(); setDetailModalStrategy(s); }}>더 읽어보기</button>
                      {isMyDept && (
                        <button type="button" className="btn btn-card-select" onClick={(e) => { e.stopPropagation(); goToPrework(s); }}>이 전략으로 진행</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {listForView.length === 0 && <p className="section-sub">해당 본부에 등록된 전략이 없습니다.</p>}
          </div>
        </main>
        {detailModalStrategy && (
          <div className="modal-overlay" onClick={() => setDetailModalStrategy(null)}>
            <div className="modal-content strategy-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">{detailModalStrategy.요약제목 || detailModalStrategy['AI 적용 기대영역'] || detailModalStrategy.제목 || '(제목 없음)'}</h3>
                <button type="button" className="modal-close" onClick={() => setDetailModalStrategy(null)} aria-label="닫기">×</button>
              </div>
              <div className="modal-body strategy-detail-cards strategy-detail-modal-body">
                {renderStrategyDetailCards(detailModalStrategy)}
              </div>
              <div className="modal-footer">
                {(detailModalStrategy.작성본부 || '').trim() === (department || '').trim() ? (
                  <button type="button" className="btn btn-primary" onClick={() => goToPrework(detailModalStrategy)}>이 전략으로 진행 →</button>
                ) : (
                  <p className="modal-footer-note">본인 본부 과제만 진행할 수 있습니다.</p>
                )}
                <button type="button" className="btn btn-sm" onClick={() => setDetailModalStrategy(null)}>닫기</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const reorderWfStep = (fromIndex, toIndex) => {
    const steps = (prework.workflowSteps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    if (toIndex < 0 || toIndex >= steps.length) return;
    const [moved] = steps.splice(fromIndex, 1);
    steps.splice(toIndex, 0, moved);
    const updated = steps.map((s, i) => ({ ...s, order: i }));
    setPrework((p) => ({ ...p, workflowSteps: updated }));
  };

  // ----- Prework (단계: 1 워크플로우, 2 과제 후보, 3 질문하기)
  if (phase === 'prework') {
    const steps = (prework.workflowSteps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-left">
            {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
            <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{department} · 사전과제</span>
          <div style={{ flex: 1 }} />
          {preworkStep > 1 && <button type="button" className="btn btn-sm" onClick={() => setPreworkStep(preworkStep - 1)}>← 이전 단계</button>}
          {preworkStep === 1 && <button type="button" className="btn btn-sm btn-primary" onClick={() => setPreworkStep(2)}>다음: 과제 후보 목록 →</button>}
          {preworkStep === 2 && <button type="button" className="btn btn-sm" onClick={() => setPreworkStep(3)}>다음: 질문하기 →</button>}
          {preworkStep === 3 && prework.workflowSteps?.length > 0 && prework.taskCandidates?.length > 0 && <button type="button" className="btn btn-primary" disabled={submitting} onClick={() => submitPreworkToServer()}>{submitting ? '제출 중…' : '사전과제 제출 → 세션 1'}</button>}
          <span className="ph-sep" />
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
              <div className="strategy-card strategy-card-clickable sel" style={{ cursor: 'pointer' }} onClick={() => prework.strategyFull && setDetailModalStrategy(prework.strategyFull)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && prework.strategyFull && setDetailModalStrategy(prework.strategyFull)}>
                <p className="one-liner">{prework.strategyTitle?.slice(0, 60) || '—'}{(prework.strategyTitle?.length || 0) > 60 ? '…' : ''}</p>
                <p className="section-sub" style={{ marginTop: 4 }}>클릭 시 상세 보기</p>
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
                  <p className="section-title">1단계: 워크플로우</p>
                  <p className="section-sub step-guide">{WORKFLOW_GUIDE}</p>
                  <div className="wf-example" style={{ marginBottom: 12 }}>
                    <strong>예시 (선택 영역 기준)</strong>
                    {workflowExample ? (
                      <pre style={{ margin: '8px 0 0', whiteSpace: 'pre-wrap', fontSize: 11 }}>{workflowExample}</pre>
                    ) : (
                      <button type="button" className="btn btn-sm" disabled={aiLoading} onClick={loadWorkflowExample} style={{ marginTop: 8 }}>{aiLoading ? '불러오는 중…' : '예시 불러오기'}</button>
                    )}
                  </div>
                  <div className="ai-assist-box ai-box-split">
                    <textarea placeholder="생각하시는 업무의 흐름을 작성해 주세요" value={aiSplitInput} onChange={(e) => setAiSplitInput(e.target.value)} rows={4} style={{ width: '100%' }} />
                    <button type="button" className="btn btn-sm btn-primary" disabled={aiLoading} onClick={() => callAi('workflow_split')}>{aiLoading ? '처리 중…' : '단계로 쪼개기'}</button>
                  </div>
                  <p className="section-label" style={{ marginTop: 16 }}>워크플로우 단계 (드래그하여 순서 변경)</p>
                  {steps.map((s, i) => (
                    <div key={s.id} className="wf-card wf-card-draggable" draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', i); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const from = parseInt(e.dataTransfer.getData('text/plain'), 10); if (!isNaN(from)) reorderWfStep(from, i); }}>
                      <div className="step-n wf-drag-handle" title="드래그하여 순서 변경">⋮⋮</div>
                      <div className="wf-card-fields">
                        <input className="wf-input-title" placeholder="단계 제목" value={s.title || ''} onChange={(e) => updateWf(s.id, 'title', e.target.value)} />
                        <textarea className="wf-input-desc wf-input-desc-area" placeholder="설명" value={s.desc || ''} onChange={(e) => updateWf(s.id, 'desc', e.target.value)} rows={2} />
                      </div>
                      <div className="wf-tag-choice">
                        <button type="button" className={`wf-tag-opt wf-tag-ai ${s.aiTag === 'ai' ? 'active' : ''}`} onClick={() => updateWf(s.id, 'aiTag', 'ai')} title="AI 적용 영역">
                          <span className="wf-tag-icon" aria-hidden>◇</span>
                          <span>AI 적용 영역</span>
                        </button>
                        <button type="button" className={`wf-tag-opt wf-tag-human ${s.aiTag === 'review' ? 'active' : ''}`} onClick={() => updateWf(s.id, 'aiTag', 'review')} title="사람이 할 것">
                          <span className="wf-tag-icon" aria-hidden>○</span>
                          <span>사람이 할 것</span>
                        </button>
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => delWf(s.id)}>삭제</button>
                    </div>
                  ))}
                  <div className="add-row" onClick={addWfStep}>+ 단계 추가하기</div>
                </div>
              )}

              {preworkStep === 2 && (
                <div className="section-block">
                  <p className="section-title">2단계: 과제 후보</p>
                  <p className="section-sub step-guide">AI 제안을 받거나 직접 과제를 추가해 주세요.</p>
                  <div className="ai-assist-box ai-box-task">
                    <button type="button" className="btn btn-sm btn-primary" disabled={aiLoading} onClick={() => callAi('task')}>{aiLoading ? '생성 중…' : 'AI 과제 제안 받기'}</button>
                    {aiType === 'task' && aiResult && <div className="result">{aiResult}</div>}
                  </div>
                  <div className="task-add-buttons">
                    <button type="button" className="btn btn-task-add" onClick={() => addTask('low')}>
                      <span className="btn-task-add-icon">+</span>
                      <span>과제 추가</span>
                    </button>
                  </div>
                  {(prework.taskCandidates || []).map((t) => (
                    <div key={t.id} className="task-card">
                      <div style={{ flex: 1 }}>
                        <input className="task-input-title" placeholder="과제 제목" value={t.title || ''} onChange={(e) => updateTask(t.id, 'title', e.target.value)} />
                        <input className="task-input-desc" placeholder="설명" value={t.desc || ''} onChange={(e) => updateTask(t.id, 'desc', e.target.value)} />
                      </div>
                      <button type="button" className="btn btn-sm" onClick={() => delTask(t.id)}>삭제</button>
                    </div>
                  ))}
                  <div style={{ marginTop: 16 }}>
                    <button type="button" className="btn btn-sm" onClick={() => setPreworkStep(1)}>← 워크플로우</button>
                    <button type="button" className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => setPreworkStep(3)}>다음: 질문하기 →</button>
                  </div>
                </div>
              )}

              {preworkStep === 3 && (
                <div className="section-block">
                  <div className="def-card">
                    <p className="section-title">3단계: 강사에게 질문</p>
                    <p className="section-sub step-guide">질문을 입력 후 제출하면 구글 시트에 저장됩니다.</p>
                    <QuestionSubmitForm onSubmit={submitQuestionOnly} submitting={submitting} submitted={questionSubmitted} />
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <button type="button" className="btn btn-sm" onClick={() => setPreworkStep(2)}>← 과제 후보</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
        {detailModalStrategy && phase === 'prework' && (
          <div className="modal-overlay" onClick={() => setDetailModalStrategy(null)}>
            <div className="modal-content strategy-detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">{detailModalStrategy.요약제목 || detailModalStrategy['AI 적용 기대영역'] || detailModalStrategy.제목 || '(제목 없음)'}</h3>
                <button type="button" className="modal-close" onClick={() => setDetailModalStrategy(null)} aria-label="닫기">×</button>
              </div>
              <div className="modal-body strategy-detail-cards strategy-detail-modal-body">
                {renderStrategyDetailCards(detailModalStrategy)}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-sm" onClick={() => setDetailModalStrategy(null)}>닫기</button>
              </div>
            </div>
          </div>
        )}
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
          <button type="button" className="btn btn-sm" onClick={() => setPhase('session2')}>세션 2로 이동</button>
          <button type="button" className="btn btn-primary" onClick={() => setPhase('session3')}>세션 3으로 이동</button>
          <span className="ph-sep" />
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
              <p className="body">본부(<strong>{department}</strong>) 내에서 제출된 사전과제를 검토하고, ICE 정량 평가 후 1~3순위를 부여하세요.</p>
            </div>
          </div>
          <div className="section-block">
            <h3>본부 내 제출된 사전과제 목록</h3>
            <p className="session1-dept-note">같은 작성본부({department})에서 제출된 사전과제입니다. 여러 참가자가 제출한 주제를 검토할 수 있도록 목록으로 표시됩니다. 카드를 클릭하면 워크플로우·과제·질문을 펼쳐 볼 수 있습니다.</p>
            {sharedPrework.length === 0 && <p className="section-sub">제출된 사전과제가 없습니다. 사전과제를 제출한 뒤 새로고침하세요.</p>}
            {sharedPrework.map((pw) => (
              <div key={pw.id} className={`shared-prework-card ${expandedPreworkId === pw.id ? 'expanded' : ''}`} onClick={() => setExpandedPreworkId(expandedPreworkId === pw.id ? null : pw.id)}>
                <div className="shared-prework-head">
                  <p className="section-title">{pw.participantName || '익명'} · {pw.strategyTitle?.slice(0, 80)}{(pw.strategyTitle?.length || 0) > 80 ? '…' : ''}</p>
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
            <h3>ICE 정량 평가</h3>
            <p className="section-sub">각 과제에 1~10점을 부여하고, 1·2·3순위를 선택하세요. ICE 점수 순으로 정렬됩니다.</p>
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
                    <th>순위</th>
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
                      <td>
                        <select value={session1.priorityRanks?.[t.id] ?? ''} onChange={(e) => setPriorityRank(t.id, e.target.value)}>
                          <option value="">선택</option>
                          <option value="1">1순위</option>
                          <option value="2">2순위</option>
                          <option value="3">3순위</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // ----- Session 2: 아이디어 발산 → AI 추천 → 선택
  if (phase === 'session2') {
    const ideas = session2.ideas || [];
    const recommended = session2.recommended || [];
    const fetchIdeaRecommend = async () => {
      if (!ideas.length) { alert('아이디어를 1개 이상 입력해 주세요.'); return; }
      setAiLoading(true);
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'idea_recommend', ideas: ideas.map((i) => ({ title: i.title, asIs: i.asIs, toBe: i.toBe, taskType: i.taskType })) }),
        });
        const data = await res.json();
        if (data.error) alert('추천 받기 실패: ' + data.error);
        else if (data.recommended) setSession2((s) => ({ ...s, recommended: data.recommended }));
        else if (data.text) {
          const lines = (data.text || '').split('\n').filter((l) => l.trim());
          const rec = lines.slice(0, 10).map((line) => ({ title: line.replace(/^\d+\.\s*/, '').trim(), desc: '' }));
          setSession2((s) => ({ ...s, recommended: rec }));
        }
      } finally {
        setAiLoading(false);
      }
    };
    return (
      <div className="app-shell">
        <header className="app-header">
          <div className="app-header-left">
            {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
            <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
          </div>
          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary" onClick={() => setPhase('session3')}>세션 3으로 이동</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('prework')}>사전과제</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session1')}>세션 1</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill ph-active">세션 2</button>
          <span className="ph-sep" />
          <button type="button" className="phase-pill" onClick={() => setPhase('session3')}>세션 3</button>
        </header>
        <main className="app-main" style={{ padding: 20 }}>
          <div className="info-banner">
            <span className="icon">2</span>
            <div>
              <p className="title">세션 2 — 직책자 관점 아이디어 도출</p>
              <p className="body">고민 중인 아이디어를 적고 AI 추천을 받은 뒤, 과제로 선택할 수 있습니다.</p>
            </div>
          </div>
          <div className="section-block">
            <h3>아이디어 발산</h3>
            <p className="section-sub">아이디어 제목, AS-IS(불편한 점), TO-BE(바꾸고 싶은 점), 유형을 입력하세요.</p>
            {ideas.map((i) => (
              <div key={i.id} className="idea-card">
                <input className="idea-title" placeholder="아이디어 제목" value={i.title || ''} onChange={(e) => updateIdea(i.id, 'title', e.target.value)} />
                <label>AS-IS (어떤 점이 불편한가요?)</label>
                <textarea placeholder="현재 불편한 점" value={i.asIs || ''} onChange={(e) => updateIdea(i.id, 'asIs', e.target.value)} rows={2} />
                <label>TO-BE (어떻게 바꾸면 좋겠나요?)</label>
                <textarea placeholder="원하는 변화" value={i.toBe || ''} onChange={(e) => updateIdea(i.id, 'toBe', e.target.value)} rows={2} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label>과제 유형:</label>
                  <select value={i.taskType || 'new'} onChange={(e) => updateIdea(i.id, 'taskType', e.target.value)}>
                    <option value="expand">임원진 과제 범위 확장</option>
                    <option value="new">신규 과제</option>
                  </select>
                  <button type="button" className="btn btn-sm" onClick={() => delIdea(i.id)}>삭제</button>
                </div>
              </div>
            ))}
            <div className="add-row" onClick={addIdea}>+ 아이디어 추가</div>
            <button type="button" className="btn btn-primary" disabled={aiLoading || !ideas.length} onClick={fetchIdeaRecommend} style={{ marginTop: 12 }}>{aiLoading ? '추천 생성 중…' : 'AI 추천 받기'}</button>
          </div>
          {recommended.length > 0 && (
            <div className="section-block">
              <h3>추천 아이디어</h3>
              <p className="section-sub">선택한 항목은 세션 1·3에 반영됩니다.</p>
              {recommended.map((r, idx) => (
                <div key={idx} className="recommended-card">
                  <p className="recommended-title">{r.title || '(제목 없음)'}</p>
                  {r.desc && <p className="recommended-desc">{r.desc}</p>}
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => addRecommendedToExtra(r)}>선택</button>
                </div>
              ))}
            </div>
          )}
          {(session2.extraB || []).length > 0 && (
            <div className="section-block">
              <h3>선택한 과제</h3>
              {(session2.extraB || []).map((t) => (
                <div key={t.id} className="task-card">
                  <div style={{ flex: 1 }}>
                    <p className="title">{t.title}</p>
                    <p className="desc">{t.desc}</p>
                  </div>
                  <button type="button" className="btn btn-sm" onClick={() => delExtra('B', t.id)}>삭제</button>
                </div>
              ))}
            </div>
          )}
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
  const wfStepsSorted = (prework.workflowSteps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
  const wfSummary = wfStepsSorted.map((s) => s.title).join(' → ');
  const wfFullText = wfStepsSorted.map((s, i) => `${i + 1}. ${s.title}\n   ${s.desc || ''}`).join('\n\n');
  const strategyFull = prework.strategyFull || {};

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-left">
          {logoUrl && <img src={logoUrl} alt="" className="app-logo" />}
          <span className="app-title">롯데웰푸드 AI 전환 과제 설계</span>
        </div>
        <div style={{ flex: 1 }} />
        {session3SelectedTaskId && <button type="button" className="btn btn-sm" onClick={() => setSession3SelectedTaskId(null)}>← 목록으로</button>}
        <button type="button" className="btn btn-primary" onClick={() => window.print()}>인쇄 / PDF 저장</button>
        <span className="ph-sep" />
        <button type="button" className="phase-pill" onClick={() => setPhase('session1')}>세션 1</button>
        <span className="ph-sep" />
        <button type="button" className="phase-pill" onClick={() => setPhase('session2')}>세션 2</button>
        <span className="ph-sep" />
        <button type="button" className="phase-pill ph-active">세션 3</button>
      </header>
      <main className="app-main" style={{ padding: 20 }}>
        {!session3SelectedTaskId ? (
          <>
            <div className="info-banner">
              <span className="icon">3</span>
              <div>
                <p className="title">세션 3 — 과제 리스트 및 과업인계서</p>
                <p className="body">1~3순위로 선정한 과제를 선택하면 과제정의서를 작성할 수 있습니다. 임원진 내용·워크플로우를 참고해 실무 인계에 활용하세요.</p>
              </div>
            </div>
            <div className="section-block">
              <h3>전체 과제 리스트 (1~3순위)</h3>
              {finalTasks.length === 0 && <p className="section-sub">세션 1에서 순위를 부여한 과제가 여기에 표시됩니다.</p>}
              {finalTasks.map((t, i) => (
                <div key={t.id} className="task-card task-card-clickable" onClick={() => setSession3SelectedTaskId(t.id)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setSession3SelectedTaskId(t.id)}>
                  <div className="task-dot" />
                  <div style={{ flex: 1 }}>
                    <p className="title">{i + 1}. {t.title || '(제목 없음)'}</p>
                    <p className="desc">{t.desc}</p>
                  </div>
                  <span className="section-sub">클릭 시 과제정의서 작성</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          (() => {
            const t = finalTasks.find((x) => x.id === session3SelectedTaskId);
            if (!t) return <p className="section-sub">과제를 찾을 수 없습니다.</p>;
            const d = session3.definitions?.[t.id] || {};
            return (
              <div className="section-block session3-def-view">
                <h3>과제정의서: {t.title}</h3>
                <div className="def-ref-block">
                  <p className="section-label">참고: 임원진이 도출한 AX 전략</p>
                  {strategyDetailOrder.filter((key) => strategyFull[key]).map((key) => (
                    <div key={key} className="strategy-detail-card">
                      <span className="strategy-detail-label">{key}</span>
                      <span className="strategy-detail-value">{strategyFull[key]}</span>
                    </div>
                  ))}
                </div>
                <div className="def-ref-block">
                  <p className="section-label">참고: 해당 과업의 전체 워크플로우</p>
                  <pre className="wf-full-pre">{wfFullText}</pre>
                </div>
                <p className="section-label">과제정의서 작성 (실무 인계용)</p>
                {defFields.map((f) => (
                  <div key={f.key} style={{ marginBottom: 10 }}>
                    <label>{f.label}</label>
                    {f.type === 'textarea' ? (
                      <textarea value={d[f.key] ?? (f.key === 'workflowSummary' ? wfSummary : '')} onChange={(e) => updateDef(t.id, f.key, e.target.value)} rows={3} />
                    ) : (
                      <input type="text" value={d[f.key] ?? (f.key === 'title' ? t.title : '')} onChange={(e) => updateDef(t.id, f.key, e.target.value)} />
                    )}
                  </div>
                ))}
              </div>
            );
          })()
        )}
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
