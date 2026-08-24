# Task nâng cấp SAPHIA — Tự động tính đáp ứng, Sheet báo cáo sếp, Tích hợp KPI Dệt

> File này bổ sung cho `CLAUDE.md` đã có. Đọc `CLAUDE.md` trước để nắm bối cảnh chung, rồi đọc file
> này để biết chi tiết task sắp làm. **Chưa sửa code khi chưa xác nhận các mục "❓ CẦN QUYẾT ĐỊNH".**

Mục tiêu chung: sau khi công nhân/kỹ thuật viên nhập xong 1 phiếu báo hỏng qua form mobile, hệ thống
tự tính toán và lưu **hoàn toàn tự động** — không cần ai mở Sheet chỉnh tay — gồm 3 phần độc lập:

- **Phần A** — Tự tính "thời gian đáp ứng" + "chồng lịch kỹ thuật viên" ngay khi lưu phiếu.
- **Phần B** — Tự tổng hợp thành 1 sheet báo cáo tháng để gửi sếp.
- **Phần C** — Nếu phiếu thuộc bộ phận DET (dệt), tự động đẩy sang hệ thống KPI Dệt riêng.

---

## PHẦN A — Tự động tính thời gian đáp ứng & phát hiện chồng lịch

Logic dưới đây dịch **chính xác** từ file mẫu `BC_HH_T7_2026.xlsx` (sheet `CALC_DAP_UNG` +
công thức cột AA/AB/AC của sheet `Data_Goc`) — không phải suy đoán, đã đọc từng công thức gốc.

### A.1 — Thêm trường "Ca" vào form (`apps-script/index.html`)

Hiện form **chưa có** lựa chọn Ca (Ngày/Đêm) — bắt buộc phải thêm vì nó quyết định cách quy đổi giờ
qua ngày hôm sau. Đề xuất: 2 nút chọn (chip) "Ca Ngày" / "Ca Đêm" ngay trên phần "Thời gian sửa chữa",
bắt buộc chọn trước khi submit.

### A.2 — Cột mới trong sheet `BaoCao` (thêm vào **CUỐI**, không chèn giữa)

Nguyên tắc: giữ nguyên 19 cột hiện có (A→S) để không phá bất cứ script/tham chiếu nào đang chạy.
Thêm 6 cột mới nối tiếp:

| Cột | Tên | Kiểu | Ghi chú |
|---|---|---|---|
| T | Ca | text | "Ngày" / "Đêm" |
| U | ThoiGianDapUngTong_phut | số | = lúc bắt đầu sửa thực − lúc hư thực |
| V | ThoiGianChoThoBan_phut | số | thời gian máy phải chờ vì thợ đang bận việc khác |
| W | ThoiGianDapUngSauKhiRanh_phut | số | từ lúc thợ rảnh đến lúc thực sự bắt đầu sửa |
| X | SoLanChongViec | số nguyên | số phiếu khác của CÙNG thợ bị chồng khung giờ sửa chữa |
| Y | TrangThaiDapUng | text | xem bảng trạng thái ở A.5 |

### A.3 — Quy đổi giờ → datetime thực (xử lý ca đêm qua ngày hôm sau)

```js
const MOC_CHUYEN_CA_DEM = '07:00'; // mốc: sau giờ này của ngày hôm sau mới coi là "qua ca"

// Bắt đầu hư / Bắt đầu sửa thực tế
function toActualDateTime_(ngayStr, hhmm, ca) {
  if (!ngayStr || !hhmm) return null;
  let dt = new Date(ngayStr + 'T' + hhmm + ':00+07:00');
  if (ca === 'Đêm' && hhmm < MOC_CHUYEN_CA_DEM) {
    dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000); // +1 ngày
  }
  return dt;
}

// Kết thúc sửa thực tế — có thêm điều kiện: nếu tính ra TRƯỚC lúc bắt đầu sửa thực
// (tức việc sửa vắt qua nửa đêm) thì cộng thêm 1 ngày nữa
function toActualEndDateTime_(ngayStr, hhmmEnd, ca, batDauSuaActual) {
  let end = toActualDateTime_(ngayStr, hhmmEnd, ca);
  if (end && batDauSuaActual && end < batDauSuaActual) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return end;
}
```

### A.4 — Tìm việc đang làm dở + đếm chồng lịch (so với các phiếu ĐÃ có của cùng thợ)

