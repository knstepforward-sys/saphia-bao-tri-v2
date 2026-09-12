/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * BƯỚC 4: Báo cáo tổng hợp, dọn dữ liệu cũ, trigger tự chạy.
 *
 * Toàn bộ số liệu tính bằng Apps Script rồi ghi ra dạng SỐ — không dùng công thức
 * Sheets, tránh lỗi locale/#ERROR! (nguyên tắc đã theo từ hệ thống SAPHIA).
 */

// Rộng 10 cột (A..J). Mọi dòng đều bị cắt đúng ngần này trong `them_`, nên thêm
// một cột vào bảng nào thì phải nâng con số này theo — không nâng thì cột mới
// biến mất lặng lẽ, sheet vẫn dựng xong và không có lỗi nào để mà thấy.
const SO_COT_TONG_HOP = 10;

// ============================================================================
// 1. refreshReports — dựng sheet Tong_Hop
// ============================================================================

/**
 * Tính lại toàn bộ sheet Tong_Hop cho một tháng.
 * @param {string} thang 'MM/yyyy'. Bỏ trống = tháng hiện tại.
 */
function refreshReports(thang) {
  const thangCan = thang || fmtThang_(nowVN_());
  if (!/^\d{2}\/\d{4}$/.test(thangCan)) {
    throw new Error('Tháng phải dạng MM/yyyy, ví dụ 08/2026.');
  }
  const khoaThang = thangCan.slice(3) + '-' + thangCan.slice(0, 2); // 'yyyy-MM'

  // Đọc CẢ Luu_Tru, không riêng Su_Co: từ khi cắt theo tháng lịch thì tháng
  // trước đã nằm bên lưu trữ, đọc mỗi Su_Co là tính lại Tong_Hop tháng cũ ra
  // bảng rỗng mà không báo lỗi gì.
  const ds = docSuCoVaLuuTru_().filter(function (v) {
    return thangCuaPhieu_(v) === khoaThang;
  });

  // Việc chung (lắp camera, sửa điện văn phòng…) không phải máy hỏng — tách ra
  // để không làm sai thống kê số lần hỏng theo máy và theo bộ phận.
  const dsSuCo = ds.filter(laSuCo_);
  const dsCongViec = ds.filter(laCongViec_);
  const dsBaoTri = ds.filter(laBaoTri_);
  const dsDungMay = ds.filter(laDungMay_);
  // Gọi kỹ thuật lúc máy đang dừng — không phải máy hỏng, nên tách khỏi dsSuCo,
  // nhưng vẫn là công thợ nên phải hiện ra một dòng riêng chứ không được im.
  const dsHoTro = ds.filter(laHoTro_);

  const out = [];
  function them_(arr) {
    const r = (arr || []).slice(0, SO_COT_TONG_HOP);
    while (r.length < SO_COT_TONG_HOP) r.push('');
    out.push(r);
  }

  them_(['BÁO CÁO TỔNG HỢP BẢO TRÌ']);
  them_(['Tháng', thangCan, 'Cập nhật lúc',
    Utilities.formatDate(nowVN_(), CONFIG.MUI_GIO, 'HH:mm dd/MM/yyyy')]);
  them_(['Nguồn: sheet Su_Co. Phiếu đã chuyển sang Luu_Tru không còn được tính ở đây.']);
  them_([]);

  // --- Tổng quan ------------------------------------------------------------
  const tq = gomNhom_(dsSuCo);
  them_(['TỔNG QUAN — SỰ CỐ MÁY']);
  them_(['Tổng phiếu', 'Chờ nhận', 'Đang xử lý', 'Hoàn thành',
    'TB tiếp nhận (phút)', 'TB xử lý (phút)']);
  them_([tq.tong, tq.cho, tq.dangXuLy, tq.xong, tq.tbTiepNhan, tq.tbXuLy]);
  them_([]);

  // --- Máy dừng, gộp mọi nguyên nhân ----------------------------------------
  // Tách theo nguyên nhân để biết trách nhiệm thuộc về ai, nhưng vẫn phải có một
  // con số tổng: với sản xuất thì máy nằm im là máy nằm im, dù vì hỏng hay vì
  // thiếu nguyên liệu.
  const dtHong = tongDowntimeSuCo_(dsSuCo);
  const dtKhac = tongPhutDung_(dsDungMay);
  them_(['GỌI KỸ THUẬT TRONG LÚC MÁY DỪNG']);
  them_(['Tổng phiếu', 'Chờ nhận', 'Đang xử lý', 'Hoàn thành',
    'TB tiếp nhận (phút)', 'TB xử lý (phút)']);
  const gHT = gomNhom_(dsHoTro);
  them_([gHT.tong, gHT.cho, gHT.dangXuLy, gHT.xong, gHT.tbTiepNhan, gHT.tbXuLy]);
  them_(['Phiếu HT- KHÔNG được tính là lần máy hỏng và KHÔNG đo thời gian máy ' +
    'dừng — phiếu DM- mở song song đã đo khoảng đó.']);
  them_([]);

  them_(['THỜI GIAN MÁY DỪNG — MỌI NGUYÊN NHÂN']);
  them_(['Do hư hỏng (phút)', 'Do nguyên nhân khác (phút)', 'TỔNG (phút)', 'TỔNG (giờ)']);
  them_([dtHong, dtKhac, dtHong + dtKhac, Math.round((dtHong + dtKhac) / 6) / 10]);
  them_([]);

  // --- Tỉ lệ hiệu dụng A ----------------------------------------------------
  // Đặt ngay dưới khối downtime vì hai con số nói cùng một chuyện ở hai thang đo:
  // trên là số phút tuyệt đối, dưới là phần trăm so với kế hoạch. Sếp đọc số phút
  // không biết nhiều hay ít; đọc phần trăm mới biết.
  //
  // Bọc try/catch: thiếu sheet kế hoạch hoặc khai sai giờ thì chỉ mất đúng khối
  // này, phần còn lại của Tong_Hop vẫn phải dựng được.
  try {
    khoiHieuDungThang_(thangCan, SO_COT_TONG_HOP).forEach(function (r) { out.push(r); });
  } catch (err) {
    them_(['TỈ LỆ HIỆU DỤNG A']);
    them_(['Chưa tính được: ' + err.message]);
  }
  them_([]);

  // --- Theo bộ phận ---------------------------------------------------------
  them_(['THEO BỘ PHẬN']);
  them_(['Bộ phận', 'Tổng phiếu', 'Chờ nhận', 'Đang xử lý', 'Hoàn thành',
    'TB tiếp nhận (phút)', 'TB xử lý (phút)']);
  const theoBoPhan = gomTheoKhoa_(dsSuCo, function (v) { return String(v[COT.Bo_Phan]).trim() || '(trống)'; });
  sapTheoTong_(theoBoPhan).forEach(function (x) {
    them_([x.khoa, x.tong, x.cho, x.dangXuLy, x.xong, x.tbTiepNhan, x.tbXuLy]);
  });
  if (!theoBoPhan.length) them_(['(chưa có dữ liệu)']);
  them_([]);

  // --- Theo thợ -------------------------------------------------------------
  them_(['THEO THỢ']);
  them_(['Đánh giá thợ dùng "TB đáp ứng THỰC" — đã trừ thời gian máy phải chờ vì ' +
    'thợ đang bận việc khác, nên không phạt oan người đang ôm nhiều việc.']);
  them_(['Thợ', 'Tổng phiếu', 'Hoàn thành', 'Đang xử lý',
    'TB đáp ứng THỰC (phút)', 'TB chờ do bận (phút)', 'Số lần chồng việc',
    'Việc chung', 'Bảo trì hằng ngày', 'Gọi kỹ thuật']);
  const theoTho = gomTheoKhoa_(
    ds.filter(function (v) { return String(v[COT.Ma_Tho]).trim(); }),
    function (v) { return String(v[COT.Ten_Tho]).trim() || String(v[COT.Ma_Tho]).trim(); }
  );
  sapTheoTong_(theoTho).forEach(function (x) {
    them_([x.khoa, x.tong, x.xong, x.dangXuLy,
      x.tbDapUngThuc, x.tbChoThoBan, x.soLanChongViec, x.soCongViec, x.soBaoTri,
      x.soHoTro]);
  });
  if (!theoTho.length) them_(['(chưa có ai nhận việc)']);
  them_([]);

  // --- Theo máy -------------------------------------------------------------
  them_(['THEO MÁY — hỏng nhiều nhất trước']);
  them_(['Mã máy', 'Tên máy', 'Bộ phận', 'Số lần hỏng', 'TB xử lý (phút)']);
  const theoMay = gomTheoKhoa_(dsSuCo, function (v) { return String(v[COT.Ma_May]).trim(); });
  sapTheoTong_(theoMay).forEach(function (x) {
    them_([x.khoa, x.mau[COT.Ten_May], x.mau[COT.Bo_Phan], x.tong, x.tbXuLy]);
  });
  if (!theoMay.length) them_(['(chưa có dữ liệu)']);
  them_([]);

  // --- Công việc chung ------------------------------------------------------
  const cv = gomNhom_(dsCongViec);
  them_(['CÔNG VIỆC CHUNG — không gắn với máy']);
  them_(['Việc chung vẫn chiếm thời gian của thợ, nên vẫn được tính là "thợ bận" ' +
    'khi xét chồng việc — nhưng không tính là lần hỏng của máy nào.']);
  them_(['Khu vực', 'Số việc', 'Hoàn thành', 'Đang làm', 'Tổng giờ làm (phút)']);
  const theoKhuVuc = gomTheoKhoa_(dsCongViec,
    function (v) { return String(v[COT.Bo_Phan]).trim() || '(chưa ghi khu vực)'; });
  sapTheoTong_(theoKhuVuc).forEach(function (x) {
    them_([x.khoa, x.tong, x.xong, x.dangXuLy, x.tongPhutXuLy]);
  });
  if (!theoKhuVuc.length) them_(['(chưa có công việc chung nào)']);
  else them_(['TỔNG CỘNG', cv.tong, cv.xong, cv.dangXuLy, cv.tongPhutXuLy]);
  them_([]);

  // --- Bảo trì hằng ngày ----------------------------------------------------
  them_(['BẢO TRÌ HẰNG NGÀY — chỉ đếm số việc']);
  them_(['Loại này không đo thời gian và KHÔNG được tính là "thợ bận", vì thợ làm ' +
    'rải rác trong ca — nếu tính thì mọi thời gian máy chờ đều được miễn trừ oan.']);
  them_(['Thợ', 'Số việc bảo trì']);
  const btTheoTho = gomTheoKhoa_(dsBaoTri,
    function (v) { return String(v[COT.Ten_Tho]).trim() || String(v[COT.Ma_Tho]).trim(); });
  sapTheoTong_(btTheoTho).forEach(function (x) { them_([x.khoa, x.tong]); });
  if (!btTheoTho.length) them_(['(chưa ghi việc bảo trì nào)']);
  else them_(['TỔNG CỘNG', dsBaoTri.length]);
  them_([]);

  // --- Dừng máy không do hư hỏng --------------------------------------------
  them_(['DỪNG MÁY KHÔNG DO HƯ HỎNG']);
  them_(['Máy dừng vì thiếu chỉ, hết nguyên liệu, chờ kế hoạch… Không phải lần hỏng ' +
    'của máy, nhưng vẫn là thời gian máy nằm im — tách riêng để nhìn ra nhà máy mất ' +
    'giờ vì hỏng hóc hay vì cung ứng.']);
  them_(['Lý do', 'Số lần', 'Đã chạy lại', 'Còn đang dừng', 'Tổng phút dừng']);

  const theoLyDo = gomTheoKhoa_(dsDungMay, function (v) {
    return chuanHoaLyDo_(v[COT.Mo_Ta]);
  });
  sapTheoTong_(theoLyDo).forEach(function (x) {
    // Gom bằng khoá đã chuẩn hoá, nhưng hiện lại đúng chữ người đầu tiên đã gõ.
    them_([lyDoHienThi_(x.mau[COT.Mo_Ta]), x.tong, x.xong, x.dangXuLy,
      tongPhutDung_(x.ds)]);
  });
  if (!theoLyDo.length) them_(['(chưa có phiếu dừng máy nào)']);
  else them_(['TỔNG CỘNG', dsDungMay.length,
    dsDungMay.filter(function (v) { return v[COT.Trang_Thai] === TRANG_THAI.HOAN_THANH; }).length,
    dsDungMay.filter(function (v) { return v[COT.Trang_Thai] !== TRANG_THAI.HOAN_THANH; }).length,
    tongPhutDung_(dsDungMay)]);

  // --- Ghi ra sheet ---------------------------------------------------------
  const sh = sheet_(SHEET.TONG_HOP);
  sh.clear();
  sh.getRange(1, 1, out.length, SO_COT_TONG_HOP).setValues(out);
  dinhDangTongHop_(sh, out);

  return 'Tổng hợp tháng ' + thangCan + ': ' + dsSuCo.length + ' phiếu sự cố, ' +
    dsCongViec.length + ' công việc chung, ' + dsBaoTri.length + ' việc bảo trì, ' +
    dsDungMay.length + ' lần dừng máy không do hư hỏng.';
}

