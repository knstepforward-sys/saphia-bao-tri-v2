/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * THÔNG BÁO TELEGRAM — nhắc thợ khi có phiếu chưa ai nhận.
 *
 * Bệnh cần chữa: công nhân báo sự cố xong thì màn hình hiện danh bạ thợ trực để
 * gọi điện, nhưng rất nhiều người quên gọi. Phiếu nằm ở CHO_NHAN mà không ai
 * biết, máy nằm im. Xem TASK_THONG_BAO_TELEGRAM.md, phương án chốt 09/09/2026.
 *
 * ĐẾN HẾT BƯỚC B5. File có phần soạn tin, phần gửi, công tắc, cầu chì và hai mục
 * menu. Cột `Telegram_Chat_ID` với ba khoá `Cau_Hinh` đã có trong `Code.gs`.
 * CHƯA MÓC VÀO LUỒNG ĐANG CHẠY — ngoài hai mục menu người tự bấm, chưa chỗ nào
 * gọi tới đây. Còn lại: ba chỗ móc trong `CongNhan.gs` và `LuongTho.gs` (B6),
 * trigger nhắc (B7).
 *
 * ⚠️ RANH GIỚI QUAN TRỌNG NHẤT CỦA FILE NÀY nằm giữa mục 3 và mục 4.
 *
 * Mọi hàm ở mục 1, 2 và 3 đều THUẦN — chỉ nhận mảng, chuỗi và Date. Không đọc
 * sheet, không gọi mạng, KHÔNG dùng cả `Utilities`, vì `kiemtra/thongbao.js` nạp
 * thẳng file này vào node mà `Utilities` chỉ tồn tại trong Apps Script. Đó cũng
 * là lý do có `gioVN_` riêng ở dưới thay vì gọi `fmtGio_` bên `Code.gs`.
 *
 * Từ mục 4 trở xuống mới được đụng tới `PropertiesService`, `CacheService`,
 * `UrlFetchApp`, `SpreadsheetApp`. Kéo một lời gọi như vậy ngược lên trên là
 * mất khả năng kiểm thử tại máy — lớp 5 của bộ kiểm tra soi mã nguồn từng hàm
 * thuần và sẽ báo đỏ ngay, kèm tên hàm và tên thứ bị cấm.
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
// định dạng vào tin. Phần gửi ở mục 5 cố ý KHÔNG đặt `parse_mode`; đừng thêm vào.
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

// ============================================================================
// 3. HÀM THUẦN PHỤC VỤ PHẦN GỬI
// ============================================================================
//
// Ba hàm dưới đây cũng thuần, cố ý tách khỏi `guiTelegram_` để kiểm thử được tại
// máy: chúng chứa phần dễ sai nhất của phần gửi — quyết định khi nào bật cầu chì,
// cắt tin quá dài, nhận diện chat id hợp lệ. Bóc ba thứ đó ra rồi thì
// `guiTelegram_` chỉ còn lại phần vỏ gọi mạng, vốn không kiểm thử tại máy được.

/**
 * Chuẩn hoá chat id đọc từ sheet.
 *
 * Chat id là số nguyên và có thể ÂM — nhóm với kênh mang id âm. Ô nào không ra
 * số nguyên sạch thì trả rỗng, coi như thợ chưa ghép, đúng rào 5.4. Sheets đọc ô
 * số lớn ra dạng mũ nếu người dùng dán đè định dạng, nên phép kiểm này cũng chặn
 * luôn chuyện gửi tới một id đã bị làm tròn sai.
 */
function chuanHoaChatId_(v) {
  const s = chuoi_(v);
  return /^-?\d{1,20}$/.test(s) ? s : '';
}

/**
 * Cắt tin cho vừa giới hạn 4096 ký tự của Telegram.
 *
 * Mô tả sự cố là ô gõ tự do nên dài bao nhiêu cũng được. Vượt giới hạn thì
 * Telegram trả lỗi 400 và mất TRỌN tin — thợ không nhận được gì cả, tệ hơn hẳn
 * nhận một tin bị cắt đuôi.
 */
function catTin_(s, toiDa) {
  const gh = toiDa || 4000;
  const t = String(s === null || s === undefined ? '' : s);
  return t.length <= gh ? t : (t.slice(0, gh - 1) + '…');
}

