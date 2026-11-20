# Đảo Đèn Lồng — hướng dẫn cho agent

Game 3D (TypeScript + Three.js + Vite). Bài lab chấm tự động qua chế độ headless theo Test Contract.

## Lệnh
- Cài: `npm ci`
- Chơi: `npm run dev`
- Test: `npm test` (Vitest)
- Headless: `npx tsx src/headless/cli.ts --seed 1 --night 1 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json] [--snapshot-every 10]`
- Kiểm tra kiểu: `npx tsc --noEmit`

## Cấu trúc
- `src/sim/` — logic game THUẦN: không import three, không DOM, không `Math.random`, không `Date`. Chạy 60 tick/giây cố định.
- `src/headless/cli.ts` — đọc tham số, chạy sim, ghi JSONL.
- `src/render/` + `src/main.ts` — Three.js, bàn phím, HUD. Chỉ đọc state của sim và gửi input.
- `tests/` — Vitest. `scenarios/`, `inputs/` — file test headless. `docs/proof/phase-N/` — bằng chứng.

## Quy tắc bắt buộc
- Tuning chỉ đọc từ `game.contract.json` (không hard-code số trùng lặp).
- Đặc tả chi tiết và giả định: `docs/notes/phase-1.md`. Làm đúng theo đó; nếu thấy mơ hồ thì HỎI, không tự bịa yêu cầu.
- Đầu ra headless phải đúng định dạng Test Contract (snapshot / event / end), tọa độ làm tròn 3 chữ số, tất định theo seed.
- Không viết test luôn đạt, không sửa tay file output trong `docs/proof/`. Bằng chứng phải sinh ra bằng script.
- Phần sáng tạo thêm phải tắt khi chạy headless.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, key, token.
- Trước khi báo xong: chạy `npm test` và `npx tsc --noEmit`.
