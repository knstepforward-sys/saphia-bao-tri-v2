# Hệ thống Bảo trì Toàn nhà máy — v2

Hệ thống **riêng biệt**, không phải bản nâng cấp của SAPHIA (`../apps-script/`). Hai hệ
chạy song song, khác Spreadsheet, khác Apps Script project, không chia sẻ dữ liệu — chỉ
có duy nhất `importMayTuSaphia()` đọc một lần danh mục máy từ SAPHIA sang.

Công nhân quét QR trên máy → báo sự cố → gọi điện cho đúng thợ đang trực → thợ nhận việc
trên link cá nhân → sửa xong bấm hoàn thành. Toàn bộ mốc thời gian ghi tự động.

Quy mô: **~162 máy**, **13 thợ**, các bộ phận SOI, DET, TRANG, CMTX, CMTD, MTX, CO, ICM.

**Đang chạy thật.** Đã chuyển sang tài khoản công ty (25/08/2026) — project Apps Script
mới, bản deploy hiện tại: **@1**. Số @45 là của project cũ trên tài khoản cá nhân.

---

## 1. Hạ tầng — KHÔNG tự đổi các giá trị này

| Thứ | Giá trị |
|---|---|
| Spreadsheet ID | `ID_DA_GO_KHOI_KHO_CONG_KHAI` |
| Apps Script ID | `ID_DA_GO_KHOI_KHO_CONG_KHAI` |
| Deployment ID | `MA_TRIEN_KHAI_DA_GO_KHOI_KHO_CONG_KHAI` |
| Tài khoản sở hữu | `EMAIL_DA_GO_KHOI_KHO_CONG_KHAI` — `EMAIL_DA_GO_KHOI_KHO_CONG_KHAI` (tài khoản clasp) có quyền sửa |
| Wrapper công khai | `https://khangdang0703-lab.github.io/baocao-saphia/baotri.html` |

Script là **container-bound** (tạo từ trong Sheet) để `ss_()` trỏ đúng file.

`WEB_APP_URL` và `URL_CONG_KHAI` lưu trong **Script Properties**, không hardcode —
đặt bằng `datWebAppUrl(url)` và `datUrlCongKhai(url)`.

### Wrapper GitHub Pages

Mở thẳng `/exec` thì Google chèn banner *"Ứng dụng này do một người dùng Google Apps
Script tạo"* ở tài liệu cấp cao nhất của `script.google.com` — code của mình **không gỡ
được** vì khác origin. Nhúng qua trang ở domain khác thì banner đó biến mất.

Repo: `github.com/khangdang0703-lab/baocao-saphia` (thư mục `../baocao-saphia/`).
Hai file: `baotri.html` (hệ này) và `index_fullscreen.html` (SAPHIA).

Cả hai **bắt buộc chuyển tiếp query string** sang iframe — không có thì `?may=` và
`?tho=&token=` bị nuốt, mở ra chỉ còn trang hướng dẫn.

Đẩy lên: `cd ../baocao-saphia && git add . && git commit && git push`. Máy này **không
lưu thông tin đăng nhập GitHub** — bước `git push` phải chạy trong terminal thật của
người dùng để hiện cửa sổ đăng nhập.

---

## 2. Cấu trúc file — 21 file

| File | Vai trò |
|---|---|
| `Code.gs` | Cấu hình, schema, hàm nền (ca/lịch trực/mã phiếu/log), `setupSystem`, menu |
| `CongNhan.gs` | `doGet` routing, `getWorkerBootstrap`, `getOnDutyContacts_`, `reportIncident`, `reportMachineStop`, `reportMachineRestart` |
| `LuongTho.gs` | Xác thực thợ, nhận việc, cập nhật hiện trạng, hoàn thành, sửa phiếu đã đóng, việc chung, bảo trì |
| `BaoCao.gs` | `refreshReports` (sheet `Tong_Hop`), `archiveOldTickets`, `caiDatTrigger` |
| `BaoCaoNgay.gs` | Báo cáo trong ngày một trang + sửa nội dung tại chỗ |
| `HieuDung.gs` | Tỉ lệ hiệu dụng A: đọc kế hoạch chạy máy, cắt/hợp khoảng dừng, khối cho `Tong_Hop` và sheet `Hieu_Dung` |
| `BaoCaoKhaDung.gs` | Chức năng báo cáo khả dụng độc lập: xuất ngày/tháng, đủ máy hoạt động, chia theo bộ phận |
| `XuatBaoCao.gs` | Xuất file theo form Excel `BC_HH` và `Nhật ký bảo trì` KPI Dệt, lọc theo khoảng ngày / bộ phận / thợ |
| `MaQR.gs` | Trang in mã QR cho máy và thợ, có khoá |
| `DanhMuc.gs` | Đồng bộ danh mục máy theo bộ phận, thêm máy lẻ |
| `DonDuLieu.gs` | Xoá phiếu / dọn dữ liệu chạy thử, có thùng rác. **Chỉ menu, không có route web** |
| `DoTai.gs` | Đo chi phí thật của từng hàm RPC, chỉ đọc |
| `Test.gs` | ~210 test chạy bằng dữ liệu giả, **không đụng sheet nào** |
| `Index.html` | Trang công nhân |
| `Tho.html` | Trang thợ |
| `InQr.html` | Trang in QR |
| `TrangNgay.html` | Trang báo cáo trong ngày |
| `HopXuat.html` | Hộp thoại chọn kỳ / bộ phận / thợ khi xuất báo cáo (modal trong Sheet) |
| `HopKhaDung.html` | Hộp thoại xuất báo cáo khả dụng mới theo ngày hoặc tháng |
| `Style.html` | CSS dùng chung cho trang công nhân + thợ, nạp qua `include()` |
| `appsscript.json` | Manifest |

> Apps Script **không cho hai file trùng tên** dù khác đuôi. Đó là lý do có cặp
> `LuongTho.gs`/`Tho.html`, `MaQR.gs`/`InQr.html`, `BaoCaoNgay.gs`/`TrangNgay.html`.

**Bộ kiểm tra tĩnh nằm ở `../kiemtra/`** — cố ý đặt NGOÀI thư mục clasp, nếu để bên trong
thì `clasp push` sẽ đẩy nhầm chúng lên Apps Script.

---

## 3. Schema — 11 sheet

`Danh_Muc_May` · `Danh_Muc_Tho` · `Ca_Lam_Viec` · `Ke_Hoach_Chay_May` ·
`Khung_Ngung_Ke_Hoach` · `Cau_Hinh` ·
`Lich_Truc_Thang` · `Su_Co` · `Nhat_Ky_Su_Co` · `Tong_Hop` · `Luu_Tru` · `Thung_Rac`

Tất cả do `setupSystem()` tạo. Chạy lại **an toàn**: không xoá dữ liệu, chỉ ghi lại header,
và bổ sung khoá cấu hình còn thiếu.

### `Su_Co` — sheet trung tâm, 33 cột

23 cột gốc theo bản thiết kế, rồi các cột bổ sung **luôn thêm vào CUỐI**:

| Cột | Ý nghĩa |
|---|---|
| `Thoi_Gian_Dung_May` | Mốc máy thực sự dừng |
| `Phut_Cho_Tho_Ban` | Máy chờ vì thợ bận việc khác — **KHÔNG** tính vào KPI thợ |
| `Phut_Dap_Ung_Thuc` | Từ lúc thợ rảnh đến lúc bấm nhận (bản một mốc rảnh) |
| `So_Chong_Viec` | Số phiếu khác thợ đang giữ dở lúc bấm nhận |
| `Loai_Phieu` | `SU_CO` / `CONG_VIEC` / `BAO_TRI` / `DUNG_MAY`. Trống = `SU_CO` |
| `Phut_Ban_Thuc_Te` | Tổng phút thợ thật sự bận, cộng dồn từng đoạn (09/2026) |
| `Phut_KPI_Tho` | `Phut_Tiep_Nhan − Phut_Ban_Thuc_Te` — **đây mới là** số chấm KPI |
| `So_Doan_Ban` | Số đoạn bận rời; `≥2` là phiếu mà cách cũ miễn trừ rộng tay |
| `KPI_Ap_Dung` | `CO` / `KHONG — <lý do>` |
| `Dat_Nguong` | `DAT` / `KHONG_DAT`; rỗng khi chưa chốt ngưỡng |

