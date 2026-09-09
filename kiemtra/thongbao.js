/**
 * Chạy các phép thử NỘI DUNG TIN TELEGRAM ngay tại máy, không cần mở Google Sheet.
 *
 * Làm được vì mục 1, 2 và 3 của `ThongBao.gs` là hàm THUẦN — chỉ nhận mảng, chuỗi
 * và Date, không đọc sheet, không gọi mạng. Đó chính là lý do mục 4.1 của
 * `TASK_THONG_BAO_TELEGRAM.md` tách phần soạn tin khỏi phần gửi.
 *
 * Phần gửi thật (`guiTelegram_`, `telegramBat_`, `cauChiDangNgat_`,
 * `chatIdTheoMaTho_`) KHÔNG kiểm thử được ở đây vì nó gọi mạng và đọc sheet. Ca
 * kiểm thử cho nó dùng hàm gửi giả, nằm trong `Test.gs` ở bước B8.
 *
 * ⚠️ Khi thêm mục kiểm thử tương ứng vào `bao-tri-v2/Test.gs` ở bước B8, các ca
 * dưới đây thành bản SAO. Sửa kỳ vọng ở một bên mà quên bên kia thì file này vẫn
 * xanh trong khi bộ test trong Sheet đỏ — đã dính đúng một lần ngày 03/09/2026
 * với `kpi-tho.js`. Sửa ca nào thì sửa CẢ HAI chỗ rồi chạy lại cả hai.
 *
 * Dùng:  node kiemtra/thongbao.js bao-tri-v2
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const duAn = process.argv[2];
// Cần cả Code.gs vì ThongBao.gs tra cột bằng `COT`, mà `COT` dựng từ HEADER_SU_CO.
const nguon = ['Code.gs', 'ThongBao.gs']
  .map(function (f) { return fs.readFileSync(path.join(duAn, f), 'utf8'); })
  .join('\n;\n');

// `const` ở cấp cao nhất là khai báo lexical, KHÔNG gắn vào object global — phải
// kéo ra bằng một dòng nối vào cuối chính script đó.
const XUAT = ';globalThis.__ra = { soanTinSuCoMoi_, soanTinDaNhan_, soanTinNhac_,' +
  ' gioVN_, chuoi_, phutGiua_, ghepDong_, ghepKhoi_, tenMayDayDu_,' +
  ' chuanHoaChatId_, catTin_, nenBatCauChi_, gomChatIdTuUpdates_, locNguoiNhan_,' +
  ' TELEGRAM, COT, HEADER_SU_CO, HEADER_THO };';

// Chạy trong CHÍNH realm này. Nếu tạo context riêng thì Date của khung test và
// Date của code là hai constructor khác nhau, mọi `instanceof Date` bên trong
// code sẽ sai bét — `gioVN_` và `phutGiua_` đều dựa vào phép thử đó, nên bộ test
// sẽ hoá ra kiểm thử cái khung chứ không kiểm thử code.
vm.runInThisContext(nguon + XUAT, { filename: 'gop.gs' });
const G = globalThis.__ra;

let dat = 0;
const loi = [];
function bang(ten, thucTe, mongDoi) {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi);
  if (a === b) { dat++; return; }
  loi.push('✗ ' + ten + '\n    mong đợi: ' + b + '\n    thực tế : ' + a);
}
function chua(ten, chuoi, manh) {
  if (String(chuoi).indexOf(manh) >= 0) { dat++; return; }
  loi.push('✗ ' + ten + '\n    không tìm thấy: ' + JSON.stringify(manh) +
    '\n    trong        : ' + JSON.stringify(chuoi));
}
function khongChua(ten, chuoi, manh) {
  if (String(chuoi).indexOf(manh) < 0) { dat++; return; }
  loi.push('✗ ' + ten + '\n    KHÔNG được có: ' + JSON.stringify(manh) +
    '\n    nhưng có trong: ' + JSON.stringify(chuoi));
}

const luc = function (s) { return new Date(s + ':00+07:00'); };
const phieu = function (o) {
  const v = new Array(G.HEADER_SU_CO.length).fill('');
  Object.keys(o).forEach(function (k) { v[G.COT[k]] = o[k]; });
  return v;
};

// Phiếu mẫu dùng lại nhiều lần — đúng bộ dữ liệu của ví dụ ở mục 4.3.
const mau = {
  Ma_Su_Co: 'SC-0909-014', Ma_May: 'DET12', Ten_May: 'MÁY DỆT 12', Bo_Phan: 'DET',
  Nhom_Loi: 'Lỗi cơ khí', Mo_Ta: 'Máy kêu to rồi dừng đột ngột',
  Thoi_Gian_Bao: luc('2026-09-09T14:32'),
  Ten_Tho: 'Nhân', Thoi_Gian_Nhan: luc('2026-09-09T14:35'),
};
const LINK = 'https://khangdang0703-lab.github.io/baocao-saphia/baotri.html?tho=TH01&token=abc';

// ============================================================================
// 1. CANH RANH GIỚI HÀM THUẦN — chạy TRƯỚC mọi ca khác
// ============================================================================
//
// Đây là ca quan trọng nhất của cả file. Phần gửi thật nằm trong CHÍNH
// `ThongBao.gs` này, từ mục 4 trở xuống, và nó có `UrlFetchApp`, `CacheService`,
// `PropertiesService`, `SpreadsheetApp`. Kéo một lời gọi như vậy ngược lên nhóm
// hàm thuần là cả bộ kiểm thử tại máy chết ngay, mà lý do sẽ khó đọc. Ca này
// chạy trước mọi ca khác nên nó nói ra vấn đề trước khi ca đầu tiên kịp nổ.
//
// Cố ý soi mã nguồn của TỪNG HÀM chứ không grep cả file — grep cả file thì mục 4
// và mục 5 của `ThongBao.gs` bị báo đỏ oan.
const CAM = ['UrlFetchApp', 'SpreadsheetApp', 'CacheService', 'PropertiesService',
  'Utilities', 'LockService', 'SHEET.'];
const PHAI_THUAN = ['soanTinSuCoMoi_', 'soanTinDaNhan_', 'soanTinNhac_',
  'gioVN_', 'chuoi_', 'phutGiua_', 'ghepDong_', 'ghepKhoi_', 'tenMayDayDu_',
  'chuanHoaChatId_', 'catTin_', 'nenBatCauChi_', 'gomChatIdTuUpdates_',
  'locNguoiNhan_'];
const hetThuan = [];
PHAI_THUAN.forEach(function (ten) {
  const ma = String(G[ten]);
  CAM.forEach(function (cam) {
    if (ma.indexOf(cam) < 0) { dat++; return; }
    hetThuan.push('✗ ' + ten + ' hết thuần: có gọi ' + cam + '\n' +
      '    Nhóm hàm soạn tin phải chạy được bằng node. Đưa lời gọi đó ra hàm khác.');
  });
});

// In và DỪNG ngay tại đây, không gom vào phần kết luận ở cuối file. Hàm đã mất
// tính thuần thì ca đầu tiên gọi tới nó sẽ ném ReferenceError và node in ra vết
// gọi khó đọc, che mất lời giải thích ở trên.
if (hetThuan.length) {
  hetThuan.forEach(function (x) { console.log(x); });
  console.log('=> ' + hetThuan.length + ' hàm soạn tin đã hết thuần, dừng tại đây.');
  process.exit(1);
}

// ============================================================================
// 2. HÀM PHỤ
// ============================================================================

// Việt Nam không có giờ mùa hè nên +07:00 là hằng số, không phải xấp xỉ.
bang('gioVN_ đổi đúng mốc UTC sang giờ Việt Nam',
  G.gioVN_(new Date('2026-09-09T07:32:00Z')), '14:32');
bang('gioVN_ vắt qua nửa đêm — 18:30Z là 01:30 hôm sau',
  G.gioVN_(new Date('2026-09-09T18:30:00Z')), '01:30');
bang('gioVN_ pad đủ hai chữ số', G.gioVN_(luc('2026-09-09T07:05')), '07:05');
bang('gioVN_ với ô trống trả rỗng, không văng lỗi', G.gioVN_(''), '');
bang('gioVN_ với chuỗi trả rỗng', G.gioVN_('2026-09-09'), '');
bang('gioVN_ với Date hỏng trả rỗng', G.gioVN_(new Date('xxx')), '');

bang('chuoi_ cắt khoảng trắng', G.chuoi_('  a  '), 'a');
bang('chuoi_ với null ra rỗng', G.chuoi_(null), '');
bang('chuoi_ với undefined ra rỗng', G.chuoi_(undefined), '');
bang('chuoi_ với số 0 ra "0" chứ không rỗng', G.chuoi_(0), '0');

bang('phutGiua_ tính đúng số phút',
  G.phutGiua_(luc('2026-09-09T14:32'), luc('2026-09-09T14:52')), 20);
bang('phutGiua_ làm tròn xuống',
  G.phutGiua_(new Date('2026-09-09T07:00:00Z'), new Date('2026-09-09T07:20:59Z')), 20);
// In ra số âm là người đọc mất tin tưởng vào cả cái bot.
bang('phutGiua_ giờ ngược nhau trả 0, không trả âm',
  G.phutGiua_(luc('2026-09-09T15:00'), luc('2026-09-09T14:00')), 0);
bang('phutGiua_ thiếu mốc đầu trả 0', G.phutGiua_('', luc('2026-09-09T14:00')), 0);
bang('phutGiua_ thiếu mốc cuối trả 0', G.phutGiua_(luc('2026-09-09T14:00'), ''), 0);

bang('ghepDong_ bỏ dòng rỗng', G.ghepDong_(['a', '', 'b']), 'a\nb');
bang('ghepKhoi_ cách khối bằng dòng trắng', G.ghepKhoi_(['a', 'b']), 'a\n\nb');
bang('ghepKhoi_ khối rỗng thì bỏ luôn dòng trắng', G.ghepKhoi_(['a', '', 'b']), 'a\n\nb');

bang('tenMayDayDu_ ghép tên và bộ phận',
  G.tenMayDayDu_(phieu(mau)), 'MÁY DỆT 12 (DET)');
bang('tenMayDayDu_ thiếu bộ phận thì bỏ cặp ngoặc',
  G.tenMayDayDu_(phieu({ Ten_May: 'MÁY DỆT 12' })), 'MÁY DỆT 12');
bang('tenMayDayDu_ thiếu tên máy thì lùi về mã máy',
  G.tenMayDayDu_(phieu({ Ma_May: 'DET12', Bo_Phan: 'DET' })), 'DET12 (DET)');

// ============================================================================
// 3. TIN SỰ CỐ MỚI
// ============================================================================

// Ca này canh NGUYÊN VĂN cả tin, đối chiếu thẳng với mẫu ở mục 4.3. Các ca sau
// chỉ canh từng mảnh, nên phải có một ca canh trọn vẹn để bắt lỗi thứ tự dòng.
bang('Tin sự cố đầy đủ khớp nguyên văn mẫu mục 4.3',
  G.soanTinSuCoMoi_(phieu(mau), LINK),
  '🔴 MÁY DỆT 12 (DET) đã dừng\n' +
  'Lỗi cơ khí\n' +
  '"Máy kêu to rồi dừng đột ngột"\n' +
  'Báo lúc 14:32 · phiếu SC-0909-014\n' +
  '\n' +
  '➡️ Bấm để nhận việc: ' + LINK);

// Phiếu DUNG_MAY không có nhóm lỗi. In ra dòng trắng là tin trông như lỗi hiển thị.
const khongNhomLoi = Object.assign({}, mau); delete khongNhomLoi.Nhom_Loi;
bang('Thiếu nhóm lỗi thì rụng đúng dòng đó, không để dòng trắng',
  G.soanTinSuCoMoi_(phieu(khongNhomLoi), ''),
  '🔴 MÁY DỆT 12 (DET) đã dừng\n' +
  '"Máy kêu to rồi dừng đột ngột"\n' +
  'Báo lúc 14:32 · phiếu SC-0909-014');

const khongMoTa = Object.assign({}, mau); delete khongMoTa.Mo_Ta;
khongChua('Thiếu mô tả thì không in cặp nháy rỗng',
  G.soanTinSuCoMoi_(phieu(khongMoTa), ''), '""');

// Thợ chưa ghép link là bình thường, không phải lỗi — rào 5.4.
khongChua('Thiếu link thì không in dòng bấm nhận việc',
  G.soanTinSuCoMoi_(phieu(mau), ''), 'Bấm để nhận việc');
khongChua('Thiếu link thì cũng không để lại dòng trắng ở cuối',
  G.soanTinSuCoMoi_(phieu(mau), ''), '\n\n');
chua('Có link thì in nguyên vẹn, không cắt query string',
  G.soanTinSuCoMoi_(phieu(mau), LINK), LINK);

const khongGio = Object.assign({}, mau); delete khongGio.Thoi_Gian_Bao;
chua('Thiếu giờ báo thì vẫn in mã phiếu, bỏ chữ "Báo lúc"',
  G.soanTinSuCoMoi_(phieu(khongGio), ''), 'phiếu SC-0909-014');
khongChua('Thiếu giờ báo thì không in "Báo lúc" cụt đuôi',
  G.soanTinSuCoMoi_(phieu(khongGio), ''), 'Báo lúc');
khongChua('Thiếu giờ báo thì không để lại dấu chấm giữa lơ lửng',
  G.soanTinSuCoMoi_(phieu(khongGio), ''), ' · ');

// Tin gửi văn bản trơn, cố ý KHÔNG dùng parse_mode. Ca này canh đúng điều đó:
// mô tả do công nhân gõ tay phải đi thẳng vào tin, không bị thoát, không bị cắt.
// Bật Markdown hay HTML lên là Telegram trả lỗi 400 hoặc hiển thị sai.
const goTay = Object.assign({}, mau, { Mo_Ta: 'Kêu to <lắm> *gấp* _cần_ sửa' });
chua('Ký tự đặc biệt trong mô tả giữ nguyên văn — tin là văn bản trơn',
  G.soanTinSuCoMoi_(phieu(goTay), ''), '"Kêu to <lắm> *gấp* _cần_ sửa"');

// ============================================================================
// 4. TIN ĐÃ CÓ NGƯỜI NHẬN
// ============================================================================

bang('Tin đã nhận khớp nguyên văn mẫu mục 4.3',
  G.soanTinDaNhan_(phieu(mau)),
  '✅ Nhân đã nhận SC-0909-014 lúc 14:35. Bạn không cần xử lý.');

const khuyetTho = Object.assign({}, mau); delete khuyetTho.Ten_Tho;
chua('Thiếu tên thợ thì vẫn báo được, không in tên rỗng',
  G.soanTinDaNhan_(phieu(khuyetTho)), 'Một thợ khác đã nhận SC-0909-014');

const khuyetGioNhan = Object.assign({}, mau); delete khuyetGioNhan.Thoi_Gian_Nhan;
bang('Thiếu giờ nhận thì bỏ hẳn vế "lúc", câu vẫn trọn',
  G.soanTinDaNhan_(phieu(khuyetGioNhan)),
  '✅ Nhân đã nhận SC-0909-014. Bạn không cần xử lý.');

// ============================================================================
// 5. TIN NHẮC
// ============================================================================

const nhac1 = G.soanTinNhac_(phieu(mau), 1, luc('2026-09-09T14:52'), LINK, '0912345678');
const nhac2 = G.soanTinNhac_(phieu(mau), 2, luc('2026-09-09T15:12'), LINK, '0912345678');

chua('Nhắc lần 1 có nhãn riêng', nhac1, '⏰ Nhắc lần 1 — MÁY DỆT 12 (DET)');
chua('Nhắc lần 2 gắt hơn hẳn', nhac2, '🚨 CHƯA AI NHẬN — MÁY DỆT 12 (DET)');
chua('Nhắc lần 1 nêu số phút máy nằm im', nhac1, 'Máy đã nằm im 20 phút.');
chua('Nhắc lần 2 nêu số phút đã cộng thêm', nhac2, 'Máy đã nằm im 40 phút.');
chua('Nhắc nào cũng kèm link nhận việc', nhac1, '➡️ Bấm để nhận việc: ' + LINK);

// Lớp 3 ở mục 4.4: số khẩn cấp chỉ xuất hiện ở lần nhắc thứ hai. Đưa ra sớm là
// mất hết sức nặng của nó.
khongChua('Nhắc lần 1 KHÔNG kèm số khẩn cấp dù có truyền vào', nhac1, '0912345678');
chua('Nhắc lần 2 kèm số khẩn cấp', nhac2, '☎️ Không xử lý được thì gọi số khẩn cấp: 0912345678');
khongChua('Chưa khai số khẩn cấp thì lần 2 cũng không in dòng đó',
  G.soanTinNhac_(phieu(mau), 2, luc('2026-09-09T15:12'), LINK, ''), '☎️');

bang('Nhắc lần 2 không link không số khẩn cấp thì không để dòng trắng thừa',
  G.soanTinNhac_(phieu(mau), 2, luc('2026-09-09T15:12'), '', ''),
  '🚨 CHƯA AI NHẬN — MÁY DỆT 12 (DET)\n' +
  'Phiếu SC-0909-014 vẫn chưa có thợ nhận.\n' +
  'Máy đã nằm im 40 phút.');

// `lan` đi từ cấu hình/sheet nên có thể về dạng chuỗi.
chua('lan là chuỗi "2" vẫn hiểu là lần 2',
  G.soanTinNhac_(phieu(mau), '2', luc('2026-09-09T15:12'), '', '0912345678'), '🚨');

chua('Thiếu mã phiếu thì câu vẫn trọn',
  G.soanTinNhac_(phieu({ Ten_May: 'MÁY SOI 4' }), 1, luc('2026-09-09T15:12'), ''),
  'Phiếu vẫn chưa có thợ nhận.');
chua('Thiếu giờ báo thì số phút là 0, không văng lỗi',
  G.soanTinNhac_(phieu({ Ma_Su_Co: 'SC-1' }), 1, luc('2026-09-09T15:12'), ''),
  'Máy đã nằm im 0 phút.');

// ============================================================================
// 6. HÀM THUẦN PHỤC VỤ PHẦN GỬI
// ============================================================================

// Chat id nhóm và kênh mang số ÂM — chặn dấu trừ là bot không nhắn được vào nhóm.
bang('chuanHoaChatId_ nhận id thường', G.chuanHoaChatId_('123456789'), '123456789');
bang('chuanHoaChatId_ nhận id âm của nhóm', G.chuanHoaChatId_('-1001234567890'), '-1001234567890');
bang('chuanHoaChatId_ cắt khoảng trắng', G.chuanHoaChatId_('  123456789 '), '123456789');
bang('chuanHoaChatId_ nhận cả ô Sheets đọc ra số', G.chuanHoaChatId_(123456789), '123456789');
// Ô trống là thợ chưa ghép — bình thường, không phải lỗi (rào 5.4).
bang('chuanHoaChatId_ ô trống ra rỗng', G.chuanHoaChatId_(''), '');
bang('chuanHoaChatId_ ô null ra rỗng', G.chuanHoaChatId_(null), '');
// Người dùng dán đè định dạng thì Sheets đọc số lớn ra dạng mũ. Gửi tới một id
// đã bị làm tròn là nhắn nhầm người khác, nên thà không gửi.
bang('chuanHoaChatId_ chặn dạng mũ của Sheets', G.chuanHoaChatId_('1.23457E+11'), '');
bang('chuanHoaChatId_ chặn chữ lẫn vào', G.chuanHoaChatId_('12345abc'), '');
bang('chuanHoaChatId_ chặn tên người dùng', G.chuanHoaChatId_('@nhan_tho'), '');

bang('catTin_ giữ nguyên tin ngắn', G.catTin_('abc', 10), 'abc');
bang('catTin_ giữ nguyên tin đúng bằng giới hạn', G.catTin_('abcde', 5), 'abcde');
// Vượt 4096 ký tự thì Telegram trả 400 và mất TRỌN tin — thợ không nhận được gì.
bang('catTin_ cắt tin quá dài và đánh dấu bị cắt', G.catTin_('abcdefgh', 5), 'abcd…');
bang('catTin_ với chuỗi rỗng', G.catTin_('', 10), '');
bang('catTin_ với null ra rỗng', G.catTin_(null, 10), '');
bang('catTin_ mặc định 4000 ký tự', G.catTin_(new Array(5000).join('x')).length, 4000);

// Hai kiểu hỏng, hai cách xử. 429 và 5xx là hỏng phía hệ thống — gọi tiếp cũng
// hỏng, mỗi lần gọi là một người phải chờ.
bang('nenBatCauChi_ bật khi bị chặn tốc độ', G.nenBatCauChi_([200, 429]), true);
bang('nenBatCauChi_ bật khi Telegram lỗi 500', G.nenBatCauChi_([500]), true);
bang('nenBatCauChi_ bật khi 503', G.nenBatCauChi_([200, 200, 503]), true);
// 400 và 403 là hỏng ở MỘT chat id: ghép nhầm, hoặc thợ chưa bấm Start với bot.
// Bật cầu chì vì chuyện đó là cắt tin của cả 14 người còn lại.
bang('nenBatCauChi_ KHÔNG bật vì một chat id sai', G.nenBatCauChi_([200, 400]), false);
bang('nenBatCauChi_ KHÔNG bật vì thợ chưa bấm Start', G.nenBatCauChi_([403]), false);
bang('nenBatCauChi_ không bật khi mọi tin đều đi được', G.nenBatCauChi_([200, 200]), false);
bang('nenBatCauChi_ mảng rỗng thì không tự bật', G.nenBatCauChi_([]), false);
bang('nenBatCauChi_ không tham số thì không văng lỗi', G.nenBatCauChi_(), false);

// ============================================================================
// 7. CỘT TELEGRAM_CHAT_ID TRONG DANH_MUC_THO
// ============================================================================
//
// Cột bổ sung phải nằm đúng CUỐI `HEADER_THO`. Chèn vào giữa là xô lệch mọi dữ
// liệu đã ghi của 13 thợ, và hai hàm `refreshPersonalLinks` / `chuanBiDanhMuc`
// vốn đọc rồi ghi lại trọn khối theo chỉ số cột sẽ ghi nhầm ô.

bang('Telegram_Chat_ID nằm đúng cuối HEADER_THO',
  G.HEADER_THO[G.HEADER_THO.length - 1], 'Telegram_Chat_ID');
bang('Danh_Muc_Tho đúng 10 cột', G.HEADER_THO.length, 10);
// Sheet mặc định rộng 26 cột nên đọc/ghi 10 cột vẫn trong vùng — rào 5.3.
bang('Danh_Muc_Tho chưa chạm giới hạn 26 cột mặc định',
  G.HEADER_THO.length <= 26, true);
// Tên cột phải khớp giữa hai nơi, nếu không chatIdTheoMaTho_ đọc ra rỗng hết
// mà không báo lỗi gì cả.
bang('Tên cột trong hằng TELEGRAM khớp với HEADER_THO',
  G.HEADER_THO.indexOf(G.TELEGRAM.COT_CHAT_ID) >= 0, true);

// ============================================================================
// 8. ĐỌC KẾT QUẢ getUpdates
// ============================================================================
//
// JSON của Telegram lồng ba tầng và mỗi bản cập nhật có thể là `message`,
// `edited_message` hay thứ khác. Tra sai một tầng là ra danh sách rỗng mà không
// có lỗi nào để lần — người bấm menu sẽ tưởng thợ chưa nhắn cho bot.

const up = function (ds) { return { ok: true, result: ds }; };

bang('Bóc được chat id và tên',
  G.gomChatIdTuUpdates_(up([
    { message: { chat: { id: 123456789, first_name: 'Nhân', last_name: 'Trần',
      username: 'nhan_tho' } } },
  ])),
  [{ id: '123456789', ten: 'Nhân Trần', username: 'nhan_tho' }]);

// Người nhắn 5 tin vẫn chỉ hiện một dòng, nếu không danh sách ghép tay sẽ dài
// gấp mấy lần số người và rất dễ chép nhầm dòng.
bang('Mỗi chat id chỉ hiện một lần dù nhắn nhiều tin',
  G.gomChatIdTuUpdates_(up([
    { message: { chat: { id: 111, first_name: 'A' } } },
    { message: { chat: { id: 111, first_name: 'A' } } },
    { message: { chat: { id: 222, first_name: 'B' } } },
  ])).length, 2);

bang('Đọc được cả edited_message',
  G.gomChatIdTuUpdates_(up([{ edited_message: { chat: { id: 333, first_name: 'C' } } }]))[0].id,
  '333');
bang('Thiếu họ thì chỉ lấy tên',
  G.gomChatIdTuUpdates_(up([{ message: { chat: { id: 444, first_name: 'Nhị' } } }]))[0].ten,
  'Nhị');
bang('Không có tên thì lùi về title của nhóm',
  G.gomChatIdTuUpdates_(up([{ message: { chat: { id: 555, title: 'Tổ điện' } } }]))[0].ten,
  'Tổ điện');
bang('Không username thì để rỗng, không ra undefined',
  G.gomChatIdTuUpdates_(up([{ message: { chat: { id: 666, first_name: 'D' } } }]))[0].username,
  '');

// Bản cập nhật lạ không được làm hỏng cả danh sách.
bang('Bản cập nhật không phải tin nhắn thì bỏ qua',
  G.gomChatIdTuUpdates_(up([{ poll: { id: 'x' } }, { message: { chat: { id: 777 } } }])).length, 1);
bang('Bản cập nhật rỗng thì bỏ qua', G.gomChatIdTuUpdates_(up([null, {}])).length, 0);
bang('Kết quả rỗng ra mảng rỗng', G.gomChatIdTuUpdates_(up([])), []);
bang('Không có trường result thì ra mảng rỗng', G.gomChatIdTuUpdates_({ ok: true }), []);
bang('Không tham số thì không văng lỗi', G.gomChatIdTuUpdates_(), []);

// ============================================================================
// 9. CHỌN NGƯỜI NHẬN TIN
// ============================================================================
//
// Ba phép loại trừ, sai cái nào cũng không có lỗi nào để lần: nhắn cho số khẩn
// cấp là nhắn vào hư vô, nhắn cho người chưa ghép id là gửi hỏng, nhắn lại cho
// chính người vừa bấm nhận là làm phiền đúng người đang chạy tới máy.

const danhBaGia = function (ds) { return { ds: ds }; };
const llMau = {
  TH01: { chatId: '111', link: 'https://x/?tho=TH01' },
  TH02: { chatId: '222', link: 'https://x/?tho=TH02' },
};

bang('Lấy đúng chat id và link của từng người',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH01' }, { maTho: 'TH02' }]), llMau, ''),
  [{ maTho: 'TH01', chatId: '111', link: 'https://x/?tho=TH01' },
   { maTho: 'TH02', chatId: '222', link: 'https://x/?tho=TH02' }]);

// Số khẩn cấp nằm CUỐI danh bạ với khanCap:true và maTho rỗng. Nó là một số
// điện thoại, không phải một thợ, không có Telegram.
bang('Bỏ số khẩn cấp ở cuối danh bạ',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH01' },
    { maTho: '', tenTho: 'Khang', khanCap: true }]), llMau, '').length, 1);

// Ghép chat id cho 15 thợ làm dần — rào 5.4, ai chưa có thì im lặng bỏ qua.
bang('Bỏ người chưa ghép chat id',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH01' }, { maTho: 'TH09' }]), llMau, '')
    .map(function (n) { return n.maTho; }), ['TH01']);

bang('Bỏ chính người vừa bấm nhận',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH01' }, { maTho: 'TH02' }]), llMau, 'TH01')
    .map(function (n) { return n.maTho; }), ['TH02']);
bang('Bỏ người vừa nhận xong thì không còn ai — không gửi tin nào',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH01' }]), llMau, 'TH01'), []);

bang('Một người lọt vào danh bạ hai lần chỉ nhận một tin',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH01' }, { maTho: 'TH01' }]), llMau, '').length, 1);

// Thợ có chat id nhưng chưa sinh link cá nhân: vẫn gửi, tin tự rụng dòng bấm
// nhận việc. Biết máy hỏng vẫn hơn không biết gì.
bang('Thiếu link vẫn gửi, link để rỗng',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH03' }]), { TH03: { chatId: '333' } }, ''),
  [{ maTho: 'TH03', chatId: '333', link: '' }]);

bang('Danh bạ rỗng ra mảng rỗng', G.locNguoiNhan_(danhBaGia([]), llMau, ''), []);
bang('Danh bạ nấc 3 không có ai', G.locNguoiNhan_(null, llMau, ''), []);
bang('Map liên lạc rỗng ra mảng rỗng',
  G.locNguoiNhan_(danhBaGia([{ maTho: 'TH01' }]), {}, ''), []);
bang('Không tham số nào thì không văng lỗi', G.locNguoiNhan_(), []);

loi.forEach(function (x) { console.log(x); });
console.log(loi.length
  ? '=> ' + loi.length + ' phép thử nội dung tin KHÔNG đạt'
  : '=> ' + dat + ' phép thử nội dung tin đạt.');
process.exit(loi.length ? 1 : 0);
