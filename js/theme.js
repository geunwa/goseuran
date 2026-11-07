(function () {
  'use strict';

  // 고른 테마를 기억하는 키. 값은 'light' 또는 'dark'. 없으면 기기 설정을 따름
  const THEME_KEY = 'goseuran.theme';

  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  const root = document.documentElement;
  const media = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  // 지금 화면이 어두운지 밝은지 계산 (직접 고른 값 → 기기 설정 순서)
  function currentTheme() {
    const chosen = root.getAttribute('data-theme');
    if (chosen === 'light' || chosen === 'dark') return chosen;
    return media && media.matches ? 'dark' : 'light';
  }

  // 버튼 모양과 화면 읽기 도구용 상태를 갱신
  function render() {
    const dark = currentTheme() === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
    btn.title = dark ? '밝은 화면으로 바꾸기' : '어두운 화면으로 바꾸기';
  }

  btn.addEventListener('click', function () {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) { /* 저장하지 못해도 이번 화면에는 적용됨 */ }
    render();
  });

  // 직접 고르지 않았을 때 기기 설정이 바뀌면 버튼 모양도 맞춤
  if (media) {
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', render);
    } else if (typeof media.addListener === 'function') {
      media.addListener(render);
    }
  }

  render();
})();