Mọi truy cập dùng `COT.<Tên_Cột>`, không dùng số.

Năm cột cuối do `tinhLaiKpiTho()` (menu 🎯) tính lại được cho **toàn bộ dữ liệu
cũ** — mọi mốc giờ cần thiết đã nằm sẵn trên sheet. Chạy lại nhiều lần vô hại.
Phải chạy `setupSystem()` một lần trước để nới sheet lên 33 cột; hàm có chốt chặn
báo rõ nếu quên.

### Ba trạng thái

```
CHO_NHAN --(thợ nhận)--> DANG_XU_LY --(thợ báo xong)--> HOAN_THANH
```

Với `DUNG_MAY`: `DANG_XU_LY` = máy đang dừng, `HOAN_THANH` = máy đã chạy lại.

### Mã phiếu

`SC-ddMM-###` · `CV-` · `BT-` · `DM-`, số reset mỗi ngày.

`sinhMaPhieu_` lấy **số lớn nhất đang có +1**, không đếm số dòng — nếu đếm dòng thì chỉ
cần xoá một phiếu là số kế tiếp trùng mã đã cấp.

---

## 4. Bốn loại phiếu — khác nhau ở đâu và VÌ SAO

| | `SC-` Sự cố máy | `DM-` Dừng máy không do hư | `CV-` Việc chung | `BT-` Bảo trì hằng ngày |
|---|---|---|---|---|
| Ai tạo | Công nhân qua QR | Công nhân qua QR | Thợ | Thợ |
| Trạng thái khi tạo | `CHO_NHAN` | `DANG_XU_LY` | `DANG_XU_LY` | `HOAN_THANH` |
| Đóng bằng cách nào | Thợ bấm Hoàn thành | **Công nhân quét lại QR** bấm "Máy đã chạy lại" | Thợ bấm Hoàn thành | Đóng ngay lúc ghi |
| Đếm là lần hỏng của máy | ✅ | ❌ | ❌ | ❌ |
| Đo thời gian đáp ứng | ✅ | ❌ | ❌ | ❌ |
| Đo thời gian dừng máy | ✅ | ✅ | ❌ | ❌ |
| **Tính là "thợ đang bận"** | ✅ | ❌ | ✅ | ❌ |

**`Ten_May` chỉ chứa tên máy thật.** Với `CV-` và `BT-` cột này **để TRỐNG**; tên công việc
nằm ở `Mo_Ta`, khu vực ở `Bo_Phan`. Nhét tên việc vào `Ten_May` sẽ khiến mọi phép gom nhóm
theo máy về sau ăn nhầm.

**Vì sao việc chung nằm chung sheet `Su_Co`:** `tinhDapUng_` quét theo `Ma_Tho` và khoảng
giờ nhận–hoàn thành. Để chung sheet thì thợ lắp camera 9h–11h **tự động** được tính là bận.

**Vì sao bảo trì hằng ngày KHÔNG tính là bận:** thợ làm rải rác trong ca. Nếu tính, người
ghi 20 việc bảo trì sẽ trông như bận suốt 8 tiếng và mọi thời gian máy chờ đều được miễn
trừ oan. Kỹ thuật: phiếu `BT-` **cố ý để trống** `Thoi_Gian_Nhan`.

**Vì sao dừng máy không tính là bận:** không có thợ nào gắn vào phiếu đó.

### Quy trình khi phải đem đồ ra ngoài gia công

Ca có thật: tời nâng số 1 gãy cốt 18/08/2026, tháo đem ra ngoài, hai ngày sau mới ráp.

| Bước | Ai | Thao tác |
|---|---|---|
| 1 | Công nhân | Quét QR báo hư → `SC-` |
| 2 | Thợ | Nhận việc |
| 3a | Thợ | Tháo xong → **Hoàn thành** `SC-`, ghi *"tháo … đem ra ngoài gia công"* |
| 3b | Thợ | Quét QR → **Dừng máy (không hư)** → lý do *"Chờ phụ tùng / sửa chữa ngoài"*, mô tả ghi mã `SC-` gốc |
| 4a | Thợ | Đồ về → tạo `CV-` *"Ráp lại … (tiếp SC-…)"* |
| 4b | Thợ / công nhân | Máy chạy được → quét QR → **Máy đã chạy lại** |

**Quy tắc chi phối:** đóng phiếu `DM-` đúng lúc **máy quay lại sản xuất**, không phải lúc
thợ làm xong việc. Ráp xong mà máy chạy được thì đóng ngay, hôm sau chỉnh sửa ghi `CV-`.
Hôm sau phải dừng máy lần nữa thì mở phiếu `DM-` **mới**, không kéo dài phiếu cũ.

`CV-` ghi **công thợ**, `DM-` ghi **máy nằm im** — song song, không thay nhau. Máy đang đứng
mà chỉ có `CV-` thì thời gian dừng biến mất khỏi báo cáo.

**Bước 3b là chỗ chắc chắn sẽ quên** (đã quên ở ca 18/08, mất 39 giờ downtime; ca 11/08
cùng kiểu thì làm đúng). Đang chờ làm: gộp 3b vào 3a bằng ô tick *"Máy chưa chạy lại được"*
ngay trên màn hình Hoàn thành của thợ, xem mục 15.

Khoảng đã lỡ thì vá bằng menu **➕ Bù phiếu dừng máy** (`buPhieuDungMay`): nhập mã máy + hai
mốc giờ + lý do, hàm tự sinh mã `DM-`, tự tính ca, ghi `Nhat_Ky_Su_Co` là **bù thủ công** kèm
người bù. Có **chặn bù chồng**: nếu khoảng bù giao với phiếu sẵn có của cùng máy thì hỏi lại,
vì bù chồng là downtime đếm hai lần.

**Bỏ trống giờ chạy lại = máy vẫn đang dừng tới bây giờ** → phiếu để `DANG_XU_LY`, đồng hồ
đếm tiếp, đóng sau bằng "Máy đã chạy lại" như phiếu dừng máy thường. Thiếu vế này thì ca
đang dở dang không ghi được: bù kín tới hiện tại rồi thôi là mất phần từ lúc bù trở đi.

---

## 5. Ca làm việc và lịch trực

### Hai loại "ca" khác nhau — đừng nhầm

- **Ca của phiếu** tính theo `Danh_Muc_May.Bo_Phan` → ghi vào `Ngay_Ca` và `Ca`.
- **Ai đang trực** tính theo `Danh_Muc_Tho.Nhom_Ca`.

Máy Dệt hỏng lúc 17:45 → phiếu thuộc **ca ngày** (Dệt tới 18:00), nhưng thợ tổ điện lúc đó
đã sang **ca đêm** (đổi ca 17:30).

`Chuyen_Mon` khớp nhóm lỗi · `Nhom_Ca` quyết định giờ trực · `Bo_Phan_Phu_Trach` quyết định
thấy phiếu của bộ phận nào (nhiều bộ phận thì cách nhau dấu phẩy: `MTX,CMTD`).

### Bảng ca (seed trong `Ca_Lam_Viec`, sửa trên sheet)

| Nhóm | Ca ngày | Ca đêm |
|---|---|---|
| DET | 07:00–18:00 | có |
| SOI, CMTX | 07:00–17:00 | có |
| TRANG, MTX, CO, ICM, CHUNG | 07:00–17:00 | không |
| TO_DIEN (Hảo, Phát) | 06:30–17:30 | có |
| TO_CO_KHI (Nhị, Thiện) | 07:00–17:00 | **không** |

