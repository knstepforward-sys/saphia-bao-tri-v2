# Tổ trưởng khai kế hoạch máy + 2 chỉ số huy động / hiệu suất

> **Trạng thái lúc viết file này: PHASE 0 — chỉ phân tích, CHƯA sửa file mã nguồn nào,
> CHƯA nhận "DUYỆT TRIỂN KHAI".** File này là kết quả thảo luận thiết kế, để mở chat
> mới đọc lại thay vì phải giải thích lại từ đầu. Đọc file này CÙNG với
> [`bao-tri-v2/CLAUDE.md`](bao-tri-v2/CLAUDE.md) trước khi làm bất cứ gì — file đó có
> kiến trúc, schema, và 14 cái bẫy đã trả giá của toàn hệ thống; file này chỉ có phần
> thiết kế riêng cho tính năng này.

Bản gốc yêu cầu nằm ở [`plan18.9.md`](plan18.9.md) (KHÔNG xoá file đó — vẫn là đặc tả
gốc, file này là bản đã tinh chỉnh qua thảo luận, một số điểm đổi khác gợi ý ban đầu,
ghi rõ ở dưới).

---

## 1. Mục tiêu, chia 2 đợt

**Đợt 1 — TỔ TRƯỞNG KHAI KẾ HOẠCH.** Tổ trưởng vào link riêng, khai máy nào tuần này
"Bố trí chạy" / "Đóng máy" (+ lý do), lưu vào Sheet. Mục tiêu: thứ Hai có thể bắt đầu
nhập dữ liệu thật. **Đây là đợt sẽ làm trước, xem mục 5.**

**Đợt 2 — HAI CHỈ SỐ (huy động + hiệu suất).** Tính từ dữ liệu Đợt 1 cộng `Su_Co`.
**Chưa code, làm sau khi Đợt 1 chạy ổn vài tuần và có dữ liệu thật để đối chiếu số ra
có hợp lý không** (quyết định của chủ dự án, xem mục 8).

Không làm trong cả hai đợt: KPI đáp ứng thợ, báo cáo tháng, so sánh ca ngày/đêm, đề
xuất quản trị, phân tích nguyên nhân — vẫn để phase sau như `plan18.9.md` đã ghi.

## 2. Quyết định đã chốt — ĐỪNG hỏi lại những điều này

| Chủ đề | Đã chốt |
|---|---|
| `HieuDung.gs` (tỉ lệ hiệu dụng A cũ) | **Giữ nguyên, không đụng.** Đang tắt sẵn (`HIEN_HIEU_DUNG_BAO_CAO_NGAY=false`), không gọi thêm, không xoá. 2 chỉ số mới ở Đợt 2 code hoàn toàn song song, độc lập. |
| Mô hình lưu `Ke_Hoach_May` | **Chỉ lưu NGOẠI LỆ** (máy Đóng máy), không lưu đủ mọi tổ hợp máy×ngày×ca. Máy không có dòng ngoại lệ trong tuần = mặc định "Bố trí chạy". Lý do: giảm dữ liệu 10-50 lần, đúng tinh thần "tổ trưởng chủ yếu khai ngoại lệ" của `plan18.9.md` mục 5. |
| Token tổ trưởng | Sheet `Danh_Muc_To` riêng, cột `Token` riêng, xác thực bằng hàm `xacThucTo_()` riêng — **không đụng, không dùng chung** với `Danh_Muc_Tho.Token` của thợ. |
| Giờ ca của tổ (`Lich_Lam_Viec_To`) | Là nguồn **THỨ HAI** song song với `Ke_Hoach_Chay_May` đã có (dùng cho A cũ). **Không tự động đồng bộ hai nguồn này trong đợt này** — tổ trưởng đổi giờ ca ở link mới không tự cập nhật `Ke_Hoach_Chay_May`. Chấp nhận được vì không đụng `HieuDung.gs`, nhưng phải nhớ khi làm Đợt 2 hoặc khi có ai hỏi vì sao hai nơi giờ ca không khớp. |
| Trình tự triển khai Đợt 1 | **Chạy từng bước, dừng chờ duyệt sau mỗi bước** — không chạy liền 8 bước. Lý do: hệ đang phục vụ 162 máy thật, lỗi ở bước giữa mà đã xây tiếp lên trên thì phải gỡ nhiều chỗ. |
| Đợt 1 vs Đợt 2 | **Tách hai đợt duyệt riêng.** Đợt 1 xong, chạy ổn vài tuần, có dữ liệu thật rồi mới bắt đầu Đợt 2. |

