/**
 * SAPHIA - APP NHẬP NHANH BÁO CÁO SỬA CHỮA HƯ HỎNG ĐỘT XUẤT (BM01/QTSCBT-05)
 * ------------------------------------------------------------------------
 * File này dán vào Apps Script (Extensions > Apps Script) của Google Sheet
 * "SAPHIA_BaoCao_SuaChua_MauDuLieu" (hoặc bản sao của bạn trên Google Drive).
 *
 * Script này BẮT BUỘC phải là container-bound script (tạo từ trong chính
 * Google Sheet đó qua menu Extensions > Apps Script) để SpreadsheetApp
 * .getActiveSpreadsheet() trỏ đúng file.
 */

const SHEET_BAOCAO = 'BaoCao';
const SHEET_BAOCAO_VATTU = 'BaoCao_VatTu';
const SHEET_DM_MAY = 'DM_May';
const SHEET_DM_VITRI = 'DM_ViTriMay';
const SHEET_DM_VATTU = 'DM_VatTu';
const SHEET_DM_NHANSU = 'DM_NhanSu';
const SHEET_DM_CONGVIEC = 'DM_LoaiCongViec';
const SHEET_BAOCAO_SEP = 'BaoCaoSep';

// Mốc chuyển ca đêm: giờ HH:MM nhỏ hơn mốc này (của "ngày" ghi trên phiếu) được hiểu là
// đã sang ngày hôm sau (ca đêm vắt qua nửa đêm). Dùng trong toActualDateTime_.
const MOC_CHUYEN_CA_DEM = '07:00';

function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Báo cáo sửa chữa đột xuất - SAPHIA')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Cho phép index.html include các file phụ nếu sau này tách CSS/JS riêng. */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheetToObjects_(sheetName, cols) {
  const sheet = ss_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Không tìm thấy sheet: ' + sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, cols.length).getValues();
  return values
    .filter(row => row[0] !== '' && row[0] !== null)
    .map(row => {
      const obj = {};
      cols.forEach((c, i) => (obj[c] = row[i]));
      return obj;
    });
}

/**
 * Trả toàn bộ danh mục cần thiết cho client trong 1 lần gọi (giảm round-trip).
 */
function getDanhMuc() {
  const machines = sheetToObjects_(SHEET_DM_MAY, ['ma', 'ten', 'boPhan']);
  const vitri = sheetToObjects_(SHEET_DM_VITRI, ['ten']).map(o => o.ten);
  const parts = sheetToObjects_(SHEET_DM_VATTU, ['ma', 'ten', 'dvt', 'nhom', 'ton']);
  const staff = sheetToObjects_(SHEET_DM_NHANSU, ['ten']).map(o => o.ten);
  const congviec = sheetToObjects_(SHEET_DM_CONGVIEC, ['ten']).map(o => o.ten);
  return { machines, vitri, parts, staff, congviec };
}

function pad_(n) {
  return String(n).length < 2 ? '0' + n : String(n);
}

function genId_() {
  const now = new Date();
  const stamp = Utilities.formatDate(now, 'Asia/Ho_Chi_Minh', 'yyyyMMddHHmmss');
  const rand = Math.floor(Math.random() * 900 + 100); // 3 số ngẫu nhiên chống trùng
  return 'BC' + stamp + rand;
}

function minutesBetween_(dateStr, startHHMM, endHHMM) {
  if (!startHHMM || !endHHMM) return '';
  const [sh, sm] = startHHMM.split(':').map(Number);
  const [eh, em] = endHHMM.split(':').map(Number);
  let start = sh * 60 + sm;
  let end = eh * 60 + em;
  if (end < start) end += 24 * 60; // qua ngày hôm sau
  return end - start;
}

/** Luôn ép giờ Việt Nam (+07:00) khi tạo Date, không phụ thuộc múi giờ dự án Apps Script. */
function timeToDate_(dateStr, hhmm) {
  if (!hhmm) return '';
  return new Date(dateStr + 'T' + hhmm + ':00+07:00');
}