**Ca đêm = phần bù của ca ngày.** Chỉ khai giờ ca ngày + tick `Co_Ca_Dem`.

Ca đêm vắt qua nửa đêm: sự cố 02:00 sáng 15/8 thuộc ca đêm **ngày 14/8**.

### Máy chạy khác nhịp với bộ phận → tạo BỘ PHẬN RIÊNG

Ví dụ có thật: `CMTD02`, `CMTD03` chỉ chạy ca ngày trong khi CMTX có ca đêm. Cách giải:
tạo bộ phận `CMTD` trong `Ca_Lam_Viec` (07:00–17:00, không tick ca đêm), gán máy vào đó,
thêm `CMTD` vào `Bo_Phan_Phu_Trach` của thợ phụ trách.

**Không thêm cột giờ ca cho từng máy.** Đã cân nhắc và bác — làm nặng cấu trúc dữ liệu
vĩnh viễn cho một trường hợp lẻ, trong khi khái niệm "bộ phận có giờ ca riêng" đã có sẵn.

### Lịch trực

`taoLichLuanPhien(thang, ngayMoc)` xếp cả tháng theo luân phiên tuần. Cặp đổi ca khai ở
`LUAN_PHIEN_TUAN`; người không luân phiên ở `TRUC_CA_NGAY_CO_DINH`.

Ô ngày: `N` ca ngày · `D` ca đêm · `ND` cả hai ca · `X`/trống nghỉ.
**Ca đêm tick vào ô của ngày BẮT ĐẦU.**

**Chủ nhật để trống** (`CONFIG.BO_TRONG_CHU_NHAT`) — thợ tự thoả thuận rồi đăng ký tay.

---

## 6. Danh bạ gọi thợ — thang 3 nấc

`getOnDutyContacts_()` dừng ở nấc đầu tiên có người:

1. **Nấc 1** — thợ đang trực + đúng bộ phận + đúng chuyên môn.
2. **Nấc 2** — nấc 1 rỗng: thợ đang trực + đúng bộ phận, **bỏ lọc chuyên môn**. Tình huống
   "hư cơ khí lúc 22h, tổ cơ khí không làm đêm" → gọi thợ điện kiểm tra trước, hư nặng thì
   dừng máy chờ ca sáng.
3. **Nấc 3** — vẫn rỗng: không hiện số nào, báo phiếu sẽ xử lý đầu ca sáng.

**Ngoại lệ:** cả tháng chưa có dòng lịch nào → hiện tất cả thợ phù hợp kèm banner. Đây là
lỗi thiếu cấu hình, **không phải** nới lỏng bộ lọc.

**Số khẩn cấp** (`Cau_Hinh.SDT_KHAN_CAP`) luôn nằm **cuối** danh bạ, nút cam, nhãn riêng.

**Quét lại QR khi máy đang có phiếu sự cố chưa đóng** → mở thẳng màn hình danh bạ để gọi
người tiếp theo, kèm nút "➕ Báo cáo thêm sự cố khác". Người quét lại gần như luôn là người
vừa gọi mà không ai bắt máy.

Trang thợ dùng **lại đúng điều kiện nấc 1** để quyết định có gập phiếu ngoài chuyên môn
hay không — hai bên không bao giờ nói ngược nhau.

---

## 7. KPI đáp ứng — công thức và lý do

```
ranhLuc = giờ hoàn thành muộn nhất trong các phiếu KHÁC của chính thợ đó
          còn chồng lên khoảng máy này phải chờ
          (đang giữ việc dở → coi như bận tới tận lúc bấm nhận)

Phut_Cho_Tho_Ban  = min(giờ nhận, ranhLuc) − giờ báo      → chỉ số nhà máy
Phut_Dap_Ung_Thuc = giờ nhận − max(giờ báo, ranhLuc)      → chỉ số THỢ
```

Hai cột cộng lại **luôn bằng** `Phut_Tiep_Nhan`.

Ví dụ đã có test canh: 2 máy cùng hỏng 9h00, thợ xong máy 1 lúc 9h30, nhận máy 2 lúc 9h32
→ nhà máy chịu 32 phút, **KPI thợ chỉ 2 phút**.

### Bản cộng dồn đoạn bận (09/2026) — cột đem đi chấm KPI

Công thức trên miễn trừ bằng **một** mốc rảnh, nên rộng tay ở hai chỗ. Đợt này thêm
cột tính lại bằng cách cộng dồn **từng đoạn** bận, giao với khoảng máy nằm chờ:

```
Phut_Ban_Thuc_Te = tổng độ dài HỢP các đoạn [giờ nhận, giờ hoàn thành] của các
                   phiếu KHÁC của chính thợ đó, cắt vào khoảng [giờ báo, giờ nhận]
                   (phiếu còn DANG_XU_LY → bận tới hết khoảng)
Phut_KPI_Tho     = Phut_Tiep_Nhan − Phut_Ban_Thuc_Te
```

Vẫn **luôn** có `Phut_Tiep_Nhan = Phut_Ban_Thuc_Te + Phut_KPI_Tho` (2000 ca ngẫu
nhiên đã chạy qua). Hai chỗ cách cũ rộng tay, cả hai đều nghiêng về phía có lợi cho
người bị đo — kiểu sai không ai đi khiếu nại:

| Ca | Cách cũ | Cách cộng dồn |
|---|---|---|
| Bận **nhiều đoạn rời** — báo 9h00, nhận 10h00, thợ làm 8h50–9h10 và 9h30–9h50 | KPI 10 phút (nuốt luôn 20 phút rảnh xen giữa) | **KPI 30 phút** |
| Thợ nhận việc cũ **SAU** lúc máy này báo — báo 9h00, thợ nhận việc cũ 9h02 | KPI 2 phút | **KPI 4 phút** (9h00–9h02 thợ còn rảnh) |

Ca một đoạn bận **trùm qua** lúc báo hỏng thì hai cách cho **cùng** kết quả — đó là
đa số phiếu, nên số cũ và số mới thường bằng nhau. Cả hai cột giữ song song để đối
chiếu được với các báo cáo tháng đã gửi đi; **không** sửa đè cột cũ.

`kpiThoChoPhieu_` được gọi từ cả `acceptTask` lẫn `tinhLaiKpiTho()`, và việc cắt
đoạn bận vào cửa sổ khiến hai đường **luôn** ra cùng số — kể cả khi phiếu gây bận
lúc đó còn mở, sau này mới đóng. Nhờ vậy tính lại cho dữ liệu cũ không ghi đè sai
lên số đã ghi tại chỗ.

Ngưỡng đạt khai ở `Cau_Hinh.NGUONG_KPI_DAP_UNG_PHUT`, để trống thì không chấm
đạt/không đạt. Báo cáo xuất có khối **"CƠ SỞ ĐỂ CHỌN NGƯỠNG"** tính sẵn tỷ lệ đạt ở
5 mức 5/10/15/20/30 phút kèm trung vị, P75, P90, P95 — để chọn ngưỡng bằng số liệu
thay vì bốc một con số.

**Thợ tự xem được:** bấm vào phiếu trong "Đã xong gần đây" hiện chi tiết, có dòng
*"Chờ do bạn đang bận — 30 phút, không tính vào chỉ số đáp ứng của bạn"*. Số liệu công bằng
mà người bị đánh giá không thấy thì không tạo được niềm tin.

**Sửa phiếu đã đóng:** thợ tự sửa nội dung / phụ tùng / ghi chú trong `CONFIG.GIO_CHO_SUA_PHIEU`
(24h) qua nút ✏️ ở màn hình chi tiết. Không đụng mốc thời gian hay cột phút.

---

## 8. Báo cáo — ba thứ khác nhau, đừng lẫn

| | Dùng khi | Nơi xem |
|---|---|---|
| **📋 Báo cáo trong ngày** | Hằng ngày, đầu/cuối ca | Trang web `?page=ngay`, có khoá |
| **📊 `Tong_Hop`** | Phân tích cả tháng | Sheet, trigger tự chạy 2 lần/ngày |
| **📤 Xuất báo cáo** | Cuối tháng gửi sếp, hoặc sếp hỏi một khoảng ngày / một bộ phận / một thợ | Tạo Google Sheet mới trên Drive |