/** Dùng cho trigger — trigger không truyền được tham số. */
function refreshReportsThangNay() {
  return refreshReports();
}

/** Đọc toàn bộ Su_Co (không giới hạn 500 dòng như docSuCoGanDay_). */
function docToanBoSuCo_() {
  const sh = sheet_(SHEET.SU_CO);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, HEADER_SU_CO.length).getValues()
    .filter(function (v) { return v[COT.Ma_Su_Co] !== '' && v[COT.Ma_Su_Co] !== null; });
}

/** Tháng của một phiếu, dạng 'yyyy-MM'. Ưu tiên Ngay_Ca, thiếu thì lấy Thoi_Gian_Bao. */
function thangCuaPhieu_(v) {
  const ngayCa = String(v[COT.Ngay_Ca] || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(ngayCa)) return ngayCa.slice(0, 7);
  if (v[COT.Thoi_Gian_Bao] instanceof Date) {
    return Utilities.formatDate(v[COT.Thoi_Gian_Bao], CONFIG.MUI_GIO, 'yyyy-MM');
  }
  return '';
}

/** Đếm và tính trung bình cho một tập phiếu. */
function gomNhom_(ds) {
  let cho = 0, dangXuLy = 0, xong = 0, soLanChongViec = 0, soCongViec = 0, soBaoTri = 0,
    soHoTro = 0;
  const tiepNhan = [], xuLy = [], dapUngThuc = [], choThoBan = [];

  function gom_(v, cot, dich) {
    const n = Number(v[cot]);
    if (isFinite(n) && String(v[cot]) !== '') dich.push(n);
  }

  ds.forEach(function (v) {
    const tt = v[COT.Trang_Thai];
    if (tt === TRANG_THAI.CHO_NHAN) cho++;
    else if (tt === TRANG_THAI.DANG_XU_LY) dangXuLy++;
    else if (tt === TRANG_THAI.HOAN_THANH) xong++;

    gom_(v, COT.Phut_Tiep_Nhan, tiepNhan);
    gom_(v, COT.Phut_Xu_Ly, xuLy);
    gom_(v, COT.Phut_Dap_Ung_Thuc, dapUngThuc);
    gom_(v, COT.Phut_Cho_Tho_Ban, choThoBan);

    if (Number(v[COT.So_Chong_Viec]) > 0) soLanChongViec++;
    if (laCongViec_(v)) soCongViec++;
    if (laBaoTri_(v)) soBaoTri++;
    if (laHoTro_(v)) soHoTro++;
  });

  return {
    tong: ds.length, cho: cho, dangXuLy: dangXuLy, xong: xong,
    tbTiepNhan: trungBinh_(tiepNhan),   // tổng — dùng cho chỉ số nhà máy/bộ phận
    tbXuLy: trungBinh_(xuLy),
    tbDapUngThuc: trungBinh_(dapUngThuc), // dùng cho KPI thợ
    tbChoThoBan: trungBinh_(choThoBan),
    soLanChongViec: soLanChongViec,
    soCongViec: soCongViec,
    soBaoTri: soBaoTri,
    soHoTro: soHoTro,
    tongPhutXuLy: xuLy.reduce(function (a, b) { return a + b; }, 0),
  };
}

