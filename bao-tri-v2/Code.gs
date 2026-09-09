/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * Công nhân quét QR trên máy → báo sự cố → gọi điện thợ đang trực
 * → thợ nhận việc → thợ hoàn thành. Toàn bộ dữ liệu nằm trong Google Sheet này.
 *
 * Script BẮT BUỘC là container-bound (tạo từ Tiện ích mở rộng > Apps Script của
 * chính Sheet) để ss_() trỏ đúng file.
 *
 * Spreadsheet ID: 1Ett9UDYQx6KpWHizU4eOZFYFiOgf0OtSuPB1orLddu4
 *
 * --- BƯỚC 1 (file hiện tại) --------------------------------------------------
 * Schema + setupSystem() + các hàm nền (ca làm việc, lịch trực, mã phiếu, log).
 * Luồng công nhân / luồng thợ / báo cáo sẽ thêm ở các bước sau.
 *
 * --- 3 NGUYÊN TẮC ỔN ĐỊNH (rút từ bài học hệ thống cũ, không được vi phạm) ---
 * 1. Mỗi lần đổi trạng thái phiếu = ĐÚNG MỘT setValues() cho cả dòng.
 *    Không bao giờ chia thành nhiều getRange().setValue() rời rạc.
 * 2. Mọi hàm ghi phải nằm trong LockService.getScriptLock() và kiểm Request_ID
 *    để chống double-tap trên điện thoại.
 * 3. Không dùng PropertiesService để đếm dữ liệu tăng dần (giới hạn 500 key).
 *    Mã phiếu đếm trực tiếp trên sheet Su_Co, bên trong lock.
 */

// ============================================================================
// 1. CẤU HÌNH
// ============================================================================

const CONFIG = {
  MUI_GIO: 'Asia/Ho_Chi_Minh',

  // Phiếu HOAN_THANH cũ hơn số tháng này sẽ được archiveOldTickets_() dời sang Luu_Tru.
  SO_THANG_GIU_LAI: 12,

  // Giới hạn nhập liệu (giữ như bản cũ).
  MAX_PHU_TUNG: 5,
  MAX_MO_TA: 300,
  MAX_NOI_DUNG: 1000,

  // Thời gian chờ tối đa khi giành LockService (giây).
  KHOA_CHO_GIAY: 20,

  // Nhóm ca dùng khi máy/thợ không khai báo Nhom_Ca, hoặc khai báo sai.
  NHOM_CA_MAC_DINH: 'MAC_DINH',

  // Chủ nhật để trống khi xếp lịch luân phiên — ca Chủ nhật do các thợ tự thoả
  // thuận với nhau rồi tự đăng ký tay trên sheet.
  BO_TRONG_CHU_NHAT: true,

  // Số giờ sau khi đóng phiếu mà thợ còn tự sửa được nội dung xử lý / phụ tùng /
  // ghi chú. Hết hạn thì chỉ quản trị sửa thẳng trên Sheet — để lịch sử không bị
  // viết lại sau khi báo cáo tháng đã gửi đi.
  GIO_CHO_SUA_PHIEU: 24,

  // Chặn spam: cùng MỘT máy không cho tạo quá ngần này phiếu trong ngần này phút.
  // Trang báo sự cố mở công khai không đăng nhập, nên đây là lớp chặn duy nhất
  // giữa hệ thống và người bấm gửi liên tục. Ghi đè được ở sheet Cau_Hinh.
  CHONG_SPAM_PHUT: 5,
  CHONG_SPAM_SO_PHIEU: 3,
};

/**
 * URL /exec của web app — KHÔNG hardcode vào file này (mục 7 bản thiết kế:
 * đây là secret thực tế, không commit kèm code chia sẻ ra ngoài).
 * Sau khi Deploy lần đầu, chạy datWebAppUrl('https://...../exec') một lần.
 */
function layWebAppUrl_() {
  const url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL');
  if (!url) {
    throw new Error(
      'Chưa có WEB_APP_URL. Sau khi Deploy > New deployment, copy URL /exec rồi chạy 1 lần:\n' +
      "  datWebAppUrl('https://script.google.com/macros/s/..../exec')"
    );
  }
  return url;
}

/** Chạy tay một lần sau khi deploy để lưu URL /exec vào Script Property. */
function datWebAppUrl(url) {
  if (!url || url.indexOf('/exec') === -1) {
    throw new Error('URL phải là link /exec của deployment (kết thúc bằng /exec).');
  }
  PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', url.trim());
  return 'Đã lưu WEB_APP_URL. Chạy tiếp refreshPersonalLinks() để sinh lại link QR / link cá nhân.';
}

/**
 * URL trang wrapper ở domain riêng (GitHub Pages), dùng làm gốc cho link QR và
 * link cá nhân của thợ thay cho URL script.google.com.
 *
 * Lý do: mở thẳng /exec thì Google chèn banner "Ứng dụng này do một người dùng
 * Google Apps Script tạo" ở trang cấp cao nhất — code của mình không gỡ được vì
 * khác origin. Nhúng qua trang khác thì banner đó không thuộc trang nữa.
 *
 * Không bắt buộc. Chưa đặt thì mọi link vẫn dùng WEB_APP_URL như cũ.
 */
