/*
Copyright 2023 Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
// 定数定義
const SPREADSHEET_ID =
  PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const CALENDAR_ID =
  PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
const RECEPTION_URL =
  PropertiesService.getScriptProperties().getProperty('RECEPTION_URL');

/**
 * Webアプリケーションとして予約フォームを表示します。
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * フォーム送信時の処理を行います。
 * @param {Object} e - イベントオブジェクト
 * @return {ContentService} - 結果のテキスト出力
 */
function doPost(e) {
  const formData = e.parameter;
  Logger.log('フォームデータ: ' + JSON.stringify(formData));

  try {
    // GitHub Pages からのリクエストかどうかを判定
    const isApiRequest = e.parameter.apiRequest === 'true' || 
                        e.postData && e.postData.type === 'application/x-www-form-urlencoded';
    
    if (isApiRequest) {
      // API リクエストの場合はJSON レスポンスを返す
      const result = processFormDataForApi(formData);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
    } else {
      // 従来のGAS Web App からのリクエストの場合
      return processFormData(formData);
    }
  } catch (error) {
    Logger.log('予約処理エラー: ' + error);
    
    // API リクエストの場合はJSON エラーレスポンス
    if (e.parameter.apiRequest === 'true') {
      return ContentService
        .createTextOutput(JSON.stringify({
          success: false,
          message: 'サーバーエラーが発生しました: ' + error
        }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeaders({
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        });
    } else {
      return showMessage(
        '予約処理中にエラーが発生しました：' + error,
        'deep-orange'
      );
    }
  }
}

/**
 * OPTIONS リクエストへの対応（CORS プリフライト）
 */
function doOptions(e) {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT)
    .setHeaders({
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
}

/**
 * API リクエスト用のフォームデータ処理
 * @param {Object} formData - フォームデータ
 * @return {Object} - JSON レスポンス用オブジェクト
 */
function processFormDataForApi(formData) {
  const startDate = formData.利用開始日;
  const startTime = formData.利用開始時間;
  const facility = formData.予約施設;

  if (!startDate || !startTime) {
    Logger.log('エラー：利用開始日または利用開始時間が未入力です。');
    return {
      success: false,
      message: '利用開始日と利用開始時間は必須です。'
    };
  }

  const startTimeString = startDate + ' ' + startTime.split(' ')[1];
  Logger.log('API doPost startTimeString:' + startTimeString);
  const parsedStartTimeForCheck = parseStartTime(startTimeString);
  const parsedStartTime = parseStartTime(startTimeString);
  const endTime = calculateEndTime(parsedStartTime);

  if (isTimeSlotFull(parsedStartTimeForCheck, facility)) {
    return {
      success: false,
      message: 'この時間帯は満員です。'
    };
  }

  try {
    saveFormDataToSpreadsheet(formData, parsedStartTime, endTime);
    const calendarResult = createCalendarEvent(formData, parsedStartTime, endTime);
    Logger.log('カレンダー登録結果：' + calendarResult.message);

    return {
      success: true,
      message: '予約が完了しました。',
      reservationId: generateReservationId(),
      calendarEventId: calendarResult.eventId || null
    };
  } catch (error) {
    Logger.log('予約保存エラー: ' + error);
    return {
      success: false,
      message: '予約の保存中にエラーが発生しました。'
    };
  }
}

/**
 * フォームデータを処理します。
 * @param {Object} formData - フォームデータ
 * @return {ContentService} - 結果のテキスト出力
 */
function processFormData(formData) {
  const startDate = formData.利用開始日;
  const startTime = formData.利用開始時間;
  const facility = formData.予約施設;

  if (!startDate || !startTime) {
    Logger.log('エラー：利用開始日または利用開始時間が未入力です。');
    return createTextOutput('利用開始日と利用開始時間は必須です。'); // エラーメッセージを返す
  }

  const startTimeString = startDate + ' ' + startTime.split(' ')[1]; //時刻部分のみ抽出
  Logger.log('doPost startTimeString:' + startTimeString); //doPost内でのstartTimeStringを確認
  const parsedStartTimeForCheck = parseStartTime(startTimeString); // isTimeSlotFullチェック用
  const parsedStartTime = parseStartTime(startTimeString);
  const endTime = calculateEndTime(parsedStartTime);

  if (isTimeSlotFull(parsedStartTimeForCheck, facility)) {
    return showMessage('この時間帯は満員です。', 'red'); // 満員メッセージを表示
  }

  saveFormDataToSpreadsheet(formData, parsedStartTime, endTime);
  const calendarResult = createCalendarEvent(
    formData,
    parsedStartTime,
    endTime
  );
  Logger.log('カレンダー登録結果：' + calendarResult.message);

  return showMessage('予約が完了しました。', 'teal'); // 予約完了メッセージを表示
}

/**
 * HTMLメッセージを表示する
 * @param {string} message - メッセージ
 * @param {string} color - カードの色 (red, teal, deep-orange)
 */
function showMessage(message, color) {
  return HtmlService.createHtmlOutput(
    `
    <div class="container">
      <div class="card-panel ${color} lighten-4">
        <span class="${color}-text text-darken-4">${message}</span><br><br>
        <button class="btn" onclick="window.location.href='${RECEPTION_URL}'">予約フォームに戻る</button>
        <a href="https://calendar.google.com/calendar/embed?src=${CALENDAR_ID}&ctz=Asia%2FTokyo" target="_blank"><button class="btn">カレンダーを見る</button></a>
      </div>
    </div>
  `
  ).setSandboxMode(HtmlService.SandboxMode.IFRAME);
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
      'yyyy/MM/dd HH:mm:ss'
    );
    return new Date(formattedStartTime);
  } catch (error) {
    Logger.log(
      '日付変換エラー: ' + error + ', startTimeString:' + startTimeString
    );
    throw new Error('日付の形式が正しくありません。');
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
function isTimeSlotFull(startTime, facility) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('フォームの回答 2');
  const lastRow = sheet.getLastRow();
  let count = 0;
  let maxCapacity = 0;

  if (facility === 'フリーマット') {
    maxCapacity = 10;
  } else if (facility === 'フィットネス') {
    maxCapacity = 4;
  } else {
    Logger.log('不正な施設名です: ' + facility);
    return false;
  }

  for (let i = 2; i <= lastRow; i++) {
    const existingStartTimeValue = sheet.getRange(i, 10).getValue();
    const existingFacility = sheet.getRange(i, 3).getValue();
    const existingStartTime = convertSpreadsheetDate(
      existingStartTimeValue,
      ss.getSpreadsheetLocale()
    );

    if (existingStartTime instanceof Date && existingFacility === facility) {
      if (isSameHour(existingStartTime, startTime)) {
        count++;
      }
    }
  }
  return count >= maxCapacity;
}

/**
 * スプレッドシートの日付シリアル値をDateオブジェクトに変換します。
 * @param {any} cellValue - スプレッドシートのセルの値（数値またはDateオブジェクト）
 * @param {string} locale - スプレッドシートのロケール
 * @return {Date|null} - Dateオブジェクトまたはnull
 */
function convertSpreadsheetDate(cellValue, locale) {
  if (cellValue instanceof Date) {
    return cellValue;
  } else if (typeof cellValue === 'number') {
    const days = Math.floor(cellValue);
    const fractionOfDay = cellValue - days;
    const milliseconds = Math.round(fractionOfDay * 86400000);

    let baseDate = new Date(1899, 11, 30);
    if (locale === 'en_US') {
      baseDate = new Date(1899, 11, 31);
    }

    return new Date(baseDate.getTime() + days * 86400000 + milliseconds);
  } else if (typeof cellValue === 'string') {
    try {
      // 様々なフォーマットを試す
      let date = new Date(cellValue);
      if (isNaN(date)) {
        date = new Date(cellValue.replace(/-/g, '/')); // ハイフンをスラッシュに置換
      }
      if (isNaN(date)) {
        Logger.log(
          '文字列からDateへの変換に失敗: ' +
            cellValue +
            ' (様々なフォーマットを試しましたが変換できませんでした。)'
        );
        return null;
      }
      return date;
    } catch (e) {
      Logger.log(
        '文字列からDateへの変換中にエラーが発生: ' +
          cellValue +
          ', エラー内容: ' +
          e
      );
      return null;
    }
  } else {
    Logger.log(
      'セルの値が日付、数値、または文字列ではありません: ' + cellValue
    );
    return null;
  }
}

/**
 * 2つのDateオブジェクトが同じ時間かどうかを比較します。
 * @param {Date} date1 - Dateオブジェクト1
 * @param {Date} date2 - Dateオブジェクト2
 * @return {boolean} - 同じ時間かどうか
 */
function isSameHour(date1, date2) {
  // 引数がDateオブジェクトであることを確認
  if (!(date1 instanceof Date) || !(date2 instanceof Date)) {
    Logger.log(
      'isSameHourにDateオブジェクトではない値が渡されました。date1:' +
        date1 +
        ', date2:' +
        date2
    );
    return false;
  }
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
  const sheet = ss.getSheetByName('フォームの回答 2');
  sheet.appendRow([
    new Date(),
    formData.メールアドレス,
    formData.予約施設,
    formData.氏名,
    formData.連絡先,
    startTime,
    endTime,
    formData.備考,
    '',
  ]);
}

/**
 * カレンダーイベントを作成します。
 * @param {Object} formData - フォームデータ
 * @param {Date} startTime - 開始時刻
 * @return {Object} - 結果オブジェクト
 */
function createCalendarEvent(formData, startTime, endTime) {
  try {
    const calendarId =
      PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendarId) {
      Logger.log(
        'エラー: スクリプトプロパティにCALENDAR_IDが設定されていません。'
      );
      return {
        message: 'カレンダーIDが設定されていません。',
        status: 'error',
      };
    }
    if (!calendar) {
      Logger.log('カレンダーが見つかりません。IDを確認してください。');
      return {
        message: 'カレンダーが見つかりません。IDを確認してください。',
        status: 'error',
      };
    }
    // startTimeとendTimeがDateオブジェクトであることを確認
    if (!(startTime instanceof Date) || !(endTime instanceof Date)) {
      Logger.log(
        'startTimeまたはEndTimeがDateオブジェクトではありません。startTime:' +
          startTime +
          ', endTime:' +
          endTime
      );
      return { message: '開始時刻または終了時刻が不正です。', status: 'error' };
    }

    const event = calendar.createEvent(
      '予約：' + formData.氏名 + ' 様：' + formData.予約施設,
      startTime,
      endTime,
      { description: formData.備考 }
    );
    return {
      message: '予約が完了しました。',
      eventId: event.getId(),
      status: 'ok',
    };
  } catch (error) {
    Logger.log('カレンダー登録エラー: ' + error);
    return {
      message: 'カレンダー登録中にエラーが発生しました：' + error,
      status: 'error',
    };
  }
}

function test() {
  var adapter = new GasMochaAdapter();
  eval(UrlFetchApp.fetch('https://raw.githubusercontent.com/fossamagna/gas-mocha-adapter/master/src/gas-mocha-adapter-lib.js').getContentText());
  eval(UrlFetchApp.fetch('https://script.google.com/macros/s/1U5BGrBwdlH5aRjrI9pkFX6iDhgnS8lw0u1ZYh7k3juL8n0Awb7d16pYt/exec').getContentText());
  adapter.run();
  var summary = adapter.getSummary();
  Logger.log(summary);
  Logger.log(adapter.tests);
}
