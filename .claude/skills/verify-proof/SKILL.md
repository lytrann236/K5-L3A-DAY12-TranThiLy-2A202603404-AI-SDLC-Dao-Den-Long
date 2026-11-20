---
name: verify-proof
description: Chạy các scenario headless (Đêm 1, 2, 3 — Test Contract v1.1) và lưu bằng chứng của một phase vào docs/proof/phase-N, kèm đo hiệu năng 21.600 tick. Dùng khi cần kiểm chứng hành vi game hoặc cập nhật bằng chứng trước khi gắn tag.
---

# Kiểm chứng và lưu bằng chứng

Chỉ agent chính chạy skill này. Subagent `reviewer` không chạy `scripts/proof.sh` và không ghi vào `docs/proof/`. Khi tạo bằng chứng thật thì không đặt `SKIP_TEST`.

1. **Contract**: kiểm tra `game.contract.json` có `contract_version` = "1.1" và tuning khớp số chuẩn trong `docs/notes/phase-2.md` mục 1.1. Lệnh soát: `node -e "const c=require('./game.contract.json');console.log(c.contract_version,JSON.stringify(c.tuning))"`. Sai thì dừng lại và báo.
2. **Test**: `npm test 2>&1 | tee docs/proof/phase-N/npm-test.txt` và `npx tsc --noEmit`.
3. **Scenario**: chạy `scripts/proof.sh N`. Nếu script chưa hỗ trợ phase này thì sửa script. Script phải:
   - Đọc `scenarios/manifest.txt`. Mỗi dòng ghi rõ `--night` (1, 2 hoặc 3) và AC (`AC2-xx` cho Phase 2). Với mỗi `scenarios/*.json`, chạy headless (kèm file `inputs/` tương ứng nếu có) và ghi `docs/proof/phase-N/<tên>.jsonl`.
   - Chạy cùng seed hai lần rồi `diff` để kiểm tính tất định, ghi ĐẠT / KHÔNG ĐẠT.
   - Kiểm định dạng v1.1 trên mọi snapshot:
     - Gốc có `night` và `wind {active, dir_deg}`.
     - `player` có `vel`, `grounded`, `invuln`, `dash_cd_s`, `pulse_cd_s`, `charm_s`.
     - Có các mảng `motes` (`id`, `pos`, `kind`, `ttl_s`), `drifters` (`id`, `pos`, `state`, `stolen`), `charms` (`id`, `available`, `respawn_s`).
     - Trạng thái Bóng Mực chỉ thuộc `spawning | wander | chase | recoil | stunned`.
     - Dòng thứ 2 là `night_start` tick 0. Dòng cuối là `end`.
   - Kiểm thứ tự sự kiện trong cùng một tick theo thứ tự xử lý mới (phase-2.md mục 4.3). Ví dụ: `drifter_steal` đứng trước `player_hit`; `game_over` đứng sau mọi sự kiện khác của tick đó.
   - Có ít nhất 1 scenario cho mỗi tính năng mới: lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, bục nhảy, gió mạnh, tạm dừng, Đêm 2, Đêm 3.
   - In bảng tóm tắt: scenario, Đêm, AC, sự kiện mong đợi, có xuất hiện không.
4. **Hiệu năng**: với N = 1, 2, 3, chạy `time npx tsx src/headless/cli.ts --seed 1 --night N --ticks 21600 --out /tmp/perf-N.jsonl` (random bật, không scenario). Ghi thời gian vào `docs/proof/phase-N/perf.txt`. Mỗi Đêm phải ≤ 30 s, quá thì ghi KHÔNG ĐẠT (AC2-59).
5. **README**: cập nhật `docs/proof/phase-N/README.md` thành bảng `Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả`. ID tiêu chí lấy từ `docs/notes/phase-N.md` (AC2-xx). Phải có cả kết quả regression của các case Phase 1 đã chỉnh theo số chuẩn (phase-2.md mục 2).
6. Chỗ nào chưa đạt thì ghi "Chưa đạt" kèm lý do. Tuyệt đối không sửa tay file output.