### Báo cáo trong ngày (`BaoCaoNgay.gs` + `TrangNgay.html`)

Gom theo `Ngay_Ca`. Sáu ô số lớn + sáu bảng: **Còn đang treo** (đặt đầu, sắp theo treo lâu
nhất) · Sự cố máy · Dừng máy · Việc chung · Bảo trì · Theo thợ.

**Bảng sự cố gom theo BỘ PHẬN** (`sapTheoBoPhanRoiGio_`), mỗi khối có dòng ngăn cách ghi
tên bộ phận + số sự cố + tổng phút dừng, kèm hàng chip lọc bộ phận phía trên bảng (chỉ hiện
khi ngày đó có từ 2 bộ phận trở lên).

Thứ tự các bộ phận **theo lúc xuất hiện**: bộ phận có sự cố sớm nhất đứng đầu, các bộ phận
khác nối đuôi. Cố ý **không** sắp theo bảng chữ cái và **không** ưu tiên bộ phận nào — người
dùng muốn giữ được mạch thời gian của ca mà không để các bộ phận cài răng lược vào nhau.

Mọi bảng sắp theo `tsBao` (timestamp thật), **không** theo chuỗi `'HH:mm'`. So chuỗi thì
phiếu ca đêm lúc 01:00 sáng nhảy lên đầu ngày dù nó xảy ra sau phiếu 22:00 cùng ca — và khi
đó thứ tự "bộ phận xuất hiện đầu tiên" cũng sai theo.

Bản in: dòng bộ phận đổi nền xanh thành đường kẻ đậm + chữ in hoa (máy in đen trắng nuốt
mất nền màu), chip lọc tự ẩn.

**Sửa nội dung tại chỗ:** các ô `Hư hỏng` / `Đã sửa` / `Phụ tùng` bấm vào gõ được, rời ô là
lưu (`capNhatNoiDungPhieu`). Bảng việc chung sửa thêm được `Máy` và `Khu vực`.

**Phiếu sự cố KHÔNG cho sửa `Ten_May`/`Bo_Phan`** — chặn ở server, không chỉ ẩn ô. Hai cột
đó chép từ danh mục máy; cho sửa tay là mở lại đúng loại sai lệch mà hệ thống sinh ra để
loại bỏ (trên giấy, cột "Bộ phận" bị ghi thành "đáy", "quai").

Bản in: khổ ngang A4, ẩn icon và nền màu nhãn, bảng trải hết ra giấy.

### Xuất theo biểu mẫu Excel

`xuatBaoCao({ tuNgay, denNgay, dsBoPhan, dsTho, kemViecChung })` tạo Google Sheet mới,
8 sheet: **`Tom_Tat`** (trang cho sếp, đứng đầu, mở sẵn) · `Bao_Cao` (trang tra cứu của tổ
bảo trì) · `Data_Goc` (29 cột form + `Loại` + 2 cột KPI) · `Theo_Ngay` · `DANH_MUC` ·
`Dashboard` · `HD_DAP_UNG` · `Nhật ký bảo trì` (chỉ sự cố bộ phận Dệt, **bỏ hẳn sheet** nếu
kỳ không có phiếu Dệt nào). Giao diện là hộp thoại `HopXuat.html` mở từ menu.

#### `Tom_Tat` — TRANG DUY NHẤT SẾP ĐỌC

Người duyệt báo cáo không đọc nhật ký từng ngày. Họ cần biết tháng này **tệ hơn hay tốt hơn
tháng trước**, và có gì phải quyết. Một trang, gói vừa khổ in dọc:

1. **4 ô số lớn, mỗi ô kèm mức thay đổi** — số lần máy hỏng · giờ máy nằm im · đáp ứng trung
   bình · tỷ lệ đạt KPI. Xanh khi đỡ hơn kỳ trước, đỏ khi tệ đi, xám khi kỳ trước chưa có số.
2. **Điều cần biết** — chỉ những dòng thật sự có nội dung: máy nằm im lâu nhất, phiếu chưa ai
   nhận, máy chưa chạy lại, số lần máy phải chờ vì thợ bận, nhắc chốt ngưỡng nếu chưa chốt.
3. **5 máy nằm im lâu nhất.**
4. **Kết quả theo thợ** — 4 cột thôi; ai dưới 70% được tô đỏ, và **chỉ tô khi đã chốt ngưỡng**
   (chưa chốt mà tô đỏ là kết tội bằng một con số chưa ai duyệt).

**Kỳ so sánh** dài đúng bằng kỳ báo cáo và dùng đúng bộ lọc bộ phận/thợ của kỳ đó — so một
tháng với nửa tháng, hay toàn nhà máy với một bộ phận, thì con số "tăng/giảm" thành ra bịa.
Nguồn `Su_Co` chỉ đọc **một lần** rồi lọc hai lần.

Nguyên tắc của trang này: **con số nào cũng phải đi kèm mốc so sánh.** Một mình "62 giờ máy
nằm im" không nói lên gì; "62 giờ, giảm 8 giờ so với kỳ trước" mới là thứ đọc xong biết phải
làm gì.

#### `Bao_Cao` — trang tra cứu của tổ bảo trì, dạng NHẬT KÝ

Ban đầu làm cho sếp nhưng đã phình ra, nên tách `Tom_Tat` ở trên. Trang này gồm:

1. **4 ô số lớn** — số lần hỏng · tổng thời gian máy dừng · tổng thời gian sửa · đáp ứng
   trung bình. Dưới đó một dòng: số lần dừng máy không do hư + **máy dừng lâu nhất kỳ này**.
2. **Nhật ký từng ngày** — mỗi ngày một khối: tiêu đề ngày (`THỨ HAI, 10/08/2026`) → các
   phiếu trong ngày (12 cột: mã · máy · hư gì · **báo hư · bắt đầu sửa · hoàn thành** ·
   phút dừng · thợ · **đáp ứng · chờ do thợ bận · sau khi rảnh** · ghi chú) → dòng
   **TỔNG NGÀY**.
3. **Tổng kết theo thợ** cả kỳ.

**Ba cột đáp ứng đứng cạnh nhau và `đáp ứng = chờ do bận + sau khi rảnh`** — người đọc cộng
nhẩm được, không phải tin vào con số hệ thống tự trừ.

**Cột Ghi chú chỉ đích danh phiếu gây ra chờ**: `chờ 15 phút do thợ đang làm SC-1008-002`.
`timPhieuGayBan_` dùng **đúng điều kiện** của `tinhDapUng_` ([LuongTho.gs:90](LuongTho.gs))
để số phút và lời giải thích không nói ngược nhau. Không tìm thấy phiếu gây bận thì ghi
*"việc ngoài phạm vi báo cáo này"* — việc đó có thật nhưng thuộc bộ phận/kỳ đã bị lọc ra.

**`So_Chong_Viec` và "phải chờ vì thợ bận" là HAI chuyện khác nhau**, bảng theo thợ để cả
hai cạnh nhau:

| Cột | Nghĩa |
|---|---|
| `Số phiếu phải chờ vì thợ bận` | máy chờ vì thợ đang làm việc khác — **kể cả khi việc cũ đã đóng xong** trước lúc nhận |
| `Số lần nhận việc khi chưa đóng việc cũ` | `So_Chong_Viec` — bấm nhận trong khi phiếu cũ còn `DANG_XU_LY` |

Người dùng đã thắc mắc đúng chỗ này: chồng việc = 0 mà đáp ứng vẫn bị trừ 15 phút. Đúng, vì
thợ đóng phiếu cũ lúc 9h15 rồi mới nhận phiếu mới lúc 9h24 — làm **nối tiếp**, không phải
**cùng lúc**.

