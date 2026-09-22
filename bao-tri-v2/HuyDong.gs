/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * ĐỢT 3 — HAI CHỈ SỐ THEO TUẦN: tỷ lệ huy động máy + hiệu suất máy được bố trí chạy.
 * Thiết kế: TASK_KE_HOACH_TO_TRUONG.md mục 8.
 *
 *   Huy động = Σ lượt máy-ca "Bố trí chạy" / Σ lượt máy-ca áp dụng      (có máy được đem ra chạy không)
 *   Hiệu suất = 1 − phút mất / phút kế hoạch của các lượt đã bố trí chạy  (máy đã chạy thì chạy tốt không)
 *     phút mất = dừng máy (SC-, DM-) + về giữa ca, đã hợp nhất chồng lấn, chỉ trong khung đã bố trí.
 *
 * Hai chỉ số KHÔNG gộp thành một. Không thêm cột/sheet; không sửa HieuDung.gs (chỉ gọi lại các
 * hàm thuần của nó). Nguồn: Ke_Hoach_May + Lich_Lam_Viec_To + Cau_Hinh + Su_Co/Luu_Tru.
 *
 * Lượt máy-ca (1 máy × 1 ngày × 1 mốc) — ba mốc: ca ngày, tăng ca, ca đêm (tăng ca và ca đêm
 * loại trừ nhau, gọi chung là "lượt tối"):
 *   ca ngày : luôn áp dụng khi tổ đã khai lịch. Không chạy nếu có dòng DONG ca N. Tăng ca không
 *             kéo dài ca ngày nữa.
 *   lượt tối, tổ CHAY (luôn chạy ca đêm): áp dụng mọi ngày có ca đêm.
 *             - không tăng ca: ca đêm; không chạy nếu có dòng DONG ca D.
 *             - có tăng ca, chưa đóng ca đêm: ca đêm VẪN trong kế hoạch; đoạn tăng ca là phần chạy
 *               được, phần ca đêm còn lại là HAO HỤT theo lý do của dòng tăng ca (thợ vắng ca đêm).
 *             - có tăng ca, đã đóng ca đêm: chỉ đoạn tăng ca vào kế hoạch.
 *   lượt tối, tổ khác: chỉ áp dụng (và tính là chạy) khi có tăng ca hoặc CHAY_DEM — không phải kế
 *             hoạch mặc định nên không đưa vào mẫu số khi tổ không khai.
 */

