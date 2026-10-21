# Báo cáo V8 — kiểm thử và giới hạn nghiệm thu

Ngày kiểm tra: 21/10/2026. Bản chơi được đã triển khai trong cùng repository. Các kiểm tra bên dưới đã chạy thật; tên “Definitive Edition” là tên sản phẩm mục tiêu, không phải chứng nhận rằng mọi tiêu chí chất lượng nghệ thuật và mọi thiết bị đã được nghiệm thu.

## Kết quả chạy

| Lệnh / phép kiểm tra | Kết quả | Phạm vi thực tế |
|---|---|---|
| `npm ci --cache /workspace/.cloud-tools/npm-cache --ignore-scripts --no-audit --no-fund` | Đạt | Cài đúng lockfile, không sửa dependency để vượt lỗi |
| `npm test` | **22 đạt, 0 lỗi, 0 bỏ qua** | Logic, save migration, checkpoint, collision, reward, cutscene, preview, thời tiết, điều khiển và backup JSON |
| `npm run test:maps` | **10/10 về đích hợp lệ** | Mô phỏng chỉ bằng ga/phanh/lái; giữ vật cản và vật phẩm; không sửa tọa độ, không cứu hộ |
| `npm run test:browser` | **17 đạt, 0 lỗi** | Chromium thật qua Playwright; menu, UI, điều khiển, scene state, save và asset |
| `npm run build` | Đạt | Tạo bộ web tĩnh `dist/` |
| Ảnh và video | Đã chụp/quay | `previews/`, từ UI/renderer chạy trong Chromium; video là CDP screencast có timestamp |

Không có lỗi JavaScript chưa bắt hoặc asset runtime trả 4xx/5xx trong lần browser QA cuối. Renderer là Canvas2D nên không có pipeline WebGL ở V8.

Kết quả máy đọc được: [browser-results.json](../previews/browser-results.json), [performance.json](../previews/performance.json), [video-capture.json](../previews/video-capture.json).

## Lỗi V7 đã xác nhận và cách xử lý

V7 được mở nguyên bản trên Chromium để tái hiện, không mặc định mọi lỗi trong prompt đều đúng. Chi tiết nguồn và bằng chứng trong [V7_AUDIT.md](V7_AUDIT.md).

- **Hai bộ đếm bế:** engine chính và overlay V6 ghi riêng. V8 chỉ có `GameEngine.save.totalCarries`; chuyển dữ liệu cũ bằng `max` hai giá trị để không cộng trùng.
- **Xem thử tăng bộ đếm phụ:** V8 lưu và phục hồi nguyên trạng thái trước preview; không ghi số bế, affection, gifts, badges hoặc tiến trình. Kiểm thử so sánh cả save lẫn localStorage trước/sau.
- **Skip chỉ ẩn giao diện:** V8 gọi kết thúc state machine, dọn cutscene/camera, ngừng cue/animation, phục hồi phase hợp lệ. Cứu hộ thật chỉ cộng một lần 8 giây và có cooldown 12 giây.
- **Result cấp thưởng từ DOM:** V8 chỉ cấp kết quả sau khi engine xác nhận toàn bộ thứ tự checkpoint và vòng đua. Màn hình cứu hộ/preview không có quyền cấp huy chương.
- **Vật phẩm theo timer/tiến độ:** V8 dùng kiểm tra khoảng cách đến đoạn xe vừa đi qua với hitbox vật phẩm; không chạm thì không nhận.
- **Mọi vật cản dẫn đến bế:** V8 chia light/medium/severe theo vật thể và tốc độ tác động. Cọc tiêu nhẹ không bế; va rào sượt khác va trực diện mạnh; có hồi va chạm.
- **Hoàn thành bằng khoảng cách:** V8 yêu cầu cắt cổng vật lý, đúng hướng, đúng bề rộng và thứ tự; từ chối đi tắt/teleport.
- **Tên Đua tự do gây hiểu nhầm:** đổi thành **Đua tự chọn**. Xe tự lái thật trong tọa độ thế giới nhưng đua trong hành lang đóng, không quảng cáo mạng đường khám phá tự do.
- **Ultra làm mặc định:** mặc định Cao hoặc đề xuất Thấp tùy khả năng báo cáo của thiết bị; giới hạn pixel ratio, culling, giảm mật độ ở mức Thấp. Không âm thầm ghi đè tùy chọn đã lưu.
- **Mưa chỉ đổi hình:** mưa giảm hệ số bám/phanh; sương làm giảm khả năng nhìn xa. Thời tiết/ánh sáng dùng cùng hệ môi trường.

