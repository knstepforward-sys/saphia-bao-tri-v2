/**
 * Chạy các phép thử KPI đáp ứng thợ NGAY TẠI MÁY, không cần mở Google Sheet.
 *
 * Bộ test logic đầy đủ (`Test.gs`) chỉ chạy được trong Apps Script vì đụng tới
 * `Utilities`, `SpreadsheetApp`… Nhưng riêng nhóm hàm KPI thì THUẦN — chỉ nhận
 * mảng và Date — nên nạp thẳng ba file `.gs` vào node là chạy được. Nhờ vậy sai
 * số học bị bắt ngay lúc sửa code, thay vì đợi tới lượt bấm menu trong Sheet.
 *
 * Có cả 2000 ca ngẫu nhiên để canh đẳng thức `đáp ứng = bận + KPI` — thứ mà vài
 * ca viết tay không bao giờ phủ hết được.
 *
 * ⚠️ Các ca dưới đây là bản SAO của mục 8b trong `bao-tri-v2/Test.gs`. Sửa kỳ vọng
 * ở một bên mà quên bên kia thì file này vẫn xanh trong khi bộ test trong Sheet đỏ
 * — đã dính đúng một lần ngày 03/09/2026 (kỳ vọng chuỗi `KHONG — …`). Sửa ca nào
 * thì sửa CẢ HAI chỗ rồi chạy lại cả hai.
 *
 * Dùng:  node kiemtra/kpi-tho.js bao-tri-v2
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const duAn = process.argv[2];
const nguon = ['Code.gs', 'LuongTho.gs', 'XuatBaoCao.gs']
  .map(function (f) { return fs.readFileSync(path.join(duAn, f), 'utf8'); })
  .join('\n;\n');

// `const` ở cấp cao nhất là khai báo lexical, KHÔNG gắn vào object global — phải
// kéo ra bằng một dòng nối vào cuối chính script đó.
const XUAT = ';globalThis.__ra = { phutBanTrongCho_, kpiThoChoPhieu_, tinhDapUng_,' +
  ' phanVi_, tyLe_, dichNgay_, soSanhKy_, dsNgayTrongKy_,' +
  ' TRANG_THAI, LOAI_PHIEU, COT, HEADER_SU_CO };';

// Chạy trong CHÍNH realm này. Nếu tạo context riêng thì Date của khung test và
// Date của code là hai constructor khác nhau, mọi `instanceof Date` bên trong
// code sẽ sai bét — test hoá ra kiểm thử cái khung chứ không kiểm thử code.
vm.runInThisContext(nguon + XUAT, { filename: 'gop.gs' });
const G = globalThis.__ra;

let dat = 0;
const loi = [];
function bang(ten, thucTe, mongDoi) {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi);
  if (a === b) { dat++; return; }
  loi.push('✗ ' + ten + '\n    mong đợi: ' + b + '\n    thực tế : ' + a);
}
const luc = function (s) { return new Date(s + ':00+07:00'); };
const phieu = function (o) {
  const v = new Array(G.HEADER_SU_CO.length).fill('');
  Object.keys(o).forEach(function (k) { v[G.COT[k]] = o[k]; });
  return { dong: 0, v: v };
};

const phutBanTrongCho_ = G.phutBanTrongCho_;
const kpiThoChoPhieu_ = G.kpiThoChoPhieu_;
const tinhDapUng_ = G.tinhDapUng_;
const TRANG_THAI = G.TRANG_THAI;
const LOAI_PHIEU = G.LOAI_PHIEU;

// --- Ca 1: bận nhiều đoạn rời — chỗ cách cũ tính rộng tay --------------------
const banDoan1 = phieu({ Ma_Su_Co: 'SC-A', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
  Thoi_Gian_Nhan: luc('2026-08-03T08:50'), Thoi_Gian_Hoan_Thanh: luc('2026-08-03T09:10') });
const banDoan2 = phieu({ Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
  Thoi_Gian_Nhan: luc('2026-08-03T09:30'), Thoi_Gian_Hoan_Thanh: luc('2026-08-03T09:50') });
const haiDoan = [banDoan1, banDoan2];
const bao10 = luc('2026-08-03T09:00');
const nhan10 = luc('2026-08-03T10:00');

const roi = phutBanTrongCho_(haiDoan, 'TH02', 'SC-2', bao10, nhan10);
bang('Hai đoạn bận rời — bận thực tế 10 + 20', roi.phutBan, 30);
bang('Hai đoạn bận rời — đếm đúng 2 đoạn', roi.soDoan, 2);
bang('Cách cũ miễn trừ rộng hơn — đây là lý do phải vá',
  tinhDapUng_(haiDoan, 'TH02', 'SC-2', bao10, nhan10).thuc, 10);

const phieuRoi = phieu({ Ma_Su_Co: 'SC-2', Ma_Tho: 'TH02',
  Thoi_Gian_Bao: bao10, Thoi_Gian_Nhan: nhan10 }).v;
const kRoi = kpiThoChoPhieu_(haiDoan, phieuRoi, 0);
bang('Hai đoạn bận rời — KPI thợ 30 phút', kRoi.phutKpi, 30);
bang('Đáp ứng = bận thực tế + KPI thợ', kRoi.phutBan + kRoi.phutKpi, 60);

// --- Ca 2: một đoạn bận trùm đầu — phải khớp y hệt số cũ --------------------
const phieuMotDoan = phieu({ Ma_Su_Co: 'SC-2', Ma_Tho: 'TH02',
  Thoi_Gian_Bao: luc('2026-08-03T09:00'), Thoi_Gian_Nhan: luc('2026-08-03T09:32') }).v;
const banTrum = phieu({ Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
  Thoi_Gian_Nhan: luc('2026-08-03T08:50'), Thoi_Gian_Hoan_Thanh: luc('2026-08-03T09:30') });
bang('Một đoạn bận trùm đầu — KPI khớp y hệt cách cũ',
  kpiThoChoPhieu_([banTrum], phieuMotDoan, 0).phutKpi,
  tinhDapUng_([banTrum], 'TH02', 'SC-2',
    luc('2026-08-03T09:00'), luc('2026-08-03T09:32')).thuc);
bang('Một đoạn bận trùm đầu — chỉ 1 đoạn',
  kpiThoChoPhieu_([banTrum], phieuMotDoan, 0).soDoan, 1);

// --- Ca 3: nhận việc cũ SAU lúc máy này báo — chỗ rộng tay thứ hai ----------
const viecCu = phieu({ Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
  Thoi_Gian_Bao: luc('2026-08-03T09:00'), Thoi_Gian_Nhan: luc('2026-08-03T09:02'),
  Thoi_Gian_Hoan_Thanh: luc('2026-08-03T09:30') });
bang('Nhận việc cũ sau lúc báo — cách cũ chỉ tính thợ 2 phút',
  tinhDapUng_([viecCu], 'TH02', 'SC-2',
    luc('2026-08-03T09:00'), luc('2026-08-03T09:32')).thuc, 2);
bang('Nhận việc cũ sau lúc báo — cách mới tính đủ 4 phút',
  kpiThoChoPhieu_([viecCu], phieuMotDoan, 0).phutKpi, 4);

// --- Ca 4: thợ rảnh hẳn / đang ôm việc dở ----------------------------------
const kRanh = kpiThoChoPhieu_([], phieuMotDoan, 0);
bang('Thợ rảnh — không đoạn bận nào', kRanh.soDoan, 0);
bang('Thợ rảnh — KPI bằng cả 32 phút', kRanh.phutKpi, 32);
const dangOm = phieu({ Ma_Su_Co: 'SC-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.DANG_XU_LY,
  Thoi_Gian_Nhan: luc('2026-08-03T08:40') });
bang('Đang ôm việc dở — KPI bằng 0',
  kpiThoChoPhieu_([dangOm], phieuMotDoan, 0).phutKpi, 0);

// --- Ca 5: việc chung miễn trừ, bảo trì thì không --------------------------
const camera = phieu({ Ma_Su_Co: 'CV-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
  Loai_Phieu: LOAI_PHIEU.CONG_VIEC,
  Thoi_Gian_Nhan: luc('2026-08-03T09:00'), Thoi_Gian_Hoan_Thanh: luc('2026-08-03T11:00') });
bang('Việc chung vẫn miễn trừ cho thợ',
  phutBanTrongCho_([camera], 'TH02', 'SC-2',
    luc('2026-08-03T09:30'), luc('2026-08-03T11:02')).phutBan, 90);
const baoTri = phieu({ Ma_Su_Co: 'BT-1', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
  Loai_Phieu: LOAI_PHIEU.BAO_TRI, Thoi_Gian_Hoan_Thanh: luc('2026-08-03T09:10') });
bang('Bảo trì vẫn không làm thợ "bận"',
  phutBanTrongCho_([baoTri], 'TH02', 'SC-2', bao10, nhan10).phutBan, 0);

// --- Ca 6: tính lúc nhận và tính lại sau phải ra CÙNG số -------------------
const conMo = phieu({ Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.DANG_XU_LY,
  Thoi_Gian_Nhan: luc('2026-08-03T09:30') });
const dongMuon = phieu({ Ma_Su_Co: 'SC-B', Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
  Thoi_Gian_Nhan: luc('2026-08-03T09:30'), Thoi_Gian_Hoan_Thanh: luc('2026-08-03T10:20') });
bang('Tính lúc nhận và tính lại sau cho cùng số phút',
  [phutBanTrongCho_([banDoan1, conMo], 'TH02', 'SC-2', bao10, nhan10).phutBan,
    phutBanTrongCho_([banDoan1, dongMuon], 'TH02', 'SC-2', bao10, nhan10).phutBan],
  [40, 40]);

// --- Ca 7: phiếu nào bị loại khỏi KPI, và vì sao ---------------------------
bang('Việc chung không vào KPI',
  kpiThoChoPhieu_([], phieu({ Ma_Su_Co: 'CV-1', Ma_Tho: 'TH02',
    Loai_Phieu: LOAI_PHIEU.CONG_VIEC }).v, 0).apDung, 'KHONG — phiếu CONG_VIEC');
bang('Bảo trì không vào KPI',
  kpiThoChoPhieu_([], phieu({ Ma_Su_Co: 'BT-1', Ma_Tho: 'TH02',
    Loai_Phieu: LOAI_PHIEU.BAO_TRI }).v, 0).apDung, 'KHONG — phiếu BAO_TRI');
bang('Phiếu chưa ai nhận không vào KPI',
  kpiThoChoPhieu_([], phieu({ Ma_Su_Co: 'SC-3' }).v, 0).apDung, 'KHONG — chưa ai nhận');
bang('Thiếu mốc giờ thì không chấm',
  kpiThoChoPhieu_([], phieu({ Ma_Su_Co: 'SC-3', Ma_Tho: 'TH02',
    Thoi_Gian_Bao: bao10 }).v, 0).apDung, 'KHONG — thiếu mốc giờ');
bang('Phiếu bị loại thì để trống ô phút, không ghi 0',
  kpiThoChoPhieu_([], phieu({ Ma_Su_Co: 'SC-3' }).v, 0).phutKpi, '');

// --- Ca 8: ngưỡng đạt ------------------------------------------------------
bang('Chưa chốt ngưỡng — không chấm đạt', kRoi.datNguong, '');
bang('KPI 30 phút, ngưỡng 30 → ĐẠT',
  kpiThoChoPhieu_(haiDoan, phieuRoi, 30).datNguong, 'DAT');
bang('KPI 30 phút, ngưỡng 15 → KHÔNG ĐẠT',
  kpiThoChoPhieu_(haiDoan, phieuRoi, 15).datNguong, 'KHONG_DAT');

// --- Ca 9: phân vị và tỷ lệ ------------------------------------------------
bang('Phân vị — trung vị của 5 số', G.phanVi_([2, 4, 6, 8, 10], 0.5), 6);
bang('Phân vị — P90 lấy số lớn nhất trong 5 số', G.phanVi_([2, 4, 6, 8, 10], 0.9), 10);
bang('Phân vị — mảng rỗng trả rỗng', G.phanVi_([], 0.5), '');
bang('Tỷ lệ — mẫu 0 trả rỗng chứ không phải 0%', G.tyLe_(0, 0), '');
bang('Tỷ lệ — 3/4 thành 75', G.tyLe_(3, 4), 75);

// --- Ca 10: trang Tom_Tat — kỳ liền trước và mức tăng giảm -----------------
bang('Lùi 1 ngày qua đầu tháng', G.dichNgay_('2026-08-01', -1), '2026-07-31');
bang('Lùi 1 ngày vào tháng 2 (2026 không nhuận)',
  G.dichNgay_('2026-03-01', -1), '2026-02-28');
bang('Tiến 1 ngày qua cuối năm', G.dichNgay_('2026-12-31', 1), '2027-01-01');
bang('Ngày hỏng thì trả rỗng', G.dichNgay_('linh tinh', -1), '');

const soNgayT8 = G.dsNgayTrongKy_('2026-08-01', '2026-08-31').length;
const denT7 = G.dichNgay_('2026-08-01', -1);
bang('Kỳ trước của tháng 8 là trọn tháng 7',
  [G.dichNgay_(denT7, -(soNgayT8 - 1)), denT7], ['2026-07-01', '2026-07-31']);

bang('Giờ dừng giảm → tốt', G.soSanhKy_(50, 62, true, ' giờ').tot, true);
bang('Giờ dừng tăng → xấu', G.soSanhKy_(70, 62, true, ' giờ').tot, false);
bang('Tỷ lệ đạt tăng → tốt', G.soSanhKy_(80, 71, false, '%').tot, true);
bang('Kỳ trước trống thì không kết luận',
  G.soSanhKy_(50, '', true, ' giờ'), { chu: 'kỳ trước chưa có số liệu', tot: null });
bang('Không đổi thì không tô màu',
  G.soSanhKy_(50, 50, true, ' giờ'), { chu: 'không đổi so với kỳ trước', tot: null });
bang('Có nêu rõ tăng hay giảm bao nhiêu',
  G.soSanhKy_(50, 62, true, ' giờ').chu, '▼ giảm 12 giờ so với kỳ trước');

// --- 2000 ca ngẫu nhiên: đẳng thức phải đúng với MỌI dữ liệu ---------------
// Hạt cố định để lần chạy nào cũng ra cùng bộ ca — hỏng thì tái hiện được.
let hat = 12345;
const rnd = function (n) { hat = (hat * 1103515245 + 12345) % 2147483648; return hat % n; };
let soNgauNhien = 0;
for (let lan = 0; lan < 2000; lan++) {
  const t0 = 8 * 60 + rnd(60);
  const tNhan = t0 + 1 + rnd(180);
  const ds = [];
  for (let i = 0; i < rnd(5); i++) {
    const a = t0 - 30 + rnd(200);
    const b = a + 1 + rnd(60);
    ds.push(phieu({ Ma_Su_Co: 'SC-' + i, Ma_Tho: 'TH02', Trang_Thai: TRANG_THAI.HOAN_THANH,
      Thoi_Gian_Nhan: new Date(2026, 7, 3, 0, a),
      Thoi_Gian_Hoan_Thanh: new Date(2026, 7, 3, 0, b) }));
  }
  const v = phieu({ Ma_Su_Co: 'SC-X', Ma_Tho: 'TH02',
    Thoi_Gian_Bao: new Date(2026, 7, 3, 0, t0),
    Thoi_Gian_Nhan: new Date(2026, 7, 3, 0, tNhan) }).v;
  const k = kpiThoChoPhieu_(ds, v, 0);
  if (k.phutBan + k.phutKpi !== tNhan - t0) {
    loi.push('✗ Đẳng thức sai ở ca ngẫu nhiên ' + lan + ': ' +
      k.phutBan + ' + ' + k.phutKpi + ' ≠ ' + (tNhan - t0));
    break;
  }
  if (k.phutBan < 0 || k.phutKpi < 0) {
    loi.push('✗ Ra số phút âm ở ca ngẫu nhiên ' + lan);
    break;
  }
  soNgauNhien++;
}
dat += soNgauNhien;

loi.forEach(function (x) { console.log(x); });
console.log(loi.length
  ? '=> ' + loi.length + ' phép thử KPI KHÔNG đạt'
  : '=> ' + dat + ' phép thử KPI đạt (gồm ' + soNgauNhien + ' ca ngẫu nhiên).');
process.exit(loi.length ? 1 : 0);