## 3. Schema — Đợt 1 (3 sheet mới)

### `Danh_Muc_To`
```
Bo_Phan          -- khớp Danh_Muc_May.Bo_Phan, VD: DET, SOI, CMTX, CMTD, TRANG, MTX, CO, ICM, LT, CHUNG
Ten_To
Ten_To_Truong
Token            -- sinh bằng sinhToken_() có sẵn, ĐỘC LẬP với Danh_Muc_Tho.Token
Hoat_Dong
Link_Khai_Bao
```
Seed: liệt kê `Bo_Phan` distinct đang có trong `Danh_Muc_May`, để trống
`Ten_To_Truong`/`Token` chờ điền tay — giống cách `Danh_Muc_Tho` được tạo rồi điền tay.

### `Lich_Lam_Viec_To`
```
Bo_Phan
Ap_Dung_Tu       -- yyyy-MM-dd, ngày bắt đầu áp dụng lịch này
Ca_Ngay_Tu
Ca_Ngay_Den
Co_Nghi_Trua
Nghi_Trua_Tu
Nghi_Trua_Den
Co_Ca_Dem
Ca_Dem_Tu
Ca_Dem_Den
Ghi_Chu
Cap_Nhat_Luc
```
Đổi lịch → thêm dòng MỚI với `Ap_Dung_Tu` mới, KHÔNG ghi đè dòng cũ. Tra lịch hiện hành
của một ngày = dòng có `Ap_Dung_Tu` lớn nhất mà vẫn `<= ngày cần tra`.

### `Ke_Hoach_May` — mô hình CHỈ LƯU NGOẠI LỆ (khác gợi ý gốc trong `plan18.9.md`)
```
Tuan_Bat_Dau     -- yyyy-MM-dd của thứ Hai
Ngay             -- yyyy-MM-dd
Ca               -- 'N' | 'D', TÁI DÙNG hằng số MA_CA đã có trong Code.gs
Ma_May
Bo_Phan          -- chép từ Danh_Muc_May lúc ghi, để báo cáo ổn định (đúng lối Su_Co.Bo_Phan)
Trang_Thai       -- 'DONG' (đóng máy) | 'DA_KHAI' (dòng chốt tuần, xem dưới)
Ly_Do
Ghi_Chu
Nguoi_Cap_Nhat
Cap_Nhat_Luc
Request_ID
```

**Dòng `DA_KHAI`**: 1 dòng/tổ/tuần, `Ma_May` để trống, ghi mỗi khi tổ trưởng bấm Lưu —
kể cả khi không có ngoại lệ nào. Mục đích: phân biệt "0 ngoại lệ vì tổ trưởng xác nhận
cả tuần chạy" với "0 dòng vì chưa ai khai" — đúng nguyên tắc `tiLe = null` khi chưa
khai kế hoạch mà `HieuDung.gs` đã dùng.

Khoá upsert: **`Tuan_Bat_Dau + Ca + Ma_May`**.

## 4. File sẽ sửa / tạo — Đợt 1

| File | Việc |
|---|---|
| `Code.gs` | Thêm `SHEET.TO/LICH_TO/KE_HOACH_MAY` + `HEADER_*`; thêm đoạn tạo 3 sheet vào `setupSystem()`; thêm `xacThucTo_()` |
| `CongNhan.gs` | Thêm đúng 1 nhánh `if (trang === 'kehoach') return renderTrangKeHoach_(p);` cạnh `qr`/`ngay` đã có trong `doGet` |
| `Test.gs` | Thêm 1 khối test mới cuối `chayTest()`, dùng khung `_kiemTra_` sẵn có |
| `KeHoachTo.gs` (MỚI) | Toàn bộ backend: route render, xác thực, RPC đọc/ghi |
| `ToTruong.html` (MỚI) | Toàn bộ giao diện, dùng chung CSS token của `Style.html` qua `include()`, không sửa `Style.html` |

