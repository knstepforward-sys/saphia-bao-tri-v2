# SAPHIA — Hệ thống Bảo trì

Repository riêng cho hai ứng dụng Google Apps Script thuộc nghiệp vụ bảo trì:

- `bao-tri-v2/`: Bảo trì Toàn nhà máy v2, đang phục vụ hệ thống QR trên máy.
- `apps-script/`: ứng dụng SAPHIA nhập nhanh báo cáo sửa chữa BM01/QTSCBT-05.
- `kiemtra/`: bộ kiểm tra tĩnh dùng trước khi đẩy Bảo trì v2 lên Apps Script.

Hai ứng dụng dùng Spreadsheet và Apps Script project khác nhau. Đọc `CLAUDE.md` và
`bao-tri-v2/CLAUDE.md` trước khi chỉnh sửa.

## Quy tắc triển khai

- GitHub chỉ lưu lịch sử mã nguồn; push GitHub không làm thay đổi ứng dụng đang chạy.
- Muốn cập nhật Apps Script Editor phải chạy `clasp push` trong đúng thư mục ứng dụng.
- Muốn cập nhật web app thật phải deploy lại đúng deployment ID hiện có; không tạo URL mới.
- Không commit `.clasp.json`, `.clasprc.json`, token, mật khẩu hoặc thông tin tài khoản.
- Sau mỗi thay đổi, cập nhật mục mới ở đầu `NOTES.md` và chạy bộ kiểm tra phù hợp.

Trang wrapper GitHub Pages vẫn nằm trong repository triển khai riêng `baocao-saphia` để
không làm thay đổi các đường dẫn QR đã phát hành.
