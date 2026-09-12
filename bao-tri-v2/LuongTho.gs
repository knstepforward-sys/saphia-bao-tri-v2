/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * BƯỚC 3: Luồng THỢ — mở link cá nhân → nhận việc → (sửa nhóm lỗi) → hoàn thành.
 *
 * Mọi hàm ghi đều theo 3 nguyên tắc ổn định ở đầu Code.gs:
 *   1. Đổi trạng thái = đọc cả dòng → sửa trong bộ nhớ → ĐÚNG MỘT setValues.
 *   2. Nằm trong LockService + kiểm Request_ID chống double-tap.
 *   3. Không dùng PropertiesService cho dữ liệu tăng dần.
 */

// ============================================================================
// 1. XÁC THỰC
// ============================================================================

/**
 * Kiểm tra cặp mã thợ + token của link cá nhân.
 * Trả về object thợ, hoặc null nếu sai/không còn hoạt động.
 */
function xacThucTho_(maTho, token) {
  const ma = String(maTho || '').trim();
  const tk = String(token || '').trim();
  if (!ma || !tk) return null;

  const ds = docSheet_(SHEET.THO, HEADER_THO);
  for (let i = 0; i < ds.length; i++) {
    if (String(ds[i].Ma_Tho).trim() === ma &&
        String(ds[i].Token).trim() === tk &&
        laTrue_(ds[i].Hoat_Dong)) {
      return ds[i];
    }
  }
  return null;
}

// ============================================================================
// 2. TÌM DÒNG PHIẾU
// ============================================================================

/** Tìm dòng của một phiếu trong Su_Co. Trả { dong, v } hoặc null. */
function timDongSuCo_(maSuCo, dsGanDay) {
  const ma = String(maSuCo || '').trim();
  if (!ma) return null;
  const ds = dsGanDay || docSuCoGanDay_();
  for (let i = ds.length - 1; i >= 0; i--) {
    if (String(ds[i].v[COT.Ma_Su_Co]).trim() === ma) return ds[i];
  }
  return null;
}

/**
 * Tách thời gian tiếp nhận thành "chờ vì thợ bận" và "đáp ứng thực".
 *
 * Lý do tồn tại: nếu 2 máy cùng hỏng lúc 9h, thợ sửa máy 1 tới 9h30 rồi mới nhận
 * máy 2, thì 30 phút đó KHÔNG phải là thợ chậm — nhưng nếu chỉ đo
 * Phut_Tiep_Nhan thì KPI của thợ bị kéo xuống oan.
 *
 *   Phut_Cho_Tho_Ban  = min(giờ nhận, giờ thợ rảnh) − giờ báo   → tính cho nhà máy
 *   Phut_Dap_Ung_Thuc = giờ nhận − max(giờ báo, giờ thợ rảnh)   → tính cho thợ
 *   Cộng lại luôn bằng Phut_Tiep_Nhan, nên số tổng không đổi.
 *
 * "Giờ thợ rảnh" = giờ hoàn thành muộn nhất trong các phiếu khác của chính thợ đó
 * còn chồng lên khoảng máy này phải chờ. Nếu thợ đang giữ dở phiếu khác ngay lúc
 * bấm nhận thì coi như bận tới tận lúc đó.
 *
 * @param {Array}  ds       kết quả docSuCoGanDay_()
 * @param {string} maTho
 * @param {string} maSuCoNay mã phiếu đang nhận (tự loại khỏi phép so)
 * @param {Date}   baoLuc   Thoi_Gian_Bao của phiếu đang nhận
 * @param {Date}   nhanLuc  thời điểm bấm nhận
 */
function tinhDapUng_(ds, maTho, maSuCoNay, baoLuc, nhanLuc) {
  const ma = String(maTho).trim();
  let ranhLuc = null;
  let dangGiu = 0;

  ds.forEach(function (r) {
    const v = r.v;
    if (String(v[COT.Ma_Tho]).trim() !== ma) return;
    if (String(v[COT.Ma_Su_Co]).trim() === String(maSuCoNay).trim()) return;

    // Phiếu thợ này còn đang giữ dở → đang bận ngay tại thời điểm nhận.
    if (v[COT.Trang_Thai] === TRANG_THAI.DANG_XU_LY) { dangGiu++; return; }

    const nhan = v[COT.Thoi_Gian_Nhan];
    const xong = v[COT.Thoi_Gian_Hoan_Thanh];
    if (!(nhan instanceof Date) || !(xong instanceof Date)) return;

    // Việc đó có chiếm mất thời gian của thợ trong lúc máy này đang chờ không?
    if (nhan < nhanLuc && xong > baoLuc) {
      if (!ranhLuc || xong > ranhLuc) ranhLuc = xong;
    }
  });

  // Đang giữ việc dở → bận liên tục cho tới lúc bấm nhận.
  if (dangGiu > 0 && (!ranhLuc || nhanLuc > ranhLuc)) ranhLuc = nhanLuc;

  const phut = function (a, b) { return Math.max(0, Math.round((a - b) / 60000)); };
  const moc = ranhLuc && ranhLuc > baoLuc ? ranhLuc : baoLuc;

  return {
    cho: ranhLuc ? phut(Math.min(nhanLuc.getTime(), ranhLuc.getTime()), baoLuc.getTime()) : 0,
    thuc: phut(nhanLuc.getTime(), moc.getTime()),
    chongViec: dangGiu,
  };
}

// ============================================================================
// 2b. KPI ĐÁP ỨNG THỢ — bản cộng dồn đoạn bận (đợt 09/2026)
//
// `tinhDapUng_` ở trên miễn trừ thời gian bận bằng MỘT mốc rảnh duy nhất: giờ
// hoàn thành muộn nhất trong các phiếu chồng. Hệ quả: thợ bận thành nhiều đoạn
// rời thì mọi khoảng RẢNH xen giữa cũng bị gộp vào "chờ do thợ bận".
//
//   Máy báo 09:00, thợ nhận 10:00, trong đó thợ làm 08:50–09:10 và 09:30–09:50.
//   Cách cũ : mốc rảnh = 09:50 → chờ 50 phút, KPI thợ chỉ 2... thực ra 10 phút.
//   Đúng ra : bận 10 + 20 = 30 phút, thợ rảnh 30 phút mà chưa nhận → KPI 30.
//
// Sai lệch này luôn nghiêng về phía có lợi cho người bị đo, nên phải vá trước
// khi đem đi chấm KPI. Hai cột cũ giữ nguyên không sửa đè — số cũ đã nằm trong
// các báo cáo đã gửi đi, đổi nghĩa giữa chừng là mất khả năng đối chiếu.
// ============================================================================

/**
 * Tổng số phút thợ THẬT SỰ bận trong khoảng máy nằm chờ [baoLuc, nhanLuc].
 *
 * Gộp HỢP các đoạn bận rồi cộng độ dài, thay vì lấy mốc muộn nhất. Đoạn bận lấy
 * đúng cùng nguồn với `tinhDapUng_` để hai cách không bao giờ nói ngược nhau:
 * phiếu của chính thợ đó, trừ phiếu đang xét, và phải có đủ mốc nhận→hoàn thành.
 *
 * Phiếu còn DANG_XU_LY → bận từ lúc nhận tới hết cửa sổ. Nhờ cắt vào cửa sổ mà
 * hàm này cho **cùng kết quả** dù chạy ngay lúc bấm nhận (phiếu kia còn mở) hay
 * chạy lại sau này (phiếu kia đã đóng, giờ hoàn thành nằm sau nhanLuc) — điều
 * kiện để `tinhLaiKpiTho()` bù cho dữ liệu cũ mà không lệch với số ghi tại chỗ.
 *
 * @param {Array}  ds       kết quả docSuCoGanDay_() — hoặc tập đã lọc sẵn theo thợ
 * @param {string} maTho
 * @param {string} maSuCoNay mã phiếu đang xét (tự loại khỏi phép so)
 * @param {Date}   baoLuc
 * @param {Date}   nhanLuc
 * @return {{phutBan: number, soDoan: number}}
 */
function phutBanTrongCho_(ds, maTho, maSuCoNay, baoLuc, nhanLuc) {
  const ma = String(maTho).trim();
  const maNay = String(maSuCoNay).trim();
  const tu = baoLuc.getTime();
  const den = nhanLuc.getTime();
  const doan = [];

  ds.forEach(function (r) {
    const v = r.v;
    if (String(v[COT.Ma_Tho]).trim() !== ma) return;
    if (String(v[COT.Ma_Su_Co]).trim() === maNay) return;

    const nhan = v[COT.Thoi_Gian_Nhan];
    if (!(nhan instanceof Date)) return;   // BT- cố ý trống → không tính là bận

    // Còn giữ dở → bận liên tục cho tới hết cửa sổ.
    if (v[COT.Trang_Thai] === TRANG_THAI.DANG_XU_LY) {
      doan.push([nhan.getTime(), den]);
      return;
    }

    const xong = v[COT.Thoi_Gian_Hoan_Thanh];
    if (!(xong instanceof Date)) return;
    doan.push([nhan.getTime(), xong.getTime()]);
  });

  // Cắt vào cửa sổ, bỏ đoạn rỗng, sắp theo mốc bắt đầu rồi gộp các đoạn dính nhau.
  const cat = doan
    .map(function (d) { return [Math.max(d[0], tu), Math.min(d[1], den)]; })
    .filter(function (d) { return d[1] > d[0]; })
    .sort(function (a, b) { return a[0] - b[0]; });

  let tong = 0, soDoan = 0, dau = null, cuoi = null;
  cat.forEach(function (d) {
    if (cuoi === null || d[0] > cuoi) {
      if (cuoi !== null) { tong += cuoi - dau; soDoan++; }
      dau = d[0];
      cuoi = d[1];
    } else if (d[1] > cuoi) {
      cuoi = d[1];
    }
  });
  if (cuoi !== null) { tong += cuoi - dau; soDoan++; }

  return { phutBan: Math.round(tong / 60000), soDoan: soDoan };
}