**Tuyệt đối không sửa**: `LuongTho.gs`, `HieuDung.gs`, `BaoCaoKhaDung.gs`, `XuatBaoCao.gs`,
`Index.html`, `Tho.html`, `MaQR.gs`, `BaoCao.gs`, `BaoCaoNgay.gs`, schema `Su_Co`.

## 5. Route & xác thực

`?page=kehoach&to=DET&token=...` → nhánh mới trong `doGet` → `renderTrangKeHoach_(p)`
trong `KeHoachTo.gs`, gọi `xacThucTo_(boPhan, token)` ngay đầu (copy khuôn
`xacThucTho_` ở [`LuongTho.gs:20`](bao-tri-v2/LuongTho.gs)). Sai token → `trangThongBao_()`
như các route khác, không render form.

**Vì `appsscript.json` đặt `access: ANYONE_ANONYMOUS`, không có route-level gate** — mọi
RPC ghi/đọc trong `KeHoachTo.gs` đều PHẢI tự gọi lại `xacThucTo_` bên trong hàm, và tự
kiểm `Ma_May` request tới có thật sự thuộc đúng `Bo_Phan` của token đó (chặn DET sửa
máy SOI).

## 6. Upsert kế hoạch tuần & xử lý 50-60 máy

1. Client chỉ gửi **danh sách ngoại lệ** (không gửi hết tổ hợp): `{ boPhan, tuanBatDau,
   token, requestId, ngoaiLe: [{maMay, ca, ngay, lyDo, ghiChu}, ...] }`.
2. Backend trong `LockService`: kiểm `Request_ID` đã xử lý cho `(boPhan, tuanBatDau)`
   chưa (đọc từ dòng `DA_KHAI`) — trùng thì trả kết quả cũ, không ghi lại (chặn double-tap).
3. Đọc toàn bộ dòng hiện có của đúng `(Bo_Phan, Tuan_Bat_Dau)` — số dòng nhỏ (chỉ ngoại
   lệ) → xoá sạch (`clearContent`, đúng khuôn [`DanhMuc.gs:120-126`](bao-tri-v2/DanhMuc.gs))
   → ghi lại toàn bộ ngoại lệ mới + 1 dòng `DA_KHAI` bằng **một** `setValues`.
4. Nút "Bố trí tất cả máy chạy cả tuần" = gửi `ngoaiLe: []`.
5. F5/reload: đọc lại theo `(Bo_Phan, Tuan_Bat_Dau)`, máy không có dòng ngoại lệ = hiện
   "Bố trí chạy" → đúng yêu cầu idempotency.

## 7. Rủi ro đã ghi nhận

1. Hai nguồn giờ ca song song (`Lich_Lam_Viec_To` mới vs `Ke_Hoach_Chay_May` cũ) có thể lệch nhau — xem mục 2.
2. Không có route-level gate (access anonymous) — sai một hàm quên gọi `xacThucTo_` là hở dữ liệu tổ khác.
3. `Danh_Muc_To.Bo_Phan` phải khớp tuyệt đối chuỗi với `Danh_Muc_May.Bo_Phan` (hoa/thường).
4. Thêm ~22 test vào `chayTest()` (đã có 340 test) — đặt đúng chỗ, tránh bẫy "test giả lặp 2 nơi" đã từng dính ([bao-tri-v2/CLAUDE.md:822](bao-tri-v2/CLAUDE.md)).
5. `Danh_Muc_To.Token` độc lập cột/hàm với `Danh_Muc_Tho.Token` — vẫn nên có test canh rõ không ảnh hưởng lẫn nhau.

## 8. Đợt 2 — hai chỉ số (thiết kế xong, CHƯA code)

Tính live từ 3 sheet Đợt 1 + `Su_Co`, **không cần sheet mới**. Đơn vị đếm: **lượt
máy-ca** (máy × ngày × ca áp dụng trong tuần theo `Lich_Lam_Viec_To` — có ca đêm thì 1
máy = 14 lượt/tuần, không thì 7 lượt/tuần).

