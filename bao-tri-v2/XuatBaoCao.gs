/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * XUẤT BÁO CÁO theo KHOẢNG NGÀY tuỳ chọn, lọc được BỘ PHẬN và THỢ, theo đúng
 * form 2 file Excel đang dùng:
 *
 *   1. BC_HH_T<thang>.xlsx  → sheet Data_Goc (29 cột), DANH_MUC, Dashboard, HD_DAP_UNG
 *   2. KPI_det.xlsx         → sheet "Nhật ký bảo trì" (10 cột), chỉ bộ phận DET
 *
 * Cộng thêm sheet Theo_Ngay — mỗi ngày một dòng, trả lời thẳng câu "máy dừng
 * bao nhiêu phút mỗi ngày".
 *
 * Mỗi lần chạy tạo MỘT Google Sheet mới trên Drive rồi trả về link — file gốc
 * của hệ thống không bị đụng tới, và bạn tải về .xlsx gửi sếp được ngay.
 *
 * KHÁC BIỆT CÓ CHỦ Ý so với file Excel gốc: mọi ô ở đây là SỐ ĐÃ TÍNH SẴN, không
 * phải công thức. File gốc dùng COUNTIF/SUMIF/AVERAGEIF và một sheet trung gian
 * CALC_DAP_UNG để tính đáp ứng — hệ thống này đã tính hết ở server (cột
 * Phut_Cho_Tho_Ban / Phut_Dap_Ung_Thuc / So_Chong_Viec trong Su_Co), nên
 * CALC_DAP_UNG không còn lý do tồn tại và không được xuất. Đây cũng đúng nguyên
 * tắc dự án: không dùng công thức Sheets, tránh lỗi locale/#ERROR!.
 */

// ============================================================================
// 1. HÀM CHÍNH
// ============================================================================

/**
 * @param {Object} opts
 *   tuNgay, denNgay  'yyyy-MM-dd', bắt buộc, tính theo NGÀY CA (`Ngay_Ca`) chứ
 *                    không theo giờ báo — ca đêm 02:00 sáng 15/8 thuộc ngày 14/8,
 *                    giống hệt cách báo cáo trong ngày và Tong_Hop đang gom.
 *   dsBoPhan         mảng mã bộ phận; rỗng = tất cả.
 *   dsTho            mảng tên thợ; rỗng = tất cả. LƯU Ý: lọc thợ sẽ loại hết
 *                    phiếu DM- vì phiếu dừng máy không gắn thợ nào.
 *   kemViecChung     true = lấy cả CV- và BT-. Mặc định false: báo cáo chỉ gồm
 *                    phiếu gắn với máy (SC- và DM-).
 * @return {Object} { ok, tenFile, url, soPhieu, soDet, nhanKy }
 */
function xuatBaoCao(opts) {
  const o = opts || {};
  const tu = String(o.tuNgay || '').trim();
  const den = String(o.denNgay || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(tu) || !/^\d{4}-\d{2}-\d{2}$/.test(den)) {
    throw new Error('Ngày phải dạng yyyy-MM-dd.');
  }
  if (den < tu) throw new Error('"Đến ngày" phải bằng hoặc sau "Từ ngày".');
  if (dsNgayTrongKy_(tu, den).length > 400) {
    throw new Error('Khoảng ngày quá dài (tối đa 400 ngày). Hãy chia nhỏ kỳ báo cáo.');
  }

  const dsBoPhan = lamSachDanhSach_(o.dsBoPhan);
  const dsTho = lamSachDanhSach_(o.dsTho);
  const kemViecChung = !!o.kemViecChung;

  const ds = locPhieuTheoKy_(docSuCoVaLuuTru_(), {
    tuNgay: tu, denNgay: den,
    dsBoPhan: dsBoPhan, dsTho: dsTho, kemViecChung: kemViecChung,
  }).sort(function (a, b) {
    return String(a[COT.Ma_Su_Co]).localeCompare(String(b[COT.Ma_Su_Co]));
  });

  const nhanKy = nhanKy_(tu, den);
  const ten = tenFileXuat_(tu, den, dsBoPhan, dsTho);
  const ssMoi = SpreadsheetApp.create(ten);

  const ctx = {
    nhanKy: nhanKy, tuNgay: tu, denNgay: den,
    dsBoPhan: dsBoPhan, dsTho: dsTho, kemViecChung: kemViecChung,
  };

  // ghiDataGoc_ dùng ssMoi.getSheets()[0], nên trang tổng hợp — thứ được chèn vào
  // vị trí 0 — phải ghi SAU CÙNG, nếu không nó bị Data_Goc đè mất.
  ghiDataGoc_(ssMoi, ds);
  ghiTheoNgay_(ssMoi, ds, ctx);
  ghiDanhMucXuat_(ssMoi, ctx);
  ghiDashboard_(ssMoi, ds, ctx);

  // Tỉ lệ hiệu dụng A. Bọc try/catch: file xuất là thứ sếp đang chờ, thiếu sheet
  // kế hoạch hay khai sai giờ thì mất đúng sheet này, sáu sheet kia vẫn phải ra.
  let loiHieuDung = '';
  try {
    ghiHieuDung_(ssMoi, ctx);
  } catch (err) {
    loiHieuDung = err.message;
  }

  ghiHuongDan_(ssMoi, ctx);

  // Sheet "Nhật ký bảo trì" là form riêng của bộ phận Dệt. Kỳ nào không có phiếu
  // Dệt nào thì bỏ hẳn sheet, đừng tạo ra một bảng trống khiến người đọc tưởng
  // mất dữ liệu.
  const dsDet = locSuCoDet_(ds);
  if (dsDet.length) ghiNhatKyDet_(ssMoi, dsDet);

  ghiTrangBaoCao_(ssMoi, ds, ctx);
  ssMoi.setActiveSheet(ssMoi.getSheetByName('Bao_Cao'));

  // Sheet mặc định do SpreadsheetApp.create sinh ra, không dùng tới.
  ['Sheet1', 'Trang tính1', 'Trang tinh1'].forEach(function (t) {
    const sh = ssMoi.getSheetByName(t);
    if (sh && ssMoi.getSheets().length > 1) ssMoi.deleteSheet(sh);
  });

  return {
    ok: true,
    tenFile: ten,
    url: ssMoi.getUrl(),
    soPhieu: ds.length,
    soDet: dsDet.length,
    nhanKy: nhanKy,
    loiHieuDung: loiHieuDung,
  };
}

// ----------------------------------------------------------------------------
// RPC cho hộp thoại HopXuat.html
//
// Hộp thoại tự gọi hai hàm này bằng google.script.run thay vì nhận dữ liệu qua
// scriptlet <?= ?>. Cố ý: nhét JSON vào chuỗi JS qua scriptlet là bẫy đã trả giá
// (dấu nháy thành &quot; rồi JSON.parse chết) — xem mục 13 CLAUDE.md.
// ----------------------------------------------------------------------------

/** Dữ liệu đổ vào hộp thoại: danh sách bộ phận, danh sách thợ, vài mốc ngày sẵn. */
function layDuLieuHopXuat() {
  const boPhan = {};
  docSheet_(SHEET.MAY, HEADER_MAY).forEach(function (m) {
    const s = String(m.Bo_Phan || '').trim();
    if (s) boPhan[s] = true;
  });

  // Lấy CẢ thợ đã nghỉ: phiếu cũ của họ vẫn nằm trong dữ liệu và vẫn cần xuất
  // lại được khi xem kỳ trước.
  const tho = docSheet_(SHEET.THO, HEADER_THO)
    .map(function (t) { return String(t.Ten_Tho || '').trim(); })
    .filter(Boolean);

  const homNay = fmtNgay_(nowVN_());
  const thangNay = khoangCuaThang_(fmtThang_(nowVN_()));
  const dauThangNay = ngayCaSangDate_(thangNay.tu);
  const thangTruoc = khoangCuaThang_(fmtThang_(
    new Date(dauThangNay.getTime() - 24 * 60 * 60 * 1000)));

  return {
    boPhan: Object.keys(boPhan).sort(),
    tho: tho.sort(),
    homNay: homNay,
    thangNay: thangNay,
    thangTruoc: thangTruoc,
    bayNgayTruoc: fmtNgay_(new Date(nowVN_().getTime() - 6 * 24 * 60 * 60 * 1000)),
  };
}