function trungBinh_(ds) {
  if (!ds.length) return '';
  return Math.round(ds.reduce(function (a, b) { return a + b; }, 0) / ds.length);
}

/** Gom theo một khoá bất kỳ, trả mảng { khoa, mau, ...số liệu }. */
function gomTheoKhoa_(ds, layKhoa) {
  const nhom = {};
  ds.forEach(function (v) {
    const k = layKhoa(v);
    if (!k) return;
    if (!nhom[k]) nhom[k] = [];
    nhom[k].push(v);
  });
  return Object.keys(nhom).map(function (k) {
    const kq = gomNhom_(nhom[k]);
    kq.khoa = k;
    kq.mau = nhom[k][0]; // một dòng mẫu để lấy tên máy / bộ phận
    kq.ds = nhom[k];     // cả nhóm, cho các phép tính riêng như tổng phút dừng
    return kq;
  });
}

/** Phần lý do trong ô Mô tả của phiếu dừng máy — dạng "Lý do — ghi chú thêm". */
function lyDoHienThi_(moTa) {
  return String(moTa || '').split('—')[0].trim() || '(không ghi lý do)';
}

/**
 * Khoá gom nhóm cho lý do dừng máy.
 * Lý do gõ tự do nên "Thiếu chỉ", "thiếu  chỉ" và "thieu chi" phải rơi vào cùng
 * một nhóm, nếu không bảng báo cáo vỡ vụn thành hàng chục dòng cùng nghĩa.
 * Bỏ dấu, bỏ hoa thường, gộp khoảng trắng thừa.
 */
