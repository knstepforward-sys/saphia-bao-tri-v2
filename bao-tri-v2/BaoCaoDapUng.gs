/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * BÁO CÁO LỖI ĐÁP ỨNG THEO THÁNG — bảy trang, một Google Sheet mới trên Drive.
 *
 * Đây là phần ĐỌC SHEET và DỰNG FILE. Toàn bộ phép tính nằm ở `LoiDapUng.gs` và
 * là hàm thuần, kiểm thử được bằng node — ranh giới đó cố ý, đừng kéo phép tính
 * vào file này.
 *
 * Mọi ô trong file xuất là SỐ ĐÃ TÍNH SẴN. TUYỆT ĐỐI không viết công thức Sheets:
 * nguyên tắc gốc của dự án, để né lỗi locale và #ERROR! (dấu phẩy/dấu chấm thập
 * phân, tên hàm dịch theo ngôn ngữ tài khoản).
 *
 * Báo cáo in CẢ số gốc LẪN số sau khi đổi vị trí đáp ứng ↔ sửa, và không bao giờ
 * ghi số đã đổi ngược vào `Su_Co` / `Luu_Tru`. Xem `apDungDoiViTri_`.
 */

const SO_COT_DU = 14;          // A..N — bề ngang các trang báo cáo đáp ứng
const MAU_RANH = '#e6f4ea';    // nền nhóm thợ RẢNH
const MAU_BAN = '#fef7e0';     // nền nhóm thợ BẬN — tô khác để không đọc lẫn

/**
 * Xuất báo cáo lỗi đáp ứng của một tháng.
 *
 * @param {string} thang 'MM/yyyy'. Bỏ trống = tháng hiện tại.
 * @return {{ok: boolean, tenFile: string, url: string, thongDiep: string}}
 */
function xuatBaoCaoDapUng(thang) {
  const thangCan = String(thang || '').trim() || fmtThang_(nowVN_());
  if (!/^\d{2}\/\d{4}$/.test(thangCan)) {
    throw new Error('Tháng phải dạng MM/yyyy, ví dụ 08/2026.');
  }
  const k = khoangCuaThang_(thangCan);

  // Đọc CẢ Su_Co lẫn Luu_Tru: phiếu hoàn thành của tháng trước đã bị dời sang
  // lưu trữ, chỉ đọc Su_Co là báo cáo tháng cũ ra rỗng mà không báo lỗi gì.
  const nguon = docSuCoVaLuuTru_();
  const cauHinh = docCauHinh_();
  const dsTho = docSheet_(SHEET.THO, HEADER_THO);
  const bangNguong = bangNguongTho_(dsTho, cauHinh);

  // Sheet khai tay có thể chưa được tạo (chưa bấm "Cài đặt hệ thống" lần nào).
  // Thiếu nó thì báo cáo vẫn phải ra, chỉ là không có phiếu khai tay nào.
  let dsXacNhanTay = [];
  let loiKhaiTay = '';
  try {
    dsXacNhanTay = docSheet_(SHEET.DOI_VI_TRI, HEADER_DOI_VI_TRI);
  } catch (err) {
    loiKhaiTay = err.message;
  }

  // kemViecChung: true — trang Theo_Tho có cột việc chung và bảo trì, thiếu hai
  // loại đó thì thợ nào làm việc chung cả tháng trông như ngồi không.
  const dsGoc = locPhieuTheoKy_(nguon, {
    tuNgay: k.tu, denNgay: k.den, kemViecChung: true,
  }).sort(function (a, b) {
    return String(a[COT.Ma_Su_Co]).localeCompare(String(b[COT.Ma_Su_Co]));
  });

  const doi = apDungDoiViTri_(dsGoc, cauHinh, dsXacNhanTay);
  const tuyChon = { nguongChung: bangNguong.chung };

  // Đếm HAI lần trên cùng tập phiếu: có đổi vị trí và không đổi. Con số thứ hai
  // không để trang trí — nó cho chủ quản thấy quy tắc đổi nặng ký tới mức nào
  // (tháng 8/2026: 44 so với 68). Che nó đi là bắt người đọc tin mà không kiểm.
  const kq = demLoiDapUng_(doi.ds, bangNguong.theoTen, tuyChon);
  const kqGoc = demLoiDapUng_(dsGoc, bangNguong.theoTen, tuyChon);

  const ctx = {
    thang: thangCan,
    nhanKy: nhanKy_(k.tu, k.den),
    tuNgay: k.tu, denNgay: k.den,
    bangNguong: bangNguong,
    doi: doi,
    kqGoc: kqGoc,
    loiKhaiTay: loiKhaiTay,
    xuLyToiDa: soCauHinh_(cauHinh.DOI_VI_TRI_XU_LY_TOI_DA, 2),
    dapUngToiThieu: soCauHinh_(cauHinh.DOI_VI_TRI_DAP_UNG_TOI_THIEU, 5),
  };

  const tenFile = 'BaoCao_DapUng_T' + thangCan.slice(0, 2) + '_' + thangCan.slice(3);
  const ssMoi = SpreadsheetApp.create(tenFile);

  // Du_Lieu_Nguon dùng sheet đầu tiên do create() sinh ra, nên phải ghi TRƯỚC.
  // Tom_Tat chèn vào vị trí 0 nên ghi SAU CÙNG — đó là trang mở ra đầu tiên.
  const thieuTrang = [];
  function trang_(ten, ham) {
    // Bọc try/catch quanh TỪNG trang: hỏng một trang thì sáu trang còn lại vẫn
    // phải ra, và báo cáo ghi rõ trang nào thiếu vì lý do gì.
    try { ham(); } catch (err) { thieuTrang.push(ten + ' (' + err.message + ')'); }
  }

  trang_('Du_Lieu_Nguon', function () { ghiDuLieuNguon_(ssMoi, kq, ctx); });
  trang_('Theo_Tho', function () { ghiTheoThoDapUng_(ssMoi, kq, ctx); });
  trang_('Phieu_Loi', function () { ghiPhieuLoi_(ssMoi, kq, ctx); });
  trang_('Kiem_Tra_Ranh', function () { ghiKiemTraRanh_(ssMoi, kq, ctx); });
  trang_('Theo_Ngay', function () { ghiTheoNgayDapUng_(ssMoi, kq, ctx); });
  trang_('Dien_Giai', function () { ghiDienGiai_(ssMoi, kq, ctx); });
  trang_('Tom_Tat', function () { ghiTomTatDapUng_(ssMoi, kq, ctx, thieuTrang); });

  const shTt = ssMoi.getSheetByName('Tom_Tat');
  if (shTt) ssMoi.setActiveSheet(shTt);
  ['Sheet1', 'Trang tính1', 'Trang tinh1'].forEach(function (t) {
    const sh = ssMoi.getSheetByName(t);
    if (sh && ssMoi.getSheets().length > 1) ssMoi.deleteSheet(sh);
  });

  ghiNhatKy_('', '', 'HE_THONG', 'XUAT_BAO_CAO_DAP_UNG',
    { thang: thangCan, soPhieuSuCo: kq.tong.soPhieuSuCo,
      soLanLoi: kq.tong.soLanLoi, soLanLoiGoc: kqGoc.tong.soLanLoi,
      soDoi: doi.dsDoi.length, thieuTrang: thieuTrang }, '');

  const thongDiep = 'Báo cáo lỗi đáp ứng ' + ctx.nhanKy + ':\n' +
    '• ' + kq.tong.soLanLoi + ' lần đáp ứng trễ / ' + kq.tong.soRanh +
    ' phiếu tới lúc thợ rảnh / ' + kq.tong.soPhieuSuCo + ' phiếu sự cố\n' +
    '• Vượt ngưỡng nhưng thợ đang bận: ' + kq.tong.soVuotKhiBan + ' phiếu\n' +
    '• Đã đổi vị trí đáp ứng ↔ sửa: ' + doi.dsDoi.length + ' phiếu' +
    (doi.bat ? '' : ' (quy tắc đang TẮT)') +
    ' — không đổi thì số lần lỗi là ' + kqGoc.tong.soLanLoi + '\n' +
    (kq.tong.soChuaTinh
      ? '⚠️ ' + kq.tong.soChuaTinh + ' phiếu CHƯA TÍNH KPI, đã loại khỏi phép đếm. ' +
        'Bấm 🎯 Tính lại KPI đáp ứng của thợ rồi xuất lại.\n'
      : '') +
    (kq.tong.soChuaChotNguong
      ? '⚠️ ' + kq.tong.soChuaChotNguong + ' phiếu thuộc thợ CHƯA CHỐT NGƯỠNG. ' +
        'Điền cột Nguong_KPI_Phut ở sheet Danh_Muc_Tho.\n'
      : '') +
    (thieuTrang.length ? '⚠️ Thiếu trang: ' + thieuTrang.join(' · ') + '\n' : '');

  return { ok: true, tenFile: tenFile, url: ssMoi.getUrl(), thongDiep: thongDiep,
    soLanLoi: kq.tong.soLanLoi, thieuTrang: thieuTrang };
}

