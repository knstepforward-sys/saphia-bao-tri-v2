/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * TỈ LỆ HIỆU DỤNG A = thời gian chạy thực tế / thời gian chạy theo kế hoạch.
 *
 * Kế hoạch khai theo BỘ PHẬN (sheet Ke_Hoach_Chay_May), mọi máy trong cùng bộ
 * phận dùng chung một khung giờ. Kết quả tính và báo cáo theo TỪNG MÁY.
 *
 * ----------------------------------------------------------------------------
 * VÌ SAO PHẢI CẮT KHOẢNG DỪNG THEO KHUNG KẾ HOẠCH
 *
 * `tongPhutDung_` trong BaoCao.gs đo downtime bằng giờ thực trôi qua. Phiếu tời
 * nâng 18/08 ra 39 giờ liên tục — gồm cả đêm, cả giờ nghỉ, cả chủ nhật. Trừ
 * thẳng con số đó vào kế hoạch một ngày (10 giờ) thì A ra ÂM.
 *
 * Nên ở đây mỗi khoảng dừng được GIAO với các khung giờ kế hoạch của đúng những
 * ngày nó vắt qua, rồi mới cộng. Khung kế hoạch đã loại nghỉ trưa và giao ca;
 * máy dừng trong những khoảng dừng theo kế hoạch đó không làm giảm A. A luôn
 * nằm trong 0–100%.
 *
 * ----------------------------------------------------------------------------
 * VÌ SAO PHẢI HỢP NHẤT KHOẢNG TRƯỚC KHI CỘNG
 *
 * Một máy có thể cùng lúc mang phiếu SC- (đang sửa) và phiếu DM- (chờ phụ tùng)
 * chồng lên nhau — đúng quy trình "đem đồ ra ngoài gia công" ở mục 4 CLAUDE.md.
 * Cộng riêng từng phiếu là đếm downtime HAI LẦN, đúng cái bẫy mà `buPhieuDungMay`
 * đã phải chặn. Nên các khoảng của cùng một máy được gộp thành hợp (union) rồi
 * mới đo độ dài.
 *
 * ----------------------------------------------------------------------------
 * NGÀY Ở ĐÂY LÀ NGÀY CA, KHÔNG PHẢI NGÀY LỊCH
 *
 * Bộ phận có ca đêm thì khung kế hoạch của ngày D chạy từ giờ bắt đầu ca ngày D
 * đến đúng giờ đó hôm sau — 24 giờ liền. Đúng quy ước "ca đêm = phần bù của ca
 * ngày" mà `xacDinhCa_` đang dùng, nhờ vậy A khớp với cột Ngay_Ca của phiếu.
 */

// ============================================================================
// 1. Đọc kế hoạch
// ============================================================================

/**
 * Chuẩn hoá chuỗi để so khớp: bỏ dấu, đ→d, hoa hết, gộp khoảng trắng.
 * Dùng cho cả tên bộ phận lẫn tên máy.
 *
 * Danh_Muc_May đang có cả 'CMTĐ' lẫn 'Chung' viết thường — khớp thô theo chuỗi
 * là trượt, mà trượt thì máy đó mất kế hoạch và biến mất khỏi báo cáo.
 *
 * KHÔNG dùng chung với `chuanBoPhan_` của XuatBaoCao.gs: hàm đó cố tình GIỮ dấu
 * vì nó so khớp lựa chọn người dùng tick trong hộp thoại xuất báo cáo với đúng
 * chuỗi trong sheet. Đổi hàm đó thành bỏ dấu là đổi hành vi của bộ lọc xuất.
 */
function chuanKhoa_(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .trim().toUpperCase().replace(/\s+/g, ' ');
}

/** Ô tick / ô chữ trong sheet → boolean. Nhận TRUE, CO, YES, X, 1. */
function batCauHinh_(gt, macDinh) {
  if (gt === true) return true;
  if (gt === false) return false;
  const s = String(gt === null || gt === undefined ? '' : gt).trim().toUpperCase();
  if (!s) return !!macDinh;
  return ['TRUE', 'CO', 'CÓ', 'YES', 'X', '1', 'V'].indexOf(s) !== -1;
}

/**
 * Danh sách ngày nghỉ của một bộ phận, đọc từ ô Ngay_Nghi.
 * Nhận cả 'dd/MM/yyyy' lẫn 'yyyy-MM-dd', cách nhau bằng dấu phẩy hoặc xuống dòng.
 * Trả về map { 'yyyy-MM-dd': true } để tra O(1).
 */
function docNgayNghi_(o) {
  const map = {};
  String(o === null || o === undefined ? '' : o)
    .split(/[,;\n]/).forEach(function (x) {
      const s = String(x).trim();
      if (!s) return;
      let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) { map[s] = true; return; }
      m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m) {
        map[m[3] + '-' + pad2_(Number(m[2])) + '-' + pad2_(Number(m[1]))] = true;
      }
    });
  return map;
}

