# ADR 0001 — Nhiên liệu đèn và luật thắng bình minh

- **Trạng thái:** Đã chấp nhận (Phase 3, Test Contract v1.2)
- **Nguồn:** `docs/notes/ticket-03.md`; chi tiết giả định ở `docs/notes/phase-3.md`

## Bối cảnh

Phase 2: đèn chỉ có `lit` + `deposited`; thắp rồi là sáng mãi, thắng ngay khi tất cả đèn sáng (`all_lit`). Người chơi giỏi thắp hết trong 2 phút rồi game kết thúc. Ticket-03 đổi mục tiêu thành "giữ đảo sáng tới bình minh": đèn hao dầu, có thể tắt, Bóng Mực hút dầu, thắng chỉ ở bình minh.

## Quyết định

1. **Mô hình đèn**: hai trạng thái `tắt` / `sáng` (giữ cờ `lit`), thêm:
   - `fuelU`: số nguyên, đơn vị 1/60 fuel (0…6000). Hao 1 đơn vị/tick, mỗi bóng `drain` hút 5 đơn vị/tick, mỗi đom đóm châm 600 đơn vị. Không có sai số số thực; chỉ khi xuất mới đổi `fuel = round(fuelU/6)/10`.
   - `ever_lit`: đã từng sáng trong Đêm (hoặc đặt bằng scenario) → thắp lại chỉ cần 5.
   - `relit_count`: số lần thắp lại.
   - Chuyển trạng thái: `tắt --(deposited đủ 10 / 5)--> sáng (fuelU 6000)`, `sáng --(fuelU ≤ 0 ngay sau bước 2)--> tắt (deposited 0, lantern_out)`. Châm dầu chỉ đổi `fuelU`.
   - Vùng an toàn là thuộc tính suy ra: `lit && fuelU ≥ 1800` (dùng một hàm `hasSafeZone` cho mọi chỗ).
2. **Bóng Mực**: thêm trạng thái `drain`. **Đổi so với Phase 2**: `wander` không còn đứng yên — đi tới đèn sáng `fuel < 30` gần nhất, không có thì về đèn tắt gần nhất (dừng cách 2 m). Đẩy bóng ra khi châm lên ≥ 30 dùng lại cơ chế đẩy 30 tick của vùng an toàn Phase 2.
3. **Luật thắng**: bỏ thắng sớm. Bước 11 (sau mọi cập nhật của tick): hết lửa → `lost no_flames`; hết giờ → đếm đèn sáng ở tick cuối, `≥ ceil(win_ratio × tổng)` → `won dawn_survived` (+50 + floor(fuel) mỗi đèn sáng, +50 mỗi lửa), không thì `lost dawn`. `all_lit` bỏ.
4. **Sức chứa** suy ra: `min(capacity_max, carry_capacity + 2 × successful_lights)`; `successful_lights` lưu trong `Player`, về 0 mỗi Đêm.

## Hệ quả

- Output headless đổi (breaking): snapshot có thêm trường, `lantern_lit` có `relight`, `reason` mới, thời lượng 240/270/300, điểm mới. Ghi ở `CHANGELOG.md`.
- Test Phase 1–2 dựa trên `all_lit`, điểm cũ, thời lượng cũ, `wander` đứng yên phải sửa (danh sách ở phase-3.md mục 5).
- Mọi Bóng Mực `wander` giờ di chuyển ⇒ hành vi random dài hạn khác Phase 2 (vẫn tất định theo seed).
- Dùng số nguyên cho dầu làm so sánh ngưỡng (`< 30`, `≤ 0`, `≥ 30`) chính xác tuyệt đối ở mọi tick.
