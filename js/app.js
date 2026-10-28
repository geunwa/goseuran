(function () {
  'use strict';

  // 설정값: 필요하면 값만 바꿔 쓰세요
  const STORAGE_KEY = 'goseuran.records.v1';
  const MAX_CHARS = 100;             // 한 번에 저장할 수 있는 글자 수
  const MAX_RECORDS_PER_DAY = 30;    // 하루에 저장할 수 있는 기록 수
  const TIME_ZONE = 'Asia/Seoul';
  const ENTER_GUARD_MS = 300;        // 이 시간 안에 다시 들어온 Enter는 무시
  const COMPOSITION_WAIT_MS = 500;   // 한글 조합이 끝나기를 기다리는 최대 시간
  const SHOW_SAMPLE_BUTTON = true;   // false로 바꾸면 '예시 기록 넣기' 버튼이 나타나지 않음
  const DAY_MS = 24 * 60 * 60 * 1000;

  // 예시 기록: 오늘 것은 '지금부터 몇 분 전', 지난 것은 'n일 전 그 시각'
  const SAMPLE_TODAY = [
    { minutesAgo: 50, text: '아침에 커피를 내려 마셨다.' },
    { minutesAgo: 41, text: '점심에 비빔밥을 먹었다. 맛있었다.' },
    { minutesAgo: 30, text: '회의가 길어져서 아쉬웠다.' },
    { minutesAgo: 21, text: '동료가 자료 정리를 도와줘서 고마웠다.' },
    { minutesAgo: 12, text: '새로 알게 된 단축키를 메모해 두었다.' },
    { minutesAgo: 3, text: '내일은 일찍 산책을 나가야겠다.' }
  ];
  const SAMPLE_PAST = [
    { daysAgo: 1, time: '08:40', text: '버스에서 책을 조금 읽었다.' },
    { daysAgo: 1, time: '13:05', text: '점심에 국수를 먹었다.' },
    { daysAgo: 1, time: '21:30', text: '일찍 잠자리에 들었다.' },
    { daysAgo: 2, time: '10:15', text: '오전에 빨래를 널었다.' },
    { daysAgo: 2, time: '19:40', text: '저녁 산책이 상쾌했다.' },
    { daysAgo: 35, time: '09:00', text: '새 달력을 걸었다.' },
    { daysAgo: 35, time: '18:30', text: '친구에게 안부 문자를 보냈다.' }
  ];

  // 화면 요소 찾기
  const form = document.getElementById('entry-form');
  const input = document.getElementById('entry-input');
  const saveBtn = document.getElementById('save-btn');
  const messageEl = document.getElementById('message');
  const todayDateEl = document.getElementById('today-date');
  const timelineEl = document.getElementById('timeline');
  const timelineEmptyEl = document.getElementById('timeline-empty');
  const sampleAreaEl = document.getElementById('sample-area');
  const sampleAddBtn = document.getElementById('sample-add-btn');
  const sampleClearBtn = document.getElementById('sample-clear-btn');
  const reviewBtn = document.getElementById('review-btn');
  const reviewEl = document.getElementById('review');
  const monthPickerEl = document.getElementById('month-picker');
  const monthSelectEl = document.getElementById('month-select');
  const pastEmptyEl = document.getElementById('past-empty');
  const pastListEl = document.getElementById('past-list');

  // 삭제 확인 중인 기록의 id (없으면 null), 지난 기록에서 선택한 월 (예: '2026-10')
  let confirmingId = null;
  let selectedMonth = null;

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

  // 지난 기록의 날짜 제목 (예: 10월 27일 화요일)
  function formatDayLabel(dateKey) {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: TIME_ZONE,
      month: 'long',
      day: 'numeric',
      weekday: 'long'
    }).format(new Date(dateKey + 'T12:00:00+09:00'));
  }

  // 월 선택 상자에 보여 줄 글자 (예: 2026년 10월)
  function formatMonthLabel(monthKey) {
    const p = monthKey.split('-');
    return p[0] + '년 ' + Number(p[1]) + '월';
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

  // 기록의 한국 날짜 키
  function dateKeyOf(record) {
    return getKstParts(new Date(record.createdAt)).dateKey;
  }

  // 특정 날짜(한국 시간)의 기록만 골라냄
  function getRecordsOfDay(records, dateKey) {
    return records.filter(function (r) { return dateKeyOf(r) === dateKey; });
  }

  // 저장 시각이 이른 기록이 먼저 오도록 정렬한 새 목록
  function sortByTime(list) {
    return list.slice().sort(function (a, b) {
      if (a.createdAt < b.createdAt) return -1;
      if (a.createdAt > b.createdAt) return 1;
      return 0;
    });
  }

  // 안내 문구 표시. isOk가 true면 초록색, 아니면 붉은색
  function showMessage(text, isOk) {
    messageEl.textContent = text;
    messageEl.className = isOk ? 'message ok' : 'message';
  }

  // 한 줄에 들어갈 작은 버튼 만들기
  function makeButton(label, action, id, className, ariaLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = className;
    btn.textContent = label;
    btn.dataset.action = action;
    btn.dataset.id = id;
    btn.setAttribute('aria-label', ariaLabel);
    return btn;
  }

  // 화면에서 동작과 id가 맞는 버튼 찾기
  function findButton(action, id) {
    return document.querySelector('button[data-action="' + action + '"][data-id="' + id + '"]');
  }

  // 기록 한 줄(시각, 글, 삭제 버튼) 만들기. 오늘과 지난 기록이 함께 사용
  function buildRecordRow(r) {
    const timeLabel = getKstParts(new Date(r.createdAt)).time;
    const isConfirming = r.id === confirmingId;

    const li = document.createElement('li');

    const time = document.createElement('span');
    time.className = 'time';
    time.textContent = timeLabel;

    const text = document.createElement('span');
    text.className = 'text';
    if (r.isSample) {
      const tag = document.createElement('span');
      tag.className = 'sample-tag';
      tag.textContent = '예시';
      text.appendChild(tag);
    }
    text.appendChild(document.createTextNode(r.text));

    const actions = document.createElement('span');
    actions.className = 'row-actions';
    if (isConfirming) {
      actions.appendChild(makeButton('삭제', 'delete', r.id, 'link-btn danger', timeLabel + ' 기록 삭제 확정'));
      actions.appendChild(makeButton('취소', 'cancel', r.id, 'link-btn', '삭제 취소'));
    } else {
      actions.appendChild(makeButton('삭제', 'ask-delete', r.id, 'link-btn', timeLabel + ' 기록 삭제'));
    }

    li.appendChild(time);
    li.appendChild(text);
    li.appendChild(actions);

    if (isConfirming) {
      const note = document.createElement('p');
      note.className = 'confirm-note';
      note.textContent = '삭제하면 되돌릴 수 없어요.';
      li.appendChild(note);
    }
    return li;
  }

  // 예시 기록 버튼 보이기와 숨기기
  function renderSampleArea(todays, records) {
    const hasSample = records.some(function (r) { return r.isSample; });
    const canAdd = SHOW_SAMPLE_BUTTON && todays.length === 0 && !hasSample;
    sampleAddBtn.hidden = !canAdd;
    sampleClearBtn.hidden = !hasSample;
    sampleAreaEl.hidden = !(canAdd || hasSample);
  }

  // 오늘 날짜와 타임라인 그리기
  function renderToday() {
    const now = new Date();
    const dateKey = getKstParts(now).dateKey;

    todayDateEl.textContent = formatTodayLabel(now);
    todayDateEl.setAttribute('datetime', dateKey);

    const records = readRecords() || [];
    const todays = sortByTime(getRecordsOfDay(records, dateKey));

    timelineEl.textContent = '';
    todays.forEach(function (r) {
      timelineEl.appendChild(buildRecordRow(r));
    });

    timelineEmptyEl.hidden = todays.length > 0;
    reviewBtn.disabled = todays.length === 0;
    renderSampleArea(todays, records);
  }

  // 지난 기록 그리기: 월을 고르면 그 달의 날짜별 기록을 보여 줌
  function renderPast() {
    const todayKey = getKstParts(new Date()).dateKey;
    const records = readRecords() || [];
    const past = records.filter(function (r) { return dateKeyOf(r) < todayKey; });

    pastListEl.textContent = '';

    if (past.length === 0) {
      monthPickerEl.hidden = true;
      pastEmptyEl.hidden = false;
      selectedMonth = null;
      return;
    }
    pastEmptyEl.hidden = true;
    monthPickerEl.hidden = false;

    // 기록이 있는 월 목록 (최근 월이 위)
    const monthSet = {};
    past.forEach(function (r) { monthSet[dateKeyOf(r).slice(0, 7)] = true; });
    const months = Object.keys(monthSet).sort().reverse();
    if (!selectedMonth || months.indexOf(selectedMonth) === -1) {
      selectedMonth = months[0];
    }

    monthSelectEl.textContent = '';
    months.forEach(function (m) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = formatMonthLabel(m);
      monthSelectEl.appendChild(opt);
    });
    monthSelectEl.value = selectedMonth;

    // 선택한 월의 기록을 날짜별로 묶기
    const byDay = {};
    past.forEach(function (r) {
      const key = dateKeyOf(r);
      if (key.slice(0, 7) !== selectedMonth) return;
      if (!byDay[key]) byDay[key] = [];
      byDay[key].push(r);
    });

    // 최근 날짜가 위, 하루 안에서는 이른 시각이 위
    Object.keys(byDay).sort().reverse().forEach(function (key) {
      const title = document.createElement('h3');
      title.className = 'day-title';
      title.textContent = formatDayLabel(key);

      const list = document.createElement('ol');
      list.className = 'timeline';
      sortByTime(byDay[key]).forEach(function (r) {
        list.appendChild(buildRecordRow(r));
      });

      pastListEl.appendChild(title);
      pastListEl.appendChild(list);
    });
  }

  // 오늘과 지난 기록을 모두 다시 그리기
  function renderAll() {
    renderToday();
    renderPast();
  }

  // 기록 한 개 삭제하기
  function deleteRecord(id, fromPast) {
    const records = readRecords();
    if (records === null) {
      showMessage('이 브라우저에서는 기록을 삭제할 수 없어요.', false);
      return;
    }

    const remaining = records.filter(function (r) { return r.id !== id; });
    if (remaining.length === records.length) {
      // 이미 지워진 기록이면 화면만 새로 그림
      confirmingId = null;
      renderAll();
      return;
    }

    if (!writeRecords(remaining)) {
      showMessage('삭제하지 못했어요. 브라우저 저장 공간을 확인해 주세요.', false);
      return;
    }

    confirmingId = null;
    // 기록이 바뀌면 이전 하루 정리 결과는 지움 (AI 결과는 STEP 6~7에서 연결)
    reviewEl.hidden = true;
    reviewEl.textContent = '';
    showMessage('삭제했어요.', true);
    renderAll();
    if (!fromPast) input.focus({ preventScroll: true });
  }

  // 오늘과 지난 기록 목록의 삭제, 삭제 확정, 취소 버튼 처리
  function onRowClick(event) {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;
    const fromPast = pastListEl.contains(btn);

    if (action === 'ask-delete') {
      confirmingId = id;
      renderAll();
      const cancelBtn = findButton('cancel', id);
      if (cancelBtn) cancelBtn.focus();   // 실수로 Enter를 눌러도 삭제되지 않도록 취소에 둠
    } else if (action === 'cancel') {
      confirmingId = null;
      renderAll();
      const askBtn = findButton('ask-delete', id);
      if (askBtn) askBtn.focus();
    } else if (action === 'delete') {
      deleteRecord(id, fromPast);
    }
  }
  timelineEl.addEventListener('click', onRowClick);
  pastListEl.addEventListener('click', onRowClick);

  // Esc 키로 삭제 확인 취소
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !confirmingId) return;
    const id = confirmingId;
    confirmingId = null;
    renderAll();
    const askBtn = findButton('ask-delete', id);
    if (askBtn) askBtn.focus();
  });

  // 월 선택이 바뀌면 그 달의 기록을 다시 그림
  monthSelectEl.addEventListener('change', function () {
    selectedMonth = monthSelectEl.value;
    confirmingId = null;
    renderPast();
  });

  // ---- 예시 기록 ----
  // 예시 기록 목록 만들기. 오늘 것은 지금 이전의 시각, 지난 것은 며칠 전 그 시각
  function buildSampleRecords(now) {
    const nowMs = now.getTime();
    const todayKey = getKstParts(now).dateKey;
    const todayStartMs = new Date(todayKey + 'T00:00:00+09:00').getTime();
    const list = [];

    SAMPLE_TODAY.forEach(function (s, i) {
      const t = Math.min(Math.max(nowMs - s.minutesAgo * 60000, todayStartMs + i * 1000), nowMs);
      list.push({
        id: makeId(),
        text: s.text,
        createdAt: new Date(t).toISOString(),
        isMain: false,
        excludeFromEssay: false,
        isSample: true
      });
    });

    SAMPLE_PAST.forEach(function (s) {
      const dayKey = getKstParts(new Date(todayStartMs - s.daysAgo * DAY_MS)).dateKey;
      const t = new Date(dayKey + 'T' + s.time + ':00+09:00');
      list.push({
        id: makeId(),
        text: s.text,
        createdAt: t.toISOString(),
        isMain: false,
        excludeFromEssay: false,
        isSample: true
      });
    });

    return list;
  }

  sampleAddBtn.addEventListener('click', function () {
    const records = readRecords();
    if (records === null) {
      showMessage('이 브라우저에서는 기록을 저장할 수 없어요.', false);
      return;
    }
    if (!writeRecords(records.concat(buildSampleRecords(new Date())))) {
      showMessage('예시 기록을 넣지 못했어요. 브라우저 저장 공간을 확인해 주세요.', false);
      return;
    }
    confirmingId = null;
    showMessage('예시 기록을 넣었어요. 직접 쓴 기록이 아니에요. 언제든 지울 수 있어요.', true);
    renderAll();
  });

  sampleClearBtn.addEventListener('click', function () {
    const records = readRecords();
    if (records === null) return;
    const remaining = records.filter(function (r) { return !r.isSample; });
    if (!writeRecords(remaining)) {
      showMessage('예시 기록을 지우지 못했어요. 브라우저 저장 공간을 확인해 주세요.', false);
      return;
    }
    confirmingId = null;
    reviewEl.hidden = true;
    reviewEl.textContent = '';
    showMessage('예시 기록을 지웠어요.', true);
    renderAll();
  });

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
    confirmingId = null;
    showMessage('저장했어요.', true);
    renderAll();
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
    if (document.visibilityState === 'visible') renderAll();
  });

  // 시작할 때 저장소를 쓸 수 있는지 확인하고 화면 그리기
  if (readRecords() === null) {
    showMessage('이 브라우저에서는 기록을 저장할 수 없어요. 사생활 보호 모드를 끄고 다시 시도해 주세요.', false);
    saveBtn.disabled = true;
  }
  renderAll();
})();