/**
 * Đọc các khoảng nghỉ trưa / giao ca theo bộ phận.
 *
 * Trả map { BO_PHAN: [{loai, tu, den, thu}] }. `thu = null` nghĩa là kế thừa
 * toàn bộ ngày chạy của bộ phận; người dùng chỉ cần tick thứ khi muốn giới hạn
 * một khoảng nghỉ vào vài ngày cụ thể.
 */
function docKhungNgungKeHoach_() {
  const ssx = ss_();
  if (!ssx.getSheetByName(SHEET.KHUNG_NGUNG)) return {};

  const map = {};
  docSheet_(SHEET.KHUNG_NGUNG, HEADER_KHUNG_NGUNG).forEach(function (r) {
    const boPhan = chuanKhoa_(r.Bo_Phan);
    const loai = String(r.Loai_Khoang || '').trim().toUpperCase();
    const tu = gioSangPhut_(r.Gio_Bat_Dau);
    const den = gioSangPhut_(r.Gio_Ket_Thuc);
    if (!boPhan || LOAI_KHUNG_NGUNG.indexOf(loai) === -1 || tu === null || den === null) return;

    const thu = {
      1: batCauHinh_(r.T2, false), 2: batCauHinh_(r.T3, false),
      3: batCauHinh_(r.T4, false), 4: batCauHinh_(r.T5, false),
      5: batCauHinh_(r.T6, false), 6: batCauHinh_(r.T7, false),
      0: batCauHinh_(r.CN, false),
    };
    const coChonThu = Object.keys(thu).some(function (x) { return thu[x]; });
    if (!map[boPhan]) map[boPhan] = [];
    map[boPhan].push({
      loai: loai,
      tu: tu,
      den: den,
      thu: coChonThu ? thu : null,
      ghiChu: String(r.Ghi_Chu || '').trim(),
    });
  });
  return map;
}

/**
 * Đọc Ke_Hoach_Chay_May thành map { BO_PHAN_CHUAN: {...} }.
 * Thiếu sheet thì trả {} chứ không văng lỗi — báo cáo tự hiện dòng nhắc khai.
 */
function docKeHoachChay_() {
  const ssx = ss_();
  if (!ssx.getSheetByName(SHEET.KE_HOACH)) return {};

  const khungNgung = docKhungNgungKeHoach_();
  const map = {};
  docSheet_(SHEET.KE_HOACH, HEADER_KE_HOACH).forEach(function (r) {
    const ten = chuanKhoa_(r.Bo_Phan);
    if (!ten) return;

    const tu = gioSangPhut_(r.Gio_Bat_Dau);
    let den = gioSangPhut_(r.Gio_Ket_Thuc);
    if (tu === null || den === null) return;      // khai thiếu giờ = bỏ qua dòng
    // Ca ngày vắt qua nửa đêm (22:00 → 06:00) thì giờ kết thúc thuộc hôm sau.
    if (den <= tu) den += 1440;

    map[ten] = {
      ten: String(r.Bo_Phan).trim(),
      moTa: r.Mo_Ta,
      tu: tu,
      den: den,
      caDem: batCauHinh_(r.Chay_Ca_Dem, false),
      thu: {
        1: batCauHinh_(r.T2, true), 2: batCauHinh_(r.T3, true),
        3: batCauHinh_(r.T4, true), 4: batCauHinh_(r.T5, true),
        5: batCauHinh_(r.T6, true), 6: batCauHinh_(r.T7, true),
        0: batCauHinh_(r.CN, false),
      },
      nghi: docNgayNghi_(r.Ngay_Nghi),
      tamDung: khungNgung[ten] || [],
    };
  });
  return map;
}

/** Kế hoạch áp cho một bộ phận, có đường lùi khi bộ phận chưa được khai. */
function keHoachCuaBoPhan_(kh, boPhan) {
  const ten = chuanKhoa_(boPhan);
  if (kh[ten]) return kh[ten];

  // Danh_Muc_May có máy khai hai bộ phận ('MTX, CMTX') — lấy vế đầu làm chủ.
  const veDau = ten.split(',')[0].trim();
  if (veDau && kh[veDau]) return kh[veDau];

  // Không tự gán MAC_DINH: A là KPI, dùng một lịch phỏng đoán cho bộ phận chưa
  // khai còn nguy hiểm hơn để trống và báo rõ "chưa đo được".
  return null;
}

// ============================================================================
// 2. Khung giờ kế hoạch
// ============================================================================

/** 'yyyy-MM-dd' + số phút từ 00:00 → Date. Phút ≥ 1440 tự tràn sang hôm sau. */
function ngayGioTuPhut_(ngayStr, phut) {
  const p = String(ngayStr).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 0, phut, 0, 0);
}

