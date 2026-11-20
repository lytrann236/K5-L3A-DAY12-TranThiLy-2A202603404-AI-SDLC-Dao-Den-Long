# Đảo Đèn Lồng

Video demo: (sẽ thêm ở Phase 4)

Game 3D góc nhìn thứ ba, chơi trên trình duyệt (TypeScript + Three.js + Vite). Đêm xuống trên một hòn đảo lơ lửng giữa biển mây: bạn nhặt đom đóm, mang tới nạp cho năm ngọn đèn lồng, tránh những Bóng Mực đang đuổi theo, và thắp sáng cả năm đèn trước khi trời sáng.

Logic game nằm trong `src/sim/` (thuần, tất định, 60 tick/giây) và có chế độ chạy không giao diện (headless) để kiểm thử tự động theo Test Contract v1.0.

## Cài đặt và chạy

```bash
npm ci
npm run dev
```

Mở địa chỉ Vite in ra (mặc định http://localhost:5173). Thêm `?seed=123` vào URL để cố định seed (không có thì seed ngẫu nhiên; seed hiện ở góc phải màn hình).

## Điều khiển

| Phím | Tác dụng |
|---|---|
| W A S D | Di chuyển theo hướng camera |
| ← / → hoặc kéo chuột trái | Xoay camera |
| Space | Nhảy (không né được Bóng Mực) |
| E | Nạp đom đóm vào đèn gần nhất chưa thắp |
| F | Tỏa sáng (choáng và đẩy lùi Bóng Mực) |
| R | Chơi lại (giữ seed nếu URL có `?seed=`, không thì seed mới) |

Phím được đọc theo `event.code` nên dùng được cả khi bật bộ gõ tiếng Việt.

## Luật chơi

Các con số dưới đây lấy từ `game.contract.json`.

- Bạn có **3 ngọn lửa** (máu) và mang tối đa **10** đom đóm. Một đêm dài **300 giây**.
- Đom đóm được nhặt tự động khi lại gần (trong **1.5 m**) nếu túi chưa đầy.
- Mỗi đèn cần **5** đom đóm. Đứng trong **3 m** của đèn chưa thắp rồi bấm **E** để nạp; đủ 5 thì đèn sáng. Có **5** đèn, thắp đủ cả năm là **thắng**.
- Bóng Mực đuổi bạn với tốc độ 3.5 m/s. Chạm vào (trong **1 m**) thì mất 1 ngọn lửa, rơi **50%** số đom đóm đang mang, và bất tử **2 giây**. Hết ngọn lửa là **thua**; hết 300 giây mà chưa thắp đủ đèn cũng **thua** (trời sáng).
- Bóng Mực sợ đèn đã thắp: không vào được vùng **5 m** quanh đèn đó.
- **F** tốn **2** đom đóm: mọi Bóng Mực trong **6 m** bị choáng **3 giây** và bị đẩy lùi **4 m**; hồi chiêu **1.5 giây**.

### Cách tính điểm

| Việc | Điểm |
|---|---|
| Mỗi đom đóm nhặt | +10 |
| Mỗi đèn thắp | +100 |
| Mỗi Bóng Mực bị choáng bởi tỏa sáng | +20 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +2 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Ví dụ: thắp đèn cuối cùng khi còn 299 giây và 3 ngọn lửa thì thưởng thắng là 2×299 + 50×3 = 748.

## Kiểm thử

```bash
npm test                 # unit test (Vitest)
npx tsc --noEmit         # kiểm kiểu (gồm cả tests/)
npm run build            # build bản chạy
```

### Chạy headless

```bash
npm run headless -- --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario scenarios/ac06-deposit-lit.json] [--inputs inputs/ac06-deposit-lit.json] [--snapshot-every 10]
```

Đầu ra là JSONL gồm `snapshot`, `event` và dòng `end` cuối cùng (xem `docs/notes/test-contract-v1.md`). File scenario/inputs sai định dạng thì thoát với mã 2. Cùng seed, scenario, inputs cho output giống hệt nhau.

### Sinh bằng chứng

```bash
scripts/proof.sh 1
```

Chạy mọi scenario trong `scenarios/` (kèm `inputs/` cùng tên), ghi output vào `docs/proof/phase-1/`, chạy mỗi case hai lần và `diff` để kiểm tra tính tất định, rồi sinh `docs/proof/phase-1/README.md`. Kỳ vọng của từng case nằm ở `scenarios/manifest.txt`. Không sửa tay các file trong `docs/proof/`.

## Bảng tuning (`game.contract.json`)

Tuning chỉ đọc từ file này; mã nguồn không lặp lại các con số.

| Khóa | Giá trị | Ý nghĩa |
|---|---|---|
| `player_speed` | 6 | Tốc độ người chơi (m/s) |
| `carry_capacity` | 10 | Số đom đóm mang được tối đa |
| `lantern_cost` | 5 | Số đom đóm cần để thắp một đèn |
| `lantern_count_night1` | 5 | Số đèn của Đêm 1 |
| `pickup_radius` | 1.5 | Bán kính tự nhặt đom đóm (m) |
| `interact_radius` | 3 | Bán kính nạp đèn (m) |
| `pulse_cost` | 2 | Đom đóm tiêu hao mỗi lần tỏa sáng |
| `pulse_radius` | 6 | Bán kính ảnh hưởng của tỏa sáng (m) |
| `night1_duration_s` | 300 | Thời lượng Đêm 1 (giây) |
| `flames` | 3 | Số ngọn lửa (máu) ban đầu |
| `invuln_s` | 2 | Thời gian bất tử sau khi bị trúng (giây) |
| `hit_drop_ratio` | 0.5 | Tỉ lệ đom đóm rơi khi bị trúng |
| `pulse_stun_s` | 3 | Thời gian Bóng Mực bị choáng (giây) |
| `pulse_push_m` | 4 | Khoảng đẩy lùi Bóng Mực (m) |
| `pulse_cooldown_s` | 1.5 | Hồi chiêu tỏa sáng (giây) |
| `safe_radius` | 5 | Bán kính vùng an toàn quanh đèn đã thắp (m) |
| `shade_speed` | 3.5 | Tốc độ Bóng Mực (m/s) |
| `shade_hit_radius` | 1 | Bán kính va chạm của Bóng Mực (m) |
| `fall_enabled` | false | Rơi khỏi đảo có bị phạt không (game này chặn ở mép đảo, không rơi) |
| `score.per_mote` | 10 | Điểm mỗi đom đóm |
| `score.per_lantern` | 100 | Điểm mỗi đèn thắp |
| `score.per_stun` | 20 | Điểm mỗi Bóng Mực bị choáng |
| `score.per_second_left` | 2 | Thưởng mỗi giây còn lại khi thắng |
| `score.per_flame_left` | 50 | Thưởng mỗi ngọn lửa còn lại khi thắng |

Các hằng số không có trong contract (bán kính đảo 40 m, vị trí đèn, số Bóng Mực…) nằm ở `src/sim/constants.ts` và được giải thích trong `docs/notes/phase-1.md`.

## Tài liệu

- [`docs/notes/phase-1.md`](docs/notes/phase-1.md) — đặc tả, giả định, tiêu chí nghiệm thu AC1–AC17
- [`docs/notes/test-contract-v1.md`](docs/notes/test-contract-v1.md) — Test Contract v1.0
- [`docs/notes/ai-log.md`](docs/notes/ai-log.md) — nhật ký dùng AI
- [`docs/proof/phase-1/`](docs/proof/phase-1/README.md) — bằng chứng Phase 1 (sinh bằng script)

## Sáng tạo của tôi

Hiện chưa có.

## Harness AI (Claude Code)

Dự án được làm cùng Claude Code, với bộ harness trong repo:

- [`CLAUDE.md`](CLAUDE.md) — hướng dẫn cho agent: lệnh, cấu trúc thư mục, quy tắc bắt buộc.
- Hook `Stop` (`.claude/settings.json` + `.claude/hooks/stop-if-tests-fail.sh`) — chặn agent kết thúc khi `npm test` còn đỏ.
- Skill `verify-proof` (`.claude/skills/verify-proof/SKILL.md`) — chạy scenario và lưu bằng chứng vào `docs/proof/phase-N/`.
- Subagent `reviewer` (`.claude/agents/reviewer.md`) — review độc lập, chỉ đọc, đối chiếu code với Test Contract.

## Giấy phép

MIT — xem [`LICENSE`](LICENSE). Ghi công và công cụ: [`CREDITS.md`](CREDITS.md).
