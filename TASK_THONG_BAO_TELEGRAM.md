# Task — Bot Telegram nhắc thợ khi có sự cố

> Bổ sung cho `bao-tri-v2/CLAUDE.md`. Đọc file đó trước để nắm kiến trúc, rồi đọc file này.
> Trạng thái: **đã duyệt phương án, chưa viết dòng mã nào.** Chốt ngày 09/09/2026.

---

## 1. Bệnh cần chữa

Công nhân quét QR, báo sự cố xong thì màn hình hiện danh bạ thợ đang trực để gọi điện.
**Rất nhiều người quên gọi.** Phiếu nằm ở trạng thái `CHO_NHAN` mà không ai biết, máy nằm im.

Hệ thống đã biết chính xác ai đang trực (`getOnDutyContacts_`, thang 3 nấc, mục 6 của
`bao-tri-v2/CLAUDE.md`). Cái thiếu duy nhất là **không có đường đẩy tin tới điện thoại thợ**.

Bot Telegram lấp đúng khoảng trống đó: miễn phí, gọi được bằng một lệnh `UrlFetchApp`,
không cần máy chủ riêng.

---

## 2. Quyết định đã chốt

**Gửi cho tất cả thợ đang trực trong nấc 1, không phân biệt chính phụ.**

Đã cân nhắc và bác phương án "gửi riêng người chính, kèm nút chuyển cho người phụ". Lý do:

- Hệ thống **không có** dữ liệu ai chính ai phụ. `getOnDutyContacts_` trả về các thợ ngang
  hàng, xếp theo thứ tự dòng trong sheet. Muốn xếp hạng phải khai thêm dữ liệu mới, mà lịch
  trực luân phiên theo tuần nên cặp trực đổi liên tục, khai ở đâu cho khỏi sai là bài toán riêng.
- Nỗi lo "gửi cả hai thì không biết ai đã nhận" giải được rẻ hơn nhiều: **ngay khi một người
  bấm nhận, bot nhắn cho người kia biết**. Hết mơ hồ, không cần ai chuyển việc cho ai.
- Người bận thật thì chỉ cần không bấm gì, người kia thấy tin còn treo thì tự nhận.

Nút "chuyển việc cho người trực cùng ca" **không làm trong đợt này**. Nếu sau này vẫn cần thì
đặt trên trang thợ (`Tho.html`), không đặt trong tin nhắn Telegram, vì đặt trong tin nhắn buộc
phải mở thêm đường nhận dữ liệu từ Telegram về Apps Script.

**Bốn thứ chủ dự án đã duyệt ngày 09/09/2026:**

1. Thêm cột `Telegram_Chat_ID` vào **cuối** `Danh_Muc_Tho`.
2. Thêm ba khoá vào `Cau_Hinh`: công tắc bật tắt, ngưỡng nhắc lần 1, ngưỡng nhắc lần 2.
3. Token bot cất trong **Script Properties**, không cất trong `Cau_Hinh`, không vào repository.
4. Hai mục menu mới: lấy Telegram ID, và gửi thử.

---

## 3. Đường mạng — đã thử một nửa

**Lệnh gửi KHÔNG đi qua mạng nhà máy.** Apps Script chạy trên máy chủ Google, nên lời gọi tới
Telegram đi thẳng từ Google sang Telegram. Nhà mạng Việt Nam chặn hay không cũng không ảnh
hưởng tới việc gửi. Bản đầu của tài liệu này ghi sai điều đó, đã sửa ngày 09/09/2026.

Mạng ở nhà máy chỉ quyết định **thợ có nhận và đọc được tin hay không**.

| Phép thử | Kết quả |
|---|---|
| Telegram trên wifi nhà máy | ✅ Vào được bình thường, thử ngày 09/09/2026 |
| Telegram trên 4G của thợ | ❓ Chưa thử |

Phép thử 4G vẫn cần làm: thợ ca đêm hoặc đi tới khu máy sóng yếu thì rớt wifi sang 4G, đúng
lúc cần nhận tin nhất. Nhờ một thợ tắt wifi rồi mở Telegram là biết.

Nếu 4G cũng chặn thì cân nhắc phương án thay thế: `Tho.html` tự làm mới mỗi 30 giây, có phiếu
mới chưa ai nhận thì phát chuông và rung. Miễn phí, không phụ thuộc bên thứ ba, không cần cột
mới. Đổi lại thợ phải để trang mở.

---

## 4. Thiết kế

### 4.1 File mới `bao-tri-v2/ThongBao.gs`

Toàn bộ phần Telegram nằm trong một file. Không rải rác vào các file đang chạy.

