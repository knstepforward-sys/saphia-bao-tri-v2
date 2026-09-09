/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * THÔNG BÁO TELEGRAM — nhắc thợ khi có phiếu chưa ai nhận.
 *
 * Bệnh cần chữa: công nhân báo sự cố xong thì màn hình hiện danh bạ thợ trực để
 * gọi điện, nhưng rất nhiều người quên gọi. Phiếu nằm ở CHO_NHAN mà không ai
 * biết, máy nằm im. Xem TASK_THONG_BAO_TELEGRAM.md, phương án chốt 09/09/2026.
 *
 * ĐẾN HẾT BƯỚC B7 — mã đã đủ. Còn lại là kiểm thử và tài liệu (B8).
 *
 * Luồng đang chạy gọi vào đây qua ĐÚNG HAI CỬA, cả hai ở mục 7: `thongBaoSuCoMoi_`
 * từ `reportIncident`, và `thongBaoDaNhan_` từ `acceptIncident`. Cửa thứ ba là
 * `nhacPhieuChoNhan` ở mục 8, do trigger 5 phút gọi. Giữ đúng ba cửa đó để sau
 * này muốn gỡ hẳn phần Telegram thì biết chỗ mà tìm.
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

/**
 * Chọn ra những người thật sự nhắn được, từ danh bạ và map liên lạc.
 *
 * Trả về mảng `{ maTho, chatId, link }`. Thuần nên kiểm thử được tại máy, và đây
 * là chỗ đáng kiểm nhất của phần ghép vì nó gánh ba phép loại trừ, sai cái nào
 * cũng không có lỗi nào để lần:
 *
 * - **Bỏ số khẩn cấp.** Nó nằm cuối `danhBa.ds` với `khanCap: true` và `maTho`
 *   rỗng; nó là một số điện thoại, không phải một thợ, không có Telegram.
 * - **Bỏ người chưa ghép chat id.** Ghép dần cho 15 thợ, ai chưa có thì im lặng
 *   bỏ qua — rào 5.4.
 * - **Bỏ `boQuaMaTho`.** Dùng khi báo "đã có người nhận": không nhắn lại cho
 *   chính người vừa bấm nhận.
 *
 * Cũng chặn trùng theo `maTho`, phòng khi một người lọt vào danh bạ hai lần.
 */
function locNguoiNhan_(danhBa, lienLac, boQuaMaTho) {
  const ds = (danhBa && danhBa.ds) || [];
  const map = lienLac || {};
  const bo = chuoi_(boQuaMaTho);
  const daCo = {};
  const ra = [];

  ds.forEach(function (n) {
    if (!n || n.khanCap) return;
    const ma = chuoi_(n.maTho);
    if (!ma || ma === bo || daCo[ma]) return;
    const ll = map[ma];
    const chatId = ll ? chuanHoaChatId_(ll.chatId) : '';
    if (!chatId) return;
    daCo[ma] = true;
    ra.push({ maTho: ma, chatId: chatId, link: ll ? chuoi_(ll.link) : '' });
  });
  return ra;
}

/**
 * Đếm mỗi phiếu đã được nhắc tới lần thứ mấy, đọc từ `Nhat_Ky_Su_Co`.
 *
 * Trả về map `Ma_Su_Co` → lần cao nhất (0, 1 hoặc 2). Hàm THUẦN.
 *
 * Vết nhắc để trong nhật ký chứ KHÔNG thêm cột `Nhac_Lan` vào `Su_Co` — mục 9
 * của tài liệu đã cân nhắc và bác: nhật ký chứa được, lại còn để lại vết kiểm
 * chứng bot đã làm gì, mà `Su_Co` thì đang là chỗ trigger tuyệt đối không được
 * ghi vào (rào 5.9).
 */
function demLanDaNhac_(dsNhatKy) {
  const map = {};
  (dsNhatKy || []).forEach(function (r) {
    if (!r) return;
    if (chuoi_(r.Actor).toUpperCase() !== 'BOT') return;
    const ma = chuoi_(r.Ma_Su_Co);
    if (!ma) return;
    const hd = chuoi_(r.Hanh_Dong).toUpperCase();
    const lan = hd === 'NHAC_LAN_2' ? 2 : (hd === 'NHAC_LAN_1' ? 1 : 0);
    if (lan > (map[ma] || 0)) map[ma] = lan;
  });
  return map;
}