/** Mọi ngày 'yyyy-MM-dd' trong khoảng, kể cả hai đầu. */
function dsNgayTrongKhoang_(tuNgay, denNgay) {
  const ds = [];
  const p = String(tuNgay).split('-');
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const het = String(denNgay);
  for (let i = 0; i < 400; i++) {                 // chặn cứng, tránh vòng lặp vô hạn
    const s = fmtNgay_(d);
    if (s > het) break;
    ds.push(s);
    d.setDate(d.getDate() + 1);
  }
  return ds;
}

/**
 * Khung giờ máy PHẢI chạy trong ngày ca `ngayStr`. Trả [] nếu là ngày nghỉ.
 *
 * Có ca đêm → khung gốc 24 giờ từ giờ bắt đầu ca ngày hôm đó. Không có ca đêm →
 * đúng khung ca ngày. Sau đó trừ mọi khoảng NGHI_TRUA / GIAO_CA của bộ phận,
 * nên kết quả có thể gồm nhiều khung chạy rời nhau.
 */
function khungKeHoachNgay_(k, ngayStr) {
  if (!k) return [];
  if (k.nghi[ngayStr]) return [];

  const p = String(ngayStr).split('-');
  const thu = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2])).getDay();
  if (!k.thu[thu]) return [];

  const den = k.caDem ? k.tu + 1440 : k.den;
  const goc = [{ tu: ngayGioTuPhut_(ngayStr, k.tu), den: ngayGioTuPhut_(ngayStr, den) }];

  // Nghỉ trưa và giao ca là dừng THEO KẾ HOẠCH, phải trừ khỏi mẫu số A. Sinh
  // ứng viên ở ngày trước/ngày đang xét/ngày sau để bắt đúng khoảng giao ca nằm
  // ngay biên của chu kỳ 24 giờ (ví dụ 06:50–07:10 với ngày ca bắt đầu 07:00).
  const tamDung = [];
  (k.tamDung || []).forEach(function (x) {
    if (x.thu && !x.thu[thu]) return;
    let denPhut = x.den;
    if (denPhut <= x.tu) denPhut += 1440;
    [-1, 0, 1].forEach(function (lechNgay) {
      tamDung.push({
        tu: ngayGioTuPhut_(ngayStr, x.tu + lechNgay * 1440),
        den: ngayGioTuPhut_(ngayStr, denPhut + lechNgay * 1440),
      });
    });
  });
  return truKhoang_(goc, tamDung);
}

// ============================================================================
// 3. Đại số khoảng thời gian
// ============================================================================

/** Giao của hai khoảng, null nếu rời nhau. */
function giaoKhoang_(a, b) {
  const tu = Math.max(a.tu.getTime(), b.tu.getTime());
  const den = Math.min(a.den.getTime(), b.den.getTime());
  return den > tu ? { tu: new Date(tu), den: new Date(den) } : null;
}

/** Trừ mọi khoảng `bo` khỏi danh sách khoảng `goc`, trả các phần còn phải chạy. */
function truKhoang_(goc, bo) {
  let out = (goc || []).map(function (x) { return { tu: x.tu, den: x.den }; });
  (bo || []).forEach(function (b) {
    const tiep = [];
    out.forEach(function (a) {
      const g = giaoKhoang_(a, b);
      if (!g) { tiep.push(a); return; }
      if (a.tu.getTime() < g.tu.getTime()) tiep.push({ tu: a.tu, den: g.tu });
      if (g.den.getTime() < a.den.getTime()) tiep.push({ tu: g.den, den: a.den });
    });
    out = tiep;
  });
  return out;
}

/**
 * Hợp nhất các khoảng chồng lấn thành danh sách rời nhau.
 * Không có bước này thì phiếu SC- và DM- chồng nhau của cùng một máy bị cộng
 * hai lần — đúng lỗi "bù chồng là downtime đếm hai lần".
 */
function gomKhoang_(ds) {
  if (!ds.length) return [];
  const sap = ds.slice().sort(function (a, b) { return a.tu - b.tu; });
  const out = [sap[0]];
  for (let i = 1; i < sap.length; i++) {
    const cuoi = out[out.length - 1];
    if (sap[i].tu.getTime() <= cuoi.den.getTime()) {
      if (sap[i].den.getTime() > cuoi.den.getTime()) cuoi.den = sap[i].den;
    } else {
      out.push(sap[i]);
    }
  }
  return out;
}

/** Tổng độ dài (phút) của một danh sách khoảng đã rời nhau. */
function tongPhutKhoang_(ds) {
  return ds.reduce(function (t, k) {
    return t + Math.max(0, Math.round((k.den.getTime() - k.tu.getTime()) / 60000));
  }, 0);
}

// ============================================================================
// 4. Khoảng máy nằm im của một phiếu
// ============================================================================

