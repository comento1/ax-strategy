/**
 * 롯데웰푸드 AX 전략 구체화 — Web App
 *
 * 시트: Prework, logo, strategy, Questions
 * doGet: action=logo | action=strategies | department=XXX (사전과제 목록)
 * doPost: prework 제출 | action=question (질문만 등록)
 * 시트 저장: 워크플로우/과제/질문은 JSON이 아닌 읽기 쉬운 텍스트로 저장
 */

var SHEET_NAME = 'Prework';
var LOGO_SHEET_NAME = 'logo';
var STRATEGY_SHEET_NAME = 'strategy';
var QUESTIONS_SHEET_NAME = 'Questions';
var SESSION2_SHEET_NAME = 'Session2Selections';
var SESSION3_SHEET_NAME = 'Session3Definitions';

// 샘플/테스트 데이터 제목 판별 (웹 서비스에서 노출하지 않기 위함)
function isSampleTitle(title) {
  if (!title) return false;
  var t = String(title).trim();
  if (!t) return false;
  // ZERO 브랜드 샘플
  if (t.indexOf('ZERO') >= 0 || t.indexOf('ZERO 브랜드') >= 0) return true;
  // 단순 테스트용 제목
  if (t === '테스트' || t.indexOf('테스트') === 0) return true;
  if (t === 'ㅁㄴㅇ' || t.indexOf('ㅁㄴㅇ') >= 0) return true;
  // 의미 없는 문자열 (OLO 등)
  if (/^[OLo\s]+$/i.test(t)) return true;
  if (t.length <= 5 && t.indexOf('OLO') >= 0) return true;
  return false;
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // 제목행(첫 번째 행): 제출유형 포함
    sheet.appendRow([
      '제출유형', 'Department', 'Id', 'ParticipantName', 'ParticipantPosition', 'SelectedStrategyId', 'StrategyTitle',
      'WorkflowSteps', 'TaskCandidates', 'Questions', 'CreatedAt'
    ]);
    sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
  }
  return sheet;
}

// ----- 워크플로우/과제/질문: 텍스트 ↔ 객체 변환
function workflowStepsToText(steps) {
  if (!steps || !steps.length) return '';
  return steps.map(function(s, i) {
    var tag = (s.aiTag === 'review') ? '검토 필요' : 'AI 적용 가능';
    return (i + 1) + '. ' + (s.title || '') + ' — ' + (s.desc || '') + ' (' + tag + ')';
  }).join('\n');
}

function textToWorkflowSteps(text) {
  if (!text || !String(text).trim()) return [];
  var lines = String(text).split('\n');
  var steps = [];
  lines.forEach(function(line, i) {
    line = line.replace(/^\d+\.\s*/, '').trim();
    if (!line) return;
    var dash = line.indexOf(' — ');
    var title = dash >= 0 ? line.substring(0, dash).trim() : line;
    var rest = dash >= 0 ? line.substring(dash + 3).trim() : '';
    var paren = rest.lastIndexOf('(');
    var desc = paren >= 0 ? rest.substring(0, paren).trim() : rest;
    var aiTag = (rest.indexOf('AI 적용 가능') >= 0 || rest.indexOf('ai') >= 0) ? 'ai' : 'review';
    steps.push({ id: 'wf-' + i, order: i, title: title, desc: desc, aiTag: aiTag });
  });
  return steps;
}

function taskCandidatesToText(tasks) {
  if (!tasks || !tasks.length) return '';
  return tasks.map(function(t) {
    var level = (t.level === 'high') ? '[상위] ' : '[하위] ';
    return level + (t.title || '') + ': ' + (t.desc || '');
  }).join('\n');
}