/**
 * Chọn ra những phiếu đến lượt phải nhắc. Hàm THUẦN — đây là toàn bộ phần quyết
 * định của trigger, tách ra để kiểm thử được tại máy mà không cần mở Sheet.
 *
 * Trả về mảng `{ v, lan }`, `lan` là 1 hoặc 2.
 *
 * Bốn phép chặn, mỗi phép ứng một cách hỏng cụ thể:
 *
 * - **Chỉ phiếu `CHO_NHAN`.** Đó chính là định nghĩa "chưa ai nhận". Phiếu việc
 *   chung và dừng máy mở thẳng ở `DANG_XU_LY` nên không bao giờ lọt vào đây.
 * - **Tối đa 2 lần mỗi phiếu, đời đời** — rào 5.11. Đã nhắc lần 2 rồi thì thôi
 *   hẳn, bot không phải là cái chuông reo mãi.
 * - **Nhảy thẳng lên lần 2 được.** Trigger chạy trễ hoặc script bị tắt một lúc
 *   thì phiếu có thể đã quá cả hai ngưỡng khi mới xét lần đầu. Nhắc "lần 1" cho
 *   một phiếu đã treo 3 tiếng là nói sai sự thật, nên bỏ qua lần 1 luôn.
 * - **Trần `NHAC_TRAN_PHUT`.** Phiếu treo quá một ngày thì nhắc nữa cũng vô
 *   nghĩa, chuyện đó phải xử bằng người. Quan trọng hơn: đây là rào chặn lúc gõ
 *   BAT lần đầu — không có nó thì công tắc vừa bật là bot bắn một loạt tin về
 *   những phiếu cũ còn treo từ trước, đúng cách làm người ta tắt bot ngay ngày
 *   đầu tiên.
 *
 * Ngưỡng đặt 0 là tắt riêng lớp đó, đúng như mô tả ghi trong `Cau_Hinh`.
 */
