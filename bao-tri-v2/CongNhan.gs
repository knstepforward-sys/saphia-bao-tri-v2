/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * BƯỚC 2: Routing web app + luồng CÔNG NHÂN (quét QR → báo sự cố → gọi thợ).
 *
 * Phụ thuộc các hàm nền trong Code.gs (CONFIG, SHEET, COT, xacDinhCa_, ...).
 */

// ============================================================================
// 1. ROUTING
// ============================================================================

/**
 * Entry point web app.
 *   ?may=MA_MAY                    → trang công nhân báo sự cố
 *   ?tho=MA_THO&token=...          → trang thợ
 *   ?page=qr|ngay&key=...          → in QR / báo cáo trong ngày
 *   ?page=kehoach&to=...&token=... → trang tổ trưởng khai kế hoạch máy (KeHoachTo.gs)
 *   không tham số                  → trang hướng dẫn
 */
function doGet(e) {
  const p = (e && e.parameter) || {};

  if (p.may) {
    return renderTrang_('Index', 'Báo sự cố — Bảo trì nhà máy', { maMay: String(p.may).trim() });
  }

  const trang = String(p.page || '').trim().toLowerCase();
  if (trang === 'qr') return renderTrangQr_(p);
  if (trang === 'ngay') return renderTrangNgay_(p);
  if (trang === 'kehoach') return renderTrangKeHoach_(p);

  if (p.tho) {
    return renderTrang_('Tho', 'Công việc của tôi — Bảo trì nhà máy', {
      maTho: String(p.tho).trim(),
      token: String(p.token || '').trim(),
    });
  }

  return trangThongBao_('Hệ thống bảo trì nhà máy',
    'Vui lòng quét mã QR dán trên máy để báo sự cố.');
}

function renderTrang_(tenFile, tieuDe, duLieu) {
  const t = HtmlService.createTemplateFromFile(tenFile);
  Object.keys(duLieu || {}).forEach(function (k) { t[k] = duLieu[k]; });
  return t.evaluate()
    .setTitle(tieuDe)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Cho phép file HTML nhúng file khác (dùng cho Style.html). */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function trangThongBao_(tieuDe, noiDung) {
  const html =
    '<div style="font-family:system-ui,-apple-system,sans-serif;padding:32px 20px;' +
    'text-align:center;color:#202124">' +
    '<div style="font-size:44px;margin-bottom:12px">🔧</div>' +
    '<h2 style="margin:0 0 8px;font-size:20px">' + escapeHtml_(tieuDe) + '</h2>' +
    '<p style="margin:0;color:#5f6368;font-size:15px;line-height:1.5">' +
    escapeHtml_(noiDung) + '</p></div>';
  return HtmlService.createHtmlOutput(html)
    .setTitle(tieuDe)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function escapeHtml_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================================
// 2. ĐỌC SỰ CỐ GẦN ĐÂY
// ============================================================================

/**
 * Số dòng cuối của Su_Co được quét khi tìm phiếu đang mở / kiểm trùng requestId.
 * Giới hạn để tốc độ submit không phụ thuộc vào độ dài lịch sử. Phiếu đang mở và
 * request vừa gửi luôn nằm ở cuối sheet nên không sót.
 */
const SO_DONG_QUET_GAN_DAY = 500;

/** Đọc N dòng cuối của Su_Co. Trả mảng { dong: <số dòng thật>, v: <mảng giá trị> }. */
function docSuCoGanDay_(soDong) {
  const sh = sheet_(SHEET.SU_CO);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];

  const n = Math.min(soDong || SO_DONG_QUET_GAN_DAY, lastRow - 1);
  const dongDau = lastRow - n + 1;
  const values = sh.getRange(dongDau, 1, n, HEADER_SU_CO.length).getValues();

  return values.map(function (v, i) { return { dong: dongDau + i, v: v }; })
    .filter(function (r) { return r.v[COT.Ma_Su_Co] !== '' && r.v[COT.Ma_Su_Co] !== null; });
}

/** Phiếu chưa đóng (CHO_NHAN hoặc DANG_XU_LY) của một máy — mới nhất trước. */
function timPhieuDangMo_(maMay, dsGanDay, chiLoai) {
  const ds = dsGanDay || docSuCoGanDay_();
  const ma = String(maMay).trim();
  for (let i = ds.length - 1; i >= 0; i--) {
    const v = ds[i].v;
    if (String(v[COT.Ma_May]).trim() !== ma) continue;
    if (v[COT.Trang_Thai] === TRANG_THAI.HOAN_THANH) continue;
    if (chiLoai && loaiPhieu_(v) !== chiLoai) continue;

    return {
      maSuCo: v[COT.Ma_Su_Co],
      trangThai: v[COT.Trang_Thai],
      loaiPhieu: loaiPhieu_(v),
      laDungMay: laDungMay_(v),
      nhomLoi: v[COT.Nhom_Loi],
      moTa: v[COT.Mo_Ta],
      tenTho: v[COT.Ten_Tho],
      thoiGianBao: dinhDangThoiGian_(v[COT.Thoi_Gian_Bao]),
      dong: ds[i].dong,
    };
  }
  return null;
}

function dinhDangThoiGian_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.MUI_GIO, 'HH:mm dd/MM');
  return v ? String(v) : '';
}

// ============================================================================
// 3. DANH BẠ THỢ ĐANG TRỰC
// ============================================================================

/** Mức cảnh báo trả về cho client, quyết định banner hiển thị. */
const MUC_CANH_BAO = {
  BINH_THUONG: 'BINH_THUONG',           // có thợ đúng chuyên môn đang trực
  NGOAI_CHUYEN_MON: 'NGOAI_CHUYEN_MON', // không có thợ đúng chuyên môn → hiện thợ đang trực khác
  THIEU_LICH: 'THIEU_LICH',             // cả tháng chưa có lịch trực
  KHONG_CO_THO: 'KHONG_CO_THO',         // không ai trực ca này
};

