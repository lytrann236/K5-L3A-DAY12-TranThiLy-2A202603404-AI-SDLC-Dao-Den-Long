# Bằng chứng Phase 1

File này và các file cùng thư mục được SINH bởi `scripts/proof.sh 1` — không sửa tay.
Tiêu chí lấy từ `docs/notes/phase-1.md`, kỳ vọng nằm ở `scenarios/manifest.txt`.

| Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả |
|---|---|---|---|
| AC1 | Scenario `scenarios/ac01-move-z.json` + `inputs/ac01-move-z.json`: move [0,1], yaw 0, 60 tick → player (0,0,6). Tất định (chạy 2 lần, diff): ĐẠT | [`ac01-move-z.jsonl`](ac01-move-z.jsonl) | ĐẠT |
| AC2 | Scenario `scenarios/ac02-move-yaw90.json` + `inputs/ac02-move-yaw90.json`: move [0,1], yaw 90, 60 tick → player (6,0,0). Tất định (chạy 2 lần, diff): ĐẠT | [`ac02-move-yaw90.jsonl`](ac02-move-yaw90.jsonl) | ĐẠT |
| AC3 | Scenario `scenarios/ac03-move-normalized.json` + `inputs/ac03-move-normalized.json`: move [1,1] chuẩn hóa: 60 tick đi đúng 6 m (4.243, 4.243). Tất định (chạy 2 lần, diff): ĐẠT | [`ac03-move-normalized.jsonl`](ac03-move-normalized.jsonl) | ĐẠT |
| AC4 | Scenario `scenarios/ac04-pickup-mote.json`: Đom đóm (0,0,1) → mote_picked tick 1, carried 1, +10 điểm. Tất định (chạy 2 lần, diff): ĐẠT | [`ac04-pickup-mote.jsonl`](ac04-pickup-mote.jsonl) | ĐẠT |
| AC5 | Scenario `scenarios/ac05-bag-full.json`: Túi đầy (10) thì không nhặt thêm. Tất định (chạy 2 lần, diff): ĐẠT | [`ac05-bag-full.jsonl`](ac05-bag-full.jsonl) | ĐẠT |
| AC6 | Scenario `scenarios/ac06-deposit-lit.json` + `inputs/ac06-deposit-lit.json`: carried 5 cạnh L1, interact → deposit 5 + lantern_lit + 100 điểm. Tất định (chạy 2 lần, diff): ĐẠT | [`ac06-deposit-lit.jsonl`](ac06-deposit-lit.jsonl) | ĐẠT |
| AC7 | Scenario `scenarios/ac07-win-all-lit.json` + `inputs/ac07-win-all-lit.json`: Thắp đủ 5 đèn → game_over won all_lit + thưởng thời gian/flames (848 điểm). Tất định (chạy 2 lần, diff): ĐẠT | [`ac07-win-all-lit.jsonl`](ac07-win-all-lit.jsonl) | ĐẠT |
| AC8 | Scenario `scenarios/ac08-pulse-stun.json` + `inputs/ac08-pulse-stun.json`: Pulse carried ≥ 2: shade trong 6 m stunned, đẩy 4 m (3→7), carried −2, +20. Tất định (chạy 2 lần, diff): ĐẠT | [`ac08-pulse-stun.jsonl`](ac08-pulse-stun.jsonl) | ĐẠT |
| AC9 | Scenario `scenarios/ac09a-pulse-low-carried.json` + `inputs/ac09a-pulse-low-carried.json`: Pulse khi carried < 2 → không có sự kiện. Tất định (chạy 2 lần, diff): ĐẠT | [`ac09a-pulse-low-carried.jsonl`](ac09a-pulse-low-carried.jsonl) | ĐẠT |
| AC9 | Scenario `scenarios/ac09b-pulse-cooldown.json` + `inputs/ac09b-pulse-cooldown.json`: Pulse khi đang cooldown (tick 2, 89) → chỉ có 1 sự kiện pulse. Tất định (chạy 2 lần, diff): ĐẠT | [`ac09b-pulse-cooldown.jsonl`](ac09b-pulse-cooldown.jsonl) | ĐẠT |
| AC10 | Scenario `scenarios/ac10-shade-hit.json`: Shade chạm: player_hit, flames −1, rơi floor(5/2)=2, bất tử 2 s (trúng lại ở tick 121). Tất định (chạy 2 lần, diff): ĐẠT | [`ac10-shade-hit.jsonl`](ac10-shade-hit.jsonl) | ĐẠT |
| AC11 | Scenario `scenarios/ac11-lose-no-flames.json`: flames về 0 → game_over lost no_flames. Tất định (chạy 2 lần, diff): ĐẠT | [`ac11-lose-no-flames.jsonl`](ac11-lose-no-flames.jsonl) | ĐẠT |
| AC12 | Scenario `scenarios/ac12-lose-dawn.json`: Hết giờ (time_left_s 0.5) → game_over lost dawn ở tick 30. Tất định (chạy 2 lần, diff): ĐẠT | [`ac12-lose-dawn.jsonl`](ac12-lose-dawn.jsonl) | ĐẠT |
| AC13 | Scenario `scenarios/ac13-safe-zone.json`: Shade không vào được 5 m quanh đèn đã thắp (dừng ở (0,1,5), không chạm người chơi). Tất định (chạy 2 lần, diff): ĐẠT | [`ac13-safe-zone.jsonl`](ac13-safe-zone.jsonl) | ĐẠT |
| AC14 | Scenario `scenarios/ac14-random-determinism.json` + `inputs/ac14-random-determinism.json`: Cùng seed + input (có random bật) → 2 lần chạy giống hệt; seed khác → khác. Tất định (chạy 2 lần, diff): ĐẠT; seed khác → khác | [`ac14-random-determinism.jsonl`](ac14-random-determinism.jsonl) | ĐẠT |
| AC14 | Scenario `scenarios/ac14b-spawn-determinism.json`: 6000 tick, L1 lit tại (0,0,0) giữ người chơi an toàn: shade_spawned S4 ở tick 2700 và S5 ở tick 5400, tất định theo seed. Tất định (chạy 2 lần, diff): ĐẠT; seed khác → khác | [`ac14b-spawn-determinism.jsonl`](ac14b-spawn-determinism.jsonl) | ĐẠT |
| AC15 | Scenario `scenarios/ac15a-bad-tick-order.json` + `inputs/ac15a-bad-tick-order.json`: inputs có tick không tăng nghiêm ngặt → mã thoát 2. Tất định (chạy 2 lần, diff): n/a | [`ac15a-bad-tick-order.stderr.txt`](ac15a-bad-tick-order.stderr.txt) | ĐẠT |
| AC15 | Scenario `scenarios/ac15b-bad-json.json` + `inputs/ac15b-bad-json.json`: inputs JSON hỏng → mã thoát 2. Tất định (chạy 2 lần, diff): n/a | [`ac15b-bad-json.stderr.txt`](ac15b-bad-json.stderr.txt) | ĐẠT |
| AC16 | Scenario `scenarios/ac16-end-line.json`: Dòng cuối là end, mã thoát 0, snapshot tick 0/10/20. Tất định (chạy 2 lần, diff): ĐẠT | [`ac16-end-line.jsonl`](ac16-end-line.jsonl) | ĐẠT |
| AC1–AC16 | Unit test Vitest (`tests/`) kiểm tra giá trị cụ thể | [`npm-test.txt`](npm-test.txt) | ĐẠT |
| AC17 | Chơi thật + ảnh/video HUD | — | Chưa đạt: giao diện 3D chưa làm (ngoài phạm vi Việc 1–2) |
