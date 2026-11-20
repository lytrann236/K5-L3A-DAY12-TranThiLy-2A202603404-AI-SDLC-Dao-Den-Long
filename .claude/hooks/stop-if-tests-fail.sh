#!/bin/bash
# Hook Stop: chặn agent kết thúc khi test đang đỏ.
# Mã thoát 2 = chặn, nội dung stderr được gửi lại cho agent để sửa.
cd "$CLAUDE_PROJECT_DIR" || exit 0

# Chưa dựng dự án thì bỏ qua.
[ -f package.json ] && [ -d node_modules ] || exit 0

LOG="$(mktemp)"
if ! npm test --silent >"$LOG" 2>&1; then
  echo "Test đang ĐỎ — chưa được kết thúc. Sửa code (không sửa test cho luôn đạt) rồi chạy lại 'npm test'." >&2
  tail -n 40 "$LOG" >&2
  rm -f "$LOG"
  exit 2
fi
rm -f "$LOG"
exit 0
