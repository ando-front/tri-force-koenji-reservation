<!--
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
-->
    カレンダー重複チェック後のエラー処理:

if (isOverlapping) ブロック内で、return e.response.withItemResponseErrors(...) を追加しました。これにより、カレンダーの重複チェックで重複が見つかった場合も、フォームにエラーメッセージが表示され、登録が拒否されるようになります。
メール送信の整理: 重複エラー時のメール送信を削除しました。フォーム側でエラーが出ているため、メールで再度エラーを伝える必要はありません。成功時のメール送信処理は重複がない場合にのみ実行されるように整理しました。
この修正により、以下の動作が実現されます。

開始時間の重複が 4 件以上の場合：フォームに「この開始時間は既に 4 件以上予約されています。」というエラーメッセージが表示され、登録が拒否されます。
カレンダーに重複する予約がある場合：フォームに「この時間帯は既に予約されています。」というエラーメッセージが表示され、登録が拒否されます。
重複がない場合：スプレッドシートとカレンダーに登録され、予約完了メールが送信されます。
