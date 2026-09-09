/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * THÔNG BÁO TELEGRAM — nhắc thợ khi có phiếu chưa ai nhận.
 *
 * Bệnh cần chữa: công nhân báo sự cố xong thì màn hình hiện danh bạ thợ trực để
 * gọi điện, nhưng rất nhiều người quên gọi. Phiếu nằm ở CHO_NHAN mà không ai
 * biết, máy nằm im. Xem TASK_THONG_BAO_TELEGRAM.md, phương án chốt 09/09/2026.
 *
 * BƯỚC B1 — file này HIỆN CHỈ CÓ PHẦN SOẠN TIN, chưa có phần gửi.
 * Chưa có UrlFetchApp, chưa có công tắc, chưa có cầu chì, chưa móc vào file nào
 * đang chạy. Các phần đó là B3 tới B7.
 *
 * ⚠️ MỌI HÀM TRONG FILE NÀY PHẢI THUẦN — chỉ nhận mảng, chuỗi và Date.
 * Không đọc sheet, không gọi mạng, KHÔNG dùng cả `Utilities`: bước B2 nạp thẳng
 * file này vào node để kiểm thử tại máy, mà `Utilities` chỉ tồn tại trong Apps
 * Script. Đó cũng là lý do có `gioVN_` riêng ở dưới thay vì gọi `fmtGio_`.
 *
 * Khi thêm phần gửi ở B3, đặt nó ở CUỐI file và giữ nguyên tính thuần của nhóm
 * hàm soạn tin — ranh giới này chính là thứ làm bộ kiểm thử chạy được tại máy.
 */

// ============================================================================
// 1. HÀM PHỤ THUẦN
// ============================================================================

/**
 * Date → 'HH:mm' giờ Việt Nam, không mượn `Utilities`.
 *
 * Cộng cứng 7 giờ vào mốc UTC rồi đọc bằng các hàm getUTC*. Cách này cho ra kết
 * quả giống hệt nhau ở Apps Script và ở node bất kể máy chạy múi giờ nào — đúng
 * mẹo `timeToDate_` bên SAPHIA đã dùng để né lỗi lệch giờ.
 *
 * Việt Nam không có giờ mùa hè nên chênh lệch +07:00 là hằng số, không phải xấp xỉ.
 */
function gioVN_(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  const t = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  const hai = function (n) { return (n < 10 ? '0' : '') + n; };
  return hai(t.getUTCHours()) + ':' + hai(t.getUTCMinutes());
}

/** Ô sheet → chuỗi đã cắt khoảng trắng. Ô rỗng, null, undefined đều ra ''. */
function chuoi_(v) {
  return (v === null || v === undefined) ? '' : String(v).trim();
}

/**
 * Số phút từ `tu` đến `den`, làm tròn xuống. Thiếu mốc nào thì trả 0.
 *
 * Trả 0 chứ không trả âm khi giờ ngược nhau: số phút này chỉ để in vào tin nhắn
 * cho thợ đọc, in ra số âm thì người đọc mất tin tưởng vào cả cái bot.
 */
function phutGiua_(tu, den) {
  if (!(tu instanceof Date) || isNaN(tu.getTime())) return 0;
  if (!(den instanceof Date) || isNaN(den.getTime())) return 0;
  const p = Math.floor((den.getTime() - tu.getTime()) / 60000);
  return p > 0 ? p : 0;
}

/** Nối các dòng, tự bỏ dòng rỗng — nhờ vậy ô trống không để lại dòng trắng. */
function ghepDong_(ds) {
  return ds.filter(function (d) { return chuoi_(d) !== ''; }).join('\n');
}

/**
 * Nối các KHỐI, cách nhau một dòng trắng, khối rỗng thì bỏ luôn cả dòng trắng.
 *
 * Cần hàm riêng vì `ghepDong_` lọc sạch chuỗi rỗng nên không cách dòng bằng nó
 * được. Dòng trắng tách phần mô tả sự cố khỏi dòng bấm nhận việc, đúng mẫu ở
 * mục 4.3 — trên điện thoại thì chỗ ngắt đó là thứ giúp mắt tìm ra cái link.
 */
function ghepKhoi_(ds) {
  return ds.filter(function (d) { return chuoi_(d) !== ''; }).join('\n\n');
}

/**
 * Dòng tiêu đề dùng chung cho cả tin báo mới lẫn hai tin nhắc: 'MÁY DỆT 12 (DET)'.
 * Thiếu bộ phận thì bỏ luôn cặp ngoặc, thiếu cả tên máy thì lùi về mã máy.
 */
function tenMayDayDu_(v) {
  const ten = chuoi_(v[COT.Ten_May]) || chuoi_(v[COT.Ma_May]);
  const bp = chuoi_(v[COT.Bo_Phan]);
  return bp ? (ten + ' (' + bp + ')') : ten;
}