/** Hộp thoại gọi hàm này khi bấm Xuất. Lỗi trả về dạng dữ liệu, không throw. */
function chayXuatBaoCao(opts) {
  try {
    return xuatBaoCao(opts);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Vỏ bọc giữ nguyên cách gọi cũ: xuất trọn một tháng, CÓ kèm việc chung và bảo
 * trì đúng như báo cáo tháng vẫn chạy từ trước tới nay.
 *
 * @param {string} thang 'MM/yyyy'. Bỏ trống = tháng hiện tại.
 */
function xuatBaoCaoThang(thang) {
  const thangCan = thang || fmtThang_(nowVN_());
  if (!/^\d{2}\/\d{4}$/.test(thangCan)) {
    throw new Error('Tháng phải dạng MM/yyyy, ví dụ 07/2026.');
  }
  const k = khoangCuaThang_(thangCan);
  return xuatBaoCao({
    tuNgay: k.tu, denNgay: k.den, kemViecChung: true,
  });
}

/** Đọc cả Su_Co lẫn Luu_Tru — báo cáo tháng cũ vẫn ra đủ sau khi đã archive. */
function docSuCoVaLuuTru_() {
  const ds = docToanBoSuCo_();
  const shLuu = ss_().getSheetByName(SHEET.LUU_TRU);
  if (shLuu && shLuu.getLastRow() >= 2) {
    shLuu.getRange(2, 1, shLuu.getLastRow() - 1, HEADER_SU_CO.length).getValues()
      .forEach(function (v) {
        if (v[COT.Ma_Su_Co] !== '' && v[COT.Ma_Su_Co] !== null) ds.push(v);
      });
  }
  return ds;
}

// ============================================================================
// 2. TIỆN ÍCH CHUYỂN ĐỔI
// ============================================================================

/** 'yyyy-MM-dd' → Date (00:00 giờ VN). Trả '' nếu không hợp lệ. */
function ngayCaSangDate_(s) {
  const t = String(s || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return '';
  return new Date(t + 'T00:00:00+07:00');
}

// ============================================================================
// 2b. LỌC THEO KỲ — BỘ PHẬN — THỢ
//
// Tất cả hàm dưới đây là hàm THUẦN: nhận vào mảng dòng, trả ra kết quả, không
// đọc sheet nào. Nhờ vậy Test.gs kiểm được bằng dữ liệu giả (mục 14 CLAUDE.md).
// ============================================================================

/** Bỏ phần tử rỗng, cắt khoảng trắng. Dùng cho danh sách bộ phận / thợ đã tick. */
function lamSachDanhSach_(ds) {
  if (!ds) return [];
  const mang = Array.isArray(ds) ? ds : [ds];
  return mang.map(function (x) { return String(x || '').trim(); }).filter(Boolean);
}

/** So khớp bộ phận không phân biệt hoa thường / khoảng trắng thừa. */
function chuanBoPhan_(s) {
  return String(s || '').trim().toUpperCase();
}

/**
 * Ngày của một phiếu, dạng 'yyyy-MM-dd'. Ưu tiên Ngay_Ca, thiếu thì lấy
 * Thoi_Gian_Bao — cùng thứ tự ưu tiên với thangCuaPhieu_ để hai báo cáo không
 * bao giờ xếp một phiếu vào hai kỳ khác nhau.
 */
function ngayCuaPhieu_(v) {
  const ngayCa = String(v[COT.Ngay_Ca] || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(ngayCa)) return ngayCa.slice(0, 10);
  if (v[COT.Thoi_Gian_Bao] instanceof Date) return fmtNgay_(v[COT.Thoi_Gian_Bao]);
  return '';
}

/**
 * Lọc tập phiếu theo kỳ + bộ phận + thợ.
 *
 * Bộ phận so khớp thẳng cột Bo_Phan. Với SC- và DM- thì cột này chép từ danh mục
 * máy nên luôn chuẩn; với CV-/BT- nó là khu vực thợ gõ tay, nên lọc bộ phận có
 * thể bỏ sót việc chung — đó là lý do kemViecChung mặc định tắt.
 */
function locPhieuTheoKy_(ds, opts) {
  const o = opts || {};
  const tu = String(o.tuNgay || '');
  const den = String(o.denNgay || '');
  const bp = lamSachDanhSach_(o.dsBoPhan).map(chuanBoPhan_);
  const tho = lamSachDanhSach_(o.dsTho);
  const kem = !!o.kemViecChung;

  return ds.filter(function (v) {
    const ngay = ngayCuaPhieu_(v);
    if (!ngay || ngay < tu || ngay > den) return false;
    if (!kem && (laCongViec_(v) || laBaoTri_(v))) return false;
    if (bp.length && bp.indexOf(chuanBoPhan_(v[COT.Bo_Phan])) === -1) return false;
    if (tho.length && tho.indexOf(String(v[COT.Ten_Tho] || '').trim()) === -1) return false;
    return true;
  });
}

/** Mảng 'yyyy-MM-dd' từ tu đến den (bao gồm cả hai đầu). */
function dsNgayTrongKy_(tu, den) {
  const out = [];
  const dCuoi = ngayCaSangDate_(den);
  let d = ngayCaSangDate_(tu);
  if (!d || !dCuoi) return out;
  // Chặn cứng để một tham số sai không kéo vòng lặp chạy vô hạn.
  while (d.getTime() <= dCuoi.getTime() && out.length <= 400) {
    out.push(fmtNgay_(d));
    d = new Date(d.getTime() + 24 * 60 * 60 * 1000);
  }
  return out;
}

/**
 * Thứ trong tuần của 'yyyy-MM-dd'. Tính bằng Date.UTC chứ không qua
 * Utilities.formatDate để kết quả không phụ thuộc timeZone của project.
 */
function thuCuaNgay_(ngay) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ngay || '').trim());
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][d.getUTCDay()];
}

/**
 * Khoảng thời gian máy thực sự nằm im của một phiếu, hoặc null nếu phiếu không
 * làm máy dừng (việc chung, bảo trì, hoặc máy vẫn chạy khi báo).
 *
 * Phiếu CHƯA đóng thì tính tới `bayGio` — máy vẫn đang nằm im thật. Bỏ qua sẽ
 * báo thiếu đúng những ca dừng lâu nhất, ví dụ máy tháo motor đi quấn lại dây.
 */
function khoangDungMay_(v, bayGio) {
  if (laCongViec_(v) || laBaoTri_(v)) return null;
  if (String(v[COT.Trang_Thai_May] || '').trim().toUpperCase() !== 'DA_DUNG') return null;

  const tu = mocBatDauHu_(v);
  if (!(tu instanceof Date)) return null;

  const xong = v[COT.Thoi_Gian_Hoan_Thanh];
  const den = xong instanceof Date ? xong : (bayGio || nowVN_());
  if (den.getTime() <= tu.getTime()) return null;

  return { tu: tu, den: den, dangDung: !(xong instanceof Date) };
}

/**
 * Số phút của một khoảng dừng rơi đúng vào ngày 'yyyy-MM-dd' (giờ VN).
 *
 * Đây là chỗ cắt downtime theo ngày thật thay vì dồn hết vào ngày mở phiếu: một
 * phiếu dừng 3 ngày sẽ hiện đúng phần của từng ngày, không có ngày nào vượt quá
 * 1440 phút. Việt Nam không đổi giờ mùa hè nên cộng 24h là an toàn.
 */
function phutDungTrongNgay_(khoang, ngay) {
  if (!khoang) return 0;
  const d0 = ngayCaSangDate_(ngay);
  if (!d0) return 0;

  const d1 = d0.getTime() + 24 * 60 * 60 * 1000;
  const tu = Math.max(khoang.tu.getTime(), d0.getTime());
  const den = Math.min(khoang.den.getTime(), d1);
  return den <= tu ? 0 : Math.round((den - tu) / 60000);
}

/** 'MM/yyyy' → { tu, den } là ngày đầu và ngày cuối tháng, dạng 'yyyy-MM-dd'. */
function khoangCuaThang_(thang) {
  const mm = thang.slice(0, 2);
  const yyyy = thang.slice(3);
  // Date.UTC nhận tháng 0-based, nên ngày 0 của tháng (mm) chính là ngày cuối
  // của tháng mm — khỏi phải nhớ tháng nào 30 hay 31 ngày, và đúng cả năm nhuận.
  const ngayCuoi = new Date(Date.UTC(Number(yyyy), Number(mm), 0)).getUTCDate();
  return { tu: yyyy + '-' + mm + '-01', den: yyyy + '-' + mm + '-' + pad2_(ngayCuoi) };
}

