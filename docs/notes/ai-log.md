# Nhật ký dùng AI

Công cụ: Claude Code v2.1.329 (gói Claude Pro). Model: Opus 5.5 cho việc khó (logic game, spec), Sonnet cho việc nhẹ (bằng chứng, tài liệu, giao diện).
Hỗ trợ lập kế hoạch: Claude (chat) giúp đọc tài liệu lab, soạn giả định `docs/notes/phase-1.md`, harness ban đầu và gợi ý chốt các chỗ mơ hồ.
Cách xem token: lệnh `/usage` trong Claude Code (gói Pro hiện % hạn mức phiên 5 giờ và % hạn mức tuần, không hiện số token).

## Harness đang dùng
| Thành phần | File | Dùng để |
|---|---|---|
| Hướng dẫn agent | `CLAUDE.md` | Lệnh build/test/headless/shot, cấu trúc, điều cấm; cập nhật mỗi phase |
| Hook Stop | `.claude/settings.json` + `.claude/hooks/stop-if-tests-fail.sh` | Chặn agent kết thúc khi `npm test` đỏ (chỉ chặn 1 lần, xem Phase 2) |
| Skill | `.claude/skills/verify-proof/SKILL.md` | Chạy scenario, lưu bằng chứng vào `docs/proof/phase-N/` |
| Subagent | `.claude/agents/reviewer.md` | Review độc lập, chỉ đọc, không ghi `docs/proof/` |
| Công cụ | `npm run shot` (Playwright) | Agent tự chụp và xem ảnh game sau khi sửa giao diện |

## Phase 1

| Thời điểm | Việc giao cho AI | Kết quả | AI sai ở đâu / tôi phát hiện thế nào | Chỉnh harness |
|---|---|---|---|---|
| 22:10 | (Chat) Đọc tài liệu lab, lập checklist, soạn giả định + harness | Có `CLAUDE.md`, hook, skill, reviewer, `game.contract.json`, `phase-1.md` (AC1–AC17) | — | Tạo harness ban đầu |
| 22:42 | Việc 1: logic `src/sim/` + headless CLI + test AC1–AC16. **Plan mode**, Opus | 5 commit nhỏ, 44/44 test, `tsc` sạch, chạy 2 lần cho output giống hệt | (1) Claude hỏi 3 chỗ mơ hồ, tôi chốt. (2) **Đoán sai ngưỡng test nhảy**, test đỏ; nó sửa theo công thức, tôi kiểm lại thấy đúng. (3) Tự thêm `@types/node` (hợp lý). (4) Coi `time_left_s ≤ 0` là lỗi mã 2: rủi ro trượt test ẩn, giao sửa ở Việc 2 | Không cần: hook đã buộc test xanh |
| 22:51 | Tôi tự kiểm chứng: `npm test` + headless seed 1, 600 tick | 44 passed, exit=0, dòng đầu snapshot tick 0, dòng cuối `end` | — | — |
| 22:52 | Việc 2: sửa nhỏ + bằng chứng (skill verify-proof) + subagent reviewer. Sonnet | 46/46 test, 18/18 case, chạy lại giống hệt từng byte; Claude cố ý làm sai một kỳ vọng để chứng minh script không luôn đạt | Reviewer tìm 1 lỗi trung (thưởng thời gian âm) + 3 lỗi nhẹ. **Reviewer tự chạy proof.sh làm hỏng file bằng chứng đã commit**; Claude không tự hoàn lại mà hỏi tôi | Sửa `reviewer.md` + `CLAUDE.md`: reviewer không ghi `docs/proof/`, chỉ ghi `/tmp` |
| 23:00 | Việc 2b: sửa lỗi 1–4 kèm test, thêm case tất định 6000 tick. Sonnet | 53/53 test, 19/19 case; test mới của mục 1–3 đã thử trên code cũ và đều đỏ | Sai số float (1.4 − 24/60) → đổi sang tick nguyên. Xung đột "kẹp đảo vs vùng đèn" → ưu tiên đảo, ghi giả định | — |
| 23:10 | Việc 3: giao diện 3D, HUD, chơi lại. Sonnet, plan mode | 69/69 test, build OK; Claude bắt được prompt của tôi trùng phím E → chọn ←/→ xoay camera | Claude **không xem game bằng mắt** mà vẫn báo xong. Tôi chơi thử: chạy được nhưng cảnh quá tối | — |
| 23:25 | Việc 3b: nón lá + đèn lồng, thông báo khi bấm sai, README, LICENSE, CREDITS | 78/78 test | Claude ghi giấy phép theo trí nhớ, tự báo chưa kiểm → tôi kiểm bằng lệnh node, sửa CREDITS. Tôi chơi thử: **vẫn không có nón lá** | — |
| 23:31 | Việc 3c: công cụ chụp ảnh + sửa Mây | Thấy rõ nón lá và đèn lồng | Nguyên nhân gốc: Claude hiểu "Mây" là nhân vật trang trí, không phải người chơi | **Thêm `npm run shot` + quy tắc CLAUDE.md: sau mọi thay đổi giao diện phải chụp và tự Read ảnh** |