```js
// existingRows: các phiếu đã có trong sheet BaoCao (không gồm phiếu đang submit),
// mỗi phần tử: { tenKyThuat, batDauSuaActual, ketThucActual }
// current: phiếu đang submit: { tenKyThuat, batDauHuActual, batDauSuaActual, ketThucActual }
function findOverlapAndBusyUntil_(existingRows, current) {
  let busyUntil = null;   // = cột F trong CALC_DAP_UNG gốc
  let overlapCount = 0;   // = cột G trong CALC_DAP_UNG gốc

  existingRows.forEach(row => {
    if (row.tenKyThuat !== current.tenKyThuat) return;

    // Thợ đang làm dở việc khác vào đúng lúc máy này báo hư?
    if (row.batDauSuaActual < current.batDauHuActual && row.ketThucActual > current.batDauHuActual) {
      if (!busyUntil || row.ketThucActual > busyUntil) busyUntil = row.ketThucActual;
    }
    // Khung giờ sửa chữa thực tế của phiếu này có chồng với phiếu cũ nào không?
    if (row.batDauSuaActual < current.ketThucActual && row.ketThucActual > current.batDauSuaActual) {
      overlapCount++;
    }
  });

  return { busyUntil, overlapCount };
}
```

### A.5 — Tính 3 chỉ số phút + xác định trạng thái (dịch từ cột I/AA/AB/AC gốc)

```js
function calcDapUngMetrics_(current, busyUntil, overlapCount) {
  const { tenKyThuat, batDauHuActual, batDauSuaActual, ketThucActual } = current;

  if (!tenKyThuat) return { trangThai: 'CHƯA NHẬP NGƯỜI XỬ LÝ' };
  if (tenKyThuat === 'Không cần thợ cơ khí') return { trangThai: 'KHÔNG YÊU CẦU THỢ CƠ KHÍ' };
  if (!batDauHuActual || !batDauSuaActual || !ketThucActual) return { trangThai: 'THIẾU THỜI GIAN' };

  const moc = busyUntil || batDauHuActual;
  const tong        = Math.max(0, batDauSuaActual - batDauHuActual) / 60000;
  const cho         = Math.max(0, Math.min(batDauSuaActual, moc) - batDauHuActual) / 60000;
  const dapUngSauRanh = Math.max(0, batDauSuaActual - Math.max(batDauHuActual, moc)) / 60000;

  let trangThai;
  if (overlapCount > 0) trangThai = 'CHỒNG VIỆC / KIỂM TRA DỮ LIỆU';
  else if (busyUntil)   trangThai = 'CHỜ THỢ RẢNH';
  else                  trangThai = 'THỢ RẢNH';

  return { tong, cho, dapUngSauRanh, overlapCount, trangThai };
}
```

Toàn bộ A.3–A.5 chạy **bên trong `submitBaoCao()`**, ngay trước bước `appendRow`, để phiếu được lưu
đã có đủ 6 cột mới — đúng yêu cầu "nhập xong tự tính và lưu hoàn toàn tự động".

### ❓ A.6 — CẦN QUYẾT ĐỊNH trước khi code

1. **"Bắt đầu hư" có bắt buộc nhập không?**
   Form hiện tại bắt buộc cả 3 mốc giờ. Nhưng trong thực tế vận hành bằng Excel, cột này **được phép
   để trống** (dẫn tới trạng thái "THIẾU THỜI GIAN" chứ không chặn lưu phiếu) — vì nhiều lúc công nhân
   không rõ chính xác máy hư từ lúc nào, chỉ biết lúc gọi thợ.
   → *Đề xuất*: bỏ bắt buộc cho "Bắt đầu hư", giữ bắt buộc "Bắt đầu sửa" + "Kết thúc" (đúng theo cách
   dữ liệu thực tế tháng 7 đang được nhập). Xác nhận lại nếu bạn muốn giữ bắt buộc như cũ.

2. **Chồng lịch 2 chiều**: khi phiếu MỚI tạo ra chồng lịch với 1 phiếu CŨ đã lưu trước đó, phiếu CŨ đó
   sẽ không tự cập nhật lại `SoLanChongViec` của nó (vì đã ghi 1 lần rồi, không quét lại toàn sheet mỗi
   lần có phiếu mới — tốn thời gian, ảnh hưởng tốc độ submit).
   → *Đề xuất*: chấp nhận giới hạn này ở giai đoạn 1 (đúng nguyên tắc "nhập nhanh"), coi
   `SoLanChongViec` là chỉ số "tại thời điểm lưu phiếu", không phải số liệu sống cập nhật ngược. Nếu
   cần chính xác tuyệt đối, Phần B (sheet báo cáo sếp) sẽ quét lại toàn bộ dữ liệu mỗi lần refresh nên
   vẫn ra số đúng ở tầng tổng hợp.

