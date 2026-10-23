# V9 — Đường Đến Tình Yêu

## Audit và phạm vi

Phát triển trên nhánh `v9-ultimate-racing-love-story` từ V8 `2908346`. Đã đọc mã ESM Canvas2D/WebAudio, dữ liệu OSM, luồng checkpoint/cứu hộ, localStorage, build và các bài kiểm thử trước khi tích hợp. Giữ V8 trong lịch sử Git và toàn bộ tài liệu/ảnh V8. Không thay bằng game demo mới.

Giữ nguyên 10 tuyến OSM, 4 xe, 6 nhân vật, 5 chương, hệ thống ga/phanh/lái, va chạm và nhặt đồ theo tọa độ thật, thứ tự checkpoint, chế độ thời tiết, cứu hộ/hôn má, xuất/nhập tiến trình. Không thêm phụ thuộc runtime/CDN.

## Tính năng đã triển khai

- Mã phiên bản trên URL JS/CSS và revalidation manifest giúp tránh trộn tài nguyên V8 còn cache với giao diện V9 sau khi cập nhật Pages.
- Tên mới, menu hành trình/gara/nhân vật/kỷ niệm, fullscreen, bàn phím/tay cầm/cảm ứng Drift và Nitro; bỏ toast checkpoint liên tục.
- Lưu V9, nhập V8/V9 và migration không xóa save cũ. Unicode 20 grapheme, lọc HTML/điều khiển, dùng ID ổn định và chèn text an toàn trong hội thoại/HUD/cảnh phim.
- Vật lý 120 Hz, nội suy render; ga/phanh và nghiêng có độ trễ, chuyển trọng lượng, drift chủ động, combo/xu/Nitro, Nitro hữu hạn, camera tăng tốc/phanh/va chạm có giảm rung. Scooter có thông số riêng.
- Gara 5 hạng mục/3 cấp, giao dịch đồng bộ, tác động thống kê thật; AI không sao chép nâng cấp người chơi. Đổi màu từng phần và phụ kiện trên sprite, cache hữu hạn, xem trước bằng cùng renderer vật liệu.
- Culling theo grid cho đường và vật trang trí, mip cache cho atlas, 80 phần tử pool hiệu ứng, HUD cập nhật giảm tần suất, adaptive resolution có hysteresis và ba preset. Tần số mô phỏng không phụ thuộc độ phân giải.
- Cảnh hồ/vườn hoa/phố cổ/cầu/cảng theo nhóm phong cảnh; atlas mới được dùng trong đường đua, người đi bộ/khán giả/cây/đèn, xe nền trên đường ngoài course. Kiến trúc là cách điệu.
- 5 chương có đối thủ/độ khó/ánh sáng tăng dần; AI lái bằng hướng và vận tốc liên tục, phanh ở cua, chọn làn tránh vật cản, Drift/Nitro và lối tắt, không dịch chuyển để bắt kịp.
- Ba nhánh OSM trên các tuyến 3/4/5, có cổng riêng theo thứ tự. Vào nhánh phải thực sự tách khỏi đường chính; không nhận checkpoint chỉ bằng nhảy tới lối ra. Đường tắt hẹp hơn và có cua gắt, lợi ích phụ thuộc kỹ năng.
- Lucien Chase một lần/chặng trung gian, xuất hiện phía sau trên cùng đường, có cơ hội thoát, bắt được mới cứu hộ; không chạy trong boss/ending. Ba lần cứu hộ hợp lệ vẫn có hôn má.
- Director 46 giây dùng timeline engine: chạy qua đích/ăn mừng, tiến lại chúc mừng, đưa/mở hộp/cận cảnh vòng, xe chở hai người cùng chiều trên OSM chuyển động qua phố đêm với ba góc camera, đỗ xe/đi bộ vào quán, hai tư thế ăn tối, nhạc riêng và màn kỷ niệm. Có bỏ qua, xem lại, về gara/đua tự chọn.
- Quà khai báo qua dữ liệu `HEART_BRACELET`; chỉ cấp một lần khi thắng boss với đủ checkpoint/lap. Xem thử và xem lại không cấp thưởng.

