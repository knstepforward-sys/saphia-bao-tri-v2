/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * BÁO CÁO TRONG NGÀY — một trang xem nhanh, mở ra là nắm được tình hình.
 *
 * Truy cập: ?page=ngay&d=yyyy-MM-dd&key=...
 * Mở từ menu 🔧 Bảo trì → "📋 Báo cáo trong ngày".
 *
 * Khác `Tong_Hop` (tổng hợp cả tháng, để phân tích) và khác file xuất theo biểu
 * mẫu Excel (để gửi sếp cuối tháng). Trang này trả lời đúng một câu hỏi:
 * "hôm nay xảy ra gì, còn gì đang treo".
 *
 * Gom theo Ngay_Ca chứ không theo ngày lịch — ca đêm vắt qua nửa đêm vẫn thuộc
 * về ngày nó bắt đầu, đúng như cách cả hệ thống đang tính.
 */

/**
 * Tạm tắt theo quyết định vận hành ngày 28/08/2026.
 *
 * Chỉ số A cần thêm bước tổ trưởng khai những máy có kế hoạch chạy theo ngày/ca;
 * trước khi có dữ liệu đó, hiển thị A sẽ ngầm coi mọi máy Hoat_Dong = TRUE đều
 * phải chạy và có thể làm báo cáo sai. Đổi thành true khi quy trình mới hoàn tất.
 */
const HIEN_HIEU_DUNG_BAO_CAO_NGAY = false;

/** Tên bộ phận để gom nhóm; phiếu thiếu bộ phận vẫn phải có chỗ đứng. */
function nhomBoPhan_(x) {
  return String(x.boPhan || '').trim() || '(không rõ bộ phận)';
}

/**
 * Sắp phiếu sự cố: GOM THEO BỘ PHẬN, trong mỗi bộ phận vẫn theo giờ.
 *
 * Thứ tự các bộ phận KHÔNG cố định theo bảng chữ cái hay theo mức độ ưu tiên —
 * bộ phận nào có sự cố sớm nhất thì đứng đầu, các bộ phận khác nối đuôi theo
 * đúng thứ tự xuất hiện trong ngày. Đọc bảng vẫn thấy được mạch thời gian của
 * ca, nhưng không còn cảnh các bộ phận cài răng lược vào nhau.
 */
function sapTheoBoPhanRoiGio_(ds) {
  const somNhat = {};
  ds.forEach(function (x) {
    const bp = nhomBoPhan_(x);
    const t = x.tsBao || 0;
    if (somNhat[bp] === undefined || t < somNhat[bp]) somNhat[bp] = t;
  });

  return ds.slice().sort(function (a, b) {
    const ba = nhomBoPhan_(a);
    const bb = nhomBoPhan_(b);
    if (ba !== bb) {
      if (somNhat[ba] !== somNhat[bb]) return somNhat[ba] - somNhat[bb];
      return ba.localeCompare(bb);   // cùng mốc sớm nhất thì xếp theo tên cho ổn định
    }
    return (a.tsBao || 0) - (b.tsBao || 0);
  });
}

/** Số phút một phiếu đã treo, tính tới lúc mở trang. */
function phutDaTreo_(v, bayGio) {
  const bao = v[COT.Thoi_Gian_Bao];
  if (!(bao instanceof Date)) return '';
  return Math.max(0, Math.round((bayGio.getTime() - bao.getTime()) / 60000));
}

