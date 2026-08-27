/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * BÁO CÁO TỈ LỆ KHẢ DỤNG MÁY — chức năng độc lập với báo cáo bảo trì hiện có.
 *
 * Báo cáo luôn lấy toàn bộ máy Hoat_Dong = TRUE trong phạm vi bộ phận đã chọn.
 * A = (kế hoạch - dừng trong kế hoạch) / kế hoạch. Nghỉ trưa và giao ca đã bị
 * loại khỏi kế hoạch ở HieuDung.gs trước khi tính downtime.
 */

const SO_COT_KHA_DUNG = 8;
const MAU_BO_PHAN_KHA_DUNG = [
  ['#dceeff', '#f5faff'],
  ['#e3f4e8', '#f6fbf7'],
  ['#fff1cf', '#fffbf1'],
  ['#eee5fb', '#faf7fe'],
  ['#dff3f1', '#f5fbfa'],
  ['#fde7ef', '#fff7fa'],
];

/** Dữ liệu ban đầu cho hộp thoại xuất báo cáo khả dụng. */
function layDuLieuHopKhaDung() {
  const boPhan = {};
  docSheet_(SHEET.MAY, HEADER_MAY).forEach(function (m) {
    if (!batCauHinh_(m.Hoat_Dong, false)) return;
    const ten = String(m.Bo_Phan || '').trim();
    if (ten) boPhan[ten] = true;
  });
  const homNay = fmtNgay_(nowVN_());
  return {
    homNay: homNay,
    thangNay: homNay.slice(0, 7),
    boPhan: Object.keys(boPhan).sort(function (a, b) { return a.localeCompare(b); }),
  };
}

