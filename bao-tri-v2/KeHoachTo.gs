/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * TỔ TRƯỞNG KHAI KẾ HOẠCH MÁY — xem TASK_KE_HOACH_TO_TRUONG.md để biết đầy đủ
 * thiết kế, lý do, và các quyết định đã chốt (schema, mô hình chỉ lưu ngoại lệ,
 * lộ trình từng bước).
 *
 * Route: ?page=kehoach&to=<Bo_Phan>&token=<token>
 *
 * ĐỘC LẬP hoàn toàn với luồng thợ (LuongTho.gs): không dùng chung cột Token,
 * không dùng chung hàm xác thực. Không đụng Su_Co, HieuDung.gs, Ke_Hoach_Chay_May.
 */

// ============================================================================
// 1. XÁC THỰC
// ============================================================================

/**
 * Kiểm tra cặp bộ phận + token của link tổ trưởng.
 * Trả về dòng Danh_Muc_To, hoặc null nếu sai/không còn hoạt động.
 *
 * dsTo: tiêm sẵn dữ liệu cho Test.gs — không đụng sheet khi kiểm thử. Thiếu thì
 * tự đọc Danh_Muc_To, đúng lối getOnDutyContacts_ ở CongNhan.gs.
 */
function xacThucTo_(boPhan, token, dsTo) {
  const bp = String(boPhan || '').trim().toUpperCase();
  const tk = String(token || '').trim();
  if (!bp || !tk) return null;

  const ds = dsTo || docSheet_(SHEET.TO, HEADER_TO);
  for (let i = 0; i < ds.length; i++) {
    if (String(ds[i].Bo_Phan).trim().toUpperCase() === bp &&
        String(ds[i].Token).trim() === tk &&
        laTrue_(ds[i].Hoat_Dong)) {
      return ds[i];
    }
  }
  return null;
}

// ============================================================================
// 2. ROUTE
// ============================================================================

/**
 * Render trang tổ trưởng. Sai token → trang thông báo, KHÔNG render form —
 * vì access = ANYONE_ANONYMOUS, đây là lớp chặn duy nhất ở tầng route; mọi RPC
 * ghi/đọc bên dưới vẫn phải tự gọi lại xacThucTo_ (không có gì chặn hộ).
 *
 * Bước 2/8: chỉ dựng khung xác thực + trang rỗng. Form thật (chọn tuần, danh
 * sách máy, thao tác hàng loạt) làm ở bước 6-7.
 */
function renderTrangKeHoach_(p) {
  const to = xacThucTo_(p.to, p.token);
  if (!to) {
    return trangThongBao_('Không có quyền truy cập',
      'Link không hợp lệ hoặc đã bị khoá. Liên hệ quản trị để được cấp lại link.');
  }
  return renderTrang_('ToTruong', 'Kế hoạch tuần — ' + (String(to.Ten_To || '').trim() || String(to.Bo_Phan).trim()), {
    boPhan: String(to.Bo_Phan).trim(),
    token: String(to.Token).trim(),
    tenTo: String(to.Ten_To || '').trim(),
  });
}

// ============================================================================
// 3. DANH SÁCH MÁY CỦA TỔ
// ============================================================================

/**
 * Máy Hoat_Dong=TRUE thuộc đúng boPhan, dạng gọn cho client.
 * dsMay: tiêm cho test, mặc định đọc Danh_Muc_May.
 */
function dsMayCuaBoPhan_(boPhan, dsMay) {
  const bp = String(boPhan || '').trim().toUpperCase();
  const ds = dsMay || docSheet_(SHEET.MAY, HEADER_MAY);
  return ds
    .filter(function (m) {
      return String(m.Bo_Phan).trim().toUpperCase() === bp && laTrue_(m.Hoat_Dong);
    })
    .map(function (m) {
      return { maMay: String(m.Ma_May).trim(), tenMay: String(m.Ten_May).trim() };
    });
}

// ============================================================================
// 4. LỊCH LÀM VIỆC CỦA TỔ
// ============================================================================

/**
 * Chuẩn hoá giá trị ngày đọc từ ô sheet về 'yyyy-MM-dd'. Cột Ap_Dung_Tu đã đặt
 * định dạng text ở setupSystem(), nhưng vẫn xử lý cả Date phòng khi người dùng
 * dán giá trị kiểu ngày — đúng lối chuanHoaGio_ đã dùng cho cột giờ.
 */
function chuanHoaNgay_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return fmtNgay_(v);
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

/**
 * Dòng Lich_Lam_Viec_To hiện hành của boPhan tại ngày `ngay` ('yyyy-MM-dd'):
 * Ap_Dung_Tu LỚN NHẤT mà vẫn <= ngay. Trả null nếu tổ chưa khai lịch nào —
 * tầng gọi phải tự xử lý ca "chưa khai", không suy diễn giờ mặc định.
 *
 * dsLich: tiêm cho test, mặc định đọc Lich_Lam_Viec_To.
 */
function lichHienHanhCuaTo_(boPhan, ngay, dsLich) {
  const bp = String(boPhan || '').trim().toUpperCase();
  const ds = dsLich || docSheet_(SHEET.LICH_TO, HEADER_LICH_TO);

  let ketQua = null;
  ds.forEach(function (r) {
    if (String(r.Bo_Phan).trim().toUpperCase() !== bp) return;
    const apDung = chuanHoaNgay_(r.Ap_Dung_Tu);
    if (!apDung || apDung > ngay) return;
    if (!ketQua || apDung > ketQua.Ap_Dung_Tu) {
      ketQua = {
        Bo_Phan: bp,
        Ap_Dung_Tu: apDung,
        Ca_Ngay_Tu: chuanHoaGio_(r.Ca_Ngay_Tu),
        Ca_Ngay_Den: chuanHoaGio_(r.Ca_Ngay_Den),
        Co_Nghi_Trua: laTrue_(r.Co_Nghi_Trua),
        Nghi_Trua_Tu: chuanHoaGio_(r.Nghi_Trua_Tu),
        Nghi_Trua_Den: chuanHoaGio_(r.Nghi_Trua_Den),
        Co_Ca_Dem: laTrue_(r.Co_Ca_Dem),
        Ca_Dem_Tu: chuanHoaGio_(r.Ca_Dem_Tu),
        Ca_Dem_Den: chuanHoaGio_(r.Ca_Dem_Den),
      };
    }
  });
  return ketQua;
}

// ============================================================================
// 5. RPC — KHỞI TẠO TRANG TỔ TRƯỞNG
// ============================================================================

/**
 * Dữ liệu khởi tạo trang tổ trưởng: thông tin tổ + lịch làm việc hiện hành +
 * danh sách máy — GỘP MỘT RPC để giảm round-trip google.script.run, đúng lối
 * getWorkerBootstrap()/getDanhMuc() đã dùng ở nơi khác trong hệ thống.
 *
 * Vì access = ANYONE_ANONYMOUS (xem đầu file), hàm PHẢI tự xacThucTo_ — route
 * renderTrangKeHoach_ xác thực để render trang, nhưng không chặn được lời gọi
 * RPC trực tiếp từ client.
 */