/**
 * Bộ 5 giá trị KPI của MỘT phiếu. Dùng chung cho lúc thợ bấm nhận và cho lần
 * tính lại hàng loạt — hai đường không được phép cho ra số khác nhau.
 *
 * `nguong` là số phút công ty chốt; để trống thì không chấm đạt/không đạt.
 *
 * @return {{apDung: string, phutBan: (number|string), phutKpi: (number|string),
 *           soDoan: (number|string), datNguong: string}}
 */
function kpiThoChoPhieu_(ds, v, nguong) {
  const khong = function (lyDo) {
    return { apDung: 'KHONG — ' + lyDo, phutBan: '', phutKpi: '', soDoan: '', datNguong: '' };
  };

  // Chỉ phiếu có người BÁO mới đo được đáp ứng: `SC-` (công nhân báo hỏng) và
  // `HT-` (công nhân gọi kỹ thuật lúc máy đang dừng). CV-/BT-/DM- vẫn được tính
  // là thợ bận ở hàm trên, nhưng bản thân chúng không vào KPI — CV- và BT- do
  // chính thợ tạo nên tạo là nhận luôn, DM- thì không có thợ nào.
  // Chủ dự án chốt `HT-` tính CHUNG một con số với sự cố, ngày 11/09/2026.
  const loai = loaiPhieu_(v);
  if (!laDoDapUng_(v)) return khong('phiếu ' + loai);
  if (!String(v[COT.Ma_Tho]).trim()) return khong('chưa ai nhận');

  const bao = v[COT.Thoi_Gian_Bao];
  const nhan = v[COT.Thoi_Gian_Nhan];
  if (!(bao instanceof Date) || !(nhan instanceof Date)) return khong('thiếu mốc giờ');

  const ban = phutBanTrongCho_(ds, v[COT.Ma_Tho], v[COT.Ma_Su_Co], bao, nhan);
  const tong = Math.max(0, Math.round((nhan.getTime() - bao.getTime()) / 60000));
  const kpi = Math.max(0, tong - ban.phutBan);

  return {
    apDung: 'CO',
    phutBan: ban.phutBan,
    phutKpi: kpi,
    soDoan: ban.soDoan,
    datNguong: nguong ? (kpi <= nguong ? 'DAT' : 'KHONG_DAT') : '',
  };
}

/**
 * Ngưỡng KPI (phút) công ty chốt, đọc từ sheet Cau_Hinh. Chưa chốt → 0, và mọi
 * chỗ dùng phải hiểu 0 là "chưa chấm đạt/không đạt", không phải "ngưỡng 0 phút".
 */
function nguongKpi_(cauHinh) {
  const ch = cauHinh || docCauHinh_();
  const n = Number(ch.NGUONG_KPI_DAP_UNG_PHUT);
  return isFinite(n) && n > 0 ? n : 0;
}

/**
 * Bảng tra NGƯỠNG ĐÁP ỨNG theo từng thợ, dựng từ sheet `Danh_Muc_Tho`.
 *
 * Tra được bằng CẢ mã thợ lẫn tên thợ: `Su_Co` có cả hai cột, còn báo cáo thì
 * gom theo TÊN (đó là thứ chủ quản đọc). Tên chuẩn hoá bỏ khoảng trắng thừa
 * nhưng GIỮ dấu và giữ hoa thường — "Nhân M" và "Nhân D" là hai người khác nhau.
 *
 * @return {Object} { theoMa: {...}, theoTen: {...}, chung: number }
 */
function bangNguongTho_(dsTho, cauHinh) {
  const ch = cauHinh || docCauHinh_();
  const ds = dsTho || docSheet_(SHEET.THO, HEADER_THO);
  const theoMa = {}, theoTen = {};
  ds.forEach(function (t) {
    const n = nguongKpiCuaTho_(t, ch);
    const ma = String(t.Ma_Tho || '').trim();
    const ten = String(t.Ten_Tho || '').trim();
    if (ma) theoMa[ma] = n;
    if (ten) theoTen[ten] = n;
  });
  return { theoMa: theoMa, theoTen: theoTen, chung: nguongKpi_(ch) };
}

/** Ngưỡng áp cho một dòng Su_Co: ưu tiên mã thợ, rồi tên thợ, rồi ngưỡng chung. */
function nguongChoDong_(v, bang) {
  const ma = String(v[COT.Ma_Tho] || '').trim();
  if (ma && bang.theoMa[ma] !== undefined) return bang.theoMa[ma];
  const ten = String(v[COT.Ten_Tho] || '').trim();
  if (ten && bang.theoTen[ten] !== undefined) return bang.theoTen[ten];
  return bang.chung;
}

/**
 * Tính lại 5 cột KPI cho CẢ `Su_Co` LẪN `Luu_Tru`. Chạy từ menu 🔧 Bảo trì.
 *
 * Vì sao cần: năm cột này mới có từ 09/2026, còn `acceptTask` chỉ ghi được cho
 * phiếu nhận từ lúc bản mới lên web app. Mọi mốc giờ cần thiết đều đã nằm sẵn
 * trong sheet nên tính lại được cho cả các tháng đã qua.
 *
 * VÌ SAO PHẢI PHỦ CẢ `Luu_Tru` — bản cũ chỉ đọc/ghi `Su_Co`. Từ 12/09/2026 phiếu
 * HOÀN THÀNH của các tháng trước bị dời sang `Luu_Tru`, nên 520 phiếu tháng 8
 * rơi ra khỏi tầm với của hàm này: bấm menu 🎯 bao nhiêu lần cũng không bao giờ
 * tính tới chúng, mà hàm vẫn báo thành công. Đúng kiểu hỏng im lặng.
 *
 * Mỗi sheet một lượt: kiểm ĐỦ CỘT trước, đọc, tính, ghi bằng MỘT `setValues`,
 * rồi `SpreadsheetApp.flush()`. Thiếu cột thì DỪNG sheet đó và nói rõ, không ghi
 * nửa chừng. Flush là bắt buộc: đọc lại ngay sau khi ghi trong cùng một lượt
 * chạy thì đọc phải trạng thái TRƯỚC lệnh ghi — `archiveOldTickets()` chạy liền
 * sau đã dính đúng cái đó và báo "còn 520 phiếu chưa tính KPI" ngay dưới dòng
 * vừa nói đã tính xong.
 *
 * Gom đoạn bận theo thợ trên TOÀN BỘ hai sheet, không riêng từng sheet: phiếu
 * gây bận có thể đã bị dời sang `Luu_Tru` trong khi phiếu đang xét còn ở `Su_Co`.
 * Tính riêng từng sheet là số KPI đổi theo thời điểm chạy dọn — không thể chấp nhận.
 *
 * Chạy lại nhiều lần vô hại: hàm tính thuần từ các mốc giờ, không cộng dồn.
 * Chỉ ghi đúng khối 5 cột mới — không đụng mốc thời gian hay ba cột KPI cũ.
 */