/** 'yyyy-MM-dd' → 'dd/MM/yyyy' để hiện cho người đọc. */
function ngayVN_(s) {
  const t = String(s || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(t)
    ? t.slice(8, 10) + '/' + t.slice(5, 7) + '/' + t.slice(0, 4) : t;
}

/** Nhãn kỳ báo cáo. Trọn một tháng thì gọi tên tháng cho gọn. */
function nhanKy_(tu, den) {
  const k = khoangCuaThang_(tu.slice(5, 7) + '/' + tu.slice(0, 4));
  if (k.tu === tu && k.den === den) return 'Tháng ' + tu.slice(5, 7) + '/' + tu.slice(0, 4);
  return ngayVN_(tu) + ' – ' + ngayVN_(den);
}

/** Tên file xuất, có hậu tố bộ phận / thợ khi kỳ báo cáo bị lọc. */
function tenFileXuat_(tu, den, dsBoPhan, dsTho) {
  const k = khoangCuaThang_(tu.slice(5, 7) + '/' + tu.slice(0, 4));
  let ten = (k.tu === tu && k.den === den)
    ? 'BaoCao_HuHong_T' + tu.slice(5, 7) + '_' + tu.slice(0, 4)
    : 'BaoCao_HuHong_' + tu + '_den_' + den;

  const bp = lamSachDanhSach_(dsBoPhan);
  const tho = lamSachDanhSach_(dsTho);
  if (bp.length) ten += '_' + bp.join('-');
  if (tho.length) ten += '_' + tho.join('-').replace(/\s+/g, '');
  return ten;
}

/**
 * Máy đưa vào bảng thống kê: chỉ những máy thuộc bộ phận đang xem. Không lọc thì
 * bảng "theo máy" có đủ 162 máy toàn số 0, đọc báo cáo một bộ phận thành cực hình.
 */
function locMayTheoBoPhan_(dsMay, ctx) {
  const bp = lamSachDanhSach_(ctx && ctx.dsBoPhan).map(chuanBoPhan_);
  if (!bp.length) return dsMay;
  return dsMay.filter(function (m) {
    return bp.indexOf(chuanBoPhan_(m.Bo_Phan)) !== -1;
  });
}

/**
 * Thợ đưa vào bảng thống kê. Có lọc thợ thì lấy đúng người đã chọn; chỉ lọc bộ
 * phận thì lấy những thợ phụ trách bộ phận đó theo `Bo_Phan_Phu_Trach`
 * (nhiều bộ phận cách nhau dấu phẩy).
 */
function locThoTheoCtx_(dsTho, ctx) {
  const ds = dsTho.filter(function (t) { return String(t.Ten_Tho).trim(); });
  const chon = lamSachDanhSach_(ctx && ctx.dsTho);
  if (chon.length) {
    return ds.filter(function (t) { return chon.indexOf(String(t.Ten_Tho).trim()) !== -1; });
  }

  const bp = lamSachDanhSach_(ctx && ctx.dsBoPhan);
  if (!bp.length) return ds;
  return ds.filter(function (t) {
    return bp.some(function (x) {
      return phuTrachBoPhan_(t.Bo_Phan_Phu_Trach, x);
    });
  });
}

/** Date → 'HH:mm' theo giờ VN, '' nếu không phải Date. */
function gioCuaMoc_(v) {
  return v instanceof Date ? Utilities.formatDate(v, CONFIG.MUI_GIO, 'HH:mm') : '';
}

/** Mã ca nội bộ → nhãn trong biểu mẫu Excel. */
function nhanCa_(ca) {
  return { N: 'Ngày', D: 'Đêm' }[String(ca).trim().toUpperCase()] || '';
}

/**
 * Mốc "Bắt đầu hư" cho biểu mẫu.
 *
 * Ưu tiên Thoi_Gian_Dung_May (mốc máy thực sự dừng, do thợ xác nhận tại chỗ).
 * Không có thì lùi về Thoi_Gian_Bao — lúc công nhân bấm báo. Nhờ vậy cột này
 * không bao giờ trống với phiếu thật, kể cả phiếu tạo trước khi hệ thống có cột
 * Thoi_Gian_Dung_May. Đúng với giả định #2 của bản thiết kế: khi không đo được
 * riêng, coi như máy hỏng từ lúc báo.
 */
function mocBatDauHu_(v) {
  // Việc chung và bảo trì không có khái niệm "máy hư". Nhưng phiếu DỪNG MÁY thì
  // CÓ mốc bắt đầu dừng và cần tính downtime, nên không loại nó ở đây.
  if (laCongViec_(v) || laBaoTri_(v)) return '';
  const dung = v[COT.Thoi_Gian_Dung_May];
  if (dung instanceof Date) return dung;
  return v[COT.Thoi_Gian_Bao] instanceof Date ? v[COT.Thoi_Gian_Bao] : '';
}

/** Nhãn loại phiếu để hiện trong báo cáo. */
function nhanLoaiPhieu_(v) {
  return {
    CONG_VIEC: 'Việc chung',
    BAO_TRI: 'Bảo trì hằng ngày',
    DUNG_MAY: 'Dừng máy (không hư)',
  }[loaiPhieu_(v)] || 'Sự cố máy';
}

/**
 * Số phút dừng máy = kết thúc sửa − mốc bắt đầu hư.
 * CHỈ tính khi máy thực sự dừng: công nhân báo "Còn chạy" hoặc "Không rõ" thì để
 * trống, giống dòng "Không dừng máy" trong file Excel mẫu — downtime phải là số
 * máy thật sự nằm im, không phải thời gian trôi qua.
 */
function phutDungMay_(v) {
  if (String(v[COT.Trang_Thai_May]).trim().toUpperCase() !== 'DA_DUNG') return '';
  const tu = mocBatDauHu_(v);
  const xong = v[COT.Thoi_Gian_Hoan_Thanh];
  if (!(tu instanceof Date) || !(xong instanceof Date)) return '';
  return Math.max(0, Math.round((xong.getTime() - tu.getTime()) / 60000));
}

/** Bộ phận Dệt — chấp nhận cả 'DET', 'Dệt', 'DỆT' để không lọt phiếu do cách gõ. */
function laBoPhanDet_(boPhan) {
  const s = String(boPhan || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd').trim().toUpperCase();
  return s === 'DET';
}

/** Nội dung hư hỏng: ưu tiên mô tả của công nhân, thiếu thì lấy nội dung xử lý. */
function noiDungHuHong_(v) {
  return String(v[COT.Mo_Ta] || '').trim() || String(v[COT.Noi_Dung_Xu_Ly] || '').trim();
}

/**
 * Trạng thái đáp ứng — dịch đúng bảng trạng thái ở cột AC của file Excel gốc.
 */
function trangThaiDapUng_(v) {
  if (!laSuCo_(v)) return 'KHÔNG ÁP DỤNG';
  if (!String(v[COT.Ten_Tho] || '').trim()) return 'CHƯA NHẬP NGƯỜI XỬ LÝ';
  if (!(v[COT.Thoi_Gian_Nhan] instanceof Date) ||
      !(v[COT.Thoi_Gian_Hoan_Thanh] instanceof Date)) return 'THIẾU THỜI GIAN';
  if (Number(v[COT.So_Chong_Viec]) > 0) return 'CHỒNG VIỆC / KIỂM TRA DỮ LIỆU';
  if (Number(v[COT.Phut_Cho_Tho_Ban]) > 0) return 'CHỜ THỢ RẢNH';
  return 'THỢ RẢNH';
}

/**
 * Tách chuỗi "Tên xSL ĐVT; Tên xSL ĐVT" thành mảng [{ten, sl, dvt}].
 * Đây là dạng do gopPhuTung_() sinh ra khi thợ bấm Hoàn thành.
 */
function tachPhuTung_(tomTat) {
  const s = String(tomTat || '').trim();
  if (!s) return [];
  return s.split(';').map(function (x) { return x.trim(); }).filter(Boolean)
    .map(function (x) {
      const m = x.match(/^(.+?)\s+x(\S+)(?:\s+(.+))?$/);
      if (!m) return { ten: x, sl: '', dvt: '' };
      return { ten: m[1].trim(), sl: m[2].trim(), dvt: (m[3] || '').trim() };
    });
}

/** Ghi header đậm + nền xám cho một sheet xuất. */
function dinhDangHeader_(sh, dong, soCot) {
  sh.getRange(dong, 1, 1, soCot)
    .setFontWeight('bold').setBackground('#e8eaed')
    .setVerticalAlignment('middle').setWrap(true);
}

// ============================================================================
// 3. SHEET Data_Goc — 29 cột đúng thứ tự file BC_HH
// ============================================================================

const HEADER_DATA_GOC = [
  'Mã sự cố', 'Ngày sửa', 'Ca', 'Tên máy', 'Nội dung hư hỏng (Bệnh)',
  'Bắt đầu hư', 'Bắt đầu sửa', 'Kết thúc sửa',
  'Thời gian đáp ứng tổng\n(Phút)', 'Thời gian sửa máy (Phút)',
  'Thời gian dừng máy (Phút)', 'Bộ phận', 'Người sửa chữa / Không cần cơ khí',
  'Ghi chú',
  'Phụ tùng thay thế 1', 'Số lượng 1', 'ĐVT 1',
  'Phụ tùng thay thế 2', 'Số lượng 2', 'ĐVT 2',
  'Phụ tùng thay thế 3', 'Số lượng 3', 'ĐVT 3',
  'Phụ tùng thay thế 4', 'Số lượng 4', 'ĐVT 4',
  'Thời gian chờ do thợ bận\n(Phút)',
  'Thời gian đáp ứng sau khi thợ rảnh\n(Phút)',
  'Trạng thái đáp ứng',
  // Cột thứ 30, nằm NGOÀI 29 cột của biểu mẫu gốc — thêm vào cuối để lọc nhanh
  // giữa 3 loại phiếu mà không xê dịch cột nào của form.
  'Loại',
];

function ghiDataGoc_(ssMoi, ds) {
  const sh = ssMoi.getSheets()[0].setName('Data_Goc');

  const bang = [HEADER_DATA_GOC];
  ds.forEach(function (v) {
    const pt = tachPhuTung_(v[COT.Phu_Tung_Tom_Tat]);

    // Biểu mẫu chỉ có 4 ô phụ tùng; hệ thống cho tối đa 5 → dồn phần dư vào Ghi chú
    // thay vì làm mất dữ liệu.
    let ghiChu = String(v[COT.Ghi_Chu] || '').trim();
    if (String(v[COT.Trang_Thai_May]).trim().toUpperCase() === 'DANG_CHAY') {
      ghiChu = (ghiChu ? ghiChu + ' — ' : '') + 'Không dừng máy';
    }
    if (pt.length > 4) {
      ghiChu = (ghiChu ? ghiChu + ' — ' : '') + 'Phụ tùng thêm: ' +
        pt.slice(4).map(function (x) {
          return x.ten + (x.sl ? ' x' + x.sl : '') + (x.dvt ? ' ' + x.dvt : '');
        }).join('; ');
    }

    const dong = [
      v[COT.Ma_Su_Co],
      ngayCaSangDate_(v[COT.Ngay_Ca]),
      nhanCa_(v[COT.Ca]),
      v[COT.Ten_May],
      noiDungHuHong_(v),
      gioCuaMoc_(mocBatDauHu_(v)),
      gioCuaMoc_(v[COT.Thoi_Gian_Nhan]),
      gioCuaMoc_(v[COT.Thoi_Gian_Hoan_Thanh]),
      v[COT.Phut_Tiep_Nhan],
      v[COT.Phut_Xu_Ly],
      phutDungMay_(v),
      v[COT.Bo_Phan],
      v[COT.Ten_Tho],
      ghiChu,
    ];
    for (let i = 0; i < 4; i++) {
      const x = pt[i] || { ten: '', sl: '', dvt: '' };
      dong.push(x.ten, x.sl, x.dvt);
    }
    dong.push(v[COT.Phut_Cho_Tho_Ban], v[COT.Phut_Dap_Ung_Thuc],
      trangThaiDapUng_(v), nhanLoaiPhieu_(v));
    bang.push(dong);
  });

  sh.getRange(1, 1, bang.length, HEADER_DATA_GOC.length).setValues(bang);
  dinhDangHeader_(sh, 1, HEADER_DATA_GOC.length);
  sh.setFrozenRows(1);

  if (bang.length > 1) {
    const n = bang.length - 1;
    sh.getRange(2, 2, n, 1).setNumberFormat('dd/MM/yyyy');   // Ngày sửa
    sh.getRange(2, 6, n, 3).setNumberFormat('HH:mm');        // 3 mốc giờ
  }
  sh.setColumnWidth(4, 200);
  sh.setColumnWidth(5, 260);
  sh.setColumnWidth(29, 220);
}

// ============================================================================
// 3a. SHEET Bao_Cao — MỘT TRANG cho sếp xem
//
// Sếp không mở 6 tab để ghép số. Trang này đứng đầu file, gộp đủ ba thứ hay bị
// hỏi: máy dừng bao nhiêu mỗi ngày, máy nào hỏng nhiều, thợ nào làm gì. Các sheet
// còn lại là chi tiết để tra khi cần.
// ============================================================================

const SO_COT_BC = 12;   // A..L
const MAU_CHINH = '#1a73e8';
const MAU_NHAT = '#e8f0fe';
const MAU_VIEN = '#dadce0';

function ghiTrangBaoCao_(ssMoi, ds, ctx) {
  const sh = ssMoi.insertSheet('Bao_Cao', 0);
  const bayGio = nowVN_();
  const gNgay = gomTheoNgay_(ds, ctx, bayGio);
  const gMT = gomTheoMayTho_(ds);

  const luoi = [];
  function them_(r) {
    const d = (r || []).slice(0, SO_COT_BC);
    while (d.length < SO_COT_BC) d.push('');
    luoi.push(d);
    return luoi.length;             // số dòng vừa ghi, 1-based
  }

  // --- Đầu trang ------------------------------------------------------------
  const dTieuDe = them_(['BÁO CÁO BẢO TRÌ MÁY']);
  const dKy = them_([ctx.nhanKy + moTaBoLoc_(ctx)]);
  const dXuat = them_(['Xuất lúc ' + fmtNgay_(bayGio) + ' ' + fmtGio_(bayGio) +
    ' · số liệu tính sẵn, không phải công thức']);
  them_([]);

  // --- Bốn ô số lớn ---------------------------------------------------------
  const dapUng = ds.filter(laSuCo_)
    .filter(function (v) { return String(v[COT.Phut_Tiep_Nhan]) !== ''; })
    .map(function (v) { return Number(v[COT.Phut_Tiep_Nhan]); });

  const dNhanO = them_(['SỐ LẦN MÁY HỎNG', '', 'TỔNG THỜI GIAN MÁY DỪNG', '',
    'TỔNG THỜI GIAN SỬA', '', 'ĐÁP ỨNG TRUNG BÌNH', '']);
  const dSoO = them_([gMT.tong.soSuCo, '', quyRaGio_(gNgay.tong.tongPhut) + ' giờ', '',
    quyRaGio_(gNgay.tong.phutSua) + ' giờ', '',
    (trungBinh_(dapUng) === '' ? '—' : trungBinh_(dapUng) + ' phút'), '']);

  // Máy tệ nhất kỳ này — một dòng, nhưng thường là thứ sếp hỏi ngay sau khi xem
  // các ô tổng.
  const mayTeNhat = Object.keys(gMT.theoMay).map(function (ten) {
    return { ten: ten, lan: gMT.theoMay[ten].lan, dt: gMT.theoMay[ten].downtime };
  }).sort(function (a, b) { return b.dt - a.dt; })[0];

  const dPhu = them_([
    'Trong kỳ còn có ' + gMT.tong.soDungMay + ' lần dừng máy không do hư hỏng' +
    (gNgay.tong.conDung ? ' · có máy CHƯA chạy lại tính tới lúc xuất' : '') +
    (gNgay.tong.soChoBan ? ' · ' + gNgay.tong.soChoBan +
      ' phiếu phải chờ vì thợ đang bận việc khác' : '') +
    (mayTeNhat ? ' · Dừng lâu nhất: ' + mayTeNhat.ten + ' (' + mayTeNhat.lan +
      ' lần, ' + quyRaGio_(mayTeNhat.dt) + ' giờ)' : ''),
  ]);
  them_([]);

  // --- Phần 1: NHẬT KÝ TỪNG NGÀY --------------------------------------------
  // Ngày không có phiếu nào mở VÀ không có máy nào còn nằm im thì bỏ hẳn, để một
  // kỳ 30 ngày mà chỉ 8 ngày có việc thì chỉ hiện 8 khối.
  const dsNgayCoViec = gNgay.dong.filter(function (r) { return r.phieu.length; });
  const maxPhut = dsNgayCoViec.reduce(function (m, r) {
    return Math.max(m, r.tongPhut);
  }, 0);

  // Tra sẵn "phiếu nào khiến phiếu này phải chờ" cho các phiếu bị trừ thời gian.
  // Chỉ tính cho phiếu có Phut_Cho_Tho_Ban > 0 nên không quét thừa.
  const mapGayBan = {};
  ds.forEach(function (v) {
    if ((Number(v[COT.Phut_Cho_Tho_Ban]) || 0) <= 0) return;
    const g = timPhieuGayBan_(v, ds);
    if (g) mapGayBan[String(v[COT.Ma_Su_Co])] = g;
  });

  const dMuc1 = them_(['NHẬT KÝ TỪNG NGÀY']);
  const moc = { tieuDe: [], head: [], tongCao: [], tongVua: [], tongThuong: [],
    khoiPhieu: [] };

  dsNgayCoViec.forEach(function (r) {
    them_([]);
    moc.tieuDe.push(them_([tieuDeNgay_(r.ngay)]));
    moc.head.push(them_(['Phiếu', 'Máy', 'Hư gì / lý do',
      'Báo hư', 'Bắt đầu sửa', 'Hoàn thành', 'Phút dừng', 'Thợ',
      'Đáp ứng (phút)', 'Chờ do thợ bận', 'Sau khi rảnh', 'Ghi chú']));

    const dDau = luoi.length + 1;
    r.phieu.forEach(function (p) {
      const v = p.v;
      // Phiếu tiếp từ hôm trước KHÔNG ghi lại đáp ứng — nó đã được tính ở ngày mở
      // phiếu, ghi lại là đếm hai lần.
      const so_ = function (cot) {
        return p.moTrongNgay && String(v[cot]) !== '' ? Number(v[cot]) : '—';
      };

      them_([
        v[COT.Ma_Su_Co],
        String(v[COT.Ten_May] || '').trim() || String(v[COT.Bo_Phan] || '').trim(),
        String(noiDungHuHong_(v)).slice(0, 90),
        mocTrongNgay_(v[COT.Thoi_Gian_Bao], r.ngay),
        mocTrongNgay_(v[COT.Thoi_Gian_Nhan], r.ngay),
        mocTrongNgay_(v[COT.Thoi_Gian_Hoan_Thanh], r.ngay),
        p.phut || '—',
        String(v[COT.Ten_Tho] || '').trim() || '—',
        so_(COT.Phut_Tiep_Nhan),
        so_(COT.Phut_Cho_Tho_Ban),
        so_(COT.Phut_Dap_Ung_Thuc),
        ghiChuDong_(p, r.ngay, mapGayBan[String(v[COT.Ma_Su_Co])]),
      ]);
    });
    moc.khoiPhieu.push('A' + dDau + ':L' + luoi.length);

    const dapUngNgay = trungBinh_(r.dapUng);
    const sauRanhNgay = trungBinh_(r.sauRanh);
    const choNgay = trungBinh_(r.choBan);
    // Chỉ nói tới phiếu DM- khi ngày đó thực sự có — nếu không, dòng "0 lần dừng
    // máy không do hư" đứng cạnh "4,2 giờ máy nằm im" đọc lên thành mâu thuẫn.
    const dTong = them_([
      'TỔNG NGÀY — ' + r.soSuCo + ' sự cố' +
        ' · ' + r.soPhaiDung + ' lần máy phải dừng' +
        (r.soDung ? ' (trong đó ' + r.soDung + ' lần không do hư)' : '') +
        ' · ' + quyRaGio_(r.tongPhut) + ' giờ máy nằm im' +
        (r.conDung ? ' · còn ' + r.conDung + ' máy CHƯA chạy lại' : ''),
      '', '', '', '', '',
      r.tongPhut, '',
      dapUngNgay === '' ? '—' : dapUngNgay,
      choNgay === '' ? '—' : choNgay,
      sauRanhNgay === '' ? '—' : sauRanhNgay,
      r.soChoBan ? r.soChoBan + ' phiếu phải chờ vì thợ bận' : '',
    ]);

    // Ba mức tô để nhìn phát ra ngay ngày nào tệ nhất, không phải dò cột số.
    if (maxPhut > 0 && r.tongPhut >= maxPhut * 0.7) moc.tongCao.push(dTong);
    else if (maxPhut > 0 && r.tongPhut >= maxPhut * 0.4) moc.tongVua.push(dTong);
    else moc.tongThuong.push(dTong);
  });

  if (!dsNgayCoViec.length) {
    them_([]);
    them_(['Không có sự cố hay lần dừng máy nào trong kỳ này.']);
  }

  // --- Phần 2: tổng kết theo thợ --------------------------------------------
  const dsTho = Object.keys(gMT.theoTho).map(function (ten) {
    const x = gMT.theoTho[ten];
    return { ten: ten, soViec: x.soViec, dapUng: trungBinh_(x.dapUng),
      cho: trungBinh_(x.choBan), sauRanh: trungBinh_(x.sauRanh),
      chong: x.chong, soChoBan: x.soChoBan, tongCho: x.tongCho,
      tongSua: x.tongSua, tongDung: x.tongDung };
  }).sort(function (a, b) { return b.soViec - a.soViec; });

  them_([]);
  const dMuc2 = them_(['TỔNG KẾT THEO THỢ — CẢ KỲ']);
  const dHead2 = them_(['Thợ', 'Số việc', 'Đáp ứng TB (phút)',
    'Chờ do thợ bận TB', 'Sau khi rảnh TB',
    'Số phiếu phải chờ vì thợ bận', 'Tổng phút chờ do bận',
    'Số lần nhận việc khi chưa đóng việc cũ',
    'Tổng phút sửa', 'Tổng phút máy dừng', '', '']);

  const dDau2 = luoi.length + 1;
  dsTho.forEach(function (t) {
    them_([t.ten, t.soViec,
      t.dapUng === '' ? '—' : t.dapUng,
      t.cho === '' ? '—' : t.cho,
      t.sauRanh === '' ? '—' : t.sauRanh,
      t.soChoBan, t.tongCho, t.chong, t.tongSua, t.tongDung, '', '']);
  });
  let dCuoi2 = luoi.length;
  if (!dsTho.length) {
    them_(['Không có phiếu nào gắn thợ trong kỳ này.']);
    dCuoi2 = luoi.length;
  }

  them_([]);
  const dChuThich = them_(['Phút dừng đã cắt theo từng ngày — phiếu kéo dài nhiều ' +
    'ngày được chia cho các ngày và ghi rõ "tiếp từ" / "còn tiếp", nên cộng dọc ' +
    'cột Phút dừng của mỗi ngày đúng bằng dòng TỔNG NGÀY.']);
  them_(['Đáp ứng = Chờ do thợ bận + Sau khi rảnh. Cột "Chờ do thợ bận" luôn ghi rõ ' +
    'ở Ghi chú là chờ vì thợ đang làm phiếu nào, để kiểm chứng được. Lưu ý "Số lần ' +
    'nhận việc khi chưa đóng việc cũ" là chuyện khác: máy vẫn phải chờ ngay cả khi ' +
    'thợ đã đóng việc cũ xong mới nhận việc mới.']);

  // ==========================================================================
  // Ghi một lần rồi mới định dạng
  // ==========================================================================
  sh.getRange(1, 1, luoi.length, SO_COT_BC).setValues(luoi);

  // Đầu trang
  sh.getRange(dTieuDe, 1, 1, SO_COT_BC).merge()
    .setBackground(MAU_CHINH).setFontColor('#ffffff')
    .setFontSize(16).setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(dTieuDe, 38);
  sh.getRange(dKy, 1, 1, SO_COT_BC).merge()
    .setBackground(MAU_NHAT).setFontColor('#174ea6').setFontWeight('bold')
    .setHorizontalAlignment('center');
  sh.getRange(dXuat, 1, 1, SO_COT_BC).merge()
    .setFontColor('#5f6368').setFontSize(10).setHorizontalAlignment('center');

  // Bốn ô số lớn
  [1, 3, 5, 7].forEach(function (c) {
    sh.getRange(dNhanO, c, 1, 2).merge()
      .setBackground(MAU_NHAT).setFontColor('#174ea6').setFontWeight('bold')
      .setFontSize(10).setHorizontalAlignment('center').setWrap(true);
    sh.getRange(dSoO, c, 1, 2).merge()
      .setFontSize(18).setFontWeight('bold').setFontColor(MAU_CHINH)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  });
  sh.setRowHeight(dSoO, 40);
  sh.getRange(dNhanO, 1, 2, SO_COT_BC)
    .setBorder(true, true, true, true, true, false, MAU_VIEN,
      SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(dPhu, 1, 1, SO_COT_BC).merge()
    .setFontColor('#5f6368').setFontSize(10.5).setHorizontalAlignment('center');

  // Hai tiêu đề mục
  [dMuc1, dMuc2].forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_BC).merge()
      .setFontWeight('bold').setFontSize(12).setFontColor('#174ea6');
    sh.setRowHeight(d, 28);
  });

  // Các khối ngày — gom thành RangeList để mỗi kiểu định dạng chỉ tốn MỘT lệnh,
  // thay vì vài lệnh nhân với số ngày.
  function dsO_(dsDong) {
    return dsDong.map(function (d) { return 'A' + d + ':L' + d; });
  }
  if (moc.tieuDe.length) {
    sh.getRangeList(dsO_(moc.tieuDe))
      .setBackground('#d2e3fc').setFontWeight('bold').setFontSize(11.5)
      .setFontColor('#174ea6');
  }
  if (moc.head.length) {
    sh.getRangeList(dsO_(moc.head))
      .setBackground('#f1f3f4').setFontWeight('bold').setFontSize(10)
      .setWrap(true).setVerticalAlignment('middle');
  }
  if (moc.tongThuong.length) {
    sh.getRangeList(dsO_(moc.tongThuong)).setBackground('#e6f4ea').setFontWeight('bold');
  }
  if (moc.tongVua.length) {
    sh.getRangeList(dsO_(moc.tongVua)).setBackground('#fef7e0').setFontWeight('bold');
  }
  if (moc.tongCao.length) {
    sh.getRangeList(dsO_(moc.tongCao)).setBackground('#fad2cf').setFontWeight('bold');
  }
  if (moc.khoiPhieu.length) {
    sh.getRangeList(moc.khoiPhieu)
      .setBorder(true, true, true, true, true, true, MAU_VIEN,
        SpreadsheetApp.BorderStyle.SOLID);
  }

  // Bảng theo thợ
  sh.getRange(dHead2, 1, 1, SO_COT_BC)
    .setBackground('#e8eaed').setFontWeight('bold').setFontSize(10.5)
    .setWrap(true).setVerticalAlignment('middle');
  if (dCuoi2 >= dHead2) {
    sh.getRange(dHead2, 1, dCuoi2 - dHead2 + 1, SO_COT_BC)
      .setBorder(true, true, true, true, true, true, MAU_VIEN,
        SpreadsheetApp.BorderStyle.SOLID);
  }

  sh.getRange(dChuThich, 1, 2, SO_COT_BC).setFontColor('#5f6368').setFontSize(10);

  sh.setColumnWidth(1, 120);   // Phiếu
  sh.setColumnWidth(2, 115);   // Máy
  sh.setColumnWidth(3, 210);   // Hư gì
  [4, 5, 6].forEach(function (c) { sh.setColumnWidth(c, 88); });   // 3 mốc giờ
  sh.setColumnWidth(7, 78);    // Phút dừng
  sh.setColumnWidth(8, 95);    // Thợ
  [9, 10, 11].forEach(function (c) { sh.setColumnWidth(c, 82); });  // 3 cột đáp ứng
  sh.setColumnWidth(12, 290);  // Ghi chú
  sh.setFrozenRows(dXuat);
  // KHÔNG cố định cột: tiêu đề trang và các ô số lớn là ô hợp nhất trải ngang
  // A→L, mà Sheets từ chối cố định cột cắt ngang ô hợp nhất — gọi setFrozenColumns
  // ở đây làm cả hàm xuất báo cáo văng giữa chừng.
  sh.setHiddenGridlines(true);
}