// ============================================================================
// 2. BA HÀM SOẠN TIN
// ============================================================================
//
// Nội dung bám mục 4.3 của TASK_THONG_BAO_TELEGRAM.md.
//
// Cả ba trả về VĂN BẢN TRƠN, cố ý không dùng parse_mode của Telegram. Mô tả sự
// cố do công nhân gõ tay, có thể chứa dấu `<`, `*`, `_`; bật Markdown hay HTML
// lên là Telegram trả lỗi 400 hoặc hiển thị sai. Văn bản trơn thì không phải
// thoát ký tự nào, và cũng không có đường cho nội dung người dùng nhập chen mã
// định dạng vào tin. Khi viết phần gửi ở B3, ĐỪNG thêm parse_mode.
//
// `link` là cột Link_Ca_Nhan của Danh_Muc_Tho — mỗi thợ nhận link của riêng mình,
// mở thẳng trang thợ, không phải đăng nhập. Thợ chưa ghép link thì dòng đó tự
// biến mất, tin vẫn gửi được (rào 5.4: thiếu dữ liệu là bình thường, không phải lỗi).

/**
 * Tin lớp 1 — gửi ngay lúc công nhân báo, cho thợ đang trực nấc 1.
 *
 * Dòng nhóm lỗi và dòng mô tả tự biến mất khi ô rỗng. Cần thế vì phiếu DUNG_MAY
 * (máy dừng không do hư hỏng) không có nhóm lỗi, in ra sẽ thừa một dòng trắng.
 */
function soanTinSuCoMoi_(v, link) {
  const moTa = chuoi_(v[COT.Mo_Ta]);
  const gio = gioVN_(v[COT.Thoi_Gian_Bao]);
  const ma = chuoi_(v[COT.Ma_Su_Co]);

  return ghepKhoi_([
    ghepDong_([
      '🔴 ' + tenMayDayDu_(v) + ' đã dừng',
      chuoi_(v[COT.Nhom_Loi]),
      moTa ? ('"' + moTa + '"') : '',
      [gio ? ('Báo lúc ' + gio) : '', ma ? ('phiếu ' + ma) : '']
        .filter(function (x) { return x; }).join(' · '),
    ]),
    chuoi_(link) ? ('➡️ Bấm để nhận việc: ' + chuoi_(link)) : '',
  ]);
}

/**
 * Tin báo đã có người nhận, gửi cho NHỮNG NGƯỜI CÒN LẠI trong ca trực.
 *
 * Đây là thứ thay cho nút "chuyển việc cho người trực cùng ca" đã bị bác ở mục 2
 * của tài liệu: gửi cho cả ca rồi ai bấm trước thì người kia được báo ngay, nên
 * không còn cảnh hai thợ cùng chạy tới một máy hoặc cùng tưởng người kia lo rồi.
 */
function soanTinDaNhan_(v) {
  const tenTho = chuoi_(v[COT.Ten_Tho]) || 'Một thợ khác';
  const ma = chuoi_(v[COT.Ma_Su_Co]);
  const gio = gioVN_(v[COT.Thoi_Gian_Nhan]);

  return '✅ ' + tenTho + ' đã nhận ' + (ma || 'phiếu này') +
    (gio ? (' lúc ' + gio) : '') + '. Bạn không cần xử lý.';
}

/**
 * Tin lớp 2 và lớp 3 — phiếu quá ngưỡng mà vẫn chưa ai nhận.
 *
 * `lan` là 1 hoặc 2, `khi` là mốc thời gian đang xét (thường là lúc trigger chạy).
 * Số phút máy nằm im tính từ Thoi_Gian_Bao tới `khi` — con số này mới là thứ làm
 * người đọc thấy gấp, gắt lời không bằng.
 *
 * Lần 2 kèm SDT_KHAN_CAP theo lớp 3 mục 4.4. Chưa khai số đó thì dòng tự biến mất.
 * Mỗi phiếu tối đa hai lần nhắc, đời đời — chặn ở phần trigger B7, không ở đây.
 */
function soanTinNhac_(v, lan, khi, link, sdtKhanCap) {
  const ma = chuoi_(v[COT.Ma_Su_Co]);
  const phut = phutGiua_(v[COT.Thoi_Gian_Bao], khi);
  const lanHai = Number(lan) === 2;
  const sdt = chuoi_(sdtKhanCap);

  return ghepKhoi_([
    ghepDong_([
      (lanHai ? '🚨 CHƯA AI NHẬN — ' : '⏰ Nhắc lần 1 — ') + tenMayDayDu_(v),
      ma ? ('Phiếu ' + ma + ' vẫn chưa có thợ nhận.') : 'Phiếu vẫn chưa có thợ nhận.',
      'Máy đã nằm im ' + phut + ' phút.',
    ]),
    ghepDong_([
      chuoi_(link) ? ('➡️ Bấm để nhận việc: ' + chuoi_(link)) : '',
      (lanHai && sdt) ? ('☎️ Không xử lý được thì gọi số khẩn cấp: ' + sdt) : '',
    ]),
  ]);
}