| Hàm | Việc |
|---|---|
| `tokenTelegram_()` | Đọc token từ Script Properties. Không có token thì trả rỗng. |
| `telegramBat_(cauHinh)` | Đọc công tắc `TELEGRAM_BAT`. Tắt thì mọi hàm gửi thành lệnh rỗng. |
| `cauChiDangNgat_()` | Đọc `CacheService`: lần gửi trước hỏng thì ngắt 10 phút, xem 5.12. |
| `guiTelegram_(ds)` | Gửi thật bằng `UrlFetchApp.fetchAll`. Nuốt mọi lỗi, trả về số tin gửi được. |
| `chatIdTheoMaTho_()` | Đọc `Danh_Muc_Tho`, trả map `Ma_Tho → chat id`. |
| `soanTinSuCoMoi_(v, may)` | **Hàm thuần.** Dựng nội dung tin báo sự cố mới. |
| `soanTinDaNhan_(v)` | **Hàm thuần.** Dựng tin "ai đó đã nhận rồi". |
| `soanTinNhac_(v, lan)` | **Hàm thuần.** Dựng tin nhắc lần 1 và lần 2. |
| `thongBaoSuCoMoi_(v, danhBa)` | Ghép ba hàm trên, gọi từ `reportIncident`. |
| `thongBaoDaNhan_(v, maThoNhan)` | Gọi từ `acceptIncident`, gửi cho những người còn lại. |
| `nhacPhieuChoNhan()` | Hàm chạy bằng trigger 5 phút. |
| `menuLayTelegramId()` | Gọi `getUpdates`, hiện danh sách để ghép vào thợ. |
| `menuGuiThu()` | Gửi một tin thử cho một thợ, để kiểm tra mà không cần chờ sự cố thật. |

Ba hàm `soan…` là hàm thuần, chỉ nhận mảng và `Date`, nên kiểm thử được ngay tại máy bằng
node, không cần mở Sheet. Đây là lý do tách riêng phần soạn tin khỏi phần gửi.

### 4.2 Ba chỗ móc vào mã đang chạy

| File | Chỗ | Việc |
|---|---|---|
| `CongNhan.gs` | `reportIncident`, **sau** `moKhoa_()` ở dòng ~817 | Gửi tin cho thợ trong `danhBa` |
| `CongNhan.gs` | `reportMachineStop` | Như trên, cho phiếu dừng máy |
| `LuongTho.gs` | `acceptIncident`, ngay trước `return { ok: true …}` | Báo cho người còn lại |

Mỗi chỗ chỉ thêm **một** lời gọi, bọc try/catch tại chỗ. Không sửa logic sẵn có, không đổi
giá trị trả về, không đổi thứ tự ghi sheet.

### 4.3 Nội dung tin

```
🔴 MÁY DỆT 12 (DET) đã dừng
Lỗi cơ khí
"Máy kêu to rồi dừng đột ngột"
Báo lúc 14:32 · phiếu SC-20260909-014

➡️ Bấm để nhận việc: <Link_Ca_Nhan của chính thợ đó>
```

Link là cột `Link_Ca_Nhan` đã có sẵn trong `Danh_Muc_Tho`, mở thẳng trang thợ, không phải
đăng nhập. Mỗi thợ nhận link của riêng mình.

Tin báo đã có người nhận, gửi cho những người còn lại:

```
✅ Nhân đã nhận SC-20260909-014 lúc 14:35. Bạn không cần xử lý.
```

### 4.4 Ba lớp nhắc

| Lớp | Khi nào | Gửi cho ai |
|---|---|---|
| 1 | Ngay lúc công nhân báo | Thợ đang trực, nấc 1 |
| 2 | Quá `NHAC_LAN_1_PHUT` mà chưa ai nhận | Chính những người trên, lời gắt hơn, kèm số phút máy đã nằm im |
| 3 | Quá `NHAC_LAN_2_PHUT` | Thêm số khẩn cấp trong `Cau_Hinh.SDT_KHAN_CAP` |

Lớp 2 và 3 chạy bằng trigger 5 phút, **không cần deploy**, xem mục 7.

Để bot không nhắc đi nhắc lại mỗi 5 phút, mỗi lần nhắc ghi một dòng vào `Nhat_Ky_Su_Co` với
tác nhân `BOT` và hành động `NHAC_LAN_1` / `NHAC_LAN_2`. Lượt sau đọc lại rồi mới quyết định.
Cách này **không phải thêm cột nào vào `Su_Co`**, và để lại vết kiểm chứng bot đã làm gì.

---

## 5. Rào an toàn

