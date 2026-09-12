/**
 * HỆ THỐNG BẢO TRÌ TOÀN NHÀ MÁY — v2
 * ============================================================================
 * LỖI ĐÁP ỨNG — ĐẾM SỐ LẦN thợ nhận việc trễ, so với ngưỡng RIÊNG của từng thợ.
 *
 * VÌ SAO CÓ FILE NÀY, khi đã có KPI đáp ứng ở LuongTho.gs
 * -----------------------------------------------------------------------------
 * Chỉ số cũ là "số phút đáp ứng TRUNG BÌNH sau khi trừ lúc bận", chấm theo MỘT
 * ngưỡng chung cho cả tổ. Chủ quản không dùng cách đó, vì trung bình che mất thứ
 * người ta muốn biết: **thợ này trong tháng trễ mấy lần**. Một thợ trễ 15 lần
 * mỗi lần 6 phút có trung bình đẹp hơn một thợ trễ 1 lần mất 90 phút, nhưng
 * người phải đi nhắc là người thứ nhất.
 *
 * Nên phép đo ở đây khác hẳn ba chỗ:
 *   1. ĐẾM SỐ LẦN, không lấy trung bình.
 *   2. Ngưỡng RIÊNG từng thợ, khai trên `Danh_Muc_Tho.Nguong_KPI_Phut`. Đây là
 *      con số CHÍNH SÁCH do chủ quản chỉ định, không phải máy tính ra.
 *   3. Chỉ đếm phiếu tới lúc thợ đang RẢNH. Máy chờ vì thợ đang cầm việc khác
 *      thì đó là chuyện thiếu người, không phải chuyện thợ chậm.
 *
 * Chỉ số cũ KHÔNG bị xoá hay sửa đè: nó đã đi vào các báo cáo đã gửi.
 *
 * RÀNG BUỘC: MỌI HÀM TRONG FILE NÀY LÀ HÀM THUẦN
 * -----------------------------------------------------------------------------
 * Chỉ nhận mảng / chuỗi / số / Date và trả kết quả. KHÔNG gọi `SpreadsheetApp`,
 * `UrlFetchApp`, `Utilities`, `LockService`, `PropertiesService`, `CacheService`.
 *
 * Ràng buộc này không phải sở thích: nhờ nó mà `kiemtra/loi-dap-ung.js` chạy
 * được bằng node ngay tại máy, và lớp kiểm thử đó SOI mã nguồn từng hàm bằng
 * `Function.prototype.toString` — kéo một lời gọi dịch vụ vào đây là đỏ ngay,
 * kèm lời giải thích, thay vì một `ReferenceError` khó đọc.
 *
 * Phần đọc/ghi sheet và dựng file xuất nằm ở `XuatBaoCao.gs`.
 */

// ============================================================================
// 1. NGƯỠNG RIÊNG TỪNG THỢ
// ============================================================================

/**
 * Ngưỡng đáp ứng (phút) áp cho MỘT thợ.
 *
 * Ba nấc, theo đúng cách `nguongKpi_` đang làm với ngưỡng chung:
 *   1. Cột `Nguong_KPI_Phut` của chính thợ đó trong `Danh_Muc_Tho`.
 *   2. Trống → `Cau_Hinh.NGUONG_KPI_DAP_UNG_PHUT` (ngưỡng chung cả tổ).
 *   3. Trống nữa → 0, nghĩa là CÔNG TY CHƯA CHỐT. Báo cáo vẫn ra đủ mọi con số,
 *      nhưng cột chấm đạt/không đạt hiện "—" kèm một dòng nói rõ vì sao. Không
 *      bao giờ hiểu 0 là "ngưỡng 0 phút" — chấm người bằng một ngưỡng không ai
 *      chốt là chấm chay.
 *
 * @param {Object} tho     một dòng `Danh_Muc_Tho` dạng object (docSheet_ trả về)
 * @param {Object} cauHinh map khoá→giá trị của `Cau_Hinh`
 * @return {number} số phút, hoặc 0 khi chưa chốt
 */