function getToTruongBootstrap(boPhan, token) {
  try {
    const to = xacThucTo_(boPhan, token);
    if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

    const bp = String(to.Bo_Phan).trim();
    const homNay = fmtNgay_(nowVN_());

    return {
      ok: true,
      to: {
        boPhan: bp,
        tenTo: String(to.Ten_To || '').trim(),
        tenToTruong: String(to.Ten_To_Truong || '').trim(),
      },
      lich: lichHienHanhCuaTo_(bp, homNay),
      may: dsMayCuaBoPhan_(bp),
      lyDoDongMay: dsLyDoDongMayKeHoach_(),
      lyDoVeGiuaCa: dsLyDoVeGiuaCa_(),
      gioTangCa: gioTangCa_(), // phút từ 00:00 — client tự đổi ra HH:mm để hiện trên modal tăng ca
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================================
// 6. RPC — LƯU LỊCH LÀM VIỆC CỦA TỔ
// ============================================================================

/**
 * Validate + chuẩn hoá payload lịch làm việc thành 1 dòng đúng thứ tự
 * HEADER_LICH_TO. Hàm THUẦN — test được không cần sheet, không cần LockService.
 *
 * payload = {
 *   apDungTu: 'yyyy-MM-dd',
 *   caNgayTu, caNgayDen: 'HH:mm',
 *   coNghiTrua: bool, nghiTruaTu, nghiTruaDen: 'HH:mm' (bắt buộc nếu coNghiTrua),
 *   coCaDem: bool, caDemTu, caDemDen: 'HH:mm' (bắt buộc nếu coCaDem),
 *   ghiChu,
 * }
 *
 * Cap_Nhat_Luc CỐ Ý không gán ở đây (phụ thuộc đồng hồ hệ thống) — hàm gọi
 * (luuLichLamViec) tự gán lúc ghi thật, để hàm này test tất định được.
 */
function chuanHoaPayloadLichTo_(boPhan, payload) {
  const p = payload || {};

  const apDungTu = chuanHoaNgay_(p.apDungTu);
  if (!apDungTu) return { ok: false, error: 'Ngày áp dụng không hợp lệ.' };

  const caNgayTu = chuanHoaGio_(p.caNgayTu);
  const caNgayDen = chuanHoaGio_(p.caNgayDen);
  if (!caNgayTu || !caNgayDen) return { ok: false, error: 'Thiếu giờ ca ngày.' };

  const coNghiTrua = !!p.coNghiTrua;
  const nghiTruaTu = coNghiTrua ? chuanHoaGio_(p.nghiTruaTu) : '';
  const nghiTruaDen = coNghiTrua ? chuanHoaGio_(p.nghiTruaDen) : '';
  if (coNghiTrua && (!nghiTruaTu || !nghiTruaDen)) {
    return { ok: false, error: 'Đã chọn có nghỉ trưa thì phải nhập đủ giờ bắt đầu/kết thúc.' };
  }

  const coCaDem = !!p.coCaDem;
  const caDemTu = coCaDem ? chuanHoaGio_(p.caDemTu) : '';
  const caDemDen = coCaDem ? chuanHoaGio_(p.caDemDen) : '';
  if (coCaDem && (!caDemTu || !caDemDen)) {
    return { ok: false, error: 'Đã chọn có ca đêm thì phải nhập đủ giờ bắt đầu/kết thúc.' };
  }

  const dong = new Array(HEADER_LICH_TO.length).fill('');
  dong[HEADER_LICH_TO.indexOf('Bo_Phan')] = String(boPhan).trim().toUpperCase();
  dong[HEADER_LICH_TO.indexOf('Ap_Dung_Tu')] = apDungTu;
  dong[HEADER_LICH_TO.indexOf('Ca_Ngay_Tu')] = caNgayTu;
  dong[HEADER_LICH_TO.indexOf('Ca_Ngay_Den')] = caNgayDen;
  dong[HEADER_LICH_TO.indexOf('Co_Nghi_Trua')] = coNghiTrua;
  dong[HEADER_LICH_TO.indexOf('Nghi_Trua_Tu')] = nghiTruaTu;
  dong[HEADER_LICH_TO.indexOf('Nghi_Trua_Den')] = nghiTruaDen;
  dong[HEADER_LICH_TO.indexOf('Co_Ca_Dem')] = coCaDem;
  dong[HEADER_LICH_TO.indexOf('Ca_Dem_Tu')] = caDemTu;
  dong[HEADER_LICH_TO.indexOf('Ca_Dem_Den')] = caDemDen;
  dong[HEADER_LICH_TO.indexOf('Ghi_Chu')] = String(p.ghiChu || '').trim().slice(0, 300);

  return { ok: true, dong: dong, apDungTu: apDungTu };
}

/**
 * Chỉ số dòng (0-based, trong `vung` — vùng dữ liệu KHÔNG kể header) đã có
 * cùng Bo_Phan + Ap_Dung_Tu để SỬA ĐÈ, hoặc -1 nếu chưa có (cần THÊM DÒNG MỚI,
 * giữ nguyên mọi dòng Ap_Dung_Tu khác — đây là chỗ bảo đảm "đổi lịch không ghi
 * đè lịch cũ"). Hàm THUẦN — test được không cần sheet.
 */
function timDongLichTrungApDung_(vung, boPhan, apDungTu) {
  const bp = String(boPhan).trim().toUpperCase();
  const iBoPhan = HEADER_LICH_TO.indexOf('Bo_Phan');
  const iApDung = HEADER_LICH_TO.indexOf('Ap_Dung_Tu');
  for (let i = 0; i < vung.length; i++) {
    if (String(vung[i][iBoPhan]).trim().toUpperCase() === bp &&
        chuanHoaNgay_(vung[i][iApDung]) === apDungTu) {
      return i;
    }
  }
  return -1;
}

/**
 * Lưu lịch làm việc của tổ. Bấm Lưu lại đúng cùng Ap_Dung_Tu (kể cả do mạng
 * chậm bấm 2 lần) → SỬA ĐÈ đúng dòng đó, không sinh dòng trùng — khoá tự nhiên
 * là (Bo_Phan, Ap_Dung_Tu), không cần thêm cột Request_ID cho sheet này.
 *
 * Vì access = ANYONE_ANONYMOUS, hàm PHẢI tự xacThucTo_ (không có gì chặn hộ).
 * bp luôn lấy từ BẢN GHI ĐÃ XÁC THỰC (to.Bo_Phan), không tin boPhan client gửi
 * lên — chặn link DET sửa lịch bộ phận khác dù có sửa tham số trên URL.
 */
function luuLichLamViec(boPhan, token, payload) {
  const to = xacThucTo_(boPhan, token);
  if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

  const bp = String(to.Bo_Phan).trim();
  const chuan = chuanHoaPayloadLichTo_(bp, payload);
  if (!chuan.ok) return chuan;

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    // KHÔNG dùng sh.getLastRow(): datCheckbox_ (Co_Nghi_Trua/Co_Ca_Dem) áp
    // validation checkbox lên cả vùng sh.getMaxRows()-1 dòng, khiến các ô
    // checkbox còn trống bị Sheets coi là FALSE — getLastRow() báo sai, dòng
    // ghi thêm sẽ lạc xuống dòng ~1000. Xem soDongCoDuLieu_ trong Code.gs.
    const sh = sheet_(SHEET.LICH_TO);
    const soDong = soDongCoDuLieu_(sh, HEADER_LICH_TO.indexOf('Bo_Phan') + 1);
    const vung = soDong > 0 ? sh.getRange(2, 1, soDong, HEADER_LICH_TO.length).getValues() : [];

    const dong = chuan.dong.slice();
    dong[HEADER_LICH_TO.indexOf('Cap_Nhat_Luc')] = nowVN_();

    const iTrung = timDongLichTrungApDung_(vung, bp, chuan.apDungTu);
    if (iTrung >= 0) {
      sh.getRange(iTrung + 2, 1, 1, HEADER_LICH_TO.length).setValues([dong]);
    } else {
      sh.getRange(soDong + 2, 1, 1, HEADER_LICH_TO.length).setValues([dong]);
    }

    return { ok: true, apDungTu: chuan.apDungTu };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 7. KẾ HOẠCH MÁY THEO TUẦN — chỉ lưu NGOẠI LỆ (máy Đóng máy)
// ============================================================================
//
// Máy không có dòng ngoại lệ trong tuần = mặc định Bố trí chạy. Payload chỉ
// gửi phần NGOẠI LỆ (đóng máy) — "áp dụng cả tuần" là việc CLIENT tự bung
// thành nhiều dòng {ngay, ca} trước khi gửi, server luôn xử lý danh sách
// slot cụ thể, không có khái niệm "cả tuần" ở tầng RPC.
//
// Trang_Thai = DA_KHAI là dòng CHỐT TUẦN (Ma_May để trống), ghi mỗi lần lưu
// kể cả không có ngoại lệ nào, để phân biệt "0 ngoại lệ vì cả tuần chạy" với
// "chưa ai khai tuần này". Xem TASK_KE_HOACH_TO_TRUONG.md mục 5.

/** Ngày 'yyyy-MM-dd' có nằm trong khoảng [tuanBatDau, tuanBatDau+6] không. Hàm THUẦN. */
function ngayTrongTuan_(tuanBatDau, ngay) {
  const d0 = new Date(tuanBatDau + 'T00:00:00+07:00');
  const d1 = new Date(ngay + 'T00:00:00+07:00');
  const soNgay = Math.round((d1.getTime() - d0.getTime()) / 86400000);
  return soNgay >= 0 && soNgay <= 6;
}

/**
 * Validate + chuẩn hoá MỘT ngoại lệ (một máy đóng, một ngày, một ca) thành 1
 * dòng đúng thứ tự HEADER_KE_HOACH_MAY. Hàm THUẦN.
 *
 * item = { maMay, ngay: 'yyyy-MM-dd', ca: 'N'|'D', lyDo, ghiChu }
 */
function chuanHoaNgoaiLe_(item, boPhan, tuanBatDau, dsLyDoHopLe) {
  const p = item || {};
  const maMay = String(p.maMay || '').trim().toUpperCase();
  if (!maMay) return { ok: false, error: 'Thiếu mã máy.' };

  const ngay = chuanHoaNgay_(p.ngay);
  if (!ngay) return { ok: false, error: 'Ngày không hợp lệ cho máy ' + maMay + '.' };
  if (!ngayTrongTuan_(tuanBatDau, ngay)) {
    return { ok: false, error: 'Ngày ' + ngay + ' (máy ' + maMay + ') không thuộc tuần ' + tuanBatDau + '.' };
  }

  const ca = String(p.ca || '').trim().toUpperCase();
  if (ca !== MA_CA.NGAY && ca !== MA_CA.DEM) {
    return { ok: false, error: 'Ca không hợp lệ cho máy ' + maMay + '.' };
  }

  const lyDo = String(p.lyDo || '').trim();
  if (!lyDo) return { ok: false, error: 'Máy ' + maMay + ' đóng máy phải chọn lý do.' };
  if (dsLyDoHopLe && dsLyDoHopLe.indexOf(lyDo) === -1) {
    return { ok: false, error: 'Lý do "' + lyDo + '" (máy ' + maMay + ') không có trong danh sách cho phép.' };
  }

  const ghiChu = String(p.ghiChu || '').trim().slice(0, 300);
  if (lyDo === 'Khác' && !ghiChu) {
    return { ok: false, error: 'Máy ' + maMay + ' chọn lý do "Khác" phải nhập ghi chú.' };
  }

  const dong = new Array(HEADER_KE_HOACH_MAY.length).fill('');
  dong[HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau')] = tuanBatDau;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ngay')] = ngay;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ca')] = ca;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ma_May')] = maMay;
  dong[HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')] = String(boPhan).trim().toUpperCase();
  dong[HEADER_KE_HOACH_MAY.indexOf('Trang_Thai')] = TRANG_THAI_KE_HOACH_MAY.DONG;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ly_Do')] = lyDo;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ghi_Chu')] = ghiChu;

  return { ok: true, dong: dong, maMay: maMay, ngay: ngay, ca: ca };
}

