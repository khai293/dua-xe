# Chơi trực tiếp bằng GitHub Pages

Game là bộ web tĩnh, không cần Node.js trên máy người chơi sau khi xuất bản.

Trong repository `khai293/dua-xe`, mở **Settings → Pages**:

1. **Source:** chọn **Deploy from a branch**.
2. **Branch:** chọn **main**, thư mục **/ (root)**.
3. Bấm **Save**, đợi tác vụ Pages hoàn thành.

Địa chỉ mặc định sau khi Pages xuất bản thành công:

**https://khai293.github.io/dua-xe/**

Nếu đang dùng tên miền riêng, ưu tiên địa chỉ GitHub hiển thị trong Settings → Pages. Đây là địa chỉ dự kiến, không phải bằng chứng rằng Pages đã được bật.

`index.html`, `src/`, `assets/` và `style.css` đã ở gốc repo; `.nojekyll` cho phép phục vụ trực tiếp. Giữ nguyên tên thư mục và chữ hoa/thường. Mọi ảnh và dữ liệu đều dùng đường dẫn tương đối để hoạt động dưới `/dua-xe/`.

Tiến trình chơi lưu riêng trong trình duyệt tại địa chỉ Pages. Có thể dùng Xuất/Nhập JSON trong cài đặt để chuyển tiến trình V8 từ địa chỉ cũ.
