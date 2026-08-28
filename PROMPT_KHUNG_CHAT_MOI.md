# Prompt mở khung chat mới

Mở chat mới **trong thư mục repository `saphia-bao-tri-v2`**, dán khối dưới đây,
điền việc muốn làm ở dòng cuối.

---

```
Dự án: Hệ thống Bảo trì Toàn nhà máy v2 — đang chạy thật ở nhà máy. Đọc
bao-tri-v2/CLAUDE.md để biết deployment hiện tại, không dựa vào số ghi trong prompt.

ĐỌC TRƯỚC KHI LÀM BẤT CỨ GÌ:
- bao-tri-v2/CLAUDE.md — kiến trúc, schema, lý do đằng sau từng quyết định,
  bảng 14 cái bẫy đã trả giá, và mục 15 là trạng thái hiện tại + việc đang dở.
  Đừng hỏi lại tôi những gì file đó đã ghi.

QUY TẮC LÀM VIỆC:
- Ưu tiên giải bằng cấu hình trên Google Sheet. Sửa code là phương án cuối.
  Trước khi đề xuất thêm cột hay thêm hàm, kiểm xem khái niệm đó đã có trong
  schema chưa.
- Trình bày phương án và chờ tôi duyệt trước khi sửa file.
- Trước mỗi lần push, chạy: powershell -File kiemtra\kiem-tra.ps1
- Deploy LUÔN dùng: clasp deploy --deploymentId <ID trong CLAUDE.md>
  Tuyệt đối không tạo "Bản triển khai mới" — đổi URL là chết hết QR đã in.
- Nhắc tôi đóng tab Apps Script editor trước khi push.
- Trả lời bằng tiếng Việt.

VIỆC TÔI MUỐN LÀM:
[điền vào đây]
```

---

## Hai việc đang chờ, nếu chưa biết bắt đầu từ đâu

Chép một trong hai dòng này vào chỗ `[điền vào đây]`:

**1. Có giá trị nhất cho báo cáo sếp**
```
Thêm mục "So với tháng trước" vào báo cáo tổng hợp — xem mục 15 của CLAUDE.md.
```

**2. Cần tôi cung cấp số liệu**
```
Quy thời gian dừng máy ra tiền. Doanh thu ước tính mỗi giờ máy chạy là: [số tiền]
```

## Việc ngoài code, quan trọng hơn cả hai việc trên

Chuyển hệ thống sang **tài khoản email công ty**. Hiện toàn bộ dữ liệu và quyền quản trị
nằm trên một Gmail cá nhân — người đó nghỉ việc là công ty mất trắng. Kèm theo: sao lưu
định kỳ ra ngoài Google, và kiểm tra sóng mạng tại từng vị trí máy.