function chuanHoaLyDo_(moTa) {
  return lyDoHienThi_(moTa)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\s+/g, ' ')
    .trim().toLowerCase();
}

/** Tổng phút máy dừng vì HƯ HỎNG, lấy từ các phiếu sự cố. */
function tongDowntimeSuCo_(ds) {
  return ds.reduce(function (t, v) {
    const n = Number(phutDungMay_(v));
    return t + (isFinite(n) ? n : 0);
  }, 0);
}

/**
 * Tổng số phút máy nằm im của một tập phiếu dừng máy.
 * Phiếu chưa đóng thì tính tới `mocChot` — máy vẫn đang dừng thật, bỏ qua sẽ
 * báo thiếu đúng những ca dừng lâu nhất.
 *
 * `mocChot` mặc định là giờ hiện tại. Báo cáo của một ngày ca đã qua truyền vào
 * mocChotNgayCa_() để phiếu chưa ai đóng không cộng dồn xuyên sang ngày sau.
 */
function tongPhutDung_(ds, mocChot) {
  const bayGio = mocChot instanceof Date ? mocChot : nowVN_();
  return ds.reduce(function (tong, v) {
    const tu = v[COT.Thoi_Gian_Dung_May];
    if (!(tu instanceof Date)) return tong;
    const den = v[COT.Thoi_Gian_Hoan_Thanh] instanceof Date
      ? v[COT.Thoi_Gian_Hoan_Thanh] : bayGio;
    return tong + Math.max(0, Math.round((den.getTime() - tu.getTime()) / 60000));
  }, 0);
}

