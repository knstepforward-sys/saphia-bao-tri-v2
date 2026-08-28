## [2026-08-28] Tách mã nguồn Bảo trì khỏi repository QC
- **Thay đổi:** Tạo repository private `knstepforward-sys/saphia-bao-tri-v2`; chuyển `bao-tri-v2/`, `apps-script/`, `kiemtra/` và tài liệu bảo trì sang repository mới bằng lịch sử Git đã lọc. Bổ sung `README.md`, `AGENTS.md`; cập nhật bộ kiểm tra để wrapper `baocao-saphia` là thành phần ngoài repository và chỉ kiểm tra khi thư mục đó có mặt trên máy.
- **Lý do:** Mã QC và mã Bảo trì trước đây dùng chung repository `saphia-qc`, làm lịch sử và trạng thái triển khai dễ bị nhầm lẫn.
- **Trạng thái:** Đã xong. Repository Bảo trì đã push và xác minh private; repository `saphia-qc` đã bỏ mã Bảo trì bằng commit riêng và chỉ còn phạm vi QC. Chưa `clasp push` và chưa deploy nên ứng dụng đang chạy thật chưa thay đổi.
- **Việc cần làm tiếp theo:** Mọi thay đổi Bảo trì thực hiện trong repository này; mọi thay đổi QC thực hiện tại `knstepforward-sys/saphia-qc`.

## [2026-08-28] Tạm tắt tỉ lệ hiệu dụng trong báo cáo hằng ngày
- **Thay đổi:** Đặt công tắc `HIEN_HIEU_DUNG_BAO_CAO_NGAY = false` trong `bao-tri-v2/BaoCaoNgay.gs` để không chạy phép tính A; `bao-tri-v2/TrangNgay.html` ẩn toàn bộ khối tỉ lệ hiệu dụng; `bao-tri-v2/CLAUDE.md` được cập nhật trạng thái và cách bật lại.
- **Lý do:** Cách tính hiện tại đang coi mọi máy có `Hoat_Dong = TRUE` là có kế hoạch chạy đủ lịch bộ phận, trong khi thực tế chỉ một số máy được bố trí chạy theo ngày/ca. Cần thiết kế quy trình tổ trưởng khai máy có kế hoạch chạy trước khi sử dụng chỉ số này.
- **Trạng thái:** Đã xong, đã qua bộ kiểm tra cú pháp/tĩnh tại máy local và đã được chủ dự án xác nhận lưu lên GitHub private. Chưa `clasp push` lên Apps Script Editor và chưa deploy; bản đang chạy thật chưa thay đổi.
- **Việc cần làm tiếp theo:** Nếu muốn áp dụng lên hệ thống thật, thực hiện `clasp push` và deploy phiên bản mới. Lập kế hoạch riêng cho chức năng khai máy chạy và người vắng theo ngày/ca trước khi bật lại chỉ số A.
