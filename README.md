# Đường Đến Tình Yêu V9

**Ultimate Racing & Love Story** — game đua xe anime 2.5D qua các cung đường Hải Phòng.

**[Ấn để chơi trên trình duyệt](https://khai293.github.io/dua-xe/?v=9)** · [Tải bộ game ZIP](https://khai293.github.io/dua-xe/downloads/Duong_Den_Tinh_Yeu_V9.zip)

Bản V9 tiếp tục trực tiếp V8: giữ 10 đường OSM, 4 xe, nhân vật, cảnh cứu hộ/hôn má và đọc tiến trình cũ. Thêm Drift, Nitro, gara, đổi tên, lối tắt, AI có chuyển động vật lý và đoạn kết sau khi thắng Lucien.

## Điều khiển

- **W / ↑**: tăng ga; **S / ↓**: phanh; **A D / ← →**: đánh lái.
- **Space**: giữ Drift cùng đánh lái và một nhịp phanh ở tốc độ đủ cao; thả để nhận Nitro từ pha drift sạch.
- **E**: giữ dùng Nitro; **Shift**: cúi người.
- **C**: đổi camera; **R**: cứu hộ (+5 giây); **Esc / P**: tạm dừng.
- Tay cầm chuẩn: cần trái lái, RT/A ga, LT/B phanh, X Drift, RB Nitro, LB cúi người.
- Điện thoại: xoay ngang, dùng các nút cảm ứng nhiều ngón. Chỉnh kích thước, độ rõ và toàn màn hình trong giao diện.

Xe không tự lái. Đua qua checkpoint đúng hướng, đúng thứ tự hoặc chọn nhánh lối tắt đã đánh dấu. Không có popup checkpoint lớn. Mưa giảm độ bám; phanh trước cua giúp giữ quỹ đạo.

## Hành trình và gara

Có đúng 5 chương: Khởi đầu bên hồ → Gió qua vườn hoa → Thử thách phố cổ → Cuộc đua hoàng hôn → Đường Đến Tình Yêu. Đối thủ lần lượt Minh, Nhi, Phong, Rin và Lucien. Thắng chương trước để mở chương sau; cả 10 tuyến vẫn có trong Đua tự chọn.

Gara cho phép nâng động cơ, lốp, phanh, Nitro và ổn định, mỗi mục tối đa 3 cấp. Xu đến từ kết quả đua hợp lệ và Drift thành công. Có xem trước màu xe, mũ, áo, găng và phụ kiện, giữ khuôn mặt và tóc gốc. Hai tên nhân vật hỗ trợ Unicode, lưu tự động; tên hiển thị không làm thay ID nội bộ.

Thắng boss chương 5 ở vị trí đầu tiên mở đoạn kết 46 giây: chiến thắng, chúc mừng, mở hộp vòng tay, đi cùng một xe qua phố đêm, tới quán và ăn tối. Quà lưu trong **Kỷ niệm tình yêu**, có xem lại. **Xem trước không cấp xu, quà hoặc chiến thắng.** Bỏ qua đoạn kết vẫn giữ phần thưởng đã nhận hợp lệ. Cứu hộ khi va chạm nặng/rượt đuổi áp dụng phạt 8 giây; mỗi ba lần cứu hộ thật có cảnh hôn má.

## Chạy và build

Cần Node.js **22 trở lên**:

```sh
npm run dev
```

Mở `http://127.0.0.1:4173/`. Không mở `index.html` bằng `file://` vì module và bản đồ cần HTTP. Game không cần API key, CDN hay backend; âm thanh khởi động sau thao tác người dùng.

```sh
npm ci
npm test
npm run test:maps
npm run test:shortcuts
# Giữ npm run dev ở một terminal khác; cần system Chromium:
npm run test:browser
npm run test:v9
npm run test:performance
npm run build
```

`CHROMIUM_PATH` có thể đặt đường dẫn cho kiểm thử hồi quy nếu khác `/usr/bin/chromium`. `playwright-core` chỉ dùng để phát triển. Build tạo `dist/`, triển khai nguyên nội dung lên web tĩnh. GitHub Pages hiện lấy `main` → `/ (root)`; root cũng là bộ web chạy được. Xem [triển khai Pages](docs/GITHUB_PAGES.md).

## Lưu tiến trình

V9 lưu tại `hpmoto.v9.save`, tự đọc `hpmoto.v8.save` hoặc các khóa V7 trên **cùng trình duyệt/origin**, không xóa bản cũ. Tiến trình, kỷ lục và bộ đếm được giữ; quà V9 bắt đầu chưa nhận, kể cả save V8 từng thắng boss.

Cài đặt có xuất/nhập JSON V8/V9. Bản trước khi nhập được giữ tại `hpmoto.v9.before-import`. Website không thể tự đọc localStorage của file HTML hoặc địa chỉ khác; dùng JSON để chuyển save giữa các địa chỉ.

## Kiểm thử và giới hạn

[Báo cáo V9, số đo và các tệp thay đổi](docs/V9_RELEASE.md) · [Ảnh V9](previews/v9/) · [QA lịch sử V8](docs/QA.md) · [Audit V7](docs/V7_AUDIT.md)

Vật lý chạy 120 Hz, nội suy khi vẽ; Performance/Balanced/Ultra cùng tự giảm độ phân giải/chi tiết khi chậm. HUD phát triển báo FPS thực, P95, vật lý/AI, render, số vật thể và bộ nhớ khi trình duyệt cung cấp. 60 FPS là mục tiêu; số đo cloud và giả lập cảm ứng không thay thế thử trên Android thật.

Dữ liệu đường/mặt nước © OpenStreetMap contributors, ODbL 1.0, trích từ V7. Đường được bo góc/nới rộng cho cuộc đua; phố, cầu, cảng và công trình là bối cảnh minh họa cách điệu, không phải bản đồ dẫn đường hoặc bản sao địa điểm khảo sát. Không có dịch vụ mạng khi chơi ngoài việc tải tệp game.