function textToTaskCandidates(text) {
  if (!text || !String(text).trim()) return [];
  var lines = String(text).split('\n');
  var tasks = [];
  lines.forEach(function(line, i) {
    line = line.trim();
    if (!line) return;
    var level = line.indexOf('[상위]') === 0 ? 'high' : 'low';
    line = line.replace(/^\[상위\]\s*/, '').replace(/^\[하위\]\s*/, '');
    var colon = line.indexOf(': ');
    var title = colon >= 0 ? line.substring(0, colon).trim() : line;
    var desc = colon >= 0 ? line.substring(colon + 2).trim() : '';
    if (!title) return;
    tasks.push({ id: 't-' + i, title: title, desc: desc, level: level });
  });
  return tasks;
}

function questionsToText(arr) {
  if (!arr || !arr.length) return '';
  return arr.join('\n');
}

function textToQuestions(text) {
  if (!text || !String(text).trim()) return [];
  return String(text).split('\n').map(function(s) { return s.trim(); }).filter(function(s) { return s; });
}

// ----- doGet
function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};

  if (params.action === 'logo') {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var logoSheet = ss.getSheetByName(LOGO_SHEET_NAME);
      var logoUrl = '';
      if (logoSheet) {
        var a1 = logoSheet.getRange('A1').getValue();
        if (a1 != null) logoUrl = String(a1).trim();
      }
      return jsonResponse({ logoUrl: logoUrl });
    } catch (err) {
      return jsonResponse({ logoUrl: '' });
    }
  }

  if (params.action === 'strategies') {
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var stratSheet = ss.getSheetByName(STRATEGY_SHEET_NAME);
      var departments = [];
      var strategies = [];
      if (stratSheet) {
        var data = stratSheet.getDataRange().getValues();
        if (data.length >= 2) {
          var headers = data[0];
          var deptSet = {};
          for (var i = 1; i < data.length; i++) {
            var row = data[i];
            var obj = { id: 'strat-' + i };
            for (var h = 0; h < headers.length; h++) {
              var key = String(headers[h]).trim();
              if (!key) continue;
              var val = row[h] != null ? String(row[h]).trim() : '';
              obj[key] = val;
              if (key === '작성본부' && val) deptSet[val] = true;
            }
            // 카드 타이틀은 항상 B열(인덱스 1) 값 사용
            var bCol = row[1] != null ? String(row[1]).trim() : '';
            obj['제목'] = bCol || obj['제목'] || '';
            if (headers.length > 6 && row[6] != null) obj['_G열'] = String(row[6]).trim();
            // 전략 시트에도 샘플 행이 있을 수 있으므로, 제목 기준으로 필터링
            var titleVal = obj['제목'] || obj['AI 적용 기대영역'] || '';
            if (!isSampleTitle(titleVal)) {
              strategies.push(obj);
            }
          }
          departments = Object.keys(deptSet).sort();
        }
      }
      return jsonResponse({ departments: departments, strategies: strategies });
    } catch (err) {
      return jsonResponse({ departments: [], strategies: [], error: String(err.message) });
    }
  }

  // 세션2 아이디어 목록 조회 (작성본부 기준 대시보드)
  if (params.action === 'session2') {
    try {
      var ss2 = SpreadsheetApp.getActiveSpreadsheet();
      var s2Sheet = ss2.getSheetByName(SESSION2_SHEET_NAME);
      if (!s2Sheet) return jsonResponse({ ideas: [] });

      var data2 = s2Sheet.getDataRange().getValues();
      if (data2.length < 2) return jsonResponse({ ideas: [] });

      var headers2 = data2[0];
      var deptIdx = headers2.indexOf('작성본부');
      var titleIdx = headers2.indexOf('과제제목');
      var asIsIdx = headers2.indexOf('AS-IS');
      var toBeIdx = headers2.indexOf('TO-BE');
      var descIdx = headers2.indexOf('비고');
      var typeIdx = headers2.indexOf('유형(임원 확장/신규)');
      var createdIdx = headers2.indexOf('제출일시');
      var nameIdx = headers2.indexOf('참가자이름');
      var posIdx = headers2.indexOf('직급');
      var iceCol = headers2.indexOf('ICE선정');
      if (iceCol < 0 && headers2.length >= SESSION2_ICE_COL) iceCol = SESSION2_ICE_COL - 1;

      var filterDept2 = params.department ? String(params.department).trim() : '';
      var ideas = [];

      for (var r = 1; r < data2.length; r++) {
        var row2 = data2[r];
        var dept2 = deptIdx >= 0 && row2[deptIdx] != null ? String(row2[deptIdx]).trim() : '';
        if (filterDept2 && dept2 !== filterDept2) continue;

        var title2 = titleIdx >= 0 && row2[titleIdx] != null ? String(row2[titleIdx]).trim() : '';
        if (!title2) continue;
        if (isSampleTitle(title2)) continue;

        var iceVal = iceCol >= 0 && row2[iceCol] != null ? String(row2[iceCol]).trim().toUpperCase() : '';
        var iceSelected = iceVal === 'Y' || iceVal === '1' || iceVal === 'TRUE';

        ideas.push({
          rowIndex: r + 1,
          department: dept2,
          title: title2,
          asIs: asIsIdx >= 0 && row2[asIsIdx] != null ? String(row2[asIsIdx]).trim() : '',
          toBe: toBeIdx >= 0 && row2[toBeIdx] != null ? String(row2[toBeIdx]).trim() : '',
          desc: descIdx >= 0 && row2[descIdx] != null ? String(row2[descIdx]).trim() : '',
          type: typeIdx >= 0 && row2[typeIdx] != null ? String(row2[typeIdx]).trim() : '',
          createdAt: createdIdx >= 0 && row2[createdIdx] != null ? String(row2[createdIdx]).trim() : '',
          participantName: nameIdx >= 0 && row2[nameIdx] != null ? String(row2[nameIdx]).trim() : '',
          participantPosition: posIdx >= 0 && row2[posIdx] != null ? String(row2[posIdx]).trim() : '',
          iceSelected: iceSelected
        });
      }

      return jsonResponse({ ideas: ideas });
    } catch (err) {
      return jsonResponse({ ideas: [], error: String(err.message) });
    }
  }

  // 세션3 과제정의서 목록 조회 (작성본부 기준, 전체 공유용)
  if (params.action === 'session3_definitions') {
    try {
      var ss3 = SpreadsheetApp.getActiveSpreadsheet();
      var s3Sheet = ss3.getSheetByName(SESSION3_SHEET_NAME);
      if (!s3Sheet) return jsonResponse({ definitions: [] });

      var data3 = s3Sheet.getDataRange().getValues();
      if (data3.length < 2) return jsonResponse({ definitions: [] });

      var headers3 = data3[0];
      var deptIdx3 = headers3.indexOf('작성본부');
      var nameIdx3 = headers3.indexOf('참가자이름');
      var createdIdx3 = headers3.indexOf('제출일시');
      var taskIdIdx3 = headers3.indexOf('과제ID');
      var taskTitleIdx3 = headers3.indexOf('과제명');
      var reasonIdx3 = headers3.indexOf('개선이유');
      var expectedIdx3 = headers3.indexOf('기대변화');
      var successIdx3 = headers3.indexOf('성공기준');
      var notesIdx3 = headers3.indexOf('구현시고려사항');

      var filterDept3 = params.department ? String(params.department).trim() : '';
      var defs = [];

      for (var r3 = 1; r3 < data3.length; r3++) {
        var row3 = data3[r3];
        var dept3 = deptIdx3 >= 0 && row3[deptIdx3] != null ? String(row3[deptIdx3]).trim() : '';
        if (filterDept3 && dept3 !== filterDept3) continue;

        var title3 = taskTitleIdx3 >= 0 && row3[taskTitleIdx3] != null ? String(row3[taskTitleIdx3]).trim() : '';
        if (!title3) continue;
        if (isSampleTitle(title3)) continue;

        defs.push({
          department: dept3,
          participantName: nameIdx3 >= 0 && row3[nameIdx3] != null ? String(row3[nameIdx3]).trim() : '',
          createdAt: createdIdx3 >= 0 && row3[createdIdx3] != null ? String(row3[createdIdx3]).trim() : '',
          taskId: taskIdIdx3 >= 0 && row3[taskIdIdx3] != null ? String(row3[taskIdIdx3]).trim() : '',
          taskTitle: title3,
          reason: reasonIdx3 >= 0 && row3[reasonIdx3] != null ? String(row3[reasonIdx3]).trim() : '',
          expectedChange: expectedIdx3 >= 0 && row3[expectedIdx3] != null ? String(row3[expectedIdx3]).trim() : '',
          successCriteria: successIdx3 >= 0 && row3[successIdx3] != null ? String(row3[successIdx3]).trim() : '',
          implementationNotes: notesIdx3 >= 0 && row3[notesIdx3] != null ? String(row3[notesIdx3]).trim() : ''
        });
      }

      return jsonResponse({ definitions: defs });
    } catch (err) {
      return jsonResponse({ definitions: [], error: String(err.message) });
    }
  }

  // 사전과제 목록 (department=XXX) — 제출유형이 '사전과제'인 행만
  var result = [];
  var department = params.department ? String(params.department).trim() : '';
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonResponse(result);

    var headers = data[0];
    var typeCol = headers.indexOf('제출유형') >= 0 ? headers.indexOf('제출유형') : -1;
    var deptCol = headers.indexOf('Department') >= 0 ? headers.indexOf('Department') : headers.indexOf('제출본부');
    var idCol = headers.indexOf('Id') >= 0 ? headers.indexOf('Id') : 0;
    var nameCol = headers.indexOf('ParticipantName') >= 0 ? headers.indexOf('ParticipantName') : headers.indexOf('참가자이름');
    var positionCol = headers.indexOf('ParticipantPosition') >= 0 ? headers.indexOf('ParticipantPosition') : headers.indexOf('직급');
    var strategyIdCol = headers.indexOf('SelectedStrategyId') >= 0 ? headers.indexOf('SelectedStrategyId') : headers.indexOf('선택전략ID');
    var titleCol = headers.indexOf('StrategyTitle') >= 0 ? headers.indexOf('StrategyTitle') : (headers.indexOf('선택한 영역') >= 0 ? headers.indexOf('선택한 영역') : 6);
    var wfCol = headers.indexOf('WorkflowSteps') >= 0 ? headers.indexOf('WorkflowSteps') : headers.indexOf('워크플로우');
    var taskCol = headers.indexOf('TaskCandidates') >= 0 ? headers.indexOf('TaskCandidates') : (headers.indexOf('과제후보') >= 0 ? headers.indexOf('과제후보') : (headers.indexOf('과제목록') >= 0 ? headers.indexOf('과제목록') : 7)); // H열 fallback
    var createdCol = headers.indexOf('CreatedAt') >= 0 ? headers.indexOf('CreatedAt') : headers.indexOf('제출일시');
    if (deptCol < 0) deptCol = 0; // A열(제출본부) 기준 fallback
    if (nameCol < 0) nameCol = 2; // C열(제출자) 기준 fallback
    if (deptCol < 0) return jsonResponse({ error: '시트에 Department 또는 제출본부 컬럼이 없습니다.' }, 500);

    var filterDept = (department || '').toLowerCase();
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowType = typeCol >= 0 && row[typeCol] != null ? String(row[typeCol]).trim() : '사전과제';
      if (typeCol >= 0 && rowType !== '사전과제') continue;
      
      var rowDept = row[deptCol] ? String(row[deptCol]).trim() : '';
      // filterDept가 있으면 필터링, 없으면 전체 조회 (단, 샘플 제외)
      if (filterDept && rowDept.toLowerCase() !== filterDept) continue;

      // 워크숍 설계 시 사용한 테스트/샘플 데이터는 세션 화면에 노출하지 않도록 필터링
      var titleVal = titleCol >= 0 && row[titleCol] != null ? String(row[titleCol]).trim() : '';
      if (isSampleTitle(titleVal)) continue;

      // 제출자 이름은 Prework 시트 C열 기준을 우선 적용
      var pName = row[2] != null ? String(row[2]).trim() : (row[nameCol] != null ? String(row[nameCol]).trim() : '');
      if (!pName) pName = '익명';

      // 과제 후보는 Prework 시트 H열 기준을 우선 적용
      var wfRaw = wfCol >= 0 ? row[wfCol] : '';
      var taskRaw = row[7] != null ? row[7] : (taskCol >= 0 ? row[taskCol] : '');
      result.push({
        id: row[idCol] || '',
        department: rowDept,
        participantName: pName,
        participantPosition: positionCol >= 0 && row[positionCol] != null ? String(row[positionCol]) : '',
        selectedStrategyId: row[strategyIdCol] != null ? String(row[strategyIdCol]) : null,
        strategyTitle: row[titleCol] != null ? String(row[titleCol]) : null,
        workflowSteps: textToWorkflowSteps(wfRaw),
        taskCandidates: textToTaskCandidates(taskRaw),
        // 질문은 별도 Questions 시트에서만 관리하고, Prework 목록에서는 노출하지 않음
        questions: [],
        createdAt: row[createdCol] != null ? String(row[createdCol]) : ''
      });
    }
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: String(err.message) }, 500);
  }
}