/** RPC an toàn cho HopKhaDung.html. */
function chayXuatBaoCaoKhaDung(opts) {
  try {
    return xuatBaoCaoKhaDung(opts);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Mở hộp thoại của chức năng báo cáo mới. */
function menuBaoCaoKhaDung() {
  const html = HtmlService.createHtmlOutputFromFile('HopKhaDung')
    .setWidth(540).setHeight(570);
  SpreadsheetApp.getUi().showModalDialog(html, 'Báo cáo tỉ lệ khả dụng máy');
}

/**
 * Tạo một Google Sheet mới chứa duy nhất báo cáo khả dụng.
 * opts = { cheDo: 'NGAY'|'THANG', ngay: 'yyyy-MM-dd', thang: 'yyyy-MM', dsBoPhan: [] }
 */
function xuatBaoCaoKhaDung(opts) {
  const o = opts || {};
  const cheDo = String(o.cheDo || 'NGAY').trim().toUpperCase();
  const homNay = fmtNgay_(nowVN_());
  let tuNgay = '';
  let denNgay = '';
  let nhanKy = '';
  let tenKy = '';

  if (cheDo === 'NGAY') {
    const ngay = String(o.ngay || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) throw new Error('Ngày phải dạng yyyy-MM-dd.');
    if (ngay > homNay) throw new Error('Không thể xuất báo cáo cho ngày trong tương lai.');
    tuNgay = ngay;
    denNgay = ngay;
    nhanKy = 'Ngày ' + ngay.slice(8, 10) + '/' + ngay.slice(5, 7) + '/' + ngay.slice(0, 4);
    tenKy = ngay;
  } else if (cheDo === 'THANG') {
    const thang = String(o.thang || '').trim();
    if (!/^\d{4}-\d{2}$/.test(thang)) throw new Error('Tháng phải dạng yyyy-MM.');
    if (thang > homNay.slice(0, 7)) throw new Error('Không thể xuất báo cáo cho tháng trong tương lai.');
    const p = thang.split('-');
    const cuoi = new Date(Date.UTC(Number(p[0]), Number(p[1]), 0)).getUTCDate();
    tuNgay = thang + '-01';
    denNgay = thang + '-' + pad2_(cuoi);
    nhanKy = 'Tháng ' + p[1] + '/' + p[0];
    tenKy = p[0] + '-' + p[1];
  } else {
    throw new Error('Chế độ báo cáo không hợp lệ.');
  }

  const dsLoc = Array.isArray(o.dsBoPhan) ? o.dsBoPhan : [];
  const loc = {};
  dsLoc.forEach(function (x) {
    const k = chuanKhoa_(x);
    if (k) loc[k] = true;
  });
  const coLoc = Object.keys(loc).length > 0;

  const dsMay = docSheet_(SHEET.MAY, HEADER_MAY).filter(function (m) {
    if (!String(m.Ma_May || '').trim() || !batCauHinh_(m.Hoat_Dong, false)) return false;
    return !coLoc || !!loc[chuanKhoa_(m.Bo_Phan)];
  });
  if (!dsMay.length) throw new Error('Không có máy đang hoạt động khớp bộ phận đã chọn.');

  // Báo cáo khả dụng chính thức luôn tính SC- làm máy dừng + DM-. CV-/BT- là
  // công việc của thợ, không đủ dữ liệu chắc chắn để kết luận máy ngừng sản xuất.
  const kq = tinhHieuDung_(tuNgay, denNgay, {
    bayGio: nowVN_(),
    congTac: { suCo: true, dungMay: true, congViec: false },
    dsMay: dsMay,
    dsPhieu: docSuCoVaLuuTru_(),
  });

  const tenFile = 'Bao_cao_kha_dung_' + (cheDo === 'NGAY' ? 'ngay_' : 'thang_') + tenKy;
  const ssMoi = SpreadsheetApp.create(tenFile);
  const sh = ssMoi.getSheets()[0];
  sh.setName(cheDo === 'NGAY' ? 'Kha_Dung_Ngay' : 'Kha_Dung_Thang');
  ghiBaoCaoKhaDung_(sh, kq, nhanKy);
  ssMoi.setActiveSheet(sh);
  SpreadsheetApp.flush();

  return {
    ok: true,
    url: ssMoi.getUrl(),
    tenFile: tenFile,
    nhanKy: nhanKy,
    soMay: kq.may.length,
    soMayGiam: kq.may.filter(function (m) { return m.tiLe !== null && m.tiLe < 1; }).length,
    thieuKeHoach: kq.thieuKeHoach,
  };
}

/** Ghi và định dạng một trang báo cáo, chia toàn bộ máy dưới đề mục bộ phận. */
function ghiBaoCaoKhaDung_(sh, kq, nhanKy) {
  const bang = [];
  const dongHeader = [];
  const khoiBoPhan = [];
  const dongMayGiam = [];
  const dongMayThieu = [];

  function them_(r) {
    const x = (r || []).slice(0, SO_COT_KHA_DUNG);
    while (x.length < SO_COT_KHA_DUNG) x.push('');
    bang.push(x);
    return bang.length;
  }

  them_(['BÁO CÁO TỈ LỆ KHẢ DỤNG TOÀN BỘ MÁY']);
  them_([nhanKy, '', '', 'Xuất lúc',
    Utilities.formatDate(nowVN_(), CONFIG.MUI_GIO, 'HH:mm dd/MM/yyyy')]);
  them_(['A = Thời gian chạy thực tế / Thời gian chạy kế hoạch. ' +
    'Nghỉ trưa và giao ca là dừng theo kế hoạch, không làm giảm A.']);
  let dongCanh = 0;
  if (kq.thieuKeHoach.length) {
    dongCanh = them_(['⚠ Chưa khai kế hoạch cho bộ phận: ' + kq.thieuKeHoach.join(', ') +
      '. Các máy này vẫn được liệt kê nhưng A để trống.']);
  }
  them_([]);

  const dongTongTieuDe = them_(['TỔNG TOÀN NHÀ MÁY']);
  const hTong = them_(['Số máy', 'Kế hoạch (giờ)', 'Dừng trong kế hoạch (giờ)',
    'Chạy thực tế (giờ)', 'A', 'Máy đạt 100%', 'Máy dưới 100%', 'Thiếu kế hoạch']);
  dongHeader.push(hTong);
  const soGiam = kq.may.filter(function (m) { return m.tiLe !== null && m.tiLe < 1; }).length;
  const dongTongGiaTri = them_([kq.tong.soMay, phutSangGio_(kq.tong.phutKeHoach), phutSangGio_(kq.tong.phutDung),
    phutSangGio_(kq.tong.phutChay), kq.tong.tiLe === null ? '—' : kq.tong.tiLe,
    kq.tong.soMayDu, soGiam,
    kq.may.filter(function (m) { return m.tiLe === null; }).length]);
  them_([]);

  const nhom = {};
  kq.may.forEach(function (m) {
    const bp = String(m.boPhan || '').trim() || '(không rõ bộ phận)';
    if (!nhom[bp]) nhom[bp] = [];
    nhom[bp].push(m);
  });

  Object.keys(nhom).sort(function (a, b) { return a.localeCompare(b); }).forEach(function (bp, iBp) {
    const ds = nhom[bp];
    ds.sort(function (a, b) {
      if (a.tiLe === null && b.tiLe !== null) return 1;
      if (a.tiLe !== null && b.tiLe === null) return -1;
      if (a.tiLe !== b.tiLe) return a.tiLe - b.tiLe;
      return String(a.maMay).localeCompare(String(b.maMay));
    });
    const kh = ds.reduce(function (t, m) { return t + m.phutKeHoach; }, 0);
    const dung = ds.reduce(function (t, m) { return t + m.phutDung; }, 0);
    const chay = Math.max(0, kh - dung);
    const aBp = kh > 0 ? chay / kh : null;

    const dongBp = them_(['BỘ PHẬN ' + bp + '  ·  ' + ds.length + ' máy  ·  A = ' + tiLeChu_(aBp)]);
    const dongH = them_(['STT', 'Mã máy', 'Tên máy', 'Kế hoạch (giờ)', 'Dừng (giờ)',
      'Chạy thực tế (giờ)', 'A', 'Ghi chú']);
    dongHeader.push(dongH);
    const dongDauMay = bang.length + 1;

    ds.forEach(function (m, i) {
      const giam = m.tiLe !== null && m.tiLe < 1;
      const d = them_([i + 1, m.maMay, m.tenMay, phutSangGio_(m.phutKeHoach),
        phutSangGio_(m.phutDung), phutSangGio_(m.phutChay),
        m.tiLe === null ? '—' : m.tiLe,
        m.tiLe === null ? 'Chưa khai kế hoạch' : (giam ? 'Giảm khả dụng' : '')]);
      if (giam) dongMayGiam.push(d);
      if (m.tiLe === null) dongMayThieu.push(d);
    });
    khoiBoPhan.push({
      dongTieuDe: dongBp,
      dongDauMay: dongDauMay,
      soMay: ds.length,
      mau: MAU_BO_PHAN_KHA_DUNG[iBp % MAU_BO_PHAN_KHA_DUNG.length],
    });
    them_([]);
  });

  sh.getRange(1, 1, bang.length, SO_COT_KHA_DUNG).setValues(bang);
  sh.getDataRange().setFontFamily('Arial').setFontSize(10)
    .setVerticalAlignment('middle').setWrap(true);

  // Tiêu đề và các dòng mô tả.
  sh.getRange(1, 1, 1, SO_COT_KHA_DUNG).merge()
    .setFontSize(16).setFontWeight('bold').setFontColor('#17324d')
    .setBackground('#dceeff').setHorizontalAlignment('center');
  sh.getRange(3, 1, 1, SO_COT_KHA_DUNG).merge().setFontColor('#52606d');
  if (dongCanh) {
    sh.getRange(dongCanh, 1, 1, SO_COT_KHA_DUNG).merge()
      .setBackground('#fff4ce').setFontColor('#7a4d00');
  }
  sh.getRange(dongTongTieuDe, 1, 1, SO_COT_KHA_DUNG)
    .setFontWeight('bold').setFontColor('#17324d');

  dongHeader.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_KHA_DUNG)
      .setFontWeight('bold').setBackground('#eaf2f8')
      .setHorizontalAlignment('center')
      .setBorder(true, true, true, true, true, true, '#c9d6e2', SpreadsheetApp.BorderStyle.SOLID);
  });

  khoiBoPhan.forEach(function (x) {
    sh.getRange(x.dongTieuDe, 1, 1, SO_COT_KHA_DUNG).merge()
      .setBackground(x.mau[0]).setFontColor('#17324d').setFontWeight('bold')
      .setFontSize(12).setHorizontalAlignment('left');
    sh.getRange(x.dongDauMay, 1, x.soMay, SO_COT_KHA_DUNG)
      .setBackground(x.mau[1])
      .setBorder(true, true, true, true, true, true, '#dde5ec', SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(x.dongDauMay, 7, x.soMay, 1).setNumberFormat('0.0%');
  });

  // Đúng yêu cầu: chỉ tên máy có A dưới 100% được tô đen và in đậm.
  dongMayGiam.forEach(function (d) {
    sh.getRange(d, 3).setFontWeight('bold').setFontColor('#000000');
    sh.getRange(d, 7).setBackground('#fff0c2').setFontWeight('bold');
  });
  dongMayThieu.forEach(function (d) {
    sh.getRange(d, 7, 1, 2).setBackground('#f1f3f4').setFontColor('#5f6368');
  });

  // Các ô A giữ dạng số để tải Excel vẫn tính/lọc được; ô thiếu kế hoạch giữ dấu —.
  sh.getRange(dongTongGiaTri, 5).setNumberFormat('0.0%');
  sh.setFrozenRows(dongTongGiaTri);
  sh.setColumnWidth(1, 58);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 250);
  sh.setColumnWidth(4, 125);
  sh.setColumnWidth(5, 110);
  sh.setColumnWidth(6, 145);
  sh.setColumnWidth(7, 85);
  sh.setColumnWidth(8, 180);
}