// ============================================================================
// 3b. SHEET Theo_Ngay — mỗi ngày một dòng
// ============================================================================

const HEADER_THEO_NGAY = [
  'Ngày', 'Thứ', 'Số sự cố mở trong ngày',
  'Số lần máy phải dừng', 'Trong đó: dừng KHÔNG do hư',
  'Phút dừng do hư hỏng', 'Phút dừng nguyên nhân khác',
  'TỔNG PHÚT MÁY NẰM IM', 'Quy ra giờ',
  'Phút sửa (phiếu mở trong ngày)', 'Phiếu còn đang dừng',
];

/**
 * Bảng theo ngày — thứ trả lời thẳng câu "máy dừng bao nhiêu phút mỗi ngày".
 *
 * QUY ƯỚC QUAN TRỌNG, đã ghi luôn thành dòng chú thích dưới bảng: cột phút là
 * số phút máy NẰM IM TRONG NGÀY ĐÓ, cắt theo ngày thật. Một phiếu dừng từ 10/08
 * tới 13/08 được rải ra cả 4 ngày chứ không dồn 4300 phút vào ngày 10/08. Nhờ
 * vậy không ngày nào vượt quá 1440 phút và con số đọc lên có nghĩa.
 *
 * Hệ quả phải chấp nhận: cộng dọc cột này có thể không bằng tổng downtime của
 * các phiếu mở trong kỳ, vì phần dừng vắt ra ngoài khoảng ngày đã chọn bị cắt.
 * Cột "Số phiếu mở trong ngày" giữ lại cách đếm theo phiếu để đối chiếu.
 */
