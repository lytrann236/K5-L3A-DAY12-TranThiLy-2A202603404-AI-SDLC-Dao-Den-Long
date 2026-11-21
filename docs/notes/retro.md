# Retro — Đảo Đèn Lồng (Day 12 AI SDLC)

## Tổng hợp 4 phase
| Phase | Kết quả chính | Test | Chưa làm |
|---|---|---|---|
| 1 — PRD-0 | Đêm 1 chơi được + headless Contract v1.0, 17 AC | 78 | — |
| 2 — Ba hòn đảo | Số chuẩn, 3 Đêm, lướt, rơi, tạm dừng, Gió Lạc, Bùa Gió, gió mạnh, Contract v1.1; 21.600 tick ≈ 0,3 s | 208 | Âm thanh, cài đặt, bảng màu, HUD đầy đủ, màn giới thiệu/Bình Minh, đo FPS |
| 3 — Đèn cạn dầu | Nhiên liệu đèn, Bóng Mực drain, luật thắng dawn_survived, sức chứa tăng dần, Contract v1.2, ADR + CHANGELOG | 242 | Chế độ mù màu |
| 4 — v1.0.0 | Bench, soak, Contract v1.3, README, Release | … | Bảng xếp hạng, đổi phím, phụ đề, giảm chuyển động |

## Điều hiệu quả khi làm với AI
- Viết **giả định + tiêu chí nghiệm thu trước** (phase-N.md): agent ít đoán, mọi quyết định có chỗ tra lại.
- **Plan mode** cho việc lớn; agent hỏi đúng các chỗ mơ hồ (Phase 2 hỏi 9 câu, bắt được mâu thuẫn ticket: Đêm 3 xuất phát trong tháp chuông).
- **Tách sim thuần khỏi render** từ Phase 1 → headless nhanh (0,3 s / 21.600 tick), test dễ, giao diện thay đổi không ảnh hưởng logic.
- Agent tự chứng minh test không luôn đạt: cố ý làm sai kỳ vọng, đảo thứ tự xử lý, tắt vách/tháp → test đỏ đúng chỗ.
- So `cmp` output các Đêm cũ sau mỗi thay đổi → regression rõ ràng.

## Điều không hiệu quả
- Agent làm giao diện **mà không nhìn thấy game**: 3 vòng sửa ở Phase 1 (cảnh tối, thiếu nón lá).
- Phạm vi Phase 2 quá lớn so với thời gian; quyết định cắt giao diện phụ hơi muộn (10:25).
- Hook ban đầu thiếu điều kiện dừng → lặp 9 lần, tốn token.

## Những lần AI sai và cách phát hiện
| Lỗi | Phát hiện | Khắc phục |
|---|---|---|
| Đoán sai ngưỡng test nhảy | Hook chặn vì test đỏ | Sửa theo công thức, tôi kiểm lại |
| Reviewer chạy proof.sh làm hỏng bằng chứng đã commit | `git status` có file lạ | Cấm reviewer ghi `docs/proof/` |
| Hiểu "Mây" là nhân vật trang trí | Tôi chơi thử, không thấy nón lá | Thêm `npm run shot` + quy tắc tự xem ảnh |
| Ghi giấy phép theo trí nhớ | Agent tự báo chưa kiểm | Tôi kiểm bằng lệnh `node` |
| Đề xuất luật không có trong ticket (spawning miễn nhiễm pulse, nạp đèn đo chênh cao) | Đối chiếu nguyên văn ticket/contract | Chọn bám nguyên văn |

## Harness giúp nhiều nhất
1. **Hook Stop chặn khi test đỏ**: agent không thể báo xong khi test hỏng (sau khi sửa lỗi lặp).
2. **`npm run shot`**: agent tự nhìn game, hết cảnh "báo xong mà chưa xem".
3. **Subagent reviewer**: tìm ra lỗi thưởng thời gian âm mà test chưa bắt.
4. **CLAUDE.md** cập nhật mỗi phase (lệnh, contract hiện hành, quy tắc).

## Token / chi phí
| Phase | Theo `/usage` (gói Claude Pro) |
|---|---|
| 1 | ~33% hạn mức phiên 5 giờ (~2% tuần) |
| 2 | ~11% hạn mức tuần (2% → 13%) |
| 3 + 4 | ~3% hạn mức tuần (13% → 16%); phiên 41% → 63%. Riêng phiên Phase 4 (Sonnet): ~$0.99, 30.5k token output, 3.2M token đọc từ cache (97% input lấy từ cache) |
| Tổng | ~16% hạn mức tuần cho cả 4 phase |

Cách tiết kiệm: 
- Bài học từ `/usage`: 56% lượng dùng 24 giờ qua thuộc các phiên **không `/clear` khi đổi việc** → lẽ ra nên `/clear` sớm hơn ở Phase 1. Prompt cache giúp 97% input được đọc lại từ cache nên rẻ hơn nhiều.
- Phase 3 dùng Opus, Phase 4 dùng Sonnet; Phase 3+4 chỉ tốn ~3% tuần nhờ prompt "không hỏi lại" + spec rõ.

## Nếu làm lại
- Có `npm run shot` và hook đúng ngay từ đầu.
- Ước lượng phạm vi mỗi phase ngay khi nhận ticket, cắt giao diện phụ sớm.
- Dùng Sonnet nhiều hơn cho các việc đã có spec rõ.