function sapTheoTong_(ds) {
  return ds.sort(function (a, b) {
    if (b.tong !== a.tong) return b.tong - a.tong;
    return String(a.khoa).localeCompare(String(b.khoa));
  });
}

function dinhDangTongHop_(sh, out) {
  sh.getRange(1, 1, 1, SO_COT_TONG_HOP).setFontSize(14).setFontWeight('bold');
  sh.setColumnWidth(1, 190);
  sh.setColumnWidth(2, 210);
  for (let c = 3; c <= SO_COT_TONG_HOP; c++) sh.setColumnWidth(c, 130);

  // Tô đậm các dòng tiêu đề mục và dòng header bảng.
  out.forEach(function (r, i) {
    const t = String(r[0]);
    if (t === t.toUpperCase() && t.trim() && !/^\d/.test(t)) {
      sh.getRange(i + 1, 1, 1, SO_COT_TONG_HOP).setFontWeight('bold').setBackground('#e8eaed');
    }
  });
}

// ============================================================================
// 2. archiveOldTickets — dọn phiếu cũ sang Luu_Tru
// ============================================================================

/**
 * Khoá tháng 'yyyy-MM' của mốc cắt: phiếu thuộc tháng NHỎ HƠN chuỗi này thì dọn.
 *
 * soThang tính CẢ tháng của `khi`, nên soThang = 1 cho ra đúng tháng hiện tại và
 * mọi tháng trước đó đều bị dọn. Cộng trừ trên tổng số tháng (năm×12 + tháng)
 * thay vì Date.setMonth để khỏi vướng chuyện ngày 31 tràn sang tháng sau.
 */