// ============================================================================
// TIỆN ÍCH DỰNG TRANG
// ============================================================================

/** Khung ghi một trang: gom dòng vào mảng rồi setValues MỘT lần ở cuối. */
function _khungTrang_(sh, soCot) {
  const luoi = [];
  return {
    them: function (r) {
      const d = (r || []).slice(0, soCot);
      while (d.length < soCot) d.push('');
      luoi.push(d);
      return luoi.length;          // số dòng vừa ghi, 1-based
    },
    soDong: function () { return luoi.length; },
    ghi: function () {
      if (!luoi.length) return;
      sh.getRange(1, 1, luoi.length, soCot).setValues(luoi);
    },
  };
}

/** Tiêu đề lớn đầu trang. Trả về số dòng đã dùng. */
function _dauTrang_(kh, sh, tieuDe, ctx, soCot) {
  const d1 = kh.them([tieuDe]);
  const d2 = kh.them([ctx.nhanKy + ' · số liệu tính sẵn, không phải công thức']);
  return { d1: d1, d2: d2, dinhDang: function () {
    sh.getRange(d1, 1, 1, soCot).merge()
      .setBackground(MAU_CHINH).setFontColor('#ffffff')
      .setFontSize(15).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sh.setRowHeight(d1, 34);
    sh.getRange(d2, 1, 1, soCot).merge()
      .setBackground(MAU_NHAT).setFontColor('#174ea6')
      .setHorizontalAlignment('center');
  } };
}

function _headBang_(sh, dong, soCot) {
  sh.getRange(dong, 1, 1, soCot)
    .setBackground('#f1f3f4').setFontWeight('bold').setFontSize(10)
    .setWrap(true).setVerticalAlignment('middle');
  sh.setRowHeight(dong, 44);
}

function _soHoacGach_(x) {
  return (x === '' || x === null || x === undefined) ? '—' : x;
}

// ============================================================================
// TRANG 1 — Tom_Tat
// ============================================================================

