# Prompt mở khung chat mới

Mở chat mới **trong thư mục repository `C:\Users\User\SAPHIA-project\saphia-bao-tri-v2`**,
không phải thư mục cha. Dán khối dưới đây, điền việc muốn làm ở dòng cuối.

---

```
Dự án: Hệ thống Bảo trì Toàn nhà máy v2 — đang chạy thật ở nhà máy. Đọc
bao-tri-v2/CLAUDE.md để biết deployment hiện tại, không dựa vào số ghi trong prompt.

ĐỌC TRƯỚC KHI LÀM BẤT CỨ GÌ:
- bao-tri-v2/CLAUDE.md — kiến trúc, schema, lý do đằng sau từng quyết định,
  bảng 14 cái bẫy đã trả giá, và mục 15 là trạng thái hiện tại + việc đang dở.
  Đừng hỏi lại tôi những gì file đó đã ghi.

ĐỒNG BỘ TRƯỚC KHI SỬA — bắt buộc:
- Chạy `git pull` để lấy bản mới nhất từ GitHub.
- Chạy `clasp.cmd clone <scriptId>` ra một thư mục tạm rồi so với bao-tri-v2/.
  Đã có lần repo tụt lại ~1000 dòng vì có người sửa thẳng trên Apps Script Editor;
  push đè lúc đó là xoá mã đang chạy thật. Lệch thì báo tôi trước khi làm gì.

QUY TẮC LÀM VIỆC:
- Ưu tiên giải bằng cấu hình trên Google Sheet. Sửa code là phương án cuối.
  Trước khi đề xuất thêm cột hay thêm hàm, kiểm xem khái niệm đó đã có trong
  schema chưa.
- Trình bày phương án và chờ tôi duyệt trước khi sửa file.
- Trước mỗi lần push, chạy: powershell -File kiemtra\kiem-tra.ps1
- Xong việc thì commit và push lên GitHub, hỏi tôi trước khi push.
- Deploy LUÔN dùng: clasp.cmd deploy --deploymentId <ID trong CLAUDE.md>
  Tuyệt đối không tạo "Bản triển khai mới" — đổi URL là chết hết QR đã in.
- clasp push và deploy chỉ chạy khi tôi xác nhận rõ ràng TỪNG LẦN.
- Nhắc tôi đóng tab Apps Script editor trước khi push.
- Trả lời bằng tiếng Việt.

VIỆC TÔI MUỐN LÀM:
[điền vào đây]
```

---

## Vì sao phải mở đúng thư mục repository

Thư mục cha `SAPHIA-project` từng chứa một bản mã cũ và tài liệu ghi sai trạng thái.
Bản cũ đó đã được chuyển vào `_cu-khong-dung/` ngày 09/09/2026 nhưng vẫn còn trên máy.
Mở chat ở thư mục cha thì tài liệu cũ được nạp và dễ làm việc nhầm trên mã cũ.

Thư mục cha còn hai thứ vẫn dùng, không đụng vào: `QC/` là hệ thống khác, và
`baocao-saphia/` là repository wrapper GitHub Pages.

## Ba lệnh hay dùng

```bash
git pull                                   # lấy bản mới từ GitHub
powershell -File kiemtra\kiem-tra.ps1      # kiểm tra tĩnh trước khi push
git add -A && git commit && git push       # đưa thay đổi lên GitHub
```

Lưu ý: gọi `clasp.cmd`, không gọi `clasp`. PowerShell chặn file `clasp.ps1` với lỗi
*running scripts is disabled*; đừng hạ ExecutionPolicy của máy chỉ để chạy một lệnh.

Tài khoản clasp hiện tại: `kn.stepforward`. Đổi ngày 09/09/2026 vì tài khoản cá nhân cũ
bị chặn deploy do không cùng domain Workspace với chủ sở hữu script.

---

## Việc đang chờ, nếu chưa biết bắt đầu từ đâu

Chép một trong hai dòng này vào chỗ `[điền vào đây]`:

**1. Đang làm dở**
```
Cải tiến cách tính tỉ lệ hiệu dụng A trong HieuDung.gs rồi bật lại công tắc
HIEN_HIEU_DUNG_BAO_CAO_NGAY. Cách tính cũ coi mọi máy Hoat_Dong = TRUE là có
kế hoạch chạy đủ lịch bộ phận, không đúng thực tế.
```

**2. Cần tôi cung cấp số liệu**
```
Quy thời gian dừng máy ra tiền. Doanh thu ước tính mỗi giờ máy chạy là: [số tiền]
```

## Việc ngoài code, quan trọng hơn cả hai việc trên

Chuyển hệ thống sang **tài khoản email công ty**. Hiện toàn bộ dữ liệu và quyền quản trị
nằm trên một Gmail cá nhân — người đó nghỉ việc là công ty mất trắng. Kèm theo: sao lưu
định kỳ ra ngoài Google, và kiểm tra sóng mạng tại từng vị trí máy.
