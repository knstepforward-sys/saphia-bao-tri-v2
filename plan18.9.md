# KẾ HOẠCH TRIỂN KHAI CHỨC NĂNG KHAI BÁO HOẠT ĐỘNG MÁY CHO TỔ TRƯỞNG

Repository: `https://github.com/knstepforward-sys/saphia-bao-tri-v2`  
Nhánh mặc định: `master`  
Hệ cần chỉnh: `bao-tri-v2/`

Đây là hệ thống Google Apps Script đang chạy thật trong nhà máy. Công nhân quét QR trên máy để báo sự cố/dừng máy, kỹ thuật nhận việc và hoàn thành phiếu.

## TRƯỚC KHI LÀM

1. Đọc kỹ:
   - `README.md`
   - `CLAUDE.md`
   - `bao-tri-v2/CLAUDE.md`
   - `NOTES.md`
2. Đọc các file liên quan tối thiểu:
   - `bao-tri-v2/Code.gs`
   - `bao-tri-v2/CongNhan.gs`
   - `bao-tri-v2/DanhMuc.gs`
   - `bao-tri-v2/HieuDung.gs`
   - `bao-tri-v2/Style.html`
   - `bao-tri-v2/Test.gs`
   - `bao-tri-v2/appsscript.json`

## TUYỆT ĐỐI KHÔNG

- `clasp push` nếu chưa được tôi xác nhận riêng.
- Deploy.
- Tạo deployment mới.
- Sửa trực tiếp Apps Script production.
- Rewrite/refactor lớn code hiện tại.
- Sửa logic QR công nhân nếu không bắt buộc.
- Sửa luồng thợ.
- Sửa `HieuDung.gs` trong phase này.
- Sửa `BaoCaoKhaDung.gs` trong phase này.
- Sửa `XuatBaoCao.gs` trong phase này.
- Dùng `Danh_Muc_May.Hoat_Dong` để biểu diễn máy nghỉ theo ngày.
- Biến máy “không bố trí chạy” thành phiếu `DM-`.
- Làm KPI, báo cáo tháng, phân tích dữ liệu trong phase này.
- Đổi schema `Su_Co`.

# MỤC TIÊU PHASE NÀY

Chỉ xây chức năng cho **TỔ TRƯỞNG**:

> KHAI BÁO KẾ HOẠCH HOẠT ĐỘNG MÁY VÀ LƯU DỮ LIỆU

Mục tiêu là thứ Hai tổ trưởng có thể bắt đầu nhập dữ liệu thật.

Chưa làm:
- tỷ lệ huy động
- hiệu suất máy
- báo cáo tháng
- so sánh ca ngày/ca đêm
- đề xuất quản trị
- phân tích nguyên nhân

Tất cả phần đó để phase sau.

---

# 1. NGUYÊN TẮC NGHIỆP VỤ

Phải phân biệt rõ:

### A. Máy còn tồn tại trong hệ thống
→ `Danh_Muc_May.Hoat_Dong`

### B. Máy có được bố trí chạy trong ngày/ca cụ thể hay không
→ dữ liệu kế hoạch mới

Hai khái niệm này **KHÔNG được dùng chung**.

Trên giao diện dành cho người dùng lớn tuổi, dùng tiếng Việt thuần.

Không hiện:
- RUN
- CLOSED
- Downtime
- Planned
- Unplanned

Thay bằng:
- **Bố trí chạy**
- **Đóng máy**
- **Giờ làm việc**
- **Giờ nghỉ**
- **Lý do đóng máy**
- **Kế hoạch tuần**

Tên biến/code nội bộ có thể dùng tiếng Anh hoặc mã viết tắt nếu phù hợp code hiện tại.

---

# 2. LINK RIÊNG CHO TỪNG TỔ

Bổ sung route mới vào `doGet` hiện tại.

Dự kiến dạng:

`?page=kehoach&to=DET&token=...`

Không tạo Apps Script project mới.  
Không tạo web app thứ hai.  
Phải nằm trong web app bảo trì hiện tại.

Mỗi tổ có:
- mã bộ phận
- tên tổ
- tên tổ trưởng
- token riêng
- trạng thái hoạt động
- link khai báo riêng

