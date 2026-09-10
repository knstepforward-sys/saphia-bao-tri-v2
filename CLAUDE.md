# SAPHIA — App nhập nhanh báo cáo sửa chữa hư hỏng đột xuất (BM01/QTSCBT-05)

Hệ thống nội bộ cho công ty dệt may Việt Nam: kỹ thuật viên quét QR trên máy →
mở app mobile → nhập báo cáo sự cố/sửa chữa → lưu thẳng vào Google Sheets.

> ## 🔄 HAI LỆNH CỦA MỘT PHIÊN — chạy trước khi làm bất cứ gì, và trước khi rời máy
>
> ```
> powershell -ExecutionPolicy Bypass -File dongbo.ps1     # ngồi xuống
> powershell -ExecutionPolicy Bypass -File roi-may.ps1    # đứng dậy
> ```
>
> `dongbo.ps1` chặn nếu còn thay đổi chưa commit, `git pull`, rồi tải bản đang chạy
> trên Apps Script về thư mục tạm và so với `bao-tri-v2/`. Script chỉ đọc và báo cáo,
> không bao giờ push, deploy hay ghi đè file trong repo.
>
> `roi-may.ps1` lo nửa còn lại: chạy `kiemtra\kiem-tra.ps1`, hỏi xác nhận rồi commit,
> `git pull --rebase`, `git push`, rồi so `HEAD` với `origin` để chắc là hết lệch. Hỏng
> ở bước nào dừng ở bước đó, xung đột rebase thì để nguyên hiện trường cho người tự gỡ.
> Nó **không** `clasp push`, **không** deploy — chỉ làm việc git.
>
> Chạy cả hai trong PowerShell **thường**. Cửa sổ quyền Administrator dùng hồ sơ người
> dùng khác nên thường không có `git` lẫn `clasp.cmd` trong PATH.
>
> Mã thoát giống nhau ở cả hai script:
>
> | Mã thoát | `dongbo.ps1` | `roi-may.ps1` | Làm gì |
> |---|---|---|---|
> | 0 | Sạch, khớp cả GitHub lẫn Apps Script | Đã đẩy xong, GitHub có đủ | Bắt đầu việc / rời máy được |
> | 1 | Có lệch cần người quyết | Kiểm tra đỏ, chưa commit, hoặc xung đột rebase | Đọc kết luận script in ra, hỏi chủ dự án |
> | 2 | Thiếu môi trường (chưa login, thiếu `.clasp.json`) | Không phải repo, thiếu `kiem-tra.ps1` | Sửa theo hướng dẫn script in ra |
>
> **Mã nguồn tồn tại ở BỐN nơi**: máy công ty, laptop cá nhân, GitHub, và Apps Script
> Editor. Hai script trên lo ba nơi đầu; nơi thứ tư chỉ có một luật là đừng sửa thẳng
> trên Editor. Đã có lần repo tụt ~1000 dòng vì có người sửa thẳng trên Editor, và một
> lần 7 file kẹt lại trên laptop vì quên push trước khi rời máy.
>
> Cài đặt máy mới: xem `README.md`. Prompt mở chat: xem `PROMPT_KHUNG_CHAT_MOI.md`.