/**
 * Quy đổi (ngày ghi trên phiếu + giờ HH:MM + ca) thành thời điểm THỰC TẾ (Date), có cộng thêm
 * 1 ngày nếu là ca đêm và giờ rơi trước mốc MOC_CHUYEN_CA_DEM (nghĩa là đã vắt qua ngày hôm sau).
 * Dịch từ công thức gốc trong BC_HH_T7_2026.xlsx (sheet CALC_DAP_UNG).
 */
function toActualDateTime_(ngayStr, hhmm, ca) {
  if (!ngayStr || !hhmm) return null;
  let dt = new Date(ngayStr + 'T' + hhmm + ':00+07:00');
  if (ca === 'Đêm' && hhmm < MOC_CHUYEN_CA_DEM) {
    dt = new Date(dt.getTime() + 24 * 60 * 60 * 1000);
  }
  return dt;
}

/**
 * Như toActualDateTime_ nhưng dành cho mốc "kết thúc sửa": nếu sau khi quy đổi ca đêm mà vẫn ra
 * TRƯỚC mốc bắt đầu sửa thực tế (việc sửa vắt qua nửa đêm dù không phải ca đêm, hoặc lố qua hôm
 * sau), cộng thêm 1 ngày nữa.
 */
function toActualEndDateTime_(ngayStr, hhmmEnd, ca, batDauSuaActual) {
  let end = toActualDateTime_(ngayStr, hhmmEnd, ca);
  if (end && batDauSuaActual && end < batDauSuaActual) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  return end;
}

/**
 * So khung giờ sửa chữa thực tế của phiếu ĐANG SUBMIT với các phiếu ĐÃ CÓ (existingRows, cùng
 * tháng, không gồm phiếu đang submit) của CÙNG kỹ thuật viên.
 * existingRows: [{ tenKyThuat, batDauSuaActual, ketThucActual }, ...]
 * current: { tenKyThuat, batDauHuActual, batDauSuaActual, ketThucActual }
 * Trả về:
 *  - busyUntil: thời điểm thợ rảnh việc cũ (nếu đang bận việc khác lúc máy này báo hư), else null.
 *  - overlapCount: số phiếu cũ có khung giờ sửa chữa thực tế chồng lên khung giờ của phiếu hiện tại.
 */
function findOverlapAndBusyUntil_(existingRows, current) {
  let busyUntil = null;
  let overlapCount = 0;

  existingRows.forEach(row => {
    if (row.tenKyThuat !== current.tenKyThuat) return;
    if (!row.batDauSuaActual || !row.ketThucActual) return;

    if (current.batDauHuActual &&
        row.batDauSuaActual < current.batDauHuActual && row.ketThucActual > current.batDauHuActual) {
      if (!busyUntil || row.ketThucActual > busyUntil) busyUntil = row.ketThucActual;
    }
    if (current.batDauSuaActual && current.ketThucActual &&
        row.batDauSuaActual < current.ketThucActual && row.ketThucActual > current.batDauSuaActual) {
      overlapCount++;
    }
  });

  return { busyUntil, overlapCount };
}

/**
 * Tính 3 chỉ số phút (tổng đáp ứng / chờ thợ bận / đáp ứng sau khi rảnh) + trạng thái.
 * current: { tenKyThuat, batDauHuActual, batDauSuaActual, ketThucActual }
 */
function calcDapUngMetrics_(current, busyUntil, overlapCount) {
  const { tenKyThuat, batDauHuActual, batDauSuaActual, ketThucActual } = current;

  if (!tenKyThuat) return { trangThai: 'CHƯA NHẬP NGƯỜI XỬ LÝ' };
  if (tenKyThuat === 'Không cần thợ cơ khí') return { trangThai: 'KHÔNG YÊU CẦU THỢ CƠ KHÍ' };
  if (!batDauHuActual || !batDauSuaActual || !ketThucActual) return { trangThai: 'THIẾU THỜI GIAN' };

  const moc = busyUntil || batDauHuActual;
  const tong          = Math.max(0, batDauSuaActual - batDauHuActual) / 60000;
  const cho           = Math.max(0, Math.min(batDauSuaActual, moc) - batDauHuActual) / 60000;
  const dapUngSauRanh = Math.max(0, batDauSuaActual - Math.max(batDauHuActual, moc)) / 60000;

  let trangThai;
  if (overlapCount > 0) trangThai = 'CHỒNG VIỆC / KIỂM TRA DỮ LIỆU';
  else if (busyUntil)   trangThai = 'CHỜ THỢ RẢNH';
  else                  trangThai = 'THỢ RẢNH';

  return { tong, cho, dapUngSauRanh, overlapCount, trangThai };
}

