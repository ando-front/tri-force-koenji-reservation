let capacity = 4; // 初期値はフィットネス

function updateCapacity(newCapacity) {
  capacity = newCapacity;
}

// Materializeの初期化
document.addEventListener('DOMContentLoaded', function () {
  M.Datepicker.init(document.querySelectorAll('.datepicker'), {
    format: 'yyyy-mm-dd',
    i18n: {
      months: [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月',
      ],
      monthsShort: [
        '1月',
        '2月',
        '3月',
        '4月',
        '5月',
        '6月',
        '7月',
        '8月',
        '9月',
        '10月',
        '11月',
        '12月',
      ],
      weekdays: ['日', '月', '火', '水', '木', '金', '土'],
      weekdaysShort: ['日', '月', '火', '水', '木', '金', '土'],
      weekdaysAbbrev: ['日', '月', '火', '水', '木', '金', '土'],
      cancel: 'キャンセル',
      done: '完了',
    },
  });
  M.FormSelect.init(document.querySelectorAll('select'));
});

// バリデーション
const form = document.getElementById('myForm');
form.addEventListener('invalid', event => {
  if (event.target.validity.valueMissing) {
    event.target.setCustomValidity('この項目は必須です。');
  }
});
form.addEventListener('input', event => {
  event.target.setCustomValidity('');
});

// 時間選択肢の生成
function generateTimeOptions(date) {
  const startTimeSelect = document.getElementById('startTime');
  startTimeSelect.innerHTML = ''; // 既存の選択肢をクリア
  let startTime = new Date();
  startTime.setHours(10, 0, 0, 0);

  const endTime = new Date(); // 終了時刻を設定
  endTime.setHours(21, 0, 0, 0);

  while (startTime <= endTime) {
    const timeString = startTime.toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const option = document.createElement('option');
    option.value = date ? date + ' ' + timeString : timeString; // 日付があれば結合
    option.text = timeString;
    startTimeSelect.appendChild(option);
    startTime.setMinutes(startTime.getMinutes() + 30); // 30分進める
  }
}

// 初期時間選択肢の生成
generateTimeOptions();

// 日付変更時の処理
document
  .getElementById('startDate')
  .addEventListener('change', function () {
    const selectedDate = new Date(this.value);
    const today = new Date();

    if (selectedDate < today) {
      alert('過去の日付は選択できません');
      this.value = '';
      generateTimeOptions(); // 日付をクリアしたら時間選択肢もリセット
      return;
    }

    generateTimeOptions(this.value); // 選択された日付を渡す
  });
