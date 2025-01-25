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
/**
 * Webアプリケーションとして予約フォームを表示します。
 */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

/**
 * フォーム送信時の処理を行います。
 * @param {Object} e - イベントオブジェクト
 * @return {ContentService} - 結果のテキスト出力
 */
function doPost(e) {
  // ToDo:予約完了画面（または満員画面）に「フォーム戻る」ボタンと「続けて予約する」ボタンと「カレンダーを見る」ボタンを追加する
  // ToDo:フィットネス4人、フリーマット10人とする
  // ToDo：30分刻みの予約とする
  // TODO:カレンダーURLの変数化
  // TODO:終了時刻を３０分刻みで入力できるようにする

  const formData = e.parameter;
  Logger.log('フォームデータ: ' + JSON.stringify(formData));

  try {
    const startDate = e.parameter.利用開始日;
    const startTime = e.parameter.利用開始時間;

    if (!startDate || !startTime) {
      Logger.log('エラー：利用開始日または利用開始時間が未入力です。');
      return createTextOutput('利用開始日と利用開始時間は必須です。'); // エラーメッセージを返す
    }
    const startTimeString = startDate + ' ' + startTime.split(' ')[1]; //時刻部分のみ抽出
    Logger.log('doPost startTimeString:' + startTimeString); //doPost内でのstartTimeStringを確認
    const parsedStartTimeForCheck = parseStartTime(startTimeString); // isTimeSlotFullチェック用
    const parsedStartTime = parseStartTime(startTimeString);
    const endTime = calculateEndTime(parsedStartTime);

    if (isTimeSlotFull(parsedStartTimeForCheck)) {
      return HtmlService.createHtmlOutput(
        `
        <div class="container">
          <div class="card-panel red lighten-4">
            <span class="red-text text-darken-4">この時間帯は満員です。</span><br><br>
            <button class="btn" onclick="window.history.back()">予約フォームに戻る</button>
            <button class="btn" onclick="window.location.href='index.html'">続けて予約する</button>
            <a href="https://calendar.google.com/calendar/embed?src=cfe744345d0d24b24dd1cae17d21f6c1a20dcea8f7899ca6a449bb2476fc5f08%40group.calendar.google.com&ctz=Asia%2FTokyo" target="_blank"><button class="btn">カレンダーを見る</button></a>
          </div>
        </div>
      `
      ).setSandboxMode(HtmlService.SandboxMode.IFRAME);
    }

    saveFormDataToSpreadsheet(formData, parsedStartTime, endTime);
    const calendarResult = createCalendarEvent(
      formData,
      parsedStartTime,
      endTime
    );
    Logger.log('カレンダー登録結果：' + calendarResult.message);

    return HtmlService.createHtmlOutput(
      `
      <div class="container">
        <div class="card-panel teal lighten-4">
          <span class="teal-text text-darken-4">予約が完了しました。</span><br><br>
          <button class="btn" onclick="window.history.back()">予約フォームに戻る</button>
          <button class="btn" onclick="window.location.href='index.html'">続けて予約する</button>
          <a href="https://calendar.google.com/calendar/embed?src=cfe744345d0d24b24dd1cae17d21f6c1a20dcea8f7899ca6a449bb2476fc5f08%40group.calendar.google.com&ctz=Asia%2FTokyo" target="_blank"><button class="btn">カレンダーを見る</button></a>
        </div>
      </div>
    `
    ).setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (error) {
    Logger.log('予約処理エラー: ' + error);
    return HtmlService.createHtmlOutput(
      `
    <div class="container">
      <div class="card-panel deep-orange lighten-4">
        <span class="deep-orange-text text-darken-4">予約処理中にエラーが発生しました：${error}</span><br><br>
        <button class="btn" onclick="window.history.back()">予約フォームに戻る</button>
        <button class="btn" onclick="window.location.href='index.html'">続けて予約する</button>
        <a href="https://calendar.google.com/calendar/embed?src=cfe744345d0d24b24dd1cae17d21f6c1a20dcea8f7899ca6a449bb2476fc5f08%40group.calendar.google.com&ctz=Asia%2FTokyo" target="_blank"><button class="btn">カレンダーを見る</button></a>
      </div>
    </div>
    `
    ).setSandboxMode(HtmlService.SandboxMode.IFRAME);
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
function isTimeSlotFull(startTime) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('フォームの回答 2');
  const lastRow = sheet.getLastRow();
  let count = 0;

  for (let i = 2; i <= lastRow; i++) {
    const existingStartTimeValue = sheet.getRange(i, 10).getValue();
    const existingStartTime = convertSpreadsheetDate(
      existingStartTimeValue,
      ss.getSpreadsheetLocale()
    );

    // existingStartTimeがDateオブジェクトであることを確認してからisSameHourを呼び出す
    if (existingStartTime instanceof Date) {
      if (isSameHour(existingStartTime, startTime)) {
        count++;
      }
    } else {
      Logger.log(
        'スプレッドシートの' +
          i +
          '行目の日付データが不正です: ' +
          existingStartTimeValue
      );
    }
  }
  return count >= 4; // 定員4名
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
 * @param {Date} endTime - 終了時刻
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
        'startTimeまたはendTimeがDateオブジェクトではありません。startTime:' +
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
  const htmlService = HtmlService.createHtmlOutputFromFile('index');
  SpreadsheetApp.getUi().showModalDialog(htmlService, '予約フォーム');
}

/**
 * スプレッドシートを開いた際にメニューを追加します。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('予約')
    .addItem('予約フォームを開く', 'setup')
    .addToUi();
}

// 定数定義
const SPREADSHEET_ID = '1U7sO1pf9uEA2YGmPxv5mk9gP6aE_w6l-ZJNUU6wxEUw'; // スプレッドシートID

// テスト対象の関数をexport
if (typeof module !== 'undefined') {
  module.exports = {
    parseStartTime,
    calculateEndTime,
    isSameHour,
    convertSpreadsheetDate,
    isTimeSlotFull,
    createCalendarEvent,
    createTextOutput,
  };
}
