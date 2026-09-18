/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * TRANG IN MÃ QR — dựng lưới QR sẵn để in ra, cắt và dán lên máy.
 *
 * Truy cập: ?page=qr&loai=may&key=...   hoặc   ?page=qr&loai=tho&key=...
 *
 * PHẢI có khoá: trang này liệt kê toàn bộ link, mà link cá nhân của thợ chứa
 * token bí mật. Web app mở ẩn danh nên không có khoá thì bất kỳ ai có URL đều
 * lấy được quyền của cả 13 thợ.
 *
 * Ảnh QR sinh bởi api.qrserver.com. Google Charts QR API (chart.googleapis.com)
 * đã ngừng hoạt động — trả 404, đã kiểm chứng, đừng quay lại dùng nó.
 */

/** Kích thước và mức sửa lỗi của ảnh QR. */
const QR_KICH_THUOC = 500;   // px, đủ nét khi in ~5cm
const QR_SUA_LOI = 'M';      // chịu được ~15% bẩn/xước — môi trường xưởng

function urlAnhQr_(noiDung) {
  return 'https://api.qrserver.com/v1/create-qr-code/' +
    '?size=' + QR_KICH_THUOC + 'x' + QR_KICH_THUOC +
    '&ecc=' + QR_SUA_LOI +
    '&margin=8' +
    '&data=' + encodeURIComponent(noiDung);
}

/**
 * Khoá truy cập trang in. Sinh ngẫu nhiên lần đầu và lưu vào Cau_Hinh để người
 * dùng thấy được, đổi được, và xoá được khi không cần in nữa.
 */
function layKhoaInQr_() {
  const ch = docCauHinh_();
  const cu = String(ch.KHOA_IN_QR || '').trim();
  if (cu) return cu;

  const moi = Utilities.getUuid().replace(/-/g, '').substring(0, 12);
  const sh = sheet_(SHEET.CAU_HINH);
  const dong = sh.getLastRow() + 1;
  sh.getRange(dong, 2).setNumberFormat('@'); // đặt dạng text TRƯỚC khi ghi
  sh.getRange(dong, 1, 1, HEADER_CAU_HINH.length).setValues([[
    'KHOA_IN_QR', moi,
    'Khoá mở trang in mã QR. Ai có khoá này xem được TOÀN BỘ link cá nhân của ' +
    'thợ (gồm token). Xoá trắng ô này khi in xong; lần in sau hệ thống tự sinh khoá mới.',
  ]]);
  return moi;
}

function kiemKhoaInQr_(key) {
  const dung = String(docCauHinh_().KHOA_IN_QR || '').trim();
  return !!dung && String(key || '').trim() === dung;
}

/**
 * Dữ liệu cho trang in.
 * Ưu tiên link đã lưu sẵn ở cột Link_QR / Link_Ca_Nhan — đó là link thật đang
 * phát cho người dùng. Chưa sinh link thì báo lỗi thay vì tự dựng link khác,
 * tránh in ra QR trỏ đi một nơi mà hệ thống không biết.
 */
function layDanhSachQr_(loai) {
  if (loai === 'tho') {
    const ds = docSheet_(SHEET.THO, HEADER_THO)
      .filter(function (t) { return String(t.Ma_Tho).trim() && laTrue_(t.Hoat_Dong); })
      .map(function (t) {
        return {
          ma: String(t.Ma_Tho).trim(),
          ten: String(t.Ten_Tho).trim(),
          phu: String(t.Chuyen_Mon).trim() + ' · ' + String(t.Nhom_Ca).trim(),
          url: String(t.Link_Ca_Nhan || '').trim(),
        };
      });
    return ds;
  }

  if (loai === 'to') {
    return docSheet_(SHEET.TO, HEADER_TO)
      .filter(function (t) { return String(t.Bo_Phan).trim() && laTrue_(t.Hoat_Dong); })
      .map(function (t) {
        return {
          ma: String(t.Bo_Phan).trim(),
          ten: String(t.Ten_To || t.Bo_Phan).trim(),
          phu: String(t.Ten_To_Truong || '').trim(),
          url: String(t.Link_Khai_Bao || '').trim(),
        };
      });
  }

  return docSheet_(SHEET.MAY, HEADER_MAY)
    .filter(function (m) { return String(m.Ma_May).trim() && laTrue_(m.Hoat_Dong); })
    .map(function (m) {
      return {
        ma: String(m.Ma_May).trim(),
        ten: String(m.Ten_May).trim(),
        phu: String(m.Bo_Phan).trim(),
        url: String(m.Link_QR || '').trim(),
      };
    });
}