3. **Phạm vi quét dữ liệu cũ để tìm chồng lịch**: quét toàn bộ sheet `BaoCao` (đến vài trăm dòng/tháng,
   vẫn nhanh) hay giới hạn 2 ngày gần nhất (nhanh hơn, đủ dùng vì chồng lịch gần như luôn xảy ra trong
   cùng ca/ngày)?
   → *Đề xuất*: quét toàn bộ tháng hiện tại trước (đơn giản, dữ liệu mỗi tháng reset nên không lớn) —
   chỉ tối ưu giới hạn ngày nếu sau này thấy chậm thật.

---

## PHẦN B — Sheet "Báo cáo sếp" hằng tháng (tự động tổng hợp)

Sheet mới tên `BaoCaoSep`, mô phỏng đúng bố cục sheet `Dashboard` trong file Excel mẫu:

- Tổng số lần hỏng / tổng downtime / tổng thời gian sửa (toàn nhà máy).
- Bảng theo **bộ phận** (SOI, DET, TRANG, CMTX, MTX, CO...): số lần hỏng, tổng downtime, tổng thời
  gian sửa.
- Bảng theo **máy**: số lần hỏng, tổng downtime, tổng thời gian sửa.
- Bảng theo **kỹ thuật viên**: số việc, TB thời gian đáp ứng, TB đáp ứng sau khi rảnh, số lần chồng
  việc — tận dụng luôn 6 cột mới ở Phần A, không cần tính lại từ đầu.

Đúng nguyên tắc dự án (đã ghi trong `CLAUDE.md`): **tính bằng Apps Script (server-side)**, không dùng
công thức Sheets, tránh lỗi locale/#ERROR!.

```js
function updateBaoCaoSepSheet_() {
  // đọc toàn bộ sheet BaoCao, group theo bộ phận / máy / kỹ thuật viên,
  // ghi kết quả (đã tính sẵn dạng số) vào sheet BaoCaoSep bằng setValues() 1 lần
  // (không dùng appendRow từng dòng — clear rồi ghi lại toàn bộ mỗi lần chạy)
}
```

**Thời điểm chạy** — không tính đồng bộ ngay trong `submitBaoCao()` (sẽ làm chậm form nhập liệu của
công nhân). Đề xuất kết hợp:
- **Trigger theo lịch** (installable time-driven trigger, ví dụ mỗi ngày 23:50) — tự động, không ai
  phải nhớ bấm.
- **Menu tuỳ chỉnh** `🔄 Cập nhật báo cáo sếp` trong Google Sheet — để refresh ngay lập tức khi cần gửi
  gấp cho sếp.

⚠️ Lưu ý triển khai: trigger theo lịch **không tự bật khi `clasp push`** — cần chạy 1 lần hàm cài đặt
(`ScriptApp.newTrigger(...).timeBased()...create()`) qua Apps Script Editor (hoặc để Claude Code hướng
dẫn bạn bấm nút Run 1 lần) để đăng ký trigger.

---

## PHẦN C — Tích hợp KPI Dệt (bộ phận DET)

Đã đọc kỹ file `DET_KPI_T7_2026_dmy.xlsx` (9 sheet). Phát hiện quan trọng: 2 chỉ số đầu trong sheet
`Tổng Hợp` (`TỔNG DOWNTIME`, `TỔNG SỐ SỰ CỐ`) **đã là công thức Sheets sống**, tham chiếu thẳng cột J
của sheet `Nhật ký bảo trì`:

```
B6: =SUM('Nhật ký bảo trì'!J:J)
E6: =COUNTIF('Nhật ký bảo trì'!J:J, ">0")
```

→ Nghĩa là **không cần viết thêm logic tính KPI cho phần này** — chỉ cần Apps Script ghi đúng 1 dòng
vào đúng sheet `Nhật ký bảo trì`, công thức có sẵn sẽ tự cập nhật ngay.

### C.1 — Phạm vi làm được ngay (Giai đoạn 1)

