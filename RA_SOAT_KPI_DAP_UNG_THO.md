# Rà soát — KPI đáp ứng thợ theo yêu cầu công ty (03/09/2026)

Yêu cầu gốc: *"KPI yêu cầu nếu thợ đang bận sẽ không tính thời gian"*, giữ nguyên 3 chỉ số
cũ, chỉ tính thêm cho phù hợp.

Ba điểm chủ dự án đã chốt:

1. Ngưỡng đạt — **chưa chốt**, công ty xem báo cáo tháng này rồi mới quyết.
2. Thời gian ngoài ca — **không có**, ca trực đến khi có người thay, nên không trừ.
3. Việc chung `CV-` — **được miễn trừ ngang** bận sự cố. (Bảo trì `BT-` vẫn không miễn trừ,
   giữ nguyên lý do ở `CLAUDE.md` mục 4.)

---

## 1. Việc đã làm

| File | Thay đổi |
|---|---|
| `Code.gs` | 5 cột cuối `Su_Co` (28 → 33); khoá `Cau_Hinh.NGUONG_KPI_DAP_UNG_PHUT`; menu 🎯 |
| `LuongTho.gs` | `phutBanTrongCho_`, `kpiThoChoPhieu_`, `nguongKpi_`, `tinhLaiKpiTho()`; ghi 5 cột trong `acceptIncident` |
| `XuatBaoCao.gs` | Khối "CƠ SỞ ĐỂ CHỌN NGƯỠNG"; 2 cột trong bảng theo thợ; 2 cột ở `Data_Goc`; chú thích |
| `Test.gs` | Mục 8b — bộ ca KPI, gồm ca nhiều đoạn bận mà bộ cũ chưa phủ |
| `kiemtra/kpi-tho.js` + `kiem-tra.ps1` | Lớp 4 mới: chạy số học KPI tại máy, không cần mở Sheet |
| `CLAUDE.md`, `NOTES.md` | Schema 33 cột, công thức mới, 5 lớp kiểm thử, nhật ký |

**Ba cột KPI cũ không bị sửa đè** — số cũ đã nằm trong các báo cáo đã gửi đi, đổi nghĩa giữa
chừng là mất khả năng đối chiếu.

## 2. Chấm theo tiêu chí nghiệm thu đã chốt trước khi gõ code

| # | Tiêu chí | Kết quả |
|---|---|---|
| 1 | Ca bận 2 đoạn rời → bận 30 phút, KPI 30 phút | ✅ Đạt |
| 2 | Ca một đoạn bận → khớp y hệt số cũ | ⚠️ **Đạt có điều kiện** — xem mục 3 |
| 3 | `Phut_Tiep_Nhan = Phut_Ban_Thuc_Te + Phut_KPI_Tho` ở mọi ca | ✅ Đạt — 2000 ca ngẫu nhiên |
| 4 | Đang ôm việc dở lúc nhận → KPI = 0 | ✅ Đạt |
| 5 | `CV-` tính là bận · `BT-` không · `DM-` không | ✅ Đạt |
| 6 | Phiếu `CHO_NHAN`/`CV`/`BT`/`DM` → `KPI_Ap_Dung = KHONG` kèm lý do, không vào mẫu | ✅ Đạt |
| 7 | Backfill chạy lại cho kết quả giống hệt, không đụng cột cũ | ✅ Đạt về logic — xem mục 4 |
| 8 | Ngưỡng để trống → báo cáo vẫn ra, cột đạt hiện `—` | ✅ Đạt |
| 9 | Bộ kiểm tra tĩnh sạch; test cũ vẫn xanh | ⚠️ Tĩnh sạch; test trong Sheet **chưa chạy** |
| 10 | Số liệu thật tháng 8 | ❌ **Chưa đo** |

## 3. Phát hiện khi chạy test — tiêu chí #2 của tôi viết sai

Ca `viecCu` trong `Test.gs`: máy 2 báo hỏng **09:00**, thợ nhận việc cũ `SC-1` lúc **09:02**,
xong 09:30, nhận máy 2 lúc 09:32.

- Cách cũ: KPI thợ **2 phút**.
- Cách cộng dồn: KPI thợ **4 phút**.

Hai phút 09:00–09:02 đó thợ **chưa cầm việc nào cả** — máy đã nằm chờ trong khi thợ còn
rảnh. Cách cũ gộp luôn vào "chờ do thợ bận" vì nó tính từ giờ báo tới mốc rảnh, bất kể thợ
bắt đầu bận lúc nào. Vậy cách cũ rộng tay ở **hai** chỗ chứ không phải một như tôi trình bày
lúc đầu:

1. Khoảng rảnh **xen giữa** hai đoạn bận.
2. Khoảng rảnh **đầu**, từ lúc máy báo tới lúc thợ thật sự cầm việc khác.

Cả hai đều nghiêng về phía có lợi cho người bị đo. Tiêu chí #2 đã sửa lại cho đúng: chỉ ca
một đoạn bận **trùm qua** lúc báo hỏng mới ra cùng số với cách cũ — đó là đa số phiếu, nên
phần lớn dòng sẽ không đổi.

⚠️ Ví dụ chuẩn ở `CLAUDE.md` mục 7 (*"nhà máy chịu 32 phút, KPI thợ chỉ 2 phút"*) vì vậy chỉ
còn đúng cho cột cũ. Đã ghi rõ cả hai cột trong tài liệu.

## 4. Những gì CHƯA đo — không được coi là đã xong

- **~230 test logic trong Sheet**: chưa chạy, vì phải mở Google Sheet. Lớp 4 mới chỉ phủ
  nhóm hàm KPI; phần còn lại của `Test.gs` vẫn cần bấm menu 🧪.
- **`tinhLaiKpiTho()` chưa chạy trên sheet thật**: tính đúng sai đã canh bằng test, nhưng
  phần đọc/ghi sheet (`getRange`, `setValues`, khoá 33 cột) chưa có lần chạy thật nào.
- **Số liệu tháng 8**: chưa có. Trung vị, P90, tỷ lệ đạt ở 5 mức chỉ hiện ra sau khi chạy
  backfill rồi xuất báo cáo.
- **`acceptIncident`**: mã đã viết nhưng web app đang chạy version deployment cũ, nên đường
  ghi tự động lúc thợ bấm nhận **chưa từng chạy thật lần nào**.

## 5. Thứ tự chạy

`clasp push --force` rồi trong Sheet:

1. 🔧 Bảo trì → **1. Cài đặt hệ thống** — nới `Su_Co` lên 33 cột (bắt buộc trước, hàm backfill
   có chốt chặn báo rõ nếu quên)
2. → **🧪 Chạy test logic** — xác nhận ~230 test còn xanh
3. → **🎯 Tính lại KPI đáp ứng của thợ** — bù số cho toàn bộ dữ liệu cũ
4. → **📤 Xuất báo cáo**, chọn tháng 8

Bốn bước này chạy bằng code HEAD trên Apps Script Editor nên **không cần deploy** — URL
`/exec`, QR trên máy và link cá nhân của thợ đều không đổi.

Phần ghi tự động lúc thợ bấm nhận nằm trong `acceptIncident`, chỉ có hiệu lực sau khi deploy
đúng deployment ID hiện có. Đề xuất ghép vào lần deploy chủ nhật cùng ô tick *"Máy chưa chạy
lại được"*. Trong lúc chờ, chạy lại bước 3 là bù đủ số.