function tinhLaiKpiTho() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return 'Hệ thống đang bận, thử lại sau vài giây.';
    }

    const bangNguong = bangNguongTho_();

    // --- Đọc cả hai sheet trước khi ghi bất cứ đâu ---------------------------
    const dsSheet = [];
    const dsLoi = [];
    [SHEET.SU_CO, SHEET.LUU_TRU].forEach(function (ten) {
      const sh = ss_().getSheetByName(ten);
      if (!sh) { dsLoi.push(ten + ': chưa có sheet'); return; }

      // Sheet cũ mới có 28 cột, đọc/ghi 33 cột là văng "out of bounds" giữa
      // chừng. Nói thẳng phải làm gì, thay vì để người dùng nhận lỗi kỹ thuật.
      if (sh.getMaxColumns() < HEADER_SU_CO.length) {
        dsLoi.push(ten + ': chưa đủ ' + HEADER_SU_CO.length + ' cột');
        return;
      }
      const soDong = sh.getLastRow() - 1;
      if (soDong < 1) { dsSheet.push({ ten: ten, sh: sh, values: [] }); return; }
      dsSheet.push({
        ten: ten, sh: sh,
        values: sh.getRange(2, 1, soDong, HEADER_SU_CO.length).getValues(),
      });
    });

    // Thiếu cột ở sheet nào thì KHÔNG ghi sheet nào cả. Ghi một nửa rồi mới báo
    // lỗi là để lại dữ liệu nửa mới nửa cũ, đối chiếu không nổi.
    if (dsLoi.length) {
      return 'DỪNG, chưa ghi gì cả:\n• ' + dsLoi.join('\n• ') +
        '\nChạy menu 🔧 Bảo trì → "1. Cài đặt hệ thống" một lần rồi tính lại.';
    }

    // --- Gom đoạn bận theo thợ, trên TOÀN BỘ dữ liệu hai sheet ---------------
    const theoTho = {};
    dsSheet.forEach(function (s) {
      s.values.forEach(function (v, i) {
        if (String(v[COT.Ma_Su_Co]).trim() === '') return;
        const ma = String(v[COT.Ma_Tho]).trim();
        if (!ma) return;
        if (!theoTho[ma]) theoTho[ma] = [];
        theoTho[ma].push({ dong: i + 2, v: v });
      });
    });

    // --- Tính và ghi từng sheet ---------------------------------------------
    const cotDau = COT.Phut_Ban_Thuc_Te + 1;   // 1-based cho getRange
    const baoTheoSheet = [];
    const dsPhieuHong = [];
    let tongApDung = 0, tongNhieuDoan = 0, tongDat = 0, tongDong = 0;

    dsSheet.forEach(function (s) {
      if (!s.values.length) {
        baoTheoSheet.push(s.ten + ': 0 dòng (sheet trống)');
        return;
      }
      const khoi = [];
      let soApDung = 0, soNhieuDoan = 0, soDat = 0;

      s.values.forEach(function (v) {
        if (String(v[COT.Ma_Su_Co]).trim() === '') { khoi.push(['', '', '', '', '']); return; }

        // try/catch quanh TỪNG DÒNG: một dòng dữ liệu lạ không được kéo sập cả
        // lượt tính, và mã phiếu hỏng phải được in ra để đi sửa đúng chỗ.
        try {
          const cungTho = theoTho[String(v[COT.Ma_Tho]).trim()] || [];
          const k = kpiThoChoPhieu_(cungTho, v, nguongChoDong_(v, bangNguong));
          if (k.apDung === 'CO') {
            soApDung++;
            if (k.soDoan >= 2) soNhieuDoan++;
            if (k.datNguong === 'DAT') soDat++;
          }
          khoi.push([k.phutBan, k.phutKpi, k.soDoan, k.apDung, k.datNguong]);
        } catch (err) {
          dsPhieuHong.push(String(v[COT.Ma_Su_Co]).trim() + ' (' + err.message + ')');
          khoi.push(['', '', '', 'KHONG — lỗi tính: ' + err.message, '']);
        }
      });

      s.sh.getRange(2, cotDau, khoi.length, 5).setValues(khoi);
      // Đẩy xuống Sheet NGAY. Không flush thì hàm nào đọc lại trong cùng lượt
      // chạy sẽ thấy dữ liệu cũ — xem phần giải thích ở đầu hàm.
      SpreadsheetApp.flush();

      tongDong += khoi.length;
      tongApDung += soApDung;
      tongNhieuDoan += soNhieuDoan;
      tongDat += soDat;
      baoTheoSheet.push(s.ten + ': ghi ' + khoi.length + ' dòng, ' +
        soApDung + ' phiếu vào KPI');
    });

    ghiNhatKy_('', '', 'HE_THONG', 'TINH_LAI_KPI',
      { theoSheet: baoTheoSheet, soApDung: tongApDung, soHong: dsPhieuHong.length }, '');

    const coNguongRieng = Object.keys(bangNguong.theoTen)
      .filter(function (k) { return bangNguong.theoTen[k] > 0; }).length;

    return 'Đã tính lại KPI cho ' + tongDong + ' dòng.\n' +
      '• ' + baoTheoSheet.join('\n• ') + '\n' +
      '• Vào KPI: ' + tongApDung + ' phiếu\n' +
      '• Có từ 2 đoạn bận rời (cách cũ tính rộng tay): ' + tongNhieuDoan + ' phiếu\n' +
      (coNguongRieng
        ? '• Đã chấm theo ngưỡng riêng của ' + coNguongRieng + ' thợ: đạt ' +
          tongDat + '/' + tongApDung + ' phiếu'
        : '• Chưa thợ nào có ngưỡng riêng — điền cột Nguong_KPI_Phut ở sheet ' +
          'Danh_Muc_Tho, hoặc NGUONG_KPI_DAP_UNG_PHUT ở Cau_Hinh cho ngưỡng chung.') +
      (dsPhieuHong.length
        ? '\n⚠️ ' + dsPhieuHong.length + ' phiếu lỗi khi tính: ' +
          dsPhieuHong.slice(0, 10).join(', ')
        : '');
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 2c. CHẨN ĐOÁN KPI — chỉ ĐỌC, không ghi gì
//
// Mục này ra đời sau nửa ngày đi tìm lý do báo cáo in "CHƯA TÍNH KPI" dù đã bấm
// menu 🎯. Hai nguyên nhân đều thuộc loại không để lại dấu vết (quy tắc xác thực
// đặt lệch cột huỷ âm thầm cả khối setValues; đọc lại ngay sau khi ghi mà chưa
// flush thì thấy dữ liệu cũ). Giữ mục này và cập nhật cho khớp thiết kế mới —
// chính nó đã cắt bài toán "KPI lỗi rất nhiều" xuống còn một dòng mã.
// ============================================================================

/**
 * Thống kê trạng thái KPI của một tập dòng. HÀM THUẦN — chỉ nhận mảng.
 *
 * Tách ba nhóm mà báo cáo cũ gộp thành một dòng doạ người đọc:
 *   - daCham    : KPI_Ap_Dung = 'CO' và có số Phut_KPI_Tho → đo được, dùng được
 *   - khongDoDuoc: đã tính nhưng bị loại có lý do (loại phiếu, chưa ai nhận,
 *                  thiếu mốc giờ) → KHÔNG phải lỗi, không cần làm gì
 *   - chuaTinh  : phiếu ĐO ĐƯỢC đáp ứng mà ô KPI_Ap_Dung còn trống → thứ duy
 *                 nhất cần bấm menu 🎯 để sửa
 */
function thongKeKpi_(ds) {
  const kq = {
    tong: 0, doDuocDapUng: 0, daCham: 0, chuaTinh: 0,
    khongDoDuoc: { loaiPhieu: 0, chuaNhan: 0, thieuMoc: 0, khac: 0 },
    thieuMocGio: [], lechDangThuc: [],
  };

  ds.forEach(function (v) {
    if (String(v[COT.Ma_Su_Co] || '').trim() === '') return;
    kq.tong++;
    const doDuoc = laDoDapUng_(v);
    if (doDuoc) kq.doDuocDapUng++;

    const tt = String(v[COT.KPI_Ap_Dung] || '').trim();
    if (!tt) {
      // Phiếu CV-/BT-/DM- chưa tính thì cũng không bao giờ vào KPI — đừng gộp
      // chúng vào con số cảnh báo.
      if (doDuoc) kq.chuaTinh++;
      return;
    }
    if (tt === 'CO') {
      if (String(v[COT.Phut_KPI_Tho]) !== '') kq.daCham++;
      // Đẳng thức phải đúng trên nhóm thợ RẢNH: không bận thì ba con số bằng nhau.
      // Lệch là dấu hiệu dữ liệu hỏng, phải báo ra chứ không được im.
      if (Number(v[COT.So_Chong_Viec] || 0) === 0 &&
          Number(v[COT.Phut_Cho_Tho_Ban] || 0) === 0 &&
          String(v[COT.Phut_Tiep_Nhan]) !== '' &&
          String(v[COT.Phut_KPI_Tho]) !== '' &&
          Number(v[COT.Phut_Tiep_Nhan]) !== Number(v[COT.Phut_KPI_Tho])) {
        kq.lechDangThuc.push(String(v[COT.Ma_Su_Co]).trim());
      }
      return;
    }
    if (tt.indexOf('chưa ai nhận') >= 0) kq.khongDoDuoc.chuaNhan++;
    else if (tt.indexOf('thiếu mốc giờ') >= 0) {
      kq.khongDoDuoc.thieuMoc++;
      kq.thieuMocGio.push(String(v[COT.Ma_Su_Co]).trim());
    } else if (tt.indexOf('phiếu ') >= 0) kq.khongDoDuoc.loaiPhieu++;
    else kq.khongDoDuoc.khac++;
  });

  return kq;
}

/**
 * Menu 🩺 Chẩn đoán KPI — in số cột / số dòng của cả hai sheet, tách ba nhóm
 * trạng thái, soi quy tắc xác thực còn sót, và CHẠY THỬ phép tính mà KHÔNG ghi.
 *
 * Chỉ đọc. Không có đường nào từ hàm này làm đổi dữ liệu — chạy được giữa ca
 * sản xuất, bao nhiêu lần cũng được.
 */
