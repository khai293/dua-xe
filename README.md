# dua-xe
Dự án game đua xe Hải Phòng

# Hải Phòng Grand Prix V8 — Definitive Edition

Game web anime **2.5D**, nâng cấp từ file V7 người dùng cung cấp. Đây là bản V8 chơi được; các giới hạn nghiệm thu còn lại được ghi rõ trong [báo cáo QA](docs/QA.md).

## Chơi trực tiếp trên GitHub Pages

Địa chỉ mặc định sau khi bật Pages: **https://khai293.github.io/dua-xe/**

Nếu chưa xuất bản, làm theo [hướng dẫn GitHub Pages](docs/GITHUB_PAGES.md): Settings → Pages → Deploy from a branch → main → / (root) → Save.

## Chạy game

Cần Node.js 22 trở lên. Chạy trong thư mục repository:

```sh
npm run dev
```

Mở máy chủ tại cổng **4173** bằng trình duyệt. Không mở `index.html` bằng `file://`: các module và dữ liệu bản đồ cần HTTP. Game và toàn bộ hình ảnh/âm thanh chạy từ tài nguyên cục bộ; không cần API key, CDN hoặc dịch vụ backend. Âm thanh chỉ bắt đầu sau thao tác người dùng.

## Điều khiển

- **W / ↑**: ga; **S / ↓ / Space**: phanh.
- **A D / ← →**: lái; **Shift**: cúi người.
- **C**: đổi một trong ba camera; **R**: cứu hộ checkpoint; **Esc / P**: tạm dừng.
- Tay cầm chuẩn: cần trái lái, RT/A ga, LT/B phanh, LB cúi người.
- Điện thoại có nút cảm ứng; chơi ngang để tăng khoảng nhìn. Kích thước và độ rõ nút chỉnh trong cài đặt.

Đây là **Đua tự chọn**, không phải khám phá tự do. Người chơi thực sự điều khiển tọa độ và góc xe. Đường đua có rào chắn; cần đi qua checkpoint theo đúng thứ tự và đúng hướng. Cứu hộ đưa về checkpoint trước, cộng 8 giây.

## Nội dung

Giữ 4 loại xe, 5 chương hội thoại và 10 tuyến OSM của V7. Có đối thủ AI, vật cản theo mức độ, vật phẩm phải chạm thật, ngày/hoàng hôn/đêm, mưa giảm độ bám và sương giảm tầm nhìn. Aurora/Lucien và các đối thủ có tài nguyên anime mới. Cutscene có các tư thế chạy tới, đỡ đứng dậy, bế, cười và hôn má. Ba lần cứu hộ thật kích hoạt cảnh hôn má; xem thử không cấp thành tích hay tăng bộ đếm.

## Tiến trình

Lưu vào `hpmoto.v8.save` trong localStorage. Nếu các khóa V7 có trên **cùng origin/trình duyệt**, game đọc tiến trình cũ mà không xóa chúng. Bộ đếm bế cũ lấy `max`, tránh cộng hai bộ đếm trùng. Các huy chương do overlay V7 cấp sai không được mặc nhiên coi là hợp lệ.

Trình duyệt không cho website mới đọc localStorage của `file://` hoặc địa chỉ khác. Cài đặt có **Xuất/Nhập tiến trình JSON** cho bản V8. Trước khi nhập, bản hiện tại được giữ ở `hpmoto.v8.before-import`. Không có cơ chế tự lấy save trên máy cá nhân từ file HTML đã tải lên.

## Kiểm tra và đóng gói

```sh
npm ci
npm test
npm run test:maps
npm run dev
# Trong terminal khác, với Chromium được cài:
npm run test:browser
npm run build
```

`playwright-core` chỉ là công cụ phát triển, được khóa phiên bản trong lockfile. `CHROMIUM_PATH` đặt đường dẫn trình duyệt nếu khác `/usr/bin/chromium`. Không cần cài dependency để chạy máy chủ hoặc bản game. `npm run build` tạo bộ web tĩnh trong `dist/`; có thể đưa nguyên thư mục này lên máy chủ web tĩnh.

`test:maps` dùng bộ điều khiển chỉ nằm trong kiểm thử để chạy hết 10 tuyến bằng ga/phanh/lái, không dịch chuyển xe. Game phát hành không có tự lái. API phục vụ kiểm thử chỉ xuất hiện khi thêm `?test=1`.

## Tài liệu và ảnh thật

- [Audit V7 và lỗi đã tái hiện](docs/V7_AUDIT.md)
- [Thiết kế nhân vật, phong cách và tài nguyên](docs/ART_DIRECTION.md)
- [Kiểm thử, số đo và các phần chưa hoàn thiện](docs/QA.md)
- [Ảnh menu](previews/menu.png), [đua ban ngày](previews/race-day.png), [ban đêm](previews/race-night.png), [Aurora](previews/aurora.png), [Lucien](previews/lucien.png), [cảnh bế](previews/carry.png), [cảnh hôn má](previews/kiss.png)
- [Video quay game thật](previews/gameplay.mp4)

Dữ liệu đường/mặt nước © OpenStreetMap contributors, ODbL 1.0. Hình học địa lý được trích nguyên từ dữ liệu kèm V7; đường đua được bo góc và nới rộng cho gameplay. Công trình và bối cảnh là kiến trúc cách điệu, không phải bản sao khảo sát chính xác Hải Phòng.
