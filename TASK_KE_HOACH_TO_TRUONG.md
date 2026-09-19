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

**Đợt 2 — HOÀN THIỆN KHAI BÁO (đổi thứ tự 19/09/2026, chủ dự án chốt).** Khai báo phải
đủ trước rồi mới làm báo cáo, vì số liệu báo cáo sẽ sai nếu thiếu dữ liệu đầu vào. Gồm:
**(a) tăng ca theo máy-ngày** (đang làm, xem mục 9c) và **(b) nút "Về giữa ca"** (ý tưởng ở
mục 7c, làm sau (a), phương án + duyệt riêng).

**Đợt 3 — HAI CHỈ SỐ (huy động + hiệu suất)** (trước đây gọi là Đợt 2). Tính từ dữ liệu
Đợt 1-2 cộng `Su_Co`. **Chưa code, làm sau khi Đợt 2 xong và chạy ổn có dữ liệu thật để
đối chiếu số ra có hợp lý không** (xem mục 8).

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

Khoá upsert: **`Tuan_Bat_Dau + Ngay + Ca + Ma_May`** (sửa lại ở bước 5 — bản nháp trước đó ghi
thiếu `Ngay`, nhưng ví dụ máy `4T-12` chỉ đóng đúng thứ Tư ca ngày ở mục 5 `plan18.9.md` cần
đủ cả 4 phần mới phân biệt được từng lượt máy-ca).

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

## 7b. Bẫy phát hiện được ở bước 4 — `getLastRow()` bị checkbox làm sai

**`datCheckbox_(sh, cot)` áp data validation checkbox lên tới `sh.getMaxRows()-1` dòng
(≈999 dòng). Google Sheets coi các ô checkbox còn TRỐNG trong vùng đó là `FALSE` —
`sh.getLastRow()` báo có dữ liệu tới tận dòng ~1000 ngay cả khi sheet "trông như trống"
(chỉ có checkbox, chưa ai nhập gì cột khác).**

Hậu quả thật đã dính: `luuLichLamViec` dùng `sh.getRange(sh.getLastRow() + 1, ...)` để
tìm dòng trống kế tiếp → ghi lạc xuống dòng 1001/1002 thay vì dòng 2/3. Tương tự,
`setupSystem()` seed `Danh_Muc_To` kiểu "chỉ seed khi `getLastRow() < 2`" không bao giờ
chạy vì `datCheckbox_` (cột `Hoat_Dong`) đã đẩy `getLastRow()` lên trước khi điều kiện đó
được kiểm tra.

**Cách vá:** thêm `soDongCoDuLieu_(sh, cotNeo)` trong `Code.gs` — đếm dòng dữ liệu thật
dựa theo MỘT cột neo cụ thể (vd `Bo_Phan`/`Ma_May`) thay vì tin `getLastRow()` của cả
sheet. Dùng hàm này ở mọi chỗ cần "tìm dòng trống kế tiếp để ghi thêm" trên sheet có cột
checkbox. `Danh_Muc_To` cũng đổi sang kiểu bổ sung bộ phận còn thiếu (giống
`CAU_HINH_MAC_DINH`) thay vì "chỉ seed khi trống hẳn", để không cần sheet thật sự rỗng
mới seed được.

**⚠️ Nghi ngờ CÙNG LỖI này đã tồn tại từ trước trong `DanhMuc.gs` — `themMayMoi()`** dùng
đúng kiểu `sh.getRange(sh.getLastRow() + 1, ...)` để thêm máy mới vào `Danh_Muc_May`, mà
sheet đó cũng có cột checkbox `Hoat_Dong` áp bằng `datCheckbox_`. Nếu đúng, hai máy
`CMTD02`/`CMTD03` (đã có sẵn trong mảng `MAY_THEM_MOI`, có vẻ đã chạy trước đây) có thể
đang nằm ở dòng ~1000 của `Danh_Muc_May` thay vì ngay sau các máy khác — không làm hỏng
chức năng (mọi chỗ đọc đều qua `docSheet_`, tự lọc dòng trống ở cột A, không phụ thuộc vị
trí), chỉ gây khó tìm bằng mắt khi cuộn sheet. **Đây là phát hiện ngoài phạm vi tính năng
này, KHÔNG sửa `DanhMuc.gs` ở đây** — cần chủ dự án xác nhận trước khi đụng vào file đang
chạy thật cho 162 máy.