/**
 * Loạt mã HTTP vừa nhận có đáng bật cầu chì 10 phút hay không.
 *
 * Cố ý PHÂN BIỆT hai kiểu hỏng vì chúng cần hai cách xử khác hẳn nhau:
 *
 * - 429 (Telegram chặn tốc độ) và 5xx (Telegram lỗi) hỏng ở PHÍA HỆ THỐNG. Gọi
 *   tiếp cũng hỏng, mà mỗi lần gọi là một người phải chờ. Bật cầu chì.
 * - 400 và 403 hỏng ở MỘT chat id cụ thể: ghép nhầm id, hoặc thợ chưa bấm Start
 *   với bot nên bot không được phép nhắn. Chỉ mình người đó không nhận được tin;
 *   bật cầu chì vì chuyện đó là cắt tin của cả 14 người còn lại.
 *
 * Mảng rỗng nghĩa là lời gọi ném lỗi trước khi kịp có mã nào — chỗ gọi tự bật.
 */
function nenBatCauChi_(dsMa) {
  const ds = dsMa || [];
  for (let i = 0; i < ds.length; i++) {
    const ma = Number(ds[i]);
    if (ma === 429 || ma >= 500) return true;
  }
  return false;
}

/**
 * Bóc danh sách người đã nhắn cho bot ra khỏi kết quả `getUpdates`.
 *
 * Trả về mảng `{ id, ten, username }`, mỗi chat id ĐÚNG MỘT LẦN dù người đó nhắn
 * mấy tin. Thuần nên kiểm thử được tại máy, và đó là chỗ đáng kiểm: hình dạng
 * JSON của Telegram lồng ba tầng, mà mỗi bản cập nhật lại có thể là `message`,
 * `edited_message` hay thứ khác — tra sai một tầng là ra danh sách rỗng mà không
 * có lỗi nào để lần.
 */
function gomChatIdTuUpdates_(ketQua) {
  const ds = (ketQua && ketQua.result) || [];
  const daCo = {};
  const ra = [];
  ds.forEach(function (u) {
    const tin = u && (u.message || u.edited_message || u.channel_post);
    const chat = tin && tin.chat;
    const id = chat ? chuanHoaChatId_(chat.id) : '';
    if (!id || daCo[id]) return;
    daCo[id] = true;
    ra.push({
      id: id,
      ten: [chuoi_(chat.first_name), chuoi_(chat.last_name)]
        .filter(function (x) { return x; }).join(' ') || chuoi_(chat.title),
      username: chuoi_(chat.username),
    });
  });
  return ra;
}

// ============================================================================
// 4. TOKEN, CÔNG TẮC, CẦU CHÌ
// ============================================================================
//
// TỪ ĐÂY TRỞ XUỐNG KHÔNG CÒN THUẦN. Đừng gọi các hàm dưới đây từ nhóm hàm soạn
// tin ở mục 2 — lớp 5 của bộ kiểm tra soi mã nguồn từng hàm soạn tin và sẽ báo
// đỏ ngay, kèm tên hàm và tên thứ bị cấm.

const TELEGRAM = {
  KHOA_TOKEN: 'TELEGRAM_BOT_TOKEN',   // Script Properties, KHÔNG để trong Cau_Hinh
  KHOA_BAT: 'TELEGRAM_BAT',           // Cau_Hinh
  COT_CHAT_ID: 'Telegram_Chat_ID',    // cột cuối Danh_Muc_Tho
  KHOA_CAU_CHI: 'telegram_cau_chi',
  NGAT_GIAY: 600,                     // cầu chì ngắt 10 phút
  TOI_DA_MOI_LUOT: 20,                // chặn cứng số tin mỗi lượt, rào 5.11
};

/**
 * Token bot, đọc từ Script Properties.
 *
 * KHÔNG cất trong `Cau_Hinh`: ai xem được Sheet là cầm được token và nhắn tin
 * được dưới danh nghĩa bot. Chưa đặt token thì trả rỗng và mọi hàm gửi thành
 * lệnh rỗng — đó là trạng thái bình thường cho tới bước 1 của mục 7.
 */
function tokenTelegram_() {
  try {
    return chuoi_(PropertiesService.getScriptProperties()
      .getProperty(TELEGRAM.KHOA_TOKEN));
  } catch (e) {
    return '';
  }
}

/**
 * Công tắc tổng, đọc từ `Cau_Hinh.TELEGRAM_BAT`.
 *
 * Đây là rào quan trọng nhất về vận hành (5.5): gõ `TAT` vào ô đó là dừng toàn
 * bộ phần Telegram ngay lập tức, người ở nhà máy tự làm được, không phải chờ ai
 * push mã. Nên MẶC ĐỊNH LÀ TẮT — thiếu khoá, gõ sai chính tả, đọc sheet hỏng,
 * mọi đường đều phải dẫn về tắt.
 *
 * Nhận `cauHinh` tiêm vào để chỗ nào đã đọc cấu hình rồi thì khỏi đọc lần nữa,
 * theo đúng lối `getOnDutyContacts_` đang dùng.
 */