function nguongKpiCuaTho_(tho, cauHinh) {
  const rieng = Number(String((tho && tho.Nguong_KPI_Phut) || '').trim());
  if (isFinite(rieng) && rieng > 0) return rieng;
  const chung = Number(String((cauHinh && cauHinh.NGUONG_KPI_DAP_UNG_PHUT) || '').trim());
  return isFinite(chung) && chung > 0 ? chung : 0;
}

// ============================================================================
// 2. BA PHÉP PHÂN LOẠI MỘT PHIẾU
// ============================================================================

/** Ô sheet coi là TRỐNG: chuỗi rỗng, null, undefined. Số 0 KHÔNG phải trống. */
function oTrong_(x) {
  return x === '' || x === null || x === undefined;
}

/**
 * Lúc phiếu này tới, thợ đang RẢNH hay đang BẬN — hay chưa ai tính?
 *
 * Chỉ phiếu tới lúc thợ RẢNH mới bị đếm là một lần lỗi. Điều kiện rảnh:
 *   `So_Chong_Viec` = 0 VÀ `Phut_Cho_Tho_Ban` = 0.
 * Một trong hai khác 0 là BẬN: vượt ngưỡng vẫn KHÔNG tính lỗi, nhưng phải liệt
 * kê riêng để chủ quản tự quyết — thợ bận liên miên là chuyện thiếu người, và
 * chủ quản cần thấy nó, không phải bị che đi.
 *
 * NHÁNH THỨ BA là phần quan trọng nhất của hàm này. Hai ô còn TRỐNG nghĩa là
 * CHƯA TÍNH, và trống KHÔNG được ngầm hiểu là bằng 0 rồi tính thành rảnh: làm
 * vậy thì mọi phiếu chưa chạy menu 🎯 sẽ vào thẳng nhóm rảnh và bị chấm lỗi oan,
 * trong khi báo cáo vẫn trông như thật. Đó đúng là kiểu hỏng IM LẶNG mà dự án
 * này đã trả giá nhiều lần. Nhóm CHUA_TINH bị loại khỏi phép đếm và phải hiện
 * thành một con số RIÊNG trên báo cáo.
 *
 * Chỉ một trong hai ô trống cũng trả CHUA_TINH: không biết đủ hai con số thì
 * không kết luận được thợ rảnh, và nghiêng về phía "không đếm" là nghiêng về
 * phía an toàn.
 *
 * @return {string} 'RANH' | 'BAN' | 'CHUA_TINH'
 */
function thoRanhLucPhieuToi_(v) {
  const chong = v[COT.So_Chong_Viec];
  const choBan = v[COT.Phut_Cho_Tho_Ban];
  if (oTrong_(chong) || oTrong_(choBan)) return 'CHUA_TINH';

  const sChong = Number(chong);
  const sCho = Number(choBan);
  if (!isFinite(sChong) || !isFinite(sCho)) return 'CHUA_TINH';

  return (sChong === 0 && sCho === 0) ? 'RANH' : 'BAN';
}

/**
 * Số phút đem SO với ngưỡng của thợ.
 *
 * Ưu tiên `Phut_Dap_Ung_Thuc` — đó là cột đã trừ thời gian thợ bận, tức là phần
 * thật sự thuộc về thợ. Trống thì lấy `Phut_KPI_Tho` (bản cộng dồn đoạn bận, ra
 * cùng số trên nhóm thợ rảnh). Cả hai trống thì trả rỗng và phiếu đó vào nhóm
 * THIẾU SỐ, không bị đếm và cũng không bị bỏ qua im lặng.
 *
 * Cố ý KHÔNG rơi về `Phut_Tiep_Nhan`: cột đó chưa trừ lúc thợ bận, dùng nó là
 * chấm thợ cả phần thời gian không phải của họ.
 *
 * @return {number|string} số phút, hoặc '' khi thiếu số
 */
function soPhutDapUngDeCham_(v) {
  const thuc = v[COT.Phut_Dap_Ung_Thuc];
  if (!oTrong_(thuc)) {
    const n = Number(thuc);
    if (isFinite(n)) return n;
  }
  const kpi = v[COT.Phut_KPI_Tho];
  if (!oTrong_(kpi)) {
    const n = Number(kpi);
    if (isFinite(n)) return n;
  }
  return '';
}

