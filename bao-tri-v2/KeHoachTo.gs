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
 */
function xacThucTo_(boPhan, token) {
  const bp = String(boPhan || '').trim().toUpperCase();
  const tk = String(token || '').trim();
  if (!bp || !tk) return null;

  const ds = docSheet_(SHEET.TO, HEADER_TO);
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