function telegramBat_(cauHinh) {
  try {
    const ch = cauHinh || docCauHinh_();
    return chuoi_(ch[TELEGRAM.KHOA_BAT]).toUpperCase() === 'BAT';
  } catch (e) {
    return false;
  }
}

/** Cầu chì đang ngắt hay không — rào 5.12. */
function cauChiDangNgat_() {
  try {
    return CacheService.getScriptCache().get(TELEGRAM.KHOA_CAU_CHI) !== null;
  } catch (e) {
    return false;   // Cache hỏng thì cứ cho gửi, đừng vì nó mà tắt cả thông báo.
  }
}

/**
 * Bật cầu chì: 10 phút tới không gọi mạng lần nào nữa.
 *
 * Ý nghĩa con số: kể cả Telegram chết hẳn thì mỗi 10 phút chỉ có ĐÚNG MỘT người
 * phải chờ hết giờ chờ, thay vì mọi người báo sự cố đều phải chờ.
 */
function batCauChi_() {
  try {
    CacheService.getScriptCache().put(TELEGRAM.KHOA_CAU_CHI, '1', TELEGRAM.NGAT_GIAY);
  } catch (e) {
    // Không bật được cầu chì cũng KHÔNG được ném ra ngoài — rào 5.1.
  }
}

// ============================================================================
// 5. GỬI THẬT
// ============================================================================

/**
 * Gửi một loạt tin. `ds` là mảng `{ chatId, text }`. Trả về SỐ TIN GỬI ĐƯỢC.
 *
 * ⚠️ HÀM NÀY KHÔNG BAO GIỜ NÉM LỖI RA NGOÀI — rào 5.1. Phiếu đã ghi xong trước
 * khi gọi tới đây, nên dù Telegram chết hẳn thì công nhân vẫn báo được sự cố và
 * vẫn thấy danh bạ như cũ. Chỗ gọi vẫn phải bọc thêm try/catch của riêng nó.
 *
 * ⚠️ GỌI NGOÀI KHOÁ, tuyệt đối không trong khoá — rào 5.2. Đặt nhầm vào trong
 * khoá thì mọi người báo sự cố phải xếp hàng chờ một cuộc gọi mạng, đúng thứ mà
 * chú thích trong `reportIncident` đã cảnh báo.
 *
 * Bốn cửa chặn trước khi chạm mạng, xếp theo thứ tự rẻ tiền nhất trước:
 * danh sách rỗng → công tắc tắt → chưa có token → cầu chì đang ngắt.
 */
function guiTelegram_(ds, cauHinh) {
  try {
    const ban = (ds || []).filter(function (t) {
      return t && chuanHoaChatId_(t.chatId) && chuoi_(t.text);
    });
    if (!ban.length) return 0;
    if (!telegramBat_(cauHinh)) return 0;

    const token = tokenTelegram_();
    if (!token) return 0;
    if (cauChiDangNgat_()) return 0;

    // Chặn cứng số tin mỗi lượt — rào 5.11. Trường hợp phải phòng: mất điện cả
    // xưởng, 40 máy báo cùng lúc, bot nhắn 200 tin.
    const gui = ban.slice(0, TELEGRAM.TOI_DA_MOI_LUOT);

    const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
    const yeuCau = gui.map(function (t) {
      return {
        url: url,
        method: 'post',
        contentType: 'application/json',
        // Cố ý KHÔNG có parse_mode: tin là văn bản trơn, xem chú thích mục 2.
        payload: JSON.stringify({
          chat_id: chuanHoaChatId_(t.chatId),
          text: catTin_(t.text),
          disable_web_page_preview: true,
        }),
        // muteHttpExceptions để một chat id hỏng không kéo cả loạt ném lỗi —
        // thiếu cờ này thì một thợ chưa bấm Start với bot sẽ làm hỏng tin của
        // tất cả những người còn lại trong ca.
        muteHttpExceptions: true,
      };
    });

    const traLoi = UrlFetchApp.fetchAll(yeuCau);
    const dsMa = traLoi.map(function (r) { return r.getResponseCode(); });
    if (nenBatCauChi_(dsMa)) batCauChi_();

    return dsMa.filter(function (ma) { return Number(ma) === 200; }).length;
  } catch (e) {
    // Tới đây nghĩa là lời gọi treo hết giờ chờ hoặc mạng hỏng hẳn — đúng thứ
    // cầu chì sinh ra để chặn.
    batCauChi_();
    return 0;
  }
}

