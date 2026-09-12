/**
 * Lớp 6 — PHÉP ĐẾM LẦN LỖI ĐÁP ỨNG, chạy NGAY TẠI MÁY, không cần mở Google Sheet.
 *
 * Chạy được vì mọi hàm trong `LoiDapUng.gs` là hàm THUẦN: chỉ nhận mảng / chuỗi /
 * số và trả kết quả. Ca đầu tiên của file này CANH đúng ranh giới đó — kéo một
 * lời gọi `SpreadsheetApp` vào file kia là đỏ ngay kèm lời giải thích, thay vì
 * một `ReferenceError` khó đọc ở ca thứ mười.
 *
 * ⚠️ Phải dùng `vm.runInThisContext`, KHÔNG `vm.createContext`: khác realm thì
 * `Date` của khung test và `Date` của code là hai constructor khác nhau, mọi
 * `instanceof Date` bên trong code trả về false, và bộ test hoá ra chỉ kiểm thử
 * chính cái khung. Dự án đã dính đúng một lần.
 *
 * Dùng:  node kiemtra/loi-dap-ung.js bao-tri-v2
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const duAn = process.argv[2];
const goc = path.dirname(path.resolve(duAn));
const thuMucMau = path.join(__dirname, 'mau');

// BaoCao.gs cho `trungBinh_`, XuatBaoCao.gs cho `ngayCuaPhieu_` và `tyLe_`,
// Code.gs cho `COT` / `laDoDapUng_` / `soCauHinh_`.
const nguon = ['Code.gs', 'BaoCao.gs', 'XuatBaoCao.gs', 'LoiDapUng.gs']
  .map(function (f) { return fs.readFileSync(path.join(duAn, f), 'utf8'); })
  .join('\n;\n');

// `const` ở cấp cao nhất là khai báo lexical, KHÔNG gắn vào object global — phải
// kéo ra bằng một dòng nối vào cuối chính script đó.
const XUAT = ';globalThis.__ra = { nguongKpiCuaTho_, oTrong_, thoRanhLucPhieuToi_,' +
  ' soPhutDapUngDeCham_, apDungDoiViTri_, demLoiDapUng_,' +
  ' NGUONG_CHUNG_DEM_THU, COT, HEADER_SU_CO, HEADER_THO };';

vm.runInThisContext(nguon + XUAT, { filename: 'gop-loi-dap-ung.gs' });
const G = globalThis.__ra;

let dat = 0;
const loi = [];
function bang(ten, thucTe, mongDoi) {
  const a = JSON.stringify(thucTe), b = JSON.stringify(mongDoi);
  if (a === b) { dat++; return; }
  loi.push('✗ ' + ten + '\n    mong đợi: ' + b + '\n    thực tế : ' + a);
}

// ============================================================================
// 1. CANH RANH GIỚI HÀM THUẦN — chạy TRƯỚC mọi ca khác
// ============================================================================
//
// Ca quan trọng nhất của file. Soi mã nguồn TỪNG HÀM chứ không grep cả file:
// grep cả file thì `BaoCaoDapUng.gs` (phần đọc sheet, cố ý không thuần) bị báo
// đỏ oan, và ngược lại một lời gọi lọt vào đúng hàm thuần thì grep cả file lại
// không chỉ ra được là hàm nào.
const CAM = ['SpreadsheetApp', 'UrlFetchApp', 'Utilities', 'LockService',
  'PropertiesService', 'CacheService', 'SHEET.', 'docSheet_', 'docCauHinh_'];
const PHAI_THUAN = ['nguongKpiCuaTho_', 'oTrong_', 'thoRanhLucPhieuToi_',
  'soPhutDapUngDeCham_', 'apDungDoiViTri_', 'demLoiDapUng_'];
const hetThuan = [];
PHAI_THUAN.forEach(function (ten) {
  const ma = String(G[ten]);
  CAM.forEach(function (cam) {
    if (ma.indexOf(cam) < 0) { dat++; return; }
    hetThuan.push('✗ ' + ten + ' hết thuần: có gọi ' + cam + '\n' +
      '    Nhóm hàm đếm lỗi đáp ứng phải chạy được bằng node. ' +
      'Đưa lời gọi đó sang BaoCaoDapUng.gs.');
  });
});
if (hetThuan.length) {
  hetThuan.forEach(function (x) { console.log(x); });
  console.log('=> ' + hetThuan.length + ' hàm đã hết thuần, dừng tại đây.');
  process.exit(1);
}

// ============================================================================
// 2. HÀM PHỤ — dựng dòng Su_Co từ object JSON
// ============================================================================

function phieu(o) {
  const v = new Array(G.HEADER_SU_CO.length).fill('');
  Object.keys(o).forEach(function (k) {
    if (k.charAt(0) === '_') return;             // trường _ca chỉ để người đọc
    if (G.COT[k] === undefined) {
      throw new Error('Mẫu có cột không tồn tại trong HEADER_SU_CO: ' + k);
    }
    v[G.COT[k]] = o[k];
  });
  return v;
}

function docMau(ten) {
  return JSON.parse(fs.readFileSync(path.join(thuMucMau, ten), 'utf8'));
}

function maCua(ds) { return ds.map(function (x) { return x.maSuCo; }); }

// ============================================================================
// 3. BA PHÉP PHÂN LOẠI — từng nhánh một
// ============================================================================

bang('Hai ô bằng 0 → thợ RẢNH',
  G.thoRanhLucPhieuToi_(phieu({ So_Chong_Viec: 0, Phut_Cho_Tho_Ban: 0 })), 'RANH');
bang('Chồng việc → BẬN',
  G.thoRanhLucPhieuToi_(phieu({ So_Chong_Viec: 1, Phut_Cho_Tho_Ban: 0 })), 'BAN');
bang('Máy chờ vì thợ bận → BẬN',
  G.thoRanhLucPhieuToi_(phieu({ So_Chong_Viec: 0, Phut_Cho_Tho_Ban: 12 })), 'BAN');

// Nhánh thứ ba. Đây là chốt chặn quan trọng nhất của hàm: ô trống KHÔNG được
// ngầm hiểu là 0 rồi tính thành rảnh — làm vậy là chấm lỗi oan cho mọi phiếu
// chưa chạy menu 🎯, mà báo cáo vẫn trông như thật.
bang('CẢ HAI ô trống → CHUA_TINH, KHÔNG phải RANH',
  G.thoRanhLucPhieuToi_(phieu({ So_Chong_Viec: '', Phut_Cho_Tho_Ban: '' })), 'CHUA_TINH');
bang('Chỉ So_Chong_Viec trống → CHUA_TINH',
  G.thoRanhLucPhieuToi_(phieu({ So_Chong_Viec: '', Phut_Cho_Tho_Ban: 0 })), 'CHUA_TINH');
bang('Chỉ Phut_Cho_Tho_Ban trống → CHUA_TINH',
  G.thoRanhLucPhieuToi_(phieu({ So_Chong_Viec: 0, Phut_Cho_Tho_Ban: '' })), 'CHUA_TINH');
bang('Ô có chữ (không phải số) → CHUA_TINH, không âm thầm thành 0',
  G.thoRanhLucPhieuToi_(phieu({ So_Chong_Viec: 'x', Phut_Cho_Tho_Ban: 0 })), 'CHUA_TINH');

bang('Ưu tiên Phut_Dap_Ung_Thuc',
  G.soPhutDapUngDeCham_(phieu({ Phut_Dap_Ung_Thuc: 7, Phut_KPI_Tho: 99 })), 7);
bang('Trống thì rơi về Phut_KPI_Tho',
  G.soPhutDapUngDeCham_(phieu({ Phut_Dap_Ung_Thuc: '', Phut_KPI_Tho: 9 })), 9);
bang('Cả hai trống → rỗng, vào nhóm thiếu số',
  G.soPhutDapUngDeCham_(phieu({ Phut_Dap_Ung_Thuc: '', Phut_KPI_Tho: '' })), '');
// Số 0 là một giá trị thật: thợ nhận ngay lúc báo. Nhầm 0 với trống là đẩy phiếu
// đáp ứng tức thì vào nhóm thiếu số.
bang('Đáp ứng 0 phút là số thật, không phải ô trống',
  G.soPhutDapUngDeCham_(phieu({ Phut_Dap_Ung_Thuc: 0, Phut_KPI_Tho: '' })), 0);
bang('KHÔNG rơi về Phut_Tiep_Nhan — cột đó chưa trừ lúc thợ bận',
  G.soPhutDapUngDeCham_(phieu({ Phut_Tiep_Nhan: 40, Phut_Dap_Ung_Thuc: '',
    Phut_KPI_Tho: '' })), '');

bang('Ngưỡng riêng của thợ thắng ngưỡng chung',
  G.nguongKpiCuaTho_({ Nguong_KPI_Phut: 10 }, { NGUONG_KPI_DAP_UNG_PHUT: '5' }), 10);
bang('Ngưỡng riêng trống thì rơi về ngưỡng chung',
  G.nguongKpiCuaTho_({ Nguong_KPI_Phut: '' }, { NGUONG_KPI_DAP_UNG_PHUT: '5' }), 5);
bang('Cả hai trống → 0 nghĩa là CHƯA CHỐT, không phải ngưỡng 0 phút',
  G.nguongKpiCuaTho_({ Nguong_KPI_Phut: '' }, { NGUONG_KPI_DAP_UNG_PHUT: '' }), 0);
bang('Thiếu hẳn tham số cũng không văng lỗi', G.nguongKpiCuaTho_(), 0);
bang('Ngưỡng 0 gõ tay cũng hiểu là chưa chốt',
  G.nguongKpiCuaTho_({ Nguong_KPI_Phut: 0 }, {}), 0);

// ============================================================================
// 4. PHÉP ĐẾM TRÊN BỘ MẪU TỰ DỰNG
// ============================================================================

const mau = docMau('kpi-demo-nguon.json');
const kyVong = docMau('kpi-demo-mongdoi.json');
const dsGoc = mau.phieu.map(phieu);
const cauHinh = { DOI_VI_TRI_BAT: 'BAT', DOI_VI_TRI_XU_LY_TOI_DA: '2',
  DOI_VI_TRI_DAP_UNG_TOI_THIEU: '5' };

// --- Đổi vị trí: KHÔNG được sửa mảng đầu vào tại chỗ ------------------------
// Dữ liệu gốc là bằng chứng. Sửa tại chỗ là mất luôn con số "nếu không đổi".
const anhChupGoc = JSON.stringify(dsGoc);
const doi = G.apDungDoiViTri_(dsGoc, cauHinh, mau.khaiTay);
bang('apDungDoiViTri_ KHÔNG sửa mảng đầu vào tại chỗ',
  JSON.stringify(dsGoc), anhChupGoc);

bang('Số phiếu bị đổi vị trí', doi.dsDoi.length, kyVong.doiViTri.soPhieuDoi);
bang('Phiếu quy tắc tự động bắt được',
  maCua(doi.dsDoi.filter(function (d) { return d.nguon === 'QUY_TAC'; })).sort(),
  kyVong.doiViTri.theoQuyTac.slice().sort());
bang('Phiếu chỉ vào được khi chủ quản khai tay',
  maCua(doi.dsDoi.filter(function (d) { return d.nguon === 'KHAI_TAY'; })).sort(),
  kyVong.doiViTri.theoKhaiTay.slice().sort());

// Số GỐC phải đi kèm — báo cáo in cả hai, không có số gốc thì không kiểm được.
Object.keys(kyVong.doiViTri.soGoc).forEach(function (ma) {
  const d = doi.dsDoi.filter(function (x) { return x.maSuCo === ma; })[0];
  bang('Số gốc và số sau đổi của ' + ma, d && {
    dapUngGoc: d.dapUngGoc, suaGoc: d.suaGoc,
    dapUngMoi: d.dapUngMoi, suaMoi: d.suaMoi,
  }, kyVong.doiViTri.soGoc[ma]);
});

const kq = G.demLoiDapUng_(doi.ds, mau.nguongTheoTho, { nguongChung: 0 });
const mongTong = kyVong.coDoiViTri.tong;
Object.keys(mongTong).forEach(function (k) {
  bang('Tổng · ' + k, kq.tong[k], mongTong[k]);
});

bang('Danh sách phiếu TÍNH LỖI',
  maCua(kq.dsPhieuLoi.filter(function (p) { return p.tinhLoi; })),
  kyVong.coDoiViTri.maPhieuLoi);
bang('Danh sách phiếu vượt ngưỡng nhưng thợ BẬN',
  maCua(kq.dsPhieuLoi.filter(function (p) { return !p.tinhLoi; })),
  kyVong.coDoiViTri.maVuotKhiBan);
// Nhóm rảnh phải nằm TRƯỚC nhóm bận — trang Phieu_Loi tô nền theo thứ tự này.
bang('Nhóm rảnh xếp trước nhóm bận',
  kq.dsPhieuLoi.map(function (p) { return p.tinhLoi ? 1 : 0; }),
  [1, 1, 1, 1, 1, 0, 0]);

bang('Bảng theo thợ — xếp nhiều lỗi nhất trước',
  kq.theoTho.map(function (t) {
    return { ten: t.ten, nguong: t.nguong, soPhieuSuCo: t.soPhieuSuCo,
      soRanh: t.soRanh, soBan: t.soBan, soLanLoi: t.soLanLoi,
      soVuotKhiBan: t.soVuotKhiBan, chamNhat: t.chamNhat,
      soViecChung: t.soViecChung, soBaoTri: t.soBaoTri };
  }), kyVong.coDoiViTri.theoTho);

bang('Bảng "nếu áp một ngưỡng chung"',
  kq.bangNguongChung, kyVong.coDoiViTri.bangNguongChung);

bang('Phiếu lệch đẳng thức bị BÁO RA, không im lặng',
  maCua(kq.lechDangThuc), kyVong.coDoiViTri.maLechDangThuc);

// Phiếu DM- không có thợ: phải biến mất khỏi mọi bảng, kể cả bảng theo thợ.
bang('DM- không sinh ra dòng thợ rỗng nào',
  kq.theoTho.filter(function (t) { return t.ten === '(chưa có thợ)'; }).length, 0);
bang('Tổng phiếu sự cố = rảnh + bận + chưa tính + thiếu số',
  kq.tong.soRanh + kq.tong.soBan + kq.tong.soChuaTinh + kq.tong.soThieuSo,
  kq.tong.soPhieuSuCo);
bang('Tổng vượt ngưỡng = số lần lỗi + vượt khi bận',
  kq.tong.soLanLoi + kq.tong.soVuotKhiBan, kq.tong.soVuotTong);

// --- Không đổi vị trí: con số phải nặng ký hơn -----------------------------
const kqGoc = G.demLoiDapUng_(dsGoc, mau.nguongTheoTho, { nguongChung: 0 });
bang('Số lần lỗi khi KHÔNG đổi vị trí',
  kqGoc.tong.soLanLoi, kyVong.khongDoiViTri.soLanLoi);
kyVong.khongDoiViTri.maPhieuLoiThem.forEach(function (ma) {
  bang(ma + ' là lỗi khi không đổi, hết lỗi khi có đổi', [
    kqGoc.dsPhieuLoi.filter(function (p) { return p.maSuCo === ma && p.tinhLoi; }).length,
    kq.dsPhieuLoi.filter(function (p) { return p.maSuCo === ma; }).length,
  ], [1, 0]);
});

// --- Công tắc TAT phải tắt cả quy tắc lẫn khai tay -------------------------
const doiTat = G.apDungDoiViTri_(dsGoc,
  { DOI_VI_TRI_BAT: 'TAT' }, mau.khaiTay);
bang('DOI_VI_TRI_BAT = TAT thì không đổi phiếu nào', doiTat.dsDoi.length, 0);
bang('TAT thì số lần lỗi về đúng con số thô',
  G.demLoiDapUng_(doiTat.ds, mau.nguongTheoTho, { nguongChung: 0 }).tong.soLanLoi,
  kyVong.khongDoiViTri.soLanLoi);

// --- Ngưỡng chung đỡ cho thợ chưa khai riêng ------------------------------
const kqChung = G.demLoiDapUng_(doi.ds, mau.nguongTheoTho, { nguongChung: 5 });
bang('Có ngưỡng chung thì không còn phiếu nào "chưa chốt ngưỡng"',
  kqChung.tong.soChuaChotNguong, 0);
bang('Lam (30 phút) thành một lần lỗi khi có ngưỡng chung 5 phút',
  kqChung.tong.soLanLoi, kq.tong.soLanLoi + 1);

// --- Đúng bằng ngưỡng thì KHÔNG tính, ở mọi mức ---------------------------
[1, 3, 5, 10, 20, 60].forEach(function (n) {
  const r = G.demLoiDapUng_([phieu({
    Ma_Su_Co: 'SC-X', Ngay_Ca: '2026-08-01', Ten_Tho: 'A', Bo_Phan: 'DET',
    Loai_Phieu: 'SU_CO', Phut_Tiep_Nhan: n, Phut_Cho_Tho_Ban: 0,
    Phut_Dap_Ung_Thuc: n, So_Chong_Viec: 0, Phut_KPI_Tho: n,
  })], { A: n }, {});
  bang('Đáp ứng đúng bằng ngưỡng ' + n + '′ → KHÔNG tính lỗi', r.tong.soLanLoi, 0);
});

bang('Danh sách rỗng ra kết quả rỗng, không văng lỗi',
  G.demLoiDapUng_([], {}, {}).tong.soPhieuSuCo, 0);
bang('Không tham số nào cũng không văng lỗi',
  G.demLoiDapUng_().tong.soLanLoi, 0);

// ============================================================================
// 5. ĐỐI CHIẾU VỚI BÁO CÁO TAY THÁNG 8/2026 — nếu có file mẫu thật
// ============================================================================
//
// Hai file dưới đây là bản trích từ báo cáo tay `BC_Dap_ung_T8.xlsx`. Chúng CHƯA
// có trong repository lúc viết lớp kiểm thử này, nên phần đối chiếu tự bật khi
// file xuất hiện. KHÔNG bịa số thay: một con số bịa trong file kỳ vọng là bộ test
// xanh vĩnh viễn cho một phép tính sai.
//
// LƯU Ý về `kpi-t8-nguon.json`: các số trong đó ĐÃ được đổi vị trí đáp ứng ↔ sửa
// sẵn, nên chạy phép ĐẾM trên nó thì KHÔNG áp thêm bước đổi lần nữa.
const T8_NGUON = path.join(thuMucMau, 'kpi-t8-nguon.json');
const T8_MONG = path.join(thuMucMau, 'kpi-t8-mongdoi.json');
let daDoiChieuT8 = false;

if (fs.existsSync(T8_NGUON) && fs.existsSync(T8_MONG)) {
  daDoiChieuT8 = true;
  const n8 = docMau('kpi-t8-nguon.json');
  const m8 = docMau('kpi-t8-mongdoi.json');
  // Số đã đổi sẵn → đếm THẲNG, không gọi apDungDoiViTri_ lần nữa.
  const r8 = G.demLoiDapUng_(n8.phieu.map(phieu), n8.nguongTheoTho,
    { nguongChung: n8.nguongChung || 0 });

  bang('T8 · số phiếu sự cố', r8.tong.soPhieuSuCo, m8.tong.soPhieuSuCo);
  bang('T8 · phiếu thợ rảnh', r8.tong.soRanh, m8.tong.soRanh);
  bang('T8 · phiếu thợ bận', r8.tong.soBan, m8.tong.soBan);
  bang('T8 · SỐ LẦN LỖI', r8.tong.soLanLoi, m8.tong.soLanLoi);
  bang('T8 · vượt ngưỡng khi thợ bận', r8.tong.soVuotKhiBan, m8.tong.soVuotKhiBan);
  bang('T8 · tổng vượt ngưỡng', r8.tong.soVuotTong, m8.tong.soVuotTong);
  bang('T8 · bảng số lần lỗi theo thợ',
    r8.theoTho.filter(function (t) { return t.soLanLoi > 0; })
      .map(function (t) { return { ten: t.ten, soLanLoi: t.soLanLoi }; }),
    m8.theoTho);
  bang('T8 · danh sách mã phiếu vượt ngưỡng',
    maCua(r8.dsPhieuLoi).slice().sort(), m8.maVuotNguong.slice().sort());
}

// ============================================================================
// KẾT LUẬN
// ============================================================================

loi.forEach(function (x) { console.log(x); });
if (loi.length) {
  console.log('=> ' + loi.length + ' phép thử đếm lỗi đáp ứng KHÔNG đạt');
  process.exit(1);
}
console.log('=> ' + dat + ' phép thử đếm lỗi đáp ứng đạt.');
if (daDoiChieuT8) {
  console.log('   Đã đối chiếu với báo cáo tay tháng 8/2026.');
} else {
  // In to và rõ. Lớp này vẫn xanh vì phép tính có phủ đủ nhánh bằng bộ mẫu tự
  // dựng, nhưng con số của tháng 8 thật thì CHƯA ai kiểm — nói im là đúng kiểu
  // hỏng im lặng mà dự án này đã trả giá nhiều lần.
  console.log('');
  console.log('   ⚠️  CHƯA ĐỐI CHIẾU ĐƯỢC VỚI BÁO CÁO TAY THÁNG 8/2026.');
  console.log('       Thiếu kiemtra/mau/kpi-t8-nguon.json và kpi-t8-mongdoi.json.');
  console.log('       Phép tính đã phủ đủ nhánh bằng bộ mẫu tự dựng, nhưng các con');
  console.log('       số 403 / 260 / 143 / 44 / 1 / 45 thì CHƯA ai kiểm.');
  console.log('       Đặt hai file đó vào kiemtra/mau/ là phần đối chiếu tự bật.');
}
process.exit(0);