function duLieuBaoCaoNgay_(ngay) {
  const bayGio = nowVN_();
  const tatCa = docSuCoVaLuuTru_();
  const ds = tatCa.filter(function (v) {
    return String(v[COT.Ngay_Ca]).trim() === ngay;
  });

  const suCo = ds.filter(laSuCo_);
  const dungMay = ds.filter(laDungMay_);
  const congViec = ds.filter(laCongViec_);
  const baoTri = ds.filter(laBaoTri_);

  // "Còn đang treo" quét TOÀN BỘ dữ liệu, KHÔNG lọc theo ngày đang xem.
  //
  // Trước đây bảng này lọc theo Ngay_Ca như mọi bảng khác, nên nó chỉ trả lời
  // "phiếu mở hôm nay mà chưa đóng" — đúng thứ ít nguy hiểm nhất. Máy đứng từ ba
  // hôm trước, hoặc phiếu dừng máy chờ phụ tùng mở tuần trước, lại bị giấu mất.
  // Người dùng phát hiện: bù phiếu treo từ 18/08 nhưng mở báo cáo ngày 21/08
  // không thấy đâu.
  //
  // Bỏ phiếu có Ngay_Ca SAU ngày đang xem, để xem lại báo cáo cũ không lòi ra
  // những phiếu lúc đó chưa tồn tại.
  const chuaDong = tatCa.filter(function (v) {
    if (laBaoTri_(v)) return false;
    if (v[COT.Trang_Thai] === TRANG_THAI.HOAN_THANH) return false;
    return String(v[COT.Ngay_Ca]).trim() <= ngay;
  });

  // --- Theo thợ -------------------------------------------------------------
  const theoTho = {};
  function tho_(ten) {
    if (!theoTho[ten]) {
      theoTho[ten] = { ten: ten, suCo: 0, congViec: 0, baoTri: 0, dapUng: [], xuLy: [] };
    }
    return theoTho[ten];
  }
  ds.forEach(function (v) {
    const ten = String(v[COT.Ten_Tho]).trim();
    if (!ten) return;
    const t = tho_(ten);
    if (laSuCo_(v)) t.suCo++;
    else if (laCongViec_(v)) t.congViec++;
    else if (laBaoTri_(v)) t.baoTri++;
    if (String(v[COT.Phut_Dap_Ung_Thuc]) !== '') t.dapUng.push(Number(v[COT.Phut_Dap_Ung_Thuc]));
    if (String(v[COT.Phut_Xu_Ly]) !== '') t.xuLy.push(Number(v[COT.Phut_Xu_Ly]));
  });

  function gio_(d) {
    return d instanceof Date ? Utilities.formatDate(d, CONFIG.MUI_GIO, 'HH:mm') : '';
  }

  function gonSuCo_(v) {
    return {
      ma: v[COT.Ma_Su_Co],
      may: String(v[COT.Ten_May]).trim() || String(v[COT.Ma_May]).trim(),
      boPhan: v[COT.Bo_Phan],
      nhomLoi: v[COT.Nhom_Loi],
      moTa: v[COT.Mo_Ta],
      tho: v[COT.Ten_Tho],
      trangThai: v[COT.Trang_Thai],
      ca: v[COT.Ca],
      ngayCa: String(v[COT.Ngay_Ca]).trim(),
      tiepNhan: v[COT.Phut_Tiep_Nhan],
      xuLy: v[COT.Phut_Xu_Ly],
      choBan: v[COT.Phut_Cho_Tho_Ban],
      dung: phutDungMay_(v),
      treo: phutDaTreo_(v, bayGio),
      loai: loaiPhieu_(v),
      // Cho việc chung và bảo trì: giờ ghi, nội dung xử lý, phụ tùng đã dùng.
      gioBao: gio_(v[COT.Thoi_Gian_Bao]),
      gioXong: gio_(v[COT.Thoi_Gian_Hoan_Thanh]),
      // Mốc thật để sắp xếp. KHÔNG sắp theo chuỗi 'HH:mm': ca đêm vắt qua nửa
      // đêm vẫn thuộc Ngay_Ca hôm trước, nên phiếu 02:00 sáng phải nằm SAU phiếu
      // 22:00 tối cùng ca, mà so chuỗi thì nó nhảy lên đầu ngày.
      tsBao: v[COT.Thoi_Gian_Bao] instanceof Date ? v[COT.Thoi_Gian_Bao].getTime() : 0,
      noiDungXuLy: v[COT.Noi_Dung_Xu_Ly],
      phuTung: v[COT.Phu_Tung_Tom_Tat],
    };
  }

  function theoGio_(a, b) { return (a.tsBao || 0) - (b.tsBao || 0); }

  // --- Tỉ lệ hiệu dụng A của đúng ngày này ---------------------------------
  // Dùng lại `tatCa` đã đọc ở trên thay vì đọc sheet lần nữa: trang này mở nhiều
  // lần mỗi ca, mà đọc Su_Co + Luu_Tru là phần đắt nhất của cả hàm.
  //
  // Bọc try/catch vì sheet kế hoạch có thể chưa được tạo (hệ đang chạy thật, bản
  // deploy cũ chưa có nó). Thiếu A thì trang vẫn phải mở được như trước.
  let hieuDung = null;
  if (HIEN_HIEU_DUNG_BAO_CAO_NGAY) {
    try {
      const kq = tinhHieuDung_(ngay, ngay, { bayGio: bayGio, dsPhieu: tatCa });
      hieuDung = {
        tiLe: kq.tong.tiLe,
        gioKeHoach: phutSangGio_(kq.tong.phutKeHoach),
        gioChay: phutSangGio_(kq.tong.phutChay),
        gioDung: phutSangGio_(kq.tong.phutDung),
        soMay: kq.tong.soMay,
        soMayDu: kq.tong.soMayDu,
        thieuKeHoach: kq.thieuKeHoach,
        // Chỉ gửi máy có dừng. Ngày bình thường chỉ vài máy, gửi cả 176 dòng
        // xuống điện thoại của tổ trưởng là phí băng thông cho toàn số 100%.
        may: sapTheoHieuDung_(kq.may.filter(function (m) {
          return m.phutDung > 0 || m.tiLe === null;
        })).map(function (m) {
          return {
            maMay: m.maMay, tenMay: m.tenMay, boPhan: m.boPhan,
            gioKeHoach: phutSangGio_(m.phutKeHoach),
            gioDung: phutSangGio_(m.phutDung),
            gioChay: phutSangGio_(m.phutChay),
            tiLe: m.tiLe,
          };
        }),
      };
    } catch (err) {
      hieuDung = { loi: err.message };
    }
  }

  return {
    ngay: ngay,
    capNhat: Utilities.formatDate(bayGio, CONFIG.MUI_GIO, 'HH:mm dd/MM/yyyy'),
    hienHieuDung: HIEN_HIEU_DUNG_BAO_CAO_NGAY,
    hieuDung: hieuDung,
    tong: {
      suCo: suCo.length,
      dong: suCo.filter(function (v) { return v[COT.Trang_Thai] === TRANG_THAI.HOAN_THANH; }).length,
      treo: chuaDong.length,
      dungMay: dungMay.length,
      congViec: congViec.length,
      baoTri: baoTri.length,
      phutDungHong: tongDowntimeSuCo_(suCo),
      phutDungKhac: tongPhutDung_(dungMay),
    },
    chuaDong: chuaDong.map(gonSuCo_)
      .sort(function (a, b) { return (b.treo || 0) - (a.treo || 0); }),
    suCo: sapTheoBoPhanRoiGio_(suCo.map(gonSuCo_)),
    dungMay: dungMay.map(gonSuCo_).sort(theoGio_),
    congViec: congViec.map(gonSuCo_).sort(theoGio_),
    baoTri: baoTri.map(gonSuCo_).sort(theoGio_),
    theoTho: Object.keys(theoTho).map(function (k) {
      const t = theoTho[k];
      return {
        ten: t.ten, suCo: t.suCo, congViec: t.congViec, baoTri: t.baoTri,
        tbDapUng: trungBinh_(t.dapUng),
        // Tổng chứ không phải trung bình: câu hỏi cuối ca là "hôm nay người này
        // bỏ ra bao nhiêu thời gian sửa máy", mà trung bình thì người làm 1 việc
        // 60 phút trông y hệt người làm 8 việc mỗi việc 60 phút.
        tongXuLy: t.xuLy.reduce(function (s, n) { return s + n; }, 0),
      };
    }).sort(function (a, b) {
      return (b.suCo + b.congViec + b.baoTri) - (a.suCo + a.congViec + a.baoTri);
    }),
  };
}