function chanDoanKpi() {
  const dong = [];
  const bangNguong = bangNguongTho_();

  dong.push('🩺 CHẨN ĐOÁN KPI ĐÁP ỨNG — chỉ đọc, không ghi gì.');
  dong.push('');

  // --- 1. Hai sheet: đủ cột chưa, bao nhiêu dòng --------------------------
  const dsSheet = [];
  [SHEET.SU_CO, SHEET.LUU_TRU].forEach(function (ten) {
    const sh = ss_().getSheetByName(ten);
    if (!sh) { dong.push('❌ ' + ten + ': CHƯA CÓ SHEET.'); return; }
    const soCot = sh.getMaxColumns();
    const soDong = Math.max(0, sh.getLastRow() - 1);
    dong.push((soCot >= HEADER_SU_CO.length ? '✅ ' : '❌ ') + ten + ': ' +
      soCot + ' cột (cần ' + HEADER_SU_CO.length + ') · ' + soDong + ' dòng');
    if (soCot < HEADER_SU_CO.length || soDong < 1) return;
    dsSheet.push({
      ten: ten, sh: sh,
      values: sh.getRange(2, 1, soDong, HEADER_SU_CO.length).getValues(),
    });
  });

  // --- 2. Ba nhóm trạng thái, tách rõ ------------------------------------
  dong.push('');
  dong.push('── TRẠNG THÁI KPI ──');
  let tongChuaTinh = 0;
  const tatCa = [];
  dsSheet.forEach(function (s) {
    const tk = thongKeKpi_(s.values);
    tongChuaTinh += tk.chuaTinh;
    s.values.forEach(function (v) { tatCa.push(v); });
    dong.push(s.ten + ': ' + tk.tong + ' phiếu · đo được đáp ứng ' +
      tk.doDuocDapUng + ' · đã chấm ' + tk.daCham + ' · CHƯA TÍNH ' + tk.chuaTinh);
    dong.push('   không đo được (đúng bản chất, không phải lỗi): ' +
      'loại phiếu ' + tk.khongDoDuoc.loaiPhieu +
      ' · chưa ai nhận ' + tk.khongDoDuoc.chuaNhan +
      ' · thiếu mốc giờ ' + tk.khongDoDuoc.thieuMoc +
      (tk.khongDoDuoc.khac ? ' · khác ' + tk.khongDoDuoc.khac : ''));
    if (tk.thieuMocGio.length) {
      dong.push('   ⚠️ thiếu mốc "giờ thợ nhận" — do NHẬP THIẾU, phải sửa tay: ' +
        tk.thieuMocGio.slice(0, 15).join(', '));
    }
    if (tk.lechDangThuc.length) {
      dong.push('   ❌ lệch đẳng thức (thợ rảnh mà Phut_Tiep_Nhan ≠ Phut_KPI_Tho): ' +
        tk.lechDangThuc.slice(0, 15).join(', '));
    }
  });
  dong.push(tongChuaTinh
    ? '👉 Còn ' + tongChuaTinh + ' phiếu CHƯA TÍNH. Bấm 🎯 Tính lại KPI đáp ứng của thợ.'
    : '👉 Không còn phiếu nào chưa tính.');

  // --- 3. Quy tắc xác thực còn sót trên cột mã tự ghi --------------------
  // Đây là thứ đã âm thầm huỷ cả khối setValues ngày 12/09/2026. Soi chứ không gỡ:
  // hàm này chỉ đọc, gỡ là việc của setupSystem().
  dong.push('');
  dong.push('── QUY TẮC XÁC THỰC TRÊN CỘT MÃ TỰ GHI ──');
  const conSot = [];
  dsSheet.forEach(function (s) {
    COT_MA_TU_GHI.forEach(function (tenCot) {
      const i = HEADER_SU_CO.indexOf(tenCot);
      if (i < 0 || i + 1 > s.sh.getMaxColumns()) return;
      const dsRule = s.sh.getRange(2, i + 1, Math.min(s.values.length, 50), 1)
        .getDataValidations();
      for (let r = 0; r < dsRule.length; r++) {
        if (dsRule[r][0]) { conSot.push(s.ten + '!' + tenCot); return; }
      }
    });
  });
  dong.push(conSot.length
    ? '❌ CÒN SÓT: ' + conSot.join(', ') + '\n' +
      '   Quy tắc này sẽ ÂM THẦM huỷ lệnh ghi, không báo lỗi gì. ' +
      'Bấm "1. Cài đặt hệ thống" để gỡ.'
    : '✅ Sạch — không cột mã tự ghi nào còn quy tắc xác thực.');

  // --- 4. Ngưỡng đang áp --------------------------------------------------
  dong.push('');
  dong.push('── NGƯỠNG ĐANG ÁP ──');
  const dsTen = Object.keys(bangNguong.theoTen).sort();
  dong.push('Ngưỡng chung (Cau_Hinh.NGUONG_KPI_DAP_UNG_PHUT): ' +
    (bangNguong.chung ? bangNguong.chung + ' phút' : 'CHƯA CHỐT'));
  dong.push(dsTen.length
    ? 'Theo thợ (Danh_Muc_Tho.Nguong_KPI_Phut): ' + dsTen.map(function (t) {
      return t + ' ' + (bangNguong.theoTen[t] ? bangNguong.theoTen[t] + '′' : '—');
    }).join(' · ')
    : 'Chưa có thợ nào trong Danh_Muc_Tho.');

  // --- 5. Chạy thử phép tính, KHÔNG ghi ----------------------------------
  dong.push('');
  dong.push('── CHẠY THỬ PHÉP TÍNH (không ghi) ──');
  const theoTho = {};
  tatCa.forEach(function (v, i) {
    const ma = String(v[COT.Ma_Tho] || '').trim();
    if (!ma || String(v[COT.Ma_Su_Co] || '').trim() === '') return;
    if (!theoTho[ma]) theoTho[ma] = [];
    theoTho[ma].push({ dong: i + 2, v: v });
  });
  let thuApDung = 0, thuLech = 0, thuHong = 0;
  tatCa.forEach(function (v) {
    if (String(v[COT.Ma_Su_Co] || '').trim() === '') return;
    try {
      const k = kpiThoChoPhieu_(theoTho[String(v[COT.Ma_Tho] || '').trim()] || [],
        v, nguongChoDong_(v, bangNguong));
      if (k.apDung !== 'CO') return;
      thuApDung++;
      // So số vừa tính thử với số đang nằm trên sheet. Lệch nghĩa là sheet đang
      // giữ số cũ — hoặc lệnh ghi lần trước đã bị huỷ mà không ai biết.
      if (String(v[COT.Phut_KPI_Tho]) !== String(k.phutKpi)) thuLech++;
    } catch (err) { thuHong++; }
  });
  dong.push('Tính thử được ' + thuApDung + ' phiếu · lệch với số trên sheet ' +
    thuLech + ' phiếu' + (thuHong ? ' · lỗi ' + thuHong + ' phiếu' : ''));
  dong.push(thuLech
    ? '👉 Có lệch. Bấm 🎯 Tính lại KPI rồi chạy lại 🩺 để xác nhận về 0.'
    : '👉 Số trên sheet khớp với phép tính hiện tại.');

  return dong.join('\n');
}

/** Rút gọn một dòng Su_Co để gửi về client. */
function gonPhieu_(v) {
  return {
    maSuCo: v[COT.Ma_Su_Co],
    maMay: v[COT.Ma_May],
    tenMay: v[COT.Ten_May],
    boPhan: v[COT.Bo_Phan],
    trangThaiMay: v[COT.Trang_Thai_May],
    nhomLoi: v[COT.Nhom_Loi],
    moTa: v[COT.Mo_Ta],
    trangThai: v[COT.Trang_Thai],
    thoiGianBao: dinhDangThoiGian_(v[COT.Thoi_Gian_Bao]),
    thoiGianNhan: dinhDangThoiGian_(v[COT.Thoi_Gian_Nhan]),
    thoiGianHoanThanh: dinhDangThoiGian_(v[COT.Thoi_Gian_Hoan_Thanh]),
    tenTho: v[COT.Ten_Tho],
    phutTiepNhan: v[COT.Phut_Tiep_Nhan],
    phutXuLy: v[COT.Phut_Xu_Ly],
    ca: v[COT.Ca],
    laCongViec: laCongViec_(v),
    laHoTro: laHoTro_(v),
    // Số phút phiếu đã chờ, để client tô đỏ phiếu chờ lâu.
    phutDaCho: v[COT.Thoi_Gian_Bao] instanceof Date
      ? Math.round((Date.now() - v[COT.Thoi_Gian_Bao].getTime()) / 60000) : '',
  };
}

// ============================================================================
// 3. RPC — KHỞI TẠO TRANG THỢ
// ============================================================================

/**
 * Dữ liệu mở trang thợ:
 *   - choNhan : phiếu CHO_NHAN thuộc bộ phận thợ phụ trách.
 *               KHÔNG lọc theo chuyên môn — vì ban đêm thợ điện phải nhận được
 *               cả việc cơ khí (thang fallback nấc 2 ở CongNhan.gs). Thay vào đó
 *               đánh dấu `dungChuyenMon` và xếp việc đúng chuyên môn lên trước.
 *   - cuaToi  : phiếu DANG_XU_LY của chính thợ này.
 *   - lichSu  : 5 phiếu gần nhất thợ đã hoàn thành.
 */