/**
 * Map `Ma_Tho` → chat id, đọc từ `Danh_Muc_Tho`.
 *
 * Đọc riêng ở đây, KHÔNG nhét chat id vào object `danhBa` — rào 5.8: `danhBa`
 * được trả thẳng về trình duyệt của công nhân, nhét chat id vào đó là phát tán
 * ra ngoài. Đổi lại tốn thêm một lượt đọc sheet khoảng 150 ms, chấp nhận được.
 *
 * Tự nối thêm cột `Telegram_Chat_ID` khi `HEADER_THO` chưa có nó, nên hàm chạy
 * đúng cả TRƯỚC và SAU bước B4. Sheet mặc định rộng 26 cột nên đọc 10 cột vẫn
 * nằm trong vùng, không văng lỗi tràn cột kể cả khi chưa chạy `setupSystem` —
 * rào 5.3. Thợ chưa ghép thì vắng mặt trong map, im lặng bỏ qua — rào 5.4.
 */
function chatIdTheoMaTho_() {
  const map = {};
  try {
    const header = HEADER_THO.indexOf(TELEGRAM.COT_CHAT_ID) >= 0
      ? HEADER_THO : HEADER_THO.concat([TELEGRAM.COT_CHAT_ID]);
    docSheet_(SHEET.THO, header).forEach(function (t) {
      const ma = chuoi_(t.Ma_Tho);
      const id = chuanHoaChatId_(t[TELEGRAM.COT_CHAT_ID]);
      // Thợ nghỉ việc thì bỏ tick Hoat_Dong — từ đó không nhắn cho họ nữa.
      if (ma && id && laTrue_(t.Hoat_Dong)) map[ma] = id;
    });
  } catch (e) {
    // Thiếu sheet hay đọc hỏng thì trả map rỗng: không ai nhận được tin, nhưng
    // không có thứ gì khác bị kéo hỏng theo.
  }
  return map;
}
// ============================================================================
// 6. HAI MỤC MENU
// ============================================================================
//
// ⚠️ Hai mục menu này cố ý KHÔNG đi qua công tắc `TELEGRAM_BAT` và KHÔNG đi qua
// cầu chì. Theo mục 7 của tài liệu, thứ tự đưa vào chạy là: ghép chat id và gửi
// thử TRƯỚC, bật công tắc SAU. Bắt chúng chờ công tắc là không cách nào gửi thử
// được, mà bật công tắc trước khi thử là đúng thứ tài liệu bảo đừng làm.
//
// Chúng cũng cố ý KÊU TO khi hỏng, ngược hẳn với `guiTelegram_` vốn nuốt mọi lỗi.
// Người bấm menu đang ngồi tìm nguyên nhân, cần thấy mã lỗi và câu trả lời của
// Telegram; còn công nhân báo sự cố thì không cần biết gì về Telegram cả.

/**
 * Gọi một lệnh của Telegram Bot API và trả về nguyên văn câu trả lời.
 *
 * Dùng `fetch` chứ không `fetchAll` vì mỗi lần chỉ gọi một lệnh. KHÔNG bắt lỗi ở
 * đây: hàm gọi là menu, và `chayVaBao_` sẽ hiện lỗi lên hộp thoại cho người bấm.
 */
function goiApiTelegram_(phuongThuc, payload) {
  const token = tokenTelegram_();
  if (!token) {
    throw new Error('Chưa đặt token bot.\n\n' +
      'Mở Apps Script → ⚙️ Project Settings → Script Properties → Add property, ' +
      'khoá là ' + TELEGRAM.KHOA_TOKEN + ', giá trị là token @BotFather cấp.\n\n' +
      'Cố ý KHÔNG cất token trong sheet Cau_Hinh: ai xem được Sheet là nhắn tin ' +
      'được dưới danh nghĩa bot.');
  }
  const r = UrlFetchApp.fetch(
    'https://api.telegram.org/bot' + token + '/' + phuongThuc, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload || {}),
      muteHttpExceptions: true,
    });
  return { ma: r.getResponseCode(), than: r.getContentText() };
}