Cấu trúc sheet `Nhật ký bảo trì` (10 cột, khớp thẳng với payload `submitBaoCao` hiện có):

| Cột | Nguồn từ payload SAPHIA |
|---|---|
| Mã sự cố | `id` (tự sinh) |
| Ngày sửa | `payload.ngay` |
| Ca | `payload.ca` (field mới ở Phần A) |
| Tên máy | `payload.tenMay` |
| Nội dung hư hỏng (Bệnh) | `payload.noiDung` |
| Bắt đầu hư | `payload.gioHu` |
| Bắt đầu sửa | `payload.gioSua` |
| Kết thúc sửa | `payload.gioKetThuc` |
| Thời gian sửa máy (Phút) | `tgSuaChua` (đã tính sẵn) |
| Thời gian dừng máy (Phút) | `tgDungMay` (đã tính sẵn) |

Logic: trong `submitBaoCao()`, **sau khi** ghi xong vào `BaoCao` như bình thường — nếu
`payload.boPhan === 'DET'`, mở thêm Google Sheet KPI Dệt bằng `SpreadsheetApp.openById(ID_KPI_DET)` và
`appendRow` 1 dòng tương ứng vào sheet `Nhật ký bảo trì` của nó.

```js
const ID_KPI_DET = '...'; // Spreadsheet ID của Google Sheet KPI Dệt — xem mục ❓ C.3

function ghiSangKpiDet_(payload, id) {
  if (payload.boPhan !== 'DET') return;
  const shDet = SpreadsheetApp.openById(ID_KPI_DET).getSheetByName('Nhật ký bảo trì');
  shDet.appendRow([
    id, payload.ngay, payload.ca, payload.tenMay, payload.noiDung,
    payload.gioHu, payload.gioSua, payload.gioKetThuc,
    tgSuaChua, tgDungMay
  ]);
}
```

Nên bọc trong `try/catch` riêng — nếu ghi sang sheet KPI Dệt lỗi (vd mất quyền truy cập), **không được
làm hỏng việc lưu phiếu chính** vào `BaoCao`.

### C.2 — Ngoài phạm vi (Giai đoạn 2 — cần nguồn dữ liệu khác)

`TỶ LỆ KHẢ DỤNG (AVAILABILITY)`, cùng các sheet `Tổng hợp chạy máy`, `Phân tích Năng suất Máy`,
`Tổng hợp giờ theo ngày`, `Luân ca Nhóm A/B` — **toàn bộ phụ thuộc dữ liệu giờ chạy máy thực tế**,
nhiều khả năng xuất ra từ hệ thống giám sát PLC của máy dệt. Hệ thống báo cáo sửa chữa hiện tại
**không có** nguồn dữ liệu này, nên các phần này để nguyên, cập nhật thủ công như cũ — không nằm
trong phạm vi nâng cấp lần này.

### ❓ C.3 — CẦN QUYẾT ĐỊNH trước khi code

1. **File `DET_KPI_T7_2026_dmy.xlsx` hiện đang là file Excel rời** (không phải Google Sheet) — Apps
   Script chỉ ghi tự động được vào **Google Sheet thật**, không ghi được vào file `.xlsx` nằm trên máy
   hay trong email. Bạn đã có bản Google Sheet tương ứng (đã upload lên Drive, mở bằng Google Sheets)
   chưa, hay cần tạo mới từ file Excel này?
   - Nếu **chưa có**: bước đầu tiên của Claude Code sẽ là tạo Google Sheet mới từ file Excel (giữ
     nguyên toàn bộ 9 sheet, đặc biệt không được phá công thức ở `Tổng Hợp`), rồi lấy Spreadsheet ID
     điền vào `ID_KPI_DET`.
   - Nếu **đã có**: chỉ cần gửi Spreadsheet ID (không cần gửi cả link công khai).

2. **Có nguồn dữ liệu giờ chạy máy PLC không** (để biết Giai đoạn 2 có khả thi trong tương lai hay
   không, dù chưa làm ngay)? Có thể là file export định kỳ, hệ thống giám sát riêng, hay hiện tại vẫn
   nhập tay 100%.

---

## PHẦN D — Nhập giờ chạy máy PLC hằng ngày (46 máy × 2 ca) + lưu ảnh minh chứng

