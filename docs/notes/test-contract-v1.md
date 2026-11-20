# Test Contract v1.0 (nguyên văn từ lab board, Phase 1 / PRD-0)

Mọi bài nộp phải có một chế độ chạy không giao diện (headless) để giảng viên chạy kiểm thử tự động, bất kể công nghệ.

## A. File game.contract.json ở gốc repo

```json
{
  "contract_version": "1.0",
  "team": "mssv-ho-ten",
  "build_cmd": "lệnh cài đặt/biên dịch",
  "run_cmd": "lệnh mở game có giao diện",
  "headless_cmd": "lệnh chạy headless (sẽ được nối thêm tham số)",
  "tuning": {
    "player_speed": 0, "carry_capacity": 0, "lantern_cost": 0, "lantern_count_night1": 5,
    "pickup_radius": 0, "interact_radius": 0, "pulse_cost": 0, "pulse_radius": 0,
    "night1_duration_s": 0, "flames": 0, "invuln_s": 0, "hit_drop_ratio": 0,
    "pulse_stun_s": 0, "pulse_push_m": 0, "pulse_cooldown_s": 0, "safe_radius": 0,
    "shade_speed": 0, "shade_hit_radius": 0, "fall_enabled": false,
    "score": { "per_mote": 0, "per_lantern": 0, "per_stun": 0, "per_second_left": 0, "per_flame_left": 0 }
  }
}
```

- tuning: điền đúng các số mà game đang dùng. Nếu game không có khái niệm đó, điền null (hoặc false) và giải thích trong README. Bài test Phase 1 sinh tình huống dựa trên các số này, khai sai sẽ làm trượt test.
- hit_drop_ratio: tỉ lệ đom đóm đánh rơi khi bị chạm (0 nếu không rơi). safe_radius: bán kính quanh đèn mà Bóng Mực không vào được. fall_enabled: rơi khỏi đảo có bị phạt hay không. score.*: điểm cho mỗi sự kiện.
- Lệnh phải chạy được trên macOS/Linux sau build_cmd. Docker được phép.

## B. Tham số headless

```
<headless_cmd> --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>]
               --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]
```

- Logic game chạy ở 60 tick/giây cố định (1 tick = 1/60 giây), không cần cửa sổ, không cần GPU, nhanh nhất có thể.
- Dừng khi chạy đủ --ticks hoặc khi game kết thúc (thắng/thua). Thoát với mã 0.
- Lỗi → mã thoát khác 0, thông báo lỗi ra stderr. File inputs/scenario sai định dạng → mã thoát 2.
- Đơn vị độ dài là mét; trục Y hướng lên; mặt đất đảo ở Y = 0; người chơi xuất phát tại (0, 0, 0).

### Mô hình tick
- Snapshot tick 0 là trạng thái sau khi dựng scenario, trước khi áp dụng input.
- Bước thứ k (k = 0 … N−1) đọc input của tick k và tạo ra trạng thái k+1. Sự kiện xảy ra trong bước đó ghi tick = k+1. --ticks N thực hiện đúng N bước.
- time_left_s = thời lượng Đêm − (số bước đã chạy) / 60.

### Quy ước vị trí
- player.pos là chân nhân vật; shade.pos là tâm Bóng Mực; lantern.pos là chân cột đèn; vị trí đom đóm là điểm trên mặt đất (độ cao lơ lửng chỉ là hiển thị).
- Mọi khoảng cách trong tuning đo giữa các điểm này, theo mặt phẳng ngang XZ, không cộng thêm kích thước nhân vật. "Trong bán kính r" nghĩa là khoảng cách ≤ r.

## C. File inputs

```json
{
  "frames": [
    { "tick": 0,   "move": [0, 1], "cam_yaw_deg": 0 },
    { "tick": 120, "move": [0, 0], "interact": true },
    { "tick": 121, "interact": false },
    { "tick": 200, "pulse": true },
    { "tick": 201, "pulse": false }
  ]
}
```