/** 'yyyy-MM-dd' + n ngày, không phụ thuộc múi giờ máy chủ. Hàm THUẦN. */
function ymdCongNgay_(ymd, n) {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Tổng phút giao giữa các khung (có hệ số quy đổi `he`) và các khoảng `dsKhoang`, hợp nhất chồng lấn trước. */
function phutMatTrongKhung_(dsKhung, dsKhoang) {
  const u = gomKhoang_((dsKhoang || []).map(function (x) { return { tu: x.tu, den: x.den }; }));
  let s = 0;
  dsKhung.forEach(function (k) {
    u.forEach(function (x) {
      const g = giaoKhoang_(x, k);
      if (g) s += (g.den.getTime() - g.tu.getTime()) / 60000 * k.he;
    });
  });
  return s;
}

/**
 * Tính hai chỉ số của MỘT tổ trong MỘT tuần. Hàm THUẦN — mọi dữ liệu tiêm qua `o`:
 *   tuan 'yyyy-MM-dd' (thứ Hai), boPhan, bayGio (Date, mặc định bây giờ),
 *   dsMay [{maMay, tenMay}], dsLich (dòng Lich_Lam_Viec_To), dsKeHoach (dòng Ke_Hoach_May dạng object),
 *   dsPhieu (dòng Su_Co + Luu_Tru dạng mảng), cauHinh.
 *
 * Trả { boPhan, tuan, may:[…], tong:{…}, veTheoLyDo:{lyDo:phút}, thieuLich }.
 * Tỷ lệ là số 0–1 hoặc null khi không có mẫu số (chưa khai lịch / chưa tới giờ kế hoạch).
 * Phút kế hoạch bị chặn trên bởi `bayGio` — tuần đang diễn ra không tính giờ chưa tới.
 */
function tinhChiSoTuan_(o) {
  const bp = String(o.boPhan || '').trim().toUpperCase();
  const tuan = o.tuan;
  const bayGio = o.bayGio || nowVN_();
  const ch = o.cauHinh || docCauHinh_();
  const gioTC = gioTangCa_(ch);
  const nghiDem = nghiDemPhut_(bp, ch);
  const cheDoDem = caDemMacDinh_(bp, ch);
  const chanTren = bayGio.getTime();

  // --- Chỉ mục kế hoạch của đúng tổ + tuần ------------------------------------
  const dong = {}, chayDem = {}, tangCa = {}, veTheoMay = {};
  (o.dsKeHoach || []).forEach(function (r) {
    if (String(r.Bo_Phan).trim().toUpperCase() !== bp) return;
    if (chuanHoaNgay_(r.Tuan_Bat_Dau) !== tuan) return;
    const ma = String(r.Ma_May).trim().toUpperCase();
    const ngay = chuanHoaNgay_(r.Ngay);
    const ca = String(r.Ca).trim().toUpperCase();
    const tt = String(r.Trang_Thai).trim().toUpperCase();
    if (tt === TRANG_THAI_KE_HOACH_MAY.DONG) dong[ma + '|' + ngay + '|' + ca] = true;
    else if (tt === TRANG_THAI_KE_HOACH_MAY.CHAY_DEM) chayDem[ma + '|' + ngay] = true;
    else if (tt === TRANG_THAI_KE_HOACH_MAY.TANG_CA) tangCa[ma + '|' + ngay] = String(r.Ly_Do || '').trim() || true;
    else if (tt === TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA) {
      if (!veTheoMay[ma]) veTheoMay[ma] = [];
      veTheoMay[ma].push({
        ngay: ngay, ca: ca, gioVe: chuanHoaGio_(r.Gio_Ve), gioQuayLai: chuanHoaGio_(r.Gio_Quay_Lai),
        lyDo: String(r.Ly_Do || '').trim() || '(không ghi lý do)',
      });
    }
  });

  // --- Khoảng dừng máy theo từng máy (SC- đã dừng + DM-, như báo cáo khả dụng) -----
  const mapMa = {}, mapTen = {};
  (o.dsMay || []).forEach(function (m) {
    const ma = String(m.maMay).trim();
    if (!ma) return;
    mapMa[ma.toUpperCase()] = ma;
    const ten = chuanKhoa_(m.tenMay);
    if (ten) mapTen[ten] = mapTen[ten] === undefined ? ma : '';
  });
  Object.keys(mapTen).forEach(function (k) { if (!mapTen[k]) delete mapTen[k]; });

  const dungTheoMay = {};
  (o.dsPhieu || []).forEach(function (v) {
    const k = khoangDungCuaPhieu_(v, bayGio);
    if (!k || k.loai === LOAI_PHIEU.CONG_VIEC) return;
    const ma = mayCuaPhieu_(v, mapMa, mapTen);
    if (!ma) return;
    (dungTheoMay[ma] = dungTheoMay[ma] || []).push(k);
  });

  // --- Từng máy -------------------------------------------------------------
  const dsNgay = [];
  for (let i = 0; i < 7; i++) dsNgay.push(ymdCongNgay_(tuan, i));
  const lichTheoNgay = {};
  let thieuLich = false;
  dsNgay.forEach(function (n) {
    lichTheoNgay[n] = lichHienHanhCuaTo_(bp, n, o.dsLich);
    if (!lichTheoNgay[n]) thieuLich = true;
  });

  const veTheoLyDoTo = {};
  const may = (o.dsMay || []).map(function (m) {
    const ma = String(m.maMay).trim();
    const MA = ma.toUpperCase();
    let luotApDung = 0, luotChay = 0;
    const dsKhung = [];
    const thieuDem = []; // [{lyDo, tu, den}] phần ca đêm không chạy vì tăng ca thay (tổ CHAY)
    const them = function (n, tu, den, he) {
      dsKhung.push({ tu: ngayGioTuPhut_(n, tu), den: ngayGioTuPhut_(n, den), he: he });
    };

    dsNgay.forEach(function (n) {
      const lich = lichTheoNgay[n];
      if (!lich) return;
      const lyDoTang = tangCa[MA + '|' + n];

      const kN = khungKeHoachNgayCuaMay_(lich);
      if (kN) {
        luotApDung++;
        if (!dong[MA + '|' + n + '|' + MA_CA.NGAY]) {
          luotChay++;
          kN.khung.forEach(function (k) { them(n, k[0], k[1], 1); });
        }
      }

      const kT = lyDoTang ? khungTangCaCuaMay_(lich, gioTC) : null;
      const kD = khungCaDemCuaMay_(lich, nghiDem);
      const dongDem = !!dong[MA + '|' + n + '|' + MA_CA.DEM];

      if (kD && cheDoDem === 'CHAY') {
        luotApDung++;
        if (!dongDem && kT) {
          // Thợ ca ngày ở lại thay ca đêm: ca đêm vẫn là kế hoạch. Đoạn tăng ca nằm trong ca đêm tính
          // đủ phút (không trừ nghỉ đêm); phần còn lại gánh hết phút nghỉ đêm và là hao hụt.
          luotChay++;
          const dTu = kD.khung[0][0], dDen = kD.hetCa;
          const tTu = Math.max(kT.khung[0][0], dTu), tDen = Math.min(kT.hetCa, dDen);
          const trong = Math.max(0, tDen - tTu);
          const conLai = trong ? truKhoangNghi_(dTu, dDen, [[tTu, tDen]]) : [[dTu, dDen]];
          const phutConLai = kD.phutKhung - trong;
          const heCon = phutConLai > 0 ? Math.max(0, kD.tongPhut - trong) / phutConLai : 0;
          if (trong) them(n, tTu, tDen, 1);
          truKhoangNghi_(kT.khung[0][0], kT.hetCa, [[dTu, dDen]]).forEach(function (k) { them(n, k[0], k[1], 1); });
          const lyDo = typeof lyDoTang === 'string' ? lyDoTang : '(không ghi lý do)';
          conLai.forEach(function (k) {
            them(n, k[0], k[1], heCon);
            thieuDem.push({ lyDo: lyDo, tu: ngayGioTuPhut_(n, k[0]), den: ngayGioTuPhut_(n, k[1]) });
          });
        } else if (!dongDem) {
          luotChay++;
          them(n, kD.khung[0][0], kD.hetCa, kD.tongPhut / kD.phutKhung);
        } else if (kT) {
          luotChay++;                           // đóng ca đêm theo kế hoạch, vẫn tăng ca
          them(n, kT.khung[0][0], kT.hetCa, 1);
        }
      } else if (kT) {
        luotApDung++; luotChay++;               // tăng ca là chạy thêm
        them(n, kT.khung[0][0], kT.hetCa, 1);
      } else if (kD && chayDem[MA + '|' + n]) {
        luotApDung++; luotChay++;
        them(n, kD.khung[0][0], kD.hetCa, kD.tongPhut / kD.phutKhung);
      }
    });

    // Cắt khung theo giờ hiện tại rồi tính phút kế hoạch.
    const khung = [];
    dsKhung.forEach(function (k) {
      if (k.tu.getTime() >= chanTren) return;
      khung.push({ tu: k.tu, den: k.den.getTime() > chanTren ? new Date(chanTren) : k.den, he: k.he });
    });
    const phutKeHoach = khung.reduce(function (s, k) {
      return s + (k.den.getTime() - k.tu.getTime()) / 60000 * k.he;
    }, 0);

    // Dừng máy trước, rồi cộng dồn từng lý do về giữa ca để phần trùng không đếm hai lần.
    const dung = dungTheoMay[ma] || [];
    const phutDungMay = phutMatTrongKhung_(khung, dung);
    const veKhoang = {};
    (veTheoMay[MA] || []).forEach(function (v) {
      const lich = lichTheoNgay[v.ngay];
      if (!lich || !v.gioVe) return;
      const coTang = !!tangCa[MA + '|' + v.ngay];
      const ca = caThatCuaVeGiuaCa_(v.ca, v.gioVe, lich, coTang, gioTC);
      if (ca === CA_TANG_CA && !coTang) return;   // tăng ca đã bỏ → lượt này không còn nghĩa
      if (ca === MA_CA.DEM && coTang) return;     // có tăng ca thì không có ca đêm
      const kq = tinhVeGiuaCa_(lich, ca, v.gioVe, v.gioQuayLai, gioTC, nghiDem);
      if (!kq.ok) return;
      (veKhoang[v.lyDo] = veKhoang[v.lyDo] || []).push(
        { tu: ngayGioTuPhut_(v.ngay, kq.veLuc), den: ngayGioTuPhut_(v.ngay, kq.denLuc) });
    });
    // Ca đêm không chạy sau tăng ca (tổ CHAY) là hao hụt cùng nhóm với về giữa ca, gom theo lý do.
    thieuDem.forEach(function (k) {
      (veKhoang[k.lyDo] = veKhoang[k.lyDo] || []).push({ tu: k.tu, den: k.den });
    });
    let tichLuy = dung.slice();
    let daMat = phutDungMay;
    Object.keys(veKhoang).sort().forEach(function (lyDo) {
      tichLuy = tichLuy.concat(veKhoang[lyDo]);
      const moi = phutMatTrongKhung_(khung, tichLuy);
      veTheoLyDoTo[lyDo] = (veTheoLyDoTo[lyDo] || 0) + (moi - daMat);
      daMat = moi;
    });

    const kh = Math.round(phutKeHoach);
    const dungR = Math.min(kh, Math.round(phutDungMay));
    const veR = Math.min(kh - dungR, Math.max(0, Math.round(daMat) - dungR));
    return {
      maMay: ma, tenMay: String(m.tenMay || '').trim(),
      luotApDung: luotApDung, luotChay: luotChay,
      phutKeHoach: kh, phutDungMay: dungR, phutVeGiuaCa: veR, phutChay: kh - dungR - veR,
    };
  });

  Object.keys(veTheoLyDoTo).forEach(function (k) { veTheoLyDoTo[k] = Math.round(veTheoLyDoTo[k]); });
  const tong = tongHopChiSo_(may);
  return { boPhan: bp, tuan: tuan, may: may, tong: tong, veTheoLyDo: veTheoLyDoTo, thieuLich: thieuLich };
}

/** Cộng các dòng máy (hoặc các tổng con) thành một tổng + hai tỷ lệ. Hàm THUẦN. */
function tongHopChiSo_(ds) {
  const t = { soMay: 0, luotApDung: 0, luotChay: 0, phutKeHoach: 0, phutDungMay: 0, phutVeGiuaCa: 0, phutChay: 0 };
  ds.forEach(function (x) {
    t.soMay += x.soMay === undefined ? 1 : x.soMay;
    t.luotApDung += x.luotApDung;
    t.luotChay += x.luotChay;
    t.phutKeHoach += x.phutKeHoach;
    t.phutDungMay += x.phutDungMay;
    t.phutVeGiuaCa += x.phutVeGiuaCa;
    t.phutChay += x.phutChay;
  });
  t.tiLeHuyDong = t.luotApDung > 0 ? t.luotChay / t.luotApDung : null;
  t.hieuSuat = t.phutKeHoach > 0 ? t.phutChay / t.phutKeHoach : null;
  return t;
}

/** Đọc sheet rồi tính cho một tổ. Tách riêng để RPC và báo cáo dùng chung; mọi trường tiêm được. */
function chiSoTuanCuaTo_(boPhan, tuan, dulieu) {
  const d = dulieu || {};
  const bp = String(boPhan).trim().toUpperCase();
  return tinhChiSoTuan_({
    boPhan: bp, tuan: tuan, bayGio: d.bayGio || nowVN_(),
    cauHinh: d.cauHinh || docCauHinh_(),
    dsMay: dsMayCuaBoPhan_(bp, d.dsMay),
    dsLich: d.dsLich || docSheet_(SHEET.LICH_TO, HEADER_LICH_TO),
    dsKeHoach: d.dsKeHoach || docSheet_(SHEET.KE_HOACH_MAY, HEADER_KE_HOACH_MAY),
    dsPhieu: d.dsPhieu || docSuCoVaLuuTru_(),
  });
}

/** RPC cho trang tổ trưởng: hai chỉ số của CHÍNH tổ mình trong tuần `tuanBatDau`. */
function layChiSoTuan(boPhan, token, tuanBatDau) {
  try {
    const to = xacThucTo_(boPhan, token);
    if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };
    const tuan = chuanHoaNgay_(tuanBatDau);
    if (!tuan) return { ok: false, error: 'Tuần không hợp lệ.' };
    const kq = chiSoTuanCuaTo_(String(to.Bo_Phan).trim(), tuan);
    return { ok: true, tuan: tuan, tong: kq.tong, may: kq.may, veTheoLyDo: kq.veTheoLyDo, thieuLich: kq.thieuLich };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================================
// BÁO CÁO TOÀN NHÀ MÁY (menu) — xuất ra một Google Sheet mới
// ============================================================================

/** Thứ Hai của tuần chứa ngày người dùng nhập ('yyyy-MM-dd' hoặc 'dd/MM/yyyy'); trống = tuần này. null nếu sai. */
function tuanTuNgayNhap_(s, homNay) {
  const x = String(s || '').trim();
  if (!x) return thuHaiCuaNgay_(homNay);
  let ymd = null;
  let m = x.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) ymd = m[1] + '-' + pad2_(Number(m[2])) + '-' + pad2_(Number(m[3]));
  m = x.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) ymd = m[3] + '-' + pad2_(Number(m[2])) + '-' + pad2_(Number(m[1]));
  if (!ymd || isNaN(new Date(ymd + 'T00:00:00Z').getTime())) return null;
  return thuHaiCuaNgay_(ymd);
}