/** Dựng trang. Gọi từ doGet khi có ?page=ngay. */
function renderTrangNgay_(p) {
  if (!kiemKhoaInQr_(p.key)) {
    return trangThongBao_('Không có quyền',
      'Trang báo cáo cần khoá truy cập. Mở từ menu 🔧 Bảo trì → "📋 Báo cáo trong ngày".');
  }

  let ngay = String(p.d || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) ngay = fmtNgay_(nowVN_());

  return renderTrang_('TrangNgay', 'Báo cáo ngày ' + ngay, {
    duLieu: JSON.stringify(duLieuBaoCaoNgay_(ngay)),
    ngay: ngay,
    key: String(p.key).trim(),   // gửi lại khi sửa nội dung ngay trên trang
  });
}

/**
 * Sửa lại nội dung một phiếu ngay trên trang báo cáo ngày, để chuẩn hoá chữ nghĩa.
 *
 * Ba trường chữ cho mọi loại phiếu: mô tả hư hỏng, nội dung đã sửa, phụ tùng.
 * Thêm tên máy và bộ phận, NHƯNG chỉ với phiếu VIỆC CHUNG — ở phiếu sự cố hai
 * cột đó chép tự động từ danh mục máy lúc tạo phiếu, cho sửa tay là mở đường cho
 * đúng loại sai lệch mà hệ thống sinh ra để loại bỏ.
 *
 * Không đụng mốc thời gian, cột phút hay trạng thái — sửa được những thứ đó là
 * viết lại lịch sử.
 *
 * Không giới hạn thời gian như bản thợ tự sửa: đây là thao tác quản trị, và trang
 * này đã bị khoá bằng key nên chỉ người có khoá mới vào được.
 *
 * payload = { maSuCo, key, moTa, noiDungXuLy, phuTung, tenMay, boPhan }
 */