Đây là phần quan trọng nhất của tài liệu. Hệ thống đang phục vụ 175 máy chạy thật.
Mỗi rào dưới đây tương ứng một cách hỏng cụ thể đã nghĩ tới.

### 5.1 Gửi tin hỏng KHÔNG được làm hỏng việc ghi phiếu

Hàm gửi tự nuốt mọi lỗi và trả về số tin gửi được, không bao giờ ném ra ngoài. Chỗ gọi vẫn
bọc thêm try/catch. Phiếu đã ghi xong trước khi gửi, nên dù Telegram chết hẳn thì công nhân
vẫn báo được sự cố và vẫn thấy danh bạ như cũ.

*Canh bằng test:* giả lập `UrlFetchApp` ném lỗi, `reportIncident` vẫn phải trả `ok: true`.

### 5.2 Gửi NGOÀI khoá, tuyệt đối không trong khoá

`reportIncident` nhả khoá bằng `moKhoa_()` trước khi dựng danh bạ. Lời gọi gửi tin phải đặt
**sau** dòng đó. Đặt nhầm vào trong khoá thì mọi người báo sự cố phải xếp hàng chờ một cuộc
gọi mạng, đúng thứ mà chú thích ở dòng 812 đã cảnh báo.

### 5.3 Cột mới chỉ ĐỌC, không ghi

`Danh_Muc_Tho` đi từ 9 lên 10 cột. Sheet mặc định rộng 26 cột, nên `docSheet_` gọi
`getRange(2, 1, n, 10)` vẫn nằm trong vùng, **không văng lỗi tràn cột kể cả khi chưa chạy
`setupSystem`**. Khác hẳn đợt `Su_Co` 28 lên 33 cột vốn phải nới trước vì có ghi cả dòng.

Vẫn chạy `setupSystem` một lần để có tiêu đề cột, nhưng mã **không được phụ thuộc** vào việc
đó đã chạy hay chưa.

*Canh bằng test:* đọc `Danh_Muc_Tho` từ dòng chỉ có 9 giá trị, phải ra chat id rỗng chứ không lỗi.

### 5.4 Chat id trống là bình thường, không phải lỗi

Ghép chat id cho 15 thợ làm dần. Ai chưa ghép thì bỏ qua im lặng, hệ thống chạy y như trước.
Không cảnh báo, không chặn, không ghi lỗi.

### 5.5 Công tắc tắt cứng, không cần push không cần deploy

`Cau_Hinh.TELEGRAM_BAT` gõ `TAT` là dừng toàn bộ phần Telegram ngay lập tức. Đây là rào quan
trọng nhất về vận hành: có sự cố gì thì người ở nhà máy tự tắt được, không phải chờ ai push mã.

Mặc định khi tạo khoá là `TAT`. Bật lên chỉ sau khi đã gửi thử thành công.

### 5.6 Bot chỉ gửi đi, không nhận về

**Không thêm `doPost`.** Không webhook. Không đổi deployment, không đổi URL `/exec`. Lấy chat id
bằng `getUpdates` gọi từ menu trong Sheet. Nghĩa là phần Telegram không đụng gì tới đường
QR đang chạy.

### 5.7 Không sửa `getOnDutyContacts_`

Dùng lại kết quả hàm đó trả về, không sửa hàm. Mục 6 của `bao-tri-v2/CLAUDE.md` ghi rõ trang
thợ và màn hình danh bạ dùng chung đúng điều kiện nấc 1 để hai bên không nói ngược nhau.
Đụng vào là kéo cả hai bên hỏng theo.

### 5.8 Không nhét chat id vào `danhBa`

Object `danhBa` được **trả thẳng về trình duyệt của công nhân**. Nhét chat id vào đó là phát
tán ra ngoài. Phần thông báo tự đọc `Danh_Muc_Tho` để ghép `Ma_Tho` sang chat id, tốn thêm
một lượt đọc sheet khoảng 150 ms, chấp nhận được.

### 5.9 Trigger không được đụng vào dữ liệu phiếu

`nhacPhieuChoNhan` chỉ **đọc** `Su_Co` và chỉ **ghi** `Nhat_Ky_Su_Co`. Không đổi `Trang_Thai`,
không đổi bất cứ cột nào của `Su_Co`. Nếu bot ghi vào `Su_Co` thì có ngày nó đè lên đúng lúc
thợ đang bấm nhận.

### 5.10 Trigger phải chịu được chạy chồng và chạy trễ

Google có thể chạy trigger trễ hoặc chồng lượt. Dùng `LockService` với `tryLock` ngắn, không
lấy được khoá thì bỏ lượt, lượt sau 5 phút nữa làm tiếp. Không chờ, không thử lại.

