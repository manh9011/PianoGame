# Hướng dẫn dự án

- Dự án sử dụng i18n cho toàn bộ text hiển thị trên giao diện. Khi xây dựng chức năng mới hoặc chỉnh sửa UI, không được hard-code text trực tiếp trong component/template/script; phải thêm key vào các file locale trong `src/i18n/locales/` cho đầy đủ mọi ngôn ngữ đang hỗ trợ và dùng `t(...)`/cơ chế i18n tương ứng để hiển thị.