// ============================================================================
// 3. ĐỔI VỊ TRÍ ĐÁP ỨNG ↔ SỬA
// ============================================================================

/**
 * Sửa lại những phiếu bị ghi NGƯỢC thời gian đáp ứng và thời gian sửa.
 *
 * Chuyện thật đằng sau: thợ quên bấm nhận việc. Đến máy, sửa xong, rồi mới mở
 * điện thoại bấm "nhận" và bấm "hoàn thành" liền nhau. Hệ thống chỉ thấy hai
 * mốc giờ nên ghi cả khoảng thợ đang sửa thành "máy nằm chờ", và ghi khoảng vài
 * chục giây bấm hai nút thành "thời gian sửa". Hai con số bị đổi chỗ.
 *
 * Quy tắc nhận diện: phút sửa ≤ `DOI_VI_TRI_XU_LY_TOI_DA` (2) VÀ phút đáp ứng >
 * `DOI_VI_TRI_DAP_UNG_TOI_THIEU` (5). Sửa xong một cái máy trong 2 phút là
 * chuyện không có thật; còn phiếu sửa 3–5 phút thì quy tắc CỐ Ý không bắt, vì
 * không đủ chắc — những phiếu đó chủ quản khai tay ở sheet `KPI_Doi_Vi_Tri`.
 *
 * Tháng 8/2026: quy tắc bắt 22 phiếu, khai tay thêm 4, tổng 26. Không đổi thì
 * số lần lỗi ra 68 thay vì 44 — tức phép đổi này nặng ký, và chính vì nặng ký mà
 * báo cáo BẮT BUỘC in cả hai con số để chủ quản thấy nó ảnh hưởng tới mức nào.
 *
 * ⚠️ KHÔNG bao giờ ghi số đã đổi ngược lại `Su_Co` hay `Luu_Tru`. Phép đổi chỉ
 * diễn ra trong bộ nhớ lúc lập báo cáo. Dữ liệu gốc là bằng chứng: đổi đè lên nó
 * là mất khả năng chứng minh con số báo cáo đến từ đâu, và mất luôn đường lùi
 * nếu sau này quy tắc được chỉnh. Hàm này KHÔNG sửa mảng đầu vào tại chỗ — trả
 * về bản sao.
 *
 * @param {Array<Array>} ds          các dòng Su_Co
 * @param {Object} cauHinh           map khoá→giá trị Cau_Hinh
 * @param {Array<Object>} dsXacNhanTay  các dòng KPI_Doi_Vi_Tri dạng object
 * @return {{ds: Array<Array>, dsDoi: Array<Object>, bat: boolean}}
 */
