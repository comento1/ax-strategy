/**
 * 롯데웰푸드 AX 전략 구체화 — 사전과제 저장/조회용 Web App
 *
 * 시트 구성:
 * - "Prework": 사전과제 제출 (Id, Department, ParticipantName, ParticipantPosition, ...)
 * - "logo": A1 셀에 로고 이미지 URL 입력 시 웹 앱 상단 로고로 사용
 *
 * doGet 파라미터:
 * - action=logo → 로고 시트 A1 값 반환 { logoUrl: "..." }
 * - department=XXX → 해당 본부 사전과제 목록 반환
 */

var SHEET_NAME = 'Prework';
var LOGO_SHEET_NAME = 'logo';

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

  var result = [];
  var department = params.department ? String(params.department).trim() : '';

  try {
    var sheet = getSheet();
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return jsonResponse(result);
    }

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

    if (deptCol < 0) {
      return jsonResponse({ error: '시트 컬럼이 올바르지 않습니다.' }, 500);
    }

    var filterDept = department || 'default';
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowDept = row[deptCol] ? String(row[deptCol]).trim() : '';
      if (rowDept !== filterDept) continue;

      var wf = [];
      try {
        if (row[wfCol]) wf = JSON.parse(String(row[wfCol]));
      } catch (err) {}
      var tasks = [];
      try {
        if (row[taskCol]) tasks = JSON.parse(String(row[taskCol]));
      } catch (err) {}
      var questions = [];
      try {
        if (row[qCol]) questions = JSON.parse(String(row[qCol]));
      } catch (err) {}

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
      JSON.stringify(workflowSteps),
      JSON.stringify(taskCandidates),
      JSON.stringify(questions),
      createdAt
    ]);

    return jsonResponse({ ok: true, id: id });
  } catch (err) {
    return jsonResponse({ error: String(err.message) }, 500);
  }
}

function jsonResponse(obj, statusCode) {
  statusCode = statusCode || 200;
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