**Bối cảnh**: bạn sẽ đọc số liệu PLC từ ảnh chụp tại xưởng rồi gõ tay vào hệ thống. Đây chính là
nguồn dữ liệu còn thiếu ở mục C.2 ("Giai đoạn 2") — nghĩa là Phần D này **mở khoá luôn** việc tính
"Tỷ lệ khả dụng" tự động, không còn phải để thủ công nữa. Đích đến của dữ liệu nhập là sheet
`Tổng hợp chạy máy` trong đúng Google Sheet KPI Dệt (`ID_KPI_DET`) ở Phần C.

### D.1 — Tin vui: chỉ cần gõ tay ĐÚNG 1 cột, không phải cả 46×2 dòng đầy đủ

Soi lại cấu trúc sheet `Tổng hợp chạy máy` (10 cột), chỉ có **1 cột thật sự cần đọc từ ảnh**:

| Cột | Cách có được | Cần gõ tay? |
|---|---|---|
| Ngày, Tên máy, Ca | Cố định theo form (chọn 1 lần cho cả batch) | Không |
| Thời gian KH (Phút) | Hằng số theo ca (615 phút/ca, lấy từ danh mục máy) | Không |
| **Thời gian chạy thực tế (PLC)** | **Đọc từ ảnh PLC, gõ tay** | **CÓ — duy nhất cột này** |
| Thời gian dừng máy (Phút) | Tự động = SUM downtime của đúng máy + đúng ngày + đúng ca, lấy trực tiếp từ sheet `Nhật ký bảo trì` đã được Phần C ghi vào | Không |
| Thời gian máy chạy lý thuyết | = Thời gian KH − Thời gian dừng máy (công thức) | Không |
| Tỷ lệ Khả dụng (%) | = Thời gian chạy thực tế ÷ Thời gian máy chạy lý thuyết (công thức) | Không |
| Tên thợ dệt | Tự điền theo lịch `Luân ca Nhóm A/B` đã có sẵn theo tuần, cho sửa tay nếu khác lịch | Hiếm khi |

→ Mỗi ca, bạn chỉ cần gõ **46 con số** (thời gian chạy thực tế đọc từ PLC), không phải 46×10 ô.

### D.2 — Thiết kế form nhập

Trang riêng (khác trang báo hỏng, vì người dùng khác — thường là 1 người tổng hợp cuối ca, không phải
từng công nhân quét QR):

1. Chọn **Ngày** (mặc định hôm nay) + **Ca** (Ngày/Đêm) — chọn 1 lần cho cả batch.
2. Bảng 46 dòng, chia 2 nhóm rõ ràng (21 máy 4 thoi, 25 máy 6 thoi) để dễ dò theo thứ tự đi thực tế
   ngoài xưởng — mỗi dòng chỉ có 1 ô nhập: **giờ chạy thực tế** (định dạng gợi ý `giờ:phút`, ví dụ
   `10:15`, khớp đúng đơn vị `[HH:MM PLC]` đã có trong file mẫu).
3. Khu vực **"Ảnh minh chứng"** ở cuối form: `<input type="file" multiple accept="image/*" capture="environment">` — cho phép chụp thẳng bằng camera điện thoại hoặc chọn nhiều ảnh có sẵn, xem trước (preview) trước khi gửi.
4. Nút "Lưu" — 1 lần gửi cả batch (46 dòng số liệu + N ảnh), server ghi 1 lượt bằng `setValues()`
   (nhanh hơn nhiều so với gọi `appendRow` 46 lần).

### D.3 — Lưu ảnh minh chứng vào Google Drive

Apps Script lưu file vào Drive được (`DriveApp`), không cần dịch vụ ngoài:

```js
const FOLDER_ID_ANH_PLC = '...'; // ID thư mục Drive gốc chứa ảnh minh chứng

function luuAnhMinhChung_(ngay, ca, anhBase64List) {
  // Tạo (hoặc lấy) thư mục con theo tháng, vd "2026-07", để không dồn hàng nghìn ảnh vào 1 thư mục
  const thangFolder = layHoacTaoThuMucThang_(FOLDER_ID_ANH_PLC, ngay.slice(0, 7));
  const links = [];
  anhBase64List.forEach((base64, i) => {
    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64.split(',')[1]),
      'image/jpeg',
      `${ngay}_${ca}_${i + 1}.jpg`
    );
    const file = thangFolder.createFile(blob);
    links.push(file.getUrl());
  });
  return links; // lưu các link này vào 1 cột/sheet log để tra cứu lại sau
}
```