Backend **PHẢI** kiểm token.

Không chỉ kiểm token ở frontend.

Link sai token không được đọc hoặc ghi dữ liệu.

Có thể tận dụng mô hình token/link cá nhân của thợ hiện tại nhưng không được làm ảnh hưởng token thợ.

---

# 3. CẤU HÌNH GIỜ LÀM VIỆC CỦA TỔ

Lần đầu tổ trưởng vào link cần khai:

## CA NGÀY
- giờ bắt đầu
- giờ kết thúc

## GIỜ NGHỈ
- có nghỉ hay không
- giờ bắt đầu nghỉ
- giờ kết thúc nghỉ

## CA ĐÊM
- có ca đêm hay không
- giờ bắt đầu
- giờ kết thúc

Phần này chỉ khai lần đầu.

Sau khi lưu:
→ hệ thống tiếp tục dùng lịch này cho đến khi có thay đổi.

Khi thay đổi lịch:
**KHÔNG ghi đè lịch cũ.**

Phải lưu theo ngày bắt đầu áp dụng.

Ví dụ:

- `01/09/2026` — `07:00–18:00` — nghỉ `12:00–13:00`
- `01/10/2026` — `07:00–18:00` — nghỉ `11:30–12:30`

Dữ liệu tháng 9 sau này vẫn phải tra được lịch cũ.

---

# 4. KẾ HOẠCH MÁY THEO TUẦN

Sau khi có lịch làm việc, tổ trưởng vào màn hình:

**Kế hoạch hoạt động máy**

Hiển thị tuần:
Thứ 2 → Chủ nhật.

Phân biệt:
- Ca ngày
- Ca đêm

Mỗi máy có 2 trạng thái:
- **Bố trí chạy**
- **Đóng máy**

Nhưng **KHÔNG** được thiết kế theo kiểu bắt tổ trưởng có 60 máy phải bấm:

`60 máy × 7 ngày × 2 ca`

Tổ có thể quản lý 50–60 máy.

Phải ưu tiên thao tác hàng loạt.

---

# 5. LUỒNG TỐI ƯU CHO 50–60 MÁY

Tổ trưởng phải có thể bấm:

**Bố trí tất cả máy chạy cả tuần**

Ví dụ tổ có 60 máy:
→ hệ thống khai cả 60 máy chạy.

Sau đó tổ trưởng chỉ chỉnh các máy **NGOẠI LỆ**.

Ví dụ:

Máy `4T-08`:
→ Đóng máy  
→ Thiếu đơn hàng  
→ cả tuần

Máy `4T-12`:
→ Đóng máy  
→ chỉ thứ Tư  
→ ca ngày

Ngoài ra cần hỗ trợ:

- Bố trí tất cả máy chạy
- Đóng tất cả máy
- Chọn nhiều máy
- Áp dụng trạng thái cho nhiều máy
- Áp dụng cho cả tuần
- Chỉ áp dụng một ngày
- Chỉ áp dụng một ca
- Sao chép kế hoạch ngày này sang ngày khác
- Sao chép ca này sang ca khác nếu cần
- Tìm máy bằng mã/tên
- Bộ lọc **Chỉ xem máy đang đóng**

Giao diện nên luôn hiển thị thống kê nhanh:

- 60 máy
- 53 máy bố trí chạy
- 7 máy đóng

Mục tiêu:
tổ trưởng chủ yếu khai **NGOẠI LỆ**, không khai lại toàn bộ máy từng cái.

---

# 6. LÝ DO ĐÓNG MÁY

Khi chọn **Đóng máy**:

BẮT BUỘC chọn lý do.

Danh sách ban đầu:

- Thiếu đơn hàng
- Thiếu thợ
- Thiếu nguyên liệu
- Bảo trì có kế hoạch
- Máy dự phòng
- Khác

Có thêm:
**Ghi chú**

Ví dụ:
`Thợ vận hành nghỉ phép`

Nếu chọn **Khác**:
→ bắt buộc nhập ghi chú.

Nếu **Bố trí chạy**:
→ không cần lý do.