/**
 * Khoảng máy nằm im do phiếu này gây ra, hoặc null nếu phiếu không làm máy dừng.
 *
 * - SU_CO   : chỉ tính khi công nhân xác nhận máy ĐÃ DỪNG. Báo "Còn chạy" hoặc
 *             "Không rõ" thì máy vẫn ra hàng, trừ vào kế hoạch là oan.
 * - DUNG_MAY: luôn tính — bản chất của loại phiếu này là máy nằm im.
 * - CONG_VIEC: chỉ khi bật cấu hình. Mốc lấy từ Thoi_Gian_Nhan vì phiếu việc
 *             chung tạo là nhận luôn, không có Thoi_Gian_Dung_May.
 * - BAO_TRI : không bao giờ. Thợ làm rải rác trong ca, máy vẫn chạy.
 * - HO_TRO  : không bao giờ. Phiếu `HT-` chỉ mở được khi máy đang có phiếu
 *             `DM-`, mà phiếu đó đã đo trọn khoảng máy nằm im rồi. Phép hợp
 *             nhất khoảng ở dưới chặn được phần chồng nhau, nhưng thợ có thể
 *             đóng `HT-` muộn hơn lúc máy chạy lại — khi ấy đuôi thừa sẽ bị
 *             tính thành máy dừng, mà máy đã ra hàng từ trước đó.
 *
 * Phiếu chưa đóng thì tính tới `bayGio` — máy vẫn đang dừng thật, bỏ qua là báo
 * thiếu đúng những ca dừng lâu nhất.
 */
function khoangDungCuaPhieu_(v, bayGio) {
  const loai = loaiPhieu_(v);
  if (loai === LOAI_PHIEU.BAO_TRI || loai === LOAI_PHIEU.HO_TRO) return null;

  let tu = null;
  if (loai === LOAI_PHIEU.SU_CO) {
    if (String(v[COT.Trang_Thai_May]).trim().toUpperCase() !== 'DA_DUNG') return null;
    tu = v[COT.Thoi_Gian_Dung_May] instanceof Date
      ? v[COT.Thoi_Gian_Dung_May] : v[COT.Thoi_Gian_Bao];
  } else if (loai === LOAI_PHIEU.DUNG_MAY) {
    tu = v[COT.Thoi_Gian_Dung_May] instanceof Date
      ? v[COT.Thoi_Gian_Dung_May] : v[COT.Thoi_Gian_Bao];
  } else {
    tu = v[COT.Thoi_Gian_Nhan] instanceof Date
      ? v[COT.Thoi_Gian_Nhan] : v[COT.Thoi_Gian_Bao];
  }
  if (!(tu instanceof Date)) return null;

  const den = v[COT.Thoi_Gian_Hoan_Thanh] instanceof Date
    ? v[COT.Thoi_Gian_Hoan_Thanh] : bayGio;
  if (den.getTime() <= tu.getTime()) return null;

  return { tu: tu, den: den, loai: loai };
}

/**
 * Máy nào chịu khoảng dừng này.
 *
 * Phiếu SC- và DM- luôn có Ma_May chép từ danh mục. Phiếu CV- thì KHÔNG — cột
 * Ma_May để trống, chỉ có Ten_May sửa tay được trên trang báo cáo ngày. Nên với
 * việc chung phải dò ngược theo TÊN máy đã chuẩn hoá; không khớp tên nào thì
 * phiếu đó không quy được cho máy nào và bị bỏ qua.
 */
function mayCuaPhieu_(v, mapMa, mapTen) {
  const ma = String(v[COT.Ma_May] || '').trim();
  if (ma && mapMa[ma.toUpperCase()]) return mapMa[ma.toUpperCase()];

  const ten = chuanKhoa_(v[COT.Ten_May]);
  if (ten && mapTen[ten]) return mapTen[ten];

  return null;
}

// ============================================================================
// 5. Bộ tính — trái tim của tính năng
// ============================================================================

/** Ba công tắc trong Cau_Hinh quyết định loại phiếu nào bị trừ vào A. */
function congTacHieuDung_(cauHinh) {
  const ch = cauHinh || docCauHinh_();
  return {
    suCo: batCauHinh_(ch.A_TINH_SU_CO, true),
    dungMay: batCauHinh_(ch.A_TINH_DUNG_MAY, true),
    congViec: batCauHinh_(ch.A_TINH_VIEC_CHUNG, false),
  };
}

