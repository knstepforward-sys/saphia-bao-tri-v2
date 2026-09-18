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
