(function () {
  'use strict';

  // 설정값
  const STORAGE_KEY = 'goseuran.records.v1';
  const TIME_ZONE = 'Asia/Seoul';
  const API_URL = '/api/review';
  const TIMEOUT_MS = 30000;   // 응답을 기다리는 최대 시간 (서버는 25초)
  const CODE_MAX_LEN = 64;    // 접근 코드 입력 글자 수 상한

  const reviewBtn = document.getElementById('review-btn');
  const reviewEl = document.getElementById('review');
  if (!reviewBtn || !reviewEl) return;

  let busy = false;
  // 접근 코드는 이 변수에만 둠. 브라우저 저장소에 쓰지 않아서 새로 고치거나 탭을 닫으면 사라짐
  let accessCode = '';

  // 한국 시간 기준 날짜 키 (예: 2026-11-04)
  function dateKeyOf(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(date);
    const map = {};
    parts.forEach(function (p) { map[p.type] = p.value; });
    return map.year + '-' + map.month + '-' + map.day;
  }

  // 저장된 기록 중 오늘 것만, 이른 시각 순으로. 서버에는 id와 글만 보냄
  function getTodayRecords() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return [];
    }
    if (!raw) return [];

    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      return [];
    }
    if (!Array.isArray(data)) return [];

    const today = dateKeyOf(new Date());
    return data
      .filter(function (r) { return dateKeyOf(new Date(r.createdAt)) === today; })
      .sort(function (a, b) {
        if (a.createdAt < b.createdAt) return -1;
        if (a.createdAt > b.createdAt) return 1;
        return 0;
      })
      .map(function (r) {
        return { id: r.id, text: r.text };
      });
  }

  // 안내 상태(정리 중, 오류) 표시
  function showState(kind, text) {
    reviewEl.hidden = false;
    reviewEl.textContent = '';
    reviewEl.className = 'review ' + kind;
    const p = document.createElement('p');
    p.className = 'review-state';
    p.textContent = text;
    reviewEl.appendChild(p);
  }

  // 접근 코드 입력칸 표시. isError가 true면 안내를 붉게 보여 줌
  function showAccessPrompt(message, isError) {
    reviewEl.hidden = false;
    reviewEl.textContent = '';
    reviewEl.className = isError ? 'review error' : 'review';

    const p = document.createElement('p');
    p.className = 'review-state';
    p.textContent = message;
    reviewEl.appendChild(p);

    const form = document.createElement('form');
    form.className = 'access-form';

    const label = document.createElement('label');
    label.className = 'visually-hidden';
    label.setAttribute('for', 'access-code');
    label.textContent = '접근 코드';

    const input = document.createElement('input');
    input.type = 'password';
    input.id = 'access-code';
    input.className = 'access-input';
    input.placeholder = '접근 코드';
    input.maxLength = CODE_MAX_LEN;
    input.autocomplete = 'off';
    input.spellcheck = false;

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn btn-secondary';
    btn.textContent = '확인';

    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(btn);

    const note = document.createElement('p');
    note.className = 'access-note';
    note.textContent = 'AI 호출은 접근 코드로 보호돼 있어요. 코드는 이 탭에서만 기억하고, 새로 고치면 지워져요.';

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const value = input.value.trim();
      if (value === '') {
        input.focus();
        return;
      }
      if (/[^\x20-\x7E]/.test(value)) {
        showAccessPrompt('접근 코드는 영문, 숫자, 기호로만 입력할 수 있어요.', true);
        return;
      }
      accessCode = value;
      runReview();
    });

    reviewEl.appendChild(form);
    reviewEl.appendChild(note);
    input.focus();
  }

  // 오류 종류에 맞는 안내 문구
  function errorMessage(err) {
    if (err && err.name === 'AbortError') {
      return '응답이 늦어지고 있어요. 잠시 후 다시 시도해 주세요.';
    }
    if (err && err.serverMessage) return err.serverMessage;

    const status = err && err.status;
    if (status === 404 || status === 405) return '정리 기능을 찾을 수 없어요. 배포된 주소에서 시도해 주세요.';
    if (status === 413) return '보낼 내용이 너무 길어요.';
    if (status >= 500) return '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
    if (status >= 400) return '요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.';
    return '서버에 연결하지 못했어요. 인터넷 연결을 확인하거나 배포된 주소에서 시도해 주세요.';
  }

  // 작은 제목 만들기
  function makeHeading(text) {
    const h = document.createElement('h3');
    h.className = 'review-sub';
    h.textContent = text;
    return h;
  }

  // 서버가 돌려준 결과를 화면에 그림. 글은 모두 textContent로 넣음
  function renderResult(data, records) {
    reviewEl.hidden = false;
    reviewEl.textContent = '';
    reviewEl.className = 'review';

    reviewEl.appendChild(makeHeading('하루 에세이'));
    const essay = document.createElement('p');
    essay.className = 'review-essay';
    essay.textContent = typeof data.essay === 'string' ? data.essay : '';
    reviewEl.appendChild(essay);

    if (Array.isArray(data.items) && data.items.length > 0) {
      const textById = Object.create(null);
      records.forEach(function (r) { textById[r.id] = r.text; });

      reviewEl.appendChild(makeHeading('분류와 정돈 문장'));
      const list = document.createElement('ul');
      list.className = 'review-list';

      data.items.forEach(function (item) {
        if (!item || typeof item.id !== 'string' || !(item.id in textById)) return;

        const li = document.createElement('li');

        const cat = document.createElement('span');
        cat.className = 'cat';
        cat.textContent = typeof item.category === 'string' ? item.category : '기타';

        const body = document.createElement('div');
        body.className = 'body';

        const orig = document.createElement('span');
        orig.className = 'orig';
        orig.textContent = textById[item.id];
        body.appendChild(orig);

        if (typeof item.tidy === 'string' && item.tidy && item.tidy !== textById[item.id]) {
          const tidy = document.createElement('span');
          tidy.className = 'tidy';
          const label = document.createElement('span');
          label.className = 'tidy-label';
          label.textContent = 'AI 정돈';
          tidy.appendChild(label);
          tidy.appendChild(document.createTextNode(item.tidy));
          body.appendChild(tidy);
        }

        li.appendChild(cat);
        li.appendChild(body);
        list.appendChild(li);
      });
      reviewEl.appendChild(list);
    }

    // 결과가 AI가 만든 것임을 알리는 한 줄
    const meta = document.createElement('p');
    meta.className = 'review-meta';
    meta.textContent = 'AI가 정리한 결과예요. 원문은 위 타임라인에 그대로 남아 있어요. · 모델 ' + (data.model || '-');
    reviewEl.appendChild(meta);
  }

  // 하루 정리하기 실행
  async function runReview() {
    if (busy) return;

    const records = getTodayRecords();
    if (records.length === 0) {
      showState('error', '오늘은 남긴 기록이 없어요.');
      return;
    }

    busy = true;
    reviewBtn.disabled = true;
    showState('loading', '하루를 정리하고 있어요...');

    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, TIMEOUT_MS);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (accessCode) headers['X-Access-Code'] = accessCode;

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ date: dateKeyOf(new Date()), records: records }),
        signal: controller.signal
      });

      let data = null;
      try {
        data = await res.json();
      } catch (e) {
        data = null;
      }

      if (!res.ok) {
        const serverMessage = (data && typeof data.message === 'string') ? data.message : '';

        // 접근 코드가 없거나 틀렸을 때: 코드를 지우고 입력칸을 다시 보여 줌
        if (res.status === 401) {
          const wrong = !!(data && data.error === 'access_denied');
          accessCode = '';
          showAccessPrompt(serverMessage || '접근 코드가 필요해요. 코드를 입력해 주세요.', wrong);
          return;
        }

        const httpError = new Error('http');
        httpError.status = res.status;
        httpError.serverMessage = serverMessage;
        throw httpError;
      }
      if (!data || typeof data !== 'object') {
        throw new Error('bad_response');
      }
      renderResult(data, records);
    } catch (err) {
      showState('error', errorMessage(err));
    } finally {
      clearTimeout(timer);
      busy = false;
      reviewBtn.disabled = false;
    }
  }

  // 하루 정리하기 버튼
  reviewBtn.addEventListener('click', runReview);
})();