function ghiTomTatDapUng_(ssMoi, kq, ctx, thieuTrang) {
  const sh = ssMoi.insertSheet('Tom_Tat', 0);
  const kh = _khungTrang_(sh, SO_COT_DU);
  const dau = _dauTrang_(kh, sh, 'BÁO CÁO LỖI ĐÁP ỨNG CỦA THỢ', ctx, SO_COT_DU);
  const mocMuc = [], mocHead = [], mocTong = [];

  // --- Cách đếm: năm gạch đầu dòng ------------------------------------------
  // Đặt ngay đầu trang, trước mọi con số. Người đọc phải biết con số nghĩa là gì
  // TRƯỚC khi nhìn thấy nó, nếu không mỗi người hiểu một kiểu rồi tranh luận.
  kh.them([]);
  mocMuc.push(kh.them(['CÁCH ĐẾM MỘT LẦN LỖI']));
  [
    '1. Chỉ xét phiếu có người báo: phiếu sự cố (SC-) và phiếu gọi kỹ thuật lúc ' +
      'máy đang dừng (HT-). Việc chung, bảo trì, dừng máy không đo đáp ứng.',
    '2. Ngưỡng là số phút RIÊNG của từng thợ, do chủ quản chỉ định ở sheet ' +
      'Danh_Muc_Tho, cột Nguong_KPI_Phut. Không phải máy tính ra.',
    '3. Một lần lỗi = một phiếu có số phút đáp ứng LỚN HƠN ngưỡng của chính thợ ' +
      'đó. Đúng bằng ngưỡng thì KHÔNG tính.',
    '4. Chỉ đếm phiếu tới lúc thợ đang RẢNH (không chồng việc và máy không phải ' +
      'chờ vì thợ bận). Vượt ngưỡng khi thợ đang bận thì liệt kê riêng, không đếm.',
    '5. Số phút đem so là Phut_Dap_Ung_Thuc — đã trừ khoảng thợ đang cầm việc khác.',
  ].forEach(function (x) { kh.them([x]); });

  // --- Bốn ô số lớn ---------------------------------------------------------
  kh.them([]);
  const dNhan = kh.them(['SỐ LẦN ĐÁP ỨNG TRỄ', '', '',
    'TRÊN TỔNG PHIẾU THỢ RẢNH', '', '',
    'TỔNG PHIẾU SỰ CỐ', '', '',
    'VƯỢT NGƯỠNG NHƯNG THỢ BẬN', '', '', '', '']);
  const dSo = kh.them([kq.tong.soLanLoi, '', '',
    kq.tong.soRanh, '', '',
    kq.tong.soPhieuSuCo, '', '',
    kq.tong.soVuotKhiBan, '', '', '', '']);
  const dPhu = kh.them(['Tổng số lần vượt ngưỡng: ' + kq.tong.soVuotTong +
    ' (trong đó ' + kq.tong.soLanLoi + ' lần tính lỗi, ' + kq.tong.soVuotKhiBan +
    ' lần thợ đang bận nên không tính) · thợ bận ' + kq.tong.soBan + ' phiếu']);

  // --- Cảnh báo: ba nhóm bị loại, mỗi nhóm một con số riêng -----------------
  // Ba thứ này khác nhau về bản chất, gộp một dòng là doạ người đọc bằng một con
  // số vô nghĩa. "Chưa tính" là việc phải làm; "không đo được" là đúng bản chất;
  // "thiếu mốc giờ" là do nhập thiếu, phải sửa tay.
  const dsCanh = [];
  if (kq.tong.soChuaTinh) {
    dsCanh.push(kh.them(['⚠️ CHƯA TÍNH KPI: ' + kq.tong.soChuaTinh + ' phiếu ' +
      '(hai ô So_Chong_Viec / Phut_Cho_Tho_Ban còn trống). Đã LOẠI khỏi phép đếm, ' +
      'không ngầm coi là thợ rảnh. Bấm 🔧 Bảo trì → 🎯 Tính lại KPI đáp ứng của thợ ' +
      'rồi xuất lại báo cáo này.']));
  }
  if (kq.tong.soThieuSo) {
    dsCanh.push(kh.them(['⚠️ THIẾU SỐ ĐÁP ỨNG: ' + kq.tong.soThieuSo + ' phiếu ' +
      '(thường là nhập thiếu mốc "giờ thợ nhận"). Đây là lỗi NHẬP LIỆU, phải sửa ' +
      'tay trên sheet Su_Co, tính lại KPI không giải quyết được.']));
  }
  if (kq.tong.soChuaChotNguong) {
    dsCanh.push(kh.them(['⚠️ CHƯA CHỐT NGƯỠNG: ' + kq.tong.soChuaChotNguong +
      ' phiếu thuộc thợ chưa có ngưỡng. Điền cột Nguong_KPI_Phut ở sheet ' +
      'Danh_Muc_Tho (hoặc NGUONG_KPI_DAP_UNG_PHUT ở Cau_Hinh cho ngưỡng chung). ' +
      'Sửa trên sheet là có hiệu lực ngay, không cần deploy.']));
  }
  if (kq.lechDangThuc.length) {
    dsCanh.push(kh.them(['❌ DỮ LIỆU LỆCH: ' + kq.lechDangThuc.length + ' phiếu ' +
      'thuộc nhóm thợ rảnh mà Phut_Tiep_Nhan ≠ Phut_Dap_Ung_Thuc ≠ Phut_KPI_Tho. ' +
      'Thợ rảnh thì ba số phải bằng nhau. Xem chi tiết ở trang Kiem_Tra_Ranh. ' +
      'Mã phiếu: ' + kq.lechDangThuc.slice(0, 8).map(function (x) {
        return x.maSuCo;
      }).join(', ')]));
  }
  if (ctx.loiKhaiTay) {
    dsCanh.push(kh.them(['⚠️ Chưa đọc được sheet ' + SHEET.DOI_VI_TRI + ': ' +
      ctx.loiKhaiTay + '. Báo cáo vẫn ra đủ, chỉ thiếu các phiếu khai tay.']));
  }
  if (thieuTrang && thieuTrang.length) {
    dsCanh.push(kh.them(['❌ THIẾU TRANG: ' + thieuTrang.join(' · ') +
      '. Sáu trang còn lại vẫn đúng.']));
  }

  // --- Bảng số lần lỗi theo thợ, nhiều nhất trước ---------------------------
  kh.them([]);
  mocMuc.push(kh.them(['SỐ LẦN ĐÁP ỨNG TRỄ THEO THỢ — nhiều nhất trước']));
  mocHead.push(kh.them(['Thợ', 'Ngưỡng (phút)', 'Phiếu sự cố', 'Phiếu thợ rảnh',
    'SỐ LẦN LỖI', 'Lỗi / phiếu rảnh', 'Vượt ngưỡng khi bận', 'Chậm nhất (phút)']));
  const coLoi = kq.theoTho.filter(function (t) { return t.soPhieuSuCo > 0; });
  coLoi.forEach(function (t) {
    kh.them([t.ten, t.nguong || '—', t.soPhieuSuCo, t.soRanh, t.soLanLoi,
      t.tyLeLoi === '' ? '—' : t.tyLeLoi + '%',
      t.soVuotKhiBan, _soHoacGach_(t.chamNhat)]);
  });
  if (!coLoi.length) kh.them(['Kỳ này không có phiếu sự cố nào.']);
  else {
    mocTong.push(kh.them(['TOÀN TỔ', '', kq.tong.soPhieuSuCo, kq.tong.soRanh,
      kq.tong.soLanLoi,
      kq.tong.soRanh ? Math.round((kq.tong.soLanLoi / kq.tong.soRanh) * 100) + '%' : '—',
      kq.tong.soVuotKhiBan, '']));
  }

  // --- Kiểm chồng việc ------------------------------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['KIỂM CHỒNG VIỆC — vì sao ' + kq.tong.soBan +
    ' phiếu không bị đếm']));
  kh.them(['Phiếu tới lúc thợ RẢNH: ' + kq.tong.soRanh + '/' + kq.tong.soPhieuSuCo +
    (kq.tong.soPhieuSuCo
      ? ' (' + Math.round((kq.tong.soRanh / kq.tong.soPhieuSuCo) * 100) + '%)' : '')]);
  kh.them(['Phiếu tới lúc thợ ĐANG BẬN: ' + kq.tong.soBan + '/' + kq.tong.soPhieuSuCo +
    ' — máy chờ vì thiếu người, không phải vì thợ chậm. Chi tiết ở Kiem_Tra_Ranh.']);
  kh.them(['Trong nhóm bận có ' + kq.tong.soVuotKhiBan + ' phiếu vượt ngưỡng. ' +
    'Không tính lỗi, nhưng liệt kê riêng để chủ quản tự quyết.']);

  // --- Nếu áp một ngưỡng chung ---------------------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['NẾU ÁP MỘT NGƯỠNG CHUNG CHO CẢ TỔ thì bao nhiêu lần lỗi']));
  mocHead.push(kh.them(['Ngưỡng chung (phút)', 'Số lần lỗi (thợ rảnh)',
    'Tổng vượt ngưỡng', 'So với cách ngưỡng riêng']));
  kq.bangNguongChung.forEach(function (r) {
    kh.them(['≤ ' + r.nguong, r.soLanLoi, r.soVuot,
      (r.soLanLoi - kq.tong.soLanLoi > 0 ? '+' : '') +
      (r.soLanLoi - kq.tong.soLanLoi)]);
  });
  kh.them(['Cách đang dùng — ngưỡng RIÊNG từng thợ', kq.tong.soLanLoi,
    kq.tong.soVuotTong, '0 (mốc so sánh)']);

  // --- Các phiếu đã đổi vị trí đáp ứng ↔ sửa -------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['CÁC PHIẾU ĐÃ ĐỔI VỊ TRÍ ĐÁP ỨNG ↔ SỬA']));
  kh.them(['Thợ quên bấm nhận việc: sửa xong mới bấm nhận rồi bấm hoàn thành ' +
    'luôn, nên hệ ghi thời gian SỬA thành thời gian máy CHỜ và ngược lại.']);
  kh.them(['Số lần lỗi KHI CÓ ĐỔI: ' + kq.tong.soLanLoi +
    '  ·  KHI KHÔNG ĐỔI: ' + ctx.kqGoc.tong.soLanLoi +
    '  ·  chênh ' + (ctx.kqGoc.tong.soLanLoi - kq.tong.soLanLoi) + ' lần.']);
  kh.them(['Quy tắc đang ' + (ctx.doi.bat ? 'BẬT' : 'TẮT') +
    ' (Cau_Hinh.DOI_VI_TRI_BAT). Dữ liệu gốc trên Su_Co KHÔNG bị sửa — ' +
    'phép đổi chỉ diễn ra trong bộ nhớ lúc lập báo cáo này.']);
  mocHead.push(kh.them(['Mã sự cố', 'Ngày', 'Thợ', 'Máy', 'Đáp ứng GỐC',
    'Sửa GỐC', 'Đáp ứng SAU ĐỔI', 'Sửa SAU ĐỔI', 'Nguồn', 'Lý do',
    'Người xác nhận']));
  if (!ctx.doi.dsDoi.length) {
    kh.them(['Không có phiếu nào bị đổi trong kỳ này.']);
  } else {
    ctx.doi.dsDoi.forEach(function (d) {
      kh.them([d.maSuCo, ngayVN_(d.ngay), d.tenTho, d.tenMay,
        d.dapUngGoc, d.suaGoc, d.dapUngMoi, d.suaMoi,
        d.nguon === 'QUY_TAC' ? 'quy tắc tự động' : 'chủ quản khai tay',
        d.lyDo, d.nguoiXacNhan || '']);
    });
    mocTong.push(kh.them(['TỔNG', '', '', '', '', '', '', '',
      ctx.doi.dsDoi.filter(function (d) { return d.nguon === 'QUY_TAC'; }).length +
      ' quy tắc + ' +
      ctx.doi.dsDoi.filter(function (d) { return d.nguon === 'KHAI_TAY'; }).length +
      ' khai tay = ' + ctx.doi.dsDoi.length, '', '']));
  }

  // --- Mục lục -------------------------------------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['CÁC TRANG TRONG FILE NÀY']));
  [
    ['Theo_Tho', 'Một dòng một thợ, 15 cột. Dòng TOÀN TỔ ở cuối.'],
    ['Phieu_Loi', 'Mỗi dòng một lần vượt ngưỡng. Nhóm thợ rảnh trước, nhóm bận sau.'],
    ['Kiem_Tra_Ranh', 'Ba bước kiểm: chia nhóm rảnh/bận · phiếu vượt ngưỡng khi bận · mức chồng việc từng thợ.'],
    ['Theo_Ngay', 'Số lần lỗi theo từng ngày, rồi theo bộ phận.'],
    ['Dien_Giai', 'Mỗi chỉ tiêu một dòng: định nghĩa và lấy từ cột nào.'],
    ['Du_Lieu_Nguon', 'Toàn bộ phiếu trong kỳ kèm cột phái sinh. Đã bật bộ lọc.'],
  ].forEach(function (r) { kh.them([r[0], r[1]]); });

  // --- Ghi rồi định dạng ---------------------------------------------------
  kh.ghi();
  dau.dinhDang();

  [1, 4, 7, 10].forEach(function (c) {
    sh.getRange(dNhan, c, 1, 3).merge()
      .setBackground(MAU_NHAT).setFontColor('#174ea6').setFontWeight('bold')
      .setFontSize(10).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(dSo, c, 1, 3).merge()
      .setFontSize(20).setFontWeight('bold').setFontColor(MAU_CHINH)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.setRowHeight(dSo, 44);
  sh.getRange(dNhan, 1, 2, SO_COT_DU).setBorder(true, true, true, true, true, false,
    MAU_VIEN, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(dPhu, 1, 1, SO_COT_DU).merge()
    .setFontColor('#5f6368').setFontSize(10.5).setHorizontalAlignment('center');

  mocMuc.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_DU).merge()
      .setFontWeight('bold').setFontSize(12).setFontColor('#174ea6');
    sh.setRowHeight(d, 26);
  });
  mocHead.forEach(function (d) { _headBang_(sh, d, SO_COT_DU); });
  mocTong.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_DU).setBackground('#e6f4ea').setFontWeight('bold');
  });
  dsCanh.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_DU).merge()
      .setBackground('#fce8e6').setFontColor('#a50e0e').setWrap(true);
  });

  sh.setColumnWidth(1, 230);
  for (let c = 2; c <= SO_COT_DU; c++) sh.setColumnWidth(c, 105);
  sh.setFrozenRows(2);
}

