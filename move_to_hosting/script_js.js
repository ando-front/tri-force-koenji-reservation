// 定数定義
const GOOGLE_SHEET_API_URL = "https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_ID/exec";
const CALENDAR_URL = "https://calendar.google.com/calendar/embed?src=cfe744345d0d24b24dd1cae17d21f6c1a20dcea8f7899ca6a449bb2476fc5f08%40group.calendar.google.com&ctz=Asia%2FTokyo";

// 施設ごとの収容人数
let capacity = 4; // 初期値はフィットネス

function updateCapacity(newCapacity) {
  capacity = newCapacity;
}

// Materializeの初期化
document.addEventListener('DOMContentLoaded', function () {
  const datepickerOptions = {
    format: 'yyyy-mm-dd',
    i18n: {
      months: [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月'
      ],
      monthsShort: [
        '1月', '2月', '3月', '4月', '5月', '6月',
        '7月', '8月', '9月', '10月', '11月', '12月'
      ],
      weekdays: ['日', '月', '火', '水', '木', '金', '土'],
      weekdaysShort: ['日', '月', '火', '水', '木', '金', '土'],
      weekdaysAbbrev: ['日', '月', '火', '水', '木', '金', '土'],
      cancel: 'キャンセル',
      done: '完了',
    },
    onClose: function() {
      // 日付選択後に時間選択肢を更新
      const selectedDate = new Date(document.getElementById('startDate').value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        alert('過去の日付は選択できません');
        document.getElementById('startDate').value = '';
        generateTimeOptions(); // 日付をクリアしたら時間選択肢もリセット
        return;
      }

      generateTimeOptions(document.getElementById('startDate').value); // 選択された日付を渡す
      M.FormSelect.init(document.getElementById('startTime'));
    }
  };
  
  const datepicker = M.Datepicker.init(document.querySelectorAll('.datepicker'), datepickerOptions);
  M.FormSelect.init(document.querySelectorAll('select'));
  
  // 初期時間選択肢の生成
  generateTimeOptions();
  M.FormSelect.init(document.getElementById('startTime'));

  // フォーム送信イベントリスナー
  document.getElementById('reservationForm').addEventListener('submit', handleFormSubmit);
});

// バリデーション
const form = document.getElementById('reservationForm');
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

// フォーム送信処理
async function handleFormSubmit(event) {
  event.preventDefault();
  
  // 入力データを取得
  const formData = new FormData(event.target);
  const formDataObj = Object.fromEntries(formData.entries());
  
  // 基本バリデーション
  if (!formDataObj['メールアドレス'] || !formDataObj['予約施設'] || !formDataObj['氏名'] || 
      !formDataObj['連絡先'] || !formDataObj['利用開始日'] || !formDataObj['利用開始時間']) {
    showMessage('すべての必須項目を入力してください。', 'red');
    return;
  }
  
  try {
    // ローディング表示
    document.getElementById('loadingOverlay').style.display = 'flex';
    
    // 予約状況を確認
    const isAvailable = await checkAvailability(formDataObj);
    
    if (!isAvailable) {
      showMessage('この時間帯は満員です。', 'red');
      document.getElementById('loadingOverlay').style.display = 'none';
      return;
    }
    
    // 予約データを送信
    const result = await submitReservation(formDataObj);
    
    if (result.status === 'ok') {
      showMessage('予約が完了しました。', 'teal');
      form.reset();
      generateTimeOptions(); // フォームをリセット
      M.FormSelect.init(document.getElementById('startTime'));
    } else {
      showMessage('予約処理中にエラーが発生しました：' + result.message, 'deep-orange');
    }
  } catch (error) {
    showMessage('エラーが発生しました：' + error.message, 'deep-orange');
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
}

// メッセージを表示する関数
function showMessage(message, color) {
  const messageElement = document.getElementById('responseMessage');
  messageElement.className = 'card-panel ' + color + ' lighten-4';
  messageElement.innerHTML = '<span class="' + color + '-text text-darken-4">' + message + '</span>';
  messageElement.style.display = 'block';
  
  // スクロールして表示
  messageElement.scrollIntoView({ behavior: 'smooth' });
}

// 予約可能かどうかを確認する関数
async function checkAvailability(formData) {
  try {
    // Google Apps Script Web APIを使用して予約状況を確認
    const response = await fetch(GOOGLE_SHEET_API_URL + '?action=check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startTime: formData['利用開始時間'],
        facility: formData['予約施設']
      })
    });
    
    const result = await response.json();
    return result.available;
  } catch (error) {
    console.error('予約確認エラー:', error);
    throw new Error('予約状況の確認中にエラーが発生しました');
  }
}

// 予約を送信する関数
async function submitReservation(formData) {
  try {
    // Google Apps Script Web APIを使用して予約を登録
    const response = await fetch(GOOGLE_SHEET_API_URL + '?action=reserve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData)
    });
    
    return await response.json();
  } catch (error) {
    console.error('予約送信エラー:', error);
    throw new Error('予約の送信中にエラーが発生しました');
  }
}