/**
 * Danh sách thợ để công nhân gọi, lọc theo lịch trực + bộ phận + chuyên môn.
 *
 * Thang fallback 3 nấc (đã chốt với người dùng theo đúng cách vận hành thực tế):
 *   Nấc 1 — thợ ĐANG TRỰC + đúng bộ phận + đúng chuyên môn.
 *   Nấc 2 — nếu nấc 1 rỗng: thợ ĐANG TRỰC + đúng bộ phận, BỎ lọc chuyên môn.
 *           Đây là tình huống "hư cơ khí lúc 22h, tổ cơ khí không làm đêm" →
 *           gọi thợ điện đang trực kiểm tra trước; hư nặng thì dừng máy chờ ca sáng.
 *   Nấc 3 — vẫn rỗng: không hiện số nào, báo phiếu sẽ được xử lý đầu ca sáng.
 *
 * Ngoại lệ tách riêng: CẢ THÁNG chưa có dòng lịch nào (quên tạo lịch tháng mới)
 * → hiện tất cả thợ phù hợp kèm banner cảnh báo. Đây là lỗi thiếu dữ liệu cấu
 * hình, KHÔNG phải nới lỏng bộ lọc: có lịch mà người đó không đăng ký thì vẫn ẩn.
 *
 * @param {string} boPhan  bộ phận của máy
 * @param {string} nhomLoi DIEN | CO_KHI | KHONG_RO
 * @param {Date}   khi     thời điểm xét (mặc định: bây giờ)
 * @param {Object} duLieu  (tuỳ chọn) tiêm dữ liệu thay vì đọc sheet:
 *                         { dsTho, cauHinhCa, lichTheoThang } — dùng cho Test.gs
 *                         để kiểm logic mà không đụng vào dữ liệu thật.
 */
function getOnDutyContacts_(boPhan, nhomLoi, khi, duLieu) {
  const luc = khi || nowVN_();
  // Tiêm theo TỪNG trường: bên gọi đã đọc sẵn cái nào thì truyền cái đó vào, phần
  // còn lại tự đọc. Mỗi lượt getValues tốn ~100–250 ms bất kể ít hay nhiều dòng,
  // nên bỏ được một lượt đọc trùng là bớt được ngần ấy thời gian chờ của công nhân.
  const tiem = duLieu || {};

  const cauHinhCa = tiem.cauHinhCa || docCauHinhCa_();
  const cauHinh = tiem.cauHinh || docCauHinh_();
  const dsTho = (tiem.dsTho || docSheet_(SHEET.THO, HEADER_THO))
    .filter(function (t) {
      return String(t.Ma_Tho).trim() && laTrue_(t.Hoat_Dong);
    });

  // Lọc bộ phận trước — áp dụng cho mọi nấc.
  const hopBoPhan = dsTho.filter(function (t) { return phuTrachBoPhan_(t.Bo_Phan_Phu_Trach, boPhan); });

  // Xác định ca hiện tại của từng thợ theo Nhom_Ca của họ (KHÔNG theo bộ phận máy:
  // thợ tổ điện trực 06:30–17:30 dù máy hỏng thuộc bộ phận Dệt 07:00–18:00).
  const kemCa = hopBoPhan.map(function (t) {
    return { tho: t, ca: xacDinhCa_(t.Nhom_Ca, luc, cauHinhCa) };
  });

  // --- Ngoại lệ: cả tháng chưa có lịch ---------------------------------------
  const cacThang = {};
  kemCa.forEach(function (x) {
    if (x.ca.ca) cacThang[thangCuaNgay_(x.ca.ngayCa)] = true;
  });
  const dsThang = Object.keys(cacThang);
  const lichTheoThang = {};
  let coLich = false;
  dsThang.forEach(function (th) {
    lichTheoThang[th] = tiem.lichTheoThang
      ? (tiem.lichTheoThang[th] || null) : docLichTruc_(th);
    if (lichTheoThang[th]) coLich = true;
  });

  if (dsThang.length && !coLich) {
    const ds = hopBoPhan.filter(function (t) { return hopChuyenMon_(t.Chuyen_Mon, nhomLoi); });
    return ketQuaDanhBa_(
      (ds.length ? ds : hopBoPhan).map(function (t) { return gonTho_(t, null); }),
      MUC_CANH_BAO.THIEU_LICH,
      'Chưa có lịch trực tháng này. Đang hiện toàn bộ thợ phù hợp — vui lòng cập nhật lịch trực.',
      cauHinh
    );
  }

  // --- Ai đang trực ----------------------------------------------------------
  const dangTruc = kemCa.filter(function (x) {
    if (!x.ca.ca) return false; // tổ này không làm ca hiện tại
    const lich = lichTheoThang[thangCuaNgay_(x.ca.ngayCa)];
    return coTrucKhong_(lich, x.tho.Ma_Tho, x.ca.ngayCa, x.ca.ca);
  });

  // --- Nấc 1 ----------------------------------------------------------------
  const nac1 = dangTruc.filter(function (x) { return hopChuyenMon_(x.tho.Chuyen_Mon, nhomLoi); });
  if (nac1.length) {
    return ketQuaDanhBa_(
      nac1.map(function (x) { return gonTho_(x.tho, x.ca.ca); }),
      MUC_CANH_BAO.BINH_THUONG, '', cauHinh
    );
  }

  // --- Nấc 2 ----------------------------------------------------------------
  if (dangTruc.length) {
    return ketQuaDanhBa_(
      dangTruc.map(function (x) { return gonTho_(x.tho, x.ca.ca); }),
      MUC_CANH_BAO.NGOAI_CHUYEN_MON,
      'Không có thợ ' + tenNhomLoi_(nhomLoi) + ' trực ca này. Nhờ thợ đang trực kiểm tra trước — ' +
      'nếu hư nặng thì dừng máy, chờ xử lý đầu ca sáng.',
      cauHinh
    );
  }

  // --- Nấc 3 ----------------------------------------------------------------
  return ketQuaDanhBa_([], MUC_CANH_BAO.KHONG_CO_THO,
    'Không có thợ trực ca này. Phiếu đã được ghi nhận và sẽ được xử lý vào đầu ca sáng.',
    cauHinh);
}

/**
 * Đóng gói kết quả danh bạ, và gắn thêm SỐ KHẨN CẤP vào cuối danh sách nếu có
 * khai trong sheet Cau_Hinh.
 *
 * Số này cố ý nằm NGOÀI mọi bộ lọc lịch trực/chuyên môn — nó là lưới an toàn cho
 * hai lỗ hổng đã biết: ngày chưa ai đăng ký trực, và người trực không bắt máy.
 * Nó không làm loãng bộ lọc vì luôn xếp cuối và có nhãn riêng.
 */
function ketQuaDanhBa_(ds, mucCanhBao, thongDiep, cauHinh) {
  const ch = cauHinh || {};
  const sdt = chuanHoaSdt_(ch.SDT_KHAN_CAP);
  const kq = { ds: ds, mucCanhBao: mucCanhBao, thongDiep: thongDiep };

  if (!sdt) return kq;

  kq.ds = ds.concat([{
    maTho: '',
    tenTho: String(ch.TEN_KHAN_CAP || '').trim() || 'Số khẩn cấp',
    chuyenMon: '',
    soDienThoai: sdt,
    ca: '',
    khanCap: true,
  }]);

  if (mucCanhBao === MUC_CANH_BAO.KHONG_CO_THO) {
    kq.thongDiep = 'Không có thợ trực ca này. Phiếu đã được ghi nhận — ' +
      'nếu máy dừng gấp, gọi số khẩn cấp bên dưới.';
  }
  return kq;
}