// ============================================================================
// TRANG 2 — Theo_Tho (15 cột)
// ============================================================================

function ghiTheoThoDapUng_(ssMoi, kq, ctx) {
  const sh = ssMoi.insertSheet('Theo_Tho');
  const SO_COT = 15;
  const kh = _khungTrang_(sh, SO_COT);
  const dau = _dauTrang_(kh, sh, 'LỖI ĐÁP ỨNG THEO TỪNG THỢ', ctx, SO_COT);
  kh.them([]);

  const dHead = kh.them(['Thợ', 'Ngưỡng (phút)', 'Số phiếu sự cố', 'Phiếu thợ rảnh',
    'SỐ LẦN LỖI', 'Lỗi / phiếu rảnh', 'Vượt ngưỡng khi bận', 'Tổng vượt ngưỡng',
    'Chậm nhất (phút)', 'Đáp ứng thực TB', 'Chờ do thợ bận TB',
    'Số lần chồng việc', 'Xử lý TB (phút)', 'Việc chung', 'Bảo trì']);

  kq.theoTho.forEach(function (t) {
    kh.them([t.ten, t.nguong || '—', t.soPhieuSuCo, t.soRanh, t.soLanLoi,
      t.tyLeLoi === '' ? '—' : t.tyLeLoi + '%',
      t.soVuotKhiBan, t.soVuotTong, _soHoacGach_(t.chamNhat),
      _soHoacGach_(t.dapUngTb), _soHoacGach_(t.choBanTb),
      t.soChongViec, _soHoacGach_(t.xuLyTb), t.soViecChung, t.soBaoTri]);
  });

  const dTong = kh.them(['TOÀN TỔ', '', kq.tong.soPhieuSuCo, kq.tong.soRanh,
    kq.tong.soLanLoi,
    kq.tong.soRanh ? Math.round((kq.tong.soLanLoi / kq.tong.soRanh) * 100) + '%' : '—',
    kq.tong.soVuotKhiBan, kq.tong.soVuotTong, '', '', '',
    kq.theoTho.reduce(function (a, t) { return a + t.soChongViec; }, 0), '',
    kq.theoTho.reduce(function (a, t) { return a + t.soViecChung; }, 0),
    kq.theoTho.reduce(function (a, t) { return a + t.soBaoTri; }, 0)]);

  kh.them([]);
  kh.them(['Ngưỡng hiện "—" là thợ chưa được chốt ngưỡng: phiếu của người đó ' +
    'KHÔNG bị chấm lỗi, và được đếm riêng ở trang Tom_Tat.']);
  kh.them(['Cột "Đáp ứng thực TB" gom cả phiếu thợ bận nên mô tả hiện trạng; ' +
    'phép ĐẾM LỖI thì chỉ xét nhóm thợ rảnh. Hai con số trả lời hai câu khác nhau.']);

  kh.ghi();
  dau.dinhDang();
  _headBang_(sh, dHead, SO_COT);
  sh.getRange(dTong, 1, 1, SO_COT).setBackground('#e6f4ea').setFontWeight('bold');
  if (dTong - dHead > 1) {
    sh.getRange(dHead, 5, dTong - dHead, 1).setFontWeight('bold');
  }
  sh.setColumnWidth(1, 140);
  for (let c = 2; c <= SO_COT; c++) sh.setColumnWidth(c, 92);
  sh.setFrozenRows(dHead);
  sh.setFrozenColumns(1);
}

