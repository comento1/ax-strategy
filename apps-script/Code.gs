/**
 * 롯데웰푸드 AX 전략 구체화 — 사전과제 저장/조회용 Web App
 *
 * 사용법:
 * 1. 구글 시트를 새로 만들거나 기존 시트 열기
 * 2. 확장프로그램 → Google Apps Script 열기
 * 3. 이 코드 붙여넣기 후 저장
 * 4. 배포 → 새 배포 → 유형: 웹 앱
 *    - 실행 사용자: 나
 *    - 앱에 액세스할 수 있는 사용자: 모든 사용자 (또는 조직 내)
 * 5. 배포 URL 복사 → Next.js .env 에 GOOGLE_APPS_SCRIPT_WEBAPP_URL 로 설정
 *
 * 시트: 시트 이름 "Prework" (없으면 자동 생성)
 * 컬럼: Id | Department | ParticipantName | SelectedStrategyId | StrategyTitle | WorkflowSteps | TaskCandidates | Questions | CreatedAt
 */

var SHEET_NAME = 'Prework';

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'Id', 'Department', 'ParticipantName', 'SelectedStrategyId', 'StrategyTitle',
      'WorkflowSteps', 'TaskCandidates', 'Questions', 'CreatedAt'
    ]);
    sheet.getRange(1, 1, 1, 9).setFontWeight('bold');
  }
  return sheet;
}

function doGet(e) {
  var result = [];
  var department = (e && e.parameter && e.parameter.department) ? String(e.parameter.department).trim() : '';

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
