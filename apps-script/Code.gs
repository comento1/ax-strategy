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

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Id', 'Department', 'ParticipantName', 'ParticipantPosition', 'SelectedStrategyId', 'StrategyTitle',
      'WorkflowSteps', 'TaskCandidates', 'Questions', 'CreatedAt'
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold');
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
            if (headers.length > 6 && row[6] != null) obj['_G열'] = String(row[6]).trim();
            strategies.push(obj);
          }
          departments = Object.keys(deptSet).sort();
        }
      }
      return jsonResponse({ departments: departments, strategies: strategies });
    } catch (err) {
      return jsonResponse({ departments: [], strategies: [], error: String(err.message) });
    }
  }

  // 사전과제 목록 (department=XXX)
  var result = [];
  var department = params.department ? String(params.department).trim() : '';
  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return jsonResponse(result);

    var headers = data[0];
    var idCol = headers.indexOf('Id');
    var deptCol = headers.indexOf('Department');
    var nameCol = headers.indexOf('ParticipantName');
    var positionCol = headers.indexOf('ParticipantPosition');
    var strategyIdCol = headers.indexOf('SelectedStrategyId');
    var titleCol = headers.indexOf('StrategyTitle');
    var wfCol = headers.indexOf('WorkflowSteps');
    var taskCol = headers.indexOf('TaskCandidates');
    var qCol = headers.indexOf('Questions');
    var createdCol = headers.indexOf('CreatedAt');
    if (deptCol < 0) return jsonResponse({ error: '시트 컬럼이 올바르지 않습니다.' }, 500);

    var filterDept = department || 'default';
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowDept = row[deptCol] ? String(row[deptCol]).trim() : '';
      if (rowDept !== filterDept) continue;

      var wf = textToWorkflowSteps(row[wfCol]);
      var tasks = textToTaskCandidates(row[taskCol]);
      var questions = textToQuestions(row[qCol]);

      result.push({
        id: row[idCol] || '',
        department: rowDept,
        participantName: row[nameCol] != null ? String(row[nameCol]) : '익명',
        participantPosition: positionCol >= 0 && row[positionCol] != null ? String(row[positionCol]) : '',
        selectedStrategyId: row[strategyIdCol] != null ? String(row[strategyIdCol]) : null,
        strategyTitle: row[titleCol] != null ? String(row[titleCol]) : null,
        workflowSteps: wf,
        taskCandidates: tasks,
        questions: questions,
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

    var department = data.department != null ? String(data.department).trim() : 'default';
    var participantName = data.participantName != null ? String(data.participantName) : '익명';
    var participantPosition = data.participantPosition != null ? String(data.participantPosition) : '';
    var selectedStrategyId = data.selectedStrategyId != null ? String(data.selectedStrategyId) : '';
    var strategyTitle = data.strategyTitle != null ? String(data.strategyTitle) : '';
    var workflowSteps = Array.isArray(data.workflowSteps) ? data.workflowSteps : [];
    var taskCandidates = Array.isArray(data.taskCandidates) ? data.taskCandidates : [];
    var questions = Array.isArray(data.questions) ? data.questions : [];

    var id = 'pw-' + new Date().getTime() + '-' + Math.random().toString(36).substr(2, 9);
    var createdAt = new Date().toISOString();

    var sheet = getSheet();
    sheet.appendRow([
      id,
      department,
      participantName,
      participantPosition,
      selectedStrategyId,
      strategyTitle,
      workflowStepsToText(workflowSteps),
      taskCandidatesToText(taskCandidates),
      questionsToText(questions),
      createdAt
    ]);

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

function jsonResponse(obj, statusCode) {
  statusCode = statusCode || 200;
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