/** Tính mọi tổ của tuần `tuan`, kèm tổng toàn nhà máy. */
function chiSoToanNhaMay_(tuan, dulieu) {
  const d = Object.assign({}, dulieu || {});
  d.bayGio = d.bayGio || nowVN_();
  d.cauHinh = d.cauHinh || docCauHinh_();
  d.dsMay = d.dsMay || docSheet_(SHEET.MAY, HEADER_MAY);
  d.dsLich = d.dsLich || docSheet_(SHEET.LICH_TO, HEADER_LICH_TO);
  d.dsKeHoach = d.dsKeHoach || docSheet_(SHEET.KE_HOACH_MAY, HEADER_KE_HOACH_MAY);
  d.dsPhieu = d.dsPhieu || docSuCoVaLuuTru_();

  const dsBp = {};
  d.dsMay.forEach(function (m) {
    const b = String(m.Bo_Phan || '').trim().toUpperCase();
    if (b && laTrue_(m.Hoat_Dong)) dsBp[b] = true;
  });
  const dsTo = Object.keys(dsBp).sort().map(function (b) { return chiSoTuanCuaTo_(b, tuan, d); });
  const veTheoLyDo = {};
  dsTo.forEach(function (t) {
    Object.keys(t.veTheoLyDo).forEach(function (k) { veTheoLyDo[k] = (veTheoLyDo[k] || 0) + t.veTheoLyDo[k]; });
  });
  return { tuan: tuan, to: dsTo, tong: tongHopChiSo_(dsTo.map(function (t) { return t.tong; })), veTheoLyDo: veTheoLyDo };
}