### 5.11 Chặn cứng số tin mỗi lượt

Mỗi phiếu tối đa **2 lần nhắc**, đời đời. Mỗi lượt trigger gửi tối đa một số tin nhất định.
Trường hợp phải phòng: mất điện cả xưởng, 40 máy báo cùng lúc, bot nhắn 200 tin.

### 5.12 Cầu chì khi Telegram không trả lời

Không phải để phòng nhà máy chặn Telegram — lệnh gửi đi từ máy chủ Google, không qua mạng nhà
máy. Để phòng hai thứ khác: Telegram lỗi hoặc chặn tốc độ, và Google gọi ra ngoài chậm. Cả hai
đều làm lệnh gửi treo tới lúc hết giờ chờ, mà lệnh đó nằm ngay sau lúc công nhân bấm gửi phiếu.

Rào: một lần gửi hỏng thì ghi dấu vào `CacheService` và **ngắt 10 phút**, trong 10 phút đó
không gọi mạng lần nào nữa. Hết 10 phút thử lại một lần. Nghĩa là kể cả Telegram chết hẳn thì
mỗi 10 phút chỉ có đúng một người phải chờ, thay vì tất cả mọi người.

### 5.13 Token không được lọt vào repository

Token cất trong Script Properties. Thêm một phép kiểm tra vào `kiemtra`: quét các file `.gs`
tìm chuỗi có dạng token bot Telegram, thấy là báo đỏ và chặn push. Rào tự động, không dựa vào
trí nhớ người viết mã.

---

## 6. Kế hoạch thi công

Làm theo đúng thứ tự. Mỗi bước xong mới sang bước sau.

| Bước | Việc | Xong khi nào |
|---|---|---|
| B1 | Viết `ThongBao.gs`: ba hàm soạn tin thuần trước, chưa gọi mạng | Đọc lại thấy đúng ý |
| B2 | Thêm `kiemtra/thongbao.js`, nối thành lớp 5 của `kiem-tra.ps1` | Lớp 5 xanh |
| B3 | Viết phần gửi thật, công tắc, cầu chì, map chat id | Lớp 1 tới 5 xanh |
| B4 | Thêm cột `Telegram_Chat_ID` vào `HEADER_THO`, ba khoá vào `CAU_HINH_MAC_DINH` | Lớp 1 tới 5 xanh |
| B5 | Hai mục menu, phép kiểm tra token trong `kiemtra` | Lớp 1 tới 5 xanh |
| B6 | Móc vào ba chỗ trong `CongNhan.gs` và `LuongTho.gs` | Lớp 1 tới 5 xanh |
| B7 | Trigger `nhacPhieuChoNhan`, nối vào `caiDatTrigger` | Lớp 1 tới 5 xanh |
| B8 | Thêm mục kiểm thử vào `Test.gs`, cập nhật `bao-tri-v2/CLAUDE.md` và `NOTES.md` | Đủ tài liệu |
| B9 | Commit, push GitHub | Đã push |

Toàn bộ B1 tới B9 **không** `clasp push`, **không** deploy.

---

## 7. Thứ tự đưa vào chạy thật

Sắp xếp để phần có giá trị nhất lên trước, phần rủi ro nhất xuống cuối.

**Bước 0 — thử mạng.** Wifi nhà máy đã thử ngày 09/09/2026, vào được. Còn 4G của thợ chưa thử,
xem mục 3. Việc gửi không phụ thuộc hai phép thử này, chỉ việc thợ nhận tin mới phụ thuộc.

**Bước 1 — tạo bot.** Nhắn `@BotFather` trong Telegram, đặt tên, nhận token. Dán token vào
Script Properties, khoá `TELEGRAM_BOT_TOKEN`. Việc này chủ dự án tự làm, mã không đụng tới.

**Bước 2 — `clasp push`.** Cần chủ dự án xác nhận riêng. Sau đó chạy menu "1. Cài đặt hệ thống"
một lần để có cột mới và ba khoá cấu hình.

**Bước 3 — gửi thử.** Một thợ bấm Start với bot, dùng menu lấy Telegram ID để ghép, rồi menu
gửi thử. Thấy tin trên điện thoại mới đi tiếp.

**Bước 4 — ghép đủ 15 thợ**, rồi bật `TELEGRAM_BAT` lên `BAT`.