Mốc giờ của phiếu vắt qua nhiều ngày hiển thị kèm ngày (`10/08 14:00`) khi khác ngày của
khối, để không bị đọc thành "hôm nay mới báo hư".

**Ngày không có phiếu nào mở VÀ không có máy nào còn nằm im thì bỏ hẳn khối đó** — kỳ 30
ngày mà chỉ 8 ngày có việc thì chỉ hiện 8 khối.

**Phiếu kéo dài nhiều ngày xuất hiện ở TẤT CẢ các ngày nó còn làm máy nằm im**, cột giờ ghi
rõ `→ còn tiếp` / `(tiếp từ 10/08)` / `cả ngày (tiếp từ 10/08)`. Thiếu vế này thì sẽ có ngày
hiện 1440 phút mà không dòng nào giải thích. Phiếu "tiếp từ hôm trước" **để trống cột đáp
ứng** — đáp ứng đã tính ở ngày mở phiếu, ghi lại là đếm hai lần.

Dòng TỔNG NGÀY tô ba mức theo thời gian dừng: ≥70% ngày tệ nhất đỏ nhạt · ≥40% vàng nhạt ·
còn lại xanh nhạt. Nhìn phát ra ngay ngày nào có vấn đề, không phải dò cột số.

**Ba con số dễ lẫn, đừng gộp lại:**

| Trường | Đếm gì |
|---|---|
| `soSuCo` | phiếu `SC-` mở trong ngày |
| `soDung` | phiếu `DM-` mở trong ngày — **chỉ** loại dừng không do hư |
| `soPhaiDung` | **mọi** phiếu mở trong ngày làm máy nằm im, cả `SC-` lẫn `DM-` |

Dòng TỔNG NGÀY dùng `soPhaiDung`, và chỉ nhắc tới `soDung` khi nó **khác 0**. Trước đây
dòng này ghi `soDung` với nhãn "lần dừng máy" nên có ngày hiện *"0 lần dừng máy · 4,2 giờ
máy nằm im"* — đúng kỹ thuật, mâu thuẫn khi đọc. Người dùng bắt được lỗi này.

Sự cố mà máy **vẫn chạy** thì không vào `soPhaiDung`, nhưng **vẫn hiện trong nhật ký** với
dòng "không dừng máy" — máy vẫn hỏng và thợ vẫn mất công.

Định dạng các khối ngày gom qua **`getRangeList`** — mỗi kiểu định dạng một lệnh cho toàn
bộ các ngày, thay vì vài lệnh nhân với số ngày. Kỳ dài mà gọi từng dòng sẽ chạm giới hạn
thời gian chạy của Apps Script.

**`ghiTrangBaoCao_` phải chạy SAU CÙNG**: nó `insertSheet('Bao_Cao', 0)`, mà `ghiDataGoc_`
lại lấy `ssMoi.getSheets()[0]` — đảo thứ tự là Data_Goc ghi đè mất trang tổng hợp.

Số liệu của trang này và của `Theo_Ngay`/`Dashboard` đến từ **cùng hai hàm thuần**
`gomTheoNgay_` và `gomTheoMayTho_`, nên không thể ra số lệch nhau. Sửa cách tính thì sửa ở
đó, đừng tính lại trong hàm ghi.

Apps Script **không đặt được page setup** (khổ giấy, hướng in, vừa trang) — muốn in đẹp thì
người dùng tự chọn trong hộp thoại In của Google Sheets.

`xuatBaoCaoThang(thang)` vẫn còn, thành vỏ bọc gọi hàm trên với trọn một tháng và
`kemViecChung: true` — báo cáo tháng cũ ra đúng như trước.

- **Lọc theo `Ngay_Ca`**, không theo giờ báo — cùng cách gom với báo cáo trong ngày và
  `Tong_Hop`, nên ba báo cáo không bao giờ xếp một phiếu vào hai kỳ khác nhau.
- **`kemViecChung` mặc định TẮT**: báo cáo chỉ gồm phiếu gắn với máy (`SC-` + `DM-`).
  Việc chung và bảo trì xuất riêng. Khi tắt, hai ô tổng CV/BT ghi "— không xuất kỳ này"
  chứ không ghi số 0, vì 0 sẽ bị đọc thành "cả kỳ không ai làm việc chung".
- **Lọc thợ làm mất hết phiếu `DM-`** — phiếu dừng máy không gắn thợ nào. Hộp thoại cảnh
  báo ngay lúc tick, và có test canh hành vi này để không ai "sửa" nhầm. Muốn xem cả máy
  dừng lẫn công thợ thì xuất một file không lọc thợ: bảng `Theo_Ngay` trả lời vế máy,
  bảng theo thợ trả lời vế người.
- Bảng theo máy / theo thợ **chỉ liệt kê máy và thợ liên quan** tới bộ lọc, không đổ cả
  162 máy ra rồi để trống.
- Ô "TỔNG SỐ LẦN HỎNG" và bảng theo máy **chỉ đếm `SU_CO`**.
- Không xuất `CALC_DAP_UNG` — sheet trung gian của Excel, ta đã tính sẵn ở server.
- Mọi ô là **giá trị**, không phải công thức, tránh lỗi locale.

#### `Theo_Ngay` — cắt downtime theo ngày thật

Mỗi ngày một dòng. Cột phút là **số phút máy nằm im TRONG NGÀY ĐÓ**: phiếu dừng từ 10/08
tới 13/08 được chia cho cả 4 ngày, không dồn 4300 phút vào ngày mở phiếu. Nhờ vậy không
ngày nào vượt quá 1440 phút và con số đọc lên có nghĩa.

Đánh đổi đã cân nhắc và chấp nhận: cộng dọc cột này **có thể lệch** với tổng downtime theo
phiếu ở `Dashboard`, vì phần dừng vắt ra ngoài kỳ đã chọn bị cắt. Cột "Số phiếu mở trong
ngày" giữ lại cách đếm theo phiếu để đối chiếu, và có dòng chú thích ngay dưới bảng.

Phiếu **chưa đóng tính tới lúc xuất báo cáo** và đếm ở cột "Phiếu còn đang dừng" — bỏ qua
sẽ báo thiếu đúng những ca dừng lâu nhất, ví dụ máy tháo motor đi quấn lại dây đồng.

---

### Tỉ lệ hiệu dụng A (`HieuDung.gs`)

```
A = thời gian máy chạy thực tế / thời gian máy phải chạy theo kế hoạch
```

Kế hoạch khai theo **bộ phận** ở sheet `Ke_Hoach_Chay_May`; mọi máy trong cùng bộ phận
dùng chung khung giờ. Kết quả tính và hiển thị theo **từng máy**.

| Cột | Nghĩa |
|---|---|
| `Gio_Bat_Dau` / `Gio_Ket_Thuc` | Khung ca ngày. Kết thúc ≤ bắt đầu thì hiểu là vắt qua nửa đêm |
| `Chay_Ca_Dem` | Tick = chạy liền **24 giờ** tính từ `Gio_Bat_Dau`, đúng quy ước "ca đêm = phần bù của ca ngày" |
| `T2`…`CN` | Ngày nào trong tuần có kế hoạch. Chủ nhật mặc định nghỉ |
| `Ngay_Nghi` | Ngày lễ, cách nhau dấu phẩy, nhận cả `dd/MM/yyyy` lẫn `yyyy-MM-dd` |

Nghỉ trưa và giao ca khai ở sheet `Khung_Ngung_Ke_Hoach`, mỗi khoảng một dòng:

| Cột | Nghĩa |
|---|---|
| `Bo_Phan` | Bộ phận áp dụng, khớp với `Danh_Muc_May.Bo_Phan` |
| `Loai_Khoang` | `NGHI_TRUA` hoặc `GIAO_CA` |
| `Gio_Bat_Dau` / `Gio_Ket_Thuc` | Khoảng máy dừng theo kế hoạch; được phép vắt qua nửa đêm |
| `T2`…`CN` | Không tick ô nào = kế thừa mọi ngày chạy của bộ phận; có tick = chỉ áp ngày đã tick |