/**
 * Gom số liệu theo từng ngày. Hàm THUẦN — trang tổng hợp và sheet Theo_Ngay dùng
 * chung kết quả này, nên hai nơi không bao giờ ra số lệch nhau.
 *
 * @return {Object} { dong: [...], tong: {...} }
 */
function gomTheoNgay_(ds, ctx, bayGio) {
  const luc = bayGio || nowVN_();

  // Tính khoảng dừng của từng phiếu MỘT LẦN rồi mới rải ra các ngày, thay vì
  // tính lại trong vòng lặp ngày × phiếu.
  const dsKhoang = ds.map(function (v) {
    return {
      v: v,
      khoang: khoangDungMay_(v, luc),
      suCo: laSuCo_(v),
      ngayMo: ngayCuaPhieu_(v),
    };
  });

  const dong = [];
  const tong = { soSuCo: 0, soDung: 0, soPhaiDung: 0,
    phutHu: 0, phutKhac: 0, phutSua: 0, conDung: 0, soChoBan: 0 };

  dsNgayTrongKy_(ctx.tuNgay, ctx.denNgay).forEach(function (ngay) {
    const r = { ngay: ngay, thu: thuCuaNgay_(ngay), soSuCo: 0, soDung: 0,
      soPhaiDung: 0, phutHu: 0, phutKhac: 0, phutSua: 0, conDung: 0,
      soChoBan: 0, dapUng: [], sauRanh: [], choBan: [], phieu: [] };

    dsKhoang.forEach(function (x) {
      const moTrongNgay = x.ngayMo === ngay;
      const p = phutDungTrongNgay_(x.khoang, ngay);

      if (moTrongNgay) {
        if (x.suCo) r.soSuCo++;
        else if (laDungMay_(x.v)) r.soDung++;
        // Số lần máy THỰC SỰ phải dừng hôm đó, bất kể loại phiếu. Khác với
        // soDung (chỉ đếm phiếu DM- dừng không do hư) — để chung một chỗ thì
        // dòng tổng ghi "0 lần dừng máy" ngay cạnh "4,2 giờ máy nằm im".
        if (x.khoang) r.soPhaiDung++;
        r.phutSua += Number(x.v[COT.Phut_Xu_Ly]) || 0;
        if (String(x.v[COT.Phut_Tiep_Nhan]) !== '') {
          r.dapUng.push(Number(x.v[COT.Phut_Tiep_Nhan]));
        }
        if (String(x.v[COT.Phut_Dap_Ung_Thuc]) !== '') {
          r.sauRanh.push(Number(x.v[COT.Phut_Dap_Ung_Thuc]));
        }
        if (String(x.v[COT.Phut_Cho_Tho_Ban]) !== '') {
          const c = Number(x.v[COT.Phut_Cho_Tho_Ban]);
          r.choBan.push(c);
          if (c > 0) r.soChoBan++;
        }
      }
      if (p) {
        if (x.suCo) r.phutHu += p; else r.phutKhac += p;
        if (x.khoang.dangDung) r.conDung++;
      }

      // Phiếu mở hôm nay, HOẶC phiếu mở hôm trước mà máy vẫn còn nằm im hôm nay.
      // Thiếu vế sau thì sẽ có ngày hiện 1440 phút mà không dòng nào giải thích.
      if (moTrongNgay || p) {
        r.phieu.push({ v: x.v, khoang: x.khoang, phut: p, moTrongNgay: moTrongNgay });
      }
    });

    // Sắp theo lúc máy bắt đầu nằm im, thiếu mốc đó thì theo giờ báo.
    r.phieu.sort(function (a, b) {
      return mocSapXep_(a) - mocSapXep_(b);
    });

    r.tongPhut = r.phutHu + r.phutKhac;
    ['soSuCo', 'soDung', 'soPhaiDung', 'phutHu', 'phutKhac', 'phutSua',
      'conDung', 'soChoBan'].forEach(function (k) { tong[k] += r[k]; });
    dong.push(r);
  });

  tong.tongPhut = tong.phutHu + tong.phutKhac;
  return { dong: dong, tong: tong };
}