function gonTho_(t, ca) {
  return {
    maTho: String(t.Ma_Tho).trim(),
    tenTho: String(t.Ten_Tho).trim(),
    chuyenMon: String(t.Chuyen_Mon).trim(),
    soDienThoai: chuanHoaSdt_(t.So_Dien_Thoai),
    ca: ca || '',
  };
}

/** 'yyyy-MM-dd' → 'MM/yyyy'. */
function thangCuaNgay_(ngay) {
  return ngay.slice(5, 7) + '/' + ngay.slice(0, 4);
}

/**
 * Ô SĐT có thể bị Sheets đọc thành số nếu người dùng dán đè định dạng,
 * làm mất số 0 đầu → bù lại khi đọc ra.
 */
function chuanHoaSdt_(v) {
  if (v === null || v === undefined || v === '') return '';
  let s = String(v).trim().replace(/[\s.\-()]/g, '');
  if (/^\d{9}$/.test(s)) s = '0' + s;
  return s;
}

/** Bo_Phan_Phu_Trach: trống hoặc TAT_CA = mọi bộ phận; nhiều bộ phận cách bằng dấu phẩy. */
function phuTrachBoPhan_(phuTrach, boPhanMay) {
  const s = String(phuTrach || '').trim().toUpperCase();
  if (!s || s === 'TAT_CA') return true;
  const may = String(boPhanMay || '').trim().toUpperCase();
  if (!may) return true;
  return s.split(/[,;]/).map(function (x) { return x.trim(); }).indexOf(may) !== -1;
}

/** KHONG_RO khớp mọi thợ; thợ CA_HAI khớp mọi nhóm lỗi. */
function hopChuyenMon_(chuyenMon, nhomLoi) {
  const cm = String(chuyenMon || '').trim().toUpperCase();
  const nl = String(nhomLoi || '').trim().toUpperCase();
  if (!nl || nl === 'KHONG_RO') return true;
  if (cm === 'CA_HAI' || !cm) return true;
  return cm === nl;
}

function tenNhomLoi_(nhomLoi) {
  return { DIEN: 'điện', CO_KHI: 'cơ khí' }[String(nhomLoi).toUpperCase()] || 'phù hợp';
}

// ============================================================================
// 4. RPC — TRANG CÔNG NHÂN
// ============================================================================

