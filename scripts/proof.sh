#!/bin/bash
# Sinh bằng chứng cho một phase: scripts/proof.sh <N>
#  - Chạy mọi scenarios/*.json (kèm inputs/<tên>.json nếu có) theo scenarios/manifest.txt
#  - Ghi docs/proof/phase-N/<tên>.jsonl (hoặc <tên>.stderr.txt khi kỳ vọng mã thoát 2)
#  - Chạy 2 lần cùng seed và diff để kiểm tra tính tất định
#  - Kiểm tra kỳ vọng, in bảng tóm tắt, sinh docs/proof/phase-N/README.md
# Biến môi trường: SKIP_TEST=1 bỏ qua bước chạy `npm test`.
# KHÔNG sửa tay các file trong docs/proof/.
N="${1:?dùng: scripts/proof.sh <N>}"
cd "$(dirname "$0")/.." || exit 1
# PROOF_OUT=<thư mục> để chạy thử ra chỗ khác (vd. /tmp), không đụng docs/proof/.
OUT="${PROOF_OUT:-docs/proof/phase-$N}"
MANIFEST="scenarios/manifest.txt"
CLI=(npx tsx src/headless/cli.ts)
mkdir -p "$OUT"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

rm -f "$OUT"/*.jsonl "$OUT"/*.stderr.txt "$OUT"/npm-test.txt

# --- 1. Unit test ---
UNIT="Chưa chạy (SKIP_TEST=1)"
if [ -z "${SKIP_TEST:-}" ]; then
  if npm test >"$TMP/npm-test.txt" 2>&1; then UNIT="ĐẠT"; else UNIT="KHÔNG ĐẠT"; fi
  # Bỏ dòng thời gian để file ổn định giữa các lần chạy.
  grep -vE '^\s*(Start at|Duration)' "$TMP/npm-test.txt" > "$OUT/npm-test.txt"
fi

# --- 2. Scenario ---
FAILS=0
ROWS=""
SUMMARY=""
check_exp() { # $1=file $2=kỳ vọng ; in ra "ok" hoặc lý do
  local f="$1" e="$2" n
  if [[ "$e" =~ ^#([0-9]+):(.*)$ ]]; then
    n=$(grep -cF -- "${BASH_REMATCH[2]}" "$f")
    [ "$n" = "${BASH_REMATCH[1]}" ] && echo ok || echo "cần ${BASH_REMATCH[1]} dòng chứa ${BASH_REMATCH[2]}, thực tế $n"
  else
    grep -qF -- "$e" "$f" && echo ok || echo "thiếu: $e"
  fi
}

SEEN=" "
while IFS='|' read -r name ac seed night ticks every want desc exps; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  SEEN="$SEEN$name "
  sc="scenarios/$name.json"
  args=(--seed "$seed" --night "$night" --ticks "$ticks" --snapshot-every "$every")
  [ -f "$sc" ] && args+=(--scenario "$sc")
  [ -f "inputs/$name.json" ] && args+=(--inputs "inputs/$name.json")
  evid="$name.jsonl"; [ "$want" != 0 ] && evid="$name.stderr.txt"

  "${CLI[@]}" "${args[@]}" --out "$TMP/a.jsonl" 2>"$TMP/a.err"; ca=$?
  "${CLI[@]}" "${args[@]}" --out "$TMP/b.jsonl" 2>"$TMP/b.err"; cb=$?

  problems=()
  [ "$ca" = "$want" ] || problems+=("mã thoát $ca ≠ $want")
  [ "$ca" = "$cb" ] || problems+=("mã thoát hai lần khác nhau")
  if [ "$want" = 0 ]; then
    cp "$TMP/a.jsonl" "$OUT/$name.jsonl"
    if diff -q "$TMP/a.jsonl" "$TMP/b.jsonl" >/dev/null; then det="ĐẠT"; else det="KHÔNG ĐẠT"; problems+=("không tất định")
    fi
    tail -1 "$TMP/a.jsonl" | grep -q '^{"type":"end"' || problems+=("dòng cuối không phải end")
    if [ -n "$exps" ]; then
      IFS=$'\n' read -r -d '' -a E <<<"${exps//@@/$'\n'}"
      for e in "${E[@]}"; do r=$(check_exp "$OUT/$name.jsonl" "$e"); [ "$r" = ok ] || problems+=("$r"); done
    fi
    if [[ "$name" == ac14* ]]; then
      args2=("${args[@]}"); args2[1]=$((seed+1))
      "${CLI[@]}" "${args2[@]}" --out "$TMP/c.jsonl" 2>/dev/null
      if diff -q "$TMP/a.jsonl" "$TMP/c.jsonl" >/dev/null; then problems+=("seed khác nhưng output giống hệt"); else det="$det; seed khác → khác"; fi
    fi
  else
    cp "$TMP/a.err" "$OUT/$name.stderr.txt"
    [ -s "$TMP/a.err" ] || problems+=("không có thông báo lỗi ở stderr")
    [ -e "$TMP/a.jsonl" ] && [ "$want" = 2 ] && problems+=("đã ghi output dù lỗi định dạng")
    det="n/a"
  fi

  if [ ${#problems[@]} -eq 0 ]; then res="ĐẠT"; else res="KHÔNG ĐẠT"; FAILS=$((FAILS+1)); fi
  rm -f "$TMP"/a.* "$TMP"/b.* "$TMP"/c.*
  note=""; [ ${#problems[@]} -gt 0 ] && note=" — $(IFS=';'; echo "${problems[*]}")"
  ROWS+="| $ac | Đêm $night — scenario \`scenarios/$name.json\`$( [ -f "inputs/$name.json" ] && echo " + \`inputs/$name.json\`"): $desc. Tất định (chạy 2 lần, diff): $det | [\`$evid\`]($evid) | $res$note |"$'\n'
  SUMMARY+="$(printf '%-28s N%s %-5s %-10s %s' "$name" "$night" "$ac" "$res" "$(echo "$exps" | sed 's/@@/ ; /g' | cut -c1-70)")"$'\n'
  [ ${#problems[@]} -gt 0 ] && SUMMARY+="    ↳ ${problems[*]}"$'\n'
done < "$MANIFEST"

for f in scenarios/*.json; do
  b="$(basename "$f" .json)"
  [[ "$SEEN" == *" $b "* ]] || { SUMMARY+="CẢNH BÁO: $f không có trong manifest"$'\n'; FAILS=$((FAILS+1)); }
done

# --- 2b. Hiệu năng (Phase 2): 21.600 tick mỗi Đêm, random bật, ≤ 30 s (AC2-59) ---
PERF="n/a"
if [ "$N" = 2 ]; then
  PERF="ĐẠT"
  {
    echo "# AC2-59: --seed 1 --ticks 21600, random bật; giới hạn 30 s mỗi Đêm. Sinh bởi scripts/proof.sh $N."
    for nt in 1 2 3; do
      t0=$(date +%s.%N 2>/dev/null || date +%s)
      "${CLI[@]}" --seed 1 --night "$nt" --ticks 21600 --out "$TMP/perf-$nt.jsonl" 2>/dev/null; pc=$?
      t1=$(date +%s.%N 2>/dev/null || date +%s)
      el=$(awk -v a="$t0" -v b="$t1" 'BEGIN{printf "%.2f", b-a}')
      ok=$(awk -v e="$el" 'BEGIN{print (e<=30)?"ĐẠT":"KHÔNG ĐẠT"}')
      [ "$pc" = 0 ] || ok="KHÔNG ĐẠT (mã thoát $pc)"
      echo "Đêm $nt: ${el} s — $ok (mã thoát $pc, $(wc -l <"$TMP/perf-$nt.jsonl" | tr -d ' ') dòng output)"
    done
  } > "$OUT/perf.txt"
  grep -q "KHÔNG ĐẠT" "$OUT/perf.txt" && { PERF="KHÔNG ĐẠT"; FAILS=$((FAILS+1)); }
fi

# --- 3. README ---
{
  echo "# Bằng chứng Phase $N"
  echo
  echo "File này và các file cùng thư mục được SINH bởi \`scripts/proof.sh $N\` — không sửa tay."
  echo "Tiêu chí lấy từ \`docs/notes/phase-$N.md\`, kỳ vọng nằm ở \`scenarios/manifest.txt\`."
  echo
  echo "| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |"
  echo "|---|---|---|---|"
  printf '%s' "$ROWS"
  if [ "$N" = 2 ]; then
    UT="[\`npm-test.txt\`](npm-test.txt)"
    echo "| AC2-02, 18, 26, 50, 61 và phần Unit của mọi AC ghi U | Unit test Vitest (\`tests/\`) kiểm tra giá trị cụ thể; AC2-61 = test Phase 1 đã sửa theo mục 2 vẫn đạt | $UT | $UNIT |"
    echo "| AC2-59 | \`scripts/proof.sh 2\` đo 21.600 tick cho từng Đêm (seed 1, random bật), giới hạn 30 s | [\`perf.txt\`](perf.txt) | $PERF |"
    echo "| AC2-44 | Phần sáng tạo thêm tắt khi headless | — | Không áp dụng: chưa có phần sáng tạo thêm nào |"
    echo "| AC2-37 | Chơi thật + ảnh: màn bắt đầu 3 nút Đêm, nút \"Đêm kế tiếp\" khi thắng | [\`screenshots/\`](screenshots) | Chưa đạt: mới có menu chọn Đêm và Đêm kế tiếp; chưa có màn giới thiệu Đêm / lời Ông Đăng / màn Bình Minh + tổng điểm |"
    echo "| AC2-38 | Chơi thật + ảnh: Esc/P tạm dừng (sim dừng hoàn toàn, có unit test pause) | [\`screenshots/05-paused.png\`](screenshots/05-paused.png) | Chưa đạt: có Tiếp tục / Chơi lại Đêm / Về menu, chưa có mục Cài đặt |"
    echo "| AC2-28 (phần UI), AC2-39, AC2-40, AC2-42, AC2-43 | Chơi thật | — | Chưa đạt: lá bay báo gió, cài đặt âm lượng / độ nhạy chuột, âm thanh, bảng màu chuẩn, ánh sáng môi trường theo công thức — Chưa làm (hết thời gian) |"
    echo "| AC2-41 | Chơi thật + ảnh HUD | [\`screenshots/\`](screenshots) | Chưa đạt: HUD có lửa, đom đóm, đèn, giờ, điểm, hồi Lướt / Tỏa Sáng, Bùa Gió; chưa theo bố cục ticket, chưa có mũi tên tới đèn, chưa đỏ + nhấp nháy ≤ 30 s |"
    echo "| AC2-62 | Đo FPS trong trình duyệt | — | Chưa đạt: chưa đo |"
    echo "| Giao diện Đêm 2, 3 (hình học) | Ảnh \`npm run shot\` | [\`screenshots/09-night2-overview.png\`](screenshots/09-night2-overview.png), [\`screenshots/10-night3-overview.png\`](screenshots/10-night3-overview.png) | Có (khối đơn giản: 2 đảo + cầu + bục; tầng + dốc + tháp) |"
  else
    echo "| AC1–AC16 | Unit test Vitest (\`tests/\`) kiểm tra giá trị cụ thể | [\`npm-test.txt\`](npm-test.txt) | $UNIT |"
    echo "| AC17 | Chơi thật + ảnh/video HUD | — | Chưa đạt: giao diện 3D chưa làm (ngoài phạm vi Việc 1–2) |"
  fi
} > "$OUT/README.md"

echo "$SUMMARY"
echo "Unit test: $UNIT"
echo "Scenario không đạt: $FAILS"
[ "$FAILS" = 0 ] && [ "$UNIT" != "KHÔNG ĐẠT" ]