// ============================================================================
// TRANG 3 — Phieu_Loi
// ============================================================================

function ghiPhieuLoi_(ssMoi, kq, ctx) {
  const sh = ssMoi.insertSheet('Phieu_Loi');
  const SO_COT = 12;
  const kh = _khungTrang_(sh, SO_COT);
  const dau = _dauTrang_(kh, sh, 'TỪNG LẦN VƯỢT NGƯỠNG', ctx, SO_COT);
  kh.them([]);
  kh.them(['Nhóm THỢ RẢNH (tính lỗi) xếp trước, nhóm THỢ BẬN (không tính lỗi) ' +
    'tô nền khác ở dưới. Trong mỗi nhóm xếp theo số phút vượt giảm dần.']);

  const dHead = kh.them(['#', 'Mã sự cố', 'Ngày', 'Thợ', 'Bộ phận', 'Máy',
    'Loại phiếu', 'Ngưỡng', 'Đáp ứng (phút)', 'Vượt (phút)',
    'Thợ rảnh?', 'Có tính lỗi?']);

  const dongRanh = [], dongBan = [];
  kq.dsPhieuLoi.forEach(function (p, i) {
    const d = kh.them([i + 1, p.maSuCo, ngayVN_(p.ngay), p.tenTho, p.boPhan,
      p.tenMay, p.loai, p.nguong, p.soPhut, p.vuot,
      p.trangThai === 'RANH' ? 'RẢNH' : 'BẬN',
      p.tinhLoi ? 'CÓ' : 'không']);
    (p.tinhLoi ? dongRanh : dongBan).push(d);
  });
  if (!kq.dsPhieuLoi.length) kh.them(['Không có phiếu nào vượt ngưỡng trong kỳ này.']);

  kh.them([]);
  kh.them(['Tổng: ' + kq.tong.soVuotTong + ' lần vượt ngưỡng = ' +
    kq.tong.soLanLoi + ' lần tính lỗi (thợ rảnh) + ' + kq.tong.soVuotKhiBan +
    ' lần không tính (thợ bận).']);

  kh.ghi();
  dau.dinhDang();
  _headBang_(sh, dHead, SO_COT);
  function dsO_(ds) { return ds.map(function (d) { return 'A' + d + ':L' + d; }); }
  if (dongRanh.length) sh.getRangeList(dsO_(dongRanh)).setBackground(MAU_RANH);
  if (dongBan.length) sh.getRangeList(dsO_(dongBan)).setBackground(MAU_BAN);
  sh.setColumnWidth(2, 130);
  sh.setColumnWidth(6, 180);
  sh.setFrozenRows(dHead);
}