function mocThangLuuTru_(khi, soThang) {
  const n = Math.max(1, Math.round(Number(soThang) || 1));
  const y = Number(Utilities.formatDate(khi, CONFIG.MUI_GIO, 'yyyy'));
  const m = Number(Utilities.formatDate(khi, CONFIG.MUI_GIO, 'MM'));
  const tong = y * 12 + (m - 1) - (n - 1);
  return Math.floor(tong / 12) + '-' + pad2_((tong % 12) + 1);
}

/**
 * Tách danh sách phiếu thành nhóm giữ lại và nhóm dời sang Luu_Tru.
 *
 * Hàm THUẦN: nhận mảng dòng, trả kết quả, không đọc sheet nào — để Test.gs kiểm
 * được bằng dữ liệu giả thay vì phải dựng một Spreadsheet thật.
 *
 * Bốn nhóm ở lại, theo đúng thứ tự kiểm tra:
 *  1. Phiếu chưa HOÀN THÀNH — còn đang treo thì còn phải nhìn thấy, dù cũ mấy tháng.
 *  2. Phiếu không đọc được tháng — dời một dòng hỏng đi là giấu luôn cái hỏng đó.
 *  3. Phiếu thuộc tháng còn trong hạn giữ.
 *  4. Phiếu CHƯA TÍNH KPI lần nào (cột KPI_Ap_Dung trống). `tinhLaiKpiTho()` chỉ
 *     chạy trên Su_Co, nên dời trước khi tính là cột KPI của tháng đó trống vĩnh
 *     viễn — đúng cái đã vấp khi xuất báo cáo tháng 8/2026. KPI_Ap_Dung mới là
 *     dấu hiệu đúng chứ không phải Phut_KPI_Tho: phiếu CV-/BT-/DM- không vào KPI
 *     vẫn để trống số phút, nhưng KPI_Ap_Dung có ghi 'KHONG — <lý do>'.
 */
function chonPhieuLuuTru_(ds, mocThang) {
  const giuLai = [], luuTru = [];
  let giuViKpi = 0;

  ds.forEach(function (v) {
    if (v[COT.Trang_Thai] !== TRANG_THAI.HOAN_THANH) { giuLai.push(v); return; }

    const thang = thangCuaPhieu_(v);
    if (!thang || thang >= mocThang) { giuLai.push(v); return; }

    // CHỈ giữ lại phiếu ĐO ĐƯỢC đáp ứng (SC-, HT-). Phiếu CV-/BT-/DM- không bao
    // giờ vào KPI nên ô trống của chúng chẳng mất gì khi dọn đi — giữ cả nhóm đó
    // lại là chặn oan gần một phần tư số phiếu mỗi tháng.
    if (laDoDapUng_(v) && String(v[COT.KPI_Ap_Dung] || '').trim() === '') {
      giuLai.push(v);
      giuViKpi++;
      return;
    }

    luuTru.push(v);
  });

  return { giuLai: giuLai, luuTru: luuTru, giuViKpi: giuViKpi };
}