/** Dữ liệu khởi tạo trang công nhân: thông tin máy + phiếu đang mở (nếu có). */
function getWorkerBootstrap(maMay) {
  try {
    const ma = String(maMay || '').trim();
    if (!ma) return { ok: false, error: 'Thiếu mã máy trong đường dẫn.' };

    const may = timMay_(ma);
    if (!may) {
      return { ok: false, error: 'Không tìm thấy máy có mã "' + ma + '" trong danh mục.' };
    }
    if (!laTrue_(may.Hoat_Dong)) {
      return { ok: false, error: 'Máy "' + ma + '" hiện không còn được theo dõi.' };
    }

    const boPhan = String(may.Bo_Phan).trim();

    // Một máy có thể cùng lúc mang phiếu `DM-` (máy nằm im) và `HT-` (thợ đang
    // tới chỉnh sửa) — đó là ca đổi mặt hàng bình thường, không phải lỗi. Nên
    // phải tách ra tìm theo TỪNG loại: lấy chung "phiếu chưa đóng mới nhất" thì
    // vừa bấm gọi kỹ thuật xong là màn hình "Máy này đang dừng" biến mất và nút
    // "Máy đã chạy lại" đi theo, công nhân không còn đường đóng phiếu dừng.
    // Đọc sheet đúng MỘT lượt rồi lọc ba lần, không đọc lại ba lượt.
    const dsGanDay = docSuCoGanDay_();
    const phieuDungMay = timPhieuDangMo_(ma, dsGanDay, LOAI_PHIEU.DUNG_MAY);
    const phieuSuCo = timPhieuDangMo_(ma, dsGanDay, LOAI_PHIEU.SU_CO);
    const phieuHoTro = timPhieuDangMo_(ma, dsGanDay, LOAI_PHIEU.HO_TRO);

    // Phiếu đang chờ/đang được thợ xử lý — `SC-` trước, vì máy hỏng thật gấp hơn.
    const phieuChoTho = phieuSuCo || phieuHoTro;
    // Phiếu dừng máy chiếm màn hình trước: việc duy nhất chỉ công nhân làm được
    // là bấm "Máy đã chạy lại", còn phiếu của thợ thì thợ tự đóng.
    const phieuDangMo = phieuDungMay || phieuChoTho;

    // Máy đang có phiếu chờ thợ → trả kèm danh bạ luôn. Người quét lại QR thường
    // là người vừa gọi mà không ai bắt máy, việc họ cần ngay là số của người
    // tiếp theo chứ không phải cái form báo mới.
    // Chỉ tốn thêm một lượt dựng danh bạ đúng trong trường hợp này.
    const danhBa = phieuChoTho
      ? getOnDutyContacts_(boPhan, phieuChoTho.nhomLoi)
      : null;

    return {
      ok: true,
      may: {
        maMay: String(may.Ma_May).trim(),
        tenMay: String(may.Ten_May).trim(),
        boPhan: boPhan,
      },
      phieuDangMo: phieuDangMo,
      phieuDungMay: phieuDungMay,
      phieuHoTro: phieuHoTro,
      danhBa: danhBa,
      lyDoDungMay: dsLyDoDungMay_(),
      gioHienTai: fmtGio_(nowVN_()),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================================
// 5. RPC — DỪNG MÁY KHÔNG DO HƯ HỎNG
// ============================================================================

/**
 * Công nhân báo máy dừng vì lý do KHÔNG phải hư hỏng: thiếu chỉ, hết nguyên
 * liệu, chờ kế hoạch… Không chọn nhóm lỗi, không gọi thợ, không ai phải sửa.
 * Đồng hồ đếm thời gian dừng bắt đầu chạy từ đây.
 *
 * payload = { machineCode, lyDo, moTa, requestId }
 */
function reportMachineStop(payload) {
  const p = payload || {};

  const maMay = String(p.machineCode || '').trim();
  const may = timMay_(maMay);
  if (!may) return { ok: false, error: 'Không tìm thấy máy "' + maMay + '".' };

  const lyDo = String(p.lyDo || '').trim();
  if (!lyDo) return { ok: false, error: 'Vui lòng chọn lý do dừng máy.' };

  const requestId = String(p.requestId || '').trim();
  if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

  const lock = LockService.getScriptLock();
  let daMoKhoa = false;
  function moKhoa_() { if (!daMoKhoa) { lock.releaseLock(); daMoKhoa = true; } }

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' };
    }

    const dsGanDay = docSuCoGanDay_();

    for (let i = dsGanDay.length - 1; i >= 0; i--) {
      if (String(dsGanDay[i].v[COT.Request_ID_Cuoi]).trim() === requestId) {
        return { ok: true, trung: true, maSuCo: dsGanDay[i].v[COT.Ma_Su_Co] };
      }
    }

    // Máy đang có phiếu dừng chưa đóng thì không mở thêm phiếu thứ hai — nếu
    // không, mỗi lần ai đó quét QR lại là sinh một khoảng dừng chồng lên nhau.
    const dangDung = timPhieuDangMo_(maMay, dsGanDay, LOAI_PHIEU.DUNG_MAY);
    if (dangDung) {
      return {
        ok: false,
        dangDung: dangDung,
        error: 'Máy này đã được báo dừng lúc ' + dangDung.thoiGianBao +
          '. Khi máy chạy lại, quét QR rồi bấm "Máy đã chạy lại".',
      };
    }

    const luc = nowVN_();
    const boPhan = String(may.Bo_Phan).trim();
    const caMay = xacDinhCa_(boPhan, luc);
    const ma = sinhMaPhieu_(luc, 'DM');

    const dong = new Array(HEADER_SU_CO.length).fill('');
    dong[COT.Ma_Su_Co] = ma;
    dong[COT.Ma_May] = String(may.Ma_May).trim();
    dong[COT.Ten_May] = String(may.Ten_May).trim();
    dong[COT.Bo_Phan] = boPhan;
    dong[COT.Trang_Thai_May] = 'DA_DUNG';
    dong[COT.Nhom_Loi] = '';            // không áp dụng
    dong[COT.Mo_Ta] = (lyDo + (p.moTa ? ' — ' + String(p.moTa).trim() : ''))
      .slice(0, CONFIG.MAX_MO_TA);
    dong[COT.Trang_Thai] = TRANG_THAI.DANG_XU_LY;  // = máy đang dừng
    dong[COT.Thoi_Gian_Bao] = luc;
    dong[COT.Thoi_Gian_Dung_May] = luc;            // đồng hồ downtime bắt đầu
    dong[COT.Ngay_Ca] = caMay.ngayCa;
    dong[COT.Ca] = caMay.ca || 'NGOAI_GIO';
    dong[COT.Cap_Nhat_Luc] = luc;
    dong[COT.Request_ID_Cuoi] = requestId;
    dong[COT.Phien_Ban] = 1;
    dong[COT.Loai_Phieu] = LOAI_PHIEU.DUNG_MAY;

    const sh = sheet_(SHEET.SU_CO);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEADER_SU_CO.length).setValues([dong]);

    ghiNhatKy_(ma, maMay, 'CONG_NHAN', 'BAO_DUNG_MAY', { lyDo: lyDo }, requestId);
    moKhoa_();

    return { ok: true, maSuCo: ma, lyDo: lyDo, gioDung: fmtGio_(luc) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    moKhoa_();
  }
}

/**
 * Công nhân quét lại QR của máy đó và báo máy đã chạy lại → đóng phiếu dừng,
 * chốt thời gian dừng.
 *
 * payload = { machineCode, requestId }
 */
function reportMachineRestart(payload) {
  const p = payload || {};

  const maMay = String(p.machineCode || '').trim();
  if (!maMay) return { ok: false, error: 'Thiếu mã máy.' };
  const requestId = String(p.requestId || '').trim();
  if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

  const lock = LockService.getScriptLock();
  let daMoKhoa = false;
  function moKhoa_() { if (!daMoKhoa) { lock.releaseLock(); daMoKhoa = true; } }

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' };
    }

    const dsGanDay = docSuCoGanDay_();

    for (let i = dsGanDay.length - 1; i >= 0; i--) {
      if (String(dsGanDay[i].v[COT.Request_ID_Cuoi]).trim() === requestId) {
        return { ok: true, trung: true, maSuCo: dsGanDay[i].v[COT.Ma_Su_Co] };
      }
    }

    const dangDung = timPhieuDangMo_(maMay, dsGanDay, LOAI_PHIEU.DUNG_MAY);
    if (!dangDung) {
      return { ok: false, error: 'Máy này hiện không có phiếu dừng nào đang mở.' };
    }

    const r = timDongSuCo_(dangDung.maSuCo, dsGanDay);
    if (!r) return { ok: false, error: 'Không tìm thấy phiếu ' + dangDung.maSuCo + '.' };
    const v = r.v;

    const luc = nowVN_();
    v[COT.Trang_Thai] = TRANG_THAI.HOAN_THANH;   // = máy đã chạy lại
    v[COT.Thoi_Gian_Hoan_Thanh] = luc;
    v[COT.Cap_Nhat_Luc] = luc;
    v[COT.Request_ID_Cuoi] = requestId;
    v[COT.Phien_Ban] = (Number(v[COT.Phien_Ban]) || 0) + 1;
    // Giữ nguyên Trang_Thai_May = DA_DUNG: đó là tình trạng trong suốt khoảng
    // dừng, và phutDungMay_ dựa vào nó để tính. Trang_Thai mới là thứ cho biết
    // máy đã chạy lại hay chưa.

    ghiCaDong_(r.dong, v);

    const phut = soPhut_(v[COT.Thoi_Gian_Dung_May], luc);
    ghiNhatKy_(v[COT.Ma_Su_Co], maMay, 'CONG_NHAN', 'BAO_CHAY_LAI',
      { phutDung: phut }, requestId);

    // Phiếu `HT-` đã gọi thợ mà thợ chưa bấm hoàn thành thì CỐ Ý không đóng
    // theo. Máy chạy lại được và thợ làm xong là hai việc khác nhau: thợ có thể
    // còn đang thu dọn, hoặc chỉnh xong mới là lúc máy chạy. Đóng hộ là ghi sai
    // giờ hoàn thành của người khác. Chỉ trả về để màn hình nhắc một dòng.
    const hoTroConMo = timPhieuDangMo_(maMay, dsGanDay, LOAI_PHIEU.HO_TRO);
    moKhoa_();

    return {
      ok: true,
      maSuCo: v[COT.Ma_Su_Co],
      phutDung: phut,
      lyDo: v[COT.Mo_Ta],
      hoTroConMo: hoTroConMo,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    moKhoa_();
  }
}

