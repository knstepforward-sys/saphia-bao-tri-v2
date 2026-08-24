/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * CẬP NHẬT DANH MỤC MÁY THEO BỘ PHẬN
 *
 * Thay toàn bộ danh sách máy của một bộ phận bằng danh sách mới: thêm máy chưa
 * có, cập nhật tên máy đã có, và dọn những mã cũ không còn trong danh sách.
 *
 * Quy tắc dọn — KHÔNG xoá bừa:
 *   - Mã cũ CHƯA từng có phiếu nào  → xoá hẳn dòng.
 *   - Mã cũ ĐÃ có phiếu trong lịch sử → chỉ bỏ tick Hoat_Dong, giữ nguyên dòng.
 * Xoá một máy đã có phiếu sẽ làm báo cáo theo máy mất dòng đối chiếu, mà lịch sử
 * hư hỏng là thứ không dựng lại được.
 */

/**
 * Danh mục MTX mới — khai theo dải vì mã đánh số liên tục và đều.
 * Sinh ra mã dạng <tienTo> + số 2 chữ số, tên dạng "<ten> ##".
 * Thêm/bớt máy về sau thì sửa ngay ở đây rồi chạy lại hàm bên dưới.
 */
const DANH_MUC_MTX = [
  { tienTo: '1K',    ten: 'Máy 1 kim',              tu: 1, den: 45 },
  { tienTo: 'KS',    ten: 'Máy Kansai',             tu: 1, den: 6 },
  { tienTo: '2K',    ten: 'Máy 2 kim',              tu: 1, den: 6 },
  { tienTo: 'LT',    ten: 'Máy lập trình',          tu: 1, den: 5 },
  { tienTo: 'MCQTX', ten: 'Máy cắt quai túi xách',  tu: 1, den: 2 },
];

/** Bung các dải thành mảng { ma, ten }. */
function bungDanhMuc_(dai) {
  const ds = [];
  dai.forEach(function (d) {
    for (let i = d.tu; i <= d.den; i++) {
      const so = pad2_(i);
      ds.push({ ma: d.tienTo + so, ten: d.ten + ' ' + so });
    }
  });
  return ds;
}

/**
 * Đồng bộ danh mục máy của một bộ phận.
 * @param {string} boPhan   mã bộ phận, ví dụ 'MTX'
 * @param {Array}  dsMoi    [{ma, ten}] — danh sách máy đúng của bộ phận đó
 */
function dongBoDanhMucBoPhan_(boPhan, dsMoi) {
  const bp = String(boPhan).trim().toUpperCase();
  const sh = sheet_(SHEET.MAY);
  const soDong = sh.getLastRow() - 1;
  if (soDong < 1) throw new Error('Danh_Muc_May chưa có dòng nào.');

  const vung = sh.getRange(2, 1, soDong, HEADER_MAY.length);
  const v = vung.getValues();
  const iHD = HEADER_MAY.indexOf('Hoat_Dong');

  // Mã máy đã từng xuất hiện trong phiếu — dùng để quyết định xoá hay chỉ tắt.
  const daDungTrongPhieu = {};
  docSuCoVaLuuTru_().forEach(function (p) {
    const ma = String(p[COT.Ma_May]).trim().toUpperCase();
    if (ma) daDungTrongPhieu[ma] = true;
  });

  const canCo = {};
  dsMoi.forEach(function (m) { canCo[m.ma.toUpperCase()] = m; });

  const kq = { them: [], capNhat: [], xoa: [], tat: [], trung: [] };

  // --- Duyệt các dòng đang có ----------------------------------------------
  const daThay = {};
  const giuLai = [];

  v.forEach(function (r) {
    const ma = String(r[0]).trim();
    if (!ma) return;                       // dòng trống, bỏ luôn
    const maU = ma.toUpperCase();
    const boPhanDong = String(r[2]).trim().toUpperCase();

    if (canCo[maU]) {
      if (daThay[maU]) { kq.trung.push(ma); return; }  // trùng mã → bỏ bản sau
      daThay[maU] = true;
      const m = canCo[maU];
      if (String(r[1]).trim() !== m.ten || boPhanDong !== bp || !laTrue_(r[iHD])) {
        r[1] = m.ten;
        r[2] = bp;
        r[iHD] = true;
        kq.capNhat.push(ma);
      }
      giuLai.push(r);
      return;
    }

    // Máy của bộ phận này nhưng KHÔNG còn trong danh sách mới → mã cũ.
    if (boPhanDong === bp) {
      if (daDungTrongPhieu[maU]) {
        r[iHD] = false;
        kq.tat.push(ma);
        giuLai.push(r);
      } else {
        kq.xoa.push(ma);                   // không đưa vào giuLai = xoá
      }
      return;
    }

    giuLai.push(r);                        // bộ phận khác, không đụng tới
  });

  // --- Thêm máy mới chưa có -------------------------------------------------
  dsMoi.forEach(function (m) {
    if (daThay[m.ma.toUpperCase()]) return;
    const r = new Array(HEADER_MAY.length).fill('');
    r[0] = m.ma;
    r[1] = m.ten;
    r[2] = bp;
    r[iHD] = true;
    giuLai.push(r);
    kq.them.push(m.ma);
  });

  // --- Ghi lại toàn bộ vùng -------------------------------------------------
  if (giuLai.length) {
    sh.getRange(2, 1, giuLai.length, HEADER_MAY.length).setValues(giuLai);
  }
  if (soDong > giuLai.length) {
    sh.getRange(giuLai.length + 2, 1, soDong - giuLai.length, HEADER_MAY.length)
      .clearContent();
  }

  return kq;
}