> ## 🚫 BỐN VIỆC KHÔNG ĐƯỢC TỰ Ý LÀM
>
> Hệ thống đang phục vụ **175 máy** dùng QR cố định. Hỏng là dừng sản xuất.
>
> 1. **`clasp push`** — chỉ chạy khi chủ dự án xác nhận rõ ràng **TỪNG LẦN**. Không suy ra
>    từ lần trước, không suy ra từ việc "đã duyệt phương án". Đang bị chặn trong
>    `.claude/settings.json`.
> 2. **`clasp deploy`** — như trên. Và khi được phép thì **luôn dùng đúng deployment ID
>    đang có**. Tạo "Bản triển khai mới" là đổi URL và làm chết toàn bộ QR đã in.
> 3. **Sửa file khi chưa được duyệt** — trình bày phương án trước, chờ đồng ý rồi mới sửa.
> 4. **Đổi các giá trị hạ tầng** — Spreadsheet ID, Apps Script ID, deployment ID, URL
>    `/exec`, cấu trúc cột sheet. Muốn đổi phải hỏi.
>
> Trước khi sửa mã, hỏi lại: **việc này giải bằng cấu hình trên Google Sheet được không?**
> Sửa code là phương án cuối. Đã bị nhắc một lần vì định thêm cột thay vì tạo bộ phận mới.
>
> Sau mỗi thay đổi, thêm mục mới lên **đầu** `NOTES.md`, ghi riêng ba trạng thái: đã push
> GitHub / đã `clasp push` / đã deploy. **Không** viết "đã chạy thật" nếu mới chỉ sửa mã
> hoặc mới push GitHub. Trước khi push chạy `powershell -File kiemtra\kiem-tra.ps1`.
>
> Gọi `clasp.cmd`, không gọi `clasp` — PowerShell chặn file `.ps1`. Tài liệu và giao diện
> đều bằng **tiếng Việt**.

> ## ⚠️ Thư mục này chứa HAI hệ thống riêng biệt
>
> | Thư mục | Hệ thống | Tài liệu |
> |---|---|---|
> | `apps-script/` | **SAPHIA** — app nhập nhanh báo cáo sửa chữa (mô tả ở file này) | file này |
> | `bao-tri-v2/` | **Bảo trì Toàn nhà máy v2** — công nhân báo sự cố → gọi thợ trực → thợ nhận việc → hoàn thành | [`bao-tri-v2/CLAUDE.md`](bao-tri-v2/CLAUDE.md) |
>
> Hai hệ **khác Spreadsheet, khác Apps Script project, không chia sẻ dữ liệu**. Chạy song
> song. Liên hệ duy nhất: `importMayTuSaphia()` bên v2 đọc một lần danh mục máy từ SAPHIA.
>
> **Trước khi sửa bất cứ thứ gì trong `bao-tri-v2/`, đọc `bao-tri-v2/CLAUDE.md`** — ở đó có
> kiến trúc, lý do đằng sau các quyết định, và danh sách bẫy đã trả giá (tab editor ghi đè
> file, scriptlet rỗng trong comment, `insertCheckboxes` xoá dữ liệu, biến che tham số…).

## Bối cảnh & ràng buộc quan trọng (KHÔNG tự đổi các giá trị này)

- **Spreadsheet ID**: `ID_DA_GO_KHOI_KHO_CONG_KHAI`
- **Apps Script ID** (từ `.clasp.json`): `ID_DA_GO_KHOI_KHO_CONG_KHAI`
- **Web app exec URL hiện tại**:
  `https://script.google.com/macros/s/MA_TRIEN_KHAI_DA_GO_KHOI_KHO_CONG_KHAI/exec`
  (đổi mỗi lần deploy version mới → phải cập nhật lại trong `baocao-saphia/index_fullscreen.html`)
- **GitHub Pages repo wrapper**: `github.com/khangdang0703-lab/baocao-saphia` (thư mục `baocao-saphia/`)
- Quy mô dữ liệu: **98 máy** thuộc các bộ phận SOI, DET, TRANG, CMTX, MTX, CO (có thể có thêm ICM, Chung
  theo dữ liệu thực tế tháng 7/2026); **15 kỹ thuật viên**.
- Nguyên tắc thiết kế:
  - Ưu tiên giải pháp **miễn phí** (Google Workspace free tier, GitHub Pages free).
  - **Tính KPI ở server-side (Apps Script)**, không dùng công thức Sheets, để tránh lỗi locale/#ERROR!.
  - Người dùng thích **review từng phần trước khi duyệt code** — không tự động sửa file khi chưa được
    đồng ý rõ ràng.
- Đã sửa các lỗi biết trước:
  - **Timezone**: ép cứng `+07:00` khi tạo `Date` trong Apps Script (`timeToDate_`), không phụ thuộc
    timeZone của project (dù `appsscript.json` đã set `Asia/Ho_Chi_Minh`).
  - **Viewport height mobile Chrome/Safari**: `index_fullscreen.html` dùng `100dvh` + JS fallback đo
    `window.innerHeight` để né lỗi thanh địa chỉ trình duyệt che mất phần dưới màn hình.