Không lưu text lý do lung tung nếu có thể dùng mã nội bộ + nhãn tiếng Việt.

Mục tiêu là phase sau có thể gom nhóm báo cáo.

---

# 7. CHỦ NHẬT VÀ CA ĐÊM

Không hard-code:
`Chủ nhật = nghỉ`.

Có tuần Chủ nhật làm.  
Có tuần Chủ nhật nghỉ.

Có bộ phận:
hôm nay làm ca đêm, ngày mai không làm ca đêm.

Vì vậy kế hoạch phải chỉnh được theo:

`Ngày + ca + máy`

Nếu cả Chủ nhật không sản xuất:
tổ trưởng có thể đóng toàn bộ hoặc áp dụng thao tác hàng loạt.

Nếu chỉ 6/60 máy chạy:
→ 6 máy bố trí chạy  
→ 54 máy đóng.

---

# 8. SCHEMA DỮ LIỆU ĐỀ XUẤT

Trước khi code, hãy kiểm tra code hiện tại và đề xuất schema chính xác.

Dự kiến cần 3 sheet mới:

## 1. `Danh_Muc_To`

Gợi ý:
- `Bo_Phan`
- `Ten_To`
- `Ten_To_Truong`
- `Token`
- `Hoat_Dong`
- `Link_Khai_Bao`

## 2. `Lich_Lam_Viec_To`

Gợi ý:
- `Bo_Phan`
- `Ap_Dung_Tu`
- `Ca_Ngay_Tu`
- `Ca_Ngay_Den`
- `Co_Nghi_Trua`
- `Nghi_Trua_Tu`
- `Nghi_Trua_Den`
- `Co_Ca_Dem`
- `Ca_Dem_Tu`
- `Ca_Dem_Den`
- `Ghi_Chu`
- `Cap_Nhat_Luc`

## 3. `Ke_Hoach_May`

Gợi ý:
- `Tuan_Bat_Dau`
- `Ngay`
- `Ca`
- `Ma_May`
- `Bo_Phan`
- `Trang_Thai`
- `Ly_Do`
- `Ghi_Chu`
- `Nguoi_Cap_Nhat`
- `Cap_Nhat_Luc`
- `Request_ID`

Đây là schema gợi ý, **KHÔNG được tự động code ngay**.

Trước tiên hãy xem code hiện tại rồi đánh giá:
- có cần đủ 3 sheet không
- tên cột nào phù hợp convention hiện tại
- có field nào thừa
- có field nào thiếu

Yêu cầu:
schema phải tối thiểu, dễ hiểu, không duplicate dữ liệu không cần thiết.

---

# 9. CÁC FILE DỰ KIẾN

Ưu tiên kiến trúc:

### `Code.gs`
- thêm hằng sheet/header mới
- `setupSystem` tạo sheet mới an toàn

### `CongNhan.gs`
- chỉ bổ sung route `page=kehoach`

### `KeHoachTo.gs`
- FILE MỚI
- toàn bộ backend của trang tổ trưởng

### `ToTruong.html`
- FILE MỚI
- toàn bộ giao diện tổ trưởng

### `Test.gs`
- thêm test mới

### `CLAUDE.md`
### `NOTES.md`
- cập nhật tài liệu sau khi code xong

Không nhét toàn bộ logic mới vào `Code.gs`.

Không nhét vào `CongNhan.gs` quá nhiều.

---

# 10. BACKEND

Backend tối thiểu cần các RPC tương đương:

- đọc thông tin tổ từ token
- đọc lịch làm việc hiện hành
- lưu lịch làm việc mới
- đọc danh sách máy của tổ
- đọc kế hoạch của tuần
- lưu kế hoạch máy
- thao tác hàng loạt

Tên hàm cụ thể hãy đặt theo style hiện tại.

Mọi hàm **GHI**:
- dùng `LockService`
- chống double tap
- có `Request_ID` nếu phù hợp
- validate backend
- không tin dữ liệu frontend
- kiểm máy có thật sự thuộc bộ phận đó
- kiểm máy `Hoat_Dong = TRUE`
- kiểm token

Không cho link DET chỉnh máy SOI.

Không cho request sửa `Ma_May` tùy ý ngoài danh mục của tổ.

