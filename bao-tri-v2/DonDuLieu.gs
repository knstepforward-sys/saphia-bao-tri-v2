/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * DỌN DỮ LIỆU — chỉ dành cho người quản trị.
 *
 * QUYỀN: mọi hàm ở đây chỉ gọi được từ MENU trong Google Sheet, KHÔNG có route
 * nào trong web app dẫn tới chúng. Web app mở ẩn danh nên đặt chức năng xoá ở đó
 * là để nút xoá dữ liệu ngoài đường — dù có khoá bí mật cũng vậy. Ai sửa được
 * Sheet thì mới xoá được, và Google đã xác thực chuyện đó sẵn rồi.
 *
 * AN TOÀN: không có thao tác nào xoá thẳng. Mọi dòng bị xoá đều được chép sang
 * sheet Thung_Rac kèm thời điểm, người xoá và lý do. Xoá nhầm thì copy ngược lại.
 */

const HEADER_THUNG_RAC = HEADER_SU_CO.concat(['Xoa_Luc', 'Xoa_Boi', 'Ly_Do']);

/** Từ người dùng phải gõ đúng để xác nhận. Bấm OK không đủ. */
const TU_XAC_NHAN = 'XOA';

function nguoiDangDung_() {
  try {
    return Session.getActiveUser().getEmail() || '(không rõ)';
  } catch (err) {
    return '(không rõ)';
  }
}

/** Chép các dòng sắp xoá sang Thung_Rac trước khi xoá. */
function chuyenVaoThungRac_(dsDong, lyDo) {
  if (!dsDong.length) return;
  const sh = taoSheet_(SHEET.THUNG_RAC, HEADER_THUNG_RAC);
  const luc = nowVN_();
  const ai = nguoiDangDung_();

  const bang = dsDong.map(function (v) {
    return v.slice(0, HEADER_SU_CO.length).concat([luc, ai, lyDo || '']);
  });

  sh.getRange(sh.getLastRow() + 1, 1, bang.length, HEADER_THUNG_RAC.length)
    .setValues(bang);
}

/**
 * Xoá phiếu theo danh sách mã, quét cả Su_Co lẫn Luu_Tru.
 * @return {Object} { xoa: [mã đã xoá], khongThay: [mã không tìm thấy] }
 */
function xoaPhieuTheoMa_(dsMa, lyDo) {
  const can = {};
  dsMa.forEach(function (m) {
    const s = String(m).trim().toUpperCase();
    if (s) can[s] = true;
  });
  if (!Object.keys(can).length) throw new Error('Chưa nhập mã phiếu nào.');

  const daXoa = {};
  const gomLai = [];

  [SHEET.SU_CO, SHEET.LUU_TRU].forEach(function (tenSheet) {
    const sh = ss_().getSheetByName(tenSheet);
    if (!sh || sh.getLastRow() < 2) return;

    const soDong = sh.getLastRow() - 1;
    const v = sh.getRange(2, 1, soDong, HEADER_SU_CO.length).getValues();
    const giuLai = [];

    v.forEach(function (r) {
      const ma = String(r[COT.Ma_Su_Co]).trim();
      if (!ma) return;
      if (can[ma.toUpperCase()]) {
        gomLai.push(r);
        daXoa[ma.toUpperCase()] = ma;
      } else {
        giuLai.push(r);
      }
    });

    if (giuLai.length === soDong) return; // sheet này không đụng gì

    if (giuLai.length) {
      sh.getRange(2, 1, giuLai.length, HEADER_SU_CO.length).setValues(giuLai);
    }
    sh.getRange(giuLai.length + 2, 1, soDong - giuLai.length, HEADER_SU_CO.length)
      .clearContent();
  });

  chuyenVaoThungRac_(gomLai, lyDo);

  Object.keys(daXoa).forEach(function (k) {
    ghiNhatKy_(daXoa[k], '', nguoiDangDung_(), 'ADMIN_XOA_PHIEU', { lyDo: lyDo }, '');
  });

  return {
    xoa: Object.keys(daXoa).map(function (k) { return daXoa[k]; }),
    khongThay: Object.keys(can).filter(function (k) { return !daXoa[k]; }),
  };
}

/**
 * Dọn sạch toàn bộ dữ liệu vận hành để bắt đầu chạy thật.
 *
 * XOÁ: Su_Co, Luu_Tru, Nhat_Ky_Su_Co, Tong_Hop.
 * GIỮ NGUYÊN: Danh_Muc_May, Danh_Muc_Tho (kèm token), Ca_Lam_Viec, Cau_Hinh,
 *             Lich_Truc_Thang — nghĩa là link QR và link cá nhân đã phát vẫn sống.
 */
function donSachDuLieuVanHanh_(lyDo) {
  const kq = { suCo: 0, luuTru: 0, nhatKy: 0 };

  // Sao lưu phiếu vào thùng rác trước khi xoá.
  const gom = [];
  [SHEET.SU_CO, SHEET.LUU_TRU].forEach(function (tenSheet, i) {
    const sh = ss_().getSheetByName(tenSheet);
    if (!sh || sh.getLastRow() < 2) return;
    const soDong = sh.getLastRow() - 1;
    sh.getRange(2, 1, soDong, HEADER_SU_CO.length).getValues()
      .forEach(function (r) { if (String(r[COT.Ma_Su_Co]).trim()) gom.push(r); });
    if (i === 0) kq.suCo = soDong; else kq.luuTru = soDong;
    sh.getRange(2, 1, soDong, HEADER_SU_CO.length).clearContent();
  });

  chuyenVaoThungRac_(gom, lyDo);

  const shLog = ss_().getSheetByName(SHEET.NHAT_KY);
  if (shLog && shLog.getLastRow() >= 2) {
    kq.nhatKy = shLog.getLastRow() - 1;
    shLog.getRange(2, 1, kq.nhatKy, HEADER_NHAT_KY.length).clearContent();
  }

  const shTh = ss_().getSheetByName(SHEET.TONG_HOP);
  if (shTh) shTh.clear();

  ghiNhatKy_('', '', nguoiDangDung_(), 'ADMIN_DON_SACH', kq, '');
  return kq;
}