/**
 * Validate + chuẩn hoá TOÀN BỘ danh sách ngoại lệ của một lần lưu tuần. Hàm
 * THUẦN. dsMayHopLe: map { MA_MAY: true } các máy thuộc đúng bộ phận — chặn
 * tổ này đóng máy của tổ khác dù client có gửi sai.
 */
function chuanHoaDanhSachNgoaiLe_(dsRaw, boPhan, tuanBatDau, dsMayHopLe, dsLyDoHopLe) {
  const ds = Array.isArray(dsRaw) ? dsRaw : [];
  const dsDong = [];
  const daThay = {}; // chống khai trùng (Ngay, Ca, Ma_May) NGAY TRONG một payload

  for (let i = 0; i < ds.length; i++) {
    const chuan = chuanHoaNgoaiLe_(ds[i], boPhan, tuanBatDau, dsLyDoHopLe);
    if (!chuan.ok) return chuan;

    if (dsMayHopLe && !dsMayHopLe[chuan.maMay]) {
      return { ok: false, error: 'Máy ' + chuan.maMay + ' không thuộc bộ phận này.' };
    }

    const khoa = chuan.ngay + '|' + chuan.ca + '|' + chuan.maMay;
    if (daThay[khoa]) {
      return {
        ok: false,
        error: 'Máy ' + chuan.maMay + ' bị khai trùng ngày ' + chuan.ngay + ', ca ' + chuan.ca + '.',
      };
    }
    daThay[khoa] = true;

    dsDong.push(chuan.dong);
  }

  return { ok: true, dsDong: dsDong };
}

/**
 * Validate + chuẩn hoá MỘT lượt tăng ca (một máy, một ngày) thành 1 dòng đúng thứ
 * tự HEADER_KE_HOACH_MAY, Trang_Thai = TANG_CA. Hàm THUẦN.
 *
 * Tăng ca chỉ áp cho CA NGÀY (bộ phận chỉ chạy ca ngày mới tăng ca) nên Ca luôn
 * là 'N' và client không gửi ca. Không có lý do — tăng ca không cần giải trình.
 *
 * item = { maMay, ngay: 'yyyy-MM-dd' }
 */
function chuanHoaTangCa_(item, boPhan, tuanBatDau) {
  const p = item || {};
  const maMay = String(p.maMay || '').trim().toUpperCase();
  if (!maMay) return { ok: false, error: 'Thiếu mã máy (tăng ca).' };

  const ngay = chuanHoaNgay_(p.ngay);
  if (!ngay) return { ok: false, error: 'Ngày tăng ca không hợp lệ cho máy ' + maMay + '.' };
  if (!ngayTrongTuan_(tuanBatDau, ngay)) {
    return { ok: false, error: 'Ngày tăng ca ' + ngay + ' (máy ' + maMay + ') không thuộc tuần ' + tuanBatDau + '.' };
  }

  const dong = new Array(HEADER_KE_HOACH_MAY.length).fill('');
  dong[HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau')] = tuanBatDau;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ngay')] = ngay;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ca')] = MA_CA.NGAY;
  dong[HEADER_KE_HOACH_MAY.indexOf('Ma_May')] = maMay;
  dong[HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')] = String(boPhan).trim().toUpperCase();
  dong[HEADER_KE_HOACH_MAY.indexOf('Trang_Thai')] = TRANG_THAI_KE_HOACH_MAY.TANG_CA;

  return { ok: true, dong: dong, maMay: maMay, ngay: ngay };
}

/**
 * Validate + chuẩn hoá TOÀN BỘ danh sách tăng ca của một lần lưu tuần. Hàm THUẦN.
 *
 * Ba luật:
 *  - máy phải thuộc đúng bộ phận (dsMayHopLe), như ngoại lệ đóng máy;
 *  - không khai trùng (máy, ngày) trong cùng payload;
 *  - MỘT MÁY-NGÀY CHỈ CÓ MỘT TRẠNG THÁI: máy đang bị đóng ca ngày của đúng ngày đó
 *    thì không tăng ca được (dsDongNgoaiLe = các dòng ngoại lệ đã chuẩn hoá của
 *    payload này). Không âm thầm bỏ một trong hai — báo lỗi để tổ trưởng chọn lại,
 *    vì hiệu suất của lượt đó sẽ vô nghĩa nếu vừa đóng vừa tăng ca.
 */
function chuanHoaDanhSachTangCa_(dsRaw, boPhan, tuanBatDau, dsMayHopLe, dsDongNgoaiLe) {
  const ds = Array.isArray(dsRaw) ? dsRaw : [];
  const iNgay = HEADER_KE_HOACH_MAY.indexOf('Ngay');
  const iCa = HEADER_KE_HOACH_MAY.indexOf('Ca');
  const iMay = HEADER_KE_HOACH_MAY.indexOf('Ma_May');

  const dangDong = {};
  (dsDongNgoaiLe || []).forEach(function (d) {
    if (d[iCa] === MA_CA.NGAY) dangDong[d[iMay] + '|' + d[iNgay]] = true;
  });

  const dsDong = [];
  const daThay = {};
  for (let i = 0; i < ds.length; i++) {
    const chuan = chuanHoaTangCa_(ds[i], boPhan, tuanBatDau);
    if (!chuan.ok) return chuan;

    if (dsMayHopLe && !dsMayHopLe[chuan.maMay]) {
      return { ok: false, error: 'Máy ' + chuan.maMay + ' không thuộc bộ phận này.' };
    }

    const khoa = chuan.maMay + '|' + chuan.ngay;
    if (daThay[khoa]) {
      return { ok: false, error: 'Máy ' + chuan.maMay + ' bị khai tăng ca trùng ngày ' + chuan.ngay + '.' };
    }
    daThay[khoa] = true;

    if (dangDong[khoa]) {
      return {
        ok: false,
        error: 'Máy ' + chuan.maMay + ' đang đóng ca ngày ' + chuan.ngay +
          ', không thể tăng ca. Hãy bố trí chạy lại trước.',
      };
    }

    dsDong.push(chuan.dong);
  }

  return { ok: true, dsDong: dsDong };
}