/**
 * Đọc các phiếu ĐÃ CÓ trong sheet BaoCao thuộc cùng "thang" (MM/YYYY), quy đổi lại
 * batDauSuaActual/ketThucActual của từng phiếu bằng đúng công thức actual-time (toActualDateTime_/
 * toActualEndDateTime_) để so khung giờ nhất quán với phiếu đang submit.
 * Phiếu cũ chưa có cột Ca (trước khi nâng cấp) sẽ có ca='' -> không cộng thêm ngày (coi như ca ngày).
 * Bỏ qua cả phiếu tenKyThuat = "Không cần thợ cơ khí" — đây là giá trị placeholder dùng chung cho
 * nhiều phiếu, không phải tên 1 kỹ thuật viên cụ thể, nên không được coi là "cùng 1 thợ" khi dò
 * chồng lịch/thợ bận (nếu không sẽ báo overlap/busy sai giữa các phiếu không liên quan gì đến nhau).
 */
function getExistingRowsForMonth_(sheet, thang) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const numCols = Math.max(sheet.getLastColumn(), 20); // đảm bảo đọc tới cột T (Ca, cột 20)
  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  const rows = [];
  values.forEach(row => {
    if (row[2] !== thang) return; // cột C = thang

    const ngayDate = row[9];        // cột J = ngay
    const gioSuaDate = row[11];     // cột L = gioSua
    const gioKetThucDate = row[12]; // cột M = gioKetThuc
    const tenKyThuat = row[15];     // cột P = tenKyThuat
    const ca = row[19] || '';       // cột T = Ca (có thể trống ở phiếu cũ)
    if (!ngayDate || !gioSuaDate || !gioKetThucDate || !tenKyThuat) return;
    if (tenKyThuat === 'Không cần thợ cơ khí') return;

    const ngayStr = Utilities.formatDate(ngayDate, 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd');
    const gioSuaHHMM = Utilities.formatDate(gioSuaDate, 'Asia/Ho_Chi_Minh', 'HH:mm');
    const gioKetThucHHMM = Utilities.formatDate(gioKetThucDate, 'Asia/Ho_Chi_Minh', 'HH:mm');

    const batDauSuaActual = toActualDateTime_(ngayStr, gioSuaHHMM, ca);
    const ketThucActual = toActualEndDateTime_(ngayStr, gioKetThucHHMM, ca, batDauSuaActual);

    rows.push({ tenKyThuat, batDauSuaActual, ketThucActual });
  });
  return rows;
}

/**
 * payload = {
 *   maMay, tenMay, boPhan, viTri, noiDung,
 *   ngay ('YYYY-MM-DD'), gioHu ('HH:MM', không bắt buộc), gioSua ('HH:MM'), gioKetThuc ('HH:MM'),
 *   ca ('Ngày' | 'Đêm'), tenKyThuat, loaiCongViec, ghiChu,
 *   vatTu: [{ ma, ten, dvt, soLuong }, ...]
 * }
 */