function chonPhieuCanNhac_(dsGanDay, daNhac, cauHinh, khi, toiDa) {
  const ch = cauHinh || {};
  const nguong1 = Number(ch.NHAC_LAN_1_PHUT) || 0;
  const nguong2 = Number(ch.NHAC_LAN_2_PHUT) || 0;
  const dem = daNhac || {};
  const tran = TELEGRAM.NHAC_TRAN_PHUT;
  const gh = toiDa || TELEGRAM.NHAC_TOI_DA_PHIEU;
  const ra = [];

  (dsGanDay || []).forEach(function (r) {
    if (ra.length >= gh) return;
    const v = r && r.v;
    if (!v) return;
    if (chuoi_(v[COT.Trang_Thai]) !== TRANG_THAI.CHO_NHAN) return;

    const ma = chuoi_(v[COT.Ma_Su_Co]);
    if (!ma) return;
    const daCo = dem[ma] || 0;
    if (daCo >= 2) return;

    const phut = phutGiua_(v[COT.Thoi_Gian_Bao], khi);
    if (!phut || phut > tran) return;

    if (nguong2 && phut >= nguong2) { ra.push({ v: v, lan: 2 }); return; }
    if (nguong1 && phut >= nguong1 && daCo < 1) { ra.push({ v: v, lan: 1 }); }
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
  // --- Trigger nhắc ---------------------------------------------------------
  KHOA_DANG_NHAC: 'telegram_dang_nhac',
  NHAC_GIU_GIAY: 240,                 // cờ chống chạy chồng, ngắn hơn nhịp 5 phút
  NHAC_TRAN_PHUT: 1440,               // phiếu treo quá 1 ngày thì thôi, xem mục 8
  NHAC_TOI_DA_PHIEU: 10,              // số PHIẾU tối đa mỗi lượt, rào 5.11
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
 * Map `Ma_Tho` → `{ chatId, link }`, đọc từ `Danh_Muc_Tho` trong MỘT lượt.
 *
 * Lấy cả hai thứ cùng lúc vì mỗi lượt `getValues` tốn ~150 ms bất kể đọc mấy
 * cột. Đọc riêng ở đây, KHÔNG nhét chat id vào object `danhBa` — rào 5.8:
 * `danhBa` được trả thẳng về trình duyệt của công nhân, nhét chat id vào đó là
 * phát tán ra ngoài.
 *
 * Tự nối thêm cột `Telegram_Chat_ID` khi `HEADER_THO` chưa có nó, nên hàm chạy
 * đúng cả TRƯỚC và SAU bước B4. Sheet mặc định rộng 26 cột nên đọc 10 cột vẫn
 * nằm trong vùng, không văng lỗi tràn cột kể cả khi chưa chạy `setupSystem` —
 * rào 5.3. Thợ chưa ghép thì vắng mặt trong map, im lặng bỏ qua — rào 5.4.
 */
function lienLacTho_() {
  const map = {};
  try {
    const header = HEADER_THO.indexOf(TELEGRAM.COT_CHAT_ID) >= 0
      ? HEADER_THO : HEADER_THO.concat([TELEGRAM.COT_CHAT_ID]);
    docSheet_(SHEET.THO, header).forEach(function (t) {
      const ma = chuoi_(t.Ma_Tho);
      const id = chuanHoaChatId_(t[TELEGRAM.COT_CHAT_ID]);
      // Thợ nghỉ việc thì bỏ tick Hoat_Dong — từ đó không nhắn cho họ nữa.
      if (ma && id && laTrue_(t.Hoat_Dong)) {
        map[ma] = { chatId: id, link: chuoi_(t.Link_Ca_Nhan) };
      }
    });
  } catch (e) {
    // Thiếu sheet hay đọc hỏng thì trả map rỗng: không ai nhận được tin, nhưng
    // không có thứ gì khác bị kéo hỏng theo.
  }
  return map;
}

/** Map `Ma_Tho` → chat id. Vỏ bọc mỏng của `lienLacTho_`, cho mục menu gửi thử. */
function chatIdTheoMaTho_() {
  const ra = {};
  const ll = lienLacTho_();
  Object.keys(ll).forEach(function (ma) { ra[ma] = ll[ma].chatId; });
  return ra;
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

// ============================================================================
// 7. GHÉP — hai hàm được luồng đang chạy gọi tới
// ============================================================================
//
// Đây là hai cửa duy nhất mà `CongNhan.gs` và `LuongTho.gs` gọi vào file này.
// Giữ đúng hai cửa để sau này muốn tắt hẳn phần Telegram thì biết chỗ mà tìm.
//
// ⚠️ CẢ HAI PHẢI GỌI NGOÀI KHOÁ — rào 5.2. Chúng đọc một lượt sheet rồi gọi mạng;
// làm việc đó trong khoá là bắt mọi người báo sự cố xếp hàng chờ theo.
//
// Phiếu DUNG_MAY cố ý KHÔNG có cửa nào. Tài liệu mục 4.2 có liệt kê
// `reportMachineStop`, nhưng khi vào mã thì thấy không hợp: phiếu DM- không có
// thợ nào, không đi qua màn hình nhận việc, nên dòng "Bấm để nhận việc" là sai
// hẳn với loại phiếu đó. Thiếu chỉ hay vệ sinh máy cũng không phải bệnh mà dự án
// này chữa. Gửi tin không kèm việc gì để làm là dạy thợ lướt qua tin của bot,
// đúng lúc tin sự cố thật cần được đọc. Chủ dự án chọn bỏ, ngày 09/09/2026.

/**
 * Lớp 1 — gửi ngay lúc công nhân báo sự cố, cho thợ đang trực trong `danhBa`.
 *
 * Trả về số tin gửi được, chỉ để ghi nhật ký khi cần; chỗ gọi không dùng tới.
 * Không bao giờ ném lỗi ra ngoài, và chỗ gọi vẫn bọc thêm try/catch của nó.
 */
function thongBaoSuCoMoi_(v, danhBa, cauHinh) {
  try {
    const nhan = locNguoiNhan_(danhBa, lienLacTho_(), '');
    if (!nhan.length) return 0;
    return guiTelegram_(nhan.map(function (n) {
      return { chatId: n.chatId, text: soanTinSuCoMoi_(v, n.link) };
    }), cauHinh);
  } catch (e) {
    return 0;
  }
}

/**
 * Báo cho những người CÒN LẠI biết đã có người nhận việc.
 *
 * Đây là thứ thay cho nút "chuyển việc cho người trực cùng ca" đã bị bác ở mục 2
 * của tài liệu. Gửi cho cả ca rồi ai bấm trước thì người kia biết ngay, nên
 * không cần ai chuyển việc cho ai.
 *
 * Dựng lại danh bạ bằng mốc **giờ báo hỏng**, không phải giờ hiện tại: mục đích
 * là ra đúng nhóm người đã nhận tin lần đầu, kể cả khi ca đã đổi giữa chừng.
 * Dùng lại `getOnDutyContacts_`, không sửa nó — rào 5.7.
 */
function thongBaoDaNhan_(v, maThoNhan, cauHinh) {
  try {
    const khi = v[COT.Thoi_Gian_Bao];
    const danhBa = getOnDutyContacts_(
      chuoi_(v[COT.Bo_Phan]), chuoi_(v[COT.Nhom_Loi]),
      (khi instanceof Date) ? khi : null,
      cauHinh ? { cauHinh: cauHinh } : undefined);

    const nhan = locNguoiNhan_(danhBa, lienLacTho_(), maThoNhan);
    if (!nhan.length) return 0;

    const tin = soanTinDaNhan_(v);
    return guiTelegram_(nhan.map(function (n) {
      return { chatId: n.chatId, text: tin };
    }), cauHinh);
  } catch (e) {
    return 0;
  }
}

// ============================================================================
// 8. TRIGGER NHẮC — lớp 2 và lớp 3
// ============================================================================
//
// Chạy 5 phút một lượt. Đây là phần chữa đúng bệnh ở mục 1 của tài liệu, và là
// phần **chạy thật được mà chưa cần deploy**, vì trigger chạy bằng mã HEAD.

/**
 * Trigger 5 phút: nhắc những phiếu chưa ai nhận.
 *
 * ⚠️ CHỈ ĐỌC `Su_Co`, CHỈ GHI `Nhat_Ky_Su_Co` — rào 5.9. Không đổi `Trang_Thai`,
 * không đổi bất cứ cột nào của `Su_Co`. Bot mà ghi vào `Su_Co` thì có ngày nó đè
 * đúng lúc thợ đang bấm nhận.
 *
 * ⚠️ KHÔNG dùng `LockService` — cố ý khác chữ trong rào 5.10, giữ đúng ý của nó.
 * Khoá script là khoá dùng chung: giữ nó suốt lượt trigger là chặn luôn công
 * nhân báo sự cố trong lúc bot gọi mạng, đúng thứ rào 5.2 cấm, và khi Telegram
 * treo thì khoá bị giữ tới hết giờ chờ. Cờ trong `CacheService` chống chạy chồng
 * đúng như rào 5.10 muốn mà không đụng tới ai.
 *
 * Ghi nhật ký SAU khi gửi và chỉ ghi khi gửi được ít nhất một tin. Gửi hỏng thì
 * không để lại vết, lượt sau thử lại — thà nhắc muộn còn hơn nuốt mất lần nhắc.
 * Đổi lại, nếu script chết đúng khe giữa lúc gửi xong và lúc ghi nhật ký thì
 * phiếu đó bị nhắc lặp một lần. Hiếm, và một tin thừa nhẹ hơn một tin mất.
 */
function nhacPhieuChoNhan() {
  const cache = (function () { try { return CacheService.getScriptCache(); } catch (e) { return null; } })();

  // Chống chạy chồng — rào 5.10. Không giành được thì bỏ lượt luôn, không chờ,
  // không thử lại: 5 phút nữa có lượt khác.
  if (cache) {
    if (cache.get(TELEGRAM.KHOA_DANG_NHAC)) return 'Lượt trước còn đang chạy, bỏ lượt này.';
    cache.put(TELEGRAM.KHOA_DANG_NHAC, '1', TELEGRAM.NHAC_GIU_GIAY);
  }

  try {
    const cauHinh = docCauHinh_();
    if (!telegramBat_(cauHinh)) return 'Công tắc TELEGRAM_BAT đang tắt, không làm gì.';

    const khi = nowVN_();
    const canNhac = chonPhieuCanNhac_(
      docSuCoGanDay_(),
      demLanDaNhac_(docSheet_(SHEET.NHAT_KY, HEADER_NHAT_KY)),
      cauHinh, khi);
    if (!canNhac.length) return 'Không có phiếu nào tới lượt nhắc.';

    const lienLac = lienLacTho_();
    const sdtKhanCap = chuoi_(cauHinh.SDT_KHAN_CAP);
    let daGui = 0;

    canNhac.forEach(function (m) {
      const v = m.v;
      const khiBao = v[COT.Thoi_Gian_Bao];
      // Dựng lại đúng nhóm người đã nhận tin lần đầu: lấy theo mốc GIỜ BÁO HỎNG,
      // không phải giờ hiện tại, để ca đã đổi giữa chừng cũng không lệch người.
      const danhBa = getOnDutyContacts_(
        chuoi_(v[COT.Bo_Phan]), chuoi_(v[COT.Nhom_Loi]),
        (khiBao instanceof Date) ? khiBao : null, { cauHinh: cauHinh });

      const nhan = locNguoiNhan_(danhBa, lienLac, '');
      if (!nhan.length) return;

      const so = guiTelegram_(nhan.map(function (n) {
        return { chatId: n.chatId, text: soanTinNhac_(v, m.lan, khi, n.link, sdtKhanCap) };
      }), cauHinh);
      if (!so) return;   // tắt, cầu chì, hoặc hỏng → không ghi vết, lượt sau thử lại

      daGui += so;
      ghiNhatKy_(v[COT.Ma_Su_Co], v[COT.Ma_May], 'BOT', 'NHAC_LAN_' + m.lan,
        { soTin: so, phutTreo: phutGiua_(khiBao, khi) }, '');
    });

    return 'Đã nhắc ' + canNhac.length + ' phiếu, gửi ' + daGui + ' tin.';
  } catch (e) {
    // Trigger hỏng không được kéo theo thứ gì khác. Ghi lại để còn lần ra.
    console.error('nhacPhieuChoNhan lỗi: ' + e.message);
    return 'Lỗi: ' + e.message;
  } finally {
    if (cache) { try { cache.remove(TELEGRAM.KHOA_DANG_NHAC); } catch (e2) { /* bỏ qua */ } }
  }
}