function datUrlCongKhai(url) {
  const s = String(url || '').trim();
  if (!s) {
    PropertiesService.getScriptProperties().deleteProperty('URL_CONG_KHAI');
    return 'Đã bỏ URL công khai — link sẽ quay về dùng thẳng URL /exec.';
  }
  if (!/^https?:\/\//i.test(s)) throw new Error('URL phải bắt đầu bằng http:// hoặc https://');
  if (s.indexOf('?') !== -1) {
    throw new Error('URL không được chứa dấu ? — hệ thống sẽ tự nối tham số vào sau.');
  }
  PropertiesService.getScriptProperties().setProperty('URL_CONG_KHAI', s);
  return 'Đã lưu URL công khai:\n' + s +
    '\n\nChạy tiếp refreshPersonalLinks() để sinh lại link QR / link cá nhân.';
}

/** Đọc một số từ sheet Cau_Hinh; ô trống hoặc không phải số thì dùng mặc định. */
function soCauHinh_(gt, macDinh) {
  const s = String(gt === null || gt === undefined ? '' : gt).trim();
  if (!s) return macDinh;
  const n = Number(s);
  return isFinite(n) && n >= 0 ? n : macDinh;
}

/** Danh sách lý do dừng máy, đọc từ Cau_Hinh. Trống thì dùng mặc định trong code. */
function dsLyDoDungMay_(cauHinh) {
  const ch = cauHinh || docCauHinh_();
  const s = String(ch.LY_DO_DUNG_MAY || '').trim() ||
    'Thiếu chỉ, Thiếu nguyên liệu, Chờ kế hoạch sản xuất, Mất điện, Vệ sinh máy, Lý do khác';
  return s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
}

function layUrlCongKhai_() {
  return PropertiesService.getScriptProperties().getProperty('URL_CONG_KHAI') || '';
}

// ============================================================================
// 2. SCHEMA — tên sheet và header
// ============================================================================

const SHEET = {
  MAY: 'Danh_Muc_May',
  THO: 'Danh_Muc_Tho',
  CA: 'Ca_Lam_Viec',
  CAU_HINH: 'Cau_Hinh',
  LICH: 'Lich_Truc_Thang',
  SU_CO: 'Su_Co',
  NHAT_KY: 'Nhat_Ky_Su_Co',
  TONG_HOP: 'Tong_Hop',
  LUU_TRU: 'Luu_Tru',
  THUNG_RAC: 'Thung_Rac',
  KE_HOACH: 'Ke_Hoach_Chay_May',
  KHUNG_NGUNG: 'Khung_Ngung_Ke_Hoach',
};

const HEADER_MAY = ['Ma_May', 'Ten_May', 'Bo_Phan', 'Hoat_Dong', 'Link_QR'];

const HEADER_THO = [
  'Ma_Tho', 'Ten_Tho', 'Chuyen_Mon', 'Nhom_Ca', 'So_Dien_Thoai',
  'Bo_Phan_Phu_Trach', 'Token', 'Hoat_Dong', 'Link_Ca_Nhan',
  // --- Bổ sung sau, luôn THÊM VÀO CUỐI để không xô lệch dữ liệu đã ghi -------
  'Telegram_Chat_ID',    // bot Telegram nhắn cho thợ; để trống là chưa ghép
];

const HEADER_CA = ['Nhom_Ca', 'Mo_Ta', 'Ca_Ngay_Tu', 'Ca_Ngay_Den', 'Co_Ca_Dem'];

/**
 * Kế hoạch chạy máy theo BỘ PHẬN — mẫu số của tỉ lệ hiệu dụng A.
 *
 * Tách khỏi Ca_Lam_Viec vì hai bảng trả lời hai câu hỏi khác nhau: Ca_Lam_Viec
 * nói THỢ trực giờ nào, bảng này nói MÁY phải chạy giờ nào. Hôm nay hai con số
 * trùng nhau, nhưng gộp lại thì đổi kế hoạch sản xuất sẽ kéo lệch cả lịch trực.
 *
 * Chay_Ca_Dem theo đúng quy ước của Ca_Lam_Viec: tick = chạy liền 24 giờ tính
 * từ Gio_Bat_Dau, không phải khai thêm một khung giờ thứ hai.
 */
const HEADER_KE_HOACH = [
  'Bo_Phan', 'Mo_Ta', 'Gio_Bat_Dau', 'Gio_Ket_Thuc', 'Chay_Ca_Dem',
  'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN', 'Ngay_Nghi', 'Ghi_Chu',
];

/**
 * Các khoảng máy KHÔNG phải chạy nằm bên trong ca kế hoạch.
 *
 * Mỗi bộ phận được khai nhiều dòng: một dòng nghỉ trưa, một hoặc hai dòng giao
 * ca ngày/đêm. Nếu không tick thứ nào thì khoảng đó kế thừa toàn bộ ngày chạy
 * của bộ phận trong Ke_Hoach_Chay_May; nếu có tick thì chỉ áp các ngày đã tick.
 */
const HEADER_KHUNG_NGUNG = [
  'Bo_Phan', 'Loai_Khoang', 'Gio_Bat_Dau', 'Gio_Ket_Thuc',
  'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN', 'Ghi_Chu',
];

const LOAI_KHUNG_NGUNG = ['NGHI_TRUA', 'GIAO_CA'];

/**
 * Seed Ke_Hoach_Chay_May. Giờ lấy đúng theo Ca_Lam_Viec đang chạy để ngày đầu
 * bật tính năng số liệu không nhảy; sửa trực tiếp trên sheet khi kế hoạch sản
 * xuất đổi, KHÔNG cần đụng code.
 *
 * Chủ nhật mặc định NGHỈ. Bộ phận nào chạy chủ nhật thì tick ô CN.
 */
const KE_HOACH_MAC_DINH = [
  ['DET',      'Bộ phận Dệt',                   '07:00', '18:00', true,  true, true, true, true, true, true, false, '', ''],
  ['SOI',      'Bộ phận Sợi',                   '07:00', '17:00', true,  true, true, true, true, true, true, false, '', ''],
  ['CMTX',     'Bộ phận CMTX',                  '07:00', '17:00', true,  true, true, true, true, true, true, false, '', ''],
  ['CMTD',     'Bộ phận CMTĐ (chỉ ca ngày)',    '07:00', '17:00', false, true, true, true, true, true, true, false, '', ''],
  ['TRANG',    'Bộ phận Trang',                 '07:00', '17:00', false, true, true, true, true, true, true, false, '', ''],
  ['MTX',      'Bộ phận MTX',                   '07:00', '17:00', false, true, true, true, true, true, true, false, '', ''],
  ['CO',       'Bộ phận CO',                    '07:00', '17:00', false, true, true, true, true, true, true, false, '', ''],
  ['ICM',      'Bộ phận ICM',                   '07:00', '17:00', false, true, true, true, true, true, true, false, '', ''],
  ['LT',       'Băng tải',                      '07:00', '17:00', false, true, true, true, true, true, true, false, '', ''],
  ['CHUNG',    'Bộ phận Chung',                 '07:00', '17:00', false, true, true, true, true, true, true, false, '', ''],
];

const HEADER_CAU_HINH = ['Khoa', 'Gia_Tri', 'Ghi_Chu'];

/** Seed sheet Cau_Hinh. Người dùng sửa trực tiếp trên sheet, không cần đụng code. */
const CAU_HINH_MAC_DINH = [
  ['SDT_KHAN_CAP', '0794964115',
    'Số luôn hiện CUỐI danh bạ, bất kể lịch trực — dùng khi người trực không bắt máy ' +
    'hoặc ngày chưa ai đăng ký. Để trống ô này là tắt hẳn tính năng.'],
  ['TEN_KHAN_CAP', 'Khang',
    'Tên hiển thị cho số trên. Để trống sẽ hiện là "Số khẩn cấp".'],
  ['CHONG_SPAM_PHUT', '5',
    'Khoảng thời gian xét chặn spam, tính bằng phút. Đặt 0 để tắt hẳn.'],
  ['CHONG_SPAM_SO_PHIEU', '3',
    'Số phiếu tối đa cho CÙNG một máy trong khoảng trên. Vượt ngưỡng thì lần gửi ' +
    'tiếp theo bị từ chối. Đặt 0 để tắt hẳn.'],
  ['LY_DO_DUNG_MAY',
    'Thiếu chỉ, Thiếu nguyên liệu, Chờ kế hoạch sản xuất, Mất điện, Vệ sinh máy, Lý do khác',
    'Các lý do dừng máy KHÔNG do hư hỏng, hiện thành nút bấm cho công nhân chọn. ' +
    'Cách nhau bằng dấu phẩy. Sửa ở đây là đổi ngay trên app, không cần deploy lại. ' +
    'Nên giữ danh sách ngắn và cố định để báo cáo gom nhóm được.'],
  ['A_TINH_SU_CO', 'TRUE',
    'TỈ LỆ HIỆU DỤNG A — có trừ thời gian máy dừng do SỰ CỐ (phiếu SC-) hay không. ' +
    'Gõ TRUE để trừ, FALSE để bỏ qua. Chỉ trừ khi công nhân xác nhận máy ĐÃ DỪNG.'],
  ['A_TINH_DUNG_MAY', 'TRUE',
    'TỈ LỆ HIỆU DỤNG A — có trừ thời gian dừng máy KHÔNG do hư (phiếu DM-: thiếu chỉ, ' +
    'thiếu nguyên liệu, chờ kế hoạch…) hay không. Gõ TRUE hoặc FALSE. ' +
    'Để TRUE thì A phản ánh máy có thật sự ra hàng; để FALSE thì A thành thước đo riêng ' +
    'của tổ bảo trì.'],
  ['A_TINH_VIEC_CHUNG', 'FALSE',
    'TỈ LỆ HIỆU DỤNG A — có trừ thời gian của phiếu VIỆC CHUNG (CV-) hay không. ' +
    'Gõ TRUE hoặc FALSE. Chỉ những phiếu CV- đã ghi ĐÚNG TÊN MÁY (khớp Danh_Muc_May) ' +
    'mới quy được về máy; phiếu không ghi máy vẫn bị bỏ qua dù bật TRUE.'],
  ['NGUONG_KPI_DAP_UNG_PHUT', '',
    'KPI ĐÁP ỨNG THỢ — phiếu được coi là ĐẠT khi Phut_KPI_Tho không vượt quá số phút ' +
    'này. ĐỂ TRỐNG khi công ty chưa chốt: báo cáo vẫn ra đủ, cột "Tỷ lệ đạt" hiện "—", ' +
    'và khối "CƠ SỞ ĐỂ CHỌN NGƯỠNG" vẫn tính sẵn tỷ lệ đạt ở 5 mức để chọn. ' +
    'Chốt xong chỉ cần gõ số vào đây rồi xuất lại báo cáo, không phải sửa code.'],
  ['TELEGRAM_BAT', 'TAT',
    'THÔNG BÁO TELEGRAM — công tắc tổng. Gõ BAT để bot nhắn cho thợ, gõ bất cứ thứ ' +
    'gì khác (kể cả để trống) là TẮT hẳn phần Telegram. Có sự cố gì thì gõ TAT vào ' +
    'đây là dừng ngay lập tức, không cần chờ ai sửa code. Chỉ bật lên sau khi đã ' +
    'gửi thử thành công và ghép đủ Telegram_Chat_ID cho thợ.'],
  ['NHAC_LAN_1_PHUT', '10',
    'THÔNG BÁO TELEGRAM — phiếu sự cố chưa ai nhận quá ngần này PHÚT thì bot nhắc ' +
    'lần 1, gửi lại đúng những thợ đang trực. Đặt 0 để tắt riêng phần nhắc.'],
  ['NHAC_LAN_2_PHUT', '20',
    'THÔNG BÁO TELEGRAM — quá ngần này PHÚT vẫn chưa ai nhận thì bot nhắc lần 2, ' +
    'lời gắt hơn và kèm SDT_KHAN_CAP. Mỗi phiếu tối đa 2 lần nhắc, không bao giờ ' +
    'nhiều hơn. Phải lớn hơn NHAC_LAN_1_PHUT. Đặt 0 để tắt riêng lần nhắc thứ hai.'],
  ['HUONG_DAN_KHOA_LINK_THO', '',
    'KHOÁ LINK KHI THỢ NGHỈ VIỆC: xoá trắng ô Token của người đó trong sheet ' +
    'Danh_Muc_Tho, bỏ tick Hoat_Dong, rồi chạy menu 🔧 Bảo trì → "4. Sinh lại ' +
    'link QR / link cá nhân". Link cũ mất hiệu lực ngay lập tức. Token của những ' +
    'người còn lại giữ nguyên, không ai phải đổi link.'],
];

// Thang, Ma_Tho, Ten_Tho + Ngay_01..Ngay_31
const HEADER_LICH = ['Thang', 'Ma_Tho', 'Ten_Tho'].concat(
  Array.from({ length: 31 }, (_, i) => 'Ngay_' + pad2_(i + 1))
);

const HEADER_SU_CO = [
  'Ma_Su_Co', 'Ma_May', 'Ten_May', 'Bo_Phan', 'Trang_Thai_May', 'Nhom_Loi',
  'Mo_Ta', 'Trang_Thai', 'Thoi_Gian_Bao', 'Ma_Tho', 'Ten_Tho', 'Thoi_Gian_Nhan',
  'Thoi_Gian_Hoan_Thanh', 'Noi_Dung_Xu_Ly', 'Phu_Tung_Tom_Tat', 'Phut_Tiep_Nhan',
  'Phut_Xu_Ly', 'Ghi_Chu', 'Ngay_Ca', 'Ca', 'Cap_Nhat_Luc', 'Request_ID_Cuoi',
  'Phien_Ban',
  // --- Bổ sung sau, luôn THÊM VÀO CUỐI để không xô lệch dữ liệu đã ghi -------
  'Thoi_Gian_Dung_May',  // mốc máy thực sự dừng (thợ lật trạng thái thì lấy lúc lật)
  'Phut_Cho_Tho_Ban',    // máy chờ vì thợ đang bận việc khác — KHÔNG tính vào KPI thợ
  'Phut_Dap_Ung_Thuc',   // từ lúc thợ rảnh đến lúc bấm nhận — ĐÂY mới là KPI thợ
  'So_Chong_Viec',       // số phiếu khác thợ đang giữ dở lúc bấm nhận
  'Loai_Phieu',          // SU_CO (máy hỏng, qua QR) | CONG_VIEC (việc chung, thợ tự tạo)
  // --- Đợt KPI đáp ứng theo yêu cầu công ty (09/2026) ------------------------
  // Phut_Dap_Ung_Thuc ở trên miễn trừ thời gian bận bằng MỘT mốc rảnh (giờ hoàn
  // thành muộn nhất), nên khi thợ bận thành nhiều đoạn rời thì mọi khoảng rảnh
  // xen giữa cũng được miễn oan. Bốn cột dưới tính lại bằng cách CỘNG DỒN các
  // đoạn bận nên chỉ miễn trừ đúng phần thợ thật sự đang cầm việc khác.
  // Cố ý giữ song song, không sửa đè: số cũ đã đi vào các báo cáo đã gửi.
  'Phut_Ban_Thuc_Te',    // tổng phút thợ thật sự bận, trong khoảng máy nằm chờ
  'Phut_KPI_Tho',        // = Phut_Tiep_Nhan − Phut_Ban_Thuc_Te → số chấm KPI thợ
  'So_Doan_Ban',         // số đoạn bận rời; ≥2 là ca mà cách cũ tính rộng tay
  'KPI_Ap_Dung',         // CO | KHONG — <lý do>: loại phiếu không đo, thiếu mốc…
  'Dat_Nguong',          // DAT | KHONG_DAT | rỗng khi công ty chưa chốt ngưỡng
];

const HEADER_NHAT_KY = [
  'Event_ID', 'Ma_Su_Co', 'Ma_May', 'Thoi_Gian', 'Actor', 'Hanh_Dong',
  'Du_Lieu', 'Request_ID',
];

/**
 * Chỉ số cột (0-based) của sheet Su_Co, tra theo tên.
 * Dùng COT.Trang_Thai thay vì số 7 → khi thêm cột về sau không phải dò lại
 * magic number, và giữ được nguyên tắc "ghi cả dòng bằng 1 setValues".
 */
const COT = (function () {
  const m = {};
  HEADER_SU_CO.forEach(function (ten, i) { m[ten] = i; });
  return m;
})();

/** Ba trạng thái duy nhất của phiếu. Không có trạng thái trung gian. */
const TRANG_THAI = {
  CHO_NHAN: 'CHO_NHAN',
  DANG_XU_LY: 'DANG_XU_LY',
  HOAN_THANH: 'HOAN_THANH',
};

/**
 * Loại phiếu.
 * - SU_CO    : máy hỏng, công nhân báo qua QR. Có đáp ứng, có downtime.
 * - CONG_VIEC: việc chung không gắn với máy nào (lắp camera, sửa điện văn phòng,
 *              nhà kho…). Thợ tự tạo và tự nhận. KHÔNG đo thời gian đáp ứng vì
 *              không có ai "báo hỏng", nhưng VẪN chiếm thời gian của thợ nên vẫn
 *              được tính là bận khi xét chồng việc.
 * Dòng cũ để trống cột này → hiểu là SU_CO.
 */
const LOAI_PHIEU = {
  SU_CO: 'SU_CO',
  CONG_VIEC: 'CONG_VIEC',
  BAO_TRI: 'BAO_TRI',
  DUNG_MAY: 'DUNG_MAY',
};

/**
 * Loại phiếu đã chuẩn hoá. Ô trống (dòng cũ) hiểu là SU_CO.
 *
 * BAO_TRI — bảo trì hằng ngày: thợ làm rải rác trong ca, không gây dừng máy,
 * KHÔNG đo thời gian gì cả, chỉ đếm số việc. Ghi xong đóng luôn và cố ý để trống
 * Thoi_Gian_Nhan, nhờ vậy tinhDapUng_ bỏ qua — nếu tính loại này là "thợ bận"
 * thì thợ nào ghi bảo trì cả ca sẽ trông như bận suốt và mọi thời gian máy chờ
 * đều được miễn trừ, làm chỉ số đáp ứng mất hết ý nghĩa.
 */
function loaiPhieu_(v) {
  const t = String(v[COT.Loai_Phieu] || '').trim().toUpperCase();
  return (t === LOAI_PHIEU.CONG_VIEC || t === LOAI_PHIEU.BAO_TRI ||
          t === LOAI_PHIEU.DUNG_MAY) ? t : LOAI_PHIEU.SU_CO;
}

function laCongViec_(v) { return loaiPhieu_(v) === LOAI_PHIEU.CONG_VIEC; }
function laBaoTri_(v) { return loaiPhieu_(v) === LOAI_PHIEU.BAO_TRI; }
function laSuCo_(v) { return loaiPhieu_(v) === LOAI_PHIEU.SU_CO; }

/**
 * DUNG_MAY — máy dừng KHÔNG do hư hỏng: thiếu chỉ, hết nguyên liệu, chờ kế hoạch…
 * Không có thợ, không có nhóm lỗi, không ai phải sửa. Chỉ đo THỜI GIAN DỪNG.
 *
 * Vòng đời khác hẳn ba loại kia: mở khi công nhân bấm "Báo dừng máy", và đóng khi
 * chính công nhân quét lại QR của máy đó rồi bấm "Máy đã chạy lại" — không đi qua
 * màn hình Hoàn thành của thợ.
 *
 * DANG_XU_LY = máy đang dừng. HOAN_THANH = máy đã chạy lại.
 */
function laDungMay_(v) { return loaiPhieu_(v) === LOAI_PHIEU.DUNG_MAY; }

const TRANG_THAI_MAY = ['DA_DUNG', 'DANG_CHAY', 'KHONG_RO'];
const NHOM_LOI = ['DIEN', 'CO_KHI', 'KHONG_RO'];
const CHUYEN_MON = ['DIEN', 'CO_KHI', 'CA_HAI'];

/** Giá trị hợp lệ của một ô ngày trong Lich_Truc_Thang. */
const MA_CA = { NGAY: 'N', DEM: 'D', CA_HAI: 'ND', NGHI: 'X' };

/**
 * Bảng ca làm việc mặc định, seed sẵn vào sheet Ca_Lam_Viec khi setupSystem().
 * Người dùng sửa trực tiếp trên sheet, KHÔNG cần đụng code.
 *
 * Quy ước: ca đêm = phần bù của ca ngày (từ Ca_Ngay_Den hôm nay đến Ca_Ngay_Tu
 * hôm sau). Nhờ vậy không tồn tại "giờ chết" không thuộc ca nào — đây cũng là
 * lý do CMTX ban đêm để 17:00–07:00 thay vì 18:00–06:00 như mô tả ban đầu.
 */
const CA_MAC_DINH = [
  ['DET',        'Bộ phận Dệt',                      '07:00', '18:00', true],
  ['SOI',        'Bộ phận Sợi',                      '07:00', '17:00', true],
  ['CMTX',       'Bộ phận CMTX',                     '07:00', '17:00', true],
  ['TRANG',      'Bộ phận Trang',                    '07:00', '17:00', false],
  ['MTX',        'Bộ phận MTX',                      '07:00', '17:00', false],
  ['CO',         'Bộ phận CO',                       '07:00', '17:00', false],
  ['ICM',        'Bộ phận ICM',                      '07:00', '17:00', false],
  ['CHUNG',      'Bộ phận Chung',                    '07:00', '17:00', false],
  ['TO_DIEN',    'Tổ điện (Hảo, Phát)',              '06:30', '17:30', true],
  ['TO_CO_KHI',  'Tổ cơ khí (Nhị, Thiện)',           '07:00', '17:00', false],
  ['MAC_DINH',   'Dùng khi không khớp nhóm nào',     '07:00', '17:00', false],
];

// ============================================================================
// 3. HÀM NỀN — truy cập sheet
// ============================================================================

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(ten) {
  const sh = ss_().getSheetByName(ten);
  if (!sh) throw new Error('Không tìm thấy sheet "' + ten + '". Chạy setupSystem() trước.');
  return sh;
}

/**
 * Đọc toàn bộ vùng dữ liệu (bỏ header) của một sheet thành mảng object,
 * key = tên cột trong header. Bỏ các dòng có cột A rỗng.
 */
function docSheet_(tenSheet, header) {
  const sh = sheet_(tenSheet);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  return sh.getRange(2, 1, lastRow - 1, header.length).getValues()
    .filter(function (r) { return r[0] !== '' && r[0] !== null; })
    .map(function (r) {
      const o = {};
      header.forEach(function (h, i) { o[h] = r[i]; });
      return o;
    });
}

/** Tạo sheet nếu chưa có, ghi header, freeze dòng 1. Trả về sheet. */
function taoSheet_(ten, header) {
  const ssx = ss_();
  let sh = ssx.getSheetByName(ten);
  if (!sh) sh = ssx.insertSheet(ten);

  // Sheet mới mặc định chỉ có 26 cột — thêm cột trước khi ghi header dài hơn,
  // nếu không getRange sẽ văng lỗi "out of bounds".
  if (header && header.length > sh.getMaxColumns()) {
    sh.insertColumnsAfter(sh.getMaxColumns(), header.length - sh.getMaxColumns());
  }

  if (header && header.length) {
    sh.getRange(1, 1, 1, header.length).setValues([header])
      .setFontWeight('bold')
      .setBackground('#e8eaed');
    sh.setFrozenRows(1);
  }
  return sh;
}

// ============================================================================
// 4. HÀM NỀN — thời gian
// ============================================================================

function pad2_(n) {
  return (n < 10 ? '0' : '') + n;
}

function nowVN_() {
  return new Date();
}

/** Date → 'yyyy-MM-dd' theo giờ Việt Nam. */
function fmtNgay_(d) {
  return Utilities.formatDate(d, CONFIG.MUI_GIO, 'yyyy-MM-dd');
}

/** Date → 'HH:mm' theo giờ Việt Nam. */
function fmtGio_(d) {
  return Utilities.formatDate(d, CONFIG.MUI_GIO, 'HH:mm');
}

/** Date → 'MM/yyyy' theo giờ Việt Nam. */
function fmtThang_(d) {
  return Utilities.formatDate(d, CONFIG.MUI_GIO, 'MM/yyyy');
}

/** 'HH:mm' → số phút từ 00:00. Trả null nếu chuỗi không hợp lệ. */
function gioSangPhut_(hhmm) {
  const s = chuanHoaGio_(hhmm);
  if (!s) return null;
  return Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
}

/**
 * Chuẩn hoá giá trị giờ đọc từ ô sheet về chuỗi 'HH:mm'.
 * Ô giờ trong Google Sheets có thể trả về Date chứ không phải text, nên phải
 * xử lý cả hai kiểu — đây là nguồn lỗi kinh điển khi đọc cấu hình từ sheet.
 */
function chuanHoaGio_(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.MUI_GIO, 'HH:mm');
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return pad2_(Number(m[1])) + ':' + m[2];
}

