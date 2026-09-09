## [2026-09-09] Kéo mã từ Apps Script Editor về repository và dọn tài liệu cũ
- **Thay đổi:** `clasp clone` ra thư mục tạm rồi chép 21 file của Bảo trì v2 về repository: 6 file khác nhau, +1006 dòng / −45 dòng. Về thêm khối KPI thợ (`tinhLaiKpiTho`, `kpiThoChoPhieu_`, `nguongKpi_`, `phutBanTrongCho_`, menu `menuTinhLaiKpi`) và khối báo cáo so sánh kỳ trước (`soSanhKy_`, `ghiTomTat_`, `gomKpiTho_`, `tyLeDatKpi_`, `tbDapUngSuCo_`, `phanVi_`). Dọn tài liệu: sửa cây thư mục trong `CLAUDE.md` cho khớp repository hiện tại, bỏ mục "KPI đáp ứng chưa bắt đầu" vì đã làm xong, chuyển "so sánh tháng trước" khỏi danh sách đang chờ trong `bao-tri-v2/CLAUDE.md`, ghi thêm tài khoản clasp mới và bẫy PowerShell chặn `clasp.ps1`.
- **Lý do:** Repository tụt lại so với Apps Script Editor vì có người sửa thẳng trên Editor. Đẩy repository lên lúc đó sẽ xoá mất khối KPI trên hệ thống đang chạy. Tài liệu cũng ghi sai trạng thái nên khó theo dõi việc còn lại.
- **Trạng thái:** Đã kéo về và commit. Bộ kiểm tra tĩnh báo sạch. **Không** `clasp push`, **không** deploy; hệ thống đang chạy trên máy nhà máy không thay đổi gì. Đã kiểm hai chiều: không có hàm nào của repository bị mất ở bản kéo về. Tỉ lệ hiệu dụng vẫn tắt (`HIEN_HIEU_DUNG_BAO_CAO_NGAY = false`).
- **Việc cần làm tiếp theo:** Bắt đầu cải tiến cách tính tỉ lệ hiệu dụng rồi mới bật lại công tắc. Mỗi phiên làm việc kéo mã về so trước khi sửa.

## [2026-08-28] Deploy ẩn tỉ lệ hiệu dụng bị chặn quyền Workspace
- **Thay đổi:** Thử cập nhật đúng deployment hiện có `@2` bằng `clasp deploy --deploymentId`; không tạo deployment mới và không dùng `@HEAD`.
- **Lý do:** Cần đưa thay đổi ẩn tỉ lệ hiệu dụng từ Apps Script Editor lên trang web `/exec` mà vẫn giữ nguyên URL/QR.
- **Trạng thái:** Bị chặn trước khi triển khai với thông báo chỉ người dùng cùng domain với chủ sở hữu script mới được deploy. Deployment vẫn ở `@2`, ID và URL không thay đổi; mã mới đã có trên Apps Script Editor nhưng ứng dụng web đang chạy thật vẫn dùng version cũ.
- **Việc cần làm tiếp theo:** Đăng nhập clasp bằng tài khoản thuộc đúng Workspace domain của chủ sở hữu, hoặc nhờ chủ sở hữu mở Manage deployments và cập nhật chính deployment hiện có sang version mới; không chọn New deployment.

## [2026-08-28] Đã đẩy mã ẩn tỉ lệ hiệu dụng lên Apps Script Editor
- **Thay đổi:** Chạy `clasp push --force` trong `bao-tri-v2/`; 21 file của project Bảo trì v2 đã được cập nhật trên Apps Script Editor, bao gồm công tắc ẩn tỉ lệ hiệu dụng trong báo cáo hằng ngày.
- **Lý do:** Chủ dự án yêu cầu đưa thay đổi đã lưu trên GitHub lên Apps Script Editor.
- **Trạng thái:** Đã xong `clasp push` lúc 15:19:36 ngày 28/08/2026 sau khi bộ kiểm tra tĩnh báo sạch. Chưa deploy web app; trang `/exec`, ứng dụng đang chạy thật và QR vẫn dùng version deployment cũ.
- **Việc cần làm tiếp theo:** Khi được chủ dự án yêu cầu, deploy bằng đúng deployment ID hiện có rồi kiểm tra báo cáo hằng ngày; tuyệt đối không tạo deployment mới.

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