function getTechnicianBootstrap(maTho, token) {
  try {
    const tho = xacThucTho_(maTho, token);
    if (!tho) {
      return { ok: false, error: 'Link không hợp lệ hoặc tài khoản đã ngừng hoạt động. Liên hệ quản lý để lấy link mới.' };
    }

    const ma = String(tho.Ma_Tho).trim();
    const luc = nowVN_();
    const caTho = xacDinhCa_(tho.Nhom_Ca, luc);
    const ds = docSuCoGanDay_();
    const choNhan = [];
    const cuaToi = [];
    const lichSu = [];

    // Có thợ ĐÚNG chuyên môn đang trực cho (bộ phận, nhóm lỗi) này không?
    // Dùng lại đúng điều kiện nấc 1 của danh bạ để trang thợ và danh bạ công nhân
    // không nói hai đằng. Cache theo cặp khoá vì getOnDutyContacts_ đọc cả sheet.
    const cacheTruc = {};
    function coNguoiDungChuyenMon_(boPhan, nhomLoi) {
      const khoa = boPhan + '|' + nhomLoi;
      if (!(khoa in cacheTruc)) {
        cacheTruc[khoa] =
          getOnDutyContacts_(boPhan, nhomLoi, luc).mucCanhBao === MUC_CANH_BAO.BINH_THUONG;
      }
      return cacheTruc[khoa];
    }

    ds.forEach(function (r) {
      const v = r.v;
      // Phiếu dừng máy không do hư hỏng không phải việc của thợ — công nhân tự
      // mở và tự đóng bằng cách quét lại QR. Phiếu `HT-` thì ngược lại: công
      // nhân mở, nhưng là để gọi thợ, nên nó đi đúng luồng như phiếu sự cố.
      if (laDungMay_(v)) return;

      const tt = v[COT.Trang_Thai];
      const cuaMinh = String(v[COT.Ma_Tho]).trim() === ma;

      if (tt === TRANG_THAI.CHO_NHAN) {
        if (!phuTrachBoPhan_(tho.Bo_Phan_Phu_Trach, v[COT.Bo_Phan])) return;
        const p = gonPhieu_(v);
        p.dungChuyenMon = hopChuyenMon_(tho.Chuyen_Mon, v[COT.Nhom_Loi]);
        // Phiếu ngoài chuyên môn: ẩn bớt khi đã có người đúng nghề đang trực,
        // chỉ nổi lên khi không còn ai — đúng tình huống "gọi thợ điện ban đêm".
        p.anBotDi = !p.dungChuyenMon &&
          coNguoiDungChuyenMon_(v[COT.Bo_Phan], v[COT.Nhom_Loi]);
        choNhan.push(p);
      } else if (tt === TRANG_THAI.DANG_XU_LY && cuaMinh) {
        cuaToi.push(gonPhieu_(v));
      } else if (tt === TRANG_THAI.HOAN_THANH && cuaMinh && !laBaoTri_(v)) {
        // Bảo trì hằng ngày không vào lịch sử — mỗi ca có thể vài chục dòng,
        // sẽ đè mất các phiếu sự cố thật. Chỉ hiện dạng con số đếm.
        lichSu.push(chiTietPhieu_(v));
      }
    });

    // Việc đúng chuyên môn lên trước, trong mỗi nhóm thì phiếu chờ lâu lên trước.
    choNhan.sort(function (a, b) {
      if (a.dungChuyenMon !== b.dungChuyenMon) return a.dungChuyenMon ? -1 : 1;
      return (b.phutDaCho || 0) - (a.phutDaCho || 0);
    });

    return {
      ok: true,
      tho: {
        maTho: ma,
        tenTho: String(tho.Ten_Tho).trim(),
        chuyenMon: String(tho.Chuyen_Mon).trim(),
        nhomCa: String(tho.Nhom_Ca).trim(),
      },
      caHienTai: caTho,
      dsBaoTri: dsBaoTriTrongCa_(ds, ma, caTho.ngayCa),
      choNhan: choNhan,
      cuaToi: cuaToi.reverse(),
      lichSu: lichSu.reverse().slice(0, 10),
      capNhatLuc: fmtGio_(nowVN_()),
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============================================================================
// 4. RPC — NHẬN VIỆC
// ============================================================================

/**
 * Thợ nhận một phiếu CHO_NHAN.
 * Chặn 2 thợ cùng nhận: kiểm Trang_Thai + cột Ma_Tho còn trống, bên trong lock.
 */
function acceptIncident(maSuCo, maTho, token, requestId) {
  const lock = LockService.getScriptLock();
  // Nhả khoá được đúng một lần, gọi thêm cũng vô hại. Cần vì phần nhắn Telegram
  // cuối hàm phải chạy NGOÀI khoá — rào 5.2. Cùng lối với reportIncident.
  let daMoKhoa = false;
  function moKhoa_() { if (!daMoKhoa) { lock.releaseLock(); daMoKhoa = true; } }
  try {
    // Đọc cấu hình TRƯỚC khi giành khoá (nguyên tắc 4) — ngưỡng chỉ là con số để
    // chấm đạt/không đạt, không dính gì tới thứ tự ghi.
    const nguongKpiPhut = nguongKpi_();

    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const tho = xacThucTho_(maTho, token);
    if (!tho) return { ok: false, error: 'Link không hợp lệ.' };
    if (!String(requestId || '').trim()) return { ok: false, error: 'Thiếu mã request.' };

    const dsGanDay = docSuCoGanDay_();
    const r = timDongSuCo_(maSuCo, dsGanDay);
    if (!r) return { ok: false, error: 'Không tìm thấy phiếu ' + maSuCo + '.' };
    const v = r.v;

    // Double-tap: chính request này đã ghi rồi.
    if (String(v[COT.Request_ID_Cuoi]).trim() === String(requestId).trim()) {
      return { ok: true, trung: true, phieu: gonPhieu_(v) };
    }

    if (v[COT.Trang_Thai] !== TRANG_THAI.CHO_NHAN || String(v[COT.Ma_Tho]).trim()) {
      return {
        ok: false,
        error: 'Phiếu ' + maSuCo + ' đã được ' +
          (String(v[COT.Ten_Tho]).trim() || 'người khác') + ' nhận rồi.',
      };
    }

    const luc = nowVN_();
    // KHÔNG đặt tên biến này là `maTho`: trùng tên tham số của hàm, mà khai bằng
    // const trong khối try sẽ che tham số và làm dòng xacThucTho_(maTho, ...) ở
    // trên chạm vào biến chưa khởi tạo → "Cannot access 'maTho' before initialization".
    const maThoNhan = String(tho.Ma_Tho).trim();
    const dapUng = tinhDapUng_(dsGanDay, maThoNhan, maSuCo, v[COT.Thoi_Gian_Bao], luc);

    v[COT.Trang_Thai] = TRANG_THAI.DANG_XU_LY;
    v[COT.Ma_Tho] = maThoNhan;
    v[COT.Ten_Tho] = String(tho.Ten_Tho).trim();
    v[COT.Thoi_Gian_Nhan] = luc;
    v[COT.Phut_Tiep_Nhan] = soPhut_(v[COT.Thoi_Gian_Bao], luc);
    v[COT.Phut_Cho_Tho_Ban] = dapUng.cho;
    v[COT.Phut_Dap_Ung_Thuc] = dapUng.thuc;
    v[COT.So_Chong_Viec] = dapUng.chongViec;

    // KPI bản cộng dồn đoạn bận. Gọi SAU các dòng trên vì hàm đọc Ma_Tho và
    // Thoi_Gian_Nhan vừa gán; phiếu đang xét tự bị loại khỏi phép so theo mã.
    const kpi = kpiThoChoPhieu_(dsGanDay, v, nguongKpiPhut);
    v[COT.Phut_Ban_Thuc_Te] = kpi.phutBan;
    v[COT.Phut_KPI_Tho] = kpi.phutKpi;
    v[COT.So_Doan_Ban] = kpi.soDoan;
    v[COT.KPI_Ap_Dung] = kpi.apDung;
    v[COT.Dat_Nguong] = kpi.datNguong;

    v[COT.Cap_Nhat_Luc] = luc;
    v[COT.Request_ID_Cuoi] = String(requestId).trim();
    v[COT.Phien_Ban] = (Number(v[COT.Phien_Ban]) || 0) + 1;

    ghiCaDong_(r.dong, v);
    ghiNhatKy_(v[COT.Ma_Su_Co], v[COT.Ma_May], v[COT.Ma_Tho], 'NHAN_VIEC', {
      phutTiepNhan: v[COT.Phut_Tiep_Nhan],
      phutChoThoBan: dapUng.cho,
      phutDapUngThuc: dapUng.thuc,
      soChongViec: dapUng.chongViec,
      phutBanThucTe: kpi.phutBan,
      phutKpiTho: kpi.phutKpi,
    }, requestId);

    // Phiếu đã ghi xong → nhả khoá NGAY, đừng bắt người phía sau chờ thêm một
    // lượt đọc danh mục thợ và một cuộc gọi mạng — rào 5.2.
    moKhoa_();

    // Báo cho những thợ trực CÒN LẠI biết đã có người nhận, để hai người không
    // cùng chạy tới một máy. Đây là thứ thay cho nút "chuyển việc cho người
    // trực cùng ca" đã bị bác ở mục 2 của TASK_THONG_BAO_TELEGRAM.md.
    try { thongBaoDaNhan_(v, maTho); } catch (e) { /* bỏ qua */ }

    return { ok: true, phieu: gonPhieu_(v) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    moKhoa_();
  }
}

/** Ghi lại toàn bộ một dòng Su_Co bằng ĐÚNG MỘT setValues (nguyên tắc 1). */
function ghiCaDong_(dong, v) {
  sheet_(SHEET.SU_CO).getRange(dong, 1, 1, HEADER_SU_CO.length).setValues([v]);
}

// ============================================================================
// 5. RPC — SỬA LẠI NHÓM LỖI
// ============================================================================

/**
 * Thợ cập nhật hiện trạng phiếu khi tới nơi thấy khác với lúc công nhân báo:
 * sửa NHÓM LỖI (báo "điện" nhưng thật ra hỏng cơ khí) và/hoặc TRẠNG THÁI MÁY
 * (báo "còn chạy" nhưng thực tế phải dừng mới sửa được).
 *
 * Thay cho `reclassifyIncident` của bản thiết kế — gộp hai thao tác vào một lần
 * ghi thay vì hai, đúng nguyên tắc "một setValues cho một thay đổi".
 *
 * Mốc `Thoi_Gian_Dung_May` được ghi đúng lúc lật sang DA_DUNG (nếu chưa có), và
 * xoá nếu lật ngược lại — để downtime không tính oan từ lúc báo.
 *
 * payload = { incidentId, techId, token, requestId, nhomLoiMoi, trangThaiMayMoi }
 * Trường nào bỏ trống thì giữ nguyên giá trị cũ.
 */
function updateIncidentState(payload) {
  const p = payload || {};
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const tho = xacThucTho_(p.techId, p.token);
    if (!tho) return { ok: false, error: 'Link không hợp lệ.' };

    const nhomMoi = String(p.nhomLoiMoi || '').trim().toUpperCase();
    const mayMoi = String(p.trangThaiMayMoi || '').trim().toUpperCase();
    if (nhomMoi && NHOM_LOI.indexOf(nhomMoi) === -1) {
      return { ok: false, error: 'Nhóm lỗi không hợp lệ.' };
    }
    if (mayMoi && TRANG_THAI_MAY.indexOf(mayMoi) === -1) {
      return { ok: false, error: 'Trạng thái máy không hợp lệ.' };
    }
    if (!nhomMoi && !mayMoi) return { ok: false, error: 'Không có gì để cập nhật.' };

    const r = timDongSuCo_(p.incidentId);
    if (!r) return { ok: false, error: 'Không tìm thấy phiếu ' + p.incidentId + '.' };
    const v = r.v;

    const requestId = String(p.requestId || '').trim();
    if (requestId && String(v[COT.Request_ID_Cuoi]).trim() === requestId) {
      return { ok: true, trung: true, phieu: gonPhieu_(v) };
    }
    if (v[COT.Trang_Thai] === TRANG_THAI.HOAN_THANH) {
      return { ok: false, error: 'Phiếu đã đóng, không sửa được nữa.' };
    }
    const nguoiGiu = String(v[COT.Ma_Tho]).trim();
    if (nguoiGiu && nguoiGiu !== String(tho.Ma_Tho).trim()) {
      return { ok: false, error: 'Phiếu đang do ' + v[COT.Ten_Tho] + ' xử lý.' };
    }

    const luc = nowVN_();
    const truoc = { nhomLoi: v[COT.Nhom_Loi], trangThaiMay: v[COT.Trang_Thai_May] };

    if (nhomMoi) v[COT.Nhom_Loi] = nhomMoi;
    if (mayMoi) {
      v[COT.Trang_Thai_May] = mayMoi;
      if (mayMoi === 'DA_DUNG') {
        if (!(v[COT.Thoi_Gian_Dung_May] instanceof Date)) v[COT.Thoi_Gian_Dung_May] = luc;
      } else {
        v[COT.Thoi_Gian_Dung_May] = '';
      }
    }
    v[COT.Cap_Nhat_Luc] = luc;
    if (requestId) v[COT.Request_ID_Cuoi] = requestId;
    v[COT.Phien_Ban] = (Number(v[COT.Phien_Ban]) || 0) + 1;

    ghiCaDong_(r.dong, v);
    ghiNhatKy_(v[COT.Ma_Su_Co], v[COT.Ma_May], String(tho.Ma_Tho).trim(), 'CAP_NHAT_HIEN_TRANG',
      { truoc: truoc, sau: { nhomLoi: v[COT.Nhom_Loi], trangThaiMay: v[COT.Trang_Thai_May] } },
      requestId);

    return { ok: true, phieu: gonPhieu_(v) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 6. RPC — TẠO CÔNG VIỆC CHUNG
// ============================================================================

/**
 * Thợ tự tạo phiếu cho việc KHÔNG gắn với máy nào: lắp camera, sửa điện văn
 * phòng, kéo dây nhà kho… Phiếu vào thẳng DANG_XU_LY mang tên người tạo, vì
 * loại việc này thường được giao miệng rồi thợ chỉ ghi nhận lại.
 *
 * Khác phiếu sự cố:
 *   - Ma_May trống, Ten_May = tên công việc, Bo_Phan = khu vực (gõ tự do).
 *   - Không có Trang_Thai_May, không có Phut_Tiep_Nhan / Phut_Dap_Ung_Thuc —
 *     không ai "báo hỏng" nên đo thời gian đáp ứng là vô nghĩa.
 *   - VẪN có Thoi_Gian_Nhan → Thoi_Gian_Hoan_Thanh, nên vẫn được tinhDapUng_
 *     tính là thợ đang bận. Đây chính là lý do để chung sheet Su_Co: thợ lắp
 *     camera 2 tiếng thì máy hỏng trong lúc đó không bị trừ vào KPI của họ.
 *
 * payload = { techId, token, requestId, tenCongViec, khuVuc, nhomLoi, moTa }
 */
function createGeneralTask(payload) {
  const p = payload || {};
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const tho = xacThucTho_(p.techId, p.token);
    if (!tho) return { ok: false, error: 'Link không hợp lệ.' };

    const requestId = String(p.requestId || '').trim();
    if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

    const ten = String(p.tenCongViec || '').trim().slice(0, CONFIG.MAX_MO_TA);
    if (!ten) return { ok: false, error: 'Vui lòng nhập tên công việc.' };

    const nhomLoi = String(p.nhomLoi || 'KHONG_RO').trim().toUpperCase();
    if (NHOM_LOI.indexOf(nhomLoi) === -1) return { ok: false, error: 'Nhóm việc không hợp lệ.' };

    const dsGanDay = docSuCoGanDay_();
    for (let i = dsGanDay.length - 1; i >= 0; i--) {
      if (String(dsGanDay[i].v[COT.Request_ID_Cuoi]).trim() === requestId) {
        return { ok: true, trung: true, phieu: gonPhieu_(dsGanDay[i].v) };
      }
    }

    const luc = nowVN_();
    const maTho = String(tho.Ma_Tho).trim();
    const khuVuc = String(p.khuVuc || '').trim().slice(0, 100);
    const caTho = xacDinhCa_(tho.Nhom_Ca, luc);
    const ma = sinhMaPhieu_(luc, 'CV');

    // Ten_May để TRỐNG: việc chung không gắn với máy nào, mà cột đó chỉ được
    // chứa tên máy thật — nếu không mọi phép gom nhóm theo máy về sau sẽ ăn nhầm.
    // Tên công việc thuộc về cột mô tả.
    const dong = new Array(HEADER_SU_CO.length).fill('');
    dong[COT.Ma_Su_Co] = ma;
    dong[COT.Ten_May] = '';
    dong[COT.Bo_Phan] = khuVuc;       // khu vực
    dong[COT.Nhom_Loi] = nhomLoi;
    dong[COT.Mo_Ta] = (ten + (p.moTa ? ' — ' + String(p.moTa).trim() : ''))
      .slice(0, CONFIG.MAX_MO_TA);
    dong[COT.Trang_Thai] = TRANG_THAI.DANG_XU_LY;
    dong[COT.Thoi_Gian_Bao] = luc;
    dong[COT.Ma_Tho] = maTho;
    dong[COT.Ten_Tho] = String(tho.Ten_Tho).trim();
    dong[COT.Thoi_Gian_Nhan] = luc;   // tạo là nhận luôn → đáp ứng bằng 0, không ghi
    dong[COT.Ngay_Ca] = caTho.ngayCa;
    dong[COT.Ca] = caTho.ca || 'NGOAI_GIO';
    dong[COT.Cap_Nhat_Luc] = luc;
    dong[COT.Request_ID_Cuoi] = requestId;
    dong[COT.Phien_Ban] = 1;
    dong[COT.Loai_Phieu] = LOAI_PHIEU.CONG_VIEC;

    const sh = sheet_(SHEET.SU_CO);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEADER_SU_CO.length).setValues([dong]);

    ghiNhatKy_(ma, '', maTho, 'TAO_CONG_VIEC', { ten: ten, khuVuc: khuVuc }, requestId);

    return { ok: true, phieu: gonPhieu_(dong) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 7. RPC — GHI BẢO TRÌ HẰNG NGÀY
// ============================================================================

/**
 * Ghi một việc bảo trì hằng ngày. Thợ làm rải rác trong ca (tra dầu, siết ốc,
 * vệ sinh, chỉnh vặt…), không gây dừng máy, không cần đo giờ — chỉ cần ĐẾM.
 *
 * Vì vậy phiếu được tạo ở trạng thái HOAN_THANH ngay, và cố ý ĐỂ TRỐNG
 * Thoi_Gian_Nhan cùng toàn bộ cột Phut_*:
 *   - tinhDapUng_ đòi cả Thoi_Gian_Nhan lẫn Thoi_Gian_Hoan_Thanh mới tính là bận
 *     → loại này tự động không ảnh hưởng KPI đáp ứng của ai.
 *   - Thoi_Gian_Hoan_Thanh vẫn ghi để archiveOldTickets dọn được về sau.
 *
 * payload = { techId, token, requestId, noiDung, doiTuong, phuTung }
 * phuTung: [{ten, soLuong, dvt}] — tối đa CONFIG.MAX_PHU_TUNG dòng, không bắt buộc.
 * Bảo trì không đo giờ nhưng VẪN tốn vật tư (dầu, ốc, dây đai…), nên vẫn khai được.
 */
function createDailyMaintenance(payload) {
  const p = payload || {};
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const tho = xacThucTho_(p.techId, p.token);
    if (!tho) return { ok: false, error: 'Link không hợp lệ.' };

    const requestId = String(p.requestId || '').trim();
    if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

    const noiDung = String(p.noiDung || '').trim().slice(0, CONFIG.MAX_MO_TA);
    if (!noiDung) return { ok: false, error: 'Vui lòng nhập nội dung bảo trì.' };

    const dsGanDay = docSuCoGanDay_();
    for (let i = dsGanDay.length - 1; i >= 0; i--) {
      if (String(dsGanDay[i].v[COT.Request_ID_Cuoi]).trim() === requestId) {
        return { ok: true, trung: true, phieu: gonPhieu_(dsGanDay[i].v) };
      }
    }

    const luc = nowVN_();
    const maTho = String(tho.Ma_Tho).trim();
    const caTho = xacDinhCa_(tho.Nhom_Ca, luc);
    const ma = sinhMaPhieu_(luc, 'BT');

    const dong = new Array(HEADER_SU_CO.length).fill('');
    dong[COT.Ma_Su_Co] = ma;
    dong[COT.Ten_May] = '';                                        // không gắn máy cụ thể
    dong[COT.Mo_Ta] = noiDung;                                     // nội dung bảo trì
    dong[COT.Bo_Phan] = String(p.doiTuong || '').trim().slice(0, 100); // máy / khu vực
    dong[COT.Trang_Thai] = TRANG_THAI.HOAN_THANH;
    dong[COT.Thoi_Gian_Bao] = luc;
    dong[COT.Thoi_Gian_Hoan_Thanh] = luc;   // để archive dọn được; KHÔNG có Thoi_Gian_Nhan
    dong[COT.Ma_Tho] = maTho;
    dong[COT.Ten_Tho] = String(tho.Ten_Tho).trim();
    dong[COT.Noi_Dung_Xu_Ly] = noiDung;
    dong[COT.Phu_Tung_Tom_Tat] = gopPhuTung_(p.phuTung);
    dong[COT.Ngay_Ca] = caTho.ngayCa;
    dong[COT.Ca] = caTho.ca || 'NGOAI_GIO';
    dong[COT.Cap_Nhat_Luc] = luc;
    dong[COT.Request_ID_Cuoi] = requestId;
    dong[COT.Phien_Ban] = 1;
    dong[COT.Loai_Phieu] = LOAI_PHIEU.BAO_TRI;

    const sh = sheet_(SHEET.SU_CO);
    sh.getRange(sh.getLastRow() + 1, 1, 1, HEADER_SU_CO.length).setValues([dong]);

    ghiNhatKy_(ma, '', maTho, 'GHI_BAO_TRI', {
      noiDung: noiDung,
      doiTuong: dong[COT.Bo_Phan],
      phuTung: dong[COT.Phu_Tung_Tom_Tat],
    }, requestId);

    // Trả luôn mục vừa ghi để client chèn thẳng vào danh sách, khỏi phải gọi
    // lại server sau mỗi lần ghi — thợ nhập liên tục nhiều hạng mục trong ca.
    return { ok: true, muc: mucBaoTri_(dong) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

/** Đếm số việc bảo trì thợ đã ghi trong ngày ca đang xét. */
function demBaoTriTrongCa_(ds, maTho, ngayCa) {
  return dsBaoTriTrongCa_(ds, maTho, ngayCa).length;
}

/**
 * Danh sách việc bảo trì thợ đã ghi trong ca, mới nhất lên đầu.
 * Dùng để thợ xem lại và xoá nếu gõ nhầm — phiếu BT- không vào mục "Đã xong gần
 * đây" (mỗi ca vài chục dòng sẽ đè mất phiếu sự cố), nên phải có chỗ xem riêng.
 */
function dsBaoTriTrongCa_(ds, maTho, ngayCa) {
  const ma = String(maTho).trim();
  const kq = [];
  ds.forEach(function (r) {
    const v = r.v;
    if (!laBaoTri_(v)) return;
    if (String(v[COT.Ma_Tho]).trim() !== ma) return;
    if (String(v[COT.Ngay_Ca]).trim() !== ngayCa) return;
    kq.push(mucBaoTri_(v));
  });
  return kq.reverse();
}

/**
 * Bản đầy đủ của một phiếu, cho màn hình xem chi tiết bên trang thợ.
 * Chỉ dùng cho danh sách lịch sử (tối đa 10 phiếu) — nhét thêm ngần này trường
 * vào mọi phiếu trong hàng chờ thì payload phình ra vô ích.
 */
function chiTietPhieu_(v) {
  const p = gonPhieu_(v);
  p.noiDungXuLy = v[COT.Noi_Dung_Xu_Ly];
  p.phuTung = v[COT.Phu_Tung_Tom_Tat];
  p.ghiChu = v[COT.Ghi_Chu];
  p.phutChoThoBan = v[COT.Phut_Cho_Tho_Ban];
  p.phutDapUngThuc = v[COT.Phut_Dap_Ung_Thuc];
  p.soChongViec = v[COT.So_Chong_Viec];
  p.ngayCa = v[COT.Ngay_Ca];
  return p;
}

/** Rút gọn một phiếu bảo trì cho danh sách trên app. */
function mucBaoTri_(v) {
  return {
    maSuCo: v[COT.Ma_Su_Co],
    // Ưu tiên Mo_Ta; lùi về Ten_May cho những phiếu ghi trước khi đổi cách lưu.
    noiDung: v[COT.Mo_Ta] || v[COT.Ten_May],
    doiTuong: v[COT.Bo_Phan],     // máy / khu vực
    phuTung: v[COT.Phu_Tung_Tom_Tat],
    gio: v[COT.Thoi_Gian_Bao] instanceof Date
      ? Utilities.formatDate(v[COT.Thoi_Gian_Bao], CONFIG.MUI_GIO, 'HH:mm') : '',
  };
}

/**
 * Sửa lại nội dung một phiếu ĐÃ ĐÓNG — cho trường hợp bấm nhầm nút Hoàn thành
 * khi chưa kịp khai phụ tùng, hoặc gõ sót nội dung.
 *
 * CHỈ sửa được 3 trường chữ: nội dung xử lý, phụ tùng, ghi chú.
 * TUYỆT ĐỐI không đụng tới các mốc thời gian, các cột phút, hay trạng thái —
 * sửa được những thứ đó là mở đường viết lại lịch sử và làm hỏng mọi chỉ số.
 *
 * Giới hạn: phiếu của chính thợ đó, và trong vòng CONFIG.GIO_CHO_SUA_PHIEU giờ
 * kể từ lúc đóng. Quá hạn thì quản trị sửa thẳng trên Sheet.
 *
 * payload = { incidentId, techId, token, requestId, noiDungXuLy, phuTung, ghiChu }
 */
function updateCompletedIncident(payload) {
  const p = payload || {};
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const tho = xacThucTho_(p.techId, p.token);
    if (!tho) return { ok: false, error: 'Link không hợp lệ.' };

    const noiDung = String(p.noiDungXuLy || '').trim().slice(0, CONFIG.MAX_NOI_DUNG);
    if (!noiDung) return { ok: false, error: 'Nội dung đã xử lý không được để trống.' };

    const r = timDongSuCo_(p.incidentId);
    if (!r) return { ok: false, error: 'Không tìm thấy phiếu ' + p.incidentId + '.' };
    const v = r.v;

    const requestId = String(p.requestId || '').trim();
    if (requestId && String(v[COT.Request_ID_Cuoi]).trim() === requestId) {
      return { ok: true, trung: true, phieu: chiTietPhieu_(v) };
    }

    if (v[COT.Trang_Thai] !== TRANG_THAI.HOAN_THANH) {
      return { ok: false, error: 'Phiếu này chưa đóng — dùng nút Hoàn thành.' };
    }
    if (laBaoTri_(v) || laDungMay_(v)) {
      return { ok: false, error: 'Loại phiếu này không sửa được ở đây.' };
    }
    if (String(v[COT.Ma_Tho]).trim() !== String(tho.Ma_Tho).trim()) {
      return { ok: false, error: 'Đây không phải phiếu của bạn.' };
    }

    const xong = v[COT.Thoi_Gian_Hoan_Thanh];
    if (!(xong instanceof Date)) {
      return { ok: false, error: 'Phiếu thiếu mốc hoàn thành, nhờ quản lý sửa giúp.' };
    }
    const gioDaQua = (Date.now() - xong.getTime()) / 3600000;
    if (gioDaQua > CONFIG.GIO_CHO_SUA_PHIEU) {
      return {
        ok: false,
        error: 'Phiếu đã đóng quá ' + CONFIG.GIO_CHO_SUA_PHIEU +
          ' giờ nên không tự sửa được nữa. Báo quản lý sửa giúp trên bảng tính.',
      };
    }

    const truoc = {
      noiDung: v[COT.Noi_Dung_Xu_Ly],
      phuTung: v[COT.Phu_Tung_Tom_Tat],
      ghiChu: v[COT.Ghi_Chu],
    };

    v[COT.Noi_Dung_Xu_Ly] = noiDung;
    v[COT.Phu_Tung_Tom_Tat] = gopPhuTung_(p.phuTung);
    v[COT.Ghi_Chu] = String(p.ghiChu || '').trim().slice(0, CONFIG.MAX_NOI_DUNG);
    v[COT.Cap_Nhat_Luc] = nowVN_();
    if (requestId) v[COT.Request_ID_Cuoi] = requestId;
    v[COT.Phien_Ban] = (Number(v[COT.Phien_Ban]) || 0) + 1;

    ghiCaDong_(r.dong, v);
    ghiNhatKy_(v[COT.Ma_Su_Co], v[COT.Ma_May], String(tho.Ma_Tho).trim(), 'SUA_PHIEU_DA_XONG',
      { truoc: truoc, sau: {
        noiDung: v[COT.Noi_Dung_Xu_Ly],
        phuTung: v[COT.Phu_Tung_Tom_Tat],
        ghiChu: v[COT.Ghi_Chu],
      } }, requestId);

    return { ok: true, phieu: chiTietPhieu_(v) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xoá một việc bảo trì thợ vừa ghi nhầm.
 *
 * Giới hạn chặt: chỉ xoá được phiếu BAO_TRI, của CHÍNH thợ đó, và trong ĐÚNG ca
 * hiện tại. Không cho đụng vào phiếu sự cố hay việc chung — những loại đó có
 * lịch sử trạng thái và số liệu đáp ứng, xoá đi là mất dấu vết.
 *
 * Xoá hẳn dòng chứ không đánh dấu huỷ, vì loại này chỉ để đếm; và mã phiếu đã
 * chuyển sang lấy số lớn nhất +1 (sinhMaPhieu_) nên xoá không gây trùng mã.
 */
function deleteDailyMaintenance(maSuCo, techId, token, requestId) {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const tho = xacThucTho_(techId, token);
    if (!tho) return { ok: false, error: 'Link không hợp lệ.' };

    const r = timDongSuCo_(maSuCo);
    if (!r) return { ok: false, error: 'Không tìm thấy phiếu ' + maSuCo + '.' };
    const v = r.v;

    if (!laBaoTri_(v)) {
      return { ok: false, error: 'Chỉ xoá được việc bảo trì hằng ngày.' };
    }
    if (String(v[COT.Ma_Tho]).trim() !== String(tho.Ma_Tho).trim()) {
      return { ok: false, error: 'Đây không phải việc bạn ghi.' };
    }

    const caTho = xacDinhCa_(tho.Nhom_Ca, nowVN_());
    if (String(v[COT.Ngay_Ca]).trim() !== caTho.ngayCa) {
      return { ok: false, error: 'Chỉ xoá được việc ghi trong ca hiện tại.' };
    }

    ghiNhatKy_(v[COT.Ma_Su_Co], '', String(tho.Ma_Tho).trim(), 'XOA_BAO_TRI',
      { noiDung: v[COT.Ten_May], doiTuong: v[COT.Bo_Phan] }, requestId);

    sheet_(SHEET.SU_CO).deleteRow(r.dong);
    return { ok: true, maSuCo: v[COT.Ma_Su_Co] };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 8. RPC — HOÀN THÀNH
// ============================================================================

/**
 * Thợ báo sửa xong → phiếu đóng NGAY, không có bước trung gian.
 *
 * payload = {
 *   incidentId, techId, token, requestId,
 *   noiDungXuLy,                       // bắt buộc
 *   phuTung: [{ten, soLuong, dvt}],    // tối đa CONFIG.MAX_PHU_TUNG dòng
 *   ghiChu
 * }
 */
function completeIncident(payload) {
  const p = payload || {};
  const lock = LockService.getScriptLock();

  try {
    if (!lock.tryLock(CONFIG.KHOA_CHO_GIAY * 1000)) {
      return { ok: false, error: 'Hệ thống đang bận, thử lại sau vài giây.' };
    }

    const tho = xacThucTho_(p.techId, p.token);
    if (!tho) return { ok: false, error: 'Link không hợp lệ.' };

    const requestId = String(p.requestId || '').trim();
    if (!requestId) return { ok: false, error: 'Thiếu mã request.' };

    const noiDung = String(p.noiDungXuLy || '').trim().slice(0, CONFIG.MAX_NOI_DUNG);
    if (!noiDung) return { ok: false, error: 'Vui lòng nhập nội dung đã xử lý.' };

    const r = timDongSuCo_(p.incidentId);
    if (!r) return { ok: false, error: 'Không tìm thấy phiếu ' + p.incidentId + '.' };
    const v = r.v;

    if (String(v[COT.Request_ID_Cuoi]).trim() === requestId) {
      return { ok: true, trung: true, phieu: gonPhieu_(v) };
    }
    if (v[COT.Trang_Thai] === TRANG_THAI.HOAN_THANH) {
      return { ok: false, error: 'Phiếu ' + p.incidentId + ' đã được đóng trước đó.' };
    }
    if (String(v[COT.Ma_Tho]).trim() !== String(tho.Ma_Tho).trim()) {
      return { ok: false, error: 'Phiếu này không phải việc của bạn. Hãy bấm "Nhận việc" trước.' };
    }

    const luc = nowVN_();
    v[COT.Trang_Thai] = TRANG_THAI.HOAN_THANH;
    v[COT.Noi_Dung_Xu_Ly] = noiDung;
    v[COT.Phu_Tung_Tom_Tat] = gopPhuTung_(p.phuTung);
    v[COT.Ghi_Chu] = String(p.ghiChu || '').trim().slice(0, CONFIG.MAX_NOI_DUNG);
    v[COT.Thoi_Gian_Hoan_Thanh] = luc;
    v[COT.Phut_Xu_Ly] = soPhut_(v[COT.Thoi_Gian_Nhan], luc);
    v[COT.Cap_Nhat_Luc] = luc;
    v[COT.Request_ID_Cuoi] = requestId;
    v[COT.Phien_Ban] = (Number(v[COT.Phien_Ban]) || 0) + 1;

    ghiCaDong_(r.dong, v);
    ghiNhatKy_(v[COT.Ma_Su_Co], v[COT.Ma_May], String(tho.Ma_Tho).trim(), 'HOAN_THANH',
      { phutXuLy: v[COT.Phut_Xu_Ly], phuTung: v[COT.Phu_Tung_Tom_Tat] }, requestId);

    return { ok: true, phieu: gonPhieu_(v) };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

/** [{ten, soLuong, dvt}] → "Vòng bi 6204 x2 cái; Dây curoa x1 sợi". */
function gopPhuTung_(ds) {
  if (!ds || !ds.length) return '';
  return ds.slice(0, CONFIG.MAX_PHU_TUNG)
    .filter(function (x) { return x && String(x.ten || '').trim(); })
    .map(function (x) {
      const ten = String(x.ten).trim();
      const sl = String(x.soLuong || '').trim();
      const dvt = String(x.dvt || '').trim();
      return ten + (sl ? ' x' + sl : '') + (dvt ? ' ' + dvt : '');
    })
    .join('; ');
}
