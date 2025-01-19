function onFormSubmit(e) {
  // TODO
  // 5件重複のエラーメッセージはログ出力されるが、フォームの方に完了してエラーメッセージが表示されない。
  // 曜日マスタを作る（曜日ごとに何時に予約を受け付けるか）
  // 曜日マスタを参照してスプレッドシートに営業日時を登録できるようにする
  // フォームでは営業日時の空き時間を参照してプルダウンで選択できるようにする
  // プルダウンは２週間先までの予定だけを表示するようにする

  try {
    // フォーム、スプレッドシート、カレンダーの情報を取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName("フォームの回答 1"); // シート名を修正
    const formId = "1ily7-zCXMGmyj0VoPXIhz8tC15WR15DIfL1ygdj5iSI";
    Logger.log("スクリプトの所有者: " + Session.getActiveUser().getEmail()); // スクリプトの所有者
    let form;
    try {
      form = FormApp.openById(formId);
      Logger.log("フォームタイトル: " + form.getTitle()); // フォームのタイトル
    } catch (formError) {
      Logger.log("FormApp.openByIdでエラー:" + formError);
      return;
    }

    if (!form) {
      Logger.log("フォームの取得に失敗しました。処理を中断します。");
      return;
    }

    const calendarId =
      "cfe744345d0d24b24dd1cae17d21f6c1a20dcea8f7899ca6a449bb2476fc5f08@group.calendar.google.com"; // カレンダーIDを修正
    const calendar = CalendarApp.getCalendarById(calendarId);
    calendar.setTimeZone("Asia/Tokyo");

    // 最新のフォーム回答を取得
    const formResponses = form.getResponses();
    if (formResponses.length === 0) {
      Logger.log("フォームの回答がありません。処理を終了します。");
      return;
    }
    const latestResponse = formResponses[formResponses.length - 1];
    const itemResponses = latestResponse.getItemResponses();

    const itemResponseMap = {};
    let Email = null;

    itemResponses.forEach((itemResponse) => {
      itemResponseMap[itemResponse.getItem().getTitle()] =
        itemResponse.getResponse();
      // デバッグ用
      Logger.log(
        "itemResponse.getItem().getTitle():" + itemResponse.getItem().getTitle()
      ); // タイトルをログ出力

      // メールアドレスの質問を探す
      if (itemResponse.getItem().getTitle().includes("メールアドレス")) {
        Email = itemResponse.getResponse();
      }
    });

    console.log(itemResponseMap);

    // 回答内容を取得 (質問の順番に合わせてインデックスを指定)
    const TimeStamp = new Date(); // タイムスタンプはスクリプト実行時に取得
    // const Email = itemResponses[0].getResponse();
    const Equipment = itemResponseMap["予約施設"];
    const Name = itemResponseMap["氏名"];
    const Phone_number = itemResponseMap["連絡先（電話番号）"];
    const Start_time = new Date(itemResponseMap["利用開始日時"]);
    const End_time = new Date(itemResponseMap["利用終了日時"]);
    const Remarks = itemResponseMap["備考"];

    console.log(Email);

    if (
      !Email ||
      !Equipment ||
      !Name ||
      !Phone_number ||
      !Start_time ||
      !End_time
    ) {
      Logger.log("必須項目が未入力です。");
      return;
    }

    // 重複チェック
    let overlappingCount = 0;
    const existingEvents = calendar.getEvents(Start_time, End_time);
    for (const existingEvent of existingEvents) {
      const existingEventStartTime = existingEvent.getStartTime();
      const existingEventEndTime = existingEvent.getEndTime();
      if (
        (Start_time >= existingEventStartTime &&
          Start_time < existingEventEndTime) ||
        (End_time > existingEventStartTime &&
          End_time <= existingEventEndTime) ||
        (existingEventStartTime >= Start_time &&
          existingEventEndTime <= End_time)
      ) {
        overlappingCount++;
      }
    }

    // 重複件数が4件を超える場合
    if (overlappingCount > 4) {
      Logger.log("この時間帯は既に5件以上予約されています。");

      // エラーメッセージをフォームに設定 (ここが変更点)
      if (e && e.response) {
        try {
          const errorItem =
            form.getItemByTitle("スタッフからのメッセージ（入力不要）");
          if (errorItem) {
            errorItem.setHelpText(
              "この時間帯は既に5件以上予約されています。別の日時を選択してください。"
            ); // 説明文にエラーメッセージを設定
          } else {
            Logger.log("エラーメッセージ項目が見つかりませんでした。");
          }
        } catch (error) {
          Logger.log("エラーメッセージの設定に失敗しました:" + error);
          Logger.log("エラー詳細:" + JSON.stringify(error));
          Logger.log("エラーのスタックトレース:" + error.stack);
        }
      }
      return; // 重複がある場合はここで処理を終了
    }

    // 重複がない場合のみ、以下の処理を実行
    // スプレッドシートに登録
    sheet.appendRow([
      TimeStamp,
      Email,
      Equipment,
      Name,
      Phone_number,
      Start_time,
      End_time,
      Remarks,
    ]);

    // カレンダーに登録
    const event = calendar.createEvent(
      "予約：" + Name + " 様",
      Start_time,
      End_time,
      { description: Remarks }
    );
    Logger.log("カレンダーイベントを作成しました: " + event.getId());

    // 自動返信メール（成功時）
    const Subject = Name + "様　ご予約完了";
    const Body =
      Name +
      "様\n\n予約を承りました。\nありがとうございました。\n予約日時：" +
      Start_time +
      "-" +
      End_time;
    MailApp.sendEmail(Email, Subject, Body);
  } catch (error) {
    Logger.log("エラーが発生しました: " + error);
  }
}
