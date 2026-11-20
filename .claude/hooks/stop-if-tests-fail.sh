#!/bin/bash
# Hook Stop: chặn agent kết thúc khi test đang đỏ.
# Mã thoát 2 = chặn, stderr được gửi lại cho agent để sửa.
# Chỉ chặn MỘT lần: nếu agent đã bị chặn rồi (stop_hook_active = true) thì cho dừng,
# tránh vòng lặp khi test đỏ là có chủ đích (ví dụ vừa đổi contract, chưa sửa code).
INPUT="$(cat)"
if echo "$INPUT" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR" || exit 0
[ -f package.json ] && [ -d node_modules ] || exit 0

LOG="$(mktemp)"
if ! npm test --silent >"$LOG" 2>&1; then
  echo "Test đang ĐỎ — chưa được kết thúc. Sửa code (không sửa test cho luôn đạt) rồi chạy lại 'npm test'. Nếu test đỏ là có chủ đích, giải thích rõ cho người dùng." >&2
  tail -n 40 "$LOG" >&2
  rm -f "$LOG"
  exit 2
fi
rm -f "$LOG"
exit 0