## Các tệp chính

| Nhóm | Tệp |
|---|---|
| Mô phỏng/bản đồ/lưu | `src/engine.js`, `src/data.js`, `src/profile.js`, `src/progress.js` |
| Vẽ/đo hiệu năng | `src/renderer.js`, `src/performance.js` |
| Giao diện/tích hợp | `index.html`, `style.css`, `src/ui.js`, `src/main.js` |
| Đoạn kết/âm thanh | `src/cinematics.js`, `src/ending.css`, `src/audio.js` |
| Tài nguyên thật | `assets/v9-ending-poses.png`, `assets/v9-duo.png`, `assets/v9-gift.png`, `assets/v9-dinner.png`, `assets/v9-districts.png`, `assets/manifest.json` |
| Kiểm tra | `tests/v9-engine.test.js`, `tests/profile.test.js`, `tests/performance.test.js`, `tests/v9-browser.mjs`, `tests/shortcut-laps.mjs`, `tests/performance-browser.mjs`, kiểm thử V8 được giữ/cập nhật tương thích |
| Phát hành | `README.md`, `package.json`, `package-lock.json`, `scripts/server.mjs`, tài liệu này |

## Kiểm thử

Kết quả và số đo cuối được ghi bên dưới từ những lần chạy thực tế. Kiểm thử unit có fixture trực tiếp để kiểm tra state machine/phần thưởng; chúng không được dùng để tuyên bố người chơi đã thắng 5 chương. `test:maps` và `test:shortcuts` dùng điều khiển phản hồi **chỉ trong bài thử**, chỉ ga/phanh/lái, không sửa vị trí, không cứu hộ và không tiêm kết quả.

## Giới hạn thực tế

- Chưa có Android vật lý hoặc tay cầm vật lý trong môi trường; chỉ đã thử viewport/touch và mapping tay cầm trong Chromium. Không chứng nhận 60 FPS trên điện thoại thật.
- Canvas2D là phong cách 2.5D với nhân vật/xe minh họa; chuyển tư thế theo atlas và chuyển động procedural, không phải rig 3D đầy đủ. Hoạt ảnh tóc/vải và bánh là hiệu ứng nhẹ, chưa phải mô phỏng vải/bánh độc lập có đầy đủ khung hình.
- Phong cảnh cầu/cảng là chủ đề mỹ thuật trên đường OSM có sẵn, không khẳng định tuyến đi qua cảng thực hay địa điểm kiến trúc chính xác. Lối tắt chỉ dùng đường OSM trong dữ liệu cục bộ.
- Bộ đo trong cloud dùng software/shared rendering; Ultra có thể thấp hơn 60 FPS. Auto quality giảm chi tiết/resolution chứ không sửa kết quả đo hoặc tốc độ mô phỏng. Stress restart là ngắn hạn, không chứng minh không rò rỉ sau nhiều giờ.
- Chưa có ramp/cú nhảy chuyên biệt; Nitro hiện được tích qua Drift/combo, vượt sát an toàn và thoát rượt đuổi.
- Lưu cục bộ có thể bị xóa bởi trình duyệt; nên xuất JSON. Không có đồng bộ tài khoản/backend/chống sửa save.

## Kết quả lần chạy phát hành

Ngày đo UTC: 2026-10-23T01:30:40.182Z. Node.js 24.19.0; Chromium 154.0.8037.57 headless trên Linux x64, CPU AMD EPYC 9V74 80-Core Processor.

