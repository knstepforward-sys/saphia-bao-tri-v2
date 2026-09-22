# Hình ảnh cho tài liệu quy trình khai báo kế hoạch máy

Thư mục này chứa ảnh dùng cho tài liệu `QUY_TRINH_KHAI_BAO_KE_HOACH_MAY_TO_TRUONG_ISO_v2.docx`.
Bạn tự làm logo đẹp, bỏ vào đúng chỗ dưới đây, rồi nhờ Claude lắp lại vào tài liệu.

## 1. Logo (thư mục `logo/`)

**Logo đang dùng nằm ở đâu trong tài liệu:** ô góc trên bên trái của khung đầu trang, trên mọi trang.
Ô này rộng khoảng 4,1 cm, cao khoảng 4,3 cm. Logo được đặt canh giữa ô.

**Các file có sẵn (chỉ để tham khảo, đừng sửa đè):**

| File | Kích thước | Ghi chú |
|---|---|---|
| `logo_hien_tai_GOC_tham_khao.png` | 820 x 468 px | Logo gốc lấy từ mẫu quy trình của công ty (ảnh nhỏ, in bị mờ) |
| `logo_hien_tai_HQ_tham_khao.png` | 1640 x 936 px | Bản phóng to gấp đôi, vẫn từ ảnh gốc nên chưa nét thật |

**Cách chuẩn bị logo mới:**

1. Đặt tên file: `logo_moi.png`, bỏ vào thư mục `logo/`.
2. Định dạng: PNG. Nền trắng hoặc nền trong suốt đều được.
3. Kích thước khuyến nghị: rộng tối thiểu **1640 px**, tỷ lệ ngang:dọc gần **820:468** (khoảng 1,75:1) để không bị méo.
   Nếu tỷ lệ khác, báo Claude, Claude sẽ tính lại cho vừa ô.
4. Tài liệu in đen trắng kiểu ISO, nên logo nên rõ nét khi in đen trắng. Tránh chữ quá nhỏ và màu nhạt.
5. Nếu có bản vector (SVG, AI, EPS, PDF) thì bỏ luôn vào `logo/` để Claude xuất PNG nét nhất.

**Sau khi bỏ file:** nhắn Claude "logo mới đã có" để lắp vào tài liệu và tạo lại file .docx.

## 2. Ảnh chụp màn hình app (thư mục `man-hinh-app/`)

Đây là các ảnh minh hoạ trong tài liệu, chụp từ dữ liệu giả lập ở khung 375 px (cỡ điện thoại).
Dữ liệu trong ảnh là dữ liệu mẫu, không phải dữ liệu thật của nhà máy.
Muốn thay ảnh bằng ảnh chụp thật từ điện thoại, giữ **đúng tên file** như bảng dưới rồi ghi đè.

| File | Nội dung ảnh | Mục trong tài liệu |
|---|---|---|
| `khai-lich.png` | Khai giờ làm việc lần đầu | Khai lịch làm việc |
| `det-chinh.png` | Màn hình chính của tổ (tổ Dệt) | Màn hình chính |
| `det-dong-ngay.png` | Đóng máy, bước chọn ngày | Đóng máy |
| `det-dong-ca.png` | Đóng máy, bước chọn ca | Đóng máy |
| `det-dong-may.png` | Đóng máy, bước chọn máy | Đóng máy |
| `det-dong-lydo.png` | Đóng máy, bước chọn lý do | Đóng máy |
| `det-dong-xn.png` | Đóng máy, bước xác nhận | Đóng máy |
| `det-cn-lydo.png` | Đóng Chủ nhật, chọn lý do | Việc khác |
| `det-cn-xn.png` | Đóng Chủ nhật, xác nhận | Việc khác |
| `det-chep-nguon.png` | Sao chép ngày, chọn ngày nguồn | Việc khác |
| `det-chep-dich.png` | Sao chép ngày, chọn ngày đích | Việc khác |
| `det-chep-xn.png` | Sao chép ngày, xác nhận | Việc khác |
| `det-botri.png` | Bỏ hết đóng máy | Việc khác |
| `det-khac.png` | Màn hình "Việc khác" | Việc khác |
| `det-ve-lydo.png` | Về giữa ca, chọn lý do | Về giữa ca |
| `det-ve-xn.png` | Về giữa ca, xác nhận | Về giữa ca |
| `det-kehoach.png` | Xem kế hoạch theo ngày | Xem kế hoạch |
| `tr-chinh.png` | Màn hình chính của tổ Tráng | Chạy ca đêm (Tráng) |
| `tr-dem-ngay.png` | Chạy ca đêm, chọn ngày | Chạy ca đêm (Tráng) |
| `tr-dem-may.png` | Chạy ca đêm, chọn máy | Chạy ca đêm (Tráng) |
| `tr-dem-xn.png` | Chạy ca đêm, xác nhận | Chạy ca đêm (Tráng) |
| `tr-tang-may.png` | Tăng ca, chọn máy | Tăng ca |
| `tr-tang-xn.png` | Tăng ca, xác nhận | Tăng ca |
| `tr-dong-ca.png` | Đóng máy, chọn ca (tổ có ca đêm) | Đóng máy |
| `tr-kehoach.png` | Kế hoạch của tổ Tráng | Xem kế hoạch |

Cột "Mục trong tài liệu" chỉ là tên nhóm chức năng gần đúng, không phải số mục chính xác.

## 3. Lưu ý

- Thư mục này chưa commit vào git. Nếu bạn muốn lưu lên GitHub, hãy nhắn Claude.
- Ảnh gốc của bạn (nếu có logo công ty chính thức) nên để ở một nơi khác lưu trữ, thư mục này chỉ là nơi làm việc.