---

## 7c. Ý tưởng đã chốt HOÃN — tổ trưởng báo dừng máy hộ công nhân (nay là Đợt 2(b), ngoài phạm vi hiện tại)

Vấn đề thật do chủ dự án nêu: thợ xin nghỉ giữa ca (ví dụ chạy 2 tiếng rồi về) phải quét QR
"Dừng máy không do hư", nhưng thợ ca sau nhiều khi không biết máy đang bị đánh dấu dừng nên
không quét "bật lại" — phiếu `DM-` treo mãi. Công nhân cũng hay phản đối phải thao tác thêm.
Muốn cho **tổ trưởng** báo hộ (vì xin nghỉ vốn phải xin phép tổ trưởng).

**Đã chốt: KHÔNG làm trong đợt này (Đợt 1 — kế hoạch tuần).** Lý do:
- `plan18.9.md` mục "TUYỆT ĐỐI KHÔNG ĐỤNG LUỒNG QR" ghi rõ: *"Không để dữ liệu kế hoạch tổ
  trưởng tạo phiếu `Su_Co`"*. Việc này đòi hỏi trang tổ trưởng ghi thẳng vào `Su_Co` — đúng
  điều bị cấm.
- `Su_Co` đang chạy thật cho 162 máy, có KPI đáp ứng thợ (`Phut_Cho_Tho_Ban`, `Phut_KPI_Tho`...)
  gắn chặt vào cấu trúc phiếu `DM-`/`SC-`/`HT-` — sửa vội có thể làm sai số liệu đang dùng thật.
- Cần thiết kế riêng, cẩn thận: ai có quyền tạo hộ, ai đóng phiếu (công nhân ca sau vẫn quét
  QR như cũ hay tổ trưởng cũng đóng được), cách audit "phiếu do tổ trưởng tạo hộ" để không lẫn
  với số liệu công nhân tự báo.

**Đã làm ở Đợt 2(b) theo phương án KHÁC hẳn ý ban đầu** (chủ dự án đính chính 19/09/2026):
"Về giữa ca" là việc của TỔ TRƯỞNG (công nhân xin về phải xin tổ trưởng), ghi trên trang tổ
trưởng — KHÔNG nằm trong luồng QR của công nhân và KHÔNG tạo phiếu `DM-`/`Su_Co`. Tách hẳn
khỏi "dừng máy không hư" (đổi mặt hàng, vệ sinh, thiếu nguyên liệu — lỗi nhà máy, vẫn do công
nhân báo qua QR như cũ). Xem mục 9d.

---

## 8. Đợt 3 — hai chỉ số (thiết kế xong, CHƯA code)