// ============================================================================
// 5b. RPC — GỌI KỸ THUẬT TRONG LÚC MÁY ĐANG DỪNG
// ============================================================================

/**
 * Công nhân bấm gọi thợ ngay trên màn hình "Máy này đang dừng" → sinh phiếu
 * `HT-` đi đúng luồng thợ: Telegram cho người trực, vào vòng nhắc 5 phút, thợ
 * bấm nhận rồi bấm hoàn thành.
 *
 * Ca thật của xưởng, và là lý do có hàm này: ĐỔI MẶT HÀNG. Bước 1 công nhân tự
 * thay chỉ sợi lên dàn, bước 2 tự dẫn hướng chỉ vào máy, bước 3 phải có thợ cơ
 * khí tới chỉnh. Trước đây bước 3 không có đường nào trên app — màn hình máy
 * đang dừng chỉ có đúng một nút "Máy đã chạy lại" — nên công nhân phải đi bộ
 * tìm thợ, và khoảng chờ đó không để lại vết gì trong số liệu.
 *
 * CHỈ mở được khi máy đang có phiếu `DM-` chưa đóng. Hai lý do:
 *   - Máy không dừng mà cần thợ thì đó là phiếu `SC-` hoặc là việc ngoài app;
 *     mở `HT-` ở đó là mở một cửa thứ hai để né phiếu sự cố, và số lần hỏng của
 *     máy sẽ tụt xuống một cách vô hình.
 *   - Phiếu `HT-` cố ý KHÔNG đo thời gian máy nằm im. Nó chỉ đúng khi có phiếu
 *     `DM-` chạy song song gánh phần đo đó.
 *
 * KHÔNG áp bộ đếm chống spam của `reportIncident`. Bộ đếm đó đếm mọi phiếu của
 * cùng một máy, mà luồng này bình thường đã sinh sẵn một phiếu `DM-` ngay trước
 * đó; áp vào là ca đổi mặt hàng thứ hai trong cùng ngưỡng phút bị chặn oan.
 * Chỗ chặn của loại phiếu này là luật "mỗi máy chỉ một phiếu `HT-` đang mở"
 * bên dưới, chặt hơn hẳn bộ đếm.
 *
 * payload = { machineCode, nhomLoi, moTa, requestId }
 */
function requestTechnician(payload) {
  const p = payload || {};

  const maMay = String(p.machineCode || '').trim();
  const may = timMay_(maMay);
  if (!may) return { ok: false, error: 'Không tìm thấy máy "' + maMay + '".' };

  // Mặc định cơ khí: đó là nhu cầu đang có (chỉnh máy sau khi đổi mặt hàng).
  // Vẫn nhận DIEN để dùng được cho ca cần thợ điện mà không phải sửa mã.
  const nhomLoi = String(p.nhomLoi || 'CO_KHI').trim().toUpperCase();
  if (NHOM_LOI.indexOf(nhomLoi) === -1) {
    return { ok: false, error: 'Nhóm thợ không hợp lệ.' };
  }

  const moTa = String(p.moTa || '').trim().slice(0, CONFIG.MAX_MO_TA);
  const requestId = String(p.requestId || '').trim();
  if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

  const boPhan = String(may.Bo_Phan).trim();
  const cauHinh = docCauHinh_();

  const lock = LockService.getScriptLock();
  let daMoKhoa = false;
  function moKhoa_() { if (!daMoKhoa) { lock.releaseLock(); daMoKhoa = true; } }

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' };
    }

    const dsGanDay = docSuCoGanDay_();

    // Chống double-tap: mạng yếu trong xưởng, nút bấm hai lần là chuyện thường.
    for (let i = dsGanDay.length - 1; i >= 0; i--) {
      if (String(dsGanDay[i].v[COT.Request_ID_Cuoi]).trim() === requestId) {
        const maCu = dsGanDay[i].v[COT.Ma_Su_Co];
        moKhoa_(); // dựng danh bạ là việc chỉ đọc, không được giữ khoá để làm
        return { ok: true, trung: true, maSuCo: maCu,
          danhBa: getOnDutyContacts_(boPhan, nhomLoi, null, { cauHinh: cauHinh }) };
      }
    }

    const dangDung = timPhieuDangMo_(maMay, dsGanDay, LOAI_PHIEU.DUNG_MAY);
    if (!dangDung) {
      return {
        ok: false,
        error: 'Máy này chưa được báo dừng. Nếu máy hư, hãy quay lại và bấm ' +
          '"Máy hư hỏng" để báo sự cố.',
      };
    }

    // Đã gọi rồi thì trả lại phiếu cũ kèm danh bạ, không mở phiếu thứ hai: hai
    // phiếu cùng nội dung là hai thợ cùng chạy tới một máy, và là hai lần đo
    // đáp ứng cho cùng một lần chờ.
    const daGoi = timPhieuDangMo_(maMay, dsGanDay, LOAI_PHIEU.HO_TRO);
    if (daGoi) {
      moKhoa_();
      return {
        ok: true,
        daGoiTruocDo: true,
        maSuCo: daGoi.maSuCo,
        phieuHoTro: daGoi,
        danhBa: getOnDutyContacts_(boPhan, daGoi.nhomLoi, null, { cauHinh: cauHinh }),
      };
    }

    const luc = nowVN_();
    const caMay = xacDinhCa_(boPhan, luc); // ca của phiếu tính theo bộ phận MÁY
    const maSuCo = sinhMaPhieu_(luc, 'HT');

    const dong = new Array(HEADER_SU_CO.length).fill('');
    dong[COT.Ma_Su_Co] = maSuCo;
    dong[COT.Ma_May] = String(may.Ma_May).trim();
    dong[COT.Ten_May] = String(may.Ten_May).trim();
    dong[COT.Bo_Phan] = boPhan;
    // Máy đang dừng thật — phiếu `DM-` bên trên là bằng chứng. Ghi đúng hiện
    // trạng để thợ đọc phiếu biết máy đang nằm im, không phải chạy mà cần chỉnh.
    dong[COT.Trang_Thai_May] = 'DA_DUNG';
    dong[COT.Nhom_Loi] = nhomLoi;
    dong[COT.Mo_Ta] = ghepMoTaHoTro_(dangDung, moTa);
    dong[COT.Trang_Thai] = TRANG_THAI.CHO_NHAN;
    dong[COT.Thoi_Gian_Bao] = luc;
    // CỐ Ý để trống Thoi_Gian_Dung_May, dù máy đang dừng thật: phiếu `DM-` đã
    // giữ mốc đó và đang đếm. Ghi vào đây là mời mọi phép tính sau này cộng
    // khoảng dừng thêm một lần nữa. Xem `khoangDungCuaPhieu_`.
    dong[COT.Ngay_Ca] = caMay.ngayCa;
    dong[COT.Ca] = caMay.ca || 'NGOAI_GIO';
    dong[COT.Cap_Nhat_Luc] = luc;
    dong[COT.Request_ID_Cuoi] = requestId;
    dong[COT.Phien_Ban] = 1;
    dong[COT.Loai_Phieu] = LOAI_PHIEU.HO_TRO;

    // Nguyên tắc 1: ghi cả dòng bằng ĐÚNG MỘT setValues.
    const sh = sheet_(SHEET.SU_CO);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEADER_SU_CO.length).setValues([dong]);

    ghiNhatKy_(maSuCo, maMay, 'CONG_NHAN', 'GOI_KY_THUAT',
      { nhomLoi: nhomLoi, phieuDung: dangDung.maSuCo, ca: dong[COT.Ca] }, requestId);

    // Nhả khoá TRƯỚC khi dựng danh bạ và gọi mạng — rào 5.2.
    moKhoa_();

    const danhBa = getOnDutyContacts_(boPhan, nhomLoi, luc, { cauHinh: cauHinh });

    // Cửa thứ ba vào ThongBao.gs. Khác phiếu `DM-` — vốn cố ý không có cửa nào —
    // ở chỗ phiếu này CÓ việc để thợ làm và CÓ nút nhận việc, nên dòng "Bấm để
    // nhận việc" trong tin là đúng, không phải tin suông dạy người ta lướt qua.
    try { thongBaoSuCoMoi_(dong, danhBa, cauHinh); } catch (e) { /* bỏ qua */ }

    return { ok: true, maSuCo: maSuCo, nhomLoi: nhomLoi, gioGoi: fmtGio_(luc),
      danhBa: danhBa };

  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    moKhoa_();
  }
}

