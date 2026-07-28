# Hướng dẫn dự án

- Dự án sử dụng i18n cho toàn bộ text hiển thị trên giao diện. Khi xây dựng chức năng mới hoặc chỉnh sửa UI, không được hard-code text trực tiếp trong component/template/script; phải thêm key vào các file locale trong `src/i18n/locales/` cho đầy đủ mọi ngôn ngữ đang hỗ trợ và dùng `t(...)`/cơ chế i18n tương ứng để hiển thị.
- Khi thêm text vào các file locale trong `src/i18n/locales/` phải đảm bảo text được dịch chính xác sang ngôn ngữ đó rồi mới thêm, không chỉ làm qua loa kiểu copy text Tiếng Anh sang.
- Không cần phải restore file tsconfig.tsbuildinfo sau khi build