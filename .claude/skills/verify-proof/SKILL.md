---
name: verify-proof
description: Chạy các scenario headless và lưu bằng chứng của một phase vào docs/proof/phase-N. Dùng khi cần kiểm chứng hành vi game hoặc cập nhật bằng chứng trước khi gắn tag.
---

# Kiểm chứng và lưu bằng chứng

1. Chạy `npm test` và lưu kết quả: `npm test 2>&1 | tee docs/proof/phase-N/npm-test.txt`.
2. Chạy toàn bộ scenario bằng script `scripts/proof.sh N` (nếu chưa có thì tạo). Script phải:
   - Với mỗi `scenarios/*.json` (kèm `inputs/` tương ứng nếu có), chạy headless và ghi `docs/proof/phase-N/<tên>.jsonl`.
   - Chạy cùng seed hai lần và `diff` để kiểm tra tính tất định, ghi kết quả ĐẠT/KHÔNG ĐẠT.
   - In bảng tóm tắt: scenario, sự kiện mong đợi, có xuất hiện không.
3. Cập nhật `docs/proof/phase-N/README.md`: bảng `Yêu cầu | Cách kiểm chứng | Bằng chứng | Kết quả`, lấy ID tiêu chí từ `docs/notes/phase-N.md`.
4. Chỗ nào chưa đạt thì ghi "Chưa đạt" và lý do. Tuyệt đối không sửa tay file output.
