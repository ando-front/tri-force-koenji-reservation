/**
 * Google Apps Script側の実装 - GitHub Pagesからのリクエストを処理するAPI
 * このコードは引き続きGoogle Apps Script側に残し、フロントエンドからAPIとして呼び出します
 */

// Cross-Origin Resource Sharing (CORS)の設定
function doOptions(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    return ContentService
      .createTextOutput('')
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type')
      .setHeader('Access-Control-Max-Age', '3600');
  } finally {
    lock.releaseLock();
  }
}

/**
 * API呼び出しのエントリーポイント
 */
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

/**
 * リクエストハンドラ
 */
function handleRequest(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var output = ContentService.createTextOutput();
    output.setMimeType(ContentService.MimeType.JSON);
    output.setHeader('Access-Control-Allow-Origin', '*');
    
    // パラメータの取得
    var action = e.parameter.action;
    var jsonData = {};
    
    if (e.postData) {
      try {
        jsonData = JSON.parse(e.postData.contents);
      } catch (error) {
        return output.setContent(JSON.stringify({ 
          status: 'error', 
          message: 'JSONデータの解析に失敗しました: ' + error 
        }));
      }
    }
    
    // アクションに応じた処理
    if (action === 'check') {
      // 予約可能かどうかを確認
      var result = checkAvailability(jsonData);
      return output.setContent(JSON.stringify(result));
    } else if (action === 'reserve') {
      // 予約処理
      var result = createReservation(jsonData);
      return output.setContent(JSON.stringify(result));
    } else {
      return output.setContent(JSON.stringify({ 
        status: 'error', 
        message: '不明なアクションです: ' + action 
      }));
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: 'エラーが発生しました: ' + error 
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*');
  } finally {
    lock.releaseLock();
  }
}

/**
 * 指定された時間帯が予約可能かどうかを確認
 */
function checkAvailability(data) {
  try {
    const startTimeString = data.startTime;
    const facility = data.facility;
    
    if (!startTimeString || !facility) {
      return { status: 'error', message: '開始時間または施設が指定されていません', available: false };
    }
    
    const startTime = parseStartTime(startTimeString);
    const isFull = isTimeSlotFull(startTime, facility);
    
    return { 
      status: 'ok', 
      available: !isFull 
    };
  } catch (error) {
    Logger.log('予約確認エラー: ' + error);
    return { 
      status: 'error', 
      message: 'エラーが発生しました: ' + error,
      available: false
    };
  }
}

/**
 * 予約を作成する
 */
function createReservation(data) {
  try {
    // データバリデーション
    if (!data['メールアドレス'] || !data['予約施設'] || !data['氏名'] || 
        !data['連絡先'] || !data['利用開始日'] || !data['利用開始時間']) {
      return { 
        status: 'error', 
        message: '必須項目が不足しています' 
      };
    }
    
    const startTimeString = data['利用開始時間'];
    const facility = data['予約施設'];
    
    // 開始・終了時刻の計算
    const startTime = parseStartTime(startTimeString);
    const endTime = calculateEndTime(startTime);
    
    // 予約可能かチェック
    if (isTimeSlotFull(startTime, facility)) {
      return { 
        status: 'error', 
        message: 'この時間帯は満員です' 
      };
    }
    
    // スプレッドシートに保存
    saveFormDataToSpreadsheet(data, startTime, endTime);
    
    // カレンダーに登録
    const calendarResult = createCalendarEvent(data, startTime, endTime);
    
    return {
      status: 'ok',
      message: '予約が完了しました',
      calendarResult: calendarResult
    };
  } catch (error) {
    Logger.log('予約作成エラー: ' + error);
    return { 
      status: 'error', 
      message: 'エラーが発生しました: ' + error 
    };
  }
}

/**
 * 利用開始日時文字列をDateオブジェクトに変換します。
 */
function parseStartTime(startTimeString) {
  try {
    let startTime = new Date(startTimeString);
    const ssTimeZone = SpreadsheetApp.openById(SPREADSHEET_ID).getSpreadsheetTimeZone();
    const formattedStartTime = Utilities.formatDate(
      startTime,
      ssTimeZone,
      'yyyy/MM/dd HH:mm:ss'
    );
    return new Date(formattedStartTime);
  } catch (error) {
    Logger.log('日付変換エラー: ' + error + ', startTimeString:' + startTimeString);
    throw new Error('日付の形式が正しくありません。');
  }
}

/**
 * 終了時刻を計算します。
 */
function calculateEndTime(startTime) {
  return new Date(startTime.getTime() + 60 * 60 * 1000); // 1時間後
}

/**
 * 時間帯が満員かどうかをチェックします。
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
 * フォームデータをスプレッドシートに保存します。
 */
function saveFormDataToSpreadsheet(formData, startTime, endTime) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('フォームの回答 2');
  sheet.appendRow([
    new Date(),
    formData['メールアドレス'],
    formData['予約施設'],
    formData['氏名'],
    formData['連絡先'],
    startTime,
    endTime,
    formData['備考'] || '',
    '',
  ]);
}

/**
 * カレンダーイベントを作成します。
 */
function createCalendarEvent(formData, startTime, endTime) {
  try {
    const calendarId = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
    const calendar = CalendarApp.getCalendarById(calendarId);
    
    if (!calendarId) {
      Logger.log('エラー: スクリプトプロパティにCALENDAR_IDが設定されていません。');
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
      '予約：' + formData['氏名'] + ' 様：' + formData['予約施設'],
      startTime,
      endTime,
      { description: formData['備考'] || '' }
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
 * スプレッドシートの日付シリアル値をDateオブジェクトに変換します。
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

// 定数定義
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const CALENDAR_ID = PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');