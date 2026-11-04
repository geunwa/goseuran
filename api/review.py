from http.server import BaseHTTPRequestHandler
import json

# 설정값
MAX_BODY_BYTES = 20000   # 받을 수 있는 최대 크기
MAX_RECORDS = 30         # 한 번에 받을 수 있는 기록 수
MAX_TEXT_LEN = 100       # 기록 한 개의 최대 글자 수
CATEGORIES = ["감사한 일", "잘한 일", "아쉬운 일", "배운 것", "앞으로 할 일", "기타"]


class handler(BaseHTTPRequestHandler):

    def _send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _error(self, status, code, message):
        self._send_json(status, {"error": code, "message": message})

    # 주소를 직접 열어 보는 확인용
    def do_GET(self):
        self._send_json(200, {
            "ok": True,
            "message": "고스란 함수가 동작 중이에요.",
            "method": "GET",
        })

    # 오늘 기록을 받아서 테스트 응답을 돌려줌 (AI는 STEP 6에서 연결)
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        if length <= 0:
            self._error(400, "empty_body", "보낸 내용이 비어 있어요.")
            return
        if length > MAX_BODY_BYTES:
            self._error(413, "too_large", "보낸 내용이 너무 길어요.")
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._error(400, "bad_json", "보낸 내용을 읽을 수 없어요.")
            return

        records = payload.get("records") if isinstance(payload, dict) else None
        if not isinstance(records, list) or len(records) == 0:
            self._error(400, "no_records", "정리할 기록이 없어요.")
            return
        if len(records) > MAX_RECORDS:
            self._error(400, "too_many", "기록이 너무 많아요. 하루 " + str(MAX_RECORDS) + "개까지 가능해요.")
            return

        clean = []
        for r in records:
            if not isinstance(r, dict):
                self._error(400, "bad_record", "기록 형식이 맞지 않아요.")
                return
            rid = r.get("id")
            text = r.get("text")
            if not isinstance(rid, str) or not isinstance(text, str):
                self._error(400, "bad_record", "기록 형식이 맞지 않아요.")
                return
            text = text.strip()
            if len(text) == 0 or len(text) > MAX_TEXT_LEN:
                self._error(400, "bad_text", "기록은 1자 이상 " + str(MAX_TEXT_LEN) + "자 이하여야 해요.")
                return
            clean.append({"id": rid, "text": text})

        self._send_json(200, {
            "status": "dummy",
            "count": len(clean),
            "essay": "테스트 응답이에요. 오늘 기록 " + str(len(clean)) + "개를 잘 받았어요. 실제 에세이는 AI를 연결한 뒤에 만들어져요.",
            "items": [{"id": c["id"], "category": CATEGORIES[-1]} for c in clean],
        })