/**
 * Tính tỉ lệ hiệu dụng A cho mọi máy đang hoạt động, trong khoảng ngày ca
 * [tuNgay, denNgay] (đều là 'yyyy-MM-dd', tính cả hai đầu).
 *
 * `tuyChon` cho phép tiêm { bayGio, keHoach, congTac, dsMay, dsPhieu }. Thiếu
 * trường nào thì hàm tự đọc sheet — nên bộ test phải truyền ĐỦ cả năm, giống
 * ràng buộc đã có với getOnDutyContacts_.
 *
 * Trả về:
 * {
 *   tuNgay, denNgay, congTac,
 *   may: [{maMay, tenMay, boPhan, phutKeHoach, phutDung, phutChay, tiLe, soPhieu}],
 *   tong: {phutKeHoach, phutDung, phutChay, tiLe, soMay, soMayDu},
 *   thieuKeHoach: ['LT', ...]           // bộ phận có máy nhưng chưa khai kế hoạch
 * }
 *
 * `tiLe` là số 0–1, hoặc null khi bộ phận chưa khai kế hoạch (không có mẫu số).
 * Trả null chứ không trả 0: 0 nghĩa là máy đứng cả tháng, còn null nghĩa là chưa
 * đo được — hai chuyện khác hẳn nhau, gộp lại là báo sai cho sếp.
 */
function tinhHieuDung_(tuNgay, denNgay, tuyChon) {
  const o = tuyChon || {};
  const bayGio = o.bayGio || nowVN_();
  const kh = o.keHoach || docKeHoachChay_();
  const congTac = o.congTac || congTacHieuDung_();

  // --- Máy đang hoạt động ---------------------------------------------------
  // `dsMay` tiêm được để bộ test chạy trọn hàm này bằng dữ liệu giả, không đụng
  // sheet nào — cùng kiểu tiêm theo từng trường mà getOnDutyContacts_ đang dùng.
  const dsMay = (o.dsMay || docSheet_(SHEET.MAY, HEADER_MAY)).filter(function (r) {
    return batCauHinh_(r.Hoat_Dong, false);
  });

  const mapMa = {};
  const mapTen = {};
  dsMay.forEach(function (r) {
    const ma = String(r.Ma_May).trim();
    if (!ma) return;
    mapMa[ma.toUpperCase()] = ma;
    const ten = chuanKhoa_(r.Ten_May);
    // Tên trùng nhau thì KHÔNG map — quy nhầm máy còn tệ hơn không quy được.
    if (ten) mapTen[ten] = mapTen[ten] === undefined ? ma : '';
  });
  Object.keys(mapTen).forEach(function (k) { if (!mapTen[k]) delete mapTen[k]; });

  // --- Khung kế hoạch, dựng một lần cho mỗi bộ phận -------------------------
  const dsNgay = dsNgayTrongKhoang_(tuNgay, denNgay);
  // Chặn trên bằng thời điểm chạy báo cáo: giữa tháng mà tính kế hoạch cả tháng
  // thì A của mọi máy đều thấp giả tạo, càng đầu tháng càng sai.
  const chanTren = bayGio.getTime();

  const khungTheoBoPhan = {};
  const thieuKeHoach = {};

  function khungCua_(boPhan) {
    const khoa = chuanKhoa_(boPhan);
    if (khungTheoBoPhan[khoa]) return khungTheoBoPhan[khoa];

    const k = keHoachCuaBoPhan_(kh, boPhan);
    if (!k) {
      thieuKeHoach[String(boPhan || '(trống)').trim()] = true;
      khungTheoBoPhan[khoa] = { ds: [], phut: 0, coKeHoach: false };
      return khungTheoBoPhan[khoa];
    }

    const ds = [];
    dsNgay.forEach(function (n) {
      khungKeHoachNgay_(k, n).forEach(function (w) {
        if (w.tu.getTime() >= chanTren) return;
        ds.push(w.den.getTime() > chanTren ? { tu: w.tu, den: new Date(chanTren) } : w);
      });
    });
    khungTheoBoPhan[khoa] = { ds: ds, phut: tongPhutKhoang_(ds), coKeHoach: true };
    return khungTheoBoPhan[khoa];
  }

  // --- Khoảng dừng, gom theo máy -------------------------------------------
  const dsPhieu = o.dsPhieu || docSuCoVaLuuTru_();
  const dungTheoMay = {};
  const demTheoMay = {};

  dsPhieu.forEach(function (v) {
    const k = khoangDungCuaPhieu_(v, bayGio);
    if (!k) return;
    if (k.loai === LOAI_PHIEU.SU_CO && !congTac.suCo) return;
    if (k.loai === LOAI_PHIEU.DUNG_MAY && !congTac.dungMay) return;
    if (k.loai === LOAI_PHIEU.CONG_VIEC && !congTac.congViec) return;

    const ma = mayCuaPhieu_(v, mapMa, mapTen);
    if (!ma) return;

    if (!dungTheoMay[ma]) { dungTheoMay[ma] = []; demTheoMay[ma] = 0; }
    dungTheoMay[ma].push(k);
    demTheoMay[ma]++;
  });

  // --- Ráp kết quả ----------------------------------------------------------
  const may = dsMay.map(function (r) {
    const ma = String(r.Ma_May).trim();
    const khung = khungCua_(r.Bo_Phan);
    const phutKeHoach = khung.phut;

    // Cắt từng khoảng dừng cho lọt vào khung kế hoạch TRƯỚC khi hợp nhất.
    const canhTrong = [];
    (dungTheoMay[ma] || []).forEach(function (k) {
      khung.ds.forEach(function (w) {
        const g = giaoKhoang_(k, w);
        if (g) canhTrong.push(g);
      });
    });
    const phutDung = Math.min(phutKeHoach, tongPhutKhoang_(gomKhoang_(canhTrong)));
    const phutChay = Math.max(0, phutKeHoach - phutDung);

    return {
      maMay: ma,
      tenMay: String(r.Ten_May).trim(),
      boPhan: String(r.Bo_Phan).trim(),
      phutKeHoach: phutKeHoach,
      phutDung: phutDung,
      phutChay: phutChay,
      tiLe: khung.coKeHoach && phutKeHoach > 0 ? phutChay / phutKeHoach : null,
      soPhieu: demTheoMay[ma] || 0,
    };
  });

  const tongKH = may.reduce(function (t, m) { return t + m.phutKeHoach; }, 0);
  const tongDung = may.reduce(function (t, m) { return t + m.phutDung; }, 0);

  return {
    tuNgay: tuNgay,
    denNgay: denNgay,
    congTac: congTac,
    may: may,
    tong: {
      phutKeHoach: tongKH,
      phutDung: tongDung,
      phutChay: Math.max(0, tongKH - tongDung),
      tiLe: tongKH > 0 ? Math.max(0, tongKH - tongDung) / tongKH : null,
      soMay: may.length,
      soMayDu: may.filter(function (m) { return m.phutDung === 0 && m.tiLe !== null; }).length,
    },
    thieuKeHoach: Object.keys(thieuKeHoach).sort(),
  };
}