function apDungDoiViTri_(ds, cauHinh, dsXacNhanTay) {
  const ch = cauHinh || {};
  const bat = String(ch.DOI_VI_TRI_BAT || 'BAT').trim().toUpperCase() === 'BAT';
  const xuLyToiDa = soCauHinh_(ch.DOI_VI_TRI_XU_LY_TOI_DA, 2);
  const dapUngToiThieu = soCauHinh_(ch.DOI_VI_TRI_DAP_UNG_TOI_THIEU, 5);

  // Khai tay: mã phiếu → lý do + người xác nhận.
  const tay = {};
  (dsXacNhanTay || []).forEach(function (r) {
    const ma = String((r && r.Ma_Su_Co) || '').trim();
    if (!ma) return;
    tay[ma] = {
      lyDo: String((r && r.Ly_Do) || '').trim(),
      nguoi: String((r && r.Nguoi_Xac_Nhan) || '').trim(),
    };
  });

  const dsDoi = [];
  const raDs = (ds || []).map(function (v) {
    if (!bat) return v;

    const ma = String(v[COT.Ma_Su_Co] || '').trim();
    const dapUngGoc = soPhutDapUngDeCham_(v);
    const suaGoc = oTrong_(v[COT.Phut_Xu_Ly]) ? '' : Number(v[COT.Phut_Xu_Ly]);

    // Thiếu một trong hai số thì không có gì để hoán đổi.
    if (dapUngGoc === '' || suaGoc === '' || !isFinite(suaGoc)) return v;

    const khaiTay = tay[ma];
    const theoQuyTac = suaGoc <= xuLyToiDa && dapUngGoc > dapUngToiThieu;
    if (!khaiTay && !theoQuyTac) return v;

    // Bản SAO. `slice()` là chỗ đảm bảo mảng đầu vào không bị sửa tại chỗ.
    const moi = v.slice();
    moi[COT.Phut_Xu_Ly] = dapUngGoc;
    // Đổi cả ba cột phút đáp ứng, không riêng cột đem đi chấm: trên nhóm thợ
    // rảnh ba cột này bằng nhau, nên đổi một cột là tự tay tạo ra lệch đẳng
    // thức mà phép thử canh đẳng thức sẽ báo đỏ — đúng ra là nó phải báo đỏ.
    // Chỉ đổi ô nào vốn CÓ số: ô trống giữ nguyên trống.
    [COT.Phut_Tiep_Nhan, COT.Phut_Dap_Ung_Thuc, COT.Phut_KPI_Tho].forEach(function (c) {
      if (!oTrong_(v[c])) moi[c] = suaGoc;
    });

    dsDoi.push({
      maSuCo: ma,
      tenTho: String(v[COT.Ten_Tho] || '').trim(),
      tenMay: String(v[COT.Ten_May] || '').trim(),
      ngay: ngayCuaPhieu_(v),
      dapUngGoc: dapUngGoc,
      suaGoc: suaGoc,
      dapUngMoi: suaGoc,
      suaMoi: dapUngGoc,
      // Quy tắc tự động thắng khi cả hai cùng đúng — nói rõ máy bắt được, để
      // chủ quản biết dòng khai tay đó không còn cần thiết nữa.
      nguon: theoQuyTac ? 'QUY_TAC' : 'KHAI_TAY',
      lyDo: theoQuyTac
        ? 'sửa ' + suaGoc + '′ ≤ ' + xuLyToiDa + '′ mà đáp ứng ' + dapUngGoc +
          '′ > ' + dapUngToiThieu + '′'
        : (khaiTay.lyDo || 'chủ quản xác nhận'),
      nguoiXacNhan: khaiTay ? khaiTay.nguoi : '',
    });
    return moi;
  });

  return { ds: raDs, dsDoi: dsDoi, bat: bat };
}

// ============================================================================
// 4. PHÉP ĐẾM LẦN LỖI
// ============================================================================

/** Các mức ngưỡng chung đem ra so, cho khối "nếu áp một ngưỡng chung". */
const NGUONG_CHUNG_DEM_THU = [3, 5, 10, 15, 20, 30];

/**
 * Đếm số lần đáp ứng trễ, trong MỘT lượt duyệt, trả về đủ thứ báo cáo cần.
 *
 * Một lượt duyệt chứ không phải bảy: bảy trang báo cáo đều nhìn cùng một tập
 * phiếu, gom bảy lần là bảy cơ hội để hai trang nói hai con số khác nhau cho
 * cùng một thứ.
 *
 * ĐỊNH NGHĨA MỘT LẦN LỖI — cả ba điều kiện phải đúng:
 *   1. Phiếu đo được đáp ứng: đúng tập `laDoDapUng_()` trả true, hiện là SC- và
 *      HT-. Giữ đúng MỘT cửa đó, không mở cửa thứ hai — chủ dự án đã chốt ngày
 *      11/09/2026 rằng HT- tính chung một con số với sự cố.
 *   2. Tới lúc thợ đang RẢNH (`thoRanhLucPhieuToi_` trả 'RANH').
 *   3. Số phút đáp ứng LỚN HƠN ngưỡng của chính thợ đó. ĐÚNG BẰNG ngưỡng thì
 *      KHÔNG tính — ngưỡng là mức được phép, không phải mức bị phạt.
 *
 * @param {Array<Array>} ds  toàn bộ phiếu trong kỳ, KỂ CẢ CV-/BT-/DM-
 *                           (Theo_Tho có cột việc chung và bảo trì)
 * @param {Object} nguongTheoTho  tên thợ → số phút; thiếu tên → dùng tuyChon.nguongChung
 * @param {Object} tuyChon   { nguongChung: number }
 */