/** Dựng trang in. Gọi từ doGet khi có ?page=qr. */
function renderTrangQr_(p) {
  if (!kiemKhoaInQr_(p.key)) {
    return trangThongBao_('Không có quyền',
      'Trang in mã QR cần khoá truy cập. Mở từ menu 🔧 Bảo trì → "🖨️ In mã QR" trong Google Sheet.');
  }

  const loaiRaw = String(p.loai || 'may').trim().toLowerCase();
  const loai = (loaiRaw === 'tho' || loaiRaw === 'to') ? loaiRaw : 'may';
  const ds = layDanhSachQr_(loai);
  const thieuLink = ds.filter(function (x) { return !x.url; });

  if (!ds.length) {
    return trangThongBao_('Chưa có dữ liệu', {
      tho: 'Danh_Muc_Tho chưa có ai đang hoạt động.',
      to: 'Danh_Muc_To chưa có tổ nào đang hoạt động (nhớ tick Hoat_Dong).',
    }[loai] || 'Danh_Muc_May chưa có máy nào đang hoạt động.');
  }
  if (thieuLink.length === ds.length) {
    return trangThongBao_('Chưa sinh link',
      'Chạy menu 🔧 Bảo trì → "4. Sinh lại link QR / link cá nhân" trước đã.');
  }

  // Gắn sẵn ảnh QR để trang không phải gọi thêm vòng nào về server.
  ds.forEach(function (x) { x.anh = x.url ? urlAnhQr_(x.url) : ''; });

  const tieuDe = { tho: 'In mã QR — Thợ', to: 'In mã QR — Tổ trưởng' }[loai] || 'In mã QR — Máy';
  return renderTrang_('InQr', tieuDe, {
    loai: loai,
    duLieu: JSON.stringify(ds),
    soThieu: thieuLink.length,
  });
}

// ============================================================================
// Menu
// ============================================================================

function menuInQr() {
  const ui = SpreadsheetApp.getUi();
  const goc = layUrlCongKhai_() || layWebAppUrl_();
  const khoa = layKhoaInQr_();
  const noi = goc.indexOf('?') === -1 ? '?' : '&';

  const linkMay = goc + noi + 'page=qr&loai=may&key=' + encodeURIComponent(khoa);
  const linkTho = goc + noi + 'page=qr&loai=tho&key=' + encodeURIComponent(khoa);
  const linkTo = goc + noi + 'page=qr&loai=to&key=' + encodeURIComponent(khoa);

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6">' +
    '<p style="margin:0 0 14px">Mở trang in, rồi bấm <b>Ctrl+P</b> để in ra giấy đề-can, ' +
    'cắt theo đường kẻ và dán lên máy.</p>' +
    '<p style="margin:0 0 8px"><a href="' + linkMay + '" target="_blank" rel="noopener" ' +
    'style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;' +
    'padding:10px 18px;border-radius:8px;font-weight:600">🖨️ QR của MÁY</a></p>' +
    '<p style="margin:0 0 8px"><a href="' + linkTho + '" target="_blank" rel="noopener" ' +
    'style="display:inline-block;background:#e37400;color:#fff;text-decoration:none;' +
    'padding:10px 18px;border-radius:8px;font-weight:600">🖨️ QR của THỢ</a></p>' +
    '<p style="margin:0 0 14px"><a href="' + linkTo + '" target="_blank" rel="noopener" ' +
    'style="display:inline-block;background:#188038;color:#fff;text-decoration:none;' +
    'padding:10px 18px;border-radius:8px;font-weight:600">🖨️ QR của TỔ TRƯỞNG</a></p>' +
    '<p style="margin:0;padding:10px 12px;background:#fef7e0;border-left:4px solid #e37400;' +
    'border-radius:6px;color:#7a4f01;font-size:13px">' +
    '<b>QR của thợ và của tổ trưởng chứa mật khẩu đăng nhập của người đó.</b> Chỉ in và đưa ' +
    'tận tay từng người, không dán lên tường, không chụp gửi nhóm chung.</p>' +
    '<p style="margin:14px 0 0;color:#5f6368;font-size:12.5px">Khoá mở trang in nằm ở dòng ' +
    '<code>KHOA_IN_QR</code> trong sheet <b>Cau_Hinh</b>. In xong nên xoá trắng ô đó.</p>' +
    '</div>'
  ).setWidth(460).setHeight(400);

  ui.showModalDialog(html, 'In mã QR');
}