// ============================================================================
// TRANG 4 — Kiem_Tra_Ranh
// ============================================================================

function ghiKiemTraRanh_(ssMoi, kq, ctx) {
  const sh = ssMoi.insertSheet('Kiem_Tra_Ranh');
  const SO_COT = 10;
  const kh = _khungTrang_(sh, SO_COT);
  const dau = _dauTrang_(kh, sh, 'KIỂM TRA ĐIỀU KIỆN "THỢ RẢNH"', ctx, SO_COT);
  const mocMuc = [], mocHead = [];

  kh.them([]);
  kh.them(['Trang này tồn tại để người nghi ngờ con số tự kiểm được: phép đếm ' +
    'chỉ tính phiếu tới lúc thợ rảnh, nên phải chứng minh được việc chia nhóm đúng.']);

  // --- Bước 1: chia hai nhóm ------------------------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['BƯỚC 1 — CHIA HAI NHÓM']));
  mocHead.push(kh.them(['Nhóm', 'Số phiếu', 'Tỷ lệ', 'Điều kiện']));
  const t = kq.tong;
  kh.them(['Thợ RẢNH', t.soRanh, tyLe_(t.soRanh, t.soPhieuSuCo) + '%',
    'So_Chong_Viec = 0 VÀ Phut_Cho_Tho_Ban = 0']);
  kh.them(['Thợ BẬN', t.soBan, tyLe_(t.soBan, t.soPhieuSuCo) + '%',
    'Một trong hai ô khác 0']);
  kh.them(['CHƯA TÍNH (loại)', t.soChuaTinh, tyLe_(t.soChuaTinh, t.soPhieuSuCo) + '%',
    'Hai ô còn TRỐNG — không ngầm coi là 0']);
  kh.them(['THIẾU SỐ (loại)', t.soThieuSo, tyLe_(t.soThieuSo, t.soPhieuSuCo) + '%',
    'Cả Phut_Dap_Ung_Thuc lẫn Phut_KPI_Tho đều trống']);
  kh.them(['TỔNG phiếu sự cố', t.soPhieuSuCo, '100%',
    'Rảnh + Bận + Chưa tính + Thiếu số']);

  // --- Bước 2: vượt ngưỡng nhưng thợ bận -----------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['BƯỚC 2 — VƯỢT NGƯỠNG NHƯNG THỢ ĐANG BẬN (' +
    t.soVuotKhiBan + ' phiếu, KHÔNG tính lỗi)']));
  mocHead.push(kh.them(['Mã sự cố', 'Ngày', 'Thợ', 'Máy', 'Ngưỡng',
    'Đáp ứng (phút)', 'Vượt', 'Chờ do thợ bận', 'Số chồng việc']));
  const dsBan = kq.dsPhieuLoi.filter(function (p) { return !p.tinhLoi; });
  if (!dsBan.length) kh.them(['Không có phiếu nào thuộc nhóm này.']);
  dsBan.forEach(function (p) {
    kh.them([p.maSuCo, ngayVN_(p.ngay), p.tenTho, p.tenMay, p.nguong,
      p.soPhut, p.vuot, _soHoacGach_(p.phutChoThoBan), _soHoacGach_(p.soChongViec)]);
  });

  // --- Bước 3: mức độ chồng việc từng thợ ----------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['BƯỚC 3 — MỨC ĐỘ CHỒNG VIỆC TỪNG THỢ']));
  mocHead.push(kh.them(['Thợ', 'Phiếu sự cố', 'Phiếu thợ rảnh', 'Phiếu thợ bận',
    'Tỷ lệ bận', 'Số lần chồng việc', 'Chờ do thợ bận TB (phút)']));
  kq.theoTho.filter(function (x) { return x.soPhieuSuCo > 0; }).forEach(function (x) {
    kh.them([x.ten, x.soPhieuSuCo, x.soRanh, x.soBan,
      tyLe_(x.soBan, x.soPhieuSuCo) + '%', x.soChongViec, _soHoacGach_(x.choBanTb)]);
  });

  // --- Phụ lục: lệch đẳng thức ---------------------------------------------
  kh.them([]);
  mocMuc.push(kh.them(['PHỤ LỤC — PHIẾU LỆCH ĐẲNG THỨC (' +
    kq.lechDangThuc.length + ' phiếu)']));
  kh.them(['Trên nhóm thợ RẢNH, Phut_Tiep_Nhan = Phut_Dap_Ung_Thuc = ' +
    'Phut_KPI_Tho: không bận thì không có gì để trừ. Lệch nhau là dấu hiệu dữ ' +
    'liệu hỏng — in ra chứ không được im.']);
  if (!kq.lechDangThuc.length) {
    kh.them(['✅ Không có phiếu nào lệch.']);
  } else {
    mocHead.push(kh.them(['Mã sự cố', 'Chi tiết lệch']));
    kq.lechDangThuc.forEach(function (x) {
      kh.them([x.maSuCo, x.lyDo + ' — ' + JSON.stringify(x)]);
    });
  }

  kh.ghi();
  dau.dinhDang();
  mocMuc.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT).merge()
      .setFontWeight('bold').setFontSize(12).setFontColor('#174ea6');
    sh.setRowHeight(d, 26);
  });
  mocHead.forEach(function (d) { _headBang_(sh, d, SO_COT); });
  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(4, 170);
  sh.setColumnWidth(SO_COT, 260);
}