function doPost(e) {
  try {
    var body = e.postData && e.postData.contents ? e.postData.contents : '{}';
    var data = JSON.parse(body);

    if (data.action === 'question') {
      var qSheet = getQuestionsSheet();
      qSheet.appendRow([
        new Date().toISOString(),
        data.department || '',
        data.participantName || '익명',
        data.participantPosition || '',
        data.question || ''
      ]);
      return jsonResponse({ ok: true });
    }

    if (data.action === 'session2') {
      var s2Sheet = getSession2Sheet();
      var items = Array.isArray(data.items) ? data.items : [];
      var dept = data.department != null ? String(data.department).trim() : '';
      var pName = data.participantName != null ? String(data.participantName) : '익명';
      var pPos = data.participantPosition != null ? String(data.participantPosition) : '';
      var createdAt = new Date().toISOString();
      items.forEach(function(item) {
        var typeLabel = '';
        if (item.type === 'extend') typeLabel = '임원 전략 확장';
        else if (item.type === 'new') typeLabel = '신규 과제';
        s2Sheet.appendRow([
          createdAt,
          dept,
          pName,
          pPos,
          item.title || '',
          item.asIs || '',
          item.toBe || '',
          item.desc || '',
          typeLabel,
          ''
        ]);
      });
      return jsonResponse({ ok: true });
    }

    if (data.action === 'session2_select') {
      var rowIdx = data.rowIndex != null ? Number(data.rowIndex) : 0;
      var selected = data.selected === true || data.selected === 'true';
      if (rowIdx < 1) return jsonResponse({ error: 'rowIndex required' }, 400);
      var s2 = getSession2Sheet();
      var lastRow = s2.getLastRow();
      if (rowIdx > lastRow) return jsonResponse({ error: 'rowIndex out of range' }, 400);
      s2.getRange(rowIdx, SESSION2_ICE_COL).setValue(selected ? 'Y' : '');
      return jsonResponse({ ok: true });
    }

    if (data.action === 'session3_definitions') {
      var s3Sheet = getSession3Sheet();
      var taskId = data.taskId != null ? String(data.taskId) : '';
      var taskTitle = data.taskTitle != null ? String(data.taskTitle) : '';
      var dept3 = data.department != null ? String(data.department).trim() : '';
      var pName3 = data.participantName != null ? String(data.participantName) : '익명';
      var def = data.definition && typeof data.definition === 'object' ? data.definition : {};
      var data3 = s3Sheet.getDataRange().getValues();
      var headers3 = data3.length >= 1 ? data3[0] : [];
      var colDept = headers3.indexOf('작성본부') >= 0 ? headers3.indexOf('작성본부') : 1;
      var colName = headers3.indexOf('참가자이름') >= 0 ? headers3.indexOf('참가자이름') : 2;
      var colTaskId = headers3.indexOf('과제ID') >= 0 ? headers3.indexOf('과제ID') : 3;
      var rowIndex = -1;
      for (var r = 1; r < data3.length; r++) {
        var dr = data3[r];
        var rowDept = (dr[colDept] != null ? String(dr[colDept]).trim() : '');
        var rowName = (dr[colName] != null ? String(dr[colName]).trim() : '');
        var rowTaskId = (dr[colTaskId] != null ? String(dr[colTaskId]).trim() : '');
        if (rowTaskId === taskId && rowDept === dept3 && rowName === pName3) {
          rowIndex = r + 1;
          break;
        }
      }
      var iso = new Date().toISOString();
      var rowData = [iso, dept3, pName3, taskId, taskTitle, def.reason || '', def.expectedChange || '', def.successCriteria || '', def.implementationNotes || '', def.keyMan || ''];
      if (rowIndex > 0) {
        // 기존 행 업데이트 (하나의 행만)
        s3Sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        s3Sheet.appendRow(rowData);
      }
      return jsonResponse({ ok: true });
    }

    var department = data.department != null ? String(data.department).trim() : 'default';
    var participantName = data.participantName != null ? String(data.participantName) : '익명';
    var participantPosition = data.participantPosition != null ? String(data.participantPosition) : '';
    var selectedStrategyId = data.selectedStrategyId != null ? String(data.selectedStrategyId) : '';
    var strategyTitle = data.strategyTitle != null ? String(data.strategyTitle) : '';
    var workflowSteps = Array.isArray(data.workflowSteps) ? data.workflowSteps : [];
    var taskCandidates = Array.isArray(data.taskCandidates) ? data.taskCandidates : [];

    var id = 'pw-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 9);
    var createdAt = new Date().toISOString();

    var sheet = getSheet();
    var headers = sheet.getLastRow() >= 1 ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0] : [];
    var hasTypeCol = headers.indexOf('제출유형') >= 0;
    if (hasTypeCol) {
      sheet.appendRow([
        '사전과제', department, id, participantName, participantPosition,
        selectedStrategyId, strategyTitle, workflowStepsToText(workflowSteps),
        taskCandidatesToText(taskCandidates),
        // 질문은 별도 Questions 시트에만 저장하고, Prework 시트에는 더 이상 기록하지 않음
        '', createdAt
      ]);
    } else {
      sheet.appendRow([
        department, id, participantName, participantPosition,
        selectedStrategyId, strategyTitle, workflowStepsToText(workflowSteps),
        taskCandidatesToText(taskCandidates), '', createdAt
      ]);
    }

    return jsonResponse({ ok: true, id: id });
  } catch (err) {
    return jsonResponse({ error: String(err.message) }, 500);
  }
}

function getQuestionsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(QUESTIONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(QUESTIONS_SHEET_NAME);
    sheet.appendRow(['제출일시', '작성본부', '참가자이름', '직급', '질문내용']);
    sheet.getRange(1, 1, 1, 5).setFontWeight('bold');
  }
  return sheet;
}

var SESSION2_ICE_COL = 10; // ICE선정 컬럼(1-based)

function getSession2Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SESSION2_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SESSION2_SHEET_NAME);
    sheet.appendRow(['제출일시', '작성본부', '참가자이름', '직급', '과제제목', 'AS-IS', 'TO-BE', '비고', '유형(임원 확장/신규)', 'ICE선정']);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }
  return sheet;
}

function getSession3Sheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SESSION3_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SESSION3_SHEET_NAME);
    sheet.appendRow([
      '제출일시', '작성본부', '참가자이름', '과제ID', '과제명',
      '개선이유', '기대변화', '성공기준', '구현시고려사항', 'Key Man'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
  }
  return sheet;
}

function jsonResponse(obj, statusCode) {
  statusCode = statusCode || 200;
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