## Browser QA

17 trường hợp đã thực thi, không có zero-test run:

1. Boot, 4 xe và 10 bản đồ tự chọn có dữ liệu thật.
2. Chọn từng xe truyền đúng cấu hình gameplay.
3. Chọn và khởi động cả 10 tuyến từ menu.
4. Tải cả 5 chương với hội thoại gốc. Fixture mở khóa 5 chương phục vụ QA; đây không phải tuyên bố đã thắng cả 5 bằng tay.
5. Không bấm ga thì xe đứng; W tăng tốc và D đổi góc xe thật.
6. Pause đóng băng thời gian, Resume chạy tiếp; camera, ngày/đêm và mưa có hiệu lực.
7. Xem thử bế/hôn và Skip không làm đổi save hoặc localStorage.
8. Light không bế; sự kiện severe thật trong engine đếm một lần, lần 3 hôn; đúng 24 giây phạt sau ba cứu hộ. Phần severity này dùng event injection; kiểm thử engine riêng kiểm tra va chạm không gian.
9. Một vòng OSM Hồ Sen hoàn thành trong browser bằng bộ điều khiển chỉ ở kiểm thử, không sửa vị trí và không cứu hộ; kết quả hợp lệ, Retry và về gara hoạt động.
10. Layout 390×844, 844×390 và 1440×1000: không tràn ngang; Start tới được qua cuộn; navigation không chồng HUD trên hoặc nút lái.
11. Cảm ứng trong context mobile: dùng `Input.dispatchTouchEvent` của Chromium, giữ ga tăng tốc, thả không kẹt nút. Bài thử pointer tổng hợp ban đầu không tương thích pointer capture; đã thay bằng sự kiện chạm thật của browser, không làm yếu assertion tốc độ.
12. Đo frame time trong browser, lấy mẫu heap qua nhiều restart.
13. Gamepad standard mapping giả lập: analog lái và trigger ga có tác động; không có bàn phím hỗ trợ.
14. Reload cùng origin giữ cấu hình/tiến trình, về menu ngừng âm thanh.
15. Xuất JSON tải file thật; nhập lại qua input file phục hồi số bế và giữ backup trước nhập.
16. 20 restart + garbage collection: cache tối đa 10 tuyến và tăng heap trong ngưỡng hữu hạn.
17. Không lỗi JavaScript chưa bắt, không missing runtime asset.

## Mô phỏng toàn bộ 10 map

`tests/full-laps.mjs` dùng feedback controller chỉ có trong kiểm thử. Không có tính năng tự lái trong bản game thường. Vật cản không bị tắt trong lần chạy toàn tuyến cuối; bộ lái theo tuyến có thể tránh chúng. Ở mức difficulty 0.7, thời tiết quang, các tuyến đều hoàn thành với 0 va chạm và 0 giây cứu hộ.

| Tuyến | Thời gian mô phỏng (giây) | Cổng qua đúng thứ tự |
|---|---:|---:|
| Tam Bạc khởi đầu | 211.7 | 39 |
| Dải vườn hoa trung tâm | 166.9 | 30 |
| Phố cổ bên sông | 346.0 | 62 |
| An Biên · Quần Ngựa | 359.3 | 66 |
| Chung kết thành phố | 781.3 | 143 |
| Quần Ngựa · Vòng hẹn hò | 90.1 | 15 |
| Hồ Sen · Buổi chiều | 66.6 | 10 |
| Tố Hữu · Kim Đồng | 96.9 | 17 |
| Phố Lãn Ông · Tam Bạc | 84.2 | 13 |
| Minh Khai · Hoàng Văn Thụ | 146.2 | 25 |

Đây là kiểm tra hình học và luật đua, không thay thế chơi bằng tay để đánh giá độ vui hoặc cân bằng mọi độ khó.

## Hiệu năng đã đo

