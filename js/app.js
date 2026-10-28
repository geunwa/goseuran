(function () {
  'use strict';

  // 설정값: 필요하면 숫자만 바꿔 쓰세요
  const STORAGE_KEY = 'goseuran.records.v1';
  const MAX_CHARS = 100;             // 한 번에 저장할 수 있는 글자 수
  const MAX_RECORDS_PER_DAY = 30;    // 하루에 저장할 수 있는 기록 수
  const TIME_ZONE = 'Asia/Seoul';
  const ENTER_GUARD_MS = 300;        // 이 시간 안에 다시 들어온 Enter는 무시
  const COMPOSITION_WAIT_MS = 500;   // 한글 조합이 끝나기를 기다리는 최대 시간

  // 화면 요소 찾기
  const form = document.getElementById('entry-form');
  const input = document.getElementById('entry-input');
  const saveBtn = document.getElementById('save-btn');
  const messageEl = document.getElementById('message');
  const todayDateEl = document.getElementById('today-date');
  const timelineEl = document.getElementById('timeline');
  const timelineEmptyEl = document.getElementById('timeline-empty');
  const reviewBtn = document.getElementById('review-btn');

  // 한국 시간 기준 날짜(2026-10-28)와 시각(14:05)을 돌려줌
  function getKstParts(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
    const map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    return {
      dateKey: map.year + '-' + map.month + '-' + map.day,
      time: map.hour + ':' + map.minute
    };
  }

  // 화면에 보여 줄 오늘 날짜 글자
  function formatTodayLabel(date) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(date);
  }

  // 저장된 기록 읽기. 저장소를 쓸 수 없으면 null
  function readRecords() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return [];
    try {
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : [];
    } catch (e) {
      // 저장된 글자가 망가졌을 때 원본을 백업 키에 보관
      try { localStorage.setItem(STORAGE_KEY + '.backup', raw); } catch (e2) { /* 무시 */ }
      return [];
    }
  }

  // 기록 저장하기. 성공하면 true
  function writeRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 기록마다 붙일 고유 번호
  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return 'r_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // 특정 날짜(한국 시간)의 기록만 골라냄
  function getRecordsOfDay(records, dateKey) {
    return records.filter(function (r) {
      return getKstParts(new Date(r.createdAt)).dateKey === dateKey;
    });
  }

  // 안내 문구 표시. isOk가 true면 초록색, 아니면 붉은색
  function showMessage(text, isOk) {
    messageEl.textContent = text;
    messageEl.className = isOk ? 'message ok' : 'message';
  }

  // 오늘 날짜와 타임라인 그리기
  function renderToday() {
    const now = new Date();
    const dateKey = getKstParts(now).dateKey;

    todayDateEl.textContent = formatTodayLabel(now);
    todayDateEl.setAttribute('datetime', dateKey);

    const records = readRecords() || [];
    const todays = getRecordsOfDay(records, dateKey);

    timelineEl.textContent = '';
    todays.forEach(function (r) {
      const li = document.createElement('li');

      const time = document.createElement('span');
      time.className = 'time';
      time.textContent = getKstParts(new Date(r.createdAt)).time;

      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = r.text;

      li.appendChild(time);
      li.appendChild(text);
      timelineEl.appendChild(li);
    });

    timelineEmptyEl.hidden = todays.length > 0;
    reviewBtn.disabled = todays.length === 0;
  }

  // 입력창의 글을 한 개의 기록으로 저장. 붙여넣은 줄바꿈은 공백으로 바꿈
  function handleSave() {
    const text = input.value.replace(/\s*[\r\n]+\s*/g, ' ').trim();

    if (text.length === 0) {
      showMessage('내용을 입력해 주세요.', false);
      input.focus();
      return;
    }

    if (text.length > MAX_CHARS) {
      showMessage('한 번에 ' + MAX_CHARS + '자까지 저장할 수 있어요. 지금은 ' + text.length + '자예요. 나눠서 적어 주세요.', false);
      return;
    }

    const records = readRecords();
    if (records === null) {
      showMessage('이 브라우저에서는 기록을 저장할 수 없어요. 사생활 보호 모드를 끄고 다시 시도해 주세요.', false);
      return;
    }

    const now = new Date();
    const dateKey = getKstParts(now).dateKey;
    if (getRecordsOfDay(records, dateKey).length >= MAX_RECORDS_PER_DAY) {
      showMessage('오늘은 ' + MAX_RECORDS_PER_DAY + '개를 모두 저장했어요. 내일 이어서 남겨 주세요.', false);
      return;
    }

    records.push({
      id: makeId(),
      text: text,
      createdAt: now.toISOString(),
      isMain: false,
      excludeFromEssay: false
    });

    if (!writeRecords(records)) {
      showMessage('저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.', false);
      return;
    }

    input.value = '';
    showMessage('저장했어요.', true);
    renderToday();
    input.focus();
  }

  // 저장 버튼
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    handleSave();
  });

  // ---- Enter 처리: Enter만 저장하고, 줄바꿈과 다른 키 조합은 막음 ----
  let lastEnterAt = 0;
  let pendingEnterAt = 0;

  // Enter로 저장. 짧은 시간에 두 번 들어온 Enter는 한 번만 처리
  function saveFromEnter() {
    const now = Date.now();
    if (now - lastEnterAt < ENTER_GUARD_MS) return;
    lastEnterAt = now;
    handleSave();
  }

  // 한글을 입력하는 중이면 조합이 끝난 뒤에 저장하고, 아니면 바로 저장
  function requestEnterSave(isComposing) {
    if (isComposing) {
      pendingEnterAt = Date.now();
    } else {
      saveFromEnter();
    }
  }

  input.addEventListener('keydown', function (event) {
    if (event.key !== 'Enter') return;
    const composing = event.isComposing || event.keyCode === 229;
    const withOtherKey = event.shiftKey || event.ctrlKey || event.altKey || event.metaKey;
    if (!composing) event.preventDefault();      // 줄바꿈 막기
    if (withOtherKey || event.repeat) return;    // 다른 키와 함께 누른 Enter, 누르고 있는 Enter는 무시
    requestEnterSave(composing);
  });

  // 폰 키보드처럼 keydown으로 Enter가 오지 않는 경우를 위한 보조 처리
  input.addEventListener('beforeinput', function (event) {
    if (event.inputType !== 'insertLineBreak' && event.inputType !== 'insertParagraph') return;
    event.preventDefault();
    requestEnterSave(event.isComposing);
  });

  // 한글 조합이 끝났을 때, 직전에 Enter를 눌렀다면 저장
  input.addEventListener('compositionend', function () {
    const waited = pendingEnterAt && (Date.now() - pendingEnterAt < COMPOSITION_WAIT_MS);
    pendingEnterAt = 0;
    if (waited) setTimeout(saveFromEnter, 0);
  });

  // 다시 입력하기 시작하면 안내 문구를 지움
  input.addEventListener('input', function () {
    if (messageEl.textContent) showMessage('', false);
  });

  // 탭으로 돌아왔을 때 날짜가 바뀌었을 수 있으니 다시 그림
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') renderToday();
  });

  // 시작할 때 저장소를 쓸 수 있는지 확인하고 화면 그리기
  if (readRecords() === null) {
    showMessage('이 브라우저에서는 기록을 저장할 수 없어요. 사생활 보호 모드를 끄고 다시 시도해 주세요.', false);
    saveBtn.disabled = true;
  }
  renderToday();
})();