function capNhatNoiDungPhieu(payload) {
  const p = payload || {};
  if (!kiemKhoaInQr_(p.key)) return { ok: false, error: 'Không có quyền.' };

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const r = timDongSuCo_(p.maSuCo);
    if (!r) return { ok: false, error: 'Không tìm thấy phiếu ' + p.maSuCo + '.' };
    const v = r.v;

    const doiDanhMuc = p.tenMay !== undefined || p.boPhan !== undefined;
    if (doiDanhMuc && !laCongViec_(v)) {
      return {
        ok: false,
        error: 'Tên máy và bộ phận của phiếu sự cố lấy từ danh mục máy, không sửa ' +
          'tay ở đây. Sai thì sửa trong sheet Danh_Muc_May.',
      };
    }

    const truoc = {
      tenMay: v[COT.Ten_May],
      boPhan: v[COT.Bo_Phan],
      moTa: v[COT.Mo_Ta],
      noiDungXuLy: v[COT.Noi_Dung_Xu_Ly],
      phuTung: v[COT.Phu_Tung_Tom_Tat],
    };

    if (p.tenMay !== undefined) v[COT.Ten_May] = String(p.tenMay).trim().slice(0, 100);
    if (p.boPhan !== undefined) v[COT.Bo_Phan] = String(p.boPhan).trim().slice(0, 100);

    // Chỉ ghi đè trường nào được gửi lên — client chỉ gửi ô vừa sửa.
    if (p.moTa !== undefined) {
      v[COT.Mo_Ta] = String(p.moTa).trim().slice(0, CONFIG.MAX_MO_TA);
    }
    if (p.noiDungXuLy !== undefined) {
      v[COT.Noi_Dung_Xu_Ly] = String(p.noiDungXuLy).trim().slice(0, CONFIG.MAX_NOI_DUNG);
    }
    if (p.phuTung !== undefined) {
      v[COT.Phu_Tung_Tom_Tat] = String(p.phuTung).trim().slice(0, CONFIG.MAX_NOI_DUNG);
    }

    v[COT.Cap_Nhat_Luc] = nowVN_();
    v[COT.Phien_Ban] = (Number(v[COT.Phien_Ban]) || 0) + 1;

    ghiCaDong_(r.dong, v);
    ghiNhatKy_(v[COT.Ma_Su_Co], v[COT.Ma_May], nguoiDangDung_(), 'CHUAN_HOA_NOI_DUNG',
      { truoc: truoc, sau: {
        tenMay: v[COT.Ten_May],
        boPhan: v[COT.Bo_Phan],
        moTa: v[COT.Mo_Ta],
        noiDungXuLy: v[COT.Noi_Dung_Xu_Ly],
        phuTung: v[COT.Phu_Tung_Tom_Tat],
      } }, '');

    return { ok: true, maSuCo: v[COT.Ma_Su_Co] };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// Menu
// ============================================================================

function menuBaoCaoNgay() {
  const ui = SpreadsheetApp.getUi();
  const homNay = fmtNgay_(nowVN_());

  const h = ui.prompt('Báo cáo trong ngày',
    'Ngày cần xem (yyyy-MM-dd):\n(Enter để xem hôm nay ' + homNay + ')',
    ui.ButtonSet.OK_CANCEL);
  if (h.getSelectedButton() !== ui.Button.OK) return;

  const ngay = h.getResponseText().trim() || homNay;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ngay)) {
    ui.alert('Ngày phải dạng yyyy-MM-dd, ví dụ ' + homNay + '.');
    return;
  }

  const goc = layUrlCongKhai_() || layWebAppUrl_();
  const noi = goc.indexOf('?') === -1 ? '?' : '&';
  const link = goc + noi + 'page=ngay&d=' + ngay +
    '&key=' + encodeURIComponent(layKhoaInQr_());

  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,-apple-system,sans-serif;font-size:14px;line-height:1.6">' +
    '<p style="margin:0 0 14px">Báo cáo ngày <b>' + ngay + '</b> — xem nhanh trên một trang, ' +
    'in được bằng Ctrl+P.</p>' +
    '<a href="' + link + '" target="_blank" rel="noopener" ' +
    'style="display:inline-block;background:#1a73e8;color:#fff;text-decoration:none;' +
    'padding:10px 18px;border-radius:8px;font-weight:600">📋 Mở báo cáo</a>' +
    '<p style="margin:14px 0 0;color:#5f6368;font-size:12.5px">Trang có nút đổi ngày, ' +
    'không cần quay lại đây. Lưu link vào dấu trang để mở nhanh mỗi sáng.</p></div>'
  ).setWidth(430).setHeight(210);

  ui.showModalDialog(html, 'Báo cáo trong ngày');
}