/** Số phút giữa 2 Date, làm tròn. Trả '' nếu thiếu mốc. */
function soPhut_(tu, den) {
  if (!(tu instanceof Date) || !(den instanceof Date)) return '';
  return Math.max(0, Math.round((den.getTime() - tu.getTime()) / 60000));
}

// ============================================================================
// 5. CA LÀM VIỆC
// ============================================================================

/** Đọc Ca_Lam_Viec thành map { NHOM_CA: {tu, den, coCaDem} }. */
function docCauHinhCa_() {
  const map = {};
  docSheet_(SHEET.CA, HEADER_CA).forEach(function (r) {
    const ten = String(r.Nhom_Ca).trim().toUpperCase();
    if (!ten) return;
    map[ten] = {
      moTa: r.Mo_Ta,
      tu: gioSangPhut_(r.Ca_Ngay_Tu),
      den: gioSangPhut_(r.Ca_Ngay_Den),
      coCaDem: r.Co_Ca_Dem === true || String(r.Co_Ca_Dem).toUpperCase() === 'TRUE',
    };
  });
  return map;
}

/** Đọc sheet Cau_Hinh thành map { KHOA: 'giá trị' }. Thiếu sheet thì trả {} chứ không lỗi. */
function docCauHinh_() {
  const sh = ss_().getSheetByName(SHEET.CAU_HINH);
  if (!sh || sh.getLastRow() < 2) return {};
  const map = {};
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    const k = String(r[0]).trim().toUpperCase();
    if (k) map[k] = String(r[1] === null || r[1] === undefined ? '' : r[1]).trim();
  });
  return map;
}