// ============================================================================
// TRANG 5 — Theo_Ngay
// ============================================================================

function ghiTheoNgayDapUng_(ssMoi, kq, ctx) {
  const sh = ssMoi.insertSheet('Theo_Ngay');
  const SO_COT = 6;
  const kh = _khungTrang_(sh, SO_COT);
  const dau = _dauTrang_(kh, sh, 'LỖI ĐÁP ỨNG THEO NGÀY VÀ THEO BỘ PHẬN', ctx, SO_COT);
  const mocMuc = [], mocHead = [], mocTong = [];

  kh.them([]);
  mocMuc.push(kh.them(['THEO NGÀY — chỉ những ngày có phiếu']));
  mocHead.push(kh.them(['Ngày', 'Phiếu sự cố', 'Phiếu thợ rảnh', 'Số lần lỗi',
    'Lỗi / phiếu rảnh']));
  if (!kq.theoNgay.length) kh.them(['Kỳ này không có phiếu sự cố nào.']);
  kq.theoNgay.forEach(function (r) {
    kh.them([ngayVN_(r.ngay), r.soPhieu, r.soRanh, r.soLanLoi,
      r.soRanh ? tyLe_(r.soLanLoi, r.soRanh) + '%' : '—']);
  });
  if (kq.theoNgay.length) {
    mocTong.push(kh.them(['TỔNG', kq.tong.soPhieuSuCo, kq.tong.soRanh,
      kq.tong.soLanLoi, tyLe_(kq.tong.soLanLoi, kq.tong.soRanh) + '%']));
  }

  kh.them([]);
  mocMuc.push(kh.them(['THEO BỘ PHẬN']));
  mocHead.push(kh.them(['Bộ phận', 'Phiếu sự cố', 'Phiếu thợ rảnh', 'Số lần lỗi',
    'Lỗi / phiếu rảnh']));
  kq.theoBoPhan.forEach(function (r) {
    kh.them([r.boPhan, r.soPhieu, r.soRanh, r.soLanLoi,
      r.soRanh ? tyLe_(r.soLanLoi, r.soRanh) + '%' : '—']);
  });
  if (kq.theoBoPhan.length) {
    mocTong.push(kh.them(['TỔNG', kq.tong.soPhieuSuCo, kq.tong.soRanh,
      kq.tong.soLanLoi, tyLe_(kq.tong.soLanLoi, kq.tong.soRanh) + '%']));
  }

  kh.ghi();
  dau.dinhDang();
  mocMuc.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT).merge()
      .setFontWeight('bold').setFontSize(12).setFontColor('#174ea6');
  });
  mocHead.forEach(function (d) { _headBang_(sh, d, SO_COT); });
  mocTong.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT).setBackground('#e6f4ea').setFontWeight('bold');
  });
  sh.setColumnWidth(1, 150);
  for (let c = 2; c <= SO_COT; c++) sh.setColumnWidth(c, 120);
}

// ============================================================================
// TRANG 6 — Dien_Giai
// ============================================================================