/** Gom kết quả theo máy thành từng bộ phận, cho khối tổng trong file xuất. */
function hieuDungTheoBoPhan_(kq) {
  const nhom = {};
  kq.may.forEach(function (m) {
    const k = m.boPhan || '(trống)';
    if (!nhom[k]) nhom[k] = { boPhan: k, soMay: 0, phutKeHoach: 0, phutDung: 0 };
    nhom[k].soMay++;
    nhom[k].phutKeHoach += m.phutKeHoach;
    nhom[k].phutDung += m.phutDung;
  });
  return Object.keys(nhom).map(function (k) {
    const x = nhom[k];
    x.phutChay = Math.max(0, x.phutKeHoach - x.phutDung);
    x.tiLe = x.phutKeHoach > 0 ? x.phutChay / x.phutKeHoach : null;
    return x;
  }).sort(function (a, b) {
    if (a.tiLe === null) return 1;
    if (b.tiLe === null) return -1;
    return a.tiLe - b.tiLe;                        // tệ nhất lên đầu
  });
}

/** Phút → giờ, 1 chữ số thập phân. */
function phutSangGio_(p) {
  return Math.round(Number(p || 0) / 6) / 10;
}

/** Tỉ lệ 0–1 → chuỗi phần trăm, hoặc '—' khi chưa đo được. */
function tiLeChu_(t) {
  return t === null || t === undefined ? '—' : (Math.round(t * 1000) / 10) + '%';
}

/** Máy tệ nhất lên đầu; máy chưa có kế hoạch xuống cuối. */
function sapTheoHieuDung_(ds) {
  return ds.slice().sort(function (a, b) {
    if (a.tiLe === null && b.tiLe === null) return String(a.maMay).localeCompare(String(b.maMay));
    if (a.tiLe === null) return 1;
    if (b.tiLe === null) return -1;
    if (a.tiLe !== b.tiLe) return a.tiLe - b.tiLe;
    return String(a.maMay).localeCompare(String(b.maMay));
  });
}

// ============================================================================
// 6. Khối dòng cho sheet Tong_Hop
// ============================================================================

/**
 * Dựng phần "TỈ LỆ HIỆU DỤNG A" của sheet Tong_Hop cho một tháng 'MM/yyyy'.
 * Trả về mảng dòng, mỗi dòng đã đủ `soCot` ô.
 *
 * Chỉ liệt kê máy CÓ dừng. Máy chạy đủ kế hoạch gộp lại thành một dòng đếm —
 * 176 dòng toàn 100% không nói thêm được gì mà đẩy phần dưới của sheet đi xa.
 */