/**
 * Mô tả của phiếu `HT-`: lý do máy đang dừng + mã phiếu dừng + phần công nhân gõ.
 *
 * Nhét mã `DM-` vào mô tả là cách nối hai phiếu mà KHÔNG phải thêm cột mới vào
 * `Su_Co` — thêm cột là đụng schema, là thứ phải hỏi. Thợ đọc tin Telegram cũng
 * thấy luôn máy đang dừng vì lý do gì, nên tới nơi là biết việc.
 */
function ghepMoTaHoTro_(phieuDung, moTa) {
  const lyDo = String((phieuDung && phieuDung.moTa) || '').trim();
  const phan = ['Gọi kỹ thuật — máy đang dừng'];
  if (lyDo) phan.push(lyDo);
  if (String(moTa || '').trim()) phan.push(String(moTa).trim());
  if (phieuDung && phieuDung.maSuCo) phan.push('phiếu ' + phieuDung.maSuCo);
  return phan.join(' — ').slice(0, CONFIG.MAX_MO_TA);
}

// ============================================================================

/**
 * Đếm số phiếu của một máy được báo từ mốc thời gian `tuLuc` trở lại đây.
 * Dùng để chặn spam: trang báo sự cố mở công khai không đăng nhập nên bất kỳ ai
 * có URL đều bấm gửi được liên tục.
 */
function demPhieuGanDayCuaMay_(ds, maMay, tuLuc) {
  const ma = String(maMay).trim().toUpperCase();
  let dem = 0;
  ds.forEach(function (r) {
    const v = r.v;
    if (String(v[COT.Ma_May]).trim().toUpperCase() !== ma) return;
    const t = v[COT.Thoi_Gian_Bao];
    if (t instanceof Date && t.getTime() >= tuLuc) dem++;
  });
  return dem;
}

// ============================================================================
// BÙ PHIẾU DỪNG MÁY — thao tác quản trị, CHỈ gọi từ menu Sheet
//
// Dùng khi thợ quên quét "Dừng máy" lúc đem đồ ra ngoài gia công, nên khoảng
// máy nằm im không có phiếu nào phủ. Ca có thật: tời nâng số 1 gãy cốt
// 18/08/2026, phiếu sự cố đóng lúc 17:27 nhưng tới sáng 20/08 mới ráp xong —
// 39 giờ máy đứng không nằm trong báo cáo nào.
//
// Cố ý KHÔNG có route web: sửa dữ liệu quá khứ là việc của người quản lý ngồi
// trước Sheet, không phải việc bấm vội trên điện thoại giữa xưởng.
// ============================================================================

