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
 * Tách vùng dữ liệu HIỆN CÓ của Ke_Hoach_May (không kể header) thành:
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
  let daKhaiCu = null;

  vung.forEach(function (r) {
    const rBp = String(r[iBoPhan]).trim().toUpperCase();
    const rTuan = chuanHoaNgay_(r[iTuan]);
    if (rBp === bp && rTuan === tuanBatDau) {
      if (String(r[iTrangThai]).trim().toUpperCase() === TRANG_THAI_KE_HOACH_MAY.DA_KHAI) {
        daKhaiCu = { requestId: String(r[iReqId] || '').trim() };
      }
      return; // bỏ khỏi giuLai — sẽ ghi lại bằng dữ liệu mới (đóng ngoài, cùng lượt)
    }
    giuLai.push(r);
  });

  return { giuLai: giuLai, daKhaiCu: daKhaiCu };
}

// ============================================================================
// 8. RPC — KẾ HOẠCH MÁY THEO TUẦN
// ============================================================================

/** Đọc ngoại lệ + trạng thái "đã khai" của một tuần. */
function layKeHoachTuan(boPhan, token, tuanBatDau) {
  try {
    const to = xacThucTo_(boPhan, token);
    if (!to) return { ok: false, error: 'Link không hợp lệ hoặc đã bị khoá.' };

    const bp = String(to.Bo_Phan).trim().toUpperCase();
    const tuan = chuanHoaNgay_(tuanBatDau);
    if (!tuan) return { ok: false, error: 'Tuần không hợp lệ.' };

    let daKhai = false;
    const ngoaiLe = [];
    docSheet_(SHEET.KE_HOACH_MAY, HEADER_KE_HOACH_MAY).forEach(function (r) {
      if (String(r.Bo_Phan).trim().toUpperCase() !== bp) return;
      if (chuanHoaNgay_(r.Tuan_Bat_Dau) !== tuan) return;

      if (String(r.Trang_Thai).trim().toUpperCase() === TRANG_THAI_KE_HOACH_MAY.DA_KHAI) {
        daKhai = true;
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

    return { ok: true, tuanBatDau: tuan, daKhai: daKhai, ngoaiLe: ngoaiLe };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Lưu kế hoạch tuần: thay TOÀN BỘ ngoại lệ của đúng (Bo_Phan, Tuan_Bat_Dau)
 * bằng danh sách mới — không đụng dữ liệu tuần/tổ khác.
 *
 * payload = { tuanBatDau: 'yyyy-MM-dd', requestId, ngoaiLe: [{maMay, ngay, ca, lyDo, ghiChu}] }
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

    chuan.dsDong.forEach(function (dong) {
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

    const toanBo = tach.giuLai.concat(chuan.dsDong, [dongDaKhai]);

    if (toanBo.length) {
      sh.getRange(2, 1, toanBo.length, HEADER_KE_HOACH_MAY.length).setValues(toanBo);
    }
    if (soDong > toanBo.length) {
      sh.getRange(toanBo.length + 2, 1, soDong - toanBo.length, HEADER_KE_HOACH_MAY.length)
        .clearContent();
    }

    return { ok: true, soNgoaiLe: chuan.dsDong.length };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}