- Đang chuẩn bị (chưa làm): thêm logic **"thời gian đáp ứng"** và **"phát hiện chồng lịch kỹ thuật
  viên"** — tham khảo công thức mẫu từ file Excel `BC_HH_T7_2026.xlsx` (sẽ cung cấp riêng khi bắt đầu
  task đó).

## Kiến trúc tổng quan

```
QR code trên máy → mở URL exec (?) → Apps Script doGet() → render index.html (mobile form)
                                                                     │
                                                    google.script.run (client ↔ server RPC)
                                                                     │
                                                    Mã.js (Code.gs) đọc/ghi Google Sheets
```

Ngoài ra có một **wrapper GitHub Pages** (`baocao-saphia/index_fullscreen.html`) nhúng web app Apps
Script trong `<iframe>` toàn màn hình — dùng khi muốn có domain/URL riêng thân thiện hơn URL
`script.google.com` dài, hoặc để né một số hạn chế hiển thị của Apps Script khi mở trực tiếp.

## Cấu trúc thư mục

```
saphia-bao-tri-v2/                # Repository private knstepforward-sys/saphia-bao-tri-v2
├── apps-script/                  # Container-bound Apps Script project (đẩy qua clasp)
│   ├── Mã.js                     # = Code.gs, toàn bộ backend logic
│   ├── index.html                # Form nhập liệu mobile (HTML+CSS+JS inline)
│   ├── appsscript.json           # Manifest: timezone, webapp exec-as, access
│   └── test/                     # Kiểm thử chạy bằng node, ngoài Apps Script
├── bao-tri-v2/                   # Hệ Bảo trì Toàn nhà máy v2 — xem CLAUDE.md riêng
└── kiemtra/                      # Bộ kiểm tra tĩnh chạy trước khi push
```

`.clasp.json` **không** nằm trong repository — file đó chứa scriptId, bị `.gitignore`
loại trừ và chỉ tồn tại trên máy. Xem `.clasp.json.mau` để biết cấu trúc.

Wrapper GitHub Pages nằm ở repository triển khai riêng `baocao-saphia`, không thuộc
repository này, để không làm đổi các đường dẫn QR đã phát hành.

## `apps-script/Mã.js` — Backend (Code.gs)

### Hằng số tên sheet
| Hằng số | Tên sheet | Vai trò |
|---|---|---|
| `SHEET_BAOCAO` | `BaoCao` | Bảng chính lưu mỗi báo cáo sự cố (1 dòng/phiếu) |
| `SHEET_BAOCAO_VATTU` | `BaoCao_VatTu` | Chi tiết vật tư đã dùng cho từng phiếu (1-n dòng/phiếu, join theo `id`) |
| `SHEET_DM_MAY` | `DM_May` | Danh mục máy: `ma, ten, boPhan` |
| `SHEET_DM_VITRI` | `DM_ViTriMay` | Danh mục vị trí/công đoạn máy (chỉ 1 cột `ten`) |
| `SHEET_DM_VATTU` | `DM_VatTu` | Danh mục vật tư: `ma, ten, dvt, nhom, ton` |
| `SHEET_DM_NHANSU` | `DM_NhanSu` | Danh mục kỹ thuật viên (chỉ 1 cột `ten`) |
| `SHEET_DM_CONGVIEC` | `DM_LoaiCongViec` | Danh mục loại công việc/phân loại sự cố (chỉ 1 cột `ten`) |

### Hàm chính
- **`doGet(e)`** — entry point web app, render `index.html` qua `HtmlService.createTemplateFromFile`,
  cho phép nhúng iframe (`XFrameOptionsMode.ALLOWALL`) — đây là lý do wrapper GitHub Pages nhúng được.
- **`include(filename)`** — helper include file phụ (chưa dùng, dự phòng tách CSS/JS riêng).
- **`ss_()`** — shortcut `SpreadsheetApp.getActiveSpreadsheet()`. Script **bắt buộc phải container-bound**
  (tạo từ trong chính Google Sheet) để hàm này trỏ đúng file.