// ============================================================================
// Menu
// ============================================================================

/** Hỏi người dùng gõ đúng từ xác nhận. Trả true nếu đồng ý. */
function xacNhanXoa_(ui, tieuDe, moTa) {
  const h = ui.prompt(tieuDe,
    moTa + '\n\nGõ chính xác  ' + TU_XAC_NHAN + '  rồi bấm OK để xác nhận.\n' +
    'Bấm Cancel hoặc gõ sai là huỷ, không xoá gì.',
    ui.ButtonSet.OK_CANCEL);

  if (h.getSelectedButton() !== ui.Button.OK) return false;
  return h.getResponseText().trim().toUpperCase() === TU_XAC_NHAN;
}

function menuXoaPhieuTheoMa() {
  const ui = SpreadsheetApp.getUi();

  const h1 = ui.prompt('Xoá phiếu theo mã',
    'Nhập mã phiếu cần xoá, nhiều mã thì cách nhau bằng dấu phẩy.\n' +
    'Ví dụ:  SC-0308-001, SC-0308-002, BT-0308-001',
    ui.ButtonSet.OK_CANCEL);
  if (h1.getSelectedButton() !== ui.Button.OK) return;

  const dsMa = h1.getResponseText().split(/[,\n;]/)
    .map(function (s) { return s.trim(); }).filter(Boolean);
  if (!dsMa.length) { ui.alert('Chưa nhập mã nào.'); return; }

  if (!xacNhanXoa_(ui, 'Xác nhận xoá ' + dsMa.length + ' phiếu',
      'Sẽ xoá: ' + dsMa.join(', ') + '\n\n' +
      'Các dòng này được chép sang sheet Thung_Rac trước khi xoá, cần thì lấy lại được.')) {
    ui.alert('Đã huỷ, không xoá gì.');
    return;
  }

  chayVaBao_('Xoá phiếu', function () {
    const kq = xoaPhieuTheoMa_(dsMa, 'Xoá thủ công từ menu');
    return 'Đã xoá ' + kq.xoa.length + ' phiếu.' +
      (kq.xoa.length ? '\n  ' + kq.xoa.join(', ') : '') +
      (kq.khongThay.length ? '\n\nKhông tìm thấy: ' + kq.khongThay.join(', ') : '') +
      '\n\nBản sao nằm ở sheet Thung_Rac.';
  });
}

function menuDonSachDuLieuThu() {
  const ui = SpreadsheetApp.getUi();

  const shSuCo = ss_().getSheetByName(SHEET.SU_CO);
  const soPhieu = shSuCo ? Math.max(0, shSuCo.getLastRow() - 1) : 0;

  if (!soPhieu) { ui.alert('Su_Co đang trống, không có gì để dọn.'); return; }

  if (!xacNhanXoa_(ui, 'Dọn sạch dữ liệu chạy thử',
      'Sẽ xoá TOÀN BỘ ' + soPhieu + ' phiếu trong Su_Co, cùng Luu_Tru, ' +
      'Nhat_Ky_Su_Co và Tong_Hop.\n\n' +
      'GIỮ NGUYÊN: danh mục máy, danh mục thợ (token không đổi nên link đã phát vẫn dùng được), ' +
      'ca làm việc, cấu hình, lịch trực.\n\n' +
      'Toàn bộ phiếu được chép sang sheet Thung_Rac trước khi xoá.')) {
    ui.alert('Đã huỷ, không xoá gì.');
    return;
  }

  chayVaBao_('Dọn sạch dữ liệu', function () {
    const kq = donSachDuLieuVanHanh_('Dọn dữ liệu chạy thử trước khi vận hành thật');
    return 'Đã dọn xong, hệ thống sẵn sàng chạy thật.\n\n' +
      '• Phiếu trong Su_Co    : ' + kq.suCo + '\n' +
      '• Phiếu trong Luu_Tru  : ' + kq.luuTru + '\n' +
      '• Dòng nhật ký         : ' + kq.nhatKy + '\n' +
      '• Tong_Hop             : đã xoá trắng\n\n' +
      'Bản sao toàn bộ phiếu nằm ở sheet Thung_Rac.\n' +
      'Mã phiếu sẽ đánh lại từ 001 cho ngày hôm nay.';
  });
}

function menuMoThungRac() {
  const ui = SpreadsheetApp.getUi();
  const sh = ss_().getSheetByName(SHEET.THUNG_RAC);
  if (!sh || sh.getLastRow() < 2) {
    ui.alert('Thùng rác đang trống — chưa xoá phiếu nào.');
    return;
  }
  ss_().setActiveSheet(sh);
  ui.alert('Thùng rác',
    'Đang có ' + (sh.getLastRow() - 1) + ' dòng.\n\n' +
    'Muốn khôi phục: copy các dòng cần lấy lại (chỉ ' + HEADER_SU_CO.length +
    ' cột đầu, bỏ 3 cột Xoa_Luc / Xoa_Boi / Ly_Do) dán xuống cuối sheet Su_Co.\n\n' +
    'Sheet này không tự dọn — khi nào chắc chắn không cần nữa thì xoá tay.',
    ui.ButtonSet.OK);
}
