/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * ĐO TẢI — chạy trên DỮ LIỆU THẬT nhưng CHỈ ĐỌC, không ghi dòng nào vào Sheet.
 *
 * Chạy: menu 🔧 Bảo trì → "⏱️ Đo tải hệ thống".
 *
 * Vì sao cần: đo bằng cách bắn request từ ngoài vào /exec chỉ đo được tầng dựng
 * trang, mà doGet() không đọc Sheet dòng nào nên số đó luôn đẹp và vô nghĩa.
 * Chi phí thật nằm ở các hàm RPC bên dưới, và ở chỗ chúng có phải xếp hàng qua
 * LockService hay không.
 */

/** Đo một việc `lan` lần, trả về số mili giây trung bình. */
function doMs_(lan, viec) {
  const t0 = Date.now();
  for (let i = 0; i < lan; i++) viec();
  return Math.round((Date.now() - t0) / lan);
}

function chayDoTaiTrong() {
  const LAN = 3;
  const dong = [];

  // --- Quy mô dữ liệu hiện tại ----------------------------------------------
  const shSuCo = sheet_(SHEET.SU_CO);
  const soPhieu = Math.max(0, shSuCo.getLastRow() - 1);
  const soMay = docSheet_(SHEET.MAY, HEADER_MAY).length;
  const dsTho = docSheet_(SHEET.THO, HEADER_THO)
    .filter(function (t) { return String(t.Ma_Tho).trim() && laTrue_(t.Hoat_Dong); });

  dong.push('QUY MÔ HIỆN TẠI');
  dong.push('  Phiếu trong Su_Co : ' + soPhieu);
  dong.push('  Máy               : ' + soMay);
  dong.push('  Thợ đang hoạt động: ' + dsTho.length);
  dong.push('');

  const may = docSheet_(SHEET.MAY, HEADER_MAY)[0];
  const tho = dsTho[0];
  if (!may || !tho) return dong.join('\n') + '\nThiếu dữ liệu máy hoặc thợ để đo.';

  // --- Chi phí từng phần ----------------------------------------------------
  const msDocPhieu = doMs_(LAN, function () { docSuCoGanDay_(); });
  const msTimMay = doMs_(LAN, function () { timMay_(may.Ma_May); });
  const msDanhBa = doMs_(LAN, function () { getOnDutyContacts_(may.Bo_Phan, 'CO_KHI'); });
  const msSinhMa = doMs_(LAN, function () { sinhMaPhieu_(nowVN_(), 'SC'); });

  dong.push('CHI PHÍ TỪNG PHẦN (trung bình ' + LAN + ' lần)');
  dong.push('  Đọc ' + SO_DONG_QUET_GAN_DAY + ' dòng cuối Su_Co : ' + msDocPhieu + ' ms');
  dong.push('  Tra danh mục máy             : ' + msTimMay + ' ms');
  dong.push('  Dựng danh bạ thợ trực        : ' + msDanhBa + ' ms');
  dong.push('  Sinh mã phiếu                : ' + msSinhMa + ' ms');
  dong.push('');

  // --- Chi phí trọn một lượt gọi --------------------------------------------
  const msMoTrang = doMs_(LAN, function () { getWorkerBootstrap(may.Ma_May); });
  const msTrangTho = doMs_(LAN, function () {
    getTechnicianBootstrap(tho.Ma_Tho, tho.Token);
  });

  dong.push('TRỌN MỘT LƯỢT GỌI');
  dong.push('  Công nhân mở trang báo sự cố : ' + msMoTrang + ' ms');
  dong.push('  Thợ mở / bấm Làm mới         : ' + msTrangTho + ' ms');
  dong.push('');

  // --- Điểm nghẽn thật: thời gian giữ khoá ----------------------------------
  // reportIncident giữ khoá đúng phần: đọc chống trùng + sinh mã + ghi 1 dòng.
  // Ghi một dòng vào Sheet thực tế tốn khoảng 150–300 ms, lấy 250 ms để ước lượng.
  const MS_GHI_UOC = 250;
  const giuKhoa = msDocPhieu + msSinhMa + MS_GHI_UOC;
  const soNguoiTruocKhiNgheo = Math.floor((CONFIG.KHOA_CHO_GIAY * 1000) / giuKhoa);

  dong.push('ĐIỂM NGHẼN — LOCKSERVICE');
  dong.push('  Mỗi lượt GỬI phiếu giữ khoá khoảng : ' + giuKhoa + ' ms');
  dong.push('  Khoá là toàn cục → mọi người gửi phiếu phải xếp hàng qua nó.');
  dong.push('  Chờ tối đa trước khi báo bận       : ' + CONFIG.KHOA_CHO_GIAY + ' s');
  dong.push('  → Chịu được khoảng ' + soNguoiTruocKhiNgheo +
    ' người GỬI CÙNG LÚC trước khi người cuối hàng bị báo "Hệ thống đang bận".');
  dong.push('');
  dong.push('  Lưu ý: MỞ trang và bấm Làm mới KHÔNG giành khoá, nên dù bao nhiêu');
  dong.push('  người cùng mở cũng không làm chậm bên thợ. Chỉ thao tác GHI mới xếp hàng.');

  const bao = dong.join('\n');
  console.log(bao);
  return bao;
}

function menuDoTai() { chayVaBao_('Đo tải hệ thống', chayDoTaiTrong); }