- Mặc định trước frame đầu tiên: move [0,0], cam_yaw_deg 0, mọi nút false.
- Mỗi frame chỉ đổi các trường có mặt; trường vắng mặt giữ giá trị cũ.
- tick của các frame phải tăng nghiêm ngặt (không trùng, không giảm).
- move: [x, z], mỗi thành phần trong [−1, 1]. Với θ = cam_yaw_deg đổi sang radian, hướng di chuyển trong thế giới là x' = x·cosθ + z·sinθ, z' = −x·sinθ + z·cosθ (khi θ = 0 thì x là +X, z là +Z). Vector dài hơn 1 phải được chuẩn hóa về độ dài 1.
- jump, interact, pulse (và dash nếu có): boolean, kích hoạt khi giá trị chuyển từ false sang true.
- Không có file inputs nghĩa là người chơi đứng yên.

## D. File scenario

```json
{
  "player": { "pos": [0, 0, 0], "carried": 0, "flames": 3 },
  "random_motes": false,
  "random_shades": false,
  "motes": [[0, 0, 5]],
  "shades": [{ "pos": [10, 0, 0] }],
  "lanterns": [{ "id": "L1", "pos": [0, 0, 25], "deposited": 0 }],
  "time_left_s": 300
}
```

- random_motes: false → không tự sinh đom đóm, chỉ có những con được liệt kê.
- random_shades: false → không tự sinh Bóng Mực, chỉ có những con được liệt kê (hoạt động bình thường ngay lập tức).
- lanterns: cập nhật theo id các đèn của màn (L1…L5). Đèn không được nhắc tới giữ nguyên; có pos thì đổi vị trí; có thể đặt lit: true.
- motes, shades: thay thế danh sách ban đầu tương ứng; mảng rỗng = không có con nào. shades[] có thể kèm id để test tham chiếu.
- Trường nào không có thì dùng mặc định của game.
- Dựng scenario không phát sự kiện và không cộng điểm (đèn đặt sẵn lit: true không được cộng điểm thắp đèn).

## E. Output JSONL

Mỗi dòng là một đối tượng JSON, ba loại.

Snapshot, mỗi --snapshot-every tick, bắt đầu từ tick 0:
```json
{"type":"snapshot","tick":120,"sim_tick":120,"state":"playing","time_left_s":298.0,"score":20,
 "player":{"pos":[0.0,0.0,12.0],"flames":3,"carried":2},
 "lanterns":[{"id":"L1","pos":[0,0,25],"lit":false,"deposited":0}],
 "shades":[{"id":"S1","pos":[30.1,1.0,2.0],"state":"chase"}],
 "motes_active":19}
```

Event, ghi ngay khi xảy ra: `{"type":"event","tick":131,"name":"mote_picked","data":{"carried":3}}`

| name | data |
|---|---|
| mote_picked | {"carried": n} |
| deposit | {"lantern_id": "L1", "amount": n, "deposited": n} |
| lantern_lit | {"lantern_id": "L1"} |
| pulse | {"stunned_ids": ["S1"]} |
| player_hit | {"by": "shade" \| "fall", "flames": n, "dropped": n} |
| shade_spawned | {"id": "S3"} |
| game_over | {"result": "won" \| "lost", "reason": "all_lit" \| "dawn" \| "no_flames"} |

End, dòng cuối cùng và bắt buộc: `{"type":"end","ticks":4800,"state":"won","score":1730}`

- state ∈ playing, won, lost. Trạng thái Bóng Mực tối thiểu phải có `stunned`; các trạng thái khác tự đặt tên.
- Tọa độ làm tròn 3 chữ số thập phân.
- Tính tất định: cùng --seed, cùng scenario và cùng inputs phải cho output giống hệt nhau giữa hai lần chạy, kể cả các id tự sinh.
- sim_tick là số bước gameplay đã chạy (ở Phase 1 bằng tick).
- Mảng motes (mỗi phần tử id, pos) trong snapshot là khuyến nghị ở v1.0.
- Sự kiện không xảy ra trong game (ví dụ không có rơi khỏi đảo) thì không ghi.