/**
 * Tách vùng dữ liệu HIỆN CÓ của Ke_Hoach_May (không kể header) thành:
 *   tangCaCu — các dòng TANG_CA cũ của đúng (Bo_Phan, Tuan_Bat_Dau) này.
 *   veGiuaCaCu — các dòng VE_GIUA_CA của đúng (Bo_Phan, Tuan_Bat_Dau) này.
 *   giuLai  — mọi dòng KHÔNG thuộc đúng (Bo_Phan, Tuan_Bat_Dau) này, giữ
 *             nguyên, không đụng tới tuần/tổ khác.
 *   daKhaiCu — dòng DA_KHAI cũ của ĐÚNG (Bo_Phan, Tuan_Bat_Dau) này (để so
 *              Request_ID chống double-tap), hoặc null nếu tuần chưa từng khai.
 * Hàm THUẦN — test được không cần sheet.
 */
function tachDuLieuKeHoachTuan_(vung, boPhan, tuanBatDau) {
  const bp = String(boPhan).trim().toUpperCase();
  const iBoPhan = HEADER_KE_HOACH_MAY.indexOf('Bo_Phan');
  const iTuan = HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau');
  const iTrangThai = HEADER_KE_HOACH_MAY.indexOf('Trang_Thai');
  const iReqId = HEADER_KE_HOACH_MAY.indexOf('Request_ID');

  const giuLai = [];
  const tangCaCu = [];
  const veGiuaCaCu = []; // VE_GIUA_CA của tuần này — KHÔNG do trang lưu tuần quản lý, luôn được giữ lại
  let daKhaiCu = null;

  vung.forEach(function (r) {
    const rBp = String(r[iBoPhan]).trim().toUpperCase();
    const rTuan = chuanHoaNgay_(r[iTuan]);
    if (rBp === bp && rTuan === tuanBatDau) {
      if (String(r[iTrangThai]).trim().toUpperCase() === TRANG_THAI_KE_HOACH_MAY.DA_KHAI) {
        daKhaiCu = { requestId: String(r[iReqId] || '').trim() };
      } else if (String(r[iTrangThai]).trim().toUpperCase() === TRANG_THAI_KE_HOACH_MAY.TANG_CA) {
        tangCaCu.push(r);
      } else if (String(r[iTrangThai]).trim().toUpperCase() === TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA) {
        veGiuaCaCu.push(r);
      }
      return; // bỏ khỏi giuLai — sẽ ghi lại bằng dữ liệu mới (đóng ngoài, cùng lượt)
    }
    giuLai.push(r);
  });

  return { giuLai: giuLai, daKhaiCu: daKhaiCu, tangCaCu: tangCaCu, veGiuaCaCu: veGiuaCaCu };
}

// ============================================================================
// 8. RPC — KẾ HOẠCH MÁY THEO TUẦN
// ============================================================================

/**
 * Phân loại các dòng Ke_Hoach_May (dạng object theo header) của đúng (bp, tuan) thành
 * { daKhai, ngoaiLe, tangCa }. TANG_CA KHÔNG được lẫn vào ngoaiLe — client dùng
 * ngoaiLe để vẽ "Đóng máy". Hàm THUẦN.
 */
function phanLoaiDongKeHoach_(dsDong, bp, tuan) {
  let daKhai = false;
  const ngoaiLe = [];
  const tangCa = [];
  const veGiuaCa = [];
  dsDong.forEach(function (r) {
    if (String(r.Bo_Phan).trim().toUpperCase() !== bp) return;
    if (chuanHoaNgay_(r.Tuan_Bat_Dau) !== tuan) return;

    const trangThai = String(r.Trang_Thai).trim().toUpperCase();
    if (trangThai === TRANG_THAI_KE_HOACH_MAY.DA_KHAI) {
      daKhai = true;
      return;
    }
    if (trangThai === TRANG_THAI_KE_HOACH_MAY.TANG_CA) {
      tangCa.push({ maMay: String(r.Ma_May).trim(), ngay: chuanHoaNgay_(r.Ngay) });
      return;
    }
    if (trangThai === TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA) {
      veGiuaCa.push({
        maMay: String(r.Ma_May).trim(),
        ngay: chuanHoaNgay_(r.Ngay),
        ca: String(r.Ca).trim(),
        lyDo: String(r.Ly_Do || '').trim(),
        ghiChu: String(r.Ghi_Chu || '').trim(),
        gioVe: chuanHoaGio_(r.Gio_Ve) || '',
        gioQuayLai: chuanHoaGio_(r.Gio_Quay_Lai) || '',
      });
      return;
    }
    ngoaiLe.push({
      maMay: String(r.Ma_May).trim(),
      ngay: chuanHoaNgay_(r.Ngay),
      ca: String(r.Ca).trim(),
      lyDo: String(r.Ly_Do || '').trim(),
      ghiChu: String(r.Ghi_Chu || '').trim(),
    });
  });
  return { daKhai: daKhai, ngoaiLe: ngoaiLe, tangCa: tangCa, veGiuaCa: veGiuaCa };
}