/**
 * Xác định thời điểm `khi` thuộc ca nào của nhóm `nhomCa`.
 *
 * Trả về:
 *   { ca: 'N' | 'D' | null, ngayCa: 'yyyy-MM-dd', nhomCa: '...' }
 *
 * - ca 'N'  : trong khung ca ngày.
 * - ca 'D'  : ngoài khung ca ngày VÀ nhóm này có ca đêm.
 * - ca null : ngoài giờ làm việc và nhóm này KHÔNG có ca đêm (vd tổ cơ khí 22h).
 *
 * `ngayCa` là ngày mà ca đó được tính vào. Ca đêm vắt qua nửa đêm: rạng sáng
 * 02:00 vẫn thuộc ca đêm bắt đầu từ CHIỀU HÔM TRƯỚC, nên ngayCa lùi 1 ngày.
 */
function xacDinhCa_(nhomCa, khi, cauHinhCa) {
  const cfg = cauHinhCa || docCauHinhCa_();
  const ten = String(nhomCa || '').trim().toUpperCase();
  const c = cfg[ten] || cfg[CONFIG.NHOM_CA_MAC_DINH];

  if (!c || c.tu === null || c.den === null) {
    return { ca: null, ngayCa: fmtNgay_(khi), nhomCa: ten || CONFIG.NHOM_CA_MAC_DINH };
  }

  const phut = gioSangPhut_(fmtGio_(khi));

  // Trong ca ngày.
  if (phut >= c.tu && phut < c.den) {
    return { ca: MA_CA.NGAY, ngayCa: fmtNgay_(khi), nhomCa: ten };
  }

  // Ngoài ca ngày mà nhóm không làm đêm → không có ca nào đang chạy.
  if (!c.coCaDem) {
    return { ca: null, ngayCa: fmtNgay_(khi), nhomCa: ten };
  }

  // Ca đêm. Nếu đang là rạng sáng (trước giờ vào ca ngày) thì ca này thuộc về
  // ngày hôm trước.
  let ngay = fmtNgay_(khi);
  if (phut < c.tu) {
    ngay = fmtNgay_(new Date(khi.getTime() - 24 * 60 * 60 * 1000));
  }
  return { ca: MA_CA.DEM, ngayCa: ngay, nhomCa: ten };
}

/**
 * Mốc chốt số liệu của một ngày ca: thời điểm mà ngày ca `ngay` kết thúc.
 *
 * Ngày ca `ngay` chạy từ giờ vào ca ngày của `ngay` tới giờ vào ca ngày của hôm
 * sau — đúng biên mà xacDinhCa_() dùng để gán Ngay_Ca. Báo cáo của một ngày đã
 * qua phải dừng cộng dồn ở biên đó, nếu không phiếu chưa ai đóng sẽ tiếp tục
 * đội phút dừng lên mãi và số của ngày cũ đổi mỗi lần mở trang.
 *
 * Ngày hôm nay thì biên còn nằm ở tương lai nên trả về giờ hiện tại — máy vẫn
 * đang dừng thật, chốt sớm là báo thiếu.
 *
 * Dùng giờ vào ca của nhóm MAC_DINH làm biên chung cho cả báo cáo. Vài nhóm vào
 * ca lệch vài chục phút (tổ điện 06:30), nhưng báo cáo ngày là một con số cho cả
 * nhà máy nên phải có một biên duy nhất.
 */
function mocChotNgayCa_(ngay, cauHinhCa) {
  const bayGio = nowVN_();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ngay || ''))) return bayGio;

  const cfg = cauHinhCa || docCauHinhCa_();
  const c = cfg[CONFIG.NHOM_CA_MAC_DINH];
  const phut = c && c.tu !== null && c.tu !== undefined ? c.tu : 7 * 60;

  // Nửa đêm của ngày kế tiếp, cộng thêm giờ vào ca. Cộng phút thay vì dựng chuỗi
  // 'HH:mm' để không phải lo giờ vào ca có phải mốc tròn hay không.
  const hetNgay = new Date(
    new Date(ngay + 'T00:00:00+07:00').getTime() + (24 * 60 + phut) * 60000);

  return hetNgay < bayGio ? hetNgay : bayGio;
}

// ============================================================================
// 6. LỊCH TRỰC
// ============================================================================

/**
 * Đọc lịch trực của một tháng thành map { MA_THO: { '01': 'N', '02': 'ND', ... } }.
 * Trả về null nếu CẢ THÁNG chưa có dòng nào — dấu hiệu "quên tạo lịch tháng mới",
 * để tầng trên biết mà hiện toàn bộ thợ kèm banner cảnh báo thay vì danh sách trống.
 */
function docLichTruc_(thang) {
  const rows = docSheet_(SHEET.LICH, HEADER_LICH).filter(function (r) {
    return chuanHoaThang_(r.Thang) === thang;
  });
  if (!rows.length) return null;

  const map = {};
  rows.forEach(function (r) {
    const maTho = String(r.Ma_Tho).trim();
    if (!maTho) return;
    const ngay = {};
    for (let i = 1; i <= 31; i++) {
      const key = pad2_(i);
      const v = String(r['Ngay_' + key] || '').trim().toUpperCase();
      if (v && v !== MA_CA.NGHI) ngay[key] = v;
    }
    map[maTho] = ngay;
  });
  return map;
}

/** Chuẩn hoá ô Thang về 'MM/yyyy' (ô có thể là Date nếu người dùng gõ dạng ngày). */
function chuanHoaThang_(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return fmtThang_(v);
  return String(v).trim();
}

/**
 * Thợ `maTho` có đăng ký trực ca `ca` ('N'|'D') vào ngày `ngayCa` không?
 * lichThang: kết quả docLichTruc_() của đúng tháng chứa ngayCa.
 */
function coTrucKhong_(lichThang, maTho, ngayCa, ca) {
  if (!lichThang) return false;
  const ngay = lichThang[String(maTho).trim()];
  if (!ngay) return false;
  const v = ngay[ngayCa.slice(8, 10)]; // 'yyyy-MM-dd' → 'dd'
  if (!v) return false;
  return v === ca || v === MA_CA.CA_HAI;
}

// ============================================================================
// 7. MÃ PHIẾU & LOG
// ============================================================================

/**
 * Sinh mã phiếu dạng <tiền tố>-ddMM-###, ### đếm lại từ 001 mỗi ngày.
 * Tiền tố: 'SC' cho sự cố máy, 'CV' cho công việc chung — nhìn mã là biết loại.
 *
 * Đếm trực tiếp trên sheet Su_Co (KHÔNG dùng PropertiesService — giới hạn 500 key).
 * An toàn với archiveOldTickets vì archive chỉ dời phiếu HOAN_THANH cũ hơn
 * SO_THANG_GIU_LAI tháng, còn phiếu trong ngày thì chắc chắn vẫn nằm ở Su_Co.
 *
 * BẮT BUỘC gọi bên trong LockService.
 */
function sinhMaPhieu_(khi, tienTo) {
  const prefix = (tienTo || 'SC') + '-' + Utilities.formatDate(khi, CONFIG.MUI_GIO, 'ddMM') + '-';
  const sh = sheet_(SHEET.SU_CO);
  const lastRow = sh.getLastRow();

  // Lấy SỐ LỚN NHẤT đang có rồi +1, KHÔNG đếm số dòng. Nếu đếm dòng thì chỉ cần
  // một phiếu bị xoá là số kế tiếp sẽ trùng với mã đã cấp trước đó.
  let max = 0;
  if (lastRow >= 2) {
    sh.getRange(2, 1, lastRow - 1, 1).getValues().forEach(function (r) {
      const ma = String(r[0]);
      if (ma.indexOf(prefix) !== 0) return;
      const so = Number(ma.slice(prefix.length));
      if (isFinite(so) && so > max) max = so;
    });
  }
  return prefix + ('00' + (max + 1)).slice(-3);
}

/** Sinh token bí mật cho link cá nhân của thợ. */
function sinhToken_() {
  return Utilities.getUuid().replace(/-/g, '').substring(0, 20);
}

/**
 * Ghi một dòng vào Nhat_Ky_Su_Co (append-only).
 * Không bao giờ để lỗi ghi log làm hỏng nghiệp vụ chính → bọc try/catch.
 */
