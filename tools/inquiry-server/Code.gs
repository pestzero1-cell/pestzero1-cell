/**
 * 홈로취케어 문의 접수용 구글 앱스스크립트.
 * 홈페이지 문의/고객센터 글이 이 구글 시트에 한 줄씩 쌓입니다. (설정 방법: README.md)
 */
var NOTIFY_EMAIL = "";          // 새 문의를 메일로도 받으려면 본인 메일 주소를 적으세요. 비워 두면 시트에만 쌓입니다.
var SHEET_NAME = "문의";
var MAX = 2000;                 // 글자 수 제한(스팸 방지)

function doPost(e) {
  try {
    var p = JSON.parse(e.postData.contents || "{}");
    var d = p.data || {};
    if (d.website) return out("ok");                    // 숨은 칸이 채워져 있으면 자동 스팸으로 보고 무시
    var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME) || SpreadsheetApp.getActive().insertSheet(SHEET_NAME);
    if (sh.getLastRow() === 0) sh.appendRow(["접수시각", "종류", "서비스", "성함", "연락처", "내용", "페이지"]);
    var cut = function (v) { return String(v == null ? "" : v).slice(0, MAX); };
    var row = [new Date(), cut(p.type), cut(d.svc || d.title), cut(d.name || d.author), cut(d.phone), cut(d.msg || d.content), cut(p.page)];
    sh.appendRow(row);
    if (NOTIFY_EMAIL) MailApp.sendEmail(NOTIFY_EMAIL, "[홈페이지 문의] " + row[1] + " " + row[3], row.slice(1).join("\n"));
    return out("ok");
  } catch (err) {
    return out("error");
  }
}
function doGet() { return out("홈로취케어 문의 접수 서버 작동 중"); }
function out(t) { return ContentService.createTextOutput(t); }
