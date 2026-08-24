/**
 * Test độc lập cho logic Phần C (đẩy phiếu bộ phận DET sang Google Sheet KPI Dệt).
 * Dữ liệu mẫu tự tạo trong file này — KHÔNG kết nối SpreadsheetApp.openById(ID_KPI_DET) thật,
 * không đụng Google Sheet KPI Dệt thật.
 *
 * buildDetRow_ là hàm thuần (không đụng SpreadsheetApp) -> test đầy đủ nội dung dòng ghi ra.
 * ghiSangKpiDet_ chỉ test được nhánh "không phải bộ phận DET -> return sớm, không đụng
 * SpreadsheetApp" (nên chạy được trong Node dù không mock SpreadsheetApp). Nhánh thật sự gọi
 * SpreadsheetApp.openById(ID_KPI_DET) KHÔNG test ở đây — cần chạy thử trực tiếp trong Apps Script
 * Editor với 1 phiếu DET thật (hoặc phiếu test) rồi xoá dòng test đó đi trong Sheet KPI Dệt.
 *
 * Chạy: node apps-script/test/test_kpiDet.js
 */
const assert = require('assert');
const path = require('path');

const { buildDetRow_, ghiSangKpiDet_ } = require(path.join(__dirname, '..', 'Mã.js'));

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  OK  ' + name);
  } catch (err) {
    console.error('  FAIL ' + name);
    console.error('       ' + err.message);
    process.exitCode = 1;
  }
}

console.log('=== buildDetRow_ ===');

test('Đúng thứ tự 10 cột theo bảng ánh xạ C.1', () => {
  const payload = {
    ngay: '2026-07-15', ca: 'Ngày', tenMay: 'Máy dệt 12', noiDung: 'Bung chỉ thuyền',
    gioHu: '08:00', gioSua: '08:20', gioKetThuc: '09:00', boPhan: 'DET'
  };
  const row = buildDetRow_(payload, 'BC20260715080000123', 40, 60);
  assert.deepStrictEqual(row, [
    'BC20260715080000123', // Mã sự cố
    '2026-07-15',           // Ngày sửa
    'Ngày',                 // Ca
    'Máy dệt 12',            // Tên máy
    'Bung chỉ thuyền',       // Nội dung hư hỏng (Bệnh)
    '08:00',                 // Bắt đầu hư
    '08:20',                 // Bắt đầu sửa
    '09:00',                 // Kết thúc sửa
    40,                      // Thời gian sửa máy (phút) = tgSuaChua
    60                       // Thời gian dừng máy (phút) = tgDungMay
  ]);
});

test('Thiếu "Bắt đầu hư" (A.6.1: không bắt buộc) -> ô Bắt đầu hư trống, nhưng tgDungMay phải ghi số 0 (không phải chuỗi rỗng), vì Tổng Hợp bên KPI Dệt cộng bằng SUM(J:J) và SUM bỏ qua chuỗi rỗng', () => {
  const payload = {
    ngay: '2026-07-15', ca: 'Đêm', tenMay: 'Máy dệt 5', noiDung: 'Kẹt thoi',
    gioHu: '', gioSua: '23:10', gioKetThuc: '23:40', boPhan: 'DET'
  };
  const row = buildDetRow_(payload, 'BCXYZ', 30, '');
  assert.strictEqual(row[5], ''); // Bắt đầu hư trống
  assert.strictEqual(row[8], 30); // tgSuaChua vẫn có (chỉ cần gioSua/gioKetThuc)
  assert.strictEqual(row[9], 0); // tgDungMay = 0 (số), không phải '' -> vẫn được SUM(J:J) tính vào tổng
});

test('tgDungMay là số bình thường (có "Bắt đầu hư") -> giữ nguyên, không đổi thành 0', () => {
  const payload = {
    ngay: '2026-07-15', ca: 'Ngày', tenMay: 'Máy dệt 5', noiDung: 'Kẹt thoi',
    gioHu: '08:00', gioSua: '08:20', gioKetThuc: '09:00', boPhan: 'DET'
  };
  const row = buildDetRow_(payload, 'BCABC', 40, 60);
  assert.strictEqual(row[9], 60);
});

console.log('\n=== ghiSangKpiDet_ (chỉ test nhánh không phải DET) ===');

test('boPhan khác DET -> return sớm, KHÔNG đụng SpreadsheetApp (không throw dù không mock)', () => {
  // Nếu code lỡ gọi SpreadsheetApp trước khi check boPhan, dòng này sẽ throw ReferenceError
  // (SpreadsheetApp is not defined) vì Node không có global đó -> test tự phát hiện lỗi thứ tự.
  const result = ghiSangKpiDet_({ boPhan: 'SOI' }, 'BC1', 10, 20);
  assert.strictEqual(result, undefined);
});

test('boPhan rỗng/undefined -> cũng return sớm, không throw', () => {
  const result = ghiSangKpiDet_({}, 'BC2', 10, 20);
  assert.strictEqual(result, undefined);
});

console.log(`\n${passed} test pass.` + (process.exitCode ? ' CÓ TEST FAIL — xem chi tiết ở trên.' : ' Tất cả pass.'));