function ghiNhatKy_(maSuCo, maMay, actor, hanhDong, duLieu, requestId) {
  try {
    sheet_(SHEET.NHAT_KY).appendRow([
      Utilities.getUuid(),
      maSuCo || '',
      maMay || '',
      nowVN_(),
      actor || '',
      hanhDong || '',
      duLieu ? JSON.stringify(duLieu) : '',
      requestId || '',
    ]);
  } catch (err) {
    console.error('Ghi nhật ký thất bại: ' + err.message);
  }
}

// ============================================================================
// 8. setupSystem() — dựng toàn bộ Sheet
// ============================================================================

/**
 * Chạy MỘT LẦN sau khi push code. Tạo đủ 12 sheet, header, dropdown, seed bảng ca
 * và bảng kế hoạch chạy máy.
 * Chạy lại nhiều lần cũng an toàn: sheet đã có thì chỉ ghi lại header, KHÔNG xoá
 * dữ liệu; Ca_Lam_Viec chỉ seed khi còn trống.
 */
function setupSystem() {
  const ketQua = [];

  // --- Danh mục máy ---------------------------------------------------------
  const shMay = taoSheet_(SHEET.MAY, HEADER_MAY);
  shMay.setColumnWidth(2, 220);
  datCheckbox_(shMay, HEADER_MAY.indexOf('Hoat_Dong') + 1);
  ketQua.push(SHEET.MAY);

  // --- Danh mục thợ ---------------------------------------------------------
  const shTho = taoSheet_(SHEET.THO, HEADER_THO);
  shTho.setColumnWidth(2, 180);
  shTho.setColumnWidth(9, 320);
  datDropdown_(shTho, HEADER_THO.indexOf('Chuyen_Mon') + 1, CHUYEN_MON);
  datDropdown_(shTho, HEADER_THO.indexOf('Nhom_Ca') + 1, CA_MAC_DINH.map(function (r) { return r[0]; }));
  datCheckbox_(shTho, HEADER_THO.indexOf('Hoat_Dong') + 1);
  // SĐT phải là text, nếu không Sheets sẽ nuốt số 0 đầu (0912... → 912...).
  shTho.getRange(2, HEADER_THO.indexOf('So_Dien_Thoai') + 1, shTho.getMaxRows() - 1, 1)
    .setNumberFormat('@');
  // Telegram_Chat_ID cũng phải là text. Chat id dài 10–13 chữ số; để dạng số thì
  // Sheets hiển thị thành dạng mũ (1.23457E+11) khi cột hẹp, mà chuanHoaChatId_
  // cố ý CHẶN dạng mũ — gửi tới một id đã bị làm tròn là nhắn nhầm người khác.
  // Quên dòng này thì thợ đó bị bỏ qua im lặng, không ai biết vì sao.
  shTho.getRange(2, HEADER_THO.indexOf('Telegram_Chat_ID') + 1, shTho.getMaxRows() - 1, 1)
    .setNumberFormat('@');
  shTho.setColumnWidth(HEADER_THO.indexOf('Telegram_Chat_ID') + 1, 150);
  ketQua.push(SHEET.THO);

  // --- Ca làm việc ----------------------------------------------------------
  const shCa = taoSheet_(SHEET.CA, HEADER_CA);
  shCa.setColumnWidth(2, 240);
  if (shCa.getLastRow() < 2) {
    // Đặt dạng text TRƯỚC khi ghi, nếu không Sheets sẽ tự đổi '07:00' thành
    // số thập phân (0.2917) ngay lúc setValues và format sau đó đã muộn.
    shCa.getRange(2, 3, CA_MAC_DINH.length, 2).setNumberFormat('@');
    shCa.getRange(2, 1, CA_MAC_DINH.length, HEADER_CA.length).setValues(CA_MAC_DINH);
  }
  datCheckbox_(shCa, HEADER_CA.indexOf('Co_Ca_Dem') + 1);
  ketQua.push(SHEET.CA);

  // --- Kế hoạch chạy máy ----------------------------------------------------
  // Mẫu số của tỉ lệ hiệu dụng A. Chỉ seed khi sheet còn trống — người dùng đã
  // sửa giờ theo kế hoạch sản xuất thì chạy lại setupSystem không được đạp lên.
  const shKH = taoSheet_(SHEET.KE_HOACH, HEADER_KE_HOACH);
  shKH.setColumnWidth(2, 240);
  shKH.setColumnWidth(HEADER_KE_HOACH.indexOf('Ngay_Nghi') + 1, 220);
  shKH.setColumnWidth(HEADER_KE_HOACH.indexOf('Ghi_Chu') + 1, 380);
  if (shKH.getLastRow() < 2) {
    // Cột giờ phải là text TRƯỚC khi ghi, nếu không Sheets đổi '07:00' thành
    // 0.2917 ngay lúc setValues và format sau đó đã muộn.
    shKH.getRange(2, HEADER_KE_HOACH.indexOf('Gio_Bat_Dau') + 1,
      KE_HOACH_MAC_DINH.length, 2).setNumberFormat('@');
    shKH.getRange(2, 1, KE_HOACH_MAC_DINH.length, HEADER_KE_HOACH.length)
      .setValues(KE_HOACH_MAC_DINH);
  }
  // Ô tick: Chay_Ca_Dem + T2..CN. Dùng data validation, KHÔNG dùng
  // insertCheckboxes — hàm đó đặt lại mọi ô thành false, chạy lại setupSystem
  // là xoá sạch kế hoạch tuần đã khai.
  for (let c = HEADER_KE_HOACH.indexOf('Chay_Ca_Dem') + 1;
       c <= HEADER_KE_HOACH.indexOf('CN') + 1; c++) {
    datCheckbox_(shKH, c);
  }
  shKH.getRange(2, HEADER_KE_HOACH.indexOf('Ngay_Nghi') + 1, shKH.getMaxRows() - 1, 2)
    .setWrap(true);
  ketQua.push(SHEET.KE_HOACH);

  // --- Nghỉ trưa và giao ca -------------------------------------------------
  // Tách thành bảng nhiều dòng để một bộ phận có thể khai đủ hai lần giao ca
  // ngày→đêm và đêm→ngày. Không seed giờ giả: giờ giao ca là dữ liệu sản xuất,
  // người vận hành phải khai đúng trước khi dùng A làm KPI.
  const shNgung = taoSheet_(SHEET.KHUNG_NGUNG, HEADER_KHUNG_NGUNG);
  shNgung.setColumnWidth(1, 120);
  shNgung.setColumnWidth(2, 140);
  shNgung.setColumnWidth(12, 360);
  datDropdown_(shNgung, HEADER_KHUNG_NGUNG.indexOf('Loai_Khoang') + 1, LOAI_KHUNG_NGUNG);
  for (let c = HEADER_KHUNG_NGUNG.indexOf('T2') + 1;
       c <= HEADER_KHUNG_NGUNG.indexOf('CN') + 1; c++) {
    datCheckbox_(shNgung, c);
  }
  shNgung.getRange(2, HEADER_KHUNG_NGUNG.indexOf('Gio_Bat_Dau') + 1,
    shNgung.getMaxRows() - 1, 2).setNumberFormat('@');
  shNgung.getRange(1, 1).setNote(
    'Mỗi dòng là một khoảng dừng THEO KẾ HOẠCH của một bộ phận. ' +
    'Loai_Khoang: NGHI_TRUA hoặc GIAO_CA. Có thể khai nhiều dòng GIAO_CA. ' +
    'Không tick thứ nào = áp mọi ngày bộ phận có kế hoạch chạy.');
  ketQua.push(SHEET.KHUNG_NGUNG);

  // --- Cấu hình chung -------------------------------------------------------
  const shCH = taoSheet_(SHEET.CAU_HINH, HEADER_CAU_HINH);
  shCH.setColumnWidth(1, 170);
  shCH.setColumnWidth(2, 170);
  shCH.setColumnWidth(3, 520);
  shCH.getRange(2, 3, shCH.getMaxRows() - 1, 1).setWrap(true);
  // Bổ sung những khoá cấu hình còn THIẾU, không ghi đè giá trị người dùng đã sửa.
  // Không dùng kiểu "chỉ seed khi sheet trống": mỗi lần thêm tính năng mới có thêm
  // khoá mới, mà sheet thì đã có dữ liệu từ lâu — khoá mới sẽ không bao giờ xuất hiện.
  const khoaDaCo = {};
  if (shCH.getLastRow() >= 2) {
    shCH.getRange(2, 1, shCH.getLastRow() - 1, 1).getValues().forEach(function (r) {
      const k = String(r[0]).trim().toUpperCase();
      if (k) khoaDaCo[k] = true;
    });
  }
  const themCH = CAU_HINH_MAC_DINH.filter(function (r) {
    return !khoaDaCo[String(r[0]).trim().toUpperCase()];
  });
  if (themCH.length) {
    const dongDauCH = shCH.getLastRow() + 1;
    // Cột giá trị để dạng text TRƯỚC khi ghi, nếu không SĐT mất số 0 đầu.
    shCH.getRange(dongDauCH, 2, themCH.length, 1).setNumberFormat('@');
    shCH.getRange(dongDauCH, 1, themCH.length, HEADER_CAU_HINH.length).setValues(themCH);
  }
  ketQua.push(SHEET.CAU_HINH + (themCH.length ? ' (+' + themCH.length + ' cấu hình mới)' : ''));

  // --- Lịch trực tháng ------------------------------------------------------
  const shLich = taoSheet_(SHEET.LICH, HEADER_LICH);
  shLich.setFrozenColumns(3);
  // Dropdown N/D/ND/X cho toàn bộ 31 cột ngày → thợ bấm chọn được trên điện thoại.
  datDropdown_(shLich, 4, [MA_CA.NGAY, MA_CA.DEM, MA_CA.CA_HAI, MA_CA.NGHI], 31);
  for (let c = 4; c <= 34; c++) shLich.setColumnWidth(c, 42);
  ketQua.push(SHEET.LICH);

  // --- Sự cố (sheet trung tâm) ---------------------------------------------
  const shSuCo = taoSheet_(SHEET.SU_CO, HEADER_SU_CO);
  shSuCo.setColumnWidth(COT.Mo_Ta + 1, 260);
  shSuCo.setColumnWidth(COT.Noi_Dung_Xu_Ly + 1, 300);
  shSuCo.setColumnWidth(COT.Phu_Tung_Tom_Tat + 1, 260);
  dinhDangCotThoiGian_(shSuCo, [
    COT.Thoi_Gian_Bao + 1, COT.Thoi_Gian_Nhan + 1,
    COT.Thoi_Gian_Hoan_Thanh + 1, COT.Cap_Nhat_Luc + 1,
    COT.Thoi_Gian_Dung_May + 1,
  ]);
  // Ngay_Ca lưu chuỗi 'yyyy-MM-dd'. Không ép dạng text thì Sheets tự đổi thành
  // Date lúc setValues, khiến việc gom nhóm theo ngày ở báo cáo so sánh sai kiểu.
  shSuCo.getRange(2, COT.Ngay_Ca + 1, shSuCo.getMaxRows() - 1, 1).setNumberFormat('@');
  ketQua.push(SHEET.SU_CO);

  // --- Nhật ký + Lưu trữ + Tổng hợp ----------------------------------------
  const shLog = taoSheet_(SHEET.NHAT_KY, HEADER_NHAT_KY);
  dinhDangCotThoiGian_(shLog, [HEADER_NHAT_KY.indexOf('Thoi_Gian') + 1]);
  ketQua.push(SHEET.NHAT_KY);

  taoSheet_(SHEET.LUU_TRU, HEADER_SU_CO); // cùng schema với Su_Co
  ketQua.push(SHEET.LUU_TRU);

  taoSheet_(SHEET.TONG_HOP, null); // nội dung do refreshReports() dựng ở bước 4
  ketQua.push(SHEET.TONG_HOP);

  // Xoá sheet trống mặc định "Sheet1"/"Trang tính1" nếu còn.
  xoaSheetMacDinh_();

  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Đã tạo/cập nhật ' + ketQua.length + ' sheet.', 'setupSystem', 8
  );
  return ketQua;
}