/** Phút → giờ, làm tròn 1 chữ số thập phân. */
function quyRaGio_(phut) {
  return Math.round((Number(phut) || 0) / 6) / 10;
}

/** Mốc dùng để sắp xếp phiếu trong một ngày. */
function mocSapXep_(p) {
  if (p.khoang) return p.khoang.tu.getTime();
  const bao = p.v[COT.Thoi_Gian_Bao];
  return bao instanceof Date ? bao.getTime() : 0;
}

const TEN_THU = {
  T2: 'THỨ HAI', T3: 'THỨ BA', T4: 'THỨ TƯ', T5: 'THỨ NĂM',
  T6: 'THỨ SÁU', T7: 'THỨ BẢY', CN: 'CHỦ NHẬT',
};

/**
 * Một mốc thời gian hiển thị trong khối của ngày `ngay`:
 * cùng ngày thì chỉ giờ, khác ngày thì kèm ngày — nếu không, phiếu vắt qua nhiều
 * ngày sẽ hiện "14:00" ở khối ngày 11/08 và người đọc tưởng hôm đó mới báo hư.
 */
function mocTrongNgay_(d, ngay) {
  if (!(d instanceof Date)) return '—';
  const nd = fmtNgay_(d);
  return nd === ngay ? fmtGio_(d) : ngayVN_(nd).slice(0, 5) + ' ' + fmtGio_(d);
}

/**
 * Phiếu nào khiến phiếu `v` phải chờ — tức việc thợ đang làm dở trong lúc máy này
 * nằm chờ. Dùng ĐÚNG điều kiện của `tinhDapUng_` (LuongTho.gs) để con số phút và
 * lời giải thích không bao giờ nói ngược nhau.
 *
 * Trả { ma, xong } hoặc null. Null mà phiếu vẫn có Phut_Cho_Tho_Ban > 0 nghĩa là
 * việc gây bận nằm NGOÀI phạm vi lọc của báo cáo (bộ phận khác, hoặc kỳ khác).
 */
function timPhieuGayBan_(v, ds) {
  const maTho = String(v[COT.Ma_Tho] || '').trim();
  const bao = v[COT.Thoi_Gian_Bao];
  const nhan = v[COT.Thoi_Gian_Nhan];
  if (!maTho || !(bao instanceof Date) || !(nhan instanceof Date)) return null;

  let kq = null;
  ds.forEach(function (k) {
    if (k === v) return;
    if (String(k[COT.Ma_Tho] || '').trim() !== maTho) return;
    const kNhan = k[COT.Thoi_Gian_Nhan];
    const kXong = k[COT.Thoi_Gian_Hoan_Thanh];
    if (!(kNhan instanceof Date) || !(kXong instanceof Date)) return;
    if (kNhan < nhan && kXong > bao) {
      if (!kq || kXong > kq.xong) kq = { ma: String(k[COT.Ma_Su_Co]), xong: kXong };
    }
  });
  return kq;
}

/** Ghi chú cuối dòng: tình trạng phiếu + lý do bị trừ thời gian chờ. */
function ghiChuDong_(p, ngay, gayBan) {
  const v = p.v;
  const phan = [];

  if (!p.moTrongNgay) phan.push('tiếp từ ' + ngayVN_(ngayCuaPhieu_(v)).slice(0, 5));
  if (!p.khoang) {
    phan.push('máy vẫn chạy');
  } else if (p.khoang.dangDung) {
    phan.push('chưa chạy lại');
  } else if (p.khoang.den.getTime() >
             ngayCaSangDate_(ngay).getTime() + 24 * 60 * 60 * 1000) {
    phan.push('còn tiếp sang hôm sau');
  }

  const cho = Number(v[COT.Phut_Cho_Tho_Ban]) || 0;
  if (p.moTrongNgay && cho > 0) {
    phan.push(gayBan
      ? 'chờ ' + cho + ' phút do thợ đang làm ' + gayBan.ma
      : 'chờ ' + cho + ' phút do thợ bận việc ngoài phạm vi báo cáo này');
  }
  return phan.join(' · ');
}

/** 'yyyy-MM-dd' → 'THỨ HAI, 10/08/2026'. */
function tieuDeNgay_(ngay) {
  const thu = TEN_THU[thuCuaNgay_(ngay)] || '';
  return (thu ? thu + ', ' : '') + ngayVN_(ngay);
}

/**
 * Mô tả khoảng máy nằm im của một phiếu TRONG một ngày cụ thể.
 *
 * Phiếu vắt qua nhiều ngày phải nói rõ là tiếp từ đâu / còn tiếp, nếu không người
 * đọc sẽ tưởng cùng một máy hỏng đi hỏng lại nhiều lần.
 */
function moTaGioDung_(khoang, ngay) {
  if (!khoang) return 'không dừng máy';
  const d0 = ngayCaSangDate_(ngay);
  if (!d0) return '';

  const dauNgay = d0.getTime();
  const cuoiNgay = dauNgay + 24 * 60 * 60 * 1000;
  const batDauTrongNgay = khoang.tu.getTime() >= dauNgay;
  const ketThucTrongNgay = khoang.den.getTime() <= cuoiNgay;
  const tuNgay = ngayVN_(fmtNgay_(khoang.tu)).slice(0, 5);

  if (batDauTrongNgay && ketThucTrongNgay) {
    return fmtGio_(khoang.tu) + '–' + fmtGio_(khoang.den) +
      (khoang.dangDung ? ' (chưa chạy lại)' : '');
  }
  if (batDauTrongNgay) return fmtGio_(khoang.tu) + ' → còn tiếp';
  if (ketThucTrongNgay) return '→ ' + fmtGio_(khoang.den) + ' (tiếp từ ' + tuNgay + ')';
  return 'cả ngày (tiếp từ ' + tuNgay + ')';
}

function ghiTheoNgay_(ssMoi, ds, ctx) {
  const sh = ssMoi.insertSheet('Theo_Ngay');
  const bayGio = nowVN_();
  const gom = gomTheoNgay_(ds, ctx, bayGio);

  const bang = [HEADER_THEO_NGAY];
  gom.dong.forEach(function (r) {
    bang.push([
      ngayCaSangDate_(r.ngay), r.thu, r.soSuCo, r.soPhaiDung, r.soDung,
      r.phutHu, r.phutKhac, r.tongPhut, quyRaGio_(r.tongPhut),
      r.phutSua, r.conDung || '',
    ]);
  });

  const tg = gom.tong;
  bang.push(['TỔNG CỘNG', '', tg.soSuCo, tg.soPhaiDung, tg.soDung,
    tg.phutHu, tg.phutKhac, tg.tongPhut, quyRaGio_(tg.tongPhut), tg.phutSua, '']);

  const dongGhiChu = bang.length + 2;
  sh.getRange(1, 1, bang.length, HEADER_THEO_NGAY.length).setValues(bang);
  dinhDangHeader_(sh, 1, HEADER_THEO_NGAY.length);
  sh.setFrozenRows(1);

  if (bang.length > 1) {
    sh.getRange(2, 1, bang.length - 1, 1).setNumberFormat('dd/MM/yyyy');
  }
  // Dòng TỔNG CỘNG
  sh.getRange(bang.length, 1, 1, HEADER_THEO_NGAY.length)
    .setFontWeight('bold').setBackground('#fef7e0');
  sh.getRange(1, 8, bang.length, 1).setFontWeight('bold');   // cột TỔNG PHÚT
  sh.setColumnWidth(1, 110);
  [3, 4, 5, 6, 7, 8, 10, 11].forEach(function (c) { sh.setColumnWidth(c, 120); });

  // Viền + tô chủ nhật bằng MỘT lần setBackgrounds cho cả cột nền, thay vì gọi
  // setBackground cho từng dòng (chậm và dễ chạm giới hạn thời gian chạy).
  sh.getRange(1, 1, bang.length, HEADER_THEO_NGAY.length)
    .setBorder(true, true, true, true, true, true, '#dadce0',
      SpreadsheetApp.BorderStyle.SOLID);
  if (gom.dong.length) {
    const nen = gom.dong.map(function (r) {
      const mau = r.thu === 'CN' ? '#f1f3f4' : '#ffffff';
      return new Array(HEADER_THEO_NGAY.length).fill(mau);
    });
    sh.getRange(2, 1, gom.dong.length, HEADER_THEO_NGAY.length).setBackgrounds(nen);
  }

  sh.getRange(dongGhiChu, 1, 3, 1).setValues([
    ['Kỳ báo cáo: ' + ctx.nhanKy + moTaBoLoc_(ctx)],
    ['Cột phút là số phút máy NẰM IM TRONG NGÀY ĐÓ, đã cắt theo từng ngày — ' +
      'một phiếu dừng nhiều ngày được chia ra chứ không dồn hết vào ngày mở phiếu.'],
    ['Phiếu chưa đóng được tính tới lúc xuất báo cáo (' +
      fmtNgay_(bayGio) + ' ' + fmtGio_(bayGio) + ') và đếm ở cột "Phiếu còn đang dừng".'],
  ]);
  sh.getRange(dongGhiChu, 1, 3, 1).setFontColor('#5f6368').setFontSize(11);
}

