# Đảo Đèn Lồng — hướng dẫn cho agent

Game 3D (TypeScript + Three.js + Vite). Bài lab chấm tự động qua chế độ headless theo Test Contract. **Đang ở Phase 2** (Ticket-02 "Ba hòn đảo", Test Contract **v1.1**, 3 Đêm).

## Lệnh
- Cài: `npm ci`
- Chơi: `npm run dev`
- Test: `npm test` (Vitest)
- Headless: `npx tsx src/headless/cli.ts --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl [--scenario f.json] [--inputs f.json] [--snapshot-every 10]`
- Hiệu năng (bắt buộc ≤ 30 s mỗi Đêm): `time npx tsx src/headless/cli.ts --seed 1 --night N --ticks 21600 --out /tmp/perf-N.jsonl` với N = 1, 2, 3
- Kiểm tra kiểu: `npx tsc --noEmit`
- Chụp ảnh giao diện: `npm run shot [-- <thư mục>]` (mặc định `/tmp/shots`; Playwright + Chromium, chờ theo thời gian game)

## Cấu trúc
- `src/sim/` — logic game THUẦN: không import three, không DOM, không `Math.random`, không `Date`. Chạy 60 tick/giây cố định.
- `src/headless/cli.ts` — đọc tham số, chạy sim, ghi JSONL.
- `src/render/` + `src/main.ts` — Three.js, bàn phím, HUD. Chỉ đọc state của sim và gửi input.
- `tests/` — Vitest. `scenarios/`, `inputs/` — file test headless. `docs/proof/phase-N/` — bằng chứng.

## Quy tắc bắt buộc
- Tuning chỉ đọc từ `game.contract.json` (không hard-code số trùng lặp).
- Yêu cầu gốc: `docs/notes/ticket-02.md` — BẮT BUỘC chính xác (số chuẩn, bản đồ chuẩn, Test Contract v1.1). Phase 1 (`docs/notes/phase-1.md`, `docs/notes/test-contract-v1.md`) chỉ để tham chiếu và regression.
- Đặc tả chi tiết, giả định và tiêu chí AC2-xx: `docs/notes/phase-2.md`. Làm đúng theo đó; nếu thấy mơ hồ thì HỎI, không tự bịa yêu cầu. Giả định mới chốt phải ghi vào phase-2.md.
- `game.contract.json` là `contract_version` "1.1": `player_speed` 6, `lantern_cost` 10, `pulse_cost` 3, `pulse_radius` 5, `pulse_cooldown_s` 3, `safe_radius` 6, `fall_enabled` true, `dash_*`, `night1/2/3_duration_s`, `score.per_mote` = mỗi đom đóm NẠP. Hằng số không có trong contract nằm ở `src/sim/constants.ts`.
- Thứ tự xử lý một tick (bắt buộc, chi tiết ở phase-2.md mục 4.3): 1 input + pause → 2 giảm bộ đếm → 3 di chuyển Mây + kiểm tra rơi → 4 nhặt đom đóm/bùa → 5 đèn → 6 vùng an toàn → 7 Tỏa Sáng → 8 Bóng Mực + Gió Lạc di chuyển → 9 chạm (Gió Lạc cướp trước, Bóng Mực theo id) → 10 sinh theo lịch → 11 thắng/thua → 12 snapshot. Khi pause: `tick` tăng, `sim_tick` và mọi bộ đếm đứng yên.
- Trạng thái Bóng Mực chỉ dùng: `spawning`, `wander`, `chase`, `recoil`, `stunned`.
- Đầu ra headless phải đúng định dạng Test Contract (snapshot / event / end), tọa độ làm tròn 3 chữ số, tất định theo seed.
- Không viết test luôn đạt, không sửa tay file output trong `docs/proof/`. Bằng chứng phải sinh ra bằng script.
- Phần sáng tạo thêm phải tắt khi chạy headless.
- Commit nhỏ, mỗi commit một việc. Không commit `.env`, key, token.
- Subagent `reviewer` chỉ đọc: không chạy `scripts/proof.sh`, không ghi vào `docs/proof/`; mọi output thử nghiệm ghi vào `/tmp`. Chỉ agent chính chạy `scripts/proof.sh` (không đặt `SKIP_TEST` khi tạo bằng chứng thật).
- Sau mọi thay đổi giao diện, chạy `npm run shot` rồi Read ảnh để tự kiểm tra trước khi báo xong.
- Mỗi tính năng mới phải có ít nhất 1 scenario headless trong `scenarios/` + `scripts/proof.sh`.
- Trước khi báo xong: chạy `npm test` và `npx tsc --noEmit`; nếu đụng sim thì đo hiệu năng 21.600 tick cho cả 3 Đêm.