Ảnh gốc điện thoại thường 3–5MB — nên **resize/nén phía trình duyệt trước khi gửi** (dùng `<canvas>` để
giảm còn ~800KB–1MB/ảnh) để tránh chậm/lỗi khi gửi qua `google.script.run`.

Link ảnh nên lưu vào 1 sheet log riêng `AnhMinhChungPLC` (cột: Ngày, Ca, Link ảnh 1, Link ảnh 2, ...)
thay vì nhét vào sheet `Tổng hợp chạy máy` — giữ sheet đó đúng khuôn với file Excel mẫu.

### ❓ D.4 — CẦN QUYẾT ĐỊNH trước khi code

1. Đơn vị hiển thị trên màn hình PLC bạn đọc là **giờ:phút** hay **tổng số phút**? (Mình đang mặc định
   giờ:phút vì tên cột gốc ghi `(HH:MM) [PLC]` — báo lại nếu PLC hiện dạng khác.)
2. Ảnh minh chứng — chụp **1 ảnh chung** cho cả ca (vd ảnh toàn cảnh tủ điều khiển) hay **nhiều ảnh**
   theo từng cụm máy? (Form ở trên đã hỗ trợ nhiều ảnh/lần gửi, chỉ cần biết để đặt tên file hợp lý.)
3. Phần D này nên làm ở **giai đoạn nào**? Vì nó độc lập với Phần A/B, có thể làm **song song** hoặc
   để **sau khi** A/B/C ổn định — bạn quyết định thứ tự ưu tiên.

---

## Tóm tắt file/hàm sẽ bị ảnh hưởng

| File | Thay đổi |
|---|---|
| `apps-script/index.html` | + chọn Ca (Ngày/Đêm), bỏ bắt buộc "Bắt đầu hư" (nếu đồng ý mục A.6.1) |
| `apps-script/Mã.js` | + `toActualDateTime_`, `toActualEndDateTime_`, `findOverlapAndBusyUntil_`, `calcDapUngMetrics_`, `updateBaoCaoSepSheet_`, `ghiSangKpiDet_`; sửa `submitBaoCao()` để gọi các hàm trên; + hằng số `ID_KPI_DET`, `MOC_CHUYEN_CA_DEM` |
| Sheet `BaoCao` (Google Sheet) | + 6 cột mới (T→Y), thêm header 1 lần |
| Sheet `BaoCaoSep` (Google Sheet) | Sheet mới, tạo qua code |
| Google Sheet KPI Dệt | Ghi thêm dòng vào `Nhật ký bảo trì` (không đổi cấu trúc/công thức có sẵn); + sheet log mới `AnhMinhChungPLC`; ghi batch vào `Tổng hợp chạy máy` |
| `apps-script/plc.html` | **File mới** — form nhập giờ chạy PLC 46 máy × 2 ca + upload ảnh minh chứng |
| `apps-script/Mã.js` | + `doGet` xử lý thêm route `?page=plc`; + `luuGioChayPlc_`, `luuAnhMinhChung_`, `layHoacTaoThuMucThang_`; + hằng số `FOLDER_ID_ANH_PLC` |
| Google Drive | Thư mục gốc mới chứa ảnh minh chứng, chia thư mục con theo tháng |

---

## Prompt gợi ý dán vào Claude Code Desktop (SAU KHI đã trả lời xong 3 mục ❓ ở trên)

```
Đọc file TASK_NANG_CAP_DAP_UNG_KPI.md ở gốc project và CLAUDE.md.
Câu trả lời cho các mục ❓ CẦN QUYẾT ĐỊNH (A.6, C.3, D.4): [điền câu trả lời của bạn ở đây]

Thực hiện theo đúng thứ tự: Phần A trước (thêm Ca, 6 cột mới, logic tính đáp ứng trong submitBaoCao) —
dừng lại cho tôi xem trước khi làm Phần B, rồi Phần C, rồi Phần D. Không tự ý đổi cấu trúc 19 cột cũ
của BaoCao, cũng không tự ý đổi cấu trúc/công thức có sẵn trong Google Sheet KPI Dệt.
Viết kèm 1 đoạn script test độc lập (chạy bằng dữ liệu mẫu, KHÔNG đụng vào Sheet thật) để tôi kiểm tra
logic tính toán trước khi push.
```