const SO_COT_HUY_DONG = 9;

function menuBaoCaoHuyDong() {
  const ui = SpreadsheetApp.getUi();
  const homNay = fmtNgay_(nowVN_());
  const kq = ui.prompt('Báo cáo huy động / hiệu suất máy (theo tuần)',
    'Nhập một ngày bất kỳ trong tuần cần báo cáo (dd/MM/yyyy hoặc yyyy-MM-dd).\nĐể trống = tuần này.',
    ui.ButtonSet.OK_CANCEL);
  if (kq.getSelectedButton() !== ui.Button.OK) return;
  chayVaBao_('Báo cáo huy động / hiệu suất máy', function () {
    const tuan = tuanTuNgayNhap_(kq.getResponseText(), homNay);
    if (!tuan) throw new Error('Ngày không hợp lệ.');
    const r = xuatBaoCaoHuyDong(tuan);
    return 'Đã tạo file:\n' + r.tenFile + '\n\n' + r.url;
  });
}

/** Tạo một Google Sheet mới chứa báo cáo huy động / hiệu suất của tuần `tuan` (thứ Hai). */
function xuatBaoCaoHuyDong(tuan) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(tuan))) throw new Error('Tuần phải dạng yyyy-MM-dd.');
  const kq = chiSoToanNhaMay_(tuan);
  if (!kq.to.length) throw new Error('Không có máy đang hoạt động.');
  const tenFile = 'Bao_cao_huy_dong_tuan_' + tuan;
  const ssMoi = SpreadsheetApp.create(tenFile);
  const sh = ssMoi.getSheets()[0];
  sh.setName('Huy_Dong_Tuan');
  ghiBaoCaoHuyDong_(sh, kq);
  ssMoi.setActiveSheet(sh);
  SpreadsheetApp.flush();
  return { ok: true, url: ssMoi.getUrl(), tenFile: tenFile, soTo: kq.to.length };
}