Một bộ phận có thể khai nhiều dòng `GIAO_CA`, thường là giao ca ngày→đêm và
đêm→ngày. Các khoảng này bị loại khỏi mẫu số trước khi giao với downtime: máy hỏng
trọn trong giờ nghỉ/giao ca không bị giảm A; hỏng vắt qua chỉ trừ phần nằm trong giờ phải chạy.

**Tách khỏi `Ca_Lam_Viec` là cố ý.** Hai bảng trả lời hai câu hỏi khác nhau: `Ca_Lam_Viec`
nói **thợ** trực giờ nào, bảng này nói **máy** phải chạy giờ nào. Hôm nay hai con số trùng
nhau, nhưng gộp lại thì đổi kế hoạch sản xuất sẽ kéo lệch cả lịch trực.

Ba công tắc trong `Cau_Hinh` quyết định loại phiếu nào bị trừ: `A_TINH_SU_CO` (mặc định
TRUE) · `A_TINH_DUNG_MAY` (TRUE) · `A_TINH_VIEC_CHUNG` (FALSE).

#### Hai phép bắt buộc, thiếu là ra số vô nghĩa

1. **Cắt khoảng dừng theo khung kế hoạch.** `tongPhutDung_` đo bằng giờ thực trôi qua —
   phiếu tời nâng 18/08 ra 39 giờ liền, gồm cả đêm và chủ nhật. Trừ thẳng vào kế hoạch một
   ngày là **A ra âm**. Nên mỗi khoảng dừng được **giao** với khung kế hoạch của đúng những
   ngày nó vắt qua rồi mới cộng. Có test canh: 39 giờ đồng hồ chỉ ăn **712 phút** kế hoạch.
2. **Hợp nhất khoảng trước khi cộng.** Một máy có thể cùng lúc mang `SC-` (đang sửa) và
   `DM-` (chờ phụ tùng) chồng nhau — đúng quy trình gia công ngoài ở mục 4. Cộng riêng từng
   phiếu là **đếm downtime hai lần**, đúng cái bẫy mà `buPhieuDungMay` đã phải chặn.

**Kế hoạch cắt tại thời điểm chạy báo cáo.** Giữa tháng mà lấy kế hoạch cả tháng thì máy nào
cũng thấp giả tạo, càng đầu tháng càng sai.

**Bộ phận chưa khai kế hoạch → `tiLe = null`, KHÔNG phải 0.** Chưa đo được và máy đứng cả
tháng là hai chuyện khác hẳn nhau; báo cáo hiện `—` và nêu tên bộ phận để đi khai.

#### Việc chung chỉ quy được về máy khi có TÊN MÁY

`createGeneralTask` cố ý **để trống `Ma_May` và `Ten_May`** — việc chung không gắn với máy
nào. Thợ điền tên máy tay được qua bảng Việc chung trên trang báo cáo ngày, và chỉ khi đó
`mayCuaPhieu_` mới dò ngược được theo tên đã chuẩn hoá. Bật `A_TINH_VIEC_CHUNG` mà phiếu
không ghi máy thì phiếu đó vẫn bị bỏ qua — **không phải lỗi**, là giới hạn của dữ liệu.
Muốn đếm đủ thì phải thêm ô chọn máy vào màn hình tạo việc chung của thợ (chưa làm).

#### Xem A ở ba nơi

| Nơi | Phạm vi | Cần deploy? |
|---|---|---|
| `Tong_Hop` | Cả tháng, chỉ liệt kê máy **có dừng** | Không |
| Sheet `Hieu_Dung` trong file xuất | Cả kỳ: tổng → theo bộ phận → **đủ mọi máy** | Không |
| Trang `?page=ngay` | **Tạm tắt từ 28/08/2026**; chờ bổ sung kế hoạch máy theo ngày/ca | **Có** khi bật lại |

Công tắc `HIEN_HIEU_DUNG_BAO_CAO_NGAY` trong `BaoCaoNgay.gs` đang để `false`.
Khi tắt, backend không chạy phép tính A và giao diện ẩn hẳn khối này; các báo cáo
tháng và file xuất không bị ảnh hưởng.

Ngoài ba khối cũ trên còn có chức năng **📈 Báo cáo tỉ lệ khả dụng máy** hoàn toàn
độc lập. Chức năng tạo file Google Sheet mới theo ngày hoặc tháng, luôn liệt kê đủ
mọi máy `Hoat_Dong = TRUE`, chia chi tiết dưới đề mục bộ phận. Máy có A < 100% được
in đậm tên bằng màu đen. Báo cáo này cố định tính `SC-` làm máy dừng + `DM-`, không
phụ thuộc bộ lọc thợ hay ba công tắc của báo cáo bảo trì cũ.

Sheet `Hieu_Dung` **không dùng tập phiếu đã lọc của file xuất**: bộ lọc thợ làm rụng sạch
phiếu `DM-` (không gắn thợ nào), lọc rồi mới tính là máy đứng cả tuần vì thiếu nguyên liệu
vẫn hiện A = 100%. Nó tính trên toàn bộ phiếu của kỳ, chỉ áp bộ lọc **bộ phận** vào danh
sách máy được liệt kê.

Cả ba nơi đều bọc `try/catch`: thiếu sheet kế hoạch hay khai sai giờ thì mất đúng khối A,
phần còn lại của báo cáo vẫn phải dựng được.

---

## 9. Trang web có khoá

| Route | Trang |
|---|---|
| `?may=<mã>` | Công nhân báo sự cố |
| `?tho=<mã>&token=<token>` | Thợ |
| `?page=qr&loai=may\|tho&key=<khoá>` | In mã QR |
| `?page=ngay&d=yyyy-MM-dd&key=<khoá>` | Báo cáo trong ngày |

Khoá dùng chung: `Cau_Hinh.KHOA_IN_QR`, tự sinh lần đầu khi mở menu. Trang QR thợ **liệt kê
toàn bộ token** nên bắt buộc phải có khoá.

---

## 10. Nguyên tắc kỹ thuật — không được vi phạm

1. **Một thay đổi trạng thái = ĐÚNG MỘT `setValues` cho cả dòng.**
2. **Mọi hàm ghi nằm trong `LockService` + kiểm `Request_ID`** chống double-tap.
3. **Không dùng `PropertiesService` cho dữ liệu tăng dần** (giới hạn 500 key).
4. **Khoá chỉ bao đúng phần bắt buộc tuần tự.** Validate, tra danh mục, đọc cấu hình, dựng
   danh bạ đều làm **ngoài** khoá. `reportIncident` nhả khoá ngay sau khi ghi xong dòng.

### Đo tải thực tế (đo lúc `Su_Co` còn 8 phiếu)

| | |
|---|---|
| Đọc 500 dòng cuối `Su_Co` | 149 ms *(sẽ lên ~300–500 ms khi sheet đầy)* |
| Dựng danh bạ thợ trực | 1031 ms — tốn nhất, nhưng **ngoài khoá** |
| Giữ khoá mỗi lượt gửi phiếu | 538 ms |
| **Chịu được cùng lúc** | **~37 người gửi** *(còn ~22 khi sheet đầy)* |
| 100 lượt mở trang đồng thời | 100/100, trung vị 1,6 s |

Mở trang và bấm Làm mới **không giành khoá**. Chỉ thao tác GHI mới xếp hàng.

**Đã cân nhắc và quyết định KHÔNG cache danh mục:** nhà máy chỉ báo vài phiếu mỗi giờ nên
cache sẽ nguội trước lần dùng kế tiếp; và cache `Danh_Muc_Tho` sẽ khiến token của thợ vừa
nghỉ việc còn sống thêm vài phút.

---

## 11. Bảo mật

- **Công nhân: không xác thực.** Cố ý — quét QR là dùng.
- **Thợ: token 20 ký tự trong link cá nhân.** Không đọc được toàn bộ Sheet, không đụng
  phiếu người khác.