function demLoiDapUng_(ds, nguongTheoTho, tuyChon) {
  const nguongTho = nguongTheoTho || {};
  const o = tuyChon || {};
  const nguongChung = Number(o.nguongChung) > 0 ? Number(o.nguongChung) : 0;

  const tong = {
    soPhieuTrongKy: 0, soPhieuSuCo: 0,
    soRanh: 0, soBan: 0, soChuaTinh: 0, soThieuSo: 0, soChuaChotNguong: 0,
    soLanLoi: 0, soVuotKhiBan: 0, soVuotTong: 0,
  };
  const theoTho = {};
  const theoNgay = {};
  const theoBoPhan = {};
  const dsPhieuLoi = [];
  const dsBiLoai = [];
  const lechDangThuc = [];
  const dsNguon = [];
  // Mỗi mức ngưỡng chung một ô đếm, cho bảng "nếu áp một ngưỡng chung".
  const demTheoMuc = {};
  NGUONG_CHUNG_DEM_THU.forEach(function (n) { demTheoMuc[n] = { loi: 0, vuot: 0 }; });

  function oTho_(ten) {
    if (!theoTho[ten]) {
      theoTho[ten] = {
        ten: ten,
        nguong: nguongTho[ten] !== undefined ? nguongTho[ten] : nguongChung,
        soPhieuSuCo: 0, soRanh: 0, soBan: 0, soChuaTinh: 0,
        soLanLoi: 0, soVuotKhiBan: 0, soVuotTong: 0,
        chamNhat: '', dsDapUng: [], dsChoBan: [], dsXuLy: [],
        soChongViec: 0, soViecChung: 0, soBaoTri: 0,
      };
    }
    return theoTho[ten];
  }

  (ds || []).forEach(function (v) {
    if (String(v[COT.Ma_Su_Co] || '').trim() === '') return;
    tong.soPhieuTrongKy++;

    const ma = String(v[COT.Ma_Su_Co]).trim();
    const ten = String(v[COT.Ten_Tho] || '').trim() || '(chưa có thợ)';
    const ngay = ngayCuaPhieu_(v);
    const boPhan = String(v[COT.Bo_Phan] || '').trim() || '(không rõ)';

    // Việc chung và bảo trì: không vào phép đếm, nhưng vẫn là việc thợ đã làm
    // nên phải hiện trên bảng theo thợ — nếu không thì thợ nào bận việc chung cả
    // tháng trông như ngồi không.
    if (laCongViec_(v)) { oTho_(ten).soViecChung++; return; }
    if (laBaoTri_(v)) { oTho_(ten).soBaoTri++; return; }
    if (!laDoDapUng_(v)) { return; }   // DM- không có thợ, không đo gì

    tong.soPhieuSuCo++;
    const t = oTho_(ten);
    t.soPhieuSuCo++;

    if (!theoNgay[ngay]) theoNgay[ngay] = { ngay: ngay, soPhieu: 0, soRanh: 0, soLanLoi: 0 };
    if (!theoBoPhan[boPhan]) {
      theoBoPhan[boPhan] = { boPhan: boPhan, soPhieu: 0, soRanh: 0, soLanLoi: 0 };
    }
    theoNgay[ngay].soPhieu++;
    theoBoPhan[boPhan].soPhieu++;

    const trangThai = thoRanhLucPhieuToi_(v);
    const soPhut = soPhutDapUngDeCham_(v);
    const nguong = t.nguong;

    // Số liệu trung bình gom cho mọi phiếu đo được, kể cả phiếu bận: đó là số
    // mô tả hiện trạng, khác với phép ĐẾM LỖI vốn chỉ xét nhóm rảnh.
    if (soPhut !== '') t.dsDapUng.push(soPhut);
    if (!oTrong_(v[COT.Phut_Cho_Tho_Ban])) t.dsChoBan.push(Number(v[COT.Phut_Cho_Tho_Ban]));
    if (!oTrong_(v[COT.Phut_Xu_Ly])) t.dsXuLy.push(Number(v[COT.Phut_Xu_Ly]));
    if (Number(v[COT.So_Chong_Viec] || 0) > 0) t.soChongViec++;

    const nguonDong = {
      maSuCo: ma, ngay: ngay, tenTho: ten, boPhan: boPhan,
      tenMay: String(v[COT.Ten_May] || '').trim(),
      maMay: String(v[COT.Ma_May] || '').trim(),
      loai: loaiPhieu_(v),
      nguong: nguong,
      trangThai: trangThai,
      soPhut: soPhut,
      phutTiepNhan: v[COT.Phut_Tiep_Nhan],
      phutChoThoBan: v[COT.Phut_Cho_Tho_Ban],
      phutXuLy: v[COT.Phut_Xu_Ly],
      soChongViec: v[COT.So_Chong_Viec],
      tinhLoi: false, vuot: '',
    };
    dsNguon.push(nguonDong);

    // --- Ba nhóm bị loại khỏi phép đếm, mỗi nhóm một con số riêng -----------
    if (trangThai === 'CHUA_TINH') {
      tong.soChuaTinh++;
      t.soChuaTinh++;
      dsBiLoai.push({ maSuCo: ma, tenTho: ten,
        lyDo: 'CHƯA TÍNH KPI — hai ô So_Chong_Viec / Phut_Cho_Tho_Ban còn trống' });
      return;
    }
    if (soPhut === '') {
      tong.soThieuSo++;
      dsBiLoai.push({ maSuCo: ma, tenTho: ten,
        lyDo: 'THIẾU SỐ — cả Phut_Dap_Ung_Thuc lẫn Phut_KPI_Tho đều trống' });
      return;
    }

    if (trangThai === 'RANH') {
      tong.soRanh++; t.soRanh++;
      theoNgay[ngay].soRanh++; theoBoPhan[boPhan].soRanh++;
      // Trên nhóm thợ RẢNH, ba con số này phải BẰNG NHAU: không bận thì không có
      // gì để trừ. Lệch nhau là dấu hiệu dữ liệu hỏng — báo ra, không được im.
      const tn = v[COT.Phut_Tiep_Nhan], kpi = v[COT.Phut_KPI_Tho];
      if (!oTrong_(tn) && Number(tn) !== soPhut) {
        lechDangThuc.push({ maSuCo: ma, phutTiepNhan: Number(tn), soPhut: soPhut,
          lyDo: 'thợ rảnh mà Phut_Tiep_Nhan ≠ số phút đem chấm' });
      } else if (!oTrong_(kpi) && !oTrong_(v[COT.Phut_Dap_Ung_Thuc]) &&
                 Number(kpi) !== Number(v[COT.Phut_Dap_Ung_Thuc])) {
        lechDangThuc.push({ maSuCo: ma, phutKpiTho: Number(kpi),
          phutDapUngThuc: Number(v[COT.Phut_Dap_Ung_Thuc]),
          lyDo: 'thợ rảnh mà Phut_KPI_Tho ≠ Phut_Dap_Ung_Thuc' });
      }
    } else {
      tong.soBan++; t.soBan++;
    }

    // --- Bảng "nếu áp một ngưỡng chung" -----------------------------------
    // Tính cho MỌI phiếu đo được, độc lập với ngưỡng riêng — đó chính là câu hỏi
    // khối này trả lời: bỏ ngưỡng riêng đi thì con số ra bao nhiêu.
    NGUONG_CHUNG_DEM_THU.forEach(function (n) {
      if (soPhut <= n) return;
      demTheoMuc[n].vuot++;
      if (trangThai === 'RANH') demTheoMuc[n].loi++;
    });

    // --- Chấm theo ngưỡng riêng của thợ -----------------------------------
    // Ngưỡng 0 = chưa ai chốt. Không chấm, và đếm riêng — chấm bằng một ngưỡng
    // không tồn tại thì mọi phiếu > 0 phút đều thành lỗi.
    if (!nguong) {
      tong.soChuaChotNguong++;
      dsBiLoai.push({ maSuCo: ma, tenTho: ten,
        lyDo: 'CHƯA CHỐT NGƯỠNG cho thợ này — điền Danh_Muc_Tho.Nguong_KPI_Phut' });
      return;
    }

    if (soPhut <= nguong) return;        // đúng bằng ngưỡng cũng là ĐẠT

    const vuot = soPhut - nguong;
    nguonDong.vuot = vuot;
    tong.soVuotTong++;
    t.soVuotTong++;
    if (t.chamNhat === '' || soPhut > t.chamNhat) t.chamNhat = soPhut;

    if (trangThai === 'RANH') {
      tong.soLanLoi++; t.soLanLoi++;
      theoNgay[ngay].soLanLoi++; theoBoPhan[boPhan].soLanLoi++;
      nguonDong.tinhLoi = true;
    } else {
      tong.soVuotKhiBan++; t.soVuotKhiBan++;
    }

    dsPhieuLoi.push({
      maSuCo: ma, ngay: ngay, tenTho: ten, boPhan: boPhan,
      tenMay: nguonDong.tenMay, maMay: nguonDong.maMay, loai: nguonDong.loai,
      nguong: nguong, soPhut: soPhut, vuot: vuot,
      trangThai: trangThai, tinhLoi: trangThai === 'RANH',
      phutChoThoBan: v[COT.Phut_Cho_Tho_Ban], soChongViec: v[COT.So_Chong_Viec],
      phutXuLy: v[COT.Phut_Xu_Ly],
    });
  });

  // --- Bảng theo thợ: nhiều lỗi nhất lên trước ------------------------------
  const bangTho = Object.keys(theoTho).map(function (ten) {
    const t = theoTho[ten];
    return {
      ten: t.ten, nguong: t.nguong,
      soPhieuSuCo: t.soPhieuSuCo, soRanh: t.soRanh, soBan: t.soBan,
      soChuaTinh: t.soChuaTinh,
      soLanLoi: t.soLanLoi,
      tyLeLoi: t.soRanh ? Math.round((t.soLanLoi / t.soRanh) * 100) : '',
      soVuotKhiBan: t.soVuotKhiBan, soVuotTong: t.soVuotTong,
      chamNhat: t.chamNhat,
      dapUngTb: trungBinh_(t.dsDapUng),
      choBanTb: trungBinh_(t.dsChoBan),
      xuLyTb: trungBinh_(t.dsXuLy),
      soChongViec: t.soChongViec,
      soViecChung: t.soViecChung, soBaoTri: t.soBaoTri,
    };
  }).sort(function (a, b) {
    if (b.soLanLoi !== a.soLanLoi) return b.soLanLoi - a.soLanLoi;
    return String(a.ten).localeCompare(String(b.ten));
  });

  return {
    tong: tong,
    theoTho: bangTho,
    theoNgay: Object.keys(theoNgay).sort().map(function (k) { return theoNgay[k]; }),
    theoBoPhan: Object.keys(theoBoPhan).sort().map(function (k) { return theoBoPhan[k]; }),
    // Nhóm RẢNH trước rồi nhóm BẬN, trong mỗi nhóm xếp số phút vượt giảm dần.
    dsPhieuLoi: dsPhieuLoi.sort(function (a, b) {
      if (a.tinhLoi !== b.tinhLoi) return a.tinhLoi ? -1 : 1;
      return b.vuot - a.vuot;
    }),
    dsBiLoai: dsBiLoai,
    lechDangThuc: lechDangThuc,
    dsNguon: dsNguon,
    bangNguongChung: NGUONG_CHUNG_DEM_THU.map(function (n) {
      return { nguong: n, soLanLoi: demTheoMuc[n].loi, soVuot: demTheoMuc[n].vuot };
    }),
  };
}
