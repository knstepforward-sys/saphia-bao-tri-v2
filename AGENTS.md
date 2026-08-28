# Quy tắc làm việc bắt buộc

## Trước khi sửa

- Đọc `CLAUDE.md`; nếu sửa `bao-tri-v2/`, đọc hết `bao-tri-v2/CLAUDE.md`.
- Ưu tiên giải bằng cấu hình Google Sheet trước khi thay đổi mã nguồn.
- Trình bày phương án và chờ chủ dự án duyệt trước khi sửa file Bảo trì v2.

## Ghi nhận thay đổi

- Sau mỗi thay đổi, thêm một mục mới lên đầu `NOTES.md` theo mẫu: ngày, thay đổi,
  lý do, trạng thái và việc cần làm tiếp theo.
- Ghi rõ riêng các trạng thái: đã commit/push GitHub, đã `clasp push`, đã deploy.
- Không được mô tả “đã chạy thật” nếu mới chỉ sửa mã nguồn hoặc push GitHub.

## Commit và push

- Commit khi hoàn thành một tính năng, một lỗi, trước thay đổi lớn cần điểm rollback,
  hoặc cuối phiên nếu mã đang chạy được.
- Commit message ngắn, đúng nội dung; ưu tiên dạng `[loại] mô tả ngắn`.
- Trước khi push, chạy `powershell -ExecutionPolicy Bypass -File kiemtra/kiem-tra.ps1`
  nếu thay đổi liên quan `bao-tri-v2/`.
- Trước mỗi lần push, báo ngắn gọn đã sửa gì, đã cập nhật `NOTES.md` chưa và chờ xác nhận.

## Bảo mật và Apps Script

- Không commit API key, mật khẩu, token, tài khoản Gmail/Workspace, `.clasp.json` hoặc
  `.clasprc.json`.
- GitHub không tự đồng bộ Apps Script. Chỉ chạy `clasp push` hoặc deploy khi chủ dự án
  yêu cầu rõ ràng.
- Khi deploy, dùng đúng deployment ID hiện có; không tạo deployment mới làm đổi URL QR.