function submitBaoCao(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sheet = ss_().getSheetByName(SHEET_BAOCAO);
    const vtSheet = ss_().getSheetByName(SHEET_BAOCAO_VATTU);
    if (!sheet || !vtSheet) throw new Error('Thiếu sheet BaoCao hoặc BaoCao_VatTu.');

    const id = genId_();
    const now = new Date();
    const stt = sheet.getLastRow(); // trừ header -> vẫn tăng dần hợp lệ
    const thang = payload.ngay ? payload.ngay.slice(5, 7) + '/' + payload.ngay.slice(0, 4) : '';

    const tgDungMay = minutesBetween_(payload.ngay, payload.gioHu, payload.gioKetThuc);
    const tgSuaChua = minutesBetween_(payload.ngay, payload.gioSua, payload.gioKetThuc);

    const vatTuList = payload.vatTu || [];
    const vatTuTomTat = vatTuList
      .filter(v => v.ten)
      .map(v => v.ten + (v.soLuong ? ' x' + v.soLuong : ''))
      .join('; ');

    // --- KPI đáp ứng + chồng lịch (cột T→Y) ---
    const ca = payload.ca || '';
    const batDauHuActual = payload.gioHu ? toActualDateTime_(payload.ngay, payload.gioHu, ca) : null;
    const batDauSuaActual = payload.gioSua ? toActualDateTime_(payload.ngay, payload.gioSua, ca) : null;
    const ketThucActual = payload.gioKetThuc
      ? toActualEndDateTime_(payload.ngay, payload.gioKetThuc, ca, batDauSuaActual)
      : null;

    // Quét các phiếu cũ CÙNG THÁNG (tại thời điểm lưu phiếu này; không quét lại/cập nhật ngược phiếu cũ).
    const existingRows = getExistingRowsForMonth_(sheet, thang);
    const currentForOverlap = {
      tenKyThuat: payload.tenKyThuat || '',
      batDauHuActual, batDauSuaActual, ketThucActual
    };
    const { busyUntil, overlapCount } = findOverlapAndBusyUntil_(existingRows, currentForOverlap);
    const metrics = calcDapUngMetrics_(currentForOverlap, busyUntil, overlapCount);

    sheet.appendRow([
      id,
      now,
      thang,
      stt,
      payload.maMay || '',
      payload.tenMay || '',
      payload.boPhan || '',
      payload.viTri || '',
      payload.noiDung || '',
      payload.ngay ? new Date(payload.ngay + 'T00:00:00+07:00') : '',
      timeToDate_(payload.ngay, payload.gioHu),
      timeToDate_(payload.ngay, payload.gioSua),
      timeToDate_(payload.ngay, payload.gioKetThuc),
      tgDungMay,
      tgSuaChua,
      payload.tenKyThuat || '',
      payload.loaiCongViec || '',
      vatTuTomTat,
      payload.ghiChu || '',
      ca,
      metrics.tong !== undefined ? metrics.tong : '',
      metrics.cho !== undefined ? metrics.cho : '',
      metrics.dapUngSauRanh !== undefined ? metrics.dapUngSauRanh : '',
      overlapCount,
      metrics.trangThai || ''
    ]);

    const newRow = sheet.getLastRow();
    sheet.getRange(newRow, 2).setNumberFormat('dd/mm/yyyy hh:mm');
    sheet.getRange(newRow, 10).setNumberFormat('dd/mm/yyyy');
    sheet.getRange(newRow, 11, 1, 3).setNumberFormat('hh:mm');

    vatTuList
      .filter(v => v.ten)
      .forEach(v => {
        vtSheet.appendRow([id, v.ma || '', v.ten, v.dvt || '', v.soLuong || '']);
      });

    // Phiếu bộ phận DET: đẩy thêm 1 dòng sang Google Sheet KPI Dệt riêng (Nhật ký bảo trì).
    // Bọc try/catch RIÊNG — lỗi ở đây (vd mất quyền truy cập ID_KPI_DET) không được làm hỏng
    // việc lưu phiếu chính đã ghi xong ở trên vào BaoCao.
    try {
      ghiSangKpiDet_(payload, id, tgSuaChua, tgDungMay);
    } catch (errDet) {
      Logger.log('Lỗi ghi sang KPI Dệt (id=' + id + '): ' + errDet.message);
    }

    return { ok: true, id: id };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Chạy 1 LẦN THỦ CÔNG (mở Apps Script Editor > chọn hàm này > bấm Run) để thêm header 6 cột
 * KPI đáp ứng (T→Y) vào CUỐI sheet BaoCao thật, KHÔNG đụng 19 cột A→S hiện có.
 * Phải chạy hàm này trước khi deploy version submitBaoCao() mới, nếu không phiếu mới sẽ ghi
 * dữ liệu vào cột T→Y mà chưa có header tương ứng.
 * Có chặn chạy lại nếu T1:Y1 đã có nội dung, để tránh ghi đè nhầm.
 */
function themCotDapUngKPI_() {
  const sheet = ss_().getSheetByName(SHEET_BAOCAO);
  if (!sheet) throw new Error('Không tìm thấy sheet: ' + SHEET_BAOCAO);
  const headers = ['Ca', 'ThoiGianDapUngTong_phut', 'ThoiGianChoThoBan_phut',
    'ThoiGianDapUngSauKhiRanh_phut', 'SoLanChongViec', 'TrangThaiDapUng'];
  const existing = sheet.getRange(1, 20, 1, 6).getValues()[0];
  if (existing.some(v => v !== '')) {
    throw new Error('Cột T:Y (hàng 1) đã có nội dung — kiểm tra lại trước khi chạy themCotDapUngKPI_() lần nữa.');
  }
  sheet.getRange(1, 20, 1, 6).setValues([headers]);
}

/* ============================================================================
 * PHẦN B — Sheet "Báo cáo sếp" hằng tháng (tự động tổng hợp, tính bằng Apps Script,
 * không dùng công thức Sheets — đúng nguyên tắc dự án).
 * ========================================================================== */

function thangHienTai_() {
  return Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'MM/yyyy');
}