function khoiHieuDungThang_(thangCan, soCot) {
  const khoaThang = thangCan.slice(3) + '-' + thangCan.slice(0, 2);   // 'yyyy-MM'
  const p = khoaThang.split('-');
  const cuoiThang = new Date(Number(p[0]), Number(p[1]), 0).getDate();
  const kq = tinhHieuDung_(khoaThang + '-01', khoaThang + '-' + pad2_(cuoiThang));

  const out = [];
  function them_(arr) {
    const r = (arr || []).slice(0, soCot);
    while (r.length < soCot) r.push('');
    out.push(r);
  }

  const ct = kq.congTac;
  const dangTinh = [
    ct.suCo ? 'sự cố máy' : '', ct.dungMay ? 'dừng máy không hư' : '',
    ct.congViec ? 'việc chung' : '',
  ].filter(Boolean).join(' + ') || '(không tính loại nào)';

  them_(['TỈ LỆ HIỆU DỤNG A — THEO TỪNG MÁY']);
  them_(['A = thời gian chạy thực tế / thời gian chạy theo kế hoạch. ' +
    'Kế hoạch khai ở sheet ' + SHEET.KE_HOACH + '.']);
  them_(['Đang trừ vào A: ' + dangTinh + '. Đổi ở sheet ' + SHEET.CAU_HINH +
    ' — A_TINH_SU_CO / A_TINH_DUNG_MAY / A_TINH_VIEC_CHUNG.']);

  if (kq.thieuKeHoach.length) {
    them_(['⚠ Chưa khai kế hoạch cho bộ phận: ' + kq.thieuKeHoach.join(', ') +
      ' — máy các bộ phận này không có A.']);
  }

  them_(['Kế hoạch (giờ)', 'Dừng trong kế hoạch (giờ)', 'Chạy thực tế (giờ)',
    'A TOÀN NHÀ MÁY', 'Số máy', 'Máy chạy đủ kế hoạch']);
  them_([phutSangGio_(kq.tong.phutKeHoach), phutSangGio_(kq.tong.phutDung),
    phutSangGio_(kq.tong.phutChay), tiLeChu_(kq.tong.tiLe),
    kq.tong.soMay, kq.tong.soMayDu]);
  them_([]);

  const coDung = sapTheoHieuDung_(kq.may.filter(function (m) {
    return m.phutDung > 0 || m.tiLe === null;
  }));

  them_(['Mã máy', 'Tên máy', 'Bộ phận', 'Kế hoạch (giờ)', 'Dừng (giờ)',
    'Chạy thực tế (giờ)', 'A (%)', 'Số phiếu']);
  coDung.forEach(function (m) {
    them_([m.maMay, m.tenMay, m.boPhan, phutSangGio_(m.phutKeHoach),
      phutSangGio_(m.phutDung), phutSangGio_(m.phutChay), tiLeChu_(m.tiLe), m.soPhieu]);
  });
  if (!coDung.length) them_(['(không máy nào dừng trong kế hoạch tháng này)']);

  return out;
}

// ============================================================================
// 7. Sheet Hieu_Dung trong file xuất báo cáo
// ============================================================================

const SO_COT_HIEU_DUNG = 8;

/**
 * Ghi sheet `Hieu_Dung` vào file xuất: tổng toàn kỳ → theo bộ phận → từng máy.
 *
 * CỐ Ý KHÔNG dùng tập phiếu đã lọc của file xuất. Bộ lọc thợ làm rụng sạch phiếu
 * `DM-` (phiếu dừng máy không gắn thợ nào) — lọc rồi mới tính A thì máy đứng cả
 * tuần vì thiếu nguyên liệu vẫn hiện A = 100%. Ở đây tính trên TOÀN BỘ phiếu của
 * kỳ, chỉ áp bộ lọc BỘ PHẬN vào danh sách máy được liệt kê.
 */