---

# 11. CÁCH LƯU DỮ LIỆU HÀNG LOẠT

Không `appendRow` 60 lần nếu có thể tránh.

Ưu tiên:
- đọc vùng một lần
- xử lý trong bộ nhớ
- `setValues` theo batch

Ví dụ tổ 60 máy, cả tuần chạy:
không tạo code gọi RPC 840 lần.

Frontend phải gửi payload hàng loạt hợp lý.

Backend ghi batch.

Tối ưu round-trip `google.script.run`.

---

# 12. RELOAD / IDEMPOTENCY

Yêu cầu bắt buộc:

Tổ trưởng khai xong  
→ F5 / reload  
→ dữ liệu phải hiện lại chính xác.

Bấm Lưu 2 lần vì mạng chậm:
→ không sinh bản ghi trùng vô hạn.

Thao tác lưu tuần phải có cơ chế update/upsert rõ ràng.

Khóa định danh logic có thể dựa trên:

`Ngay + Ca + Ma_May`

hoặc cấu trúc tương đương.

Phải trình bày trước khi code.

---

# 13. GIAO DIỆN

Người sử dụng phần lớn lớn tuổi.

Yêu cầu:

- tiếng Việt
- chữ rõ
- nút lớn
- ít thao tác
- không thuật ngữ kỹ thuật
- không bảng quá rộng phải kéo ngang quá nhiều
- tối ưu điện thoại
- màu trạng thái dễ phân biệt
- không nhồi quá nhiều thông tin

Có thể reuse `Style.html`.

Nhưng tránh sửa `Style.html` dùng chung nếu không cần.

Có thể đặt CSS riêng trong `ToTruong.html`.

Giao diện dự kiến:

**TỔ DỆT**  
**Kế hoạch tuần 21/09 – 27/09**

`[Tuần trước] [Tuần này] [Tuần sau]`

Ca:  
`[Ca ngày] [Ca đêm]`

Thao tác nhanh:  
`[Bố trí tất cả máy chạy]`  
`[Chọn nhiều máy]`  
`[Sao chép kế hoạch]`

Ô tìm máy

Danh sách máy:

`4T-01 | Bố trí chạy`  
`4T-02 | Bố trí chạy`  
`4T-03 | Đóng máy — Thiếu thợ`

Nếu bấm Đóng máy:
mở phần chọn lý do + ghi chú.

---

# 14. TUYỆT ĐỐI KHÔNG ĐỤNG LUỒNG QR

Luồng hiện tại:

QR máy  
→ công nhân báo sự cố  
→ `SC-`

hoặc:

QR máy  
→ Dừng máy không do hư  
→ `DM-`

hoặc:

máy đang `DM-`  
→ gọi kỹ thuật  
→ `HT-`

**PHẢI GIỮ NGUYÊN.**

Không sửa `Index.html` nếu không có lý do cực kỳ bắt buộc.

Không thay đổi:
- `Su_Co`
- `Loai_Phieu`
- `SC-`
- `DM-`
- `HT-`
- `CV-`
- `BT-`

Không để dữ liệu kế hoạch tổ trưởng tạo phiếu `Su_Co`.

---

# 15. KHÔNG DÙNG `HOAT_DONG` ĐỂ ĐÓNG MÁY

`Danh_Muc_May.Hoat_Dong` hiện mang nghĩa:

Máy còn thuộc hệ thống / còn được quản lý.

Không được làm:

tổ trưởng đóng máy hôm nay  
→ `Hoat_Dong = FALSE`

Điều này sẽ làm máy mất khỏi:
- danh mục
- QR
- báo cáo
- logic `HieuDung`

Kế hoạch đóng theo ngày phải nằm riêng trong `Ke_Hoach_May`.

---

# 16. CHƯA KẾT NỐI KPI

`HieuDung.gs` hiện đã có:
- kế hoạch theo bộ phận
- giờ nghỉ
- phép giao khoảng downtime với kế hoạch
- hợp nhất khoảng dừng
- báo cáo khả dụng

**KHÔNG chỉnh nó trong phase này.**

Chỉ đảm bảo dữ liệu mới được thiết kế sao cho phase sau có thể dùng.