Tính live từ 3 sheet Đợt 1 + `Su_Co`, **không cần sheet mới**. Phút kế hoạch của một
máy-ngày lấy từ `khungKeHoachNgayCuaMay_()` (Đợt 2(a)): ngày thường trừ nghỉ trưa, ngày tăng
ca 07:00–20:30 trừ nghỉ trưa + nghỉ tối = 705 phút với lịch mẫu. Đơn vị đếm: **lượt
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
| 1 | ✅ **XONG** — sửa code, `clasp push`, chạy `setupSystem()` thật trong Sheet. Chủ dự án xác nhận 3 sheet đúng cột, không đụng sheet cũ. | ✅ Đã xác nhận |
| 2 | ✅ **XONG** — `KeHoachTo.gs` mới, `ToTruong.html` khung rỗng, route trong `CongNhan.gs`, đã `clasp push`. Test qua URL "Triển khai thử nghiệm": token đúng → "Kế hoạch tuần — DET"; token sai → "Không có quyền truy cập". Chủ dự án đã xác nhận cả hai ca. | ✅ Đã xác nhận |
| 3 | ✅ **XONG** — RPC `getToTruongBootstrap` + 12 test mới. `clasp push` xong, chạy menu 🧪 trong Sheet ra **370/370** (không đỏ — nền trước đó đã là 358, không phải 340 như `CLAUDE.md` ghi cũ; sửa lại số ở bước 8). | ✅ Đã xác nhận |
| 4 | ✅ **XONG** — RPC `luuLichLamViec` + vá lỗi `getLastRow()` bị checkbox làm sai (mục 7b). Chủ dự án xác nhận: `setupSystem()` chạy lại thêm đủ bộ phận, dòng rác 1001/1002 đã dọn, test RPC ghi lại ra đúng dòng 2/3, dòng 01/09 giữ nguyên khi đổi lịch 01/10. | ✅ Đã xác nhận |
| 5 | ✅ **XONG** — `layKeHoachTuan`/`luuKeHoachTuan` + 4 hàm thuần + khoá `LY_DO_DONG_MAY_KE_HOACH`. Chủ dự án xác nhận: lưu 2 ngoại lệ → đọc đúng; lưu lại 1 ngoại lệ khác → 2 dòng cũ biến mất hoàn toàn, sheet chỉ còn đúng 2 dòng (1 ngoại lệ + 1 `DA_KHAI`), không rác. | ✅ Đã xác nhận |
| 6 | ✅ **XONG** — `ToTruong.html` đầy đủ + vá lỗi thoáng qua `google.script.run` (gọi RPC liên tiếp ngay khi tải trang). Chủ dự án xác nhận cả 3 ca: tổ `DET` đã có dữ liệu vào thẳng màn hình chính không lỗi; tổ `CMTX` chưa khai lịch hiện đúng form khai lần đầu; bấm Lưu chuyển đúng sang màn hình chính, 38 máy đều "Bố trí chạy cả tuần". | ✅ Đã xác nhận |
| 7a | ✅ **XONG — chủ dự án đã xác nhận toàn bộ.** Modal đóng máy (Cả tuần / Chọn ngày cụ thể, chọn được nhiều ngày, cộng dồn qua nhiều lượt "Sửa"), nút "Bố trí lại", nút "Lưu kế hoạch tuần", 2 nút thao tác nhanh Chủ nhật cho toàn bộ máy. Test tay: chọn nhiều ngày ✅, cộng dồn qua nhiều lượt Sửa ✅, 2 nút Chủ nhật ✅, Lưu + F5 giữ nguyên ✅. | ✅ Đã xác nhận |
| 7b | ✅ **XONG — chủ dự án đã xác nhận toàn bộ luồng dữ liệu thật.** Checkbox chọn nhiều máy + thanh hành động, "Bố trí/Đóng tất cả máy" toàn tuần, sao chép kế hoạch giữa các ngày, tìm máy + lọc. Test tay: đóng hàng loạt máy đã chọn ✅, đóng/bố trí tất cả 48 máy ✅, sao chép 1 ngày sang nhiều ngày đúng ✅, tìm kiếm + lọc đúng ✅, Lưu + F5 giữ nguyên ✅. | ✅ Đã xác nhận |
| 8 | ✅ **XONG — chủ dự án đã xác nhận.** Đối chiếu đủ 22 mục `plan18.9.md` mục 17 (18 mục đã có test từ bước 3-5, thêm 4 test mới: #3 DET/SOI, #9 đóng cả tuần, #18 ca đêm không lệch Ngay, #19 Chủ nhật bình thường). Cập nhật `bao-tri-v2/CLAUDE.md` (mục 2b, số test, bảng file/schema). Chạy menu 🧪 ra **402/402**, không đỏ. Đã `clasp push` + deploy + push GitHub. | ✅ Đã xác nhận |

**→ ĐỢT 1 (TỔ TRƯỞNG KHAI KẾ HOẠCH) HOÀN TẤT CẢ 8 BƯỚC, XÁC NHẬN CHẠY THẬT ĐÚNG THIẾT KẾ.**

## 9c. Đợt 2(a) — tăng ca theo máy-ngày (chủ dự án chốt 19/09/2026)

Bộ phận chỉ chạy ca ngày; ngày tăng ca thì máy chạy 07:00–20:30. Quyết định đã chốt:

| Chủ đề | Đã chốt |
|---|---|
| Phạm vi | **Theo từng máy** (không theo cả bộ phận), theo ngày |
| Lưu ở đâu | `Ke_Hoach_May`, dòng `Trang_Thai='TANG_CA'`, `Ca='N'`, có `Ma_May`, không lý do. **Không thêm cột/sheet** |
| Giờ | `Cau_Hinh`: `TANG_CA_DEN`=20:30, `NGHI_TOI_TU`=17:00, `NGHI_TOI_DEN`=18:00. Giờ bắt đầu = `Ca_Ngay_Tu` của tổ. Nghỉ trưa vẫn theo `Lich_Lam_Viec_To` (giả định 11:30–12:15, chưa xác nhận từng tổ) |
| Phút kế hoạch | Ngày thường: theo lịch tổ trừ nghỉ trưa. Ngày tăng ca: 07:00–20:30 − nghỉ trưa 45 − nghỉ tối 60 = **705 phút** |
| Một máy-ngày một trạng thái | Đóng ca ngày ngày nào thì ngày đó không tăng ca. Server báo lỗi; giao diện bỏ qua và báo lại; đóng máy vào ngày đang tăng ca thì tăng ca ngày đó tự bỏ |
| Tổ có ca đêm | **ĐÃ ĐỔI (19/09/2026):** tăng ca luôn hiện, kể cả tổ có ca đêm — ca đêm không cố định, tổ chọn tăng ca ngày nếu đủ người, chỉ khi không đủ mới chạy ca đêm. **Máy tăng ca ngày nào thì KHÔNG chạy ca đêm ngày đó** (tăng ca thay ca đêm): không ghi được về giữa ca ĐÊM cho máy-ngày đó; lưu tuần tự bỏ lượt về giữa ca đêm bị tăng ca đè; Đợt 3 không tính phút kế hoạch ca đêm của máy-ngày có tăng ca (tránh tính trùng khung 17:00–20:30) |
| Client bản cũ | Không gửi `tangCa` → server GIỮ NGUYÊN tăng ca đã lưu, không xoá nhầm |

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Khoá cấu hình + `gioTangCa_`, `truKhoangNghi_`, `khungKeHoachNgayCuaMay_` + 13 test | ✅ viết xong |
| 2 | `chuanHoaTangCa_`, `chuanHoaDanhSachTangCa_`, `phanLoaiDongKeHoach_`, sửa `luu/layKeHoachTuan` + 17 test | ✅ viết xong |
| 3 | `ToTruong.html`: nút tăng ca từng máy / máy đã chọn / tất cả máy, sao chép ngày mang theo tăng ca | ✅ viết xong, thử với dữ liệu giả |
| 4 | Test + tài liệu + push | ✅ `clasp push`, menu 🧪 **432/432**, đã deploy, **chủ dự án test tay trên link thật ổn (19/09/2026)** |

**Việc còn lại trước khi coi là XONG:** `clasp push` (chủ dự án xác nhận riêng), chạy menu 🧪
xem số test (đã đo: **432/432**), rồi test tay: bật tăng ca vài
máy → Lưu → F5 giữ nguyên; đóng máy ngày đang tăng ca → tăng ca ngày đó biến mất; tổ có ca đêm
không thấy nút tăng ca. Deploy sau push, giữ đúng deployment ID.

## 9d. Đợt 2(b) — Về giữa ca, tổ trưởng ghi (chủ dự án chốt 19/09/2026)

Công nhân xin về giữa ca thì phải xin tổ trưởng; tổ trưởng ghi trên trang của mình. Máy tính là
không chạy từ giờ về tới hết ca (hoặc tới giờ quay lại nếu người đó quay lại sớm). Ca sau vào
là bình thường, không ai phải quét bật lại. **Không đụng** `Index.html`, `CongNhan.gs`,
`Su_Co`, trigger hay luồng QR.

| Chủ đề | Đã chốt |
|---|---|
| Ai ghi | Tổ trưởng, trên trang `?page=kehoach` (xác thực `xacThucTo_`), chọn MỘT hoặc NHIỀU máy (một công nhân có thể trông nhiều máy) |
| Lý do | Chỉ "Nghỉ có phép" / "Nghỉ không phép" — `Cau_Hinh.LY_DO_VE_GIUA_CA`, sửa trên Sheet |
| Lưu ở đâu | `Ke_Hoach_May`, `Trang_Thai='VE_GIUA_CA'`, một dòng/máy-ngày-ca (ghi lần hai đè lần một). **Thêm 2 cột CUỐI `Gio_Ve`, `Gio_Quay_Lai`** (chủ dự án đã đồng ý); `Gio_Quay_Lai` trống = nghỉ tới hết ca |
| Ghi khi nào | Ghi NGAY qua RPC riêng (`ghiVeGiuaCa`, `capNhatQuayLaiVeGiuaCa`, `huyVeGiuaCa`), KHÔNG qua nút "Lưu kế hoạch tuần"; `luuKeHoachTuan` luôn giữ nguyên các dòng này (trừ lượt bị đóng máy đè lên đúng máy-ngày-ca) |
| Phút mất | `tinhVeGiuaCa_`: giao của [giờ về, quay lại hoặc hết ca] với khung kế hoạch — nghỉ trưa/nghỉ tối KHÔNG tính là mất. Ngày tăng ca hết ca 20:30. Ca đêm dùng trục liên tục (sau nửa đêm +1440) |
| Chặn | Ngày chưa tới; máy tổ khác; máy đang đóng ca đó; tổ chưa khai lịch / không có ca đêm; giờ về ngoài ca; giờ quay lại không sau giờ về hoặc sau hết ca; một máy lỗi thì cả lượt không ghi |
| Đợt 3 | Tính là **mất giờ chạy** (kéo hiệu suất xuống), tách riêng được theo lý do có phép hay không |

| # | Việc | Trạng thái |
|---|---|---|
| 1 | 2 cột mới, khoá `LY_DO_VE_GIUA_CA`, `khungCaDemCuaMay_`, `tinhVeGiuaCa_` + 25 test | ✅ viết xong |
| 2 | `chuanHoaDanhSachVeGiuaCa_`, 3 RPC, `layKeHoachTuan` trả `veGiuaCa`, `luuKeHoachTuan` giữ lại + 25 test | ✅ viết xong |
| 3 | `ToTruong.html`: mục "Về giữa ca", hộp thoại ghi nhiều máy, quay lại, huỷ; thử với dữ liệu giả | ✅ viết xong |
| 4 | Tài liệu + push | ✅ `clasp push`, menu 🧪 **482/482**, đã deploy, **chủ dự án test tay trên link thật ổn (19/09/2026)**. Sau test tay bổ sung dòng "🏠 Về giữa ca" trên thẻ máy (commit `5a3cea2`), đã deploy lại |

**Test tay trên link thật (dùng MỘT máy thử, dọn ngay sau đó):** ghi về giữa ca 1 máy → F5 vẫn còn;
ghi 2 máy một lượt; cập nhật giờ quay lại; huỷ; đóng máy đúng ngày đó rồi Lưu tuần → lượt về
giữa ca của máy đó biến mất, các lượt khác còn; máy đang đóng thì hộp thoại khoá máy đó.
**Dọn dữ liệu thử:** mở sheet `Ke_Hoach_May`, lọc cột `Trang_Thai` = `VE_GIUA_CA` (và `TANG_CA`
nếu có thử), xoá các dòng của máy thử; các dòng `DONG`/`DA_KHAI` do tổ trưởng khai thật thì KHÔNG xoá.

## 9e. Nghỉ trong CA ĐÊM — theo từng bộ phận (chủ dự án chốt 19/09/2026)

Form khai lịch tổ chỉ có MỘT giờ nghỉ (nghỉ trưa), nên ca đêm coi như chạy liền. Đêm không quản lý
giờ nghỉ cụ thể (mọi người tự sắp xếp, khoảng 1 tiếng) và mỗi bộ phận nghỉ khác nhau, có bộ phận
không nghỉ. Quyết định: **không thêm cột, không sửa form** — chỉ khai TỔNG số phút nghỉ trong
`Cau_Hinh`.

| Chủ đề | Đã chốt |
|---|---|
| Khoá | `NGHI_DEM_PHUT_<MÃ BỘ PHẬN>` — mỗi bộ phận một dòng. Seed sẵn DET, SOI, CMTX = 60 (các tổ có ca đêm theo bảng ca); bộ phận khác/mới thì thêm dòng theo mẫu |
| Không nghỉ | Đặt 0, xoá dòng, để trống hoặc sai định dạng đều = 0 |
| Phút kế hoạch ca đêm | Độ dài ca − số phút nghỉ (luôn còn ≥ 1 phút). Đợt 3 dùng làm mẫu số ca đêm |
| Về giữa ca ban đêm | Quy đổi **theo tỷ lệ**: phút giao × (kế hoạch / độ dài ca), vì không biết nghỉ rơi lúc nào. VD ca 16:30–07:00, nghỉ 60, về 23:00: 480 × 810/870 = 447 phút. Không nghỉ → giữ 480 |
| Ca ngày / ngày tăng ca | Không dùng khoá này (đã có giờ nghỉ cụ thể) |
| Hàm | `nghiDemPhut_(boPhan)` (Code.gs), `khungCaDemCuaMay_(lich, nghiDemPhut)`, `tinhVeGiuaCa_(..., nghiDemPhut)` (KeHoachTo.gs) |

**Trạng thái:** đã viết + 14 test mới, đã `clasp push`, menu 🧪 ra **496/496** (482 + 14). **Chờ**: menu "1. Cài đặt hệ thống"
(thêm 3 dòng cấu hình) + **deploy** (RPC `ghiVeGiuaCa` chạy bản đã deploy, không chạy bản HEAD) + chủ dự án chỉnh số
phút nghỉ từng bộ phận trong `Cau_Hinh`.

## 9f. Giao diện tổ trưởng viết lại + "Chạy ca đêm" (chủ dự án chốt 19/09/2026)

Tổ trưởng chủ yếu dùng điện thoại, không rành công nghệ; trang cũ (danh sách 48 thẻ máy + 6 khối thao tác) quá
rối. `ToTruong.html` được **viết lại toàn bộ** theo việc cần làm; server/dữ liệu không đổi ngoài loại dòng mới.

**Giao diện mới:** màn hình chính chỉ có nút lớn — Đóng máy · Tăng ca · Chạy ca đêm (chỉ tổ có ca đêm) ·
Có người xin về · Xem kế hoạch tuần · "Việc khác…" (Đóng Chủ nhật, Sao chép ngày, Bỏ hết đóng máy). Mỗi việc là
vài BƯỚC, mỗi bước một câu hỏi; **bấm Xác nhận là LƯU LUÔN** (không còn nút "Lưu kế hoạch tuần"; lưu lỗi thì
tự khôi phục về trạng thái trước). "Xem kế hoạch tuần" gom theo NGÀY, mỗi mục có nút ✕ xoá.

**⚠️ ĐÍNH CHÍNH 19/09/2026 — chế độ ca đêm THEO TỪNG BỘ PHẬN (thay cho "mọi tổ mặc định không chạy" bên dưới):**
chủ dự án báo lại: **Dệt (DET), Sợi (SOI), CMTX luôn có ca đêm**; chỉ **TRANG** lâu lâu mới có; **ICM, MTX không có ca đêm
nhưng có tăng ca**. Khoá `Cau_Hinh.CA_DEM_MAC_DINH_<BO_PHAN>`: `CHAY` (seed DET/SOI/CMTX) hoặc `KHONG` (thiếu/trống = KHONG,
gồm TRANG). Chỉ có tác dụng với tổ tick "Có ca đêm" trong lịch.
- **CHAY (luôn chạy ca đêm):** ca đêm mặc định chạy, ngày không chạy thì Đóng máy → Ca đêm (dòng `DONG` Ca='D', có lý do). **Ẩn nút
  "Chạy ca đêm" và nút Tăng ca** (chủ dự án chốt: ba tổ này không dùng tăng ca). Server bỏ mọi tăng ca / CHAY_DEM gửi lên hoặc đã lưu
  của tổ CHAY (`chonTangCaChayDemGhi_`). Về giữa ca ca đêm ghi được khi máy chưa bị đóng ca đêm.
- **KHONG (TRANG):** như mô tả bên dưới — mặc định không chạy ca đêm, ngày chạy thì bấm "Chạy ca đêm"; tăng ca dùng được; tăng ca thay ca đêm.
- **Tổ không ca đêm (ICM, MTX…):** không có bước "Ca nào?" và không có nút ca đêm; tăng ca dùng bình thường.
- **Đợt 3:** ca đêm của một máy-ngày được tính khi: tổ CHAY = không có dòng DONG ca D; tổ KHONG = có dòng CHAY_DEM.

**Mô hình ca đêm (dành cho tổ KHONG):** ca đêm KHÔNG cố định (chạy khi không đủ người tăng ca, lâu lâu mới có), nên với tổ
có ca đêm **mặc định máy KHÔNG chạy ca đêm**; ngày nào chạy thì tổ trưởng chọn "Chạy ca đêm" cho máy đó —
dòng `Ke_Hoach_May` `Trang_Thai='CHAY_DEM'`, `Ca='D'`, không thêm cột. **Tăng ca ngày và chạy ca đêm loại
trừ nhau** trên cùng máy-ngày (server báo lỗi `xungDotTangCaChayDem_`; giao diện tự bỏ qua và báo). Đóng máy chỉ
áp cho ca ngày (UI không còn tạo dòng đóng ca đêm; dòng cũ nếu có vẫn hiện ở Xem kế hoạch và xoá được).
Về giữa ca ca đêm chỉ ghi được khi máy đã "Chạy ca đêm" ngày đó; bỏ "Chạy ca đêm" thì lượt về giữa ca đêm
tự bị bỏ khi lưu. **Đợt 3:** ca đêm chỉ tính cho máy-ngày có dòng `CHAY_DEM`.

**Hàm mới (KeHoachTo.gs):** `chuanHoaChayDem_`, `chuanHoaDanhSachChayDem_`, `xungDotTangCaChayDem_`,
`boVeGiuaCaDemKhongChayDem_` (thay `boVeGiuaCaDemBiTangCaDe_`); `layKeHoachTuan` trả thêm `chayDem`;
`luuKeHoachTuan` nhận `chayDem` (không gửi → giữ nguyên dòng đã lưu).

**Trạng thái:** đã viết, 17 test mới (dự kiến **520**, chưa kiểm chứng trong Sheet), thử trong trình duyệt
với dữ liệu giả cả tổ có / không có ca đêm. Chờ: `clasp push` + menu 🧪 + deploy + chủ dự án thử trên điện thoại.

## 9b. Việc làm thêm SAU khi Đợt 1 xong (không thuộc 8 bước gốc)

- **Vá lỗi `getLastRow()` ở `themMayMoi()` (`DanhMuc.gs`)** — xác nhận thật trên Sheet (`Ctrl+End` nhảy dòng 1000 dù chỉ ~162 máy), vá bằng `soDongCoDuLieu_`. Không ảnh hưởng dữ liệu đã có (`CMTD02`/`CMTD03` vẫn đúng vị trí). Đã push + deploy.
- **Sinh link + in QR cho tổ trưởng** — mở rộng `refreshPersonalLinks()` (Code.gs) và `MaQR.gs`/`InQr.html` thêm loại thứ 3 `to` cạnh `may`/`tho`. Dính 1 lần lỗi do **deploy trước khi push** (bản `/exec` chạy code cũ, `loai=to` rơi vào nhánh mặc định "máy") — đã sửa bằng làm lại đúng thứ tự push→deploy. Chủ dự án xác nhận chạy đúng.
- **Bài học ghi lại: LUÔN push trước, deploy sau** — deploy trước sẽ đóng băng code cũ dù local/GitHub đã có bản mới hơn.

## 10. Việc cần làm khi mở chat mới để tiếp tục

1. Đọc file này + [`bao-tri-v2/CLAUDE.md`](bao-tri-v2/CLAUDE.md) trước.
2. Chạy `dongbo.ps1` để chắc repo/GitHub/Apps Script chưa lệch kể từ lúc file này được viết.
3. Nói rõ đang ở bước mấy trong bảng mục 9 (nếu đã bắt đầu), hoặc gõ **DUYỆT TRIỂN KHAI
   BƯỚC 1** nếu chưa bắt đầu.
4. Sau mỗi bước hoàn thành, cập nhật bảng mục 9 trong chính file này (đánh dấu đã xong)
   trước khi đóng phiên — để phiên sau biết chính xác đang dở ở đâu mà không phải đọc
   lại toàn bộ lịch sử chat.
