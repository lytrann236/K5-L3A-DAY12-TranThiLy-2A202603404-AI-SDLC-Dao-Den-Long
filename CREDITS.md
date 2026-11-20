# Ghi công

## Asset
Game **không dùng asset bên ngoài**: không có ảnh, mô hình 3D, âm thanh hay font tải về. Toàn bộ hình ảnh (đảo, biển mây, đèn lồng, đom đóm, Bóng Mực, Mây) được dựng bằng hình khối cơ bản của Three.js trong mã nguồn. Biểu tượng tab trình duyệt (`public/favicon.svg`) là SVG tự vẽ.

## Thư viện và công cụ
- [Three.js](https://threejs.org/) — giấy phép MIT (dùng để vẽ 3D)
- Vite: MIT
- TypeScript: Apache-2.0
- Vitest: MIT
- tsx: MIT
- (Đã kiểm tra trường `license` trong `node_modules/<gói>/package.json` ngày 2026-11-20.)

Danh sách đầy đủ và phiên bản nằm ở `package.json` / `package-lock.json`.

## Cách làm
Mã nguồn được viết cùng [Claude Code](https://claude.com/claude-code) (Anthropic) theo đặc tả và Test Contract do người làm cung cấp; người làm xem lại, chạy test và chịu trách nhiệm về kết quả. Nhật ký dùng AI: [`docs/notes/ai-log.md`](docs/notes/ai-log.md).