/** 'yyyy-MM-dd HH:mm' → Date giờ VN. Trả null nếu sai định dạng. */
function mocTuChuoi_(s) {
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(m[1] + 'T' + m[2] + ':' + m[3] + ':00+07:00');
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Tạo một phiếu DM- với mốc thời gian do người nhập chỉ định.
 *
 * `denLuc` BỎ TRỐNG = máy vẫn đang nằm im tới bây giờ → phiếu để MỞ
 * (`DANG_XU_LY`), đồng hồ chạy tiếp, đóng sau bằng "Máy đã chạy lại" như phiếu
 * dừng máy bình thường. Thiếu vế này thì ca đang dở dang không ghi được: bù kín
 * tới hiện tại rồi thôi là mất phần từ lúc bù trở đi.
 *
 * @param {Object} p { maMay, tuLuc, denLuc, lyDo, boQuaTrung }
 *   tuLuc/denLuc dạng 'yyyy-MM-dd HH:mm'.
 * @return {Object} { ok, maSuCo, phut, conDung } hoặc { ok:false, error } hoặc
 *                  { ok:false, trungLap:[...] } khi khoảng bù đè lên phiếu có sẵn.
 */
function buPhieuDungMay(p) {
  const o = p || {};
  const may = timMay_(o.maMay);
  if (!may) return { ok: false, error: 'Không tìm thấy máy "' + o.maMay + '".' };

  const bayGio = nowVN_();
  const tu = mocTuChuoi_(o.tuLuc);
  if (!tu) return { ok: false, error: 'Giờ bắt đầu phải dạng yyyy-MM-dd HH:mm.' };
  if (tu.getTime() > bayGio.getTime()) {
    return { ok: false, error: 'Giờ bắt đầu dừng nằm ở tương lai.' };
  }

  const conDung = !String(o.denLuc || '').trim();
  const den = conDung ? null : mocTuChuoi_(o.denLuc);

  if (!conDung) {
    if (!den) return { ok: false, error: 'Giờ chạy lại phải dạng yyyy-MM-dd HH:mm.' };
    if (den.getTime() <= tu.getTime()) {
      return { ok: false, error: 'Giờ chạy lại phải sau giờ bắt đầu dừng.' };
    }
    if (den.getTime() > bayGio.getTime()) {
      return { ok: false, error: 'Không bù được khoảng dừng nằm ở tương lai.' };
    }
  }

  const lyDo = String(o.lyDo || '').trim() || 'Chờ phụ tùng / sửa chữa ngoài';
  const maMay = String(may.Ma_May).trim();

  // Chống bù hai lần: nếu đã có phiếu nào của chính máy này làm nó nằm im trong
  // khoảng đang bù thì dừng lại hỏi, vì bù chồng là downtime bị đếm gấp đôi.
  if (!o.boQuaTrung) {
    const trung = timKhoangDungTrung_(maMay, tu, den || bayGio);
    if (trung.length) return { ok: false, trungLap: trung };
  }

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const boPhan = String(may.Bo_Phan).trim();
    const caMay = xacDinhCa_(boPhan, tu);
    const ma = sinhMaPhieu_(tu, 'DM');
    const phut = Math.round(((den || bayGio).getTime() - tu.getTime()) / 60000);

    const dong = new Array(HEADER_SU_CO.length).fill('');
    dong[COT.Ma_Su_Co] = ma;
    dong[COT.Ma_May] = maMay;
    dong[COT.Ten_May] = String(may.Ten_May).trim();
    dong[COT.Bo_Phan] = boPhan;
    dong[COT.Trang_Thai_May] = 'DA_DUNG';
    dong[COT.Mo_Ta] = (lyDo + ' — bù thủ công').slice(0, CONFIG.MAX_MO_TA);
    // Với DUNG_MAY: DANG_XU_LY = máy đang dừng, HOAN_THANH = máy đã chạy lại.
    dong[COT.Trang_Thai] = conDung ? TRANG_THAI.DANG_XU_LY : TRANG_THAI.HOAN_THANH;
    dong[COT.Thoi_Gian_Bao] = tu;
    dong[COT.Thoi_Gian_Dung_May] = tu;
    if (den) dong[COT.Thoi_Gian_Hoan_Thanh] = den;
    dong[COT.Ngay_Ca] = caMay.ngayCa;
    dong[COT.Ca] = caMay.ca || 'NGOAI_GIO';
    dong[COT.Cap_Nhat_Luc] = nowVN_();
    dong[COT.Phien_Ban] = 1;
    dong[COT.Loai_Phieu] = LOAI_PHIEU.DUNG_MAY;

    const sh = sheet_(SHEET.SU_CO);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEADER_SU_CO.length).setValues([dong]);

    // Ghi rõ là phiếu BÙ và ai bù: số liệu quá khứ bị thêm vào thì phải truy được
    // nguồn gốc, nếu không sau này không ai biết con số ở đâu ra.
    ghiNhatKy_(ma, maMay, nguoiDangDung_(), 'BU_PHIEU_DUNG_MAY',
      { tu: fmtNgay_(tu) + ' ' + fmtGio_(tu),
        den: den ? fmtNgay_(den) + ' ' + fmtGio_(den) : '(máy vẫn đang dừng)',
        phut: phut, lyDo: lyDo }, '');

    return { ok: true, maSuCo: ma, phut: phut, conDung: conDung,
      tenMay: dong[COT.Ten_May] };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

/** Các phiếu của máy này có khoảng máy nằm im giao với [tu, den]. */
function timKhoangDungTrung_(maMay, tu, den) {
  const ma = String(maMay).trim().toUpperCase();
  const bayGio = nowVN_();
  const out = [];

  // Đọc cả Luu_Tru: bù phiếu cho một ngày của tháng trước là đụng đúng khoảng đã
  // được dọn sang lưu trữ, đọc mỗi Su_Co thì phép chống bù chồng im lặng bỏ sót.
  docSuCoVaLuuTru_().forEach(function (v) {
    if (String(v[COT.Ma_May]).trim().toUpperCase() !== ma) return;
    const k = khoangDungMay_(v, bayGio);
    if (!k) return;
    if (k.tu.getTime() < den.getTime() && k.den.getTime() > tu.getTime()) {
      out.push({
        ma: v[COT.Ma_Su_Co],
        tu: fmtNgay_(k.tu) + ' ' + fmtGio_(k.tu),
        den: fmtNgay_(k.den) + ' ' + fmtGio_(k.den),
      });
    }
  });
  return out;
}

function timMay_(maMay) {
  const ma = String(maMay).trim().toUpperCase();
  const ds = docSheet_(SHEET.MAY, HEADER_MAY);
  for (let i = 0; i < ds.length; i++) {
    if (String(ds[i].Ma_May).trim().toUpperCase() === ma) return ds[i];
  }
  return null;
}

/**
 * Công nhân gửi báo sự cố.
 *
 * payload = {
 *   machineCode, trangThaiMay, nhomLoi, moTa, requestId,
 *   boQuaCanhBaoTrung   // true = đã xác nhận vẫn tạo phiếu dù máy đang có phiếu mở
 * }
 *
 * Trả về:
 *   { ok:true, maSuCo, danhBa }                      — tạo thành công
 *   { ok:true, trung:true, maSuCo, danhBa }          — requestId đã gửi trước đó (double-tap)
 *   { ok:false, phieuDangMo:{...} }                  — máy đang có phiếu mở, chờ xác nhận
 *   { ok:false, error }                              — lỗi
 */
function reportIncident(payload) {
  const p = payload || {};

  // --- Kiểm tra đầu vào — CỐ Ý làm TRƯỚC khi giành khoá ---------------------
  // Khoá của LockService là khoá toàn cục: mọi người submit đều xếp hàng qua nó.
  // Nên bên trong khoá chỉ để đúng phần bắt buộc phải tuần tự (đọc để chống
  // trùng → sinh mã → ghi dòng). Đọc danh mục máy và validate không cần khoá.
  const maMay = String(p.machineCode || '').trim();
  const may = timMay_(maMay);
  if (!may) return { ok: false, error: 'Không tìm thấy máy "' + maMay + '".' };

  const trangThaiMay = String(p.trangThaiMay || '').trim().toUpperCase();
  if (TRANG_THAI_MAY.indexOf(trangThaiMay) === -1) {
    return { ok: false, error: 'Chưa chọn tình trạng máy.' };
  }

  const nhomLoi = String(p.nhomLoi || '').trim().toUpperCase();
  if (NHOM_LOI.indexOf(nhomLoi) === -1) {
    return { ok: false, error: 'Chưa chọn nhóm lỗi.' };
  }

  const moTa = String(p.moTa || '').trim().slice(0, CONFIG.MAX_MO_TA);
  const requestId = String(p.requestId || '').trim();
  if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

  const boPhan = String(may.Bo_Phan).trim();

  // Đọc cấu hình TRƯỚC khi giành khoá — đây là sheet nhỏ và không cần tuần tự.
  const cauHinh = docCauHinh_();
  const spamPhut = soCauHinh_(cauHinh.CHONG_SPAM_PHUT, CONFIG.CHONG_SPAM_PHUT);
  const spamSoPhieu = soCauHinh_(cauHinh.CHONG_SPAM_SO_PHIEU, CONFIG.CHONG_SPAM_SO_PHIEU);

  const lock = LockService.getScriptLock();
  let daMoKhoa = false;
  function moKhoa_() { if (!daMoKhoa) { lock.releaseLock(); daMoKhoa = true; } }

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, vui lòng thử lại sau vài giây.' };
    }

    const dsGanDay = docSuCoGanDay_();

    // --- Chống double-tap: requestId đã ghi rồi thì trả lại phiếu cũ ---------
    for (let i = dsGanDay.length - 1; i >= 0; i--) {
      if (String(dsGanDay[i].v[COT.Request_ID_Cuoi]).trim() === requestId) {
        const maCu = dsGanDay[i].v[COT.Ma_Su_Co];
        moKhoa_(); // dựng danh bạ là việc chỉ đọc, không được giữ khoá để làm
        return { ok: true, trung: true, maSuCo: maCu,
          danhBa: getOnDutyContacts_(boPhan, nhomLoi, null, { cauHinh: cauHinh }) };
      }
    }

    // --- Chặn spam ----------------------------------------------------------
    // Đặt SAU bước chống trùng requestId để bấm lại sau lỗi mạng không bị tính là
    // spam, và TRƯỚC mọi thao tác ghi.
    if (spamPhut > 0 && spamSoPhieu > 0) {
      const tuLuc = Date.now() - spamPhut * 60000;
      if (demPhieuGanDayCuaMay_(dsGanDay, maMay, tuLuc) >= spamSoPhieu) {
        return {
          ok: false,
          error: 'Máy này đã có ' + spamSoPhieu + ' phiếu trong ' + spamPhut +
            ' phút vừa qua. Vui lòng gọi thợ theo số đã hiện, hoặc chờ ít phút rồi báo lại.',
        };
      }
    }

    // --- Máy đang có phiếu chưa đóng ----------------------------------------
    const dangMo = timPhieuDangMo_(maMay, dsGanDay);
    if (dangMo && !p.boQuaCanhBaoTrung) {
      return { ok: false, phieuDangMo: dangMo };
    }

    // --- Ghi phiếu -----------------------------------------------------------
    const luc = nowVN_();
    const caMay = xacDinhCa_(boPhan, luc); // ca của phiếu tính theo bộ phận MÁY
    const maSuCo = sinhMaPhieu_(luc, 'SC');

    const dong = new Array(HEADER_SU_CO.length).fill('');
    dong[COT.Ma_Su_Co] = maSuCo;
    dong[COT.Ma_May] = String(may.Ma_May).trim();
    dong[COT.Ten_May] = String(may.Ten_May).trim();
    dong[COT.Bo_Phan] = boPhan;
    dong[COT.Trang_Thai_May] = trangThaiMay;
    dong[COT.Nhom_Loi] = nhomLoi;
    dong[COT.Mo_Ta] = moTa;
    dong[COT.Trang_Thai] = TRANG_THAI.CHO_NHAN;
    dong[COT.Thoi_Gian_Bao] = luc;
    // Báo là máy đã dừng → coi như dừng từ lúc báo. Nếu công nhân báo "còn chạy"
    // mà thợ tới nơi thấy phải dừng, mốc này sẽ được ghi lúc thợ lật trạng thái.
    if (trangThaiMay === 'DA_DUNG') dong[COT.Thoi_Gian_Dung_May] = luc;
    dong[COT.Ngay_Ca] = caMay.ngayCa;
    dong[COT.Ca] = caMay.ca || 'NGOAI_GIO';
    dong[COT.Cap_Nhat_Luc] = luc;
    dong[COT.Request_ID_Cuoi] = requestId;
    dong[COT.Phien_Ban] = 1;
    dong[COT.Loai_Phieu] = LOAI_PHIEU.SU_CO;

    // Nguyên tắc 1: ghi cả dòng bằng ĐÚNG MỘT setValues.
    const sh = sheet_(SHEET.SU_CO);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEADER_SU_CO.length).setValues([dong]);

    ghiNhatKy_(maSuCo, maMay, 'CONG_NHAN', 'BAO_SU_CO',
      { trangThaiMay: trangThaiMay, nhomLoi: nhomLoi, ca: dong[COT.Ca] }, requestId);

    // Phiếu đã ghi xong và an toàn → nhả khoá NGAY, đừng bắt người xếp hàng phía
    // sau chờ thêm 3 lượt đọc sheet (danh mục thợ, ca làm việc, lịch trực) chỉ để
    // dựng danh bạ cho riêng người này.
    moKhoa_();

    // Truyền lại cấu hình đã đọc ở trên để không phải đọc sheet Cau_Hinh lần hai.
    const danhBa = getOnDutyContacts_(boPhan, nhomLoi, luc, { cauHinh: cauHinh });

    // Nhắn Telegram cho đúng những thợ vừa hiện trong danh bạ. Đặt ở ĐÂY, sau
    // moKhoa_(), là bắt buộc — rào 5.2 của TASK_THONG_BAO_TELEGRAM.md: đặt vào
    // trong khoá thì mọi người báo sự cố phải xếp hàng chờ một cuộc gọi mạng.
    // Hàm kia đã tự nuốt mọi lỗi, try/catch này là lớp thứ hai: phiếu ghi xong
    // rồi, không được để phần thông báo làm hỏng việc trả danh bạ về cho công
    // nhân. Công tắc TELEGRAM_BAT tắt thì nó thành lệnh rỗng.
    try { thongBaoSuCoMoi_(dong, danhBa, cauHinh); } catch (e) { /* bỏ qua */ }

    return { ok: true, maSuCo: maSuCo, danhBa: danhBa };

  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    moKhoa_();
  }
}