/**
 * Chuyển phiếu HOAN_THANH của các tháng đã quá hạn giữ sang sheet Luu_Tru, để
 * Su_Co chỉ còn việc của tháng đang chạy cộng phiếu chưa đóng.
 *
 * Cắt theo THÁNG LỊCH (xem mocThangLuuTru_), số tháng giữ lại đọc từ sheet
 * Cau_Hinh khoá SO_THANG_GIU_LAI. Không mất dữ liệu: báo cáo ngày, báo cáo
 * tháng, xuất Excel và tỉ lệ khả dụng đều đọc qua docSuCoVaLuuTru_().
 *
 * Cách làm: đọc hết → tách 2 nhóm → ghi nhóm lưu trữ vào Luu_Tru (1 setValues)
 * → ghi lại nhóm giữ vào Su_Co (1 setValues) rồi xoá phần thừa. Không dùng
 * deleteRow từng dòng: chậm và dễ lệch chỉ số khi đang xoá.
 *
 * Tên hàm KHÔNG có gạch dưới cuối vì phải đặt được làm handler cho trigger.
 */
function archiveOldTickets() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return 'Hệ thống đang bận, bỏ qua lần dọn này.';
    }

    // Sheet hẹp hơn 33 cột thì getRange văng "out of bounds" GIỮA CHỪNG — mà
    // giữa chừng ở đây là đã ghi xong Luu_Tru chưa kịp dọn Su_Co, tức nhân đôi
    // phiếu. Kiểm cả hai sheet trước khi động vào dòng nào, y như tinhLaiKpiTho.
    // Luu_Tru dễ hẹp hơn Su_Co: nó tạo ra từ lâu và chưa lần nào được ghi vào.
    const hep = [SHEET.SU_CO, SHEET.LUU_TRU].filter(function (ten) {
      const sh = ss_().getSheetByName(ten);
      return !sh || sh.getMaxColumns() < HEADER_SU_CO.length;
    });
    if (hep.length) {
      return 'Sheet ' + hep.join(' và ') + ' chưa có đủ ' + HEADER_SU_CO.length +
        ' cột. Chạy menu 🔧 Bảo trì → "1. Cài đặt hệ thống" một lần rồi dọn lại.';
    }

    const soThang = soThangGiuLai_();
    const mocThang = mocThangLuuTru_(nowVN_(), soThang);

    const tatCa = docToanBoSuCo_();
    const tach = chonPhieuLuuTru_(tatCa, mocThang);
    const giuLai = tach.giuLai, luuTru = tach.luuTru;

    const nhacKpi = tach.giuViKpi
      ? '\n\nGiữ lại ' + tach.giuViKpi + ' phiếu cũ vì chưa tính KPI lần nào. ' +
        'Chạy menu 🔧 Bảo trì → "🎯 Tính lại KPI đáp ứng của thợ" rồi dọn lại, ' +
        'kẻo dọn đi trước là cột KPI của tháng đó trống vĩnh viễn.'
      : '';

    if (!luuTru.length) {
      return 'Không có phiếu nào trước tháng ' + mocThang + ' để dọn (đang giữ ' +
        soThang + ' tháng).' + nhacKpi;
    }

    const shLuu = sheet_(SHEET.LUU_TRU);
    shLuu.getRange(shLuu.getLastRow() + 1, 1, luuTru.length, HEADER_SU_CO.length)
      .setValues(luuTru);

    const shSuCo = sheet_(SHEET.SU_CO);
    const soCu = tatCa.length;
    if (giuLai.length) {
      shSuCo.getRange(2, 1, giuLai.length, HEADER_SU_CO.length).setValues(giuLai);
    }
    // Xoá phần dư ở đuôi (chỉ nội dung, giữ nguyên định dạng cột đã set).
    if (soCu > giuLai.length) {
      shSuCo.getRange(giuLai.length + 2, 1, soCu - giuLai.length, HEADER_SU_CO.length)
        .clearContent();
    }

    ghiNhatKy_('', '', 'HE_THONG', 'LUU_TRU',
      { soPhieu: luuTru.length, truocThang: mocThang, soThangGiuLai: soThang,
        giuViKpi: tach.giuViKpi }, '');

    return 'Đã chuyển ' + luuTru.length + ' phiếu trước tháng ' + mocThang +
      ' sang Luu_Tru (còn lại ' + giuLai.length + ' phiếu trong Su_Co).' + nhacKpi;
  } finally {
    lock.releaseLock();
  }
}