/** Dựng bảng dữ liệu báo cáo (hàm THUẦN, test được). Trả { bang, dongHeader, dongTieuDe }. */
function bangBaoCaoHuyDong_(kq, luc) {
  const bang = [], dongHeader = [], dongTieuDe = [];
  const them = function (r) {
    const x = (r || []).slice(0, SO_COT_HUY_DONG);
    while (x.length < SO_COT_HUY_DONG) x.push('');
    bang.push(x);
    return bang.length;
  };
  const tl = function (v) { return v === null ? '—' : v; };
  const gio = function (p) { return phutSangGio_(p); };
  const cotTieuDe = ['Bộ phận', 'Số máy', 'Lượt áp dụng', 'Lượt bố trí chạy', 'Huy động',
    'Kế hoạch (giờ)', 'Dừng máy (giờ)', 'Về giữa ca (giờ)', 'Hiệu suất'];

  const ngayCuoi = ymdCongNgay_(kq.tuan, 6);
  them(['BÁO CÁO HUY ĐỘNG VÀ HIỆU SUẤT MÁY THEO TUẦN']);
  them(['Tuần ' + kq.tuan.slice(8) + '/' + kq.tuan.slice(5, 7) + ' – ' + ngayCuoi.slice(8) + '/' + ngayCuoi.slice(5, 7) +
    '/' + ngayCuoi.slice(0, 4), '', '', '', '', '', '', 'Xuất lúc', luc || '']);
  them(['Huy động = lượt bố trí chạy / lượt áp dụng (máy có được đem ra chạy không). ' +
    'Hiệu suất = 1 − (dừng máy + về giữa ca + ca đêm thiếu thợ sau tăng ca) / kế hoạch của các lượt đã bố trí chạy (máy đã chạy thì chạy tốt không). ' +
    'Hai chỉ số không gộp.']);
  them([]);

  dongTieuDe.push(them(['TỔNG TOÀN NHÀ MÁY']));
  dongHeader.push(them(cotTieuDe));
  const t = kq.tong;
  them(['Toàn nhà máy', t.soMay, t.luotApDung, t.luotChay, tl(t.tiLeHuyDong),
    gio(t.phutKeHoach), gio(t.phutDungMay), gio(t.phutVeGiuaCa), tl(t.hieuSuat)]);
  them([]);

  dongTieuDe.push(them(['THEO TỔ']));
  dongHeader.push(them(cotTieuDe));
  const dongDauTo = bang.length + 1;
  kq.to.forEach(function (x) {
    const c = x.tong;
    them([x.boPhan + (x.thieuLich ? ' (thiếu lịch)' : ''), c.soMay, c.luotApDung, c.luotChay, tl(c.tiLeHuyDong),
      gio(c.phutKeHoach), gio(c.phutDungMay), gio(c.phutVeGiuaCa), tl(c.hieuSuat)]);
  });
  them([]);

  const lyDo = Object.keys(kq.veTheoLyDo).sort();
  if (lyDo.length) {
    dongTieuDe.push(them(['VỀ GIỮA CA / CA ĐÊM THIẾU THỢ THEO LÝ DO (giờ, đã trừ phần trùng dừng máy)']));
    lyDo.forEach(function (k) { them([k, '', '', '', '', '', '', gio(kq.veTheoLyDo[k])]); });
    them([]);
  }

  kq.to.forEach(function (x) {
    dongTieuDe.push(them(['TỔ ' + x.boPhan + ' — TỪNG MÁY']));
    dongHeader.push(them(['Mã máy', 'Tên máy', 'Lượt áp dụng', 'Lượt bố trí chạy', 'Huy động',
      'Kế hoạch (giờ)', 'Dừng máy (giờ)', 'Về giữa ca (giờ)', 'Hiệu suất']));
    x.may.slice().sort(function (a, b) {
      const ha = a.phutKeHoach > 0 ? a.phutChay / a.phutKeHoach : 2;
      const hb = b.phutKeHoach > 0 ? b.phutChay / b.phutKeHoach : 2;
      return ha - hb || String(a.maMay).localeCompare(String(b.maMay));
    }).forEach(function (m) {
      them([m.maMay, m.tenMay, m.luotApDung, m.luotChay, m.luotApDung > 0 ? m.luotChay / m.luotApDung : '—',
        gio(m.phutKeHoach), gio(m.phutDungMay), gio(m.phutVeGiuaCa),
        m.phutKeHoach > 0 ? m.phutChay / m.phutKeHoach : '—']);
    });
    them([]);
  });
  return { bang: bang, dongHeader: dongHeader, dongTieuDe: dongTieuDe, dongDauTo: dongDauTo };
}