**Bước 5 — cài trigger nhắc.** Từ lúc này **phần nhắc đã chạy thật mà chưa cần deploy**, vì
trigger chạy bằng mã HEAD. Đây chính là phần chữa đúng bệnh quên gọi thợ. Chạy thử vài ngày,
xem nhật ký để biết bot đã nhắc bao nhiêu phiếu.

**Bước 6 — deploy.** Ghép vào lần deploy chủ nhật cùng ô tick "Máy chưa chạy lại được", theo
đúng mục 15 của `bao-tri-v2/CLAUDE.md`. Sau bước này mới có thông báo tức thì ngay lúc công
nhân báo sự cố. Deploy **luôn dùng đúng deployment ID đang có**, không tạo bản triển khai mới.

---

## 8. Kiểm thử

**Lớp 5 mới, chạy tại máy bằng node** (`kiemtra/thongbao.js`): ba hàm soạn tin, hàm quyết định
đã quá ngưỡng nhắc hay chưa, hàm chọn người còn lại để báo đã có người nhận. Đều là hàm thuần.

> Nhớ bẫy đã dính một lần: phải chạy bằng `vm.runInThisContext`, **không** `createContext`.
> Khác realm thì `Date` của khung test và `Date` của mã là hai constructor khác nhau, mọi
> `instanceof Date` trả về false và bộ test hoá ra chỉ kiểm thử chính cái khung.

**Trong `Test.gs`:** thêm mục kiểm thử với hàm gửi bị thay bằng hàm giả, canh đúng số tin và
đúng người nhận, và canh `reportIncident` vẫn trả `ok: true` khi hàm gửi ném lỗi.

> Nhớ bẫy thứ hai: ca kiểm thử chép làm hai bản ở `kiemtra/` và `Test.gs`. Sửa một bên quên
> bên kia thì bộ tại máy xanh mà bộ trong Sheet đỏ. Sửa ca nào thì sửa cả hai.

Sau khi thêm lớp 5, bộ kiểm thử trong Sheet thành **lớp 6**. Cập nhật lại phần đầu
`kiem-tra.ps1` và mục 14 của `bao-tri-v2/CLAUDE.md` cho khớp.

---

## 9. Điều đã cân nhắc và bác

| Bỏ | Vì sao |
|---|---|
| Gửi riêng người chính, kèm nút chuyển cho người phụ | Không có dữ liệu ai chính ai phụ, lịch trực lại luân phiên theo tuần. Xem mục 2 |
| Webhook `doPost` để nhận nút bấm từ Telegram | Phải deploy, và thêm cửa vào cho script đang phục vụ 175 máy |
| Nhắn vào một nhóm Telegram chung | Vứt đi thông tin ai đang trực mà hệ thống đã có. Thợ dễ nghĩ người khác lo rồi |
| Thêm cột `Nhac_Lan` vào `Su_Co` | `Nhat_Ky_Su_Co` chứa được, lại còn để lại vết kiểm chứng |
| Cất token trong `Cau_Hinh` | Ai xem được Sheet là cầm được token, nhắn tin được dưới danh nghĩa bot |
| Zalo thay cho Telegram | Zalo OA tốn tiền và cần xác minh doanh nghiệp. Chỉ quay lại nếu Telegram bị chặn |

---

## 10. Prompt mở chat mới

Mở chat trong thư mục repository, dán khối này.

```
Dự án: Hệ thống Bảo trì Toàn nhà máy v2, đang chạy thật ở nhà máy.

ĐỌC TRƯỚC KHI LÀM BẤT CỨ GÌ:
- CLAUDE.md, nhất là khối "BỐN VIỆC KHÔNG ĐƯỢC TỰ Ý LÀM".
- bao-tri-v2/CLAUDE.md, mục 6 danh bạ gọi thợ và mục 15 trạng thái hiện tại.
- TASK_THONG_BAO_TELEGRAM.md, toàn bộ. Phương án đã duyệt, đừng bàn lại.
  Mục 5 là rào an toàn, đọc kỹ nhất. Mục 6 là các bước thi công.

VIỆC: làm bot Telegram nhắc thợ, theo đúng TASK_THONG_BAO_TELEGRAM.md.
Bắt đầu từ bước B1 trong mục 6, hoặc từ bước tôi nói dưới đây.

RÀNG BUỘC:
- Không clasp push, không deploy. Chỉ commit và push GitHub, hỏi tôi trước khi push.
- Trước mỗi lần push chạy: powershell -File kiemtra\kiem-tra.ps1
- Trình bày phương án và chờ tôi duyệt trước khi sửa file đang chạy.
- Trả lời bằng tiếng Việt.

BƯỚC TÔI MUỐN LÀM LẦN NÀY: [điền, ví dụ B1 và B2]
```
