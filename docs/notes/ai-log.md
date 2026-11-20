# Nhật ký dùng AI

Công cụ: Claude Code v2.1.329 (gói Claude Pro). Model: Opus 5.5 cho việc khó (logic game), Sonnet cho việc nhẹ (bằng chứng, tài liệu).
Hỗ trợ lập kế hoạch: Claude (chat) giúp đọc tài liệu lab, soạn giả định `docs/notes/phase-1.md` và harness ban đầu.
Cách xem token: lệnh `/usage` (hoặc `/cost`) trong Claude Code, ghi lại cuối mỗi phase.

## Harness đang dùng
| Thành phần | File | Dùng để |
|---|---|---|
| Hướng dẫn agent | `CLAUDE.md` | Lệnh build/test/headless, cấu trúc, điều cấm |
| Hook Stop | `.claude/settings.json` + `.claude/hooks/stop-if-tests-fail.sh` | Chặn agent kết thúc khi `npm test` đỏ |
| Skill | `.claude/skills/verify-proof/SKILL.md` | Chạy scenario, lưu bằng chứng vào `docs/proof/phase-N/` |
| Subagent | `.claude/agents/reviewer.md` | Review độc lập, chỉ đọc, đối chiếu với contract |

## Phase 1

| Thời điểm | Việc giao cho AI | Kết quả | AI sai ở đâu / tôi phát hiện thế nào | Chỉnh harness |
|---|---|---|---|---|
| 22:10 | (Chat) Đọc tài liệu lab, lập checklist, soạn giả định + harness | Có `CLAUDE.md`, hook, skill, reviewer, `game.contract.json`, `phase-1.md` (AC1–AC17) | — | Tạo harness ban đầu |
| 22:42 | Việc 1: logic `src/sim/` + headless CLI + test AC1–AC16. Dùng **plan mode**, Opus | 5 commit nhỏ, 44/44 test đạt, `tsc` sạch, chạy 2 lần cho output giống hệt | (1) Claude hỏi 3 chỗ mơ hồ (đẩy Bóng Mực ra khỏi đảo hay vùng đèn, vị trí sinh Bóng Mực, chép contract vào repo); tôi chọn: kẹp ở mép đảo và đẩy ra khỏi vùng đèn, sinh trong bán kính 38 m, có chép contract. (2) Claude **đoán sai ngưỡng test nhảy**, test đỏ; nó sửa bằng giá trị tính theo công thức (đỉnh 0.85 m ở tick 18, chạm đất ở tick 35), tôi kiểm lại công thức thấy đúng. (3) Claude tự thêm `@types/node` (ngoài kế hoạch, hợp lý). (4) Claude đặt `time_left_s ≤ 0` là lỗi mã 2: rủi ro trượt test ẩn nên giao sửa ở Việc 2 | Không cần sửa: hook đã buộc test xanh trước khi kết thúc |
| 22:51 | Tôi tự kiểm chứng: `npm test` + chạy headless seed 1, 600 tick | 44 passed, exit=0, dòng đầu là snapshot tick 0, dòng cuối là `end` | — | — |
| 22:52 | Việc 2: time_left_s=0 hợp lệ, tsconfig gồm tests/, ghi giả định bổ sung; bằng chứng bằng skill verify-proof; gọi subagent reviewer. Sonnet | 46/46 test, 18/18 case headless, chạy lại giống hệt từng byte; Claude cố tình làm sai một kỳ vọng để chứng minh script không luôn đạt | Reviewer tìm 1 lỗi trung (thưởng thời gian âm khi thắng cùng tick hết giờ), 3 lỗi nhẹ (sai số float, shade bị đẩy ra ngoài đảo, flames 0 bị từ chối). **Reviewer tự chạy proof.sh làm hỏng file bằng chứng đã commit**; Claude không tự hoàn lại mà hỏi tôi | Sửa `reviewer.md` + `CLAUDE.md`: reviewer không được ghi vào `docs/proof/`, chỉ ghi `/tmp` |
| 23:00 | Việc 2b: sửa lỗi 1–4 kèm test, chốt 2 chỗ mơ hồ, thêm case tất định 6000 tick. Sonnet | 53/53 test, 19/19 case, bằng chứng khôi phục; test mới của mục 1–3 đã thử trên code cũ và đều đỏ | Sai số float khi tính thời gian (1.4 − 24/60) → đổi sang tick nguyên. Phát hiện xung đột "kẹp đảo vs vùng đèn" khi đèn sát mép: chọn ưu tiên đảo, ghi vào giả định | Reviewer bị cấm ghi `docs/proof/` (đã sửa) |

**Token / chi phí ước tính Phase 1:** _(chạy `/usage` cuối phase rồi điền)_

**Cách tiết kiệm token:**
- Viết giả định và tiêu chí nghiệm thu **trước**, nên agent ít phải đoán và ít hỏi lại.
- Dùng plan mode để duyệt kế hoạch trước khi cho sửa code.
- Chia nhỏ thành Việc 1, 2, 3; mỗi việc một prompt rõ ràng.
- Dùng Opus cho logic khó, Sonnet cho việc nhẹ.
- Tự chạy lệnh kiểm chứng trong Terminal riêng thay vì nhờ agent.