/** Mô tả bộ lọc đang áp dụng, để in kèm vào các sheet. '' nếu không lọc gì. */
function moTaBoLoc_(ctx) {
  const phan = [];
  if (ctx.dsBoPhan && ctx.dsBoPhan.length) phan.push('bộ phận ' + ctx.dsBoPhan.join(', '));
  if (ctx.dsTho && ctx.dsTho.length) phan.push('thợ ' + ctx.dsTho.join(', '));
  phan.push(ctx.kemViecChung
    ? 'gồm cả việc chung và bảo trì'
    : 'chỉ phiếu gắn với máy (sự cố + dừng máy)');
  return ' — ' + phan.join(' · ');
}

// ============================================================================
// 4. SHEET DANH_MUC
// ============================================================================

function ghiDanhMucXuat_(ssMoi, ctx) {
  const sh = ssMoi.insertSheet('DANH_MUC');
  const may = locMayTheoBoPhan_(docSheet_(SHEET.MAY, HEADER_MAY), ctx);
  const tho = locThoTheoCtx_(docSheet_(SHEET.THO, HEADER_THO), ctx);

  const soDong = Math.max(may.length, tho.length);
  const bang = [['Mã máy', 'Tên máy', 'Bộ phận', '', '', '', '', '', '', '',
    'Danh sách người xử lý']];

  for (let i = 0; i < soDong; i++) {
    const r = new Array(11).fill('');
    if (may[i]) { r[0] = may[i].Ma_May; r[1] = may[i].Ten_May; r[2] = may[i].Bo_Phan; }
    if (tho[i]) { r[10] = tho[i].Ten_Tho; }
    bang.push(r);
  }

  sh.getRange(1, 1, bang.length, 11).setValues(bang);
  dinhDangHeader_(sh, 1, 11);
  sh.setFrozenRows(1);
  sh.setColumnWidth(2, 220);
}

// ============================================================================
// 5. SHEET Dashboard — bám đúng bố cục 2 khối của file gốc
// ============================================================================

/**
 * Gom số liệu theo máy và theo thợ. Hàm THUẦN, dùng chung cho Dashboard và trang
 * tổng hợp — hai nơi không được phép ra số khác nhau.
 *
 * Các ô tổng chỉ đếm SỰ CỐ MÁY: "số lần hỏng" và "downtime" mà gộp cả việc chung
 * với bảo trì vào thì con số gửi sếp sai hẳn ý nghĩa. Việc chung, bảo trì và
 * dừng máy được đếm riêng.
 */
function gomTheoMayTho_(ds) {
  const t = { soSuCo: 0, soViecChung: 0, soBaoTri: 0, soDungMay: 0,
    tongDowntime: 0, tongThoiGianSua: 0 };
  const theoMay = {};
  const theoTho = {};

  ds.forEach(function (v) {
    const suCo = laSuCo_(v);
    if (suCo) t.soSuCo++;
    else if (laCongViec_(v)) t.soViecChung++;
    else if (laDungMay_(v)) t.soDungMay++;
    else t.soBaoTri++;

    const dt = Number(phutDungMay_(v)) || 0;
    const sua = Number(v[COT.Phut_Xu_Ly]) || 0;

    if (suCo) {
      t.tongDowntime += dt;
      t.tongThoiGianSua += sua;

      const tenMay = String(v[COT.Ten_May]).trim();
      if (tenMay) {
        if (!theoMay[tenMay]) theoMay[tenMay] = { lan: 0, downtime: 0, sua: 0 };
        theoMay[tenMay].lan++;
        theoMay[tenMay].downtime += dt;
        theoMay[tenMay].sua += sua;
      }
    }

    const tenTho = String(v[COT.Ten_Tho]).trim();
    if (tenTho) {
      if (!theoTho[tenTho]) {
        theoTho[tenTho] = { soViec: 0, dapUng: [], sauRanh: [], choBan: [],
          chong: 0, soChoBan: 0, tongCho: 0,
          suCo: 0, viecChung: 0, baoTri: 0, tongSua: 0, tongDung: 0 };
      }
      const x = theoTho[tenTho];
      x.soViec++;
      if (suCo) x.suCo++; else if (laCongViec_(v)) x.viecChung++; else x.baoTri++;
      if (String(v[COT.Phut_Tiep_Nhan]) !== '') x.dapUng.push(Number(v[COT.Phut_Tiep_Nhan]));
      if (String(v[COT.Phut_Dap_Ung_Thuc]) !== '') x.sauRanh.push(Number(v[COT.Phut_Dap_Ung_Thuc]));
      // "Chồng việc" (So_Chong_Viec) chỉ đếm lúc bấm nhận mà việc cũ CHƯA đóng.
      // Còn máy phải chờ vì thợ đang bận thì xảy ra cả khi thợ đã đóng việc cũ
      // trước đó — hai con số khác nhau, phải để cạnh nhau mới kiểm chứng được.
      if (String(v[COT.Phut_Cho_Tho_Ban]) !== '') {
        const c = Number(v[COT.Phut_Cho_Tho_Ban]);
        x.choBan.push(c);
        if (c > 0) { x.soChoBan++; x.tongCho += c; }
      }
      if (Number(v[COT.So_Chong_Viec]) > 0) x.chong++;
      // Tổng phút sửa tính cho MỌI loại việc người đó làm; tổng phút máy dừng chỉ
      // tính phiếu thực sự làm máy nằm im. Hai con số này trả lời câu "thợ X sửa
      // máy mất bao lâu" mà bảng cũ chỉ có số trung bình nên không đáp được.
      x.tongSua += sua;
      x.tongDung += dt;
    }
  });

  return { tong: t, theoMay: theoMay, theoTho: theoTho };
}