function round1_(n) {
  return Math.round(n * 10) / 10;
}

/** Chuyển 1 dòng thô đọc từ sheet BaoCao thành object dễ đọc cho các hàm tổng hợp thuần bên dưới. */
function toBaoCaoRowObj_(row) {
  return {
    boPhan: row[6],          // cột G
    maMay: row[4],           // cột E
    tenMay: row[5],          // cột F
    tgDungMay: row[13],      // cột N
    tgSuaChua: row[14],      // cột O
    tenKyThuat: row[15],     // cột P
    dapUngTong: row[20],     // cột U (Phần A)
    dapUngSauRanh: row[22],  // cột W (Phần A)
    soLanChongViec: row[23]  // cột X (Phần A)
  };
}

function tinhTongQuan_(rows) {
  let tongDowntime = 0;
  let tongThoiGianSua = 0;
  rows.forEach(r => {
    if (typeof r.tgDungMay === 'number') tongDowntime += r.tgDungMay;
    if (typeof r.tgSuaChua === 'number') tongThoiGianSua += r.tgSuaChua;
  });
  return { soLanHong: rows.length, tongDowntime, tongThoiGianSua };
}

function tinhTheoBoPhan_(rows) {
  const map = {};
  rows.forEach(r => {
    const key = r.boPhan || '(Trống)';
    if (!map[key]) map[key] = { boPhan: key, soLanHong: 0, tongDowntime: 0, tongThoiGianSua: 0 };
    map[key].soLanHong++;
    if (typeof r.tgDungMay === 'number') map[key].tongDowntime += r.tgDungMay;
    if (typeof r.tgSuaChua === 'number') map[key].tongThoiGianSua += r.tgSuaChua;
  });
  return Object.values(map).sort((a, b) => b.tongDowntime - a.tongDowntime);
}

function tinhTheoMay_(rows) {
  const map = {};
  rows.forEach(r => {
    const key = r.maMay || r.tenMay || '(Trống)';
    if (!map[key]) {
      map[key] = { maMay: r.maMay || '', tenMay: r.tenMay || '', boPhan: r.boPhan || '', soLanHong: 0, tongDowntime: 0, tongThoiGianSua: 0 };
    }
    map[key].soLanHong++;
    if (typeof r.tgDungMay === 'number') map[key].tongDowntime += r.tgDungMay;
    if (typeof r.tgSuaChua === 'number') map[key].tongThoiGianSua += r.tgSuaChua;
  });
  return Object.values(map).sort((a, b) => b.tongDowntime - a.tongDowntime);
}