- **`sheetToObjects_(sheetName, cols)`** — đọc 1 sheet danh mục thành mảng object theo tên cột chỉ định,
  bỏ dòng trống (cột A rỗng).
- **`getDanhMuc()`** — RPC được client gọi lúc load trang: trả về TẤT CẢ danh mục
  (`machines, vitri, parts, staff, congviec`) trong **1 lần gọi duy nhất** để giảm round-trip
  (được gọi từ `google.script.run...getDanhMuc()` trong `index.html`).
- **`pad_(n)`** — pad số về 2 chữ số.
- **`genId_()`** — sinh mã phiếu dạng `BC` + `yyyyMMddHHmmss` (giờ `Asia/Ho_Chi_Minh`) + 3 số ngẫu nhiên
  chống trùng.
- **`minutesBetween_(dateStr, startHHMM, endHHMM)`** — tính số phút giữa 2 mốc giờ trong cùng payload,
  tự cộng thêm 24h nếu `end < start` (qua ngày hôm sau).
- **`timeToDate_(dateStr, hhmm)`** — tạo `Date` bằng cách nối chuỗi ISO với hậu tố `+07:00` cứng, **né
  hoàn toàn phụ thuộc vào timezone của Apps Script project/server** (đây chính là fix lỗi timezone đã
  ghi nhận).
- **`submitBaoCao(payload)`** — RPC ghi dữ liệu, được gọi từ nút "Lưu báo cáo" trong `index.html`:
  1. Lấy `LockService.getScriptLock()` (chờ tối đa 20s) để tránh ghi đè khi nhiều người submit cùng lúc.
  2. Sinh `id` qua `genId_()`, tính `thang` (MM/YYYY) từ `payload.ngay`.
  3. Tính `tgDungMay` = phút từ `gioHu` → `gioKetThuc`, `tgSuaChua` = phút từ `gioSua` → `gioKetThuc`
     (dùng `minutesBetween_`).
  4. Gộp danh sách vật tư thành chuỗi tóm tắt `vatTuTomTat` (dạng `"Tên xSL; Tên xSL"`).
  5. `appendRow` vào `BaoCao` với thứ tự cột: `id, timestamp(now), thang, stt, maMay, tenMay, boPhan,
     viTri, noiDung, ngay, gioHu, gioSua, gioKetThuc, tgDungMay, tgSuaChua, tenKyThuat, loaiCongViec,
     vatTuTomTat, ghiChu`.
  6. Set number format cho các cột ngày/giờ vừa ghi (cột 2, 10, 11-13).
  7. Ghi từng dòng vật tư (có `ten`) vào `BaoCao_VatTu`: `[id, ma, ten, dvt, soLuong]`.
  8. Trả `{ ok:true, id }` hoặc `{ ok:false, error }`; luôn `releaseLock()` trong `finally`.

⚠️ **Lưu ý cấu trúc cột `BaoCao`** — nếu sau này thêm KPI "thời gian đáp ứng" / "chồng lịch kỹ thuật
viên", cần cộng thêm logic tại đây (server-side, đúng nguyên tắc dự án) chứ không phải công thức Sheets.
`stt = sheet.getLastRow()` (lấy trước khi appendRow) dùng số dòng hiện có làm STT tăng dần — cần để ý
nếu có xoá dòng thủ công sẽ làm STT không còn khớp tuyệt đối với "lần nhập thứ mấy".

## `apps-script/index.html` — Form nhập liệu mobile

SPA nhỏ gọn, không framework, toàn bộ CSS + HTML + JS trong 1 file, tối ưu cho màn hình điện thoại
(dùng làm target khi quét QR).

### Luồng dữ liệu client
1. Load trang → `google.script.run...getDanhMuc()` → nhận `DATA = {machines, vitri, parts, staff,
   congviec}` → ẩn overlay loading, render `appRoot`.
2. Đổ dữ liệu vào: dropdown kỹ thuật viên (`#tenKyThuat`), dropdown loại công việc (`#loaiCongViec`),
   datalist vị trí máy (`#viTriList`), ngày mặc định = hôm nay.