function ghiDashboard_(ssMoi, ds, ctx) {
  const sh = ssMoi.insertSheet('Dashboard');
  const SO_COT = 18; // A..R

  const gom = gomTheoMayTho_(ds);
  const theoMay = gom.theoMay;
  const theoTho = gom.theoTho;
  const soSuCo = gom.tong.soSuCo;
  const soViecChung = gom.tong.soViecChung;
  const soBaoTri = gom.tong.soBaoTri;
  const soDungMay = gom.tong.soDungMay;
  const tongDowntime = gom.tong.tongDowntime;
  const tongThoiGianSua = gom.tong.tongThoiGianSua;
  const dsDungMay = ds.filter(laDungMay_);

  // --- Dựng lưới ------------------------------------------------------------
  const dsMay = locMayTheoBoPhan_(docSheet_(SHEET.MAY, HEADER_MAY), ctx);
  const dsTho = locThoTheoCtx_(docSheet_(SHEET.THO, HEADER_THO), ctx);

  const soDong = Math.max(7 + dsMay.length, 3 + dsTho.length, 8);
  const luoi = [];
  for (let i = 0; i < soDong; i++) luoi.push(new Array(SO_COT).fill(''));

  function dat_(dong, cot, gt) { luoi[dong - 1][cot - 1] = gt; }

  // Khối trái — các ô tổng
  dat_(1, 1, 'TỔNG SỐ LẦN HỎNG');
  dat_(1, 3, 'TỔNG DOWNTIME (PHÚT)');
  dat_(1, 5, 'TỔNG THỜI GIAN SỬA (PHÚT)');
  dat_(1, 7, 'TỔNG VIỆC CHUNG');
  dat_(1, 8, 'TỔNG BẢO TRÌ');
  dat_(2, 1, soSuCo);
  dat_(2, 3, tongDowntime);
  dat_(2, 5, tongThoiGianSua);
  // Kỳ không lấy việc chung / bảo trì thì hai ô này ghi rõ là "không xuất" chứ
  // không để số 0 — số 0 sẽ bị đọc thành "cả tháng thợ không làm việc chung nào".
  dat_(2, 7, ctx.kemViecChung ? soViecChung : '— không xuất kỳ này');
  dat_(2, 8, ctx.kemViecChung ? soBaoTri : '— không xuất kỳ này');
  const dtKhac = tongPhutDung_(dsDungMay);
  const tongMayDung = tongDowntime + dtKhac;

  dat_(3, 1, 'Phạm vi: ' + ctx.nhanKy + moTaBoLoc_(ctx));

  dat_(4, 1, 'Kỳ báo cáo');
  dat_(4, 2, ctx.nhanKy);
  dat_(4, 3, 'Tổng cộng mọi loại phiếu');
  dat_(4, 4, ds.length);

  dat_(5, 1, 'Lần dừng máy (không hư)');
  dat_(5, 2, soDungMay);
  dat_(5, 3, 'Phút dừng do nguyên nhân khác');
  dat_(5, 4, dtKhac);

  // Tách nguyên nhân để quy trách nhiệm, nhưng vẫn phải có một con số tổng: với
  // sản xuất thì máy nằm im là máy nằm im, dù vì hỏng hay vì thiếu nguyên liệu.
  dat_(6, 1, 'TỔNG PHÚT MÁY DỪNG (mọi nguyên nhân)');
  dat_(6, 2, tongMayDung);
  dat_(6, 3, 'Quy ra giờ');
  dat_(6, 4, Math.round(tongMayDung / 6) / 10);

  // Khối phải — thống kê theo thợ, mở rộng thêm 3 cột đếm theo loại việc
  dat_(1, 9, 'THỐNG KÊ THEO THỢ — LÀM GÌ TRONG KỲ');
  ['Thợ', 'Tổng việc', 'TB đáp ứng', 'TB sau khi rảnh', 'Số lần chồng',
    'Tổng phút sửa', 'Tổng phút máy dừng',
    'Sự cố máy', 'Việc chung', 'Bảo trì hằng ngày']
    .forEach(function (h, i) { dat_(3, 9 + i, h); });

  dsTho.forEach(function (t, i) {
    const ten = String(t.Ten_Tho).trim();
    const s = theoTho[ten] ||
      { soViec: 0, dapUng: [], sauRanh: [], chong: 0, suCo: 0, viecChung: 0,
        baoTri: 0, tongSua: 0, tongDung: 0 };
    const d = 4 + i;
    dat_(d, 9, ten);
    dat_(d, 10, s.soViec);
    dat_(d, 11, trungBinh_(s.dapUng));
    dat_(d, 12, trungBinh_(s.sauRanh));
    dat_(d, 13, s.chong);
    dat_(d, 14, s.tongSua);
    dat_(d, 15, s.tongDung);
    dat_(d, 16, s.suCo);
    dat_(d, 17, ctx.kemViecChung ? s.viecChung : '—');
    dat_(d, 18, ctx.kemViecChung ? s.baoTri : '—');
  });

  // Khối trái — bảng theo máy, bắt đầu từ dòng 7 như file gốc
  ['Mã máy', 'Tên máy', 'Bộ phận', 'Số lần hỏng', 'Tổng Downtime', 'Tổng thời gian sửa']
    .forEach(function (h, i) { dat_(7, 1 + i, h); });

  dsMay.forEach(function (m, i) {
    const ten = String(m.Ten_May).trim();
    const s = theoMay[ten] || { lan: 0, downtime: 0, sua: 0 };
    const d = 8 + i;
    dat_(d, 1, m.Ma_May);
    dat_(d, 2, ten);
    dat_(d, 3, m.Bo_Phan);
    dat_(d, 4, s.lan);
    dat_(d, 5, s.downtime);
    dat_(d, 6, s.sua);
  });

  sh.getRange(1, 1, luoi.length, SO_COT).setValues(luoi);

  // --- Định dạng ------------------------------------------------------------
  ['A1:B1', 'C1:D1', 'E1:F1', 'I1:R1'].forEach(function (a) {
    sh.getRange(a).merge().setFontWeight('bold').setBackground('#e8eaed')
      .setHorizontalAlignment('center').setWrap(true);
  });
  sh.getRange('G1:H1').setFontWeight('bold').setBackground('#e8eaed').setWrap(true);
  sh.getRange('A2:F2').setFontSize(14).setFontWeight('bold');
  // Hai ô việc chung / bảo trì có thể mang dòng chữ "không xuất kỳ này" — để cỡ
  // 14 thì chữ tràn sang ô bên cạnh.
  sh.getRange('G2:H2').setFontWeight('bold')
    .setFontSize(ctx.kemViecChung ? 14 : 10).setWrap(true);
  sh.getRange('A3').setFontColor('#5f6368').setFontSize(11);
  sh.getRange('A4:A6').setFontWeight('bold');
  sh.getRange('C4:C6').setFontWeight('bold');
  sh.getRange('A6:D6').setBackground('#fef7e0');
  dinhDangHeader_(sh, 7, 6);
  sh.getRange(3, 9, 1, 10).setFontWeight('bold').setBackground('#e8eaed').setWrap(true);
  sh.setColumnWidth(2, 230);
  sh.setColumnWidth(9, 130);
  sh.setFrozenRows(7);
}

// ============================================================================
// 6. SHEET HD_DAP_UNG — chép lại nguyên văn hướng dẫn của biểu mẫu gốc
// ============================================================================

function ghiHuongDan_(ssMoi, ctx) {
  const sh = ssMoi.insertSheet('HD_DAP_UNG');
  const bang = [
    ['HƯỚNG DẪN ĐỌC BÁO CÁO HƯ HỎNG — ' + ctx.nhanKy, '', '', ''],
    ['Phạm vi' + moTaBoLoc_(ctx), '', '', ''],
    ['Bước', 'Cột', 'Nguồn dữ liệu', 'Ghi chú'],
    ['1', 'Ngày sửa, Ca, Tên máy', 'Công nhân quét QR trên máy để báo',
      'Mã sự cố và bộ phận do hệ thống tự sinh'],
    ['2', 'Bắt đầu hư', 'Mốc máy thực sự dừng',
      'Để trống nếu máy vẫn chạy khi báo — khi đó không tính downtime'],
    ['3', 'Bắt đầu sửa, Kết thúc sửa', 'Lúc thợ bấm Nhận việc / Hoàn thành',
      'Thời gian sửa và dừng máy tự tính'],
    ['4', 'Người sửa chữa', 'Thợ bấm Nhận việc trên link cá nhân',
      'Không ai nhận thì cột này trống'],
    ['5', 'Thời gian chờ do thợ bận', 'Tính tự động khi nhận việc',
      'Phần máy phải chờ vì thợ đang làm việc khác — KHÔNG tính vào KPI thợ'],
    ['6', 'Thời gian đáp ứng sau khi thợ rảnh', 'Tính tự động khi nhận việc',
      'Đây mới là chỉ số đánh giá thợ. Hai cột này cộng lại bằng đáp ứng tổng'],
    ['7', 'Trạng thái đáp ứng', 'Suy ra từ số liệu',
      'CHỒNG VIỆC = thợ nhận việc mới khi chưa đóng việc cũ'],
    ['8', 'Sheet Theo_Ngay', 'Cắt thời gian dừng theo từng ngày',
      'Phiếu dừng nhiều ngày được CHIA cho từng ngày, không dồn vào ngày mở phiếu. ' +
      'Vì vậy cộng dọc cột phút có thể lệch với tổng theo phiếu ở Dashboard khi ' +
      'khoảng dừng vắt ra ngoài kỳ báo cáo'],
    ['', '', '', ''],
    ['Lưu ý', 'Số liệu trong file này là GIÁ TRỊ ĐÃ TÍNH SẴN, không phải công thức.',
      '', 'Sửa tay ở đây sẽ không tự tính lại — muốn số mới thì xuất lại báo cáo.'],
  ];
  sh.getRange(1, 1, bang.length, 4).setValues(bang);
  sh.getRange('A1:D1').merge().setFontWeight('bold').setFontSize(13);
  sh.getRange('A2:D2').merge().setFontColor('#5f6368');
  dinhDangHeader_(sh, 3, 4);
  sh.setColumnWidth(2, 250);
  sh.setColumnWidth(3, 250);
  sh.setColumnWidth(4, 380);
  sh.getRange(1, 1, bang.length, 4).setWrap(true);
}

// ============================================================================
// 7. SHEET "Nhật ký bảo trì" — form KPI Dệt, chỉ bộ phận DET
// ============================================================================

const HEADER_NHAT_KY_DET = [
  'Mã sự cố', 'Ngày sửa', 'Ca', 'Tên máy', 'Nội dung hư hỏng (Bệnh)',
  'Bắt đầu hư', 'Bắt đầu sửa', 'Kết thúc sửa',
  'Thời gian sửa máy (Phút)', 'Thời gian dừng máy (Phút)',
];

/**
 * Sự cố máy của bộ phận Dệt — nguồn của sheet "Nhật ký bảo trì".
 *
 * Lọc cả `laSuCo_`: form KPI Dệt là nhật ký MÁY HỎNG. Dừng máy không do hư, việc
 * chung và bảo trì hằng ngày lọt vào đây sẽ thổi phồng số lần hỏng của Dệt.
 */
function locSuCoDet_(ds) {
  return ds.filter(function (v) {
    return laSuCo_(v) && laBoPhanDet_(v[COT.Bo_Phan]);
  });
}

function ghiNhatKyDet_(ssMoi, dsDet) {
  const sh = ssMoi.insertSheet('Nhật ký bảo trì');

  const bang = [HEADER_NHAT_KY_DET];
  dsDet.forEach(function (v) {
    bang.push([
      v[COT.Ma_Su_Co],
      ngayCaSangDate_(v[COT.Ngay_Ca]),
      nhanCa_(v[COT.Ca]),
      v[COT.Ten_May],
      noiDungHuHong_(v),
      gioCuaMoc_(mocBatDauHu_(v)),
      gioCuaMoc_(v[COT.Thoi_Gian_Nhan]),
      gioCuaMoc_(v[COT.Thoi_Gian_Hoan_Thanh]),
      v[COT.Phut_Xu_Ly],
      phutDungMay_(v),
    ]);
  });

  sh.getRange(1, 1, bang.length, HEADER_NHAT_KY_DET.length).setValues(bang);
  dinhDangHeader_(sh, 1, HEADER_NHAT_KY_DET.length);
  sh.setFrozenRows(1);

  if (bang.length > 1) {
    const n = bang.length - 1;
    sh.getRange(2, 2, n, 1).setNumberFormat('dd/MM/yyyy');
    sh.getRange(2, 6, n, 3).setNumberFormat('HH:mm');
  }
  sh.setColumnWidth(4, 200);
  sh.setColumnWidth(5, 260);
}
