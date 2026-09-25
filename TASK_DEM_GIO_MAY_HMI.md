# TASK — Đếm giờ máy chạy thật bằng HMI (ý tưởng, CHƯA đề xuất chính thức)

> Trạng thái (25/09/2026): **đang ở bước ý tưởng.** Chủ dự án chốt: **tự lập trình mô phỏng và đấu
> mạch thử trước**, chắc chắn làm được rồi mới đề xuất / báo sếp. Chưa mua thiết bị, chưa hỏi báo giá,
> chưa đụng mã hệ thống bảo trì.

## 1. Vì sao cần

- Báo cáo tuần có hai chỉ số (`bao-tri-v2/HuyDong.gs`). **Tỷ lệ huy động** do tổ trưởng khai → chủ dự án
  xác nhận là đúng.
- **Hiệu suất** hiện chỉ trừ giờ dừng có phiếu sửa + về giữa ca + ca đêm thiếu thợ. Các lần ngưng vặt
  (lấy vải, đi WC, chờ nguyên liệu, chỉnh máy…) không ghi → con số **cao hơn thực tế**, nhất là CMTX.
- Chỉ Dệt có đồng hồ đếm giờ máy để đối chiếu; các tổ khác không kiểm được.
- Ghi tay từng lần ngưng vặt: không khả thi (tốn công, ghi qua loa).

→ Cần đo giờ máy chạy thật một cách tự động.

## 2. Phương án đã chọn: cách 1 — Module IO Modbus + HMI (không PLC)

```
Tiếp điểm phụ NO (khô) của contactor động cơ chính
        │  24VDC lấy từ nguồn module (KHÔNG đưa 220V cuộn contactor vào module)
        ▼
Module IO Modbus RTU 16DI ──RS485──┐   (mỗi module 16 máy)
Module IO …               ──RS485──┤
                                   ▼
                        HMI (Modbus RTU master)
                        - hỏi module mỗi 1 giây
                        - macro: ngõ vào ON → cộng 1 giây cho máy đó
                        - lưu vào bộ nhớ giữ khi mất điện
                        - tự reset theo lịch ca
                        - ghi số từng ca ra USB/SD
```

- Chọn vì bền hơn ESP32/wifi (cách 2). Không cần PLC khi quy mô 1 tổ (~16–48 máy); PLC chỉ cần khi
  mở rộng cả nhà máy, cần nhiều màn hình, hoặc muốn tách việc đếm khỏi HMI.
- Lấy tín hiệu ở **contactor**, không lấy ở nút Start (nút nhấn nhả). Máy chạy biến tần: lấy ngõ ra
  relay RUN của biến tần.
- Chỉ đọc tín hiệu, **không can thiệp mạch điều khiển máy**.
- Đồng hồ đếm giờ độc lập (Omron H7ET-NV / H7ET-N-B…) không có cổng truyền thông → không đưa lên màn
  hình chung được; chỉ dùng nếu muốn đọc tay từng máy.

## 3. Kế hoạch thử (thứ tự bắt buộc — xong bước trước mới sang bước sau)

1. **Mô phỏng trên máy tính.** Lập trình HMI (Weintek EasyBuilder Pro / Delta DOPSoft — phần mềm miễn
   phí, có chế độ mô phỏng) + giả lập module Modbus RTU. Kiểm: đếm đúng giây, giữ số khi tắt/mở lại,
   reset đúng giờ ca, file xuất ca đọc được.
2. **Đấu mạch thử trên bàn.** 1 HMI + 1 module 16DI + nguồn 24VDC + công tắc/relay giả tiếp điểm
   contactor. Kiểm: đếm khớp đồng hồ bấm giờ, mất điện giữa chừng, rút dây RS485, nhiễu.
3. **Thử trên 3–5 máy CMTX, 2–4 tuần.** Đấu tiếp điểm phụ thật (thợ điện làm, cắt điện khi đấu).
   So giờ HMI với con số hệ thống đang tính → ra mức ngưng vặt thật.
4. **Chỉ khi 1–3 đạt** mới viết đề xuất chính thức / hỏi báo giá / báo sếp.

## 4. Linh kiện dự kiến cho bước 2–3 (tham khảo, chưa chốt)

- 1 HMI 7" có cổng RS485 + LAN (ưu tiên Weintek dòng cMT — có MQTT, sau này dễ đẩy dữ liệu lên).
- 1–2 module IO Modbus RTU 16 ngõ vào số (hàng phổ thông "16DI RS485" hoặc Weintek iR-DI16).
- Nguồn 24VDC, dây RS485 xoắn đôi chống nhiễu, điện trở cuối đường 120 Ω.
- Contactor có tiếp điểm phụ NO còn trống (hoặc lắp thêm khối tiếp điểm phụ gắn mặt contactor).

## 5. Việc chưa quyết / để sau

- Đưa số giờ chạy thật vào hệ thống bảo trì (báo cáo tuần tính hiệu suất thật): cần thêm điểm nhận
  dữ liệu trong Apps Script → **đợt riêng, phải duyệt riêng**; không đổi URL `/exec`, không đổi QR.
- Khả năng HMI gửi thẳng lên Google Sheet (HTTP/MQTT): phải thử thật ở bước 1–2.
- Mở rộng sang Dệt (đối chiếu với đồng hồ sẵn có) và các tổ khác.