/**
 * Việc của ngày 1 hằng tháng: TÍNH KPI TRƯỚC, DỌN SAU.
 *
 * Thứ tự này là bắt buộc, không phải cho gọn. `tinhLaiKpiTho()` chỉ tính trên
 * Su_Co; dọn trước rồi tính sau thì những phiếu vừa bị dời không còn đường nào
 * được tính, và báo cáo tháng ấy in ra cột KPI toàn dấu gạch ngang — đã xảy ra
 * thật khi xuất báo cáo tháng 8/2026.
 *
 * Hai hàm dưới đây mỗi hàm tự giành rồi tự nhả LockService, chạy nối tiếp chứ
 * không lồng nhau.
 */
function donPhieuCuHangThang() {
  const kpi = tinhLaiKpiTho();
  const don = archiveOldTickets();
  return kpi + '\n\n— — —\n\n' + don;
}

// ============================================================================
// 3. Trigger tự chạy
// ============================================================================

/**
 * Cài đặt trigger. Phải chạy TAY một lần trong Apps Script editor — clasp push
 * không tự tạo trigger được.
 *
 * Chạy lại nhiều lần an toàn: xoá trigger cũ của đúng các handler này rồi tạo mới,
 * không bao giờ nhân đôi.
 */
function caiDatTrigger() {
  // archiveOldTickets nằm lại trong danh sách dù không còn được cài mới: các
  // trigger đã cài từ trước mang đúng tên đó, phải xoá được thì lần cài lại mới
  // không để sót một trigger dọn KHÔNG tính KPI trước.
  const cuaTa = { refreshReportsThangNay: true, archiveOldTickets: true,
    donPhieuCuHangThang: true, nhacPhieuChoNhan: true };

  let daXoa = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (cuaTa[t.getHandlerFunction()]) { ScriptApp.deleteTrigger(t); daXoa++; }
  });

  // Báo cáo: 2 lần/ngày — trưa và cuối ngày.
  ScriptApp.newTrigger('refreshReportsThangNay').timeBased().atHour(12).everyDays(1).create();
  ScriptApp.newTrigger('refreshReportsThangNay').timeBased().atHour(23).everyDays(1).create();

  // Dọn dữ liệu: ngày 1 hằng tháng, lúc rạng sáng cho khỏi vướng giờ làm việc.
  // Gọi donPhieuCuHangThang chứ không gọi thẳng archiveOldTickets — phải tính
  // KPI trước khi dời phiếu đi, xem chú thích của hàm đó.
  ScriptApp.newTrigger('donPhieuCuHangThang').timeBased().onMonthDay(1).atHour(2).create();

  // Nhắc phiếu chưa ai nhận: 5 phút một lượt. Chạy bằng mã HEAD nên KHÔNG cần
  // deploy. Công tắc Cau_Hinh.TELEGRAM_BAT tắt thì mỗi lượt chỉ đọc một ô cấu
  // hình rồi thoát, nên cài sẵn trigger từ trước lúc bật cũng vô hại.
  ScriptApp.newTrigger('nhacPhieuChoNhan').timeBased().everyMinutes(5).create();

  return 'Đã cài 4 trigger (xoá ' + daXoa + ' trigger cũ):\n' +
    '• Cập nhật Tong_Hop lúc ~12h và ~23h mỗi ngày\n' +
    '• Tính lại KPI rồi dọn phiếu tháng cũ sang Luu_Tru, ngày 1 hằng tháng lúc ~2h sáng\n' +
    '• Nhắc phiếu chưa ai nhận, 5 phút một lượt (chỉ chạy khi TELEGRAM_BAT = BAT)';
}

/** Liệt kê trigger đang cài — để kiểm tra lại sau này. */
function xemTrigger() {
  const ds = ScriptApp.getProjectTriggers().map(function (t) {
    return '• ' + t.getHandlerFunction() + ' (' + t.getEventType() + ')';
  });
  return ds.length ? ds.join('\n') : 'Chưa có trigger nào.';
}