- Unit: **46/46 đạt** (`npm test`), gồm V8 regression, Unicode/migration/gara, fixed-step 30/60/120 Hz, Drift/Nitro, cổng nhánh, ending và AI hoàn thành boss bằng chuyển động liên tục.
- Browser hồi quy: **17/17 đạt**; browser V9: **7/7 đạt**.
- 10/10 tuyến chính hoàn thành bằng input-only driver; 3/3 tuyến lối tắt hoàn thành đủ checkpoint, không cứu hộ/phạt.
- Build web tĩnh: `npm run build` thành công. `git diff --check` sạch.
- 20 lượt restart, 10 track cache, heap sau GC tăng khoảng 2.81 MB trong lần chạy hồi quy; không thấy tăng không giới hạn trong bài stress ngắn.

| Kịch bản | FPS trung bình | FPS thấp nhất | P95 frame (ms) | Render (ms) | Tỷ lệ độ phân giải |
|---|---:|---:|---:|---:|---:|
| desktop-balanced-auto | 59.34 | 30.03 | 16.70 | 3.41 | 60–60% |
| desktop-performance-auto | 59.34 | 29.94 | 16.80 | 2.71 | 65–65% |
| desktop-ultra-fixed | 31.59 | 19.96 | 33.40 | 4.74 | 100–100% |
| mobile-landscape-performance | 60.00 | 59.52 | 16.70 | 2.09 | 85–85% |
| desktop-night-rain-nitro-camera | 57.13 | 29.94 | 33.30 | 4.26 | 60–60% |
| ending-continuous-night-ride | 59.66 | 29.94 | 16.80 | 3.50 | 55% |

Mỗi mẫu gameplay có 179 khoảng RAF sau warmup. Bài mưa/Nitro/đổi camera có 180 frame Nitro hoạt động từ bình ban đầu 100, không vô hạn năng lượng. Không khóa hoặc sửa số FPS; frame chậm vẫn tính. Đây là phép đo ngắn trên máy dùng chung, không phải đảm bảo mọi phần cứng. Balanced mới khoảng 59.34 FPS so với baseline V8 High 29.32 FPS ở cùng viewport 1440×900; so sánh là cả gói tối ưu/auto quality, không cùng số pixel render hay cùng thời điểm tải máy.

Chi tiết máy, raw metric: [performance.json](../previews/v9/performance.json), [baseline V8](../previews/v9/baseline-v8-performance.json). Bằng chứng chức năng: [browser hồi quy](../previews/v9/browser-results.json), [browser V9](../previews/v9/v9-browser-results.json), [3 vòng qua lối tắt](../previews/v9/shortcut-laps.json).

[Bằng chứng 10 vòng tuyến chính](../previews/v9/main-laps.json) · [46 unit TAP](../previews/v9/unit-results.tap) · [Video đoạn kết liên tục 47 giây](../previews/v9/ending.mp4). Video được quay từ nút xem trước qua toàn bộ timeline thật, không tua state; bản ghi màn hình không kèm track âm thanh. Game có WebAudio trực tiếp.

## Xuất bản và tải xuống

Đã đẩy nhánh phát triển và `main`, gắn tag `v9.0.0`. GitHub Pages xây dựng thành công bản game `29138cf`. Kiểm tra 30 tài nguyên HTTPS công khai khớp SHA-256 với mã phát hành; Chromium chạy ga và xem/bỏ qua đoạn kết thành công, không thay save, không lỗi JS hoặc thiếu tài nguyên. Do CA của Chromium trong cloud, bài này dùng gateway loopback lấy nguyên byte qua curl có xác thực TLS; không tắt TLS hay sửa trust store. [Bằng chứng](../previews/v9/published-smoke.json).

[Chơi ngay](https://khai293.github.io/dua-xe/?v=9) · [Tải ZIP](https://khai293.github.io/dua-xe/downloads/Duong_Den_Tinh_Yeu_V9.zip) · [Checksum](https://khai293.github.io/dua-xe/downloads/V9_SHA256SUMS.txt). ZIP chứa mã game/tài nguyên, hướng dẫn và kiểm thử; không cần tải riêng ảnh/âm thanh. Giải nén rồi `npm run dev` bằng Node.js 22+.
