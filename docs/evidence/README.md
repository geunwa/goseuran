# 증빙 스크린샷

고스란(https://goseuran.vercel.app)의 동작과 개발 과정을 보여 주는 화면 모음입니다. 촬영일은 2026년 11월 7일입니다.

- 접근 코드, API 키, 환경 변수 값은 어떤 화면에도 포함하지 않았습니다.
- 화면의 기록은 시연용 예시 기록(화면에 "예시" 표시)과 테스트용 문장입니다.

## 1. 데스크톱 화면

| 파일 | 보여 주는 것 | 증명하는 요건 |
|---|---|---|
| [01_desktop_home.png](01_desktop_home.png) | 처음 연 첫 화면: 메뉴, 입력창, 글자 수, 빈 타임라인 | 배포 URL 동작, 입력 UI |
| [02a_desktop_timeline.png](02a_desktop_timeline.png) | 예시 기록 6개, 저장 시각 자동 기록, 지난 기록 월 선택기 | 기록 저장, 저장 시각, 지난 기록 |
| [02b_desktop_past.png](02b_desktop_past.png) | 지난 기록의 날짜별 목록 | 지난 기록 보기 |
| [03_desktop_ai_result.png](03_desktop_ai_result.png) | 하루 정리하기 결과: 에세이, 분류 6가지, 정돈 문장, 모델 표시 | AI 기능(입력 → 결과 출력) |
| [04a_long_input_count.png](04a_long_input_count.png) | 221자 입력과 글자 수 `221/300` | 테스트: 200자 이상 입력 |
| [04b_long_input_ai.png](04b_long_input_ai.png) | 221자 기록을 저장하고 AI 결과를 받은 화면 | 테스트: 200자 이상 입력 |
| [05_desktop_dark.png](05_desktop_dark.png) | 다크 모드 화면과 `☀` 전환 버튼 | 보너스: 다크 모드 |

## 2. 모바일 화면(iPhone Safari)

| 파일 | 보여 주는 것 | 증명하는 요건 |
|---|---|---|
| [06_mobile_home.png](06_mobile_home.png) | 모바일 첫 화면 | 반응형 |
| [07_mobile_ai_result.png](07_mobile_ai_result.png) | 모바일에서의 AI 결과 | 반응형, AI 기능 |

## 3. 실패 처리

| 파일 | 보여 주는 것 | 증명하는 요건 |
|---|---|---|
| [08_error_empty.png](08_error_empty.png) | 빈 입력: "내용을 입력해 주세요." | 테스트: 빈 입력 |
| [09_error_too_long.png](09_error_too_long.png) | 442자 입력: 300자 초과 안내 | 입력 제한과 안내 |
| [10_error_network.png](10_error_network.png) | 연결 실패 안내 | 테스트: 연결 실패 |

## 4. 배포와 AI 사용 과정

| 파일 | 보여 주는 것 | 증명하는 요건 |
|---|---|---|
| [11_vercel_deploy.png](11_vercel_deploy.png) | Vercel 프로덕션 배포 `Ready`, `main` 브랜치, 최신 커밋 | 배포 |
| [12_ai_chat_review.png](12_ai_chat_review.png) | AI 결과를 검증하고 규칙과 비교한 대화 | AI 코딩 도구 사용 과정 |
| [13_ai_chat_debug.png](13_ai_chat_debug.png) | 병합 충돌의 원인을 파악하고 해결한 대화 | AI 코딩 도구 사용 과정, 오류 원인 파악 |

## 참고

- AI 사용 과정의 정리는 [../ai-usage-log.md](../ai-usage-log.md)에 있습니다.
- 접근 코드를 입력하는 화면과 환경 변수 화면은 보안을 위해 찍지 않았습니다.