- **Chặn spam:** cùng một máy không quá `CHONG_SPAM_SO_PHIEU` phiếu trong
  `CHONG_SPAM_PHUT` phút. Đặt **sau** bước chống trùng `requestId`.
- **Khoá link thợ nghỉ việc:** xoá ô `Token` → bỏ tick `Hoat_Dong` → chạy menu 4.
- **Chức năng xoá dữ liệu CHỈ nằm trong menu Sheet**, không có route web nào dẫn tới. Ai
  sửa được Sheet thì mới xoá được — Google đã xác thực sẵn, không cần thêm mật khẩu.
- Mọi thao tác vào `Nhat_Ky_Su_Co`. Dữ liệu xoá chép sang `Thung_Rac` trước.

---

## 12. Vận hành — menu 🔧 Bảo trì

| Mục | Khi nào |
|---|---|
| 1. Cài đặt hệ thống | Sau mỗi lần thêm cột/cấu hình. Chạy lại an toàn |
| 2. Nhập danh mục máy từ SAPHIA | Một lần lúc khởi tạo |
| 3. Điền mã thợ + bật hoạt động | Sau khi nhập tay danh sách thợ |
| 4. Sinh lại link QR / link cá nhân | Sau khi đổi URL, thêm máy/thợ, khoá link |
| 5. 🖨️ In mã QR (máy và thợ) | Có lọc theo bộ phận trên trang in |
| 6. Cập nhật danh mục máy MTX | Đồng bộ cả bộ phận theo `DANH_MUC_MTX` |
| 7. Thêm máy mới vào danh mục | Sửa `MAY_THEM_MOI` rồi chạy. Chỉ thêm, không xoá |
| 📅 Tạo dòng lịch trực tháng này | Đầu mỗi tháng |
| 🔁 Xếp lịch luân phiên theo tuần | Đầu mỗi tháng, sau mục trên |
| 🕒 Khai báo giờ chạy / nghỉ / giao ca | Mở hai sheet cấu hình kế hoạch dùng làm mẫu số A |
| 📋 Báo cáo trong ngày | Hằng ngày |
| ➕ Bù phiếu dừng máy | Khi thợ quên quét "Dừng máy" lúc đem đồ ra ngoài gia công |
| 📊 Cập nhật báo cáo tổng hợp | Trigger tự chạy 12h và 23h |
| 📤 Xuất báo cáo (chọn ngày, bộ phận, thợ) | Cuối tháng, hoặc khi sếp hỏi một khoảng ngày |
| 📈 Báo cáo tỉ lệ khả dụng máy | Xuất báo cáo A độc lập theo ngày hoặc tháng, đủ máy hoạt động |
| 🗄️ Dọn phiếu cũ sang Lưu trữ | Trigger tự chạy ngày 1 hằng tháng |
| ⏰ Cài trigger tự chạy | **Một lần duy nhất**, phải chạy tay |
| 🧹 Dọn dữ liệu (Admin) | Xoá phiếu theo mã · Dọn sạch dữ liệu thử · Mở thùng rác |
| 🧪 Chạy test logic | Trước mỗi lần deploy |
| ⏱️ Đo tải hệ thống | Định kỳ vài tháng |

Sửa thẳng trên Sheet, có hiệu lực ngay: SĐT thợ · giờ ca từng tổ · lý do dừng máy · số khẩn
cấp · ngưỡng chặn spam · danh mục máy · lịch trực.

### Quy trình push và deploy

```bash
powershell -File ..\kiemtra\kiem-tra.ps1      # 3 lớp kiểm tĩnh
clasp push --force
clasp deploy --deploymentId MA_TRIEN_KHAI_DA_GO_KHOI_KHO_CONG_KHAI... --description "mô tả"
```

- Hàm chạy từ **menu Sheet và editor** dùng code mới nhất đã push — **không cần deploy**.
- Chỉ trang web `/exec` mới phục vụ theo **version đã deploy**.
- **Luôn `clasp deploy --deploymentId`** với đúng ID trên. Tạo "Bản triển khai mới" sẽ sinh
  URL khác và làm chết mọi QR đã in.
- **Kéo về trước khi sửa.** Đã có lần repository tụt lại ~1000 dòng so với Editor vì có người
  sửa thẳng trên Apps Script. Mở phiên làm việc thì `clasp clone` ra thư mục tạm và so trước,
  đừng push đè.
- **Tài khoản clasp: `kn.stepforward`** (đổi 09/09/2026). Tài khoản cá nhân cũ từng bị chặn
  deploy vì không cùng domain Workspace với chủ sở hữu script.
- **PowerShell chặn `clasp.ps1`** với lỗi *running scripts is disabled*. Gọi `clasp.cmd` thay
  vì `clasp`; không hạ ExecutionPolicy của máy chỉ để chạy một lệnh.

---

## 13. Bẫy đã trả giá — đừng lặp lại

| Bẫy | Hậu quả | Cách tránh |
|---|---|---|
| **Tab Apps Script editor mở từ trước** | Bấm lưu trong tab cũ **ghi đè cả project**, xoá sạch file vừa push. `clasp push` báo thành công nhưng file biến mất | Đóng/F5 tab editor trước khi push. Nghi ngờ thì `clasp pull` vào thư mục tạm để kiểm chứng |
| **Scriptlet rỗng `<?= ?>` trong comment HTML** | Engine template vẫn dịch → `SyntaxError`, Apps Script quy lỗi nhầm về dòng `t.evaluate()` ở file `.gs`. **Đã dính 2 lần** | `checkhtml.js` bắt được |
| **`Range.insertCheckboxes()`** | Đặt lại **mọi ô thành false** → chạy lại `setupSystem` tắt hết `Hoat_Dong` của 98 máy | Dùng data validation `requireCheckbox()` |
| **`const` trùng tên tham số trong khối `try`** | `Cannot access 'X' before initialization` lúc chạy. `node --check` **không bắt được** | `shadow.js` bắt được |
| **Seed cấu hình kiểu "chỉ khi sheet trống"** | Khoá cấu hình mới không bao giờ xuất hiện trên sheet đã có dữ liệu | Bổ sung theo từng khoá còn thiếu |
| **Đếm số dòng để sinh mã phiếu** | Xoá một phiếu là mã kế tiếp trùng mã đã cấp | Lấy số lớn nhất +1 |
| **Set number format SAU `setValues`** | Sheets đã kịp đổi `'07:00'` thành `0.2917`, `'08/2026'` thành ngày | Đặt format **trước** khi ghi |
| **Sheet mới chỉ có 26 cột** | `setValues` header 28 cột văng "out of bounds" | `taoSheet_` tự chèn thêm cột |
| **Hai file trùng tên khác đuôi** | `clasp push` từ chối toàn bộ | Đổi tên một trong hai |
| **`chart.googleapis.com/chart?cht=qr` đã CHẾT** | Trả 404. Dùng nó là in ra 98 nhãn trắng | Ảnh QR lấy từ `api.qrserver.com` |
| **Nhét JSON vào chuỗi JS qua `<?= ?>`** | Dấu nháy thành `&quot;`, mà trong `<script>` trình duyệt **không** giải mã thực thể HTML → `JSON.parse` chết | Đặt vào **thuộc tính HTML** rồi đọc bằng `dataset` |
| **Nút cố định `position:fixed` đè lên ô nhập** | Người dùng với tay xuống ô cuối là bấm trúng nút Hoàn thành, phiếu đóng khi chưa khai phụ tùng | `.boc` chừa đáy 150px + hộp xác nhận cho thao tác không hoàn tác được |
| **`min-width` trên nhiều ô cùng bảng** | Tổng min-width vượt bề ngang thẻ → bảng tràn khỏi viền trên web | Bọc bảng trong `.cuon { overflow-x:auto }` |
| **Lệnh bash `&&` trong hướng dẫn** | Nút Chạy trong chat thực thi bằng PowerShell, `&&` là lỗi cú pháp | Mỗi lệnh một khối riêng |
| **Ca test chép làm hai bản** (`kiemtra/kpi-tho.js` và `Test.gs` mục 8b) | Sửa kỳ vọng một bên, quên bên kia → bộ chạy tại máy vẫn xanh mà bộ trong Sheet đỏ. Dính 03/09/2026 | Sửa ca nào thì sửa **cả hai**, và chạy bộ trong Sheet trước khi coi là xong |
| **Thêm cột vào `HEADER_DATA_GOC`** | Có test canh đúng số cột (biểu mẫu gửi sếp lệch là hỏng) — thêm cột mà quên sửa test là đỏ | Cột mới luôn thêm SAU cột 29, rồi cập nhật test đếm cột |

