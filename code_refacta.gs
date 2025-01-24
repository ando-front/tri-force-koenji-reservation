/**
 * Webアプリケーションとして予約フォームを表示します。
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile("index");
}

/**
 * フォーム送信時の処理を行います。
 * @param {Object} e - イベントオブジェクト
 * @return {ContentService} - 結果のテキスト出力
 */
function doPost(e) {
  // ToDo:form no requrement
  // ToDo:完了画面に戻るボタン、続けて予約ボタン、カレンダーボタン
  // ToDo：カレンダー登録関数呼び出しをリファクタ
  // TODO:開始日時プルダウンは分は選択しないようにする
  // TODO:フォーム画面にスタイルを当てる
  // ToDo:フィットネス4人、フリーマット10人とする
  // ToDo：30分刻みの予約とする
  const formData = e.parameter;
  Logger.log("フォームデータ: " + JSON.stringify(formData));

  try {
    const startTime = parseStartTime(formData.利用開始日時);
    const endTime = calculateEndTime(startTime);

    if (isTimeSlotFull(startTime)) {
      return createTextOutput("この時間帯は満員です。");
    }

    saveFormDataToSpreadsheet(formData, startTime, endTime);
    const calendarResult = createCalendarEvent(formData, startTime, endTime);
    Logger.log("カレンダー登録結果：" + calendarResult.message);

    return createTextOutput("予約が完了しました。");
  } catch (error) {
    Logger.log("予約処理エラー: " + error);
    return createTextOutput("予約処理中にエラーが発生しました：" + error);
  }
}

/**
 * 利用開始日時文字列をDateオブジェクトに変換します。
 * @param {string} startTimeString - 利用開始日時文字列
 * @return {Date} - Dateオブジェクト
 * @throws {Error} - 日付変換エラー
 */
function parseStartTime(startTimeString) {
  try {
    let startTime = new Date(startTimeString);
    const ssTimeZone =
      SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone();
    const formattedStartTime = Utilities.formatDate(
      startTime,
      ssTimeZone,
      "yyyy/MM/dd HH:mm:ss"
    );
    return new Date(formattedStartTime);
  } catch (error) {
    Logger.log(
      "日付変換エラー: " + error + ", startTimeString:" + startTimeString
    );
    throw new Error("日付の形式が正しくありません。");
  }
}

/**
 * 終了時刻を計算します。
 * @param {Date} startTime - 開始時刻
 * @return {Date} - 終了時刻
 */
function calculateEndTime(startTime) {
  return new Date(startTime.getTime() + 60 * 60 * 1000); // 1時間後
}

/**
 * 時間帯が満員かどうかをチェックします。
 * @param {Date} startTime - 開始時刻
 * @return {boolean} - 満員かどうか
 */
function isTimeSlotFull(startTime) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("フォームの回答 2");
  const lastRow = sheet.getLastRow();
  let count = 0;

  for (let i = 2; i <= lastRow; i++) {
    const existingStartTimeValue = sheet.getRange(i, 10).getValue();
    if (typeof existingStartTimeValue === "number") {
      const existingStartTime = convertSpreadsheetDate(
        existingStartTimeValue,
        ss.getSpreadsheetLocale()
      );
      if (isSameHour(existingStartTime, startTime)) {
        count++;
      }
    }
  }
  return count >= 4; // 定員4名
}

/**
 * スプレッドシートの日付シリアル値をDateオブジェクトに変換します。
 * @param {number} dateValue - スプレッドシートの日付シリアル値
 * @param {string} locale - スプレッドシートのロケール
 * @return {Date} - Dateオブジェクト
 */
function convertSpreadsheetDate(dateValue, locale) {
  const days = Math.floor(dateValue);
  const fractionOfDay = dateValue - days;
  const milliseconds = Math.round(fractionOfDay * 86400000);

  let baseDate = new Date(1899, 11, 30);
  if (locale === "en_US") {
    baseDate = new Date(1899, 11, 31);
  }

  return new Date(baseDate.getTime() + days * 86400000 + milliseconds);
}

/**
 * 2つのDateオブジェクトが同じ時間かどうかを比較します。
 * @param {Date} date1 - Dateオブジェクト1
 * @param {Date} date2 - Dateオブジェクト2
 * @return {boolean} - 同じ時間かどうか
 */
function isSameHour(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate() &&
    date1.getHours() === date2.getHours()
  );
}

/**
 * フォームデータをスプレッドシートに保存します。
 * @param {Object} formData - フォームデータ
 * @param {Date} startTime - 開始時刻
 * @param {Date} endTime - 終了時刻
 */
function saveFormDataToSpreadsheet(formData, startTime, endTime) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName("フォームの回答 2");
  sheet.appendRow([
    new Date(),
    formData.メールアドレス,
    formData.予約施設,
    formData.氏名,
    formData.連絡先,
    startTime,
    endTime,
    formData.備考,
    "",
  ]);
}

/**
 * カレンダーイベントを作成します。
 * @param {Object} formData - フォームデータ
 * @param {Date} startTime - 開始時刻
 * @param {Date} endTime - 終了時刻
 * @return {Object} - 結果オブジェクト
 */
function createCalendarEvent(formData, startTime, endTime) {
  try {
    const calendarId =
      PropertiesService.getScriptProperties().getProperty("CALENDAR_ID");
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      Logger.log("カレンダーが見つかりません。IDを確認してください。");
      return {
        message: "カレンダーが見つかりません。IDを確認してください。",
        status: "error",
      };
    }

    const event = calendar.createEvent(
      "予約：" + formData.氏名 + " 様：" + formData.予約施設,
      startTime,
      endTime,
      { description: formData.備考 }
    );
    return {
      message: "予約が完了しました。",
      eventId: event.getId(),
      status: "ok",
    };
  } catch (error) {
    Logger.log("カレンダー登録エラー: " + error);
    return {
      message: "カレンダー登録中にエラーが発生しました：" + error,
      status: "error",
    };
  }
}

/**
 * テキスト出力を作成します。
 * @param {string} text - 出力するテキスト
 * @return {ContentService} - テキスト出力
 */
function createTextOutput(text) {
  return ContentService.createTextOutput(text).setMimeType(
    ContentService.MimeType.TEXT
  );
}

/**
 * メニューから予約フォームを開くための関数。
 */
function setup() {
  const htmlService = HtmlService.createHtmlOutputFromFile("index");
  SpreadsheetApp.getUi().showModalDialog(htmlService, "予約フォーム");
}

/**
 * スプレッドシートを開いた際にメニューを追加します。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("予約")
    .addItem("予約フォームを開く", "setup")
    .addToUi();
}

// 定数定義
const SPREADSHEET_ID = "1U7sO1pf9uEA2YGmPxv5mk9gP6aE_w6l-ZJNUU6wxEUw"; // スプレッドシートID
