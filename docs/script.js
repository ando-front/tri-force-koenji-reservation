// script.js - GitHub Pages用フロントエンドスクリプト

// GAS Web AppのURL（実際のURLに置き換えてください）
// 手順:
// 1. Google Apps Scriptエディタで code.gs をデプロイ
// 2. 「新しいデプロイ」→「ウェブアプリ」→「全員がアクセス可能」で設定
// 3. 生成されたURLを以下に設定
// 例: 'https://script.google.com/macros/s/[YOUR_SCRIPT_ID]/exec'
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyukK7d84aPMkDHQg-bShC4voFy2j3qOPv_cNuF4IB4aql8J78mT1MGybT2C-stUec/exec';

let capacity = 4; // 初期値はフィットネス

// 定員の更新
function updateCapacity(newCapacity) {
    capacity = newCapacity;
}

document.addEventListener('DOMContentLoaded', function() {
    // Materialize初期化
    initializeMaterialize();
    
    // 時間選択肢の初期生成
    generateTimeOptions();
    
    // 今日の日付を最小値に設定
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').setAttribute('min', today);
    
    // イベントリスナーの設定
    setupEventListeners();
});

function initializeMaterialize() {
    // Datepicker初期化
    M.Datepicker.init(document.querySelectorAll('.datepicker'), {
        format: 'yyyy-mm-dd',
        i18n: {
            months: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            monthsShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
            weekdays: ['日', '月', '火', '水', '木', '金', '土'],
            weekdaysShort: ['日', '月', '火', '水', '木', '金', '土'],
            weekdaysAbbrev: ['日', '月', '火', '水', '木', '金', '土'],
            cancel: 'キャンセル',
            done: '完了'
        }
    });
    
    // Select初期化
    M.FormSelect.init(document.querySelectorAll('select'));
}

function setupEventListeners() {
    // フォーム送信処理
    document.getElementById('reservationForm').addEventListener('submit', handleSubmit);
    
    // 日付変更時の処理
    document.getElementById('startDate').addEventListener('change', function() {
        const selectedDate = new Date(this.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (selectedDate < today) {
            M.toast({html: '過去の日付は選択できません'});
            this.value = '';
            generateTimeOptions();
            return;
        }
        
        generateTimeOptions(this.value);
    });
    
    // バリデーション処理
    const form = document.getElementById('reservationForm');
    form.addEventListener('invalid', event => {
        if (event.target.validity.valueMissing) {
            event.target.setCustomValidity('この項目は必須です。');
        }
    });
    
    form.addEventListener('input', event => {
        event.target.setCustomValidity('');
    });
}

// 時間選択肢の生成
function generateTimeOptions(date) {
    const startTimeSelect = document.getElementById('startTime');
    startTimeSelect.innerHTML = '<option value="" disabled selected>時間を選択</option>';

    // 7:00から21:00まで30分刻みで生成
    // ベース日付は今日または選択された日付を使用
    const baseDate = date ? new Date(date) : new Date();

    let currentTime = new Date(baseDate);
    currentTime.setHours(7, 0, 0, 0);

    const endTime = new Date(baseDate);
    endTime.setHours(21, 0, 0, 0);

    while (currentTime <= endTime) {
        const timeString = currentTime.toLocaleTimeString('ja-JP', {
            hour: '2-digit',
            minute: '2-digit'
        });

        const option = document.createElement('option');
        option.value = timeString;
        option.text = timeString;
        startTimeSelect.appendChild(option);

        currentTime.setMinutes(currentTime.getMinutes() + 30);
    }

    // Selectを再初期化
    M.FormSelect.init(startTimeSelect);
}

async function handleSubmit(e) {
    e.preventDefault();
    
    // ローディング表示
    showLoading();
    
    // フォームデータの収集
    const formData = collectFormData();
    
    // バリデーション
    if (!validateFormData(formData)) {
        hideLoading();
        return;
    }
    
    try {
        // GASにPOST送信（CORS対応）
        const response = await fetch(GAS_WEB_APP_URL, {
            method: 'POST',
            mode: 'cors', // CORSを有効化（GAS側で対応済み）
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        });

        // レスポンスを解析
        const result = await response.json();

        if (result.success) {
            showSuccess(result);
            resetForm();
        } else {
            showError(result.message || '予約に失敗しました');
        }
        
    } catch (error) {
        console.error('Error:', error);
        showError('通信エラーが発生しました。もう一度お試しください。');
    } finally {
        hideLoading();
    }
}

function collectFormData() {
    const form = document.getElementById('reservationForm');
    const formData = new FormData(form);
    const data = {};
    
    formData.forEach((value, key) => {
        data[key] = value;
    });
    
    return data;
}

function validateFormData(data) {
    // 必須項目チェック
    const requiredFields = ['メールアドレス', '予約施設', '氏名', '連絡先', '利用開始日', '利用開始時間'];
    
    for (const field of requiredFields) {
        if (!data[field] || data[field].trim() === '') {
            M.toast({html: `${field}は必須項目です`});
            return false;
        }
    }
    
    // メールアドレス形式チェック
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(data['メールアドレス'])) {
        M.toast({html: '正しいメールアドレスを入力してください'});
        return false;
    }
    
    // 日付チェック
    const selectedDate = new Date(data['利用開始日']);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        M.toast({html: '過去の日付は選択できません'});
        return false;
    }
    
    return true;
}

function showLoading() {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="material-icons left">hourglass_empty</i>送信中...';
}

function hideLoading() {
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '送信<i class="material-icons right">send</i>';
}

function showSuccess(result) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    
    resultContent.innerHTML = `
        <div class="teal-text">
            <i class="material-icons">check_circle</i>
            <h6>予約が正常に受け付けられました</h6>
            <p>予約ID: ${result.reservationId || 'なし'}</p>
            <p>管理者が会員確認を行い、予約を確定いたします。</p>
            <p>確認の連絡をお待ちください。</p>
            <br>
            <a href="#" onclick="resetResult()" class="btn">新しい予約をする</a>
        </div>
    `;
    
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    M.toast({html: '予約を受け付けました'});
}

function showError(message) {
    const resultDiv = document.getElementById('result');
    const resultContent = document.getElementById('resultContent');
    
    resultContent.innerHTML = `
        <div class="red-text">
            <i class="material-icons">error</i>
            <h6>予約に失敗しました</h6>
            <p>${message}</p>
            <br>
            <a href="#" onclick="resetResult()" class="btn">再試行</a>
        </div>
    `;
    
    resultDiv.style.display = 'block';
    resultDiv.scrollIntoView({ behavior: 'smooth' });
    
    M.toast({html: 'エラーが発生しました'});
}

function resetForm() {
    document.getElementById('reservationForm').reset();
    M.updateTextFields();
    
    // セレクトボックスを初期化
    const selects = document.querySelectorAll('select');
    selects.forEach(select => {
        const instance = M.FormSelect.getInstance(select);
        if (instance) {
            instance.destroy();
        }
    });
    M.FormSelect.init(selects);
    
    // 時間選択肢をリセット
    generateTimeOptions();
    
    // 定員をリセット
    capacity = 4;
}

function resetResult() {
    document.getElementById('result').style.display = 'none';
}

function generateTempId() {
    return 'TEMP_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
}