---

## 14. Kiểm thử — 5 lớp

```bash
powershell -File kiemtra\kiem-tra.ps1
```

Chạy 4 lớp tại máy: cú pháp `.gs` → biến che tham số → HTML (scriptlet trong comment, cú
pháp JS, `getElementById` trỏ vào id không tồn tại) → **số học KPI đáp ứng thợ**.

Lớp 4 (`kiemtra/kpi-tho.js`) nạp thẳng `Code.gs` + `LuongTho.gs` + `XuatBaoCao.gs` vào node
rồi gọi `phutBanTrongCho_` / `kpiThoChoPhieu_` — làm được vì nhóm hàm KPI là hàm **thuần**,
chỉ nhận mảng và `Date`. Gồm 2000 ca ngẫu nhiên canh đẳng thức `đáp ứng = bận + KPI`.

> Phải chạy bằng `vm.runInThisContext`, **không** `createContext`: khác realm thì `Date` của
> khung test và `Date` của code là hai constructor khác nhau, mọi `instanceof Date` bên
> trong code trả về false và bộ test hoá ra chỉ kiểm thử chính cái khung — đã dính một lần.

Lớp thứ năm: menu **🧪 Chạy test logic** trong Sheet — ~230 test bằng dữ liệu giả,
**không đọc/ghi sheet nào**.

Điều này làm được nhờ `getOnDutyContacts_` nhận tham số `duLieu` **tiêm theo từng trường**:
`{ dsTho, cauHinhCa, lichTheoThang, cauHinh }`. Thiếu trường nào thì hàm tự đọc sheet — nên
**bộ test bắt buộc truyền đủ cả 4**, kể cả `cauHinh: {}`.

---

## 15. Trạng thái hiện tại và việc đang dở

### Đang chờ làm

- **Ô tick "Máy chưa chạy lại được" trên màn hình Hoàn thành của thợ** — tick vào thì hệ
  thống tự đóng phiếu `SC-` **và** tự mở luôn phiếu `DM-` chờ phụ tùng, thợ không phải đi
  quét QR lần nữa. Đây là cách bỏ hẳn bước dễ quên nhất trong quy trình gia công ngoài
  (mục 4). Kèm theo: trang thợ thêm mục **"Máy đang dừng chờ phụ tùng"** với nút *Máy đã
  chạy lại*, để ráp xong bấm ngay tại chỗ. Sửa `LuongTho.gs` + `Tho.html`, **cần deploy** —
  hoãn tới chủ nhật theo yêu cầu người dùng, không deploy giữa ca sản xuất.

- **Quy downtime ra tiền** — cần người dùng cung cấp doanh thu ước tính mỗi giờ máy chạy.

### Đã làm xong, chưa deploy (09/09/2026)

Hai khối dưới đây đã có trên Apps Script Editor và đã kéo về repository, nhưng **bản web
đang chạy thật vẫn là version cũ chưa có chúng**:

- **So sánh với kỳ trước** trong báo cáo xuất — `soSanhKy_()`, `ghiTomTat_()` dựng thêm một
  trang tóm tắt đứng đầu file xuất, kèm `tyLeDatKpi_()`, `tbDapUngSuCo_()`, `phanVi_()`,
  `gomKpiTho_()` trong `XuatBaoCao.gs`.
- **Tính lại KPI đáp ứng của thợ** — `tinhLaiKpiTho()`, `kpiThoChoPhieu_()`, `nguongKpi_()`,
  `phutBanTrongCho_()` trong `LuongTho.gs`, gọi qua menu `menuTinhLaiKpi` trong `Code.gs`.

**Tỉ lệ hiệu dụng A vẫn đang TẮT.** Công tắc `HIEN_HIEU_DUNG_BAO_CAO_NGAY = false` trong
`BaoCaoNgay.gs`; mã tính trong `HieuDung.gs` còn nguyên, chỉ là không được gọi. Cách tính
hiện tại còn sai nên đã tắt tạm theo yêu cầu người dùng — cải tiến rồi mới bật lại.

### Đã quyết định KHÔNG làm

- **Xuất riêng mẫu BM01/QTSCBT-05** — biểu mẫu giấy "Báo cáo sửa chữa hư hỏng đột xuất"
  gửi vào nhóm hằng ngày. **Trang "📋 Báo cáo trong ngày" đã thay thế được**, người dùng
  xác nhận như vậy là đủ. Có in ra được, đủ mọi cột của mẫu giấy và còn nhiều hơn.
  Nếu sau này vẫn cần đúng khuôn tờ giấy thì làm hai việc: tách một tờ cho mỗi thợ mỗi
  tháng (mẫu có ô "Tên kỹ thuật" ở đầu tờ), và mỗi phụ tùng một dòng thay vì gộp một ô.
- **Mẫu BM04** (phiếu kiểm tra bảo trì hằng ngày, ma trận hạng mục × 31 ngày) — giữ nguyên
  trên giấy. Bảo trì hằng ngày trong hệ thống vẫn là ô gõ tự do.
- Cột giờ ca riêng cho từng máy — dùng bộ phận riêng thay thế.
- Cache danh mục — xem mục 10.

### Lỗi chưa tìm ra nguyên nhân

**Ghim link ra màn hình chính trên Chrome Android thì trang đứng im, chạm vào màn hình mới
hiện giao diện.** Mở trong Zalo thì 3–4 giây, bình thường.

Đã thử và **không phải**: lỗi chiều cao `dvh` trong wrapper (đã sửa, vẫn bị).

Giả thuyết còn lại: Chrome chặn cookie/storage bên thứ ba, mà wrapper làm
`script.google.com` thành khung con của `github.io`. Nếu đúng thì **không sửa được bằng
code** — phải bỏ wrapper và chấp nhận banner của Google.

Hai phép thử cần làm để chốt (chưa có kết quả):
1. Ghim link `/exec` **trực tiếp** (không qua wrapper) → còn đứng không?
2. Mở link wrapper trong **tab Chrome bình thường**, không ghim → còn đứng không?

### Rủi ro lớn nhất, không phải kỹ thuật

Toàn bộ hệ thống và dữ liệu nằm trên **một tài khoản Gmail cá nhân**. Người đó nghỉ việc
hoặc mất tài khoản là công ty mất cả dữ liệu lẫn quyền quản trị. Cần chuyển sang tài khoản
công ty, sao lưu định kỳ ra ngoài Google, và kiểm tra sóng mạng tại từng vị trí máy.

---

## 16. Cách làm việc với người dùng này

- **Ưu tiên giải bằng cấu hình trên Sheet trước, sửa code là phương án cuối.** Đã bị nhắc
  một lần khi định thêm cột thay vì tạo bộ phận mới.
- **Không tự sửa file khi chưa được đồng ý rõ ràng.** Trình bày phương án, chờ duyệt.
- Người dùng **không phải lập trình viên** nhưng nắm rất rõ vận hành nhà máy và đã bắt được
  nhiều lỗi thật. Khi họ nói "phiếu mẫu đó bị sai" hay "cần gì phải nhập lại" thì thường là
  đúng — kiểm lại giả định của mình trước khi bảo vệ thiết kế.
- Tài liệu và giao diện đều bằng **tiếng Việt**.