**Tỷ lệ huy động máy** — trả lời "có bao nhiêu máy được đem ra chạy":
```
= Σ (lượt máy-ca "Bố trí chạy" trong tuần) / Σ (tổng lượt máy-ca áp dụng trong tuần)
```
Máy đóng cả tuần mất hết lượt của nó; máy chỉ đóng 1 ngày/1 ca chỉ mất đúng lượt đó
(không làm tròn thành cả-tuần-không-dùng hay cả-tuần-vẫn-dùng).

**Hiệu suất máy được bố trí chạy** — trả lời "máy đã đem ra chạy thì chạy tốt không",
KHÔNG tính máy đã đóng từ đầu:
```
= 1 − (phút dừng SC-/DM-, đã hợp nhất chồng lấn, giao với khung đã bố trí chạy)
      / (phút kế hoạch của các lượt đã bố trí chạy)
```
Đúng thuật toán cắt-khoảng-dừng-theo-kế-hoạch + hợp-nhất-chồng-lấn đã có sẵn trong
`HieuDung.gs` — port logic thuần sang file mới (không sửa file cũ), đổi mẫu số từ
`Ke_Hoach_Chay_May` (theo bộ phận) sang `Ke_Hoach_May` (theo từng máy).

Hai chỉ số **không được gộp thành một** — trả lời hai câu hỏi khác nhau (thiếu kế
hoạch sản xuất vs máy đang chạy nhưng mất thời gian), phải hiển thị song song.

Rollup được theo tổ hoặc toàn nhà máy bằng cùng công thức, chỉ khác phạm vi Σ. File dự
kiến: `HuyDong.gs` (mới) — hàm tính thuần (test được như `HieuDung.gs` cũ) + RPC cho tổ
trưởng xem chỉ số tuần của chính tổ + 1 mục menu xuất báo cáo toàn nhà máy.

## 9. Lộ trình 8 bước — Đợt 1 (chạy từng bước, dừng chờ duyệt)

| # | Việc | Xem trước khi duyệt bước sau |
|---|---|---|
| 1 | Schema: 3 sheet mới + đoạn `setupSystem()` (chỉ `Code.gs`) | Chạy `setupSystem()`, xem 3 sheet mới đúng cột, không đụng sheet cũ |
| 2 | `xacThucTo_` + route `page=kehoach` trả trang test rỗng | Mở link token sai → từ chối; token đúng (điền tay) → trang trống |
| 3 | RPC đọc: thông tin tổ + lịch làm việc hiện hành + danh sách máy | Test bằng `chayTest()`, chưa cần UI |
| 4 | RPC ghi: lưu lịch làm việc (có `Ap_Dung_Tu`) | Test lưu lần đầu + đổi lịch không phá lịch cũ |
| 5 | RPC đọc/ghi kế hoạch tuần (ngoại lệ + upsert + double-tap) | Test batch 60 máy, reload đúng, lưu 2 lần không trùng |
| 6 | `ToTruong.html` — khung sườn + hiển thị danh sách máy | Xem giao diện thật trên điện thoại |
| 7 | `ToTruong.html` — thao tác hàng loạt (chọn nhiều, áp cả tuần, sao chép, lý do đóng máy) | Thử luồng thật: đóng 1 máy, cả tuần, 1 ngày, 1 ca |
| 8 | 22 test case vào `Test.gs` + cập nhật `bao-tri-v2/CLAUDE.md`/`NOTES.md` | `kiemtra\kiem-tra.ps1` xanh, 340 test cũ vẫn xanh |

## 10. Việc cần làm khi mở chat mới để tiếp tục

1. Đọc file này + [`bao-tri-v2/CLAUDE.md`](bao-tri-v2/CLAUDE.md) trước.
2. Chạy `dongbo.ps1` để chắc repo/GitHub/Apps Script chưa lệch kể từ lúc file này được viết.
3. Nói rõ đang ở bước mấy trong bảng mục 9 (nếu đã bắt đầu), hoặc gõ **DUYỆT TRIỂN KHAI
   BƯỚC 1** nếu chưa bắt đầu.
4. Sau mỗi bước hoàn thành, cập nhật bảng mục 9 trong chính file này (đánh dấu đã xong)
   trước khi đóng phiên — để phiên sau biết chính xác đang dở ở đâu mà không phải đọc
   lại toàn bộ lịch sử chat.