/** Đọc ngoại lệ + tăng ca + trạng thái "đã khai" của một tuần. */
function layKeHoachTuan(boPhan, token, tuanBatDau) {
  try {
    const to = xacThucTo_(boPhan, token);
    if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

    const bp = String(to.Bo_Phan).trim().toUpperCase();
    const tuan = chuanHoaNgay_(tuanBatDau);
    if (!tuan) return { ok: false, error: 'Tuần không hợp lệ.' };

    const pl = phanLoaiDongKeHoach_(
      docSheet_(SHEET.KE_HOACH_MAY, HEADER_KE_HOACH_MAY), bp, tuan);

    return {
      ok: true, tuanBatDau: tuan, daKhai: pl.daKhai, ngoaiLe: pl.ngoaiLe, tangCa: pl.tangCa,
      veGiuaCa: pl.veGiuaCa,
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Lưu kế hoạch tuần: thay TOÀN BỘ ngoại lệ của đúng (Bo_Phan, Tuan_Bat_Dau)
 * bằng danh sách mới — không đụng dữ liệu tuần/tổ khác.
 *
 * payload = { tuanBatDau: 'yyyy-MM-dd', requestId,
 *              ngoaiLe: [{maMay, ngay, ca, lyDo, ghiChu}],
 *              tangCa:  [{maMay, ngay}] }
 *
 * `tangCa` không phải mảng (client bản cũ không gửi) → GIỮ NGUYÊN tăng ca đã lưu
 * của tuần đó, không xoá nhầm. Là mảng (kể cả rỗng) → thay toàn bộ.
 *
 * Chống double-tap: nếu Request_ID trùng với lần lưu gần nhất của ĐÚNG tuần
 * này (đọc từ dòng DA_KHAI cũ) thì trả kết quả cũ, không ghi lại — bấm Lưu 2
 * lần vì mạng chậm không sinh dữ liệu trùng.
 */
function luuKeHoachTuan(boPhan, token, payload) {
  const to = xacThucTo_(boPhan, token);
  if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

  const bp = String(to.Bo_Phan).trim().toUpperCase();
  const p = payload || {};
  const requestId = String(p.requestId || '').trim();
  if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

  const tuanBatDau = chuanHoaNgay_(p.tuanBatDau);
  if (!tuanBatDau) return { ok: false, error: 'Tuần không hợp lệ.' };

  const dsMayHopLe = {};
  dsMayCuaBoPhan_(bp).forEach(function (m) { dsMayHopLe[m.maMay.toUpperCase()] = true; });

  const chuan = chuanHoaDanhSachNgoaiLe_(
    p.ngoaiLe, bp, tuanBatDau, dsMayHopLe, dsLyDoDongMayKeHoach_());
  if (!chuan.ok) return chuan;

  const guiTangCa = Array.isArray(p.tangCa);
  const chuanTangCa = guiTangCa
    ? chuanHoaDanhSachTangCa_(p.tangCa, bp, tuanBatDau, dsMayHopLe, chuan.dsDong)
    : { ok: true, dsDong: [] };
  if (!chuanTangCa.ok) return chuanTangCa;

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    // KHÔNG dùng sh.getLastRow() — cùng bẫy checkbox đã vá ở bước 4. Neo theo
    // cột Tuan_Bat_Dau vì MỌI dòng thật (kể cả dòng DA_KHAI) đều có cột này.
    const sh = sheet_(SHEET.KE_HOACH_MAY);
    const soDong = soDongCoDuLieu_(sh, HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau') + 1);
    const vung = soDong > 0 ? sh.getRange(2, 1, soDong, HEADER_KE_HOACH_MAY.length).getValues() : [];

    const tach = tachDuLieuKeHoachTuan_(vung, bp, tuanBatDau);

    if (tach.daKhaiCu && tach.daKhaiCu.requestId === requestId) {
      return { ok: true, trung: true, soNgoaiLe: chuan.dsDong.length };
    }

    const luc = nowVN_();
    const nguoiCapNhat = String(to.Ten_To_Truong || to.Ten_To || bp).trim();
    const iNguoiCapNhat = HEADER_KE_HOACH_MAY.indexOf('Nguoi_Cap_Nhat');
    const iCapNhatLuc = HEADER_KE_HOACH_MAY.indexOf('Cap_Nhat_Luc');
    const iReqId = HEADER_KE_HOACH_MAY.indexOf('Request_ID');

    // Client cũ không gửi tangCa → giữ nguyên dòng TANG_CA đã lưu (đã có đủ metadata).
    const dsTangCaGhi = guiTangCa ? chuanTangCa.dsDong : tach.tangCaCu;
    chuan.dsDong.concat(guiTangCa ? chuanTangCa.dsDong : []).forEach(function (dong) {
      dong[iNguoiCapNhat] = nguoiCapNhat;
      dong[iCapNhatLuc] = luc;
      dong[iReqId] = requestId;
    });

    const dongDaKhai = new Array(HEADER_KE_HOACH_MAY.length).fill('');
    dongDaKhai[HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau')] = tuanBatDau;
    dongDaKhai[HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')] = bp;
    dongDaKhai[HEADER_KE_HOACH_MAY.indexOf('Trang_Thai')] = TRANG_THAI_KE_HOACH_MAY.DA_KHAI;
    dongDaKhai[iNguoiCapNhat] = nguoiCapNhat;
    dongDaKhai[iCapNhatLuc] = luc;
    dongDaKhai[iReqId] = requestId;

    // Về giữa ca ghi riêng lúc xảy ra (ghiVeGiuaCa) nên luôn được GIỮ LẠI — trừ lượt nào
    // vừa bị đóng máy đè lên đúng (máy, ngày, ca) đó (một máy-ngày-ca một trạng thái).
    const veGiuaCaGhi = boVeGiuaCaDemBiTangCaDe_(
      boVeGiuaCaBiDongDe_(tach.veGiuaCaCu, chuan.dsDong), dsTangCaGhi);
    const toanBo = tach.giuLai.concat(chuan.dsDong, dsTangCaGhi, veGiuaCaGhi, [dongDaKhai]);

    if (toanBo.length) {
      sh.getRange(2, 1, toanBo.length, HEADER_KE_HOACH_MAY.length).setValues(toanBo);
    }
    if (soDong > toanBo.length) {
      sh.getRange(toanBo.length + 2, 1, soDong - toanBo.length, HEADER_KE_HOACH_MAY.length)
        .clearContent();
    }

    return { ok: true, soNgoaiLe: chuan.dsDong.length, soTangCa: dsTangCaGhi.length };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 8. KHUNG GIỜ KẾ HOẠCH CỦA MỘT MÁY TRONG MỘT NGÀY (thường / tăng ca)
// ============================================================================

/**
 * Trừ danh sách khoảng nghỉ [tu, den] (phút) khỏi một khoảng [tu, den]; trả về
 * các khoảng còn lại theo thứ tự thời gian. Khoảng nghỉ chòm ra ngoài khung được
 * cắt cho vừa, khoảng nghỉ chồng nhau không bị trừ hai lần. Hàm THUẦN.
 */
function truKhoangNghi_(tu, den, dsNghi) {
  const nghi = (dsNghi || [])
    .map(function (k) { return [Math.max(k[0], tu), Math.min(k[1], den)]; })
    .filter(function (k) { return k[1] > k[0]; })
    .sort(function (a, b) { return a[0] - b[0]; });

  const ketQua = [];
  let con = tu;
  nghi.forEach(function (k) {
    if (k[0] > con) ketQua.push([con, k[0]]);
    if (k[1] > con) con = k[1];
  });
  if (den > con) ketQua.push([con, den]);
  return ketQua;
}

/**
 * Khung giờ kế hoạch CA NGÀY của MỘT máy trong MỘT ngày, theo lịch của tổ (`lich`,
 * dạng lichHienHanhCuaTo_) và cờ tăng ca của đúng máy-ngày đó.
 *
 *   ngày thường : Ca_Ngay_Tu → Ca_Ngay_Den, trừ nghỉ trưa (nếu lịch có)
 *   ngày tăng ca: Ca_Ngay_Tu → TANG_CA_DEN,  trừ nghỉ trưa (theo lịch) VÀ nghỉ tối
 *
 * Trả { khung: [[tuPhut, denPhut], ...], tongPhut, hetCa } — `hetCa` là giờ hết ca
 * (phút từ 00:00), dùng cho nút "Về giữa ca" sau này. Trả null nếu tổ CHƯA KHAI
 * lịch (`lich` null) hoặc lịch không có khung hợp lệ — tầng gọi phải tự xử lý
 * "chưa khai", không suy diễn giờ mặc định (cùng nguyên tắc lichHienHanhCuaTo_).
 *
 * Tăng ca không bao giờ làm NGẮN ca đi: nếu TANG_CA_DEN <= Ca_Ngay_Den thì lấy
 * Ca_Ngay_Den. Chỉ áp cho ca ngày — bộ phận có tăng ca là bộ phận chỉ chạy ca ngày.
 * Hàm THUẦN.
 *
 * gioTangCa: kết quả gioTangCa_() (tiêm cho test, mặc định đọc Cau_Hinh).
 */
function khungKeHoachNgayCuaMay_(lich, tangCa, gioTangCa) {
  if (!lich) return null;
  const tu = gioSangPhut_(lich.Ca_Ngay_Tu);
  const denLich = gioSangPhut_(lich.Ca_Ngay_Den);
  if (tu === null || denLich === null || denLich <= tu) return null;

  const nghi = [];
  if (lich.Co_Nghi_Trua) {
    const nt = gioSangPhut_(lich.Nghi_Trua_Tu);
    const nd = gioSangPhut_(lich.Nghi_Trua_Den);
    if (nt !== null && nd !== null && nd > nt) nghi.push([nt, nd]);
  }

  let den = denLich;
  if (tangCa) {
    const g = gioTangCa || gioTangCa_();
    den = Math.max(denLich, g.den);
    if (g.nghiToiTu !== null && g.nghiToiDen !== null) nghi.push([g.nghiToiTu, g.nghiToiDen]);
  }

  const khung = truKhoangNghi_(tu, den, nghi);
  const tongPhut = khung.reduce(function (s, k) { return s + (k[1] - k[0]); }, 0);
  return { khung: khung, tongPhut: tongPhut, hetCa: den };
}

// ============================================================================
// 9. VỀ GIỮA CA — phút mất theo khung kế hoạch (hàm thuần, chưa nối vào RPC nào)
// ============================================================================
//
// Tổ trưởng ghi cho công nhân xin về giữa ca: từ Gio_Ve tới hết ca (hoặc tới
// Gio_Quay_Lai nếu người đó quay lại sớm). Phút MẤT = phần giao giữa khoảng đó và
// khung giờ kế hoạch của ca — nghỉ trưa/nghỉ tối không tính là mất. Ca đêm đi qua
// nửa đêm nên mọi giờ được quy về MỘT TRỤC LIÊN TỤC tính từ 00:00 của ngày ca
// (giờ sau nửa đêm = +1440), đúng cách khungCaDemCuaMay_ dựng khung.

/**
 * Khung giờ kế hoạch CA ĐÊM của một máy, theo Ca_Dem_Tu/Ca_Dem_Den của tổ. Cùng dạng
 * kết quả với khungKeHoachNgayCuaMay_. Giờ kết thúc <= bắt đầu thì hiểu là qua nửa đêm
 * (+1440). Trả null nếu tổ không có ca đêm hoặc chưa khai giờ ca đêm. Hàm THUẦN.
 *
 * nghiDemPhut: tổng số phút nghỉ trong ca đêm (nghiDemPhut_). Đêm không quản lý giờ nghỉ cụ
 * thể nên khung vẫn là MỘT đoạn liền; nghỉ chỉ trừ vào tongPhut (phút kế hoạch). Bị chặn để
 * luôn còn ít nhất 1 phút. Trả thêm phutKhung (độ dài ca) và nghiPhut (số phút đã trừ) để nơi
 * gọi quy đổi theo tỷ lệ.
 */
function khungCaDemCuaMay_(lich, nghiDemPhut) {
  if (!lich || !lich.Co_Ca_Dem) return null;
  const tu = gioSangPhut_(lich.Ca_Dem_Tu);
  let den = gioSangPhut_(lich.Ca_Dem_Den);
  if (tu === null || den === null) return null;
  if (den <= tu) den += 1440;
  const phutKhung = den - tu;
  const nghi = Math.min(Math.max(0, Math.round(Number(nghiDemPhut) || 0)), phutKhung - 1);
  return { khung: [[tu, den]], tongPhut: phutKhung - nghi, hetCa: den, phutKhung: phutKhung, nghiPhut: nghi };
}

/** Quy 'HH:mm' về trục liên tục của một ca bắt đầu lúc `batDauCa` (phút): sớm hơn thì +1440. */
function gioTrenTrucCa_(hhmm, batDauCa) {
  const p = gioSangPhut_(hhmm);
  if (p === null) return null;
  return p < batDauCa ? p + 1440 : p;
}

/** Tổng phút giao giữa danh sách khoảng `khung` ([tu, den]) và đoạn [tu, den]. Hàm THUẦN. */
function phutGiaoKhung_(khung, tu, den) {
  return (khung || []).reduce(function (s, k) {
    const a = Math.max(k[0], tu);
    const b = Math.min(k[1], den);
    return s + (b > a ? b - a : 0);
  }, 0);
}

/**
 * Tính một lượt về giữa ca của MỘT máy.
 *   lich       lịch hiện hành của tổ (lichHienHanhCuaTo_), null nếu chưa khai
 *   tangCa     máy này có tăng ca ngày đó không (chỉ ảnh hưởng ca ngày)
 *   ca         'N' | 'D'
 *   gioVe      'HH:mm' bắt buộc
 *   gioQuayLai 'HH:mm' hoặc rỗng (rỗng = nghỉ tới hết ca)
 *   gioTangCa  kết quả gioTangCa_() (tiêm cho test)
 *   nghiDemPhut tổng phút nghỉ ca đêm của bộ phận (nghiDemPhut_), mặc định 0. CA ĐÊM không
 *              có giờ nghỉ cụ thể nên phút mất được quy đổi THEO TỶ LỆ: giao × (kế hoạch / độ dài ca)
 *
 * Trả { ok:true, phutMat, veLuc, denLuc, hetCa } (giờ trên trục liên tục, phút) hoặc
 * { ok:false, error }. Chặn: tổ chưa khai lịch/ca, giờ về ngoài ca, giờ quay lại không
 * sau giờ về hoặc sau hết ca. Hàm THUẦN.
 */
function tinhVeGiuaCa_(lich, tangCa, ca, gioVe, gioQuayLai, gioTangCa, nghiDemPhut) {
  if (ca !== MA_CA.NGAY && ca !== MA_CA.DEM) return { ok: false, error: 'Ca không hợp lệ.' };
  if (!lich) return { ok: false, error: 'Tổ chưa khai giờ làm việc.' };

  const info = ca === MA_CA.DEM
    ? khungCaDemCuaMay_(lich, nghiDemPhut)
    : khungKeHoachNgayCuaMay_(lich, tangCa, gioTangCa);
  if (!info) {
    return { ok: false, error: ca === MA_CA.DEM ? 'Tổ không có ca đêm.' : 'Lịch của tổ không có khung ca ngày hợp lệ.' };
  }

  const batDau = info.khung[0][0];
  const hetCa = info.hetCa;

  const ve = gioTrenTrucCa_(gioVe, batDau);
  if (ve === null) return { ok: false, error: 'Giờ về không hợp lệ.' };
  if (ve < batDau || ve >= hetCa) return { ok: false, error: 'Giờ về nằm ngoài ca.' };

  let den = hetCa;
  if (String(gioQuayLai === undefined || gioQuayLai === null ? '' : gioQuayLai).trim() !== '') {
    den = gioTrenTrucCa_(gioQuayLai, batDau);
    if (den === null) return { ok: false, error: 'Giờ quay lại không hợp lệ.' };
    if (den <= ve) return { ok: false, error: 'Giờ quay lại phải sau giờ về.' };
    if (den > hetCa) return { ok: false, error: 'Giờ quay lại nằm ngoài ca.' };
  }

  let phutMat = phutGiaoKhung_(info.khung, ve, den);
  // Ca đêm không có giờ nghỉ cụ thể → trừ phần nghỉ THEO TỶ LỆ, không đoán nghỉ rơi vào lúc nào.
  if (ca === MA_CA.DEM && info.nghiPhut > 0) {
    phutMat = Math.round(phutMat * info.tongPhut / info.phutKhung);
  }
  return { ok: true, phutMat: phutMat, veLuc: ve, denLuc: den, hetCa: hetCa };
}

// ============================================================================
// 10. VỀ GIỮA CA — chuẩn hoá (thuần) + RPC ghi / quay lại / huỷ
// ============================================================================
//
// Khác ngoại lệ đóng máy và tăng ca: về giữa ca được ghi NGAY lúc xảy ra qua RPC
// riêng, không đi qua nút "Lưu kế hoạch tuần". Nên luuKeHoachTuan luôn giữ nguyên
// các dòng VE_GIUA_CA của tuần (chỉ bỏ lượt bị đóng máy đè lên).
//
// Một máy-ngày-ca CHỈ MỘT dòng VE_GIUA_CA: ghi lần hai đè lần một (cập nhật giờ về).

/** Thứ Hai ('yyyy-MM-dd') của tuần chứa ngày `ymd`. Không phụ thuộc múi giờ máy chủ. Hàm THUẦN. */
function thuHaiCuaNgay_(ymd) {
  const d = new Date(ymd + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 = Chủ nhật
  d.setUTCDate(d.getUTCDate() - (dow === 0 ? 6 : dow - 1));
  return d.toISOString().slice(0, 10);
}

/**
 * Bỏ khỏi `dsVeRows` (các dòng thô VE_GIUA_CA) những lượt trùng đúng (máy, ngày, ca)
 * với một dòng đóng máy trong `dsDongRows`. Hàm THUẦN.
 */
function boVeGiuaCaBiDongDe_(dsVeRows, dsDongRows) {
  const iNgay = HEADER_KE_HOACH_MAY.indexOf('Ngay');
  const iCa = HEADER_KE_HOACH_MAY.indexOf('Ca');
  const iMay = HEADER_KE_HOACH_MAY.indexOf('Ma_May');
  const dong = {};
  (dsDongRows || []).forEach(function (d) { dong[d[iMay] + '|' + d[iNgay] + '|' + d[iCa]] = true; });
  return (dsVeRows || []).filter(function (r) {
    return !dong[r[iMay] + '|' + r[iNgay] + '|' + r[iCa]];
  });
}

/**
 * Bỏ khỏi `dsVeRows` những lượt về giữa ca CA ĐÊM mà máy đó giờ đang tăng ca đúng ngày đó
 * (`dsTangCaRows`: các dòng thô TANG_CA). Tăng ca ngày thay cho ca đêm của cùng ngày, nên lượt
 * về giữa ca đêm đó không còn nghĩa. Lượt ca NGÀY không bị ảnh hưởng. Hàm THUẦN.
 */
function boVeGiuaCaDemBiTangCaDe_(dsVeRows, dsTangCaRows) {
  const iNgay = HEADER_KE_HOACH_MAY.indexOf('Ngay');
  const iCa = HEADER_KE_HOACH_MAY.indexOf('Ca');
  const iMay = HEADER_KE_HOACH_MAY.indexOf('Ma_May');
  const tangCa = {};
  (dsTangCaRows || []).forEach(function (r) { tangCa[r[iMay] + '|' + r[iNgay]] = true; });
  return (dsVeRows || []).filter(function (r) {
    return !(r[iCa] === MA_CA.DEM && tangCa[r[iMay] + '|' + r[iNgay]]);
  });
}

/**
 * Validate + chuẩn hoá MỘT lần tổ trưởng ghi về giữa ca cho MỘT hoặc NHIỀU máy
 * (một công nhân có thể trông nhiều máy). Hàm THUẦN.
 *
 * p   = { dsMay: ['4T-01', ...], ngay, ca, lyDo, ghiChu, gioVe, gioQuayLai }
 * ctx = {
 *   boPhan, maMayHopLe: {MA: true}, homNay: 'yyyy-MM-dd',
 *   lich: lịch hiện hành của tổ tại `ngay` (null nếu chưa khai),
 *   tangCa: { 'MA|yyyy-MM-dd': true },      // máy-ngày đang tăng ca
 *   dangDong: { 'MA|yyyy-MM-dd|ca': true }, // máy-ngày-ca đang đóng theo kế hoạch
 *   dsLyDo, gioTangCa
 * }
 * Trả { ok:true, ngay, ca, tuanBatDau, dsDong:[dòng], ketQua:[{maMay, phutMat}] } hoặc { ok:false, error }.
 * Hết-hoặc-không: một máy lỗi thì cả lượt không ghi.
 */
function chuanHoaDanhSachVeGiuaCa_(p, ctx) {
  const q = p || {};
  const ngay = chuanHoaNgay_(q.ngay);
  if (!ngay) return { ok: false, error: 'Ngày không hợp lệ.' };
  if (ngay > ctx.homNay) return { ok: false, error: 'Không ghi về giữa ca cho ngày chưa tới.' };

  const ca = String(q.ca || '').trim().toUpperCase();
  if (ca !== MA_CA.NGAY && ca !== MA_CA.DEM) return { ok: false, error: 'Ca không hợp lệ.' };

  const lyDo = String(q.lyDo || '').trim();
  if (!lyDo) return { ok: false, error: 'Vui lòng chọn lý do về giữa ca.' };
  if (ctx.dsLyDo && ctx.dsLyDo.indexOf(lyDo) === -1) {
    return { ok: false, error: 'Lý do "' + lyDo + '" không có trong danh sách cho phép.' };
  }

  const dsMay = Array.isArray(q.dsMay) ? q.dsMay : [];
  if (!dsMay.length) return { ok: false, error: 'Chưa chọn máy nào.' };

  const ghiChu = String(q.ghiChu || '').trim().slice(0, 300);
  const tuanBatDau = thuHaiCuaNgay_(ngay);
  const bp = String(ctx.boPhan).trim().toUpperCase();

  const dsDong = [];
  const ketQua = [];
  const daThay = {};
  for (let i = 0; i < dsMay.length; i++) {
    const maMay = String(dsMay[i] || '').trim().toUpperCase();
    if (!maMay) return { ok: false, error: 'Thiếu mã máy.' };
    if (ctx.maMayHopLe && !ctx.maMayHopLe[maMay]) {
      return { ok: false, error: 'Máy ' + maMay + ' không thuộc bộ phận này.' };
    }
    if (daThay[maMay]) return { ok: false, error: 'Máy ' + maMay + ' bị chọn trùng.' };
    daThay[maMay] = true;

    if (ctx.dangDong && ctx.dangDong[maMay + '|' + ngay + '|' + ca]) {
      return { ok: false, error: 'Máy ' + maMay + ' đang đóng ca này theo kế hoạch, không thể ghi về giữa ca.' };
    }

    // Tăng ca ngày THAY cho ca đêm: máy đã tăng ca ngày nào thì ca đêm của ngày đó không chạy,
    // nên không có gì để ghi "về giữa ca" ở ca đêm đó.
    if (ca === MA_CA.DEM && ctx.tangCa && ctx.tangCa[maMay + '|' + ngay]) {
      return { ok: false, error: 'Máy ' + maMay + ' đang tăng ca ngày ' + ngay + ' nên không chạy ca đêm ngày đó.' };
    }

    const tinh = tinhVeGiuaCa_(ctx.lich, !!(ctx.tangCa && ctx.tangCa[maMay + '|' + ngay]),
      ca, q.gioVe, q.gioQuayLai, ctx.gioTangCa, ctx.nghiDemPhut);
    if (!tinh.ok) return { ok: false, error: 'Máy ' + maMay + ': ' + tinh.error };

    const dong = new Array(HEADER_KE_HOACH_MAY.length).fill('');
    dong[HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau')] = tuanBatDau;
    dong[HEADER_KE_HOACH_MAY.indexOf('Ngay')] = ngay;
    dong[HEADER_KE_HOACH_MAY.indexOf('Ca')] = ca;
    dong[HEADER_KE_HOACH_MAY.indexOf('Ma_May')] = maMay;
    dong[HEADER_KE_HOACH_MAY.indexOf('Bo_Phan')] = bp;
    dong[HEADER_KE_HOACH_MAY.indexOf('Trang_Thai')] = TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA;
    dong[HEADER_KE_HOACH_MAY.indexOf('Ly_Do')] = lyDo;
    dong[HEADER_KE_HOACH_MAY.indexOf('Ghi_Chu')] = ghiChu;
    dong[HEADER_KE_HOACH_MAY.indexOf('Gio_Ve')] = chuanHoaGio_(q.gioVe);
    dong[HEADER_KE_HOACH_MAY.indexOf('Gio_Quay_Lai')] = chuanHoaGio_(q.gioQuayLai) || '';

    dsDong.push(dong);
    ketQua.push({ maMay: maMay, phutMat: tinh.phutMat });
  }

  return { ok: true, ngay: ngay, ca: ca, tuanBatDau: tuanBatDau, dsDong: dsDong, ketQua: ketQua };
}

/**
 * Từ vùng dữ liệu Ke_Hoach_May (mảng thô), dựng ngữ cảnh kiểm tra cho MỘT (tổ, ngày):
 * máy-ngày-ca đang đóng, máy-ngày đang tăng ca. Hàm THUẦN.
 */
function docNguCanhVeGiuaCa_(vung, bp, ngay) {
  const iBoPhan = HEADER_KE_HOACH_MAY.indexOf('Bo_Phan');
  const iNgay = HEADER_KE_HOACH_MAY.indexOf('Ngay');
  const iCa = HEADER_KE_HOACH_MAY.indexOf('Ca');
  const iMay = HEADER_KE_HOACH_MAY.indexOf('Ma_May');
  const iTt = HEADER_KE_HOACH_MAY.indexOf('Trang_Thai');
  const dangDong = {};
  const tangCa = {};
  vung.forEach(function (r) {
    if (String(r[iBoPhan]).trim().toUpperCase() !== bp) return;
    if (chuanHoaNgay_(r[iNgay]) !== ngay) return;
    const tt = String(r[iTt]).trim().toUpperCase();
    const ma = String(r[iMay]).trim().toUpperCase();
    if (tt === TRANG_THAI_KE_HOACH_MAY.DONG) dangDong[ma + '|' + ngay + '|' + String(r[iCa]).trim()] = true;
    if (tt === TRANG_THAI_KE_HOACH_MAY.TANG_CA) tangCa[ma + '|' + ngay] = true;
  });
  return { dangDong: dangDong, tangCa: tangCa };
}

/** Đọc vùng dữ liệu Ke_Hoach_May dạng mảng thô + số dòng, không dùng getLastRow() (bẫy checkbox). */
function docVungKeHoachMay_(sh) {
  const soDong = soDongCoDuLieu_(sh, HEADER_KE_HOACH_MAY.indexOf('Tuan_Bat_Dau') + 1);
  const vung = soDong > 0 ? sh.getRange(2, 1, soDong, HEADER_KE_HOACH_MAY.length).getValues() : [];
  return { soDong: soDong, vung: vung };
}

/** Ghi đè lại toàn bộ vùng dữ liệu bằng MỘT setValues, dọn phần dư phía dưới. */
function ghiLaiVungKeHoachMay_(sh, soDongCu, toanBo) {
  if (toanBo.length) {
    sh.getRange(2, 1, toanBo.length, HEADER_KE_HOACH_MAY.length).setValues(toanBo);
  }
  if (soDongCu > toanBo.length) {
    sh.getRange(toanBo.length + 2, 1, soDongCu - toanBo.length, HEADER_KE_HOACH_MAY.length).clearContent();
  }
}

/**
 * Tìm chỉ số dòng VE_GIUA_CA của đúng (tổ, máy, ngày, ca) trong vùng dữ liệu, -1 nếu không có.
 * Hàm THUẦN.
 */
function timDongVeGiuaCa_(vung, bp, maMay, ngay, ca) {
  const iBoPhan = HEADER_KE_HOACH_MAY.indexOf('Bo_Phan');
  const iNgay = HEADER_KE_HOACH_MAY.indexOf('Ngay');
  const iCa = HEADER_KE_HOACH_MAY.indexOf('Ca');
  const iMay = HEADER_KE_HOACH_MAY.indexOf('Ma_May');
  const iTt = HEADER_KE_HOACH_MAY.indexOf('Trang_Thai');
  for (let i = 0; i < vung.length; i++) {
    const r = vung[i];
    if (String(r[iTt]).trim().toUpperCase() !== TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA) continue;
    if (String(r[iBoPhan]).trim().toUpperCase() !== bp) continue;
    if (String(r[iMay]).trim().toUpperCase() !== maMay) continue;
    if (chuanHoaNgay_(r[iNgay]) !== ngay) continue;
    if (String(r[iCa]).trim() !== ca) continue;
    return i;
  }
  return -1;
}

/**
 * Tổ trưởng ghi công nhân về giữa ca (một hoặc nhiều máy). Ghi ngay, không chờ nút Lưu tuần.
 *
 * payload = { requestId, ngay, ca, lyDo, ghiChu, gioVe, gioQuayLai, dsMay: [...] }
 * Trả { ok, ketQua:[{maMay, phutMat}] } — phutMat để màn hình hiện "mất N phút".
 */
function ghiVeGiuaCa(boPhan, token, payload) {
  const to = xacThucTo_(boPhan, token);
  if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

  const bp = String(to.Bo_Phan).trim().toUpperCase();
  const p = payload || {};
  const requestId = String(p.requestId || '').trim();
  if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const sh = sheet_(SHEET.KE_HOACH_MAY);
    const doc = docVungKeHoachMay_(sh);
    const iBoPhan = HEADER_KE_HOACH_MAY.indexOf('Bo_Phan');
    const iTt = HEADER_KE_HOACH_MAY.indexOf('Trang_Thai');
    const iReq = HEADER_KE_HOACH_MAY.indexOf('Request_ID');

    // Chống double-tap: đã có dòng VE_GIUA_CA của tổ này mang đúng requestId thì trả lại, không ghi lại.
    const daCo = doc.vung.filter(function (r) {
      return String(r[iBoPhan]).trim().toUpperCase() === bp &&
        String(r[iTt]).trim().toUpperCase() === TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA &&
        String(r[iReq]).trim() === requestId;
    });
    if (daCo.length) return { ok: true, trung: true, soMay: daCo.length };

    const ngay = chuanHoaNgay_(p.ngay);
    const dsMayHopLe = {};
    dsMayCuaBoPhan_(bp).forEach(function (m) { dsMayHopLe[m.maMay.toUpperCase()] = true; });
    const nc = docNguCanhVeGiuaCa_(doc.vung, bp, ngay);

    const chuan = chuanHoaDanhSachVeGiuaCa_(p, {
      boPhan: bp,
      maMayHopLe: dsMayHopLe,
      homNay: fmtNgay_(nowVN_()),
      lich: ngay ? lichHienHanhCuaTo_(bp, ngay) : null,
      tangCa: nc.tangCa,
      dangDong: nc.dangDong,
      dsLyDo: dsLyDoVeGiuaCa_(),
      gioTangCa: gioTangCa_(),
      nghiDemPhut: nghiDemPhut_(bp),
    });
    if (!chuan.ok) return chuan;

    const luc = nowVN_();
    const nguoi = String(to.Ten_To_Truong || to.Ten_To || bp).trim();
    const iNguoi = HEADER_KE_HOACH_MAY.indexOf('Nguoi_Cap_Nhat');
    const iLuc = HEADER_KE_HOACH_MAY.indexOf('Cap_Nhat_Luc');
    chuan.dsDong.forEach(function (d) { d[iNguoi] = nguoi; d[iLuc] = luc; d[iReq] = requestId; });

    // Ghi đè đúng (máy, ngày, ca) đã có — một máy-ngày-ca một dòng VE_GIUA_CA.
    const iNgay = HEADER_KE_HOACH_MAY.indexOf('Ngay');
    const iCa = HEADER_KE_HOACH_MAY.indexOf('Ca');
    const iMay = HEADER_KE_HOACH_MAY.indexOf('Ma_May');
    const moi = {};
    chuan.dsDong.forEach(function (d) { moi[d[iMay] + '|' + d[iNgay] + '|' + d[iCa]] = true; });
    const giuLai = doc.vung.filter(function (r) {
      const laVe = String(r[iTt]).trim().toUpperCase() === TRANG_THAI_KE_HOACH_MAY.VE_GIUA_CA &&
        String(r[iBoPhan]).trim().toUpperCase() === bp;
      return !(laVe && moi[String(r[iMay]).trim().toUpperCase() + '|' + chuanHoaNgay_(r[iNgay]) + '|' + String(r[iCa]).trim()]);
    });

    ghiLaiVungKeHoachMay_(sh, doc.soDong, giuLai.concat(chuan.dsDong));
    return { ok: true, ketQua: chuan.ketQua };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cập nhật giờ QUAY LẠI của một lượt về giữa ca (người đó quay lại làm tiếp trước hết ca),
 * hoặc xoá giờ quay lại (gioQuayLai rỗng = nghỉ tới hết ca). Giờ quay lại được kiểm lại
 * bằng đúng luật của tinhVeGiuaCa_.
 *
 * payload = { ngay, ca, maMay, gioQuayLai }
 */
function capNhatQuayLaiVeGiuaCa(boPhan, token, payload) {
  const to = xacThucTo_(boPhan, token);
  if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

  const bp = String(to.Bo_Phan).trim().toUpperCase();
  const p = payload || {};
  const ngay = chuanHoaNgay_(p.ngay);
  const ca = String(p.ca || '').trim().toUpperCase();
  const maMay = String(p.maMay || '').trim().toUpperCase();
  if (!ngay || !maMay || (ca !== MA_CA.NGAY && ca !== MA_CA.DEM)) {
    return { ok: false, error: 'Thiếu máy, ngày hoặc ca.' };
  }

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }
    const sh = sheet_(SHEET.KE_HOACH_MAY);
    const doc = docVungKeHoachMay_(sh);
    const i = timDongVeGiuaCa_(doc.vung, bp, maMay, ngay, ca);
    if (i === -1) return { ok: false, error: 'Không tìm thấy lượt về giữa ca của máy ' + maMay + '.' };

    const r = doc.vung[i];
    const nc = docNguCanhVeGiuaCa_(doc.vung, bp, ngay);
    const tinh = tinhVeGiuaCa_(lichHienHanhCuaTo_(bp, ngay), !!nc.tangCa[maMay + '|' + ngay], ca,
      chuanHoaGio_(r[HEADER_KE_HOACH_MAY.indexOf('Gio_Ve')]), p.gioQuayLai, gioTangCa_(), nghiDemPhut_(bp));
    if (!tinh.ok) return { ok: false, error: 'Máy ' + maMay + ': ' + tinh.error };

    r[HEADER_KE_HOACH_MAY.indexOf('Gio_Quay_Lai')] = chuanHoaGio_(p.gioQuayLai) || '';
    r[HEADER_KE_HOACH_MAY.indexOf('Nguoi_Cap_Nhat')] = String(to.Ten_To_Truong || to.Ten_To || bp).trim();
    r[HEADER_KE_HOACH_MAY.indexOf('Cap_Nhat_Luc')] = nowVN_();
    ghiLaiVungKeHoachMay_(sh, doc.soDong, doc.vung);
    return { ok: true, maMay: maMay, phutMat: tinh.phutMat };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

/** Huỷ (xoá) một lượt về giữa ca — bấm nhầm, hoặc người đó không về nữa. payload = { ngay, ca, maMay } */
function huyVeGiuaCa(boPhan, token, payload) {
  const to = xacThucTo_(boPhan, token);
  if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

  const bp = String(to.Bo_Phan).trim().toUpperCase();
  const p = payload || {};
  const ngay = chuanHoaNgay_(p.ngay);
  const ca = String(p.ca || '').trim().toUpperCase();
  const maMay = String(p.maMay || '').trim().toUpperCase();
  if (!ngay || !maMay || (ca !== MA_CA.NGAY && ca !== MA_CA.DEM)) {
    return { ok: false, error: 'Thiếu máy, ngày hoặc ca.' };
  }

  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }
    const sh = sheet_(SHEET.KE_HOACH_MAY);
    const doc = docVungKeHoachMay_(sh);
    const i = timDongVeGiuaCa_(doc.vung, bp, maMay, ngay, ca);
    if (i === -1) return { ok: false, error: 'Không tìm thấy lượt về giữa ca của máy ' + maMay + '.' };

    doc.vung.splice(i, 1);
    ghiLaiVungKeHoachMay_(sh, doc.soDong, doc.vung);
    return { ok: true, maMay: maMay };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}