**Token Phase 1:** gói Pro không hiện số token; theo `/usage` lúc 23:54, Phase 1 dùng **~33% hạn mức phiên 5 giờ** (≈ **2% hạn mức tuần**). Tốn nhiều nhất: Việc 1 (Opus) và 3 vòng sửa giao diện do agent chưa nhìn thấy game.

## Phase 2

| Thời điểm | Việc giao cho AI | Kết quả | AI sai ở đâu / tôi phát hiện thế nào | Chỉnh harness |
|---|---|---|---|---|
| 00:27 | Việc 1: spec `phase-2.md` (AC2-01…62), contract v1.1, CLAUDE.md + skill. Opus, plan mode | 3 commit; 21 test đỏ có chủ đích, liệt kê kèm lý do | Claude hỏi 9 chỗ mơ hồ; bắt được mâu thuẫn ticket (Đêm 3 xuất phát (0,0,0) nằm trong tháp chuông). Tôi **không theo khuyến nghị** ở 2 chỗ (Bóng Mực wander, nạp đèn đo chênh cao) để bám nguyên văn ticket/contract. **Hook Stop lặp chặn 9 lần** vì test đỏ có chủ đích, tốn token | **Sửa hook: kiểm tra `stop_hook_active`, chỉ chặn 1 lần** |
| 00:40 | Việc 2: sim + headless Đêm 1 theo Contract v1.1 và số chuẩn. Opus, auto mode | 6 commit, 124/124 test (sửa 21 test Phase 1 theo bảng kèm lý do), 33 case, 21.600 tick trong 0,45 s | Claude phát hiện ticket có chỗ "tự loại trừ" (không thể bị đánh đúng tick thắp đèn cuối) và dựng test khác; 7 chỗ mơ hồ, tôi chốt | Hook mới không còn lặp |
| 09:50 | Việc 3: Đêm 2 (2 đảo, cầu, bục nhảy), Gió Lạc, Bùa Gió. Opus, auto mode | 174/174 test, 53/53 case, Đêm 1 giữ nguyên 30/30 file (cmp), 21.600 tick trong 0,3 s | Claude tạm đảo thứ tự "cướp trước hit" thì test đỏ, nên test không luôn đạt | — |
| 10:10 | Việc 4: Đêm 3 (tầng, dốc, vách, tháp, bục), gió mạnh. Opus, auto mode | 207/207 test, 71/71 case, Đêm 1–2 giữ nguyên 155 file (cmp), 21.600 tick trong 0,32 s | Tắt thử vách/tháp/gió thì 11 test đỏ đúng chỗ; 8 chỗ mơ hồ, tôi chốt giữ nguyên | — |
| 10:25 | **Quyết định phạm vi:** còn ~1h35 tới hạn 11:59, cắt giao diện phụ (âm thanh, cài đặt, bảng màu, menu đầy đủ) để ưu tiên headless + tag + Release + video | — | — | Dùng prompt "không hỏi lại" để rút ngắn thời gian |
| 10:27 | Việc 5–6 gộp: giao diện tối thiểu 3 Đêm (menu, lướt, tạm dừng, Đêm kế tiếp, HUD hồi chiêu) + bằng chứng `docs/proof/phase-2/`. Sonnet | 208 test, perf 3 Đêm 0,30–0,37 s, ảnh menu/tạm dừng/Đêm 2/Đêm 3 | Claude tự báo **chưa chơi thật** luồng thắng/thua và "Đêm kế tiếp" → ghi "chưa kiểm" thay vì nhận là đạt | — |

**Token Phase 2:** theo `/usage` lúc 10:32: hạn mức tuần tăng từ 2% (cuối Phase 1) lên **13%** → Phase 2 dùng **~11% hạn mức tuần** (phiên hiện tại 41%). Tốn nhiều nhất: Việc 2–4 (Opus, sim 3 Đêm) và vòng lặp hook 9 lần ở Việc 1.

## Phase 3

| Thời điểm | Việc giao cho AI | Kết quả | AI sai ở đâu / tôi phát hiện thế nào | Chỉnh harness |
|---|---|---|---|---|
| 10:35 | Toàn bộ Phase 3 trong 1 prompt "không hỏi lại": spec phase-3.md, ADR, CHANGELOG, contract v1.2, sim nhiên liệu + drain + luật thắng mới, sửa test cũ, UI thanh dầu. Opus | 9 commit, 242/242 test, 15 scenario mới, mọi scenario cũ đạt, Claude tự chụp và xem ảnh thanh dầu | Ticket viết "đi về đèn tắt gần nhất **như trước**" nhưng Phase 2 của tôi wander đứng yên → chọn theo ticket mới, ghi trong ADR. Claude tự thêm `?demo=fuel` (chỉ trình duyệt) để chụp ảnh | CLAUDE.md + skill trỏ sang phase-3.md, v1.2 |

## Cách tiết kiệm token
- Viết giả định và tiêu chí nghiệm thu **trước**, agent ít phải đoán và ít hỏi lại.
- Plan mode để duyệt kế hoạch trước khi cho sửa code.
- Chia nhỏ việc; `/clear` giữa các việc để ngữ cảnh gọn (agent đọc lại CLAUDE.md + docs).
- Opus cho logic khó, Sonnet cho việc nhẹ.
- Tự chạy lệnh kiểm chứng trong Terminal riêng thay vì nhờ agent.
- Sửa hook lặp (Phase 2) để không đốt token vô ích.