/** Chạy đồng bộ cho bộ phận MTX. Gọi từ menu. */
function capNhatDanhMucMTX() {
  const dsMoi = bungDanhMuc_(DANH_MUC_MTX);
  const kq = dongBoDanhMucBoPhan_('MTX', dsMoi);

  const dong = [];
  dong.push('Bộ phận MTX giờ có ' + dsMoi.length + ' máy.');
  dong.push('');
  dong.push('• Thêm mới      : ' + kq.them.length +
    (kq.them.length ? ' (' + kq.them.slice(0, 6).join(', ') +
      (kq.them.length > 6 ? '…' : '') + ')' : ''));
  dong.push('• Cập nhật tên  : ' + kq.capNhat.length);
  dong.push('• Xoá mã cũ     : ' + kq.xoa.length +
    (kq.xoa.length ? ' (' + kq.xoa.join(', ') + ')' : ''));
  dong.push('• Tắt mã cũ     : ' + kq.tat.length +
    (kq.tat.length ? ' (' + kq.tat.join(', ') + ') — giữ lại vì đã có phiếu' : ''));
  if (kq.trung.length) dong.push('• Bỏ dòng trùng : ' + kq.trung.join(', '));
  dong.push('');
  dong.push('⚠️ Chạy tiếp menu "4. Sinh lại link QR / link cá nhân" để các máy mới có Link_QR,');
  dong.push('rồi mới in QR. Máy mới chưa có link thì trang in sẽ bỏ trống.');

  return dong.join('\n');
}

function menuCapNhatMTX() { chayVaBao_('Cập nhật danh mục MTX', capNhatDanhMucMTX); }

// ============================================================================
// Thêm máy lẻ
// ============================================================================

/**
 * Danh sách máy cần THÊM. Khác dongBoDanhMucBoPhan_ ở chỗ hàm này chỉ THÊM,
 * không xoá và không tắt bất kỳ máy nào đang có — an toàn để chạy bất cứ lúc nào.
 *
 * Lần sau cần thêm máy: sửa danh sách ở đây rồi chạy lại menu. Mã đã tồn tại thì
 * tự bỏ qua, nên để nguyên danh sách cũ cũng không sao.
 */
const MAY_THEM_MOI = [
  { ma: 'CMTD02', ten: 'Máy cắt may tự động số 02', boPhan: 'CMTX' },
  { ma: 'CMTD03', ten: 'Máy cắt may tự động số 03', boPhan: 'CMTX' },
];

function themMayMoi() {
  const sh = sheet_(SHEET.MAY);
  const iHD = HEADER_MAY.indexOf('Hoat_Dong');

  const daCo = {};
  docSheet_(SHEET.MAY, HEADER_MAY).forEach(function (m) {
    const ma = String(m.Ma_May).trim().toUpperCase();
    if (ma) daCo[ma] = String(m.Ten_May).trim();
  });

  const them = [];
  const boQua = [];

  MAY_THEM_MOI.forEach(function (m) {
    const ma = String(m.ma).trim();
    if (daCo[ma.toUpperCase()] !== undefined) {
      boQua.push(ma + ' (đã có: ' + daCo[ma.toUpperCase()] + ')');
      return;
    }
    const r = new Array(HEADER_MAY.length).fill('');
    r[0] = ma;
    r[1] = String(m.ten).trim();
    r[2] = String(m.boPhan).trim().toUpperCase();
    r[iHD] = true;
    them.push(r);
  });

  if (them.length) {
    sh.getRange(sh.getLastRow() + 1, 1, them.length, HEADER_MAY.length).setValues(them);
  }

  return 'Đã thêm ' + them.length + ' máy.' +
    (them.length ? '\n  ' + them.map(function (r) { return r[0] + ' — ' + r[1]; }).join('\n  ') : '') +
    (boQua.length ? '\n\nBỏ qua vì đã tồn tại:\n  ' + boQua.join('\n  ') : '') +
    (them.length
      ? '\n\n⚠️ Chạy tiếp menu "4. Sinh lại link QR / link cá nhân" rồi in QR cho máy mới.'
      : '');
}

function menuThemMay() { chayVaBao_('Thêm máy mới', themMayMoi); }