/** Tận dụng lại cột U/W/X đã tính sẵn ở Phần A (submitBaoCao) — không tính lại từ giờ thô. */
function tinhTheoKyThuat_(rows) {
  const map = {};
  rows.forEach(r => {
    const key = r.tenKyThuat;
    if (!key) return; // bỏ phiếu chưa nhập người xử lý khỏi bảng theo kỹ thuật viên
    if (!map[key]) {
      map[key] = { tenKyThuat: key, soViec: 0, tongDapUng: 0, soDapUngHopLe: 0, tongDapUngSauRanh: 0, soSauRanhHopLe: 0, tongChongViec: 0 };
    }
    const m = map[key];
    m.soViec++;
    if (typeof r.dapUngTong === 'number') { m.tongDapUng += r.dapUngTong; m.soDapUngHopLe++; }
    if (typeof r.dapUngSauRanh === 'number') { m.tongDapUngSauRanh += r.dapUngSauRanh; m.soSauRanhHopLe++; }
    if (typeof r.soLanChongViec === 'number') m.tongChongViec += r.soLanChongViec;
  });
  return Object.values(map)
    .map(m => ({
      tenKyThuat: m.tenKyThuat,
      soViec: m.soViec,
      tbDapUng: m.soDapUngHopLe ? round1_(m.tongDapUng / m.soDapUngHopLe) : '',
      tbDapUngSauRanh: m.soSauRanhHopLe ? round1_(m.tongDapUngSauRanh / m.soSauRanhHopLe) : '',
      tongChongViec: m.tongChongViec
    }))
    .sort((a, b) => b.soViec - a.soViec);
}

const BAOCAO_SEP_SO_COT = 6; // độ rộng cố định (số cột) của sheet BaoCaoSep, để pad các dòng ngắn hơn

function padRow_(arr) {
  const row = arr.slice(0, BAOCAO_SEP_SO_COT);
  while (row.length < BAOCAO_SEP_SO_COT) row.push('');
  return row;
}

/**
 * Ghép toàn bộ nội dung sheet BaoCaoSep thành 1 mảng 2 chiều duy nhất (để ghi bằng setValues()
 * 1 lần, đúng yêu cầu "clear rồi ghi lại toàn bộ mỗi lần chạy"). Hàm thuần — không đụng
 * SpreadsheetApp, nhận capNhatLuc dạng chuỗi đã format sẵn từ nơi gọi.
 */
function buildBaoCaoSepValues_(thang, capNhatLuc, tongQuan, theoBoPhan, theoMay, theoKyThuat) {
  const rows = [];
  rows.push(padRow_(['BÁO CÁO TỔNG HỢP SỬA CHỮA — THÁNG ' + thang]));
  rows.push(padRow_(['⚠️ Sheet này tự động ghi đè mỗi lần cập nhật — không sửa/ghi chú tay trực tiếp vào đây, dữ liệu sẽ mất ở lần cập nhật tiếp theo.']));
  rows.push(padRow_(['Cập nhật lúc: ' + capNhatLuc]));
  rows.push(padRow_(['']));

  rows.push(padRow_(['TỔNG QUAN']));
  rows.push(padRow_(['Tổng số lần hỏng', tongQuan.soLanHong]));
  rows.push(padRow_(['Tổng thời gian dừng máy (phút)', tongQuan.tongDowntime]));
  rows.push(padRow_(['Tổng thời gian sửa chữa (phút)', tongQuan.tongThoiGianSua]));
  rows.push(padRow_(['']));

  rows.push(padRow_(['THEO BỘ PHẬN']));
  rows.push(padRow_(['Bộ phận', 'Số lần hỏng', 'Tổng downtime (phút)', 'Tổng thời gian sửa (phút)']));
  theoBoPhan.forEach(b => rows.push(padRow_([b.boPhan, b.soLanHong, b.tongDowntime, b.tongThoiGianSua])));
  rows.push(padRow_(['']));

  rows.push(padRow_(['THEO MÁY']));
  rows.push(padRow_(['Mã máy', 'Tên máy', 'Bộ phận', 'Số lần hỏng', 'Tổng downtime (phút)', 'Tổng thời gian sửa (phút)']));
  theoMay.forEach(m => rows.push(padRow_([m.maMay, m.tenMay, m.boPhan, m.soLanHong, m.tongDowntime, m.tongThoiGianSua])));
  rows.push(padRow_(['']));

  rows.push(padRow_(['THEO KỸ THUẬT VIÊN']));
  rows.push(padRow_(['Tên kỹ thuật', 'Số việc', 'TB thời gian đáp ứng (phút)', 'TB đáp ứng sau khi rảnh (phút)', 'Tổng số lần chồng việc']));
  theoKyThuat.forEach(k => rows.push(padRow_([k.tenKyThuat, k.soViec, k.tbDapUng, k.tbDapUngSauRanh, k.tongChongViec])));

  return rows;
}

