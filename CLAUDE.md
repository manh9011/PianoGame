# Hướng dẫn dự án

- Dự án sử dụng i18n cho toàn bộ text hiển thị trên giao diện. Khi xây dựng chức năng mới hoặc chỉnh sửa UI, không được hard-code text trực tiếp trong component/template/script; phải thêm key vào các file locale trong `src/i18n/locales/` cho đầy đủ mọi ngôn ngữ đang hỗ trợ và dùng `t(...)`/cơ chế i18n tương ứng để hiển thị.

## Tìm kiếm và hiểu nhanh codebase bằng CocoIndex Code (`ccc`)

- Dự án đã cấu hình CocoIndex Code tại `.cocoindex_code/settings.yml`; dùng CLI `ccc` để tìm kiếm ngữ nghĩa khi cần hiểu nhanh kiến trúc, luồng xử lý, component/store/module liên quan, hoặc khi câu hỏi không chỉ là tìm chuỗi chính xác.
- Ở đầu mỗi session mới, hoặc trước lần tìm kiếm ngữ nghĩa đầu tiên trong session, kiểm tra độ sẵn sàng của index bằng `ccc status`. Nếu index có vẻ cũ sau khi có thay đổi code đáng kể, chạy `ccc index` hoặc dùng `ccc search --refresh ...` trước khi dựa vào kết quả.
- Khi tìm theo khái niệm/hành vi, ưu tiên `ccc search <mô tả chức năng>` thay vì chỉ dùng grep. Ví dụ: `ccc search "track settings bpm synchronization"`, `ccc search "library import midi flow"`, `ccc search "player store playback state"`.
- Có thể thu hẹp phạm vi bằng `--path` và `--lang`, ví dụ: `ccc search --path "src/stores/*" "settings persistence"` hoặc `ccc search --lang vue "track configuration dialog"`.
- Sau khi `ccc search` trả về file và line range, luôn mở file bằng công cụ đọc file để xem ngữ cảnh thật trước khi kết luận hoặc chỉnh sửa. Dùng `Grep`/`Glob` song song khi cần tìm định danh, key i18n, import, hoặc chuỗi chính xác.
- Sau khi thêm/xóa/đổi tên nhiều file hoặc refactor lớn, chạy `ccc index` để cập nhật chỉ mục cho các session/tìm kiếm tiếp theo.
- Nếu `ccc search` hoặc `ccc index` báo chưa khởi tạo dự án, chạy `ccc init` ở thư mục gốc dự án rồi `ccc index`; nếu lệnh `ccc` không tồn tại, báo cho người dùng cần cài CocoIndex Code.
