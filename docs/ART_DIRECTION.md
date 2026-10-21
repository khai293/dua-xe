# Định hướng hình ảnh V8 và Character Design Bible

## Quyết định: anime 2.5D

Audit V7 cho thấy Three.js dựng nhân vật bằng sphere/capsule/tube, nhiều lớp vá tóc và khuôn mặt. Cách này khó giữ nhận diện và tỷ lệ mặt trong camera gần. V8 dùng một ngôn ngữ hình ảnh minh họa: Canvas2D chiếu phối cảnh tọa độ thế giới thật, mặt đường/rào chắn/checkpoint cùng không gian, nhà và nhân vật là sprite có chiều sâu và bóng tiếp đất.

Đã dựng và chạy prototype 2.5D có Aurora/Lucien, một đoạn phố, góc cua, hướng dẫn rẽ, cửa hàng, cây, khán giả và vật cản. V7 được chạy để audit và làm đối chứng 3D cũ. **Chưa dựng một prototype 3D nâng cấp riêng**; không coi so sánh V7/2.5D là thử nghiệm A/B có cùng chất lượng asset hoặc đo cùng thiết bị vật lý.

Tất cả ảnh trong `previews/` là chụp UI/renderer đang chạy. `assets/hero.png`, `carry.png`, `kiss.png` là **minh họa được dùng trực tiếp** trong menu/cutscene, không được mô tả như ảnh render 3D.

## Aurora

- Nhận diện giữ từ ảnh V7: tóc nâu đậm dài, nhiều lớp uốn mềm, mắt hổ phách, kính tròn gọng vàng, hoa cúc trắng và ruy băng kem.
- Trang phục: áo navy với nút đỏ nhỏ; quần short ngà; giày/sandal sáng. Không thay mái tóc bằng hình khối hoặc bỏ kính ở cảnh gần.
- Phối màu chủ đạo: nâu `#493128`, navy `#253146`, kem `#ede5ce`, vàng `#d5b575`, coral `#d96959`.
- Tỷ lệ: anime trưởng thành cách điệu, đầu lớn vừa phải và thân/chi rõ; sprite ngồi thấp trên yên, tay bám ghi đông, chân gần gác chân.
- `expressions.png` hàng trên: vui, tập trung, bất ngờ, lo lắng, giận dỗi, xấu hổ, cười hạnh phúc, nhắm mắt. Chân dung truyện, avatar và mood khi đua dùng sheet thật này.
- `bikes.png`: bốn hàng tương ứng xe xanh dương, xanh lá, scooter mint và sport coral; bốn cột là sau, nghiêng trái, nghiêng phải và trước 3/4. Camera dùng pose theo góc và nghiêng xe.
- `characters.png` hàng đầu chứa các tư thế đứng; hàng thứ ba là pose lái gốc, giữ trong bộ tài nguyên/nguồn thiết kế.

## Lucien

- Tóc đen dày, ngôi lệch với nhiều lọn, mắt hổ phách; áo khoác xanh ô liu mở trên áo trắng, quần tối và boots.
- Phối màu: tóc `#25252a`, ô liu `#737962`, trắng `#eee9db`, than `#34383b`, teal `#225b5b`.
- `expressions.png` hàng dưới: bình tĩnh, tự tin, lo lắng, tinh nghịch, cười, dịu dàng, ngượng và vui.
- `characters.png` hàng hai có tư thế đứng/biểu cảm; hàng bốn là lái xe teal với các hướng sau/trái/phải/trước 3/4.
- Cutscene giữ đúng tóc, màu áo, khuôn mặt và chỗ đỡ lưng/đầu gối Aurora.

## Đối thủ và phố

`rivals.png` chứa Minh (cam), Nhi (turquoise), Phong (xanh/forelock bạc) và Rin (đỏ rượu/đuôi ngựa). Hàng đầu là chân dung, hàng dưới là pose lái sau. Các đối thủ có sprite riêng trong gameplay, không dùng Lucien thay tên.

`city-atlas.png`: cà phê vàng, quán bánh đa cua hồng, hiệu sách teal, tiệm kem, cây phượng/ghế đá, nhà hát cách điệu, nhà phố đôi, chòi cà phê ven nước. Nhà hát neo theo footprint OSM khi gần tuyến. Chòi ven nước là công trình hư cấu. Vị trí mặt tiền dọc tuyến được kiểm tra tránh mặt đường và nước; vỉa hè/rào chắn theo cùng hình học đường. Cây, đèn và người được chọn theo khoảng cách cung thay vì mật độ node OSM.

Lớp gần có curb, vạch, mặt đường, vỉa hè và đạo cụ; lớp giữa có asset mặt phố/cây/khán giả; lớp xa là skyline cảng, mây và haze. Ban đêm dùng cùng cảnh với tint, đèn và phản chiếu; không đổi sang phong cách khác.

## Animation và giới hạn asset

- Khi lái: chuyển pose nghiêng, xoay sprite nhẹ, nhún theo tốc độ, đèn phanh, tóc trong silhouette động và vệt gió.
- `cinema-atlas.png` 4×2: Aurora ngồi sau sự cố, Lucien chạy tới, đỡ ngồi, đứng dậy, hai pose bước bế, cười và hôn má. `carry-walk.png` cung cấp hai frame bước bế có lề riêng để tránh tràn tile; nhịp hôn dùng minh họa `kiss.png`. Engine timeline điều khiển tiếp cận, hỗ trợ, bế, hôn và rời đi; không dùng timer DOM để cấp thưởng. Minh họa toàn cảnh xuất hiện ở nhịp cuối.
- Hiện có chuyển tư thế theo frame và chu kỳ bước ngắn, chưa phải animation vẽ tay nhiều frame mượt ở mọi hướng. Tóc/vải dùng pose và chuyển động lớp, chưa có mô phỏng độc lập từng sợi.
- Chưa có turnaround toàn thân đứng trước/sau/trái/phải đầy đủ; các hướng sẵn có ưu tiên tư thế lái. Đối thủ có ít hướng hơn hai nhân vật chính.

## Nguồn và tái tạo

Các PNG mới được tạo bằng công cụ tạo ảnh trong phiên làm việc, dựa trên nhận diện từ ảnh trong file V7 do người dùng cung cấp. Asset được gắn thật vào renderer/UI qua `assets/manifest.json`. Không có ảnh tải từ nguồn chưa xác định hoặc phụ thuộc CDN lúc chơi.

OSM nằm trong `haiphong-osm.json`: giữ attribution, URL nguồn và metadata của dữ liệu V7. Không tuyên bố dữ liệu mới được truy vấn lại. Dữ liệu OSM theo ODbL 1.0: https://opendatacommons.org/licenses/odbl/1-0/ ; attribution: https://www.openstreetmap.org/copyright .