function ghiBaoCaoHuyDong_(sh, kq) {
  const b = bangBaoCaoHuyDong_(kq, Utilities.formatDate(nowVN_(), CONFIG.MUI_GIO, 'HH:mm dd/MM/yyyy'));
  sh.getRange(1, 1, b.bang.length, SO_COT_HUY_DONG).setValues(b.bang);
  sh.getDataRange().setFontFamily('Arial').setFontSize(10).setVerticalAlignment('middle').setWrap(true);
  sh.getRange(1, 1, 1, SO_COT_HUY_DONG).merge().setFontSize(16).setFontWeight('bold')
    .setFontColor('#17324d').setBackground('#dceeff').setHorizontalAlignment('center');
  sh.getRange(3, 1, 1, SO_COT_HUY_DONG).merge().setFontColor('#52606d');
  b.dongTieuDe.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_HUY_DONG).setFontWeight('bold').setFontColor('#17324d').setFontSize(12);
  });
  b.dongHeader.forEach(function (d) {
    sh.getRange(d, 1, 1, SO_COT_HUY_DONG).setFontWeight('bold').setBackground('#eaf2f8').setHorizontalAlignment('center')
      .setBorder(true, true, true, true, true, true, '#c9d6e2', SpreadsheetApp.BorderStyle.SOLID);
  });
  // Hai cột tỷ lệ luôn là cột 5 và 9 ở mọi bảng — định dạng phần trăm cho cả cột, ô chữ không bị ảnh hưởng.
  sh.getRange(1, 5, b.bang.length, 1).setNumberFormat('0.0%');
  sh.getRange(1, 9, b.bang.length, 1).setNumberFormat('0.0%');
  sh.setColumnWidth(1, 150);
  sh.setColumnWidth(2, 210);
  for (let c = 3; c <= SO_COT_HUY_DONG; c++) sh.setColumnWidth(c, 105);
}