Công cụ: Chromium hệ thống chạy headless trong container cloud, Playwright, requestAnimationFrame. Các phép đo riêng dùng 94 frame sau warm-up, cảnh xuất phát Tam Bạc. Không đo tải GPU/CPU phần cứng vì không có profiler phần cứng. Thời gian JS render không bao gồm toàn bộ compositor.

| Kịch bản | FPS trung bình | Mean frame | P95 |
|---|---:|---:|---:|
| Desktop 1440×900, Cao | 31.5 | 31.7 ms | 33.4 ms |
| Desktop 1440×900, Thấp | 34.4 | 29.1 ms | 33.4 ms |
| Mobile giả lập 844×390, Thấp | 59.4 | 16.8 ms | 16.8 ms |

Suite tích hợp dài có lúc mức Cao khoảng 25–32 FPS. **Chưa đạt/xác nhận mục tiêu desktop 60 FPS** trong môi trường này. Con số mobile giả lập không chứng minh điện thoại tầm trung thật đạt 30/60 FPS. Không dùng tốc độ mô phỏng headless để tuyên bố FPS render.

Sau 20 lần khởi động lại, ép GC: heap tăng khoảng 2.6 MB khi điền cache 10 tuyến, không vượt ngưỡng 15 MB của stress test ngắn. Fallback canvas nhà/cây chỉ tạo khi thiếu atlas để giảm bộ nhớ không dùng. Đây chưa phải kiểm chứng không leak trong nhiều giờ chơi.

## Hình ảnh, animation và phần chưa nghiệm thu đủ

Đã thay asset chính bằng bộ PNG anime có thật: 16 biểu cảm hai nhân vật, pose lái 4 loại xe, đối thủ riêng, phố/cây/công trình, pose cứu hộ, ảnh menu và minh họa hôn/bế. Đã sửa vùng crop sprite để tránh mảnh ảnh tile kế bên ở cảnh hôn; nhịp hôn dùng minh họa riêng. Asset và screenshot là hai loại tài liệu khác nhau, ghi rõ trong [ART_DIRECTION.md](ART_DIRECTION.md).

Các phần còn giới hạn:

- Animation dùng các key pose/chu kỳ bước ngắn; chưa phải hệ nhiều frame vẽ tay và mô phỏng tóc/vải độc lập ở mọi góc. Chưa có turnaround đứng đủ bốn phía hoặc nhiều biến thể cutscene hoàn chỉnh.
- Mười tuyến có hình học/khúc cua/địa hình OSM riêng, nhưng dùng chung bộ kiến trúc theo quy tắc. Chưa có 15 cảnh quan được họa sĩ thiết kế riêng cho từng chương/map hoặc mô hình riêng mọi địa danh/cầu.
- NPC khán giả có chuyển động cơ bản; chưa có mô phỏng sinh hoạt/đối thoại/luồng giao thông đô thị độc lập đầy đủ.
- Chỉ prototype 2.5D mới được dựng; V7 là đối chứng 3D cũ. Chưa có prototype 3D nâng cấp tương đương để so A/B công bằng.
- Chưa thử điện thoại hoặc tay cầm vật lý, Safari/iOS, Firefox, phiên chơi nhiều giờ, GPU memory hoặc dữ liệu save từ máy cá nhân của người dùng.
- Save V7 bị ô nhiễm bởi preview trước đây không thể khôi phục chính xác lịch sử thật. Chuyển origin không tự đọc được localStorage cũ; V8 cung cấp backup JSON cho các phiên V8.

## Chạy và bàn giao

`npm run dev` chạy máy chủ cổng 4173. Các file build tĩnh trong `dist/` dùng được trên máy chủ web tĩnh. ZIP bàn giao chứa source/module, assets, scripts, lockfile, tests, docs, screenshot và video, không chứa node_modules hay credential.

Đã cập nhật bản nháp môi trường ở `install_script` và `start_skill` để khởi động V8 thay hướng dẫn README-only cũ. Lưu bản nháp không publish. **Review and publish** là bước người dùng thực hiện trong panel nếu muốn xuất bản snapshot môi trường. Chưa xác nhận phục hồi trong task mới hoặc đẩy mã lên GitHub.
