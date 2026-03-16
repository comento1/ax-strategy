(function () {
  'use strict';

  var STORAGE_KEY = 'ax_workshop';
  var seed = window.AX_SEED || {};
  var areas = seed.executiveAreas || [];
  var iceLabels = seed.iceLabels || {};
  var API_BASE = window.AX_API_BASE || '';
  var currentDepartment = '';
  var currentParticipantName = '';
  var currentParticipantPosition = '';

  var state = {
    currentPhase: 'prework',
    prework: {
      selectedDomainId: null,
      workflowSteps: [],
      taskCandidates: [],
      questions: []
    },
    session1: { evaluations: {}, confirmedIds: [] },
    session2: { track: 'A', extraA: [], extraB: [] },
    session3: { definitions: {} }
  };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed.prework) state.prework = Object.assign({}, state.prework, parsed.prework);
        if (parsed.session1) state.session1 = Object.assign({}, state.session1, parsed.session1);
        if (parsed.session2) state.session2 = Object.assign({}, state.session2, parsed.session2);
        if (parsed.session3) state.session3 = Object.assign({}, state.session3, parsed.session3);
        if (parsed.currentPhase) state.currentPhase = parsed.currentPhase;
      }
    } catch (e) {}
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentPhase: state.currentPhase,
        prework: state.prework,
        session1: state.session1,
        session2: state.session2,
        session3: state.session3
      }));
      var el = document.getElementById('saveStatus');
      if (el) el.textContent = '자동 저장됨 · 최종 저장: ' + new Date().toLocaleTimeString('ko-KR');
    } catch (e) {}
  }

  function id() { return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8); }

  // ----- 사전과제 렌더 -----
  function renderDomainList() {
    var container = document.getElementById('domainList');
    if (!container) return;
    container.innerHTML = areas.map(function (a) {
      var sel = state.prework.selectedDomainId === a.id ? ' sel' : '';
      return '<div class="domain-row' + sel + '" data-domain-id="' + a.id + '">' +
        '<div class="radio-dot"></div><div><p class="domain-title">' + escapeHtml(a.title) + '</p><p class="domain-desc">' + escapeHtml(a.description) + '</p></div></div>';
    }).join('');
    container.querySelectorAll('.domain-row').forEach(function (row) {
      row.addEventListener('click', function () {
        state.prework.selectedDomainId = this.getAttribute('data-domain-id');
        renderDomainList();
        renderPreworkSubtitle();
        saveState();
      });
    });
  }

  function renderPreworkSubtitle() {
    var sub = document.getElementById('preworkAreaSub');
    if (!sub) return;
    var a = areas.find(function (x) { return x.id === state.prework.selectedDomainId; });
    sub.textContent = a ? a.title + ' 영역 — 현재 우리 팀의 실제 업무 흐름을 단계별로 입력하세요' : '영역을 선택하면 여기에 표시됩니다';
  }

  function renderWorkflowList() {
    var container = document.getElementById('workflowList');
    if (!container) return;
    var steps = state.prework.workflowSteps.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    container.innerHTML = steps.map(function (s, i) {
      var tag = s.aiTag === 'review' ? 'neutral-tag tag-review' : 'tag-ai';
      var tagText = s.aiTag === 'review' ? '검토 필요' : 'AI 적용 가능';
      return '<div class="wf-card" data-wf-id="' + s.id + '">' +
        '<div class="step-n">' + (i + 1) + '</div>' +
        '<div style="flex:1"><input type="text" class="wf-input-title" placeholder="단계 제목" value="' + escapeHtml(s.title || '') + '" data-id="' + s.id + '" data-field="title"/><input type="text" class="wf-input-desc" placeholder="설명" value="' + escapeHtml(s.desc || '') + '" data-id="' + s.id + '" data-field="desc"/></div>' +
        '<span class="tag ' + tag + '">' + tagText + '</span>' +
        '<button type="button" class="btn btn-sm" data-action="toggle-wf" data-id="' + s.id + '">태그</button>' +
        '<button type="button" class="btn btn-sm" data-action="del-wf" data-id="' + s.id + '">삭제</button></div>';
    }).join('');
    container.querySelectorAll('[data-action="toggle-wf"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var s = state.prework.workflowSteps.find(function (x) { return x.id === btn.getAttribute('data-id'); });
        if (s) { s.aiTag = s.aiTag === 'review' ? 'ai' : 'review'; renderWorkflowList(); saveState(); }
      });
    });
    container.querySelectorAll('[data-action="del-wf"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.prework.workflowSteps = state.prework.workflowSteps.filter(function (x) { return x.id !== btn.getAttribute('data-id'); });
        renderWorkflowList();
        saveState();
      });
    });
    container.querySelectorAll('.wf-input-title, .wf-input-desc').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var s = state.prework.workflowSteps.find(function (x) { return x.id === inp.getAttribute('data-id'); });
        if (s) { s[inp.getAttribute('data-field')] = inp.value; saveState(); }
      });
    });
  }

  function renderTaskCandidateList() {
    var container = document.getElementById('taskCandidateList');
    if (!container) return;
    var list = state.prework.taskCandidates;
    container.innerHTML = list.map(function (t, i) {
      var prioClass = i === 0 ? 'prio-1' : 'prio-n';
      var prioText = '후보 ' + (i + 1);
      return '<div class="task-card" data-task-id="' + t.id + '">' +
        '<div class="task-dot"></div><div style="flex:1"><input type="text" class="task-input-title" placeholder="과제 제목" value="' + escapeHtml(t.title || '') + '" data-id="' + t.id + '" data-field="title"/><input type="text" class="task-input-desc" placeholder="설명" value="' + escapeHtml(t.desc || '') + '" data-id="' + t.id + '" data-field="desc"/></div>' +
        '<span class="prio-badge ' + prioClass + '">' + prioText + '</span>' +
        '<button type="button" class="btn btn-sm" data-action="del-task" data-id="' + t.id + '">삭제</button></div>';
    }).join('');
    container.querySelectorAll('[data-action="del-task"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.prework.taskCandidates = state.prework.taskCandidates.filter(function (x) { return x.id !== btn.getAttribute('data-id'); });
        renderTaskCandidateList();
        saveState();
        renderSession1ICE();
      });
    });
    container.querySelectorAll('.task-input-title, .task-input-desc').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var t = state.prework.taskCandidates.find(function (x) { return x.id === inp.getAttribute('data-id'); });
        if (t) { t[inp.getAttribute('data-field')] = inp.value; saveState(); }
      });
    });
  }

  function renderQuestionList() {
    var ul = document.getElementById('questionList');
    if (!ul) return;
    ul.innerHTML = (state.prework.questions || []).map(function (q) { return '<li>' + escapeHtml(q) + '</li>'; }).join('');
  }

  function escapeHtml(s) {
    if (s == null) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function autoResizeTextarea(el) {
    if (!el) return;
    el.style.height = 'auto';
    var h = el.scrollHeight;
    if (!h || h < 40) h = 40;
    el.style.height = h + 'px';
  }

  function enhanceAutoResizeTextareas(root) {
    var scope = root || document;
    scope.querySelectorAll('textarea').forEach(function (ta) {
      if (ta._axAutoResizeBound) return;
      ta._axAutoResizeBound = true;
      ta.addEventListener('input', function () { autoResizeTextarea(ta); });
      autoResizeTextarea(ta);
    });
  }

  // ----- 사전과제 이벤트 -----
  function addWfStep() {
    var order = state.prework.workflowSteps.length;
    state.prework.workflowSteps.push({ id: id(), order: order, title: '새 단계', desc: '', aiTag: 'ai' });
    renderWorkflowList();
    saveState();
  }

  function addTaskCandidate() {
    state.prework.taskCandidates.push({ id: id(), title: '새 과제 후보', desc: '' });
    renderTaskCandidateList();
    renderSession1ICE();
    saveState();
  }

  function submitQuestion() {
    var ta = document.getElementById('questionText');
    var text = ta && ta.value && ta.value.trim();
    if (!text) return;
    state.prework.questions = state.prework.questions || [];
    state.prework.questions.push(text);
    ta.value = '';
    renderQuestionList();
    saveState();
  }

  // ----- 세션1 -----
  function getTasksForICE() {
    return state.prework.taskCandidates.concat(
      (state.session2.extraA || []).map(function (t) { return { id: t.id, title: t.title, desc: t.desc, source: 'extraA'; }; }),
      (state.session2.extraB || []).map(function (t) { return { id: t.id, title: t.title, desc: t.desc, source: 'extraB'; }; })
    ).filter(function (t) { return t.id; });
  }

  function computeICE(ev) {
    if (!ev || ev.impact == null || ev.ease == null || ev.confidence == null) return null;
    var n = (Number(ev.impact) + Number(ev.ease) + Number(ev.confidence)) / 3;
    return Math.round(n * 10) / 10;
  }

  function renderSharedWorkflowSummary() {
    var container = document.getElementById('sharedWorkflowSummary');
    if (!container) return;
    var area = areas.find(function (a) { return a.id === state.prework.selectedDomainId; });
    var steps = state.prework.workflowSteps.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); });
    var html = '<div class="def-card"><p class="section-title">선택 영역</p><p>' + (area ? escapeHtml(area.title) + ' — ' + escapeHtml(area.description) : '—') + '</p></div>';
    html += '<div class="def-card"><p class="section-title">워크플로우 단계</p><ol style="margin:0; padding-left:18px;">' +
      steps.map(function (s) { return '<li>' + escapeHtml(s.title) + (s.desc ? ' — ' + escapeHtml(s.desc) : '') + '</li>'; }).join('') + '</ol></div>';
    container.innerHTML = html;
  }

  function isSamplePreworkItem(item) {
    var title = (item && item.strategyTitle) ? String(item.strategyTitle) : '';
    if (!title) return false;
    if (title.indexOf('ZERO 브랜드 라인업 확대') >= 0) return true;
    if (title === '테스트' || title === '테스트 2') return true;
    return false;
  }

  function renderDepartmentPreworkList(list) {
    var container = document.getElementById('departmentPreworkList');
    if (!container) return;
    if (!Array.isArray(list) || list.length === 0) {
      container.innerHTML = '<p class="section-sub">현재 본부에 대한 사전과제 제출 내역이 없습니다.</p>';
      return;
    }
    var safe = list.filter(function (item) { return !isSamplePreworkItem(item); });
    if (safe.length === 0) {
      container.innerHTML = '<p class="section-sub">현재 본부에 대한 유효한 사전과제 제출 내역이 없습니다.</p>';
      return;
    }
    container.innerHTML = safe.map(function (item) {
      var wf = Array.isArray(item.workflowSteps) ? item.workflowSteps : [];
      var tasks = Array.isArray(item.taskCandidates) ? item.taskCandidates : [];
      var questions = Array.isArray(item.questions) ? item.questions : [];
      var wfHtml = wf.map(function (s, idx) {
        var tagText = s.aiTag === 'review' ? '검토 필요' : 'AI 적용 가능';
        var tagClass = s.aiTag === 'review' ? 'tag-review' : 'tag-ai';
        return '<li><span class="badge-step">' + (idx + 1) + '</span> ' +
          escapeHtml(s.title || '') +
          (s.desc ? ' — ' + escapeHtml(s.desc) : '') +
          ' <span class="tag ' + tagClass + '">' + tagText + '</span></li>';
      }).join('');
      var taskHtml = tasks.map(function (t, idx) {
        return '<li><strong>' + (idx + 1) + '. ' + escapeHtml(t.title || '') + '</strong>' +
          (t.desc ? ' — ' + escapeHtml(t.desc) : '') + '</li>';
      }).join('');
      var qHtml = questions.map(function (q, idx) {
        return '<li>' + (idx + 1) + '. ' + escapeHtml(q) + '</li>';
      }).join('');
      return '' +
        '<article class="def-card prework-card">' +
        '<header class="prework-card-header">' +
        '<div><p class="prework-card-title">' + escapeHtml(item.strategyTitle || '사전과제') + '</p>' +
        '<p class="prework-card-meta">' + escapeHtml(item.participantName || '익명') +
        (item.participantPosition ? ' · ' + escapeHtml(item.participantPosition) : '') +
        '</p></div>' +
        '</header>' +
        '<section class="prework-card-body">' +
        '<div class="prework-card-col">' +
        '<h4>워크플로우</h4>' +
        (wfHtml ? '<ol class="prework-card-list">' + wfHtml + '</ol>' : '<p class="section-sub">입력된 워크플로우가 없습니다.</p>') +
        '</div>' +
        '<div class="prework-card-col">' +
        '<h4>AI 과제 제안</h4>' +
        (taskHtml ? '<ul class="prework-card-list">' + taskHtml + '</ul>' : '<p class="section-sub">과제 후보가 없습니다.</p>') +
        (qHtml ? '<div class="prework-card-questions"><h4>질문</h4><ul class="prework-card-list">' + qHtml + '</ul></div>' : '') +
        '</div>' +
        '</section>' +
        '</article>';
    }).join('');
  }

  function loadDepartmentPreworkList() {
    var container = document.getElementById('departmentPreworkList');
    if (!container) return;
    if (!API_BASE || !currentDepartment) {
      container.innerHTML = '<p class="section-sub">본부 또는 API 설정이 없어 사전과제 목록을 불러올 수 없습니다.</p>';
      return;
    }
    container.innerHTML = '<p class="section-sub">사전과제 목록을 불러오는 중입니다...</p>';
    fetch(API_BASE + '?department=' + encodeURIComponent(currentDepartment))
      .then(function (res) { return res.json(); })
      .then(function (json) {
        renderDepartmentPreworkList(json);
      })
      .catch(function () {
        container.innerHTML = '<p class="section-sub">사전과제 목록을 불러오지 못했습니다. 네트워크 상태를 확인해주세요.</p>';
      });
  }

  function renderSession1ICE() {
    var tbody = document.getElementById('iceTableBody');
    if (!tbody) return;
    var tasks = getTasksForICE();
    var ev = state.session1.evaluations || {};
    var conf = state.session1.confirmedIds || [];
    tbody.innerHTML = tasks.map(function (t) {
      var e = ev[t.id] || {};
      var ice = computeICE(e);
      var checked = conf.indexOf(t.id) >= 0 ? ' checked' : '';
      return '<tr data-task-id="' + t.id + '">' +
        '<td><strong>' + escapeHtml(t.title) + '</strong><br/><small>' + escapeHtml(t.desc) + '</small></td>' +
        '<td><input type="number" min="1" max="10" step="1" value="' + (e.impact ?? '') + '" data-field="impact"/></td>' +
        '<td><input type="number" min="1" max="10" step="1" value="' + (e.ease ?? '') + '" data-field="ease"/></td>' +
        '<td><input type="number" min="1" max="10" step="1" value="' + (e.confidence ?? '') + '" data-field="confidence"/></td>' +
        '<td class="ice-score">' + (ice != null ? ice : '—') + '</td>' +
        '<td><input type="checkbox" data-confirm="' + t.id + '"' + checked + '/></td></tr>';
    }).join('');
    tbody.querySelectorAll('input[type="number"]').forEach(function (input) {
      input.addEventListener('input', function () {
        var row = input.closest('tr');
        var taskId = row.getAttribute('data-task-id');
        var ev = state.session1.evaluations[taskId] || {};
        ev[input.getAttribute('data-field')] = input.value === '' ? undefined : Number(input.value);
        state.session1.evaluations[taskId] = ev;
        updateICERow(row);
        saveState();
      });
    });
    tbody.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      cb.addEventListener('change', function () {
        var taskId = cb.getAttribute('data-confirm');
        var idx = (state.session1.confirmedIds || []).indexOf(taskId);
        if (cb.checked) { if (idx < 0) state.session1.confirmedIds.push(taskId); }
        else { if (idx >= 0) state.session1.confirmedIds.splice(idx, 1); }
        saveState();
      });
    });
  }

  function updateICERow(row) {
    var taskId = row.getAttribute('data-task-id');
    var ev = state.session1.evaluations[taskId] || {};
    var ice = computeICE(ev);
    var cell = row.querySelectorAll('td')[4];
    if (cell) cell.textContent = ice != null ? ice : '—';
  }

  function saveICE() {
    var tbody = document.getElementById('iceTableBody');
    if (!tbody) return;
    tbody.querySelectorAll('tr').forEach(function (row) {
      var taskId = row.getAttribute('data-task-id');
      var inputs = row.querySelectorAll('input[type="number"]');
      var ev = {};
      inputs.forEach(function (inp) { var v = inp.value; if (v !== '') ev[inp.getAttribute('data-field')] = Number(v); });
      state.session1.evaluations[taskId] = ev;
    });
    saveState();
    alert('평가가 저장되었습니다. ICE 점수 순으로 우선순위를 참고해 구현 주제를 확정해 주세요.');
  }

  // ----- 세션2 -----
  function renderSession2() {
    var track = state.session2.track || 'A';
    document.querySelectorAll('.track-tab').forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-track') === track); });
    document.getElementById('trackA').style.display = track === 'A' ? 'block' : 'none';
    document.getElementById('trackB').style.display = track === 'B' ? 'block' : 'none';
    var extraA = state.session2.extraA || [];
    var extraB = state.session2.extraB || [];
    document.getElementById('extraTasksA').innerHTML = extraA.map(function (t) {
      return '<div class="task-card" data-id="' + t.id + '"><div class="task-dot"></div><div style="flex:1"><input type="text" class="extra-title" placeholder="과제 제목" value="' + escapeHtml(t.title || '') + '" data-id="' + t.id + '" data-track="A"/><input type="text" class="extra-desc" placeholder="설명" value="' + escapeHtml(t.desc || '') + '" data-id="' + t.id + '" data-track="A"/></div><button type="button" class="btn btn-sm" data-del="' + t.id + '">삭제</button></div>';
    }).join('');
    document.getElementById('extraTasksB').innerHTML = extraB.map(function (t) {
      return '<div class="task-card" data-id="' + t.id + '"><div class="task-dot"></div><div style="flex:1"><input type="text" class="extra-title" placeholder="과제 제목" value="' + escapeHtml(t.title || '') + '" data-id="' + t.id + '" data-track="B"/><input type="text" class="extra-desc" placeholder="설명" value="' + escapeHtml(t.desc || '') + '" data-id="' + t.id + '" data-track="B"/></div><button type="button" class="btn btn-sm" data-del="' + t.id + '">삭제</button></div>';
    }).join('');
    document.querySelectorAll('#extraTasksA [data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.session2.extraA = state.session2.extraA.filter(function (x) { return x.id !== btn.getAttribute('data-del'); });
        renderSession2();
        saveState();
      });
    });
    document.querySelectorAll('#extraTasksB [data-del]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.session2.extraB = state.session2.extraB.filter(function (x) { return x.id !== btn.getAttribute('data-del'); });
        renderSession2();
        saveState();
      });
    });
    document.querySelectorAll('.extra-title, .extra-desc').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var track = inp.getAttribute('data-track');
        var arr = track === 'A' ? state.session2.extraA : state.session2.extraB;
        var t = arr.find(function (x) { return x.id === inp.getAttribute('data-id'); });
        if (t) { t[inp.classList.contains('extra-title') ? 'title' : 'desc'] = inp.value; saveState(); }
      });
    });
  }

  function addExtraTask(track) {
    var arr = track === 'A' ? state.session2.extraA : state.session2.extraB;
    arr.push({ id: id(), title: track === 'A' ? '확장 과제 제목' : '신규 과제 제목', desc: '' });
    state.session2.extraA = state.session2.extraA || [];
    state.session2.extraB = state.session2.extraB || [];
    renderSession2();
    saveState();
    renderSession1ICE();
  }

  // ----- 세션3 -----
  function getFinalTaskList() {
    var confirmedIds = state.session1.confirmedIds || [];
    var fromConfirmed = confirmedIds.map(function (id) {
      var t = state.prework.taskCandidates.find(function (x) { return x.id === id; });
      if (t) return Object.assign({}, t, { source: 'exec' });
      var a = (state.session2.extraA || []).find(function (x) { return x.id === id; });
      if (a) return Object.assign({}, a, { source: 'extraA' });
      var b = (state.session2.extraB || []).find(function (x) { return x.id === id; });
      if (b) return Object.assign({}, b, { source: 'extraB' });
      return null;
    }).filter(Boolean);
    var restA = (state.session2.extraA || []).filter(function (t) { return confirmedIds.indexOf(t.id) < 0; });
    var restB = (state.session2.extraB || []).filter(function (t) { return confirmedIds.indexOf(t.id) < 0; });
    var list = fromConfirmed.concat(restA.map(function (t) { return Object.assign({}, t, { source: 'extraA' }); }), restB.map(function (t) { return Object.assign({}, t, { source: 'extraB' }); }));
    if (list.length === 0 && state.prework.taskCandidates.length > 0)
      return state.prework.taskCandidates.map(function (t) { return Object.assign({}, t, { source: 'exec' }); }).concat(restA.map(function (t) { return Object.assign({}, t, { source: 'extraA' }); }), restB.map(function (t) { return Object.assign({}, t, { source: 'extraB' }); }));
    return list;
  }

  function renderSession3() {
    var list = getFinalTaskList();
    var listEl = document.getElementById('finalTaskList');
    listEl.innerHTML = list.map(function (t, i) {
      var src = t.source === 'exec' ? '임원 기반' : (t.source === 'extraA' ? '세션2 확장' : '세션2 신규');
      return '<div class="task-card"><div class="task-dot"></div><div style="flex:1"><p class="title">' + (i + 1) + '. ' + escapeHtml(t.title) + '</p><p class="desc">' + escapeHtml(t.desc) + ' <small>[' + src + ']</small></p></div></div>';
    }).join('');

    var fields = seed.definitionFields || [
      { key: 'title', label: '과제명', type: 'text' },
      { key: 'background', label: '배경 및 목표', type: 'textarea' },
      { key: 'scope', label: '범위·수준', type: 'textarea' },
      { key: 'workflowSummary', label: '관련 워크플로우 요약', type: 'textarea' },
      { key: 'constraints', label: '제약·요건', type: 'textarea' },
      { key: 'keyMan', label: 'Key Man·담당', type: 'text' },
      { key: 'dataStrategy', label: '데이터 확보 전략', type: 'textarea' },
      { key: 'securityNotes', label: '보안·인프라 메모', type: 'textarea' }
    ];
    var defs = state.session3.definitions || {};
    var formsEl = document.getElementById('definitionForms');
    formsEl.innerHTML = list.map(function (t) {
      var d = defs[t.id] || {};
      d.title = d.title || t.title;
      d.workflowSummary = d.workflowSummary || state.prework.workflowSteps.slice().sort(function (a, b) { return (a.order || 0) - (b.order || 0); }).map(function (s) { return s.title; }).join(' → ');
      var block = '<div class="def-card" data-task-id="' + t.id + '"><p class="section-title">과제: ' + escapeHtml(t.title) + '</p>';
      fields.forEach(function (f) {
        var val = d[f.key] != null ? d[f.key] : '';
        if (f.type === 'textarea') block += '<label>' + f.label + '</label><textarea data-field="' + f.key + '" data-task="' + t.id + '">' + escapeHtml(val) + '</textarea>';
        else block += '<label>' + f.label + '</label><input type="text" data-field="' + f.key + '" data-task="' + t.id + '" value="' + escapeHtml(val) + '"/>';
      });
      block += '</div>';
      return block;
    }).join('');
    formsEl.querySelectorAll('input, textarea').forEach(function (el) {
      el.addEventListener('input', function () {
        var taskId = el.getAttribute('data-task');
        var key = el.getAttribute('data-field');
        state.session3.definitions[taskId] = state.session3.definitions[taskId] || {};
        state.session3.definitions[taskId][key] = el.value;
        saveState();
      });
    });
    enhanceAutoResizeTextareas(formsEl);
  }

  function exportPrint() {
    window.print();
  }

  function saveDefinitionsToServer() {
    if (!API_BASE) {
      alert('서버 API 설정이 없어 저장할 수 없습니다. 관리자에게 문의해 주세요.');
      return;
    }
    var defs = state.session3.definitions || {};
    var tasks = getFinalTaskList();
    if (!tasks.length) {
      alert('저장할 과제가 없습니다.');
      return;
    }
    var payloads = tasks.map(function (t) {
      var def = defs[t.id] || {};
      return {
        action: 'session3_definitions',
        department: currentDepartment || '',
        participantName: currentParticipantName || '',
        participantPosition: currentParticipantPosition || '',
        taskId: t.id,
        taskTitle: t.title || '',
        definition: def
      };
    });
    Promise.all(payloads.map(function (body) {
      return fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (res) {
        try { return res.json(); } catch (e) { return {}; }
      }).catch(function () { return {}; });
    })).then(function () {
      alert('과제정의서가 저장되었습니다.');
    });
  }

  // ----- 단계 전환 -----
  function setPhase(phase) {
    state.currentPhase = phase;
    document.querySelectorAll('.phase-content').forEach(function (c) { c.classList.remove('active'); });
    document.querySelectorAll('.phase-pill').forEach(function (p) {
      p.classList.remove('ph-active');
      p.classList.toggle('ph-done', false);
    });
    var content = document.getElementById('content-' + phase);
    var pill = document.querySelector('.phase-pill[data-phase="' + phase + '"]');
    if (content) content.classList.add('active');
    if (pill) pill.classList.add('ph-active');

    if (phase === 'prework') { renderDomainList(); renderPreworkSubtitle(); renderWorkflowList(); renderTaskCandidateList(); renderQuestionList(); }
    if (phase === 'session1') { renderSharedWorkflowSummary(); loadDepartmentPreworkList(); renderSession1ICE(); }
    if (phase === 'session2') { renderSession2(); }
    if (phase === 'session3') { renderSession3(); }
    saveState();
  }

  function init() {
    loadState();
    if (document.getElementById('appTitle') && seed.workshopName) document.getElementById('appTitle').textContent = seed.workshopName;
    var params = new URLSearchParams(window.location.search);
    var workshop = params.get('workshop');
    var group = params.get('group');
    currentDepartment = params.get('department') || '';
    currentParticipantName = params.get('name') || '';
    currentParticipantPosition = params.get('position') || '';
    var labelEl = document.getElementById('workshopGroupLabel');
    if (labelEl && (workshop || group)) {
      var parts = [];
      if (workshop) parts.push('워크숍: ' + workshop);
      if (group) parts.push('조: ' + group);
      labelEl.textContent = parts.join(' · ');
    }

    renderDomainList();
    renderPreworkSubtitle();
    renderWorkflowList();
    renderTaskCandidateList();
    renderQuestionList();
    enhanceAutoResizeTextareas(document);

    document.querySelectorAll('.phase-pill[data-phase]').forEach(function (p) {
      p.addEventListener('click', function () { setPhase(this.getAttribute('data-phase')); });
    });
    document.getElementById('addWfStep').addEventListener('click', addWfStep);
    document.getElementById('addWfRow').addEventListener('click', addWfStep);
    document.getElementById('addTaskCandidate').addEventListener('click', addTaskCandidate);
    document.getElementById('addTaskRow').addEventListener('click', addTaskCandidate);
    document.getElementById('submitQuestion').addEventListener('click', submitQuestion);
    document.getElementById('saveIce').addEventListener('click', saveICE);
    document.getElementById('btnSave').addEventListener('click', saveState);
    function goNextFromPrework() {
      if (!state.prework.selectedDomainId) { alert('임원 영역을 1개 선택해 주세요.'); return; }
      if (state.prework.workflowSteps.length === 0) { alert('워크플로우 단계를 1개 이상 추가해 주세요.'); return; }
      if (state.prework.taskCandidates.length === 0) { alert('과제 후보를 1개 이상 추가해 주세요.'); return; }
      setPhase('session1');
    }
    document.getElementById('btnSubmitPrework').addEventListener('click', goNextFromPrework);
    var btnBottom = document.getElementById('btnSubmitPreworkBottom');
    if (btnBottom) btnBottom.addEventListener('click', goNextFromPrework);
    document.querySelectorAll('.track-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        var track = this.getAttribute('data-track');
        state.session2.track = track;
        document.querySelectorAll('.track-tab').forEach(function (x) { x.classList.remove('active'); });
        this.classList.add('active');
        document.getElementById('trackA').style.display = track === 'A' ? 'block' : 'none';
        document.getElementById('trackB').style.display = track === 'B' ? 'block' : 'none';
        saveState();
      });
    });
    document.getElementById('addExtraA').addEventListener('click', function () { addExtraTask('A'); });
    document.getElementById('addExtraB').addEventListener('click', function () { addExtraTask('B'); });
    document.getElementById('exportPrint').addEventListener('click', exportPrint);
    var saveDefsBtn = document.getElementById('saveDefinitions');
    if (saveDefsBtn) saveDefsBtn.addEventListener('click', saveDefinitionsToServer);
    var navPreFromS1 = document.getElementById('navToPreworkFromS1');
    if (navPreFromS1) navPreFromS1.addEventListener('click', function () { setPhase('prework'); });
    var navS2FromS1 = document.getElementById('navToSession2FromS1');
    if (navS2FromS1) navS2FromS1.addEventListener('click', function () { setPhase('session2'); });
    var navS1FromS2 = document.getElementById('navToSession1FromS2');
    if (navS1FromS2) navS1FromS2.addEventListener('click', function () { setPhase('session1'); });
    var navS3FromS2 = document.getElementById('navToSession3FromS2');
    if (navS3FromS2) navS3FromS2.addEventListener('click', function () { setPhase('session3'); });

    setPhase(state.currentPhase);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