function ghiDienGiai_(ssMoi, kq, ctx) {
  const sh = ssMoi.insertSheet('Dien_Giai');
  const SO_COT = 3;
  const kh = _khungTrang_(sh, SO_COT);
  const dau = _dauTrang_(kh, sh, 'DIỄN GIẢI — MỖI CHỈ TIÊU LẤY TỪ ĐÂU', ctx, SO_COT);
  kh.them([]);
  kh.them(['Trang này để người nghi ngờ số liệu tự kiểm được mà không phải hỏi ai.']);
  kh.them([]);
  const dHead = kh.them(['Chỉ tiêu', 'Định nghĩa', 'Lấy từ đâu']);

  [
    ['Phiếu sự cố', 'Phiếu có người báo và đo được thời gian đáp ứng: SC- và HT-. ' +
      'Việc chung (CV-), bảo trì (BT-), dừng máy (DM-) không đo đáp ứng.',
      'laDoDapUng_() trong Code.gs — đúng một cửa, không có cửa thứ hai'],
    ['Ngưỡng của thợ', 'Số phút chủ quản CHỈ ĐỊNH cho từng thợ. Là dữ liệu chính ' +
      'sách, không phải máy tính ra. Sửa trên sheet có hiệu lực ngay, không cần deploy.',
      'Danh_Muc_Tho, cột Nguong_KPI_Phut. Trống → Cau_Hinh.NGUONG_KPI_DAP_UNG_PHUT. ' +
      'Trống nữa → chưa chốt, không chấm.'],
    ['Số phút đáp ứng', 'Số phút đem so với ngưỡng. Đã trừ khoảng thợ đang cầm ' +
      'việc khác, nên là phần thật sự thuộc về thợ.',
      'Su_Co, cột Phut_Dap_Ung_Thuc. Trống thì lấy Phut_KPI_Tho. ' +
      'KHÔNG dùng Phut_Tiep_Nhan — cột đó chưa trừ lúc thợ bận.'],
    ['Thợ RẢNH', 'Lúc phiếu tới, thợ không cầm việc nào khác và máy không phải ' +
      'chờ vì thợ bận.', 'So_Chong_Viec = 0 VÀ Phut_Cho_Tho_Ban = 0'],
    ['Thợ BẬN', 'Một trong hai ô trên khác 0. Vượt ngưỡng vẫn KHÔNG tính lỗi — ' +
      'máy chờ vì thiếu người là chuyện khác với thợ chậm. Liệt kê riêng ở Kiem_Tra_Ranh.',
      'Cùng hai cột trên'],
    ['CHƯA TÍNH', 'Hai ô trên còn TRỐNG. Loại khỏi phép đếm, KHÔNG ngầm coi là 0 ' +
      'rồi tính thành rảnh — làm vậy là chấm lỗi oan cho phiếu chưa ai tính.',
      'Bấm 🔧 Bảo trì → 🎯 Tính lại KPI đáp ứng của thợ, rồi xuất lại'],
    ['MỘT LẦN LỖI', 'Phiếu đo được đáp ứng, tới lúc thợ RẢNH, và số phút đáp ứng ' +
      'LỚN HƠN ngưỡng của chính thợ đó. Đúng bằng ngưỡng thì KHÔNG tính.',
      'demLoiDapUng_() trong LoiDapUng.gs — hàm thuần, có kiểm thử chạy bằng node'],
    ['Vượt ngưỡng khi bận', 'Vượt ngưỡng nhưng thợ đang bận. Không cộng vào số lần ' +
      'lỗi, nhưng in riêng để chủ quản tự quyết.', 'Trang Kiem_Tra_Ranh, bước 2'],
    ['Tổng vượt ngưỡng', 'Số lần lỗi + vượt ngưỡng khi bận.', 'Trang Phieu_Loi'],
    ['Đổi vị trí đáp ứng ↔ sửa', 'Thợ quên bấm nhận việc nên hệ ghi thời gian SỬA ' +
      'thành thời gian máy CHỜ và ngược lại. Quy tắc: phút sửa ≤ ' +
      ctx.xuLyToiDa + ' VÀ phút đáp ứng > ' + ctx.dapUngToiThieu +
      '. Phiếu quy tắc không bắt được thì chủ quản khai tay.',
      'Cau_Hinh.DOI_VI_TRI_* · sheet KPI_Doi_Vi_Tri · apDungDoiViTri_()'],
    ['Dữ liệu gốc', 'Phép đổi vị trí CHỈ diễn ra trong bộ nhớ lúc lập báo cáo. ' +
      'Không bao giờ ghi số đã đổi ngược vào Su_Co / Luu_Tru — dữ liệu gốc là bằng chứng.',
      'Trang Du_Lieu_Nguon in cả số gốc lẫn số sau đổi'],
    ['Chậm nhất', 'Số phút đáp ứng lớn nhất trong các phiếu VƯỢT NGƯỠNG của thợ đó.',
      'Trang Theo_Tho'],
    ['Đáp ứng thực TB', 'Trung bình số phút đáp ứng, gom CẢ phiếu thợ bận — mô tả ' +
      'hiện trạng. Khác với phép đếm lỗi vốn chỉ xét nhóm thợ rảnh.', 'Trang Theo_Tho'],
    ['Số lần chồng việc', 'Số phiếu mà lúc thợ bấm nhận, thợ đang giữ dở ít nhất ' +
      'một phiếu khác.', 'Su_Co, cột So_Chong_Viec > 0'],
    ['Nguồn dữ liệu', 'Cả sheet Su_Co lẫn sheet Luu_Tru. Phiếu hoàn thành của các ' +
      'tháng trước đã bị dời sang lưu trữ.', 'docSuCoVaLuuTru_()'],
    ['Mọi con số', 'Tính sẵn ở server bằng JavaScript. Không ô nào là công thức ' +
      'Sheets — nguyên tắc gốc của dự án, để né lỗi locale và #ERROR!.',
      'LoiDapUng.gs + BaoCaoDapUng.gs'],
  ].forEach(function (r) { kh.them(r); });

  kh.ghi();
  dau.dinhDang();
  _headBang_(sh, dHead, SO_COT);
  sh.setColumnWidth(1, 190);
  sh.setColumnWidth(2, 480);
  sh.setColumnWidth(3, 380);
  sh.getRange(dHead + 1, 1, kh.soDong() - dHead, SO_COT)
    .setWrap(true).setVerticalAlignment('top');
  sh.setFrozenRows(dHead);
}

// ============================================================================
// TRANG 7 — Du_Lieu_Nguon
// ============================================================================

function ghiDuLieuNguon_(ssMoi, kq, ctx) {
  // Sheet đầu tiên do SpreadsheetApp.create() sinh ra — dùng lại, khỏi để lại
  // một sheet trống vô nghĩa trong file.
  const sh = ssMoi.getSheets()[0];
  sh.setName('Du_Lieu_Nguon');

  // Bảng tra phiếu nào đã bị đổi vị trí, để in kèm số gốc và lý do.
  const doiTheoMa = {};
  ctx.doi.dsDoi.forEach(function (d) { doiTheoMa[d.maSuCo] = d; });

  const header = ['Ma_Su_Co', 'Ngay', 'Thợ', 'Bộ phận', 'Mã máy', 'Tên máy',
    'Loại phiếu', 'Ngưỡng áp dụng', 'Rảnh hay bận', 'Số phút đáp ứng',
    'Có tính lỗi', 'Số phút vượt',
    'Phut_Tiep_Nhan', 'Phut_Cho_Tho_Ban', 'So_Chong_Viec', 'Phut_Xu_Ly',
    'Đáp ứng GỐC (trước đổi)', 'Sửa GỐC (trước đổi)', 'Lý do đổi vị trí'];
  const luoi = [header];

  kq.dsNguon.forEach(function (r) {
    const d = doiTheoMa[r.maSuCo];
    luoi.push([r.maSuCo, ngayVN_(r.ngay), r.tenTho, r.boPhan, r.maMay, r.tenMay,
      r.loai, r.nguong || '—',
      r.trangThai === 'RANH' ? 'RẢNH' : (r.trangThai === 'BAN' ? 'BẬN' : 'CHƯA TÍNH'),
      _soHoacGach_(r.soPhut),
      r.tinhLoi ? 'CÓ' : 'không', _soHoacGach_(r.vuot),
      _soHoacGach_(r.phutTiepNhan), _soHoacGach_(r.phutChoThoBan),
      _soHoacGach_(r.soChongViec), _soHoacGach_(r.phutXuLy),
      d ? d.dapUngGoc : '', d ? d.suaGoc : '',
      d ? (d.nguon === 'QUY_TAC' ? 'quy tắc: ' : 'khai tay: ') + d.lyDo : '']);
  });

  sh.getRange(1, 1, luoi.length, header.length).setValues(luoi);
  _headBang_(sh, 1, header.length);
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 130);
  sh.setColumnWidth(6, 180);
  sh.setColumnWidth(header.length, 300);
  // Bật bộ lọc sẵn: người đọc lọc theo thợ hoặc theo "có tính lỗi" là kiểm được
  // ngay từng con số ở các trang trên.
  sh.getRange(1, 1, luoi.length, header.length).createFilter();
}
