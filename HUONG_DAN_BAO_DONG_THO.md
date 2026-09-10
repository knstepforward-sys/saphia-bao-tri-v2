# Hướng dẫn cài báo động cho điện thoại thợ

Tin Telegram của bot mặc định kêu như một thông báo bình thường. Trong xưởng ồn, hoặc
với thợ ca đêm, tiếng đó không đủ. Tài liệu này hướng dẫn cài **MacroDroid** để tin của
bot kích hoạt một hồi rung dài và chuông báo, thay vì một tiếng "tinh" rồi thôi.

> **Cái giá phải biết trước.** Phải cài và cấu hình trên **từng máy**, và mỗi hãng điện
> thoại chặn ứng dụng chạy nền một kiểu. Máy nào cấu hình sai thì hỏng **im lặng** —
> thợ vẫn tưởng mình sẽ được báo. Nên sau khi cài phải thử thật, xem mục 5.

---

## 1. Vì sao không sửa được từ phía bot

Telegram Bot API không có tham số điều khiển thời lượng rung. Nó chỉ có một công tắc bật
hoặc tắt thông báo, và mã đang để bật. Rung bao lâu, kêu tiếng gì, đều do điện thoại
người nhận quyết định. Vì vậy mọi cách làm đều nằm ở phía máy thợ, không phải trong mã.

## 2. Chuỗi dùng để lọc

Macro phải kêu **đúng tin cần hành động**, không kêu với mọi tin nhắn Telegram, cũng
không kêu với tin báo đã có người nhận.

Dùng chuỗi:

```
Bấm để nhận việc
```

Chuỗi này có trong tin **sự cố mới** và cả hai tin **nhắc** (lần 1 mốc 10 phút, lần 2
mốc 20 phút). Nó **không** có trong tin `✅ ... đã nhận ... Bạn không cần xử lý.` — đúng
thứ ta muốn im lặng.

> **Bẫy:** dòng đó chỉ xuất hiện khi thợ có `Link_Ca_Nhan`. Thợ nào chưa có link cá nhân
> thì tin không kèm dòng này và macro sẽ không kêu. Trước khi phát máy, chạy menu
> **4. Làm mới link cá nhân** để chắc cả 15 người đều có link.

## 3. Cài đặt trên máy thợ

1. Cài **MacroDroid** từ Play Store. Bản miễn phí đủ dùng, giới hạn 5 macro.
2. Mở MacroDroid, bấm **Thêm macro**.
3. **Kích hoạt** (Trigger): chọn **Thiết bị / Sự kiện** rồi **Đã nhận thông báo**.
   - Ứng dụng: chọn **Telegram**.
   - Chọn **Nội dung chứa** và gõ đúng: `Bấm để nhận việc`
   - Lần đầu nó sẽ xin **quyền đọc thông báo**. Phải cấp, không cấp thì macro không
     bao giờ chạy.
4. **Hành động** (Action), thêm ba cái theo thứ tự:
   - **Rung**: chọn kiểu rung dài nhất, hoặc tự đặt mẫu rung lặp lại.
   - **Đặt âm lượng**: kéo âm lượng thông báo và nhạc lên tối đa. Bước này quan trọng với
     ca đêm, lúc máy hay đang ở mức nhỏ.
   - **Phát âm thanh**: chọn một file còi báo động dài 5 đến 10 giây.
5. **Điều kiện** (Constraint): để trống. Đặt điều kiện "chỉ khi tắt màn hình" nghe hợp lý
   nhưng sai — thợ đang cầm máy làm việc khác vẫn cần nghe.
6. Đặt tên macro là `Bao dong su co` rồi lưu.

## 4. Chặn hệ điều hành giết ứng dụng

Đây là chỗ hỏng nhiều nhất, và hỏng im lặng. Với **mỗi** máy, vào Cài đặt điện thoại và
làm hai việc cho cả **MacroDroid** lẫn **Telegram**:

- Bỏ tối ưu hoá pin, chọn **Không hạn chế**.
- Cho phép **tự khởi động** và **chạy nền**.

Đường đi theo hãng, tên mục có thể lệch chút theo phiên bản:

| Hãng | Đường đi |
|---|---|
| Xiaomi / Redmi / POCO | Cài đặt → Ứng dụng → Quản lý ứng dụng → chọn app → Tiết kiệm pin: **Không hạn chế**; bật **Tự khởi động** |
| Oppo / Realme / OnePlus | Cài đặt → Pin → Sử dụng pin ứng dụng → chọn app → **Cho phép chạy nền** |
| Samsung | Cài đặt → Pin → Giới hạn sử dụng nền → bỏ app khỏi **Ứng dụng đang ngủ** |
| Vivo | Cài đặt → Pin → Mức tiêu thụ nền cao → cho phép app |

Xiaomi là hãng chặn gắt nhất và cũng phổ biến nhất trong xưởng. Ưu tiên kiểm kỹ máy Xiaomi.

## 5. Thử thật, đừng tin là đã xong

Cài xong **phải** thử, vì lỗi ở đây không báo gì cả:

1. Khoá màn hình, để máy yên **ít nhất 15 phút**. Bước chờ này là bắt buộc — hệ điều hành
   chỉ giết ứng dụng nền sau một lúc, thử ngay lập tức sẽ luôn thấy đạt.
2. Từ Google Sheet, menu **📨 Thông báo Telegram** → **Gửi tin thử…**, gõ mã thợ đó.
3. Tin thử **không** chứa chuỗi `Bấm để nhận việc`, nên macro sẽ **không** kêu — chỉ có
   thông báo Telegram bình thường. Đó là đúng, và nó xác nhận bộ lọc chạy chính xác.
4. Muốn thử cả tiếng báo động thì tạm đổi bộ lọc sang `Tin thử` một lượt, thử xong đổi lại.

Ghi lại máy nào đã thử đạt. Máy chưa thử coi như chưa cài.

## 6. Nếu quá phiền

Còn một cách nhẹ hơn nhiều, không cần ứng dụng nào: trong Telegram mở chat với bot, bấm
tên bot → **Thông báo**, đặt **Rung: Dài** và chọn **Âm thanh** là một file dài 5 đến 10
giây. Máy sẽ kêu suốt độ dài file đó. Không mạnh bằng cách trên, nhưng không có gì để
hỏng, không bị hệ điều hành giết, và cài trong một phút.

Với thợ ca ngày ở khu vực không quá ồn, cách này thường là đủ.

## 7. Nhớ rằng bỏ lỡ tin đầu không mất phiếu

Hệ thống đã lường trước. Trigger chạy 5 phút một lượt và **nhắc lại hai lần** với phiếu
chưa ai nhận, mốc mặc định 10 phút và 20 phút. Muốn gắt hơn thì sửa `NHAC_LAN_1_PHUT` và
`NHAC_LAN_2_PHUT` trong sheet `Cau_Hinh`, không cần đụng mã, không cần deploy lại.

Nên coi báo động ở đây là để rút ngắn thời gian đáp ứng, không phải là lớp chống mất phiếu.
Lớp đó đã có sẵn.