Sau khi hệ thống tổ trưởng chạy ổn mới làm phase khác:

`Ke_Hoach_May`  
+ `Su_Co / DM-`  
+ lịch làm việc

→ tỷ lệ huy động  
→ hiệu suất máy được bố trí chạy  
→ báo cáo tháng  
→ so sánh ngày/đêm

---

# 17. TEST BẮT BUỘC

Thêm test nhưng không làm hỏng test cũ.

Cần test tối thiểu:

1. Token đúng → đọc được tổ.
2. Token sai → từ chối.
3. Tổ DET không lấy được máy SOI.
4. Chỉ lấy máy `Hoat_Dong = TRUE`.
5. Lưu lịch lần đầu.
6. Đổi lịch → tạo lịch mới theo `Ap_Dung_Tu` → không phá lịch cũ.
7. Lưu 60 máy chạy cả tuần.
8. Đóng riêng một máy.
9. Đóng máy cả tuần.
10. Đóng riêng một ngày.
11. Đóng riêng một ca.
12. Đóng bắt buộc lý do.
13. `Khác` bắt buộc ghi chú.
14. Bố trí chạy không cần lý do.
15. Reload đọc đúng dữ liệu.
16. Lưu lại cùng `Ngay + Ca + Ma_May` → update/upsert → không duplicate.
17. Thao tác hàng loạt.
18. Ca đêm qua ngày hôm sau không làm sai `Ngay` kế hoạch.
19. Chủ nhật có thể khai bình thường.
20. Không thay đổi `Hoat_Dong` của máy.
21. Không tạo bất kỳ dòng nào trong `Su_Co`.
22. Test luồng QR hiện tại vẫn xanh.

---

# 18. QUY TRÌNH LÀM VIỆC

## PHASE 0 — CHỈ PHÂN TÍCH

Ở câu trả lời đầu tiên:

**KHÔNG SỬA FILE.**

Hãy báo:

1. Kiến trúc hiện tại liên quan task.
2. File/function sẽ reuse.
3. File sẽ sửa.
4. File mới sẽ tạo.
5. Schema chính xác bạn đề xuất.
6. Cách xác thực link tổ trưởng.
7. Cách upsert kế hoạch tuần.
8. Cách xử lý 50–60 máy.
9. Rủi ro.
10. Test plan.
11. Ước lượng phạm vi diff.

Sau đó **DỪNG**.

Chờ tôi nói:

> DUYỆT TRIỂN KHAI

mới được sửa code.

---

# 19. SAU KHI ĐƯỢC DUYỆT

Triển khai theo thứ tự:

1. Schema + `setupSystem`
2. Backend `KeHoachTo.gs`
3. Route
4. `ToTruong.html`
5. Lưu/đọc dữ liệu
6. Thao tác hàng loạt
7. Test
8. Cập nhật `CLAUDE.md` + `NOTES.md`

Không làm KPI.

Không mở rộng scope.

---

# 20. TRƯỚC KHI KẾT THÚC

Phải báo rõ:

## FILES CREATED
...

## FILES MODIFIED
...

## FUNCTIONS ADDED
...

## SHEETS ADDED
...

## TESTS
`x/y đạt`

## RỦI RO CÒN LẠI
...

## CHƯA LÀM
- KPI
- báo cáo tháng
- phân tích
- đề xuất

## TRẠNG THÁI TRIỂN KHAI

GitHub:  
...

`clasp push`:  
**CHƯA** — trừ khi tôi xác nhận riêng.

Deploy:  
**CHƯA** — trừ khi tôi xác nhận riêng.

Không được dùng từ **“đã chạy thật”** nếu chưa deploy và test trên máy thật.

---

# ƯU TIÊN CAO NHẤT

1. Không phá app bảo trì đang chạy.
2. Minimal diff.
3. Dữ liệu sạch.
4. Tổ trưởng 50–60 máy vẫn thao tác nhanh.
5. Giao diện tiếng Việt dễ hiểu.
6. Chủ nhật hoàn thành phần khai + lưu.
7. Thứ Hai có thể bắt đầu nhập dữ liệu thật.