3. **Autocomplete tên máy** (`initMachineAutocomplete`): gõ vào `#tenMayInput`, lọc theo `ten`/`ma`
   (normalize NFC, lowercase), chọn từ panel → set `selectedMachine`, hiện badge mã + bộ phận.
4. **Vật tư động** (`addVatTuRow`, template `#vtRowTpl`): mỗi dòng có chip lọc theo nhóm (`NHOM_ORDER`),
   autocomplete riêng, số lượng; có thể thêm/xoá nhiều dòng.
5. **Nút "Now"** trên mỗi ô giờ (`gioHu/gioSua/gioKetThuc`) tự điền giờ hiện tại; `updateDurationHint()`
   tính nhanh phút dừng máy / phút sửa chữa hiển thị client-side (chỉ mang tính preview, giá trị thật
   tính lại ở server trong `submitBaoCao`).
6. **Submit** (`bindSubmit`): validate bắt buộc (máy, nội dung, kỹ thuật viên, đủ 3 mốc giờ) → build
   `payload` đúng shape mà `submitBaoCao(payload)` phía server mong đợi → gọi
   `google.script.run...submitBaoCao(payload)` → hiện thông báo thành công/lỗi → reset form (giữ lại
   không reset kỹ thuật viên đã chọn — theo tên hàm `resetFormKeepStaff`, nhưng thực tế hiện tại code
   không giữ giá trị `#tenKyThuat`, cần xác nhận lại nếu đây là hành vi mong muốn).

### Payload gửi lên `submitBaoCao`
```js
{
  maMay, tenMay, boPhan, viTri, noiDung,
  ngay,        // 'YYYY-MM-DD'
  gioHu, gioSua, gioKetThuc,  // 'HH:MM'
  tenKyThuat, loaiCongViec, ghiChu,
  vatTu: [{ ma, ten, dvt, soLuong }, ...]
}
```

## `apps-script/appsscript.json`

- `timeZone: Asia/Ho_Chi_Minh`
- `webapp.executeAs: USER_DEPLOYING` — chạy bằng quyền người deploy (không phải người dùng ẩn danh) →
  script luôn có quyền ghi Sheet dù người quét QR không có tài khoản Google truy cập được Sheet.
- `webapp.access: ANYONE_ANONYMOUS` — ai có link cũng mở được form, không cần đăng nhập Google.

## `baocao-saphia/index_fullscreen.html` — Wrapper GitHub Pages

- Repo Git riêng (`github.com/khangdang0703-lab/baocao-saphia`), deploy qua GitHub Pages.
- Chỉ là 1 `<iframe>` full màn hình trỏ tới URL `/exec` của Apps Script ở trên.
- Fix viewport mobile: CSS dùng `100dvh`/`100dvw` (có fallback `100vh`/`100vw` cho trình duyệt cũ), cộng
  thêm JS `fixHeight()` đo `window.innerHeight` thực tế và set trực tiếp vào style của iframe — bù cho
  các trình duyệt mobile (đặc biệt Safari/Chrome cũ) không tính đúng chiều cao khi thanh địa chỉ
  ẩn/hiện.
- Có comment nhắc: nếu deploy lại Apps Script và URL `/exec` đổi (mỗi lần "New deployment" tạo version
  mới sẽ đổi URL, trừ khi dùng chung 1 deployment ID và chỉ "Manage deployments → Edit"), phải sửa lại
  `src` trong file này.

## Trạng thái KPI đáp ứng — ĐÃ LÀM XONG

KPI "thời gian đáp ứng" và "chồng lịch kỹ thuật viên" **không còn là việc sắp làm**, đã có
trong mã: `calcDapUngMetrics_()` tính chỉ số, `themCotDapUngKPI_()` bổ sung cột T:Y vào sheet
`BaoCao`. Kiểm thử nằm ở `apps-script/test/test_dapUngKPI.js`, chạy bằng node.

Chi tiết thiết kế và các mục còn phải quyết định xem `TASK_NANG_CAP_DAP_UNG_KPI.md`.