/**
 * Đọc toàn bộ sheet BaoCao (lọc theo "thang", mặc định tháng hiện tại), tổng hợp theo bộ phận /
 * máy / kỹ thuật viên, rồi ghi đè toàn bộ sheet BaoCaoSep bằng 1 lần setValues() (clear trước).
 * KHÔNG gọi trong submitBaoCao() (sẽ làm chậm form nhập liệu) — chạy qua trigger theo lịch hoặc
 * menu thủ công (xem capNhatBaoCaoSepTuDong_, caiDatTriggerBaoCaoSep_, onOpen).
 */
function updateBaoCaoSepSheet_(thang) {
  thang = thang || thangHienTai_();

  const sheet = ss_().getSheetByName(SHEET_BAOCAO);
  if (!sheet) throw new Error('Không tìm thấy sheet: ' + SHEET_BAOCAO);

  const lastRow = sheet.getLastRow();
  const numCols = Math.max(sheet.getLastColumn(), 25);
  const raw = lastRow < 2 ? [] : sheet.getRange(2, 1, lastRow - 1, numCols).getValues();
  const rows = raw.filter(r => r[2] === thang).map(toBaoCaoRowObj_);

  const tongQuan = tinhTongQuan_(rows);
  const theoBoPhan = tinhTheoBoPhan_(rows);
  const theoMay = tinhTheoMay_(rows);
  const theoKyThuat = tinhTheoKyThuat_(rows);
  const capNhatLuc = Utilities.formatDate(new Date(), 'Asia/Ho_Chi_Minh', 'dd/MM/yyyy HH:mm');

  const values = buildBaoCaoSepValues_(thang, capNhatLuc, tongQuan, theoBoPhan, theoMay, theoKyThuat);

  let sepSheet = ss_().getSheetByName(SHEET_BAOCAO_SEP);
  if (!sepSheet) sepSheet = ss_().insertSheet(SHEET_BAOCAO_SEP);
  sepSheet.clearContents(); // chỉ xoá dữ liệu, giữ nguyên định dạng (màu, viền, độ rộng cột) đã set thủ công
  sepSheet.getRange(1, 1, values.length, BAOCAO_SEP_SO_COT).setValues(values);
}

/**
 * Handler KHÔNG NHẬN THAM SỐ, dùng riêng cho trigger/menu. Lý do tách riêng: nếu gắn thẳng
 * updateBaoCaoSepSheet_ vào trigger, Apps Script sẽ tự truyền 1 event object vào làm tham số
 * "thang" đầu tiên (khác undefined) → phá mất default "tháng hiện tại".
 */
function capNhatBaoCaoSepTuDong_() {
  updateBaoCaoSepSheet_();
}

/**
 * Chạy 1 LẦN THỦ CÔNG (Apps Script Editor > chọn hàm này > Run) để đăng ký trigger chạy
 * capNhatBaoCaoSepTuDong_ mỗi ngày lúc ~23:50. clasp push KHÔNG tự bật trigger này.
 * Tự xoá trigger cùng tên trước khi tạo, để chạy lại hàm này nhiều lần không bị tạo trùng.
 */
function caiDatTriggerBaoCaoSep_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'capNhatBaoCaoSepTuDong_')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('capNhatBaoCaoSepTuDong_')
    .timeBased()
    .everyDays(1)
    .atHour(23)
    .nearMinute(50)
    .create();
}