function datDropdown_(sh, cot, giaTri, soCot) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(giaTri, true)
    .setAllowInvalid(false)
    .build();
  sh.getRange(2, cot, sh.getMaxRows() - 1, soCot || 1).setDataValidation(rule);
}

/**
 * Gắn ô tick cho một cột.
 *
 * KHÔNG dùng Range.insertCheckboxes(): hàm đó đặt lại giá trị mọi ô thành false,
 * nên chạy lại setupSystem() sau khi đã nhập dữ liệu sẽ tắt hết Hoat_Dong.
 * Data validation dạng checkbox cho giao diện y hệt mà không đụng tới giá trị.
 */
function datCheckbox_(sh, cot) {
  const rule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
  sh.getRange(2, cot, sh.getMaxRows() - 1, 1).setDataValidation(rule);
}

function dinhDangCotThoiGian_(sh, danhSachCot) {
  danhSachCot.forEach(function (c) {
    sh.getRange(2, c, sh.getMaxRows() - 1, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sh.setColumnWidth(c, 140);
  });
}

function xoaSheetMacDinh_() {
  const ssx = ss_();
  ['Sheet1', 'Trang tính1', 'Trang tinh1'].forEach(function (ten) {
    const sh = ssx.getSheetByName(ten);
    if (sh && sh.getLastRow() === 0 && ssx.getSheets().length > 1) ssx.deleteSheet(sh);
  });
}

// ============================================================================
// 9. createMonthSchedule() — tạo sẵn dòng lịch trực đầu mỗi tháng
// ============================================================================

/**
 * Tạo dòng trống trong Lich_Truc_Thang cho tất cả thợ đang hoạt động, để thợ chỉ
 * việc vào tick N/D/ND. Thợ nào đã có dòng của tháng đó thì bỏ qua (chạy lại
 * nhiều lần không sinh trùng).
 *
 * @param {string} thang 'MM/yyyy'. Bỏ trống = tháng hiện tại.
 */
function createMonthSchedule(thang) {
  const thangCan = thang || fmtThang_(nowVN_());
  if (!/^\d{2}\/\d{4}$/.test(thangCan)) {
    throw new Error('Tháng phải có dạng MM/yyyy, ví dụ 08/2026. Nhận được: ' + thangCan);
  }

  const daCo = {};
  docSheet_(SHEET.LICH, HEADER_LICH).forEach(function (r) {
    if (chuanHoaThang_(r.Thang) === thangCan) daCo[String(r.Ma_Tho).trim()] = true;
  });

  const themMoi = docSheet_(SHEET.THO, HEADER_THO)
    .filter(function (t) { return laTrue_(t.Hoat_Dong) && !daCo[String(t.Ma_Tho).trim()]; })
    .map(function (t) {
      const row = new Array(HEADER_LICH.length).fill('');
      row[0] = thangCan;
      row[1] = t.Ma_Tho;
      row[2] = t.Ten_Tho;
      return row;
    });

  if (!themMoi.length) {
    return 'Tháng ' + thangCan + ': tất cả thợ đang hoạt động đã có dòng lịch, không thêm gì.';
  }

  const sh = sheet_(SHEET.LICH);
  const dongDau = sh.getLastRow() + 1;
  // Cột Thang phải là text TRƯỚC khi ghi, nếu không '08/2026' bị hiểu thành ngày.
  sh.getRange(dongDau, 1, themMoi.length, 1).setNumberFormat('@');
  // Ghi 1 lần bằng setValues thay vì appendRow từng dòng.
  sh.getRange(dongDau, 1, themMoi.length, HEADER_LICH.length).setValues(themMoi);

  return 'Tháng ' + thangCan + ': đã thêm ' + themMoi.length + ' dòng lịch trực.';
}

/** Ô checkbox/TRUE-FALSE của Sheets có thể trả boolean hoặc chuỗi. */
function laTrue_(v) {
  return v === true || String(v).trim().toUpperCase() === 'TRUE';
}

// ============================================================================
// 10. refreshPersonalLinks() — sinh link QR máy + link cá nhân thợ
// ============================================================================

/**
 * Sinh lại cột Link_QR (Danh_Muc_May) và Token + Link_Ca_Nhan (Danh_Muc_Tho).
 * Token đã có thì GIỮ NGUYÊN — sinh lại sẽ làm hỏng mọi link đã phát cho thợ.
 *
 * Cần chạy datWebAppUrl() một lần trước đó.
 */
function refreshPersonalLinks() {
  // Ưu tiên URL wrapper ở domain riêng nếu đã khai; không có thì dùng /exec.
  const baseUrl = layUrlCongKhai_() || layWebAppUrl_();

  // --- Máy ------------------------------------------------------------------
  const shMay = sheet_(SHEET.MAY);
  const soMay = shMay.getLastRow() - 1;
  if (soMay > 0) {
    const may = shMay.getRange(2, 1, soMay, HEADER_MAY.length).getValues();
    const links = may.map(function (r) {
      return [r[0] ? baseUrl + '?may=' + encodeURIComponent(String(r[0]).trim()) : ''];
    });
    shMay.getRange(2, HEADER_MAY.indexOf('Link_QR') + 1, soMay, 1).setValues(links);
  }

  // --- Thợ ------------------------------------------------------------------
  const shTho = sheet_(SHEET.THO);
  const soTho = shTho.getLastRow() - 1;
  let tokenMoi = 0;
  if (soTho > 0) {
    const vung = shTho.getRange(2, 1, soTho, HEADER_THO.length);
    const tho = vung.getValues();
    const iToken = HEADER_THO.indexOf('Token');
    const iLink = HEADER_THO.indexOf('Link_Ca_Nhan');

    tho.forEach(function (r) {
      const maTho = String(r[0]).trim();
      if (!maTho) { r[iToken] = ''; r[iLink] = ''; return; }
      if (!String(r[iToken]).trim()) { r[iToken] = sinhToken_(); tokenMoi++; }
      r[iLink] = baseUrl +
        '?tho=' + encodeURIComponent(maTho) +
        '&token=' + encodeURIComponent(r[iToken]);
    });

    // Ghi lại cả vùng bằng 1 setValues.
    vung.setValues(tho);
  }

  return 'Đã sinh link cho ' + soMay + ' máy và ' + soTho + ' thợ (' +
    tokenMoi + ' token mới).';
}

// ============================================================================
// 11. Nhập danh mục máy từ hệ thống SAPHIA (tuỳ chọn, chạy tay 1 lần)
// ============================================================================

/** Spreadsheet SAPHIA hiện hành — chỉ dùng để import danh sách máy một lần. */
const ID_SHEET_SAPHIA = '1EYb3_8R-4pCtb7x4TCGfPUi5g7CIzaD11BxFlKz_oek';

/**
 * Copy 98 máy từ sheet DM_May của SAPHIA sang Danh_Muc_May, khỏi phải gõ tay.
 * Máy đã có (trùng Ma_May) thì bỏ qua. Hoat_Dong mặc định TRUE.
 * Chỉ đọc bên SAPHIA, không ghi gì sang đó.
 */
function importMayTuSaphia() {
  const shNguon = SpreadsheetApp.openById(ID_SHEET_SAPHIA).getSheetByName('DM_May');
  if (!shNguon) throw new Error('Không tìm thấy sheet DM_May trong Spreadsheet SAPHIA.');

  const lastRow = shNguon.getLastRow();
  if (lastRow < 2) return 'DM_May bên SAPHIA đang trống.';

  const nguon = shNguon.getRange(2, 1, lastRow - 1, 3).getValues() // ma, ten, boPhan
    .filter(function (r) { return String(r[0]).trim(); });

  const daCo = {};
  docSheet_(SHEET.MAY, HEADER_MAY).forEach(function (m) {
    daCo[String(m.Ma_May).trim()] = true;
  });

  const themMoi = nguon
    .filter(function (r) { return !daCo[String(r[0]).trim()]; })
    .map(function (r) {
      return [String(r[0]).trim(), String(r[1]).trim(), String(r[2]).trim(), true, ''];
    });

  if (!themMoi.length) return 'Không có máy mới để nhập (đã có đủ ' + nguon.length + ' máy).';

  const sh = sheet_(SHEET.MAY);
  sh.getRange(sh.getLastRow() + 1, 1, themMoi.length, HEADER_MAY.length).setValues(themMoi);

  return 'Đã nhập ' + themMoi.length + ' máy từ SAPHIA. Chạy refreshPersonalLinks() để sinh Link_QR.';
}

// ============================================================================
// 12. Chuẩn bị danh mục — điền mã thợ còn thiếu + bật Hoat_Dong
// ============================================================================

/**
 * Dọn danh mục sau khi nhập tay, để không phải gõ mã thợ và tick 98 ô thủ công:
 *   - Danh_Muc_Tho: dòng có Ten_Tho nhưng trống Ma_Tho → cấp mã TH01, TH02…
 *                   (bỏ qua mã đã dùng), rồi bật Hoat_Dong.
 *   - Danh_Muc_May: mọi dòng có Ma_May → bật Hoat_Dong.
 *
 * Không đụng tới dòng đã có mã, và không bao giờ TẮT Hoat_Dong của ai — muốn cho
 * một người/máy ngừng hoạt động thì bỏ tick tay, chạy lại hàm này cũng không bật lại.
 */
function chuanBiDanhMuc() {
  const ketQua = [];

  // --- Thợ ------------------------------------------------------------------
  const shTho = sheet_(SHEET.THO);
  const soTho = shTho.getLastRow() - 1;
  if (soTho > 0) {
    const vung = shTho.getRange(2, 1, soTho, HEADER_THO.length);
    const v = vung.getValues();
    const iHD = HEADER_THO.indexOf('Hoat_Dong');

    const daDung = {};
    v.forEach(function (r) {
      const m = String(r[0]).trim().toUpperCase();
      if (m) daDung[m] = true;
    });

    let stt = 1, capMa = 0, bat = 0;
    v.forEach(function (r) {
      if (!String(r[1]).trim()) return; // không có tên thợ → dòng trống, bỏ qua
      if (!String(r[0]).trim()) {
        let ma;
        do { ma = 'TH' + pad2_(stt++); } while (daDung[ma]);
        daDung[ma] = true;
        r[0] = ma;
        capMa++;
      }
      if (!laTrue_(r[iHD])) { r[iHD] = true; bat++; }
    });

    vung.setValues(v);
    ketQua.push('Thợ: cấp ' + capMa + ' mã mới, bật hoạt động ' + bat + ' người.');
  }

  // --- Máy ------------------------------------------------------------------
  const shMay = sheet_(SHEET.MAY);
  const soMay = shMay.getLastRow() - 1;
  if (soMay > 0) {
    const iHD = HEADER_MAY.indexOf('Hoat_Dong') + 1;
    const ma = shMay.getRange(2, 1, soMay, 1).getValues();
    const vungHD = shMay.getRange(2, iHD, soMay, 1);
    const hd = vungHD.getValues();

    let batMay = 0;
    hd.forEach(function (r, i) {
      if (String(ma[i][0]).trim() && !laTrue_(r[0])) { r[0] = true; batMay++; }
    });

    vungHD.setValues(hd);
    ketQua.push('Máy: bật hoạt động ' + batMay + ' máy.');
  }

  return ketQua.join('\n');
}

// ============================================================================
// 13. Sinh lịch trực luân phiên theo tuần
// ============================================================================

/**
 * Các cặp/nhóm đổi ca cho nhau mỗi tuần.
 * Tuần A: nhóm `canhA` trực ca ngày, `canhB` trực ca đêm. Tuần B đảo lại.
 * Sửa danh sách tên ở đây khi nhân sự thay đổi (khớp Ten_Tho trong Danh_Muc_Tho).
 */
const LUAN_PHIEN_TUAN = [
  { ten: 'Tổ điện', canhA: ['Hảo'],            canhB: ['Phát'] },
  { ten: 'CMTX',    canhA: ['Ly'],             canhB: ['Cường'] },
  { ten: 'Dệt',     canhA: ['Dũng', 'Thắng'],  canhB: ['Nhân D', 'Tú'] },
];

/** Thợ không luân phiên — chỉ làm ca ngày, mọi ngày trong tháng. */
const TRUC_CA_NGAY_CO_DINH = ['Nhị', 'Thiện', 'Phúc', 'Nhân M', 'Lam'];

/** Chuẩn hoá tên để so khớp: bỏ dấu cách thừa, chuẩn NFC, không phân biệt hoa thường. */
function chuanHoaTen_(s) {
  return String(s || '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Điền lịch trực cả tháng theo luân phiên tuần.
 *
 * @param {string} thang   'MM/yyyy'. Bỏ trống = tháng hiện tại.
 * @param {string} ngayMoc 'yyyy-MM-dd' — ngày bắt đầu TUẦN A (nên là thứ Hai).
 *                         Các ngày TRƯỚC mốc này để trống, không suy diễn ngược.
 *
 * Ghi đè lịch cũ của tháng đó. Chạy lại nhiều lần cho kết quả y hệt.
 */
function taoLichLuanPhien(thang, ngayMoc) {
  const thangCan = thang || fmtThang_(nowVN_());
  if (!/^\d{2}\/\d{4}$/.test(thangCan)) {
    throw new Error('Tháng phải dạng MM/yyyy, ví dụ 08/2026.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ngayMoc || ''))) {
    throw new Error('Ngày mốc phải dạng yyyy-MM-dd, ví dụ 2026-08-03.');
  }

  // Bảo đảm mọi thợ đang hoạt động đều có dòng trong tháng này.
  createMonthSchedule(thangCan);

  const thangSo = Number(thangCan.slice(0, 2));
  const namSo = Number(thangCan.slice(3));
  const soNgay = new Date(namSo, thangSo, 0).getDate(); // ngày 0 của tháng sau = ngày cuối tháng này
  const moc = new Date(ngayMoc + 'T00:00:00+07:00');

  // --- Ai trực ca gì, ngày nào ----------------------------------------------
  // ca[tenChuanHoa][ngay] = 'N' | 'D'
  const ca = {};
  function dat_(ten, ngay, giaTri) {
    const k = chuanHoaTen_(ten);
    if (!ca[k]) ca[k] = {};
    ca[k][ngay] = giaTri;
  }

  for (let ngay = 1; ngay <= soNgay; ngay++) {
    // Dựng thẳng chuỗi ISO kèm +07:00 thay vì new Date(y, m, d) — không phụ thuộc
    // timezone của server, cùng cách đã dùng ở timeToDate_ bên SAPHIA.
    const dISO = new Date(namSo + '-' + pad2_(thangSo) + '-' + pad2_(ngay) + 'T00:00:00+07:00');
    const lechNgay = Math.round((dISO.getTime() - moc.getTime()) / 86400000);
    if (lechNgay < 0) continue; // trước mốc → để trống

    // 'u' = thứ trong tuần theo ISO (1 = thứ Hai … 7 = Chủ nhật). Dùng formatDate
    // với múi giờ chỉ định thay vì getDay() để không phụ thuộc timezone server.
    if (CONFIG.BO_TRONG_CHU_NHAT &&
        Utilities.formatDate(dISO, CONFIG.MUI_GIO, 'u') === '7') continue;

    const tuanChan = Math.floor(lechNgay / 7) % 2 === 0; // true = tuần A

    LUAN_PHIEN_TUAN.forEach(function (nhom) {
      nhom.canhA.forEach(function (t) { dat_(t, ngay, tuanChan ? MA_CA.NGAY : MA_CA.DEM); });
      nhom.canhB.forEach(function (t) { dat_(t, ngay, tuanChan ? MA_CA.DEM : MA_CA.NGAY); });
    });
    TRUC_CA_NGAY_CO_DINH.forEach(function (t) { dat_(t, ngay, MA_CA.NGAY); });
  }

  // --- Ghi vào sheet ---------------------------------------------------------
  const sh = sheet_(SHEET.LICH);
  const soDong = sh.getLastRow() - 1;
  if (soDong < 1) throw new Error('Sheet Lich_Truc_Thang chưa có dòng nào.');

  const vung = sh.getRange(2, 1, soDong, HEADER_LICH.length);
  const v = vung.getValues();
  const daGan = {};
  let soNguoi = 0;

  v.forEach(function (r) {
    if (chuanHoaThang_(r[0]) !== thangCan) return;
    const k = chuanHoaTen_(r[2]); // Ten_Tho
    const lich = ca[k];
    if (!lich) return;
    for (let ngay = 1; ngay <= 31; ngay++) {
      r[2 + ngay] = ngay <= soNgay && lich[ngay] ? lich[ngay] : '';
    }
    daGan[k] = true;
    soNguoi++;
  });

  vung.setValues(v);

  // Tên khai trong cấu hình mà không tìm thấy trong sheet → báo rõ, đừng im lặng bỏ qua.
  const thieu = Object.keys(ca).filter(function (k) { return !daGan[k]; });

  return 'Tháng ' + thangCan + ': đã xếp lịch cho ' + soNguoi + ' thợ (mốc tuần A: ' + ngayMoc + ').' +
    (thieu.length ? '\n⚠️ Không tìm thấy trong Danh_Muc_Tho: ' + thieu.join(', ') : '');
}

// ============================================================================
// 14. Menu tuỳ chỉnh trong Google Sheet
// ============================================================================

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🔧 Bảo trì')
    .addItem('1. Cài đặt hệ thống', 'menuCaiDat')
    .addItem('2. Nhập danh mục máy từ SAPHIA', 'menuNhapMay')
    .addItem('3. Điền mã thợ + bật hoạt động', 'menuChuanBiDanhMuc')
    .addItem('4. Sinh lại link QR / link cá nhân', 'menuSinhLink')
    .addItem('5. 🖨️ In mã QR (máy và thợ)', 'menuInQr')
    .addItem('6. Cập nhật danh mục máy MTX', 'menuCapNhatMTX')
    .addItem('7. Thêm máy mới vào danh mục', 'menuThemMay')
    .addSeparator()
    .addItem('📅 Tạo dòng lịch trực tháng này', 'menuTaoLichThang')
    .addItem('🔁 Xếp lịch luân phiên theo tuần', 'menuTaoLichLuanPhien')
    .addItem('🕒 Khai báo giờ chạy / nghỉ / giao ca', 'menuMoKeHoachKhaDung')
    .addSeparator()
    .addItem('📋 Báo cáo trong ngày', 'menuBaoCaoNgay')
    .addItem('➕ Bù phiếu dừng máy (thợ quên quét)…', 'menuBuPhieuDungMay')
    .addItem('📊 Cập nhật báo cáo tổng hợp', 'menuBaoCao')
    .addItem('🎯 Tính lại KPI đáp ứng của thợ', 'menuTinhLaiKpi')
    .addItem('📤 Xuất báo cáo (chọn ngày, bộ phận, thợ)…', 'menuXuatBaoCao')
    .addItem('📈 Báo cáo tỉ lệ khả dụng máy…', 'menuBaoCaoKhaDung')
    .addItem('🗄️ Dọn phiếu cũ sang Lưu trữ', 'menuLuuTru')
    .addItem('⏰ Cài trigger tự chạy', 'menuCaiTrigger')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('📨 Thông báo Telegram')
      .addItem('Lấy Telegram ID của thợ', 'menuLayTelegramId')
      .addItem('Gửi tin thử cho một thợ…', 'menuGuiThu'))
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('🧹 Dọn dữ liệu (Admin)')
      .addItem('Xoá phiếu theo mã…', 'menuXoaPhieuTheoMa')
      .addItem('Dọn sạch dữ liệu chạy thử…', 'menuDonSachDuLieuThu')
      .addSeparator()
      .addItem('🗑️ Mở thùng rác', 'menuMoThungRac'))
    .addSeparator()
    .addItem('🧪 Chạy test logic', 'menuChayTest')
    .addItem('⏱️ Đo tải hệ thống', 'menuDoTai')
    .addToUi();
}

/**
 * Tên hàm xử lý menu KHÔNG được kết thúc bằng dấu gạch dưới — Apps Script coi đó
 * là hàm private và từ chối gọi từ giao diện.
 */
function chayVaBao_(tieuDe, ham) {
  const ui = SpreadsheetApp.getUi();
  try {
    ui.alert(tieuDe, String(ham() || 'Xong.'), ui.ButtonSet.OK);
  } catch (err) {
    ui.alert('Lỗi', err.message, ui.ButtonSet.OK);
  }
}

function menuCaiDat() {
  chayVaBao_('Cài đặt hệ thống', function () {
    return 'Đã tạo/cập nhật các sheet: ' + setupSystem().join(', ');
  });
}

function menuNhapMay() { chayVaBao_('Nhập danh mục máy', importMayTuSaphia); }
function menuChuanBiDanhMuc() { chayVaBao_('Chuẩn bị danh mục', chuanBiDanhMuc); }
function menuSinhLink() { chayVaBao_('Sinh link', refreshPersonalLinks); }
function menuTaoLichThang() { chayVaBao_('Tạo lịch trực', function () { return createMonthSchedule(); }); }

/** Mở thẳng hai sheet cấu hình A; không sinh lại QR hay đụng dữ liệu phiếu. */
function menuMoKeHoachKhaDung() {
  const ssx = ss_();
  const sh = ssx.getSheetByName(SHEET.KE_HOACH);
  if (!sh || !ssx.getSheetByName(SHEET.KHUNG_NGUNG)) {
    SpreadsheetApp.getUi().alert('Chưa có bảng cấu hình',
      'Chạy “1. Cài đặt hệ thống” một lần để tạo Ke_Hoach_Chay_May và ' +
      'Khung_Ngung_Ke_Hoach.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  ssx.setActiveSheet(sh);
  SpreadsheetApp.getActive().toast(
    'Khai giờ chạy ở Ke_Hoach_Chay_May; nghỉ trưa và giao ca ở Khung_Ngung_Ke_Hoach.',
    'Tỉ lệ khả dụng A', 8);
}

function menuLuuTru() { chayVaBao_('Dọn phiếu cũ', archiveOldTickets); }
function menuCaiTrigger() { chayVaBao_('Cài trigger', caiDatTrigger); }
function menuTinhLaiKpi() { chayVaBao_('Tính lại KPI đáp ứng', tinhLaiKpiTho); }

function menuBaoCao() {
  const ui = SpreadsheetApp.getUi();
  const macDinh = fmtThang_(nowVN_());
  const h = ui.prompt('Cập nhật báo cáo tổng hợp',
    'Tháng cần tổng hợp (MM/yyyy):\n(Enter để dùng ' + macDinh + ')', ui.ButtonSet.OK_CANCEL);
  if (h.getSelectedButton() !== ui.Button.OK) return;

  chayVaBao_('Báo cáo tổng hợp', function () {
    return refreshReports(h.getResponseText().trim() || macDinh);
  });
}

/**
 * Mở hộp thoại chọn kỳ / bộ phận / thợ. Hộp thoại tự gọi layDuLieuHopXuat() rồi
 * chayXuatBaoCao() qua google.script.run, và hiện luôn link file ngay trong đó —
 * ui.alert chỉ hiện được chữ, bấm vào link không mở được.
 */
function menuXuatBaoCao() {
  const html = HtmlService.createHtmlOutputFromFile('HopXuat')
    .setWidth(560).setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Xuất báo cáo');
}

/**
 * Bù một khoảng máy nằm im mà thợ quên quét "Dừng máy".
 *
 * Bốn câu hỏi rồi một màn xác nhận — cố ý bắt xác nhận, vì đây là thêm số liệu
 * vào quá khứ và bù chồng lên phiếu có sẵn là downtime bị đếm hai lần.
 */
function menuBuPhieuDungMay() {
  const ui = SpreadsheetApp.getUi();

  function hoi_(tieuDe, noiDung) {
    const h = ui.prompt(tieuDe, noiDung, ui.ButtonSet.OK_CANCEL);
    return h.getSelectedButton() === ui.Button.OK ? h.getResponseText().trim() : null;
  }

  const maMay = hoi_('Bù phiếu dừng máy — 1/4',
    'Mã máy (đúng như trong Danh_Muc_May, ví dụ TN01):');
  if (maMay === null) return;

  const may = timMay_(maMay);
  if (!may) {
    ui.alert('Không tìm thấy máy "' + maMay + '" trong Danh_Muc_May.');
    return;
  }

  const tuLuc = hoi_('Bù phiếu dừng máy — 2/4',
    'Máy BẮT ĐẦU nằm im lúc nào?\nDạng: yyyy-MM-dd HH:mm\nVí dụ: 2026-08-18 17:27');
  if (tuLuc === null) return;

  const denLuc = hoi_('Bù phiếu dừng máy — 3/4',
    'Máy CHẠY LẠI lúc nào?\nDạng: yyyy-MM-dd HH:mm\nVí dụ: 2026-08-20 08:52\n\n' +
    '⚠️ Máy VẪN ĐANG DỪNG tới bây giờ thì để TRỐNG rồi bấm OK — phiếu sẽ để mở, ' +
    'đóng sau bằng nút "Máy đã chạy lại".');
  if (denLuc === null) return;

  const lyDo = hoi_('Bù phiếu dừng máy — 4/4',
    'Lý do dừng:\n(Enter để dùng "Chờ phụ tùng / sửa chữa ngoài")');
  if (lyDo === null) return;

  const goi = { maMay: maMay, tuLuc: tuLuc, denLuc: denLuc, lyDo: lyDo };

  let kq = buPhieuDungMay(goi);

  // Có phiếu cũ phủ lên khoảng này → hỏi lại cho chắc rồi mới ghi.
  if (!kq.ok && kq.trungLap) {
    const ds = kq.trungLap.map(function (x) {
      return '  • ' + x.ma + ': ' + x.tu + ' → ' + x.den;
    }).join('\n');
    const tra = ui.alert('Khoảng này đã có phiếu phủ lên',
      'Máy ' + String(may.Ten_May).trim() + ' đã có phiếu làm nó nằm im trong khoảng ' +
      'anh định bù:\n\n' + ds + '\n\nBù tiếp là thời gian dừng bị đếm HAI LẦN.\n\n' +
      'Vẫn bù chứ?', ui.ButtonSet.YES_NO);
    if (tra !== ui.Button.YES) return;

    goi.boQuaTrung = true;
    kq = buPhieuDungMay(goi);
  }

  if (!kq.ok) {
    ui.alert('Không bù được', kq.error, ui.ButtonSet.OK);
    return;
  }

  const gio = Math.round(kq.phut / 6) / 10;
  ui.alert('Đã bù xong',
    'Phiếu ' + kq.maSuCo + ' — ' + kq.tenMay + '\n' +
    tuLuc + '  →  ' + (kq.conDung ? '(vẫn đang dừng)' : denLuc) + '\n' +
    'Máy nằm im: ' + kq.phut + ' phút (' + gio + ' giờ)' +
    (kq.conDung ? ' và đang đếm tiếp' : '') + '\n\n' +
    (kq.conDung
      ? 'Phiếu để MỞ. Khi máy chạy lại, quét QR máy đó rồi bấm "Máy đã chạy lại" ' +
        'để chốt giờ.\n\n'
      : '') +
    'Phiếu đã ghi là "bù thủ công", có lưu vết trong Nhat_Ky_Su_Co.',
    ui.ButtonSet.OK);
}

function menuTaoLichLuanPhien() {
  const ui = SpreadsheetApp.getUi();
  const thangMD = fmtThang_(nowVN_());

  const h1 = ui.prompt('Xếp lịch luân phiên — bước 1/2',
    'Tháng cần xếp (MM/yyyy):\n(Enter để dùng ' + thangMD + ')', ui.ButtonSet.OK_CANCEL);
  if (h1.getSelectedButton() !== ui.Button.OK) return;
  const thang = h1.getResponseText().trim() || thangMD;

  const h2 = ui.prompt('Xếp lịch luân phiên — bước 2/2',
    'Ngày bắt đầu TUẦN A (yyyy-MM-dd), nên là thứ Hai.\n' +
    'Các ngày trước mốc này sẽ để trống.', ui.ButtonSet.OK_CANCEL);
  if (h2.getSelectedButton() !== ui.Button.OK) return;

  chayVaBao_('Xếp lịch luân phiên', function () {
    return taoLichLuanPhien(thang, h2.getResponseText().trim());
  });
}