/**
 * Menu: lấy Telegram ID của những người đã nhắn cho bot.
 *
 * Dùng `getUpdates`, KHÔNG dùng webhook — rào 5.6: bot chỉ gửi đi, không nhận về.
 * Thêm `doPost` là phải deploy lại và mở thêm một cửa vào cho script đang phục vụ
 * 175 máy, trong khi việc này chỉ làm đúng 15 lần rồi thôi.
 */
function menuLayTelegramId() {
  chayVaBao_('Lấy Telegram ID', function () {
    const kq = goiApiTelegram_('getUpdates', { limit: 100 });
    if (kq.ma !== 200) {
      return 'Telegram trả mã ' + kq.ma + '.\n\n' + kq.than;
    }
    const ds = gomChatIdTuUpdates_(JSON.parse(kq.than));
    if (!ds.length) {
      return 'Chưa ai nhắn cho bot.\n\n' +
        'Bảo thợ mở Telegram, tìm đúng tên bot, bấm START rồi nhắn một chữ bất kỳ. ' +
        'Xong quay lại bấm mục này.\n\n' +
        'Lưu ý: Telegram chỉ giữ tin chưa đọc trong khoảng 24 giờ, để lâu quá thì ' +
        'bảo thợ nhắn lại.';
    }
    return 'Đã thấy ' + ds.length + ' người nhắn cho bot:\n\n' +
      ds.map(function (n) {
        return '  ' + n.id + '   ' + (n.ten || '(không tên)') +
          (n.username ? ('  @' + n.username) : '');
      }).join('\n') +
      '\n\nChép cột số đầu tiên vào cột ' + TELEGRAM.COT_CHAT_ID +
      ' của sheet ' + SHEET.THO + ', đúng dòng của từng người.';
  });
}

/**
 * Menu: gửi một tin thử cho một thợ.
 *
 * Có mục này để kiểm chứng đường gửi mà không phải chờ một sự cố thật xảy ra —
 * bước 3 của mục 7. Hiện nguyên văn câu trả lời của Telegram khi hỏng, vì hai
 * lỗi hay gặp nhất đều đọc ra được từ đó: thợ chưa bấm Start với bot, và chat id
 * ghép nhầm dòng.
 */
function menuGuiThu() {
  const ui = SpreadsheetApp.getUi();
  const h = ui.prompt('Gửi tin thử',
    'Nhập mã thợ cần gửi thử (ví dụ TH01).\n\n' +
    'Thợ đó phải đã có ' + TELEGRAM.COT_CHAT_ID + ' trong sheet ' + SHEET.THO +
    ', và phải đã bấm START với bot ít nhất một lần.',
    ui.ButtonSet.OK_CANCEL);
  if (h.getSelectedButton() !== ui.Button.OK) return;

  const maTho = h.getResponseText().trim();
  if (!maTho) { ui.alert('Chưa nhập mã thợ nào.'); return; }

  chayVaBao_('Gửi tin thử', function () {
    const map = chatIdTheoMaTho_();
    const chatId = map[maTho];
    if (!chatId) {
      return 'Không tìm thấy chat id của ' + maTho + '.\n\n' +
        'Kiểm ba thứ: mã thợ gõ đúng chưa, cột ' + TELEGRAM.COT_CHAT_ID +
        ' của dòng đó đã điền chưa, và ô Hoat_Dong đã tick chưa.\n\n' +
        'Nếu ô chat id hiện dạng 1.23457E+11 thì đó là Sheets đọc thành số — ' +
        'chạy lại menu "1. Cài đặt hệ thống" để đặt cột về định dạng text, rồi ' +
        'gõ lại chat id.';
    }
    const kq = goiApiTelegram_('sendMessage', {
      chat_id: chatId,
      text: '🔧 Tin thử từ hệ thống Bảo trì. Nhận được tin này nghĩa là đường ' +
        'gửi đã thông. Không cần làm gì cả.',
      disable_web_page_preview: true,
    });
    if (kq.ma === 200) {
      return 'Đã gửi cho ' + maTho + ' (chat id ' + chatId + ').\n\n' +
        'Thợ xác nhận thấy tin rồi thì ghép nốt những người còn lại, xong mới ' +
        'gõ BAT vào ô ' + TELEGRAM.KHOA_BAT + ' của sheet ' + SHEET.CAU_HINH + '.';
    }
    return 'KHÔNG gửi được. Telegram trả mã ' + kq.ma + '.\n\n' + kq.than +
      '\n\nMã 403 thường là thợ chưa bấm START với bot. ' +
      'Mã 400 với "chat not found" thường là chat id ghép nhầm dòng.';
  });
}