function ghiHieuDung_(ssMoi, ctx) {
  const kq = tinhHieuDung_(ctx.tuNgay, ctx.denNgay);

  // Bộ lọc bộ phận của hộp thoại giữ nguyên dấu, nên so khớp bằng cả hai kiểu.
  const loc = {};
  (ctx.dsBoPhan || []).forEach(function (b) { loc[chuanKhoa_(b)] = true; });
  const coLoc = Object.keys(loc).length > 0;
  const dsMay = coLoc
    ? kq.may.filter(function (m) { return loc[chuanKhoa_(m.boPhan)]; })
    : kq.may;

  const sh = ssMoi.insertSheet('Hieu_Dung');
  const bang = [];
  function them_(arr) {
    const r = (arr || []).slice(0, SO_COT_HIEU_DUNG);
    while (r.length < SO_COT_HIEU_DUNG) r.push('');
    bang.push(r);
  }

  const ct = kq.congTac;
  const dangTru = [
    ct.suCo ? 'sự cố máy (SC-)' : '', ct.dungMay ? 'dừng máy không hư (DM-)' : '',
    ct.congViec ? 'việc chung (CV-)' : '',
  ].filter(Boolean).join(' + ') || '(không trừ loại nào)';

  them_(['TỈ LỆ HIỆU DỤNG A — ' + ctx.nhanKy]);
  them_(['A = thời gian máy chạy thực tế / thời gian máy phải chạy theo kế hoạch.']);
  them_(['Kế hoạch khai ở sheet ' + SHEET.KE_HOACH + ' của file gốc, theo bộ phận. ' +
    'Thời gian dừng được cắt cho vừa khung giờ kế hoạch nên A luôn trong 0–100%.']);
  them_(['Đang trừ vào A: ' + dangTru + '.']);
  them_(['Tính trên TOÀN BỘ phiếu của kỳ, không áp bộ lọc thợ — phiếu dừng máy ' +
    'không gắn thợ nào, lọc thợ rồi mới tính là bỏ sót đúng phần máy nằm im lâu nhất.']);
  if (kq.thieuKeHoach.length) {
    them_(['⚠ Chưa khai kế hoạch cho bộ phận: ' + kq.thieuKeHoach.join(', ') +
      ' — máy các bộ phận này để trống cột A.']);
  }
  them_([]);

  // --- Tổng toàn kỳ ---------------------------------------------------------
  const tongKH = dsMay.reduce(function (t, m) { return t + m.phutKeHoach; }, 0);
  const tongDung = dsMay.reduce(function (t, m) { return t + m.phutDung; }, 0);
  const tongChay = Math.max(0, tongKH - tongDung);

  them_(['TỔNG TOÀN KỲ']);
  const dongHeaderTong = bang.length + 1;
  them_(['Kế hoạch (giờ)', 'Dừng trong kế hoạch (giờ)', 'Chạy thực tế (giờ)',
    'A', 'Số máy', 'Máy chạy đủ kế hoạch']);
  them_([phutSangGio_(tongKH), phutSangGio_(tongDung), phutSangGio_(tongChay),
    tiLeChu_(tongKH > 0 ? tongChay / tongKH : null), dsMay.length,
    dsMay.filter(function (m) { return m.phutDung === 0 && m.tiLe !== null; }).length]);
  them_([]);

  // --- Theo bộ phận ---------------------------------------------------------
  them_(['THEO BỘ PHẬN']);
  const dongHeaderBp = bang.length + 1;
  them_(['Bộ phận', 'Số máy', 'Kế hoạch (giờ)', 'Dừng (giờ)', 'Chạy thực tế (giờ)', 'A']);
  hieuDungTheoBoPhan_({ may: dsMay }).forEach(function (x) {
    them_([x.boPhan, x.soMay, phutSangGio_(x.phutKeHoach), phutSangGio_(x.phutDung),
      phutSangGio_(x.phutChay), tiLeChu_(x.tiLe)]);
  });
  them_([]);

  // --- Từng máy -------------------------------------------------------------
  // Liệt kê ĐỦ mọi máy, kể cả máy A = 100%. Khác báo cáo trong ngày: file này để
  // sếp lưu và đối chiếu, thiếu một máy là người đọc phải đi hỏi máy đó đâu.
  them_(['TỪNG MÁY — máy tệ nhất xếp trên']);
  const dongHeaderMay = bang.length + 1;
  them_(['Mã máy', 'Tên máy', 'Bộ phận', 'Kế hoạch (giờ)', 'Dừng (giờ)',
    'Chạy thực tế (giờ)', 'A', 'Số phiếu làm dừng']);
  sapTheoHieuDung_(dsMay).forEach(function (m) {
    them_([m.maMay, m.tenMay, m.boPhan, phutSangGio_(m.phutKeHoach),
      phutSangGio_(m.phutDung), phutSangGio_(m.phutChay), tiLeChu_(m.tiLe), m.soPhieu]);
  });
  if (!dsMay.length) them_(['(không máy nào khớp bộ lọc bộ phận của kỳ này)']);

  sh.getRange(1, 1, bang.length, SO_COT_HIEU_DUNG).setValues(bang);

  // --- Định dạng ------------------------------------------------------------
  sh.getRange(1, 1, 1, SO_COT_HIEU_DUNG).setFontSize(14).setFontWeight('bold');
  [dongHeaderTong, dongHeaderBp, dongHeaderMay].forEach(function (d) {
    dinhDangHeader_(sh, d, SO_COT_HIEU_DUNG);
  });
  [dongHeaderTong - 1, dongHeaderBp - 1, dongHeaderMay - 1].forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_HIEU_DUNG).setFontWeight('bold');
  });
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 240);
  sh.setColumnWidth(3, 110);
  for (let c = 4; c <= SO_COT_HIEU_DUNG; c++) sh.setColumnWidth(c, 140);
  sh.setFrozenRows(dongHeaderMay);

  return { soMay: dsMay.length, tiLe: tongKH > 0 ? tongChay / tongKH : null };
}
