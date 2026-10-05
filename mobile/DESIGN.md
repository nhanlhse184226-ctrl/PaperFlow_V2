# PaperFlow Mobile — hướng thiết kế

Nguồn tham khảo: UI UX Pro Max (https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), local skill đã đọc ngày 30/09/2026.

Query ban đầu `research education mobile minimal` trả về pattern newsletter không phù hợp app. Query thu hẹp `productivity workspace mobile` cho Flat Design, teal, bố cục ít nhiễu; áp dụng hướng này cùng Flutter guidance về Semantics và chuyển màn native.

- Màu: xanh rừng #205D50, chữ #173E36, nền giấy #F6F7F2, xanh nhạt #E0EEE4, vàng nhạt #F1D598. Chữ nhỏ không dùng màu vàng làm foreground.
- Font: Roboto đi kèm app (giấy phép Apache trong assets/fonts), không tải font từ mạng, hỗ trợ tiếng Việt. Thay cho đề xuất Plus Jakarta Sans để bản local chạy độc lập tài nguyên ngoài.
- Navigation: 3 tab gốc Dự án / Góc chia sẻ / Tài khoản; workspace có 4 bước Đề tài / Tài liệu / Bằng chứng / Bài viết.
- Minh họa vector tự vẽ: giấy nghiên cứu + kính lúp + dấu xác minh. Không dùng dữ liệu nghiên cứu giả để trang trí sản phẩm thật.
- Các thẻ có padding 20–24, nút tối thiểu 48dp, safe areas, nội dung dài được xuống dòng và chọn/copy.
- Animation: chuyển bước 220ms; pulse nhẹ khi đang xử lý; tắt animation theo cài đặt hệ điều hành. Không hiển thị phần trăm AI giả; chỉ hiển thị tiến độ upload thực khi có.
- Evidence chuyển từ bảng desktop sang thẻ mobile có bộ lọc; thông tin đầy đủ nằm ở màn hình provenance và PDF gốc.
- Loading/error/empty có nội dung cụ thể; không có trạng thái thành công giả khi API thất bại.