/** Thêm menu "🔄 Cập nhật báo cáo sếp" vào Google Sheet để refresh thủ công ngay khi cần gửi gấp. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SAPHIA')
    .addItem('🔄 Cập nhật báo cáo sếp', 'capNhatBaoCaoSepTuDong_')
    .addToUi();
}

/* ============================================================================
 * PHẦN C — Tích hợp KPI Dệt (Giai đoạn 1): phiếu bộ phận DET được đẩy thêm 1 dòng sang
 * Google Sheet KPI Dệt riêng, sheet "Nhật ký bảo trì". Sheet "Tổng Hợp" của KPI Dệt đã có sẵn
 * công thức Sheets sống tham chiếu thẳng cột J của "Nhật ký bảo trì" (SUM/COUNTIF) — không cần
 * viết thêm logic tính KPI, chỉ cần ghi đúng dòng đúng cột.
 * ========================================================================== */

// Spreadsheet ID của Google Sheet KPI Dệt (đã có sẵn, không phải tạo mới từ file .xlsx).
const ID_KPI_DET = '1x4KKyBczALtBOkrGgqDtqkgH4Lv_N30SRu39oIniDF4';
const SHEET_KPI_DET_NHATKY = 'Nhật ký bảo trì';

/**
 * Xây 1 dòng dữ liệu đúng 10 cột của sheet "Nhật ký bảo trì" (KPI Dệt), khớp theo bảng ánh xạ
 * ở C.1: Mã sự cố, Ngày sửa, Ca, Tên máy, Nội dung hư hỏng, Bắt đầu hư, Bắt đầu sửa, Kết thúc sửa,
 * Thời gian sửa máy (phút), Thời gian dừng máy (phút). Hàm thuần — tách riêng để test được.
 */
function buildDetRow_(payload, id, tgSuaChua, tgDungMay) {
  return [
    id,
    payload.ngay || '',
    payload.ca || '',
    payload.tenMay || '',
    payload.noiDung || '',
    payload.gioHu || '',
    payload.gioSua || '',
    payload.gioKetThuc || '',
    tgSuaChua,
    // tgDungMay có thể là '' khi thiếu "Bắt đầu hư" (A.6.1, không bắt buộc nhập). Sheet Tổng Hợp
    // bên KPI Dệt cộng cột này bằng SUM(J:J) — SUM bỏ qua chuỗi rỗng, nên phải ghi 0 (số) thay vì
    // '' để phiếu này vẫn được tính vào tổng downtime, không bị âm thầm bỏ sót.
    tgDungMay === '' ? 0 : tgDungMay
  ];
}

/**
 * Chỉ ghi khi payload.boPhan === 'DET'. KHÔNG đụng gì tới cấu trúc/công thức có sẵn trong Google
 * Sheet KPI Dệt — chỉ appendRow vào cuối sheet "Nhật ký bảo trì" (10 cột), giữ nguyên các sheet
 * khác (Tổng Hợp, Tổng hợp chạy máy, ...) y nguyên.
 */
function ghiSangKpiDet_(payload, id, tgSuaChua, tgDungMay) {
  if (payload.boPhan !== 'DET') return;
  const shDet = SpreadsheetApp.openById(ID_KPI_DET).getSheetByName(SHEET_KPI_DET_NHATKY);
  if (!shDet) {
    throw new Error('Không tìm thấy sheet "' + SHEET_KPI_DET_NHATKY + '" trong Google Sheet KPI Dệt (ID_KPI_DET).');
  }
  shDet.appendRow(buildDetRow_(payload, id, tgSuaChua, tgDungMay));
}

// Cho phép require() các hàm tính toán thuần (không đụng SpreadsheetApp) từ script test độc lập
// chạy bằng Node — Apps Script không định nghĩa biến `module` nên nhánh này không chạy khi deploy thật.
if (typeof module !== 'undefined') {
  module.exports = {
    MOC_CHUYEN_CA_DEM,
    minutesBetween_,
    timeToDate_,
    toActualDateTime_,
    toActualEndDateTime_,
    findOverlapAndBusyUntil_,
    calcDapUngMetrics_,
    round1_,
    toBaoCaoRowObj_,
    tinhTongQuan_,
    tinhTheoBoPhan_,
    tinhTheoMay_,
    tinhTheoKyThuat_,
    padRow_,
    buildBaoCaoSepValues_,
    BAOCAO_SEP_SO_COT,
    buildDetRow_,
    ghiSangKpiDet_
  };
}