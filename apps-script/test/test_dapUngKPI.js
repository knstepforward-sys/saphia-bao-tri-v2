/**
 * Test độc lập cho logic Phần A (tính "thời gian đáp ứng" + "chồng lịch kỹ thuật viên").
 * Chỉ dùng dữ liệu mẫu tự tạo trong file này — KHÔNG kết nối SpreadsheetApp / Sheet thật.
 *
 * Require trực tiếp các hàm thuần (không đụng SpreadsheetApp) từ chính Mã.js qua khối
 * `if (typeof module !== 'undefined')` ở cuối file đó, để test luôn khớp với logic thật sự
 * sẽ chạy trên Apps Script (không phải bản chép lại có thể lệch).
 *
 * getExistingRowsForMonth_ và themCotDapUngKPI_ KHÔNG được test ở đây vì phụ thuộc trực tiếp
 * SpreadsheetApp/Utilities (I/O đọc Sheet) — bản thân chúng chỉ là wrapper mỏng gọi lại đúng
 * toActualDateTime_/toActualEndDateTime_ đã được test kỹ ở dưới. Nên kiểm tra 2 hàm đó bằng
 * cách chạy thử (Logger.log) trực tiếp trong Apps Script Editor với vài dòng dữ liệu thật trước
 * khi bấm "Lưu báo cáo" trên form thật.
 *
 * Chạy: node apps-script/test/test_dapUngKPI.js
 */
const assert = require('assert');
const path = require('path');

const {
  toActualDateTime_,
  toActualEndDateTime_,
  findOverlapAndBusyUntil_,
  calcDapUngMetrics_
} = require(path.join(__dirname, '..', 'Mã.js'));

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

function dt(iso) { return new Date(iso); }

console.log('=== toActualDateTime_ / toActualEndDateTime_ ===');

test('Ca Ngày, giờ bình thường -> không cộng ngày', () => {
  const d = toActualDateTime_('2026-07-15', '08:00', 'Ngày');
  assert.strictEqual(d.getTime(), dt('2026-07-15T08:00:00+07:00').getTime());
});

test('Ca Đêm, giờ >= mốc 07:00 -> không cộng ngày', () => {
  const d = toActualDateTime_('2026-07-15', '23:30', 'Đêm');
  assert.strictEqual(d.getTime(), dt('2026-07-15T23:30:00+07:00').getTime());
});

test('Ca Đêm, giờ < mốc 07:00 -> cộng thêm 1 ngày (đã vắt qua ngày hôm sau)', () => {
  const d = toActualDateTime_('2026-07-15', '00:15', 'Đêm');
  assert.strictEqual(d.getTime(), dt('2026-07-16T00:15:00+07:00').getTime());
});

test('Ca Ngày, giờ < 07:00 -> KHÔNG cộng ngày (chỉ ca Đêm mới cộng)', () => {
  const d = toActualDateTime_('2026-07-15', '00:15', 'Ngày');
  assert.strictEqual(d.getTime(), dt('2026-07-15T00:15:00+07:00').getTime());
});

test('toActualEndDateTime_: kết thúc sau khi quy đổi vẫn > bắt đầu -> giữ nguyên', () => {
  const start = toActualDateTime_('2026-07-15', '23:00', 'Ngày');
  const end = toActualEndDateTime_('2026-07-15', '23:45', 'Ngày', start);
  assert.strictEqual(end.getTime(), dt('2026-07-15T23:45:00+07:00').getTime());
});

test('toActualEndDateTime_: kết thúc < bắt đầu (vắt qua nửa đêm, ca Ngày) -> cộng thêm 1 ngày', () => {
  const start = toActualDateTime_('2026-07-15', '23:00', 'Ngày');
  const end = toActualEndDateTime_('2026-07-15', '00:30', 'Ngày', start);
  assert.strictEqual(end.getTime(), dt('2026-07-16T00:30:00+07:00').getTime());
});

test('Ca đêm trọn vẹn: hư 23:30 (N), sửa 00:15 (N+1), kết thúc 01:00 (N+1)', () => {
  const hu = toActualDateTime_('2026-07-15', '23:30', 'Đêm');
  const sua = toActualDateTime_('2026-07-15', '00:15', 'Đêm');
  const kt = toActualEndDateTime_('2026-07-15', '01:00', 'Đêm', sua);
  assert.strictEqual(hu.getTime(), dt('2026-07-15T23:30:00+07:00').getTime());
  assert.strictEqual(sua.getTime(), dt('2026-07-16T00:15:00+07:00').getTime());
  assert.strictEqual(kt.getTime(), dt('2026-07-16T01:00:00+07:00').getTime());
  assert.strictEqual((sua - hu) / 60000, 45); // đúng 45 phút xuyên nửa đêm, không phải số âm
});

console.log('\n=== calcDapUngMetrics_ / findOverlapAndBusyUntil_ ===');

test('Thợ rảnh (không bận, không chồng): tổng = sau khi rảnh, chờ = 0', () => {
  const current = {
    tenKyThuat: 'Nguyễn Văn A',
    batDauHuActual: dt('2026-07-15T08:00:00+07:00'),
    batDauSuaActual: dt('2026-07-15T08:20:00+07:00'),
    ketThucActual: dt('2026-07-15T09:00:00+07:00')
  };
  const { busyUntil, overlapCount } = findOverlapAndBusyUntil_([], current);
  assert.strictEqual(busyUntil, null);
  assert.strictEqual(overlapCount, 0);

  const m = calcDapUngMetrics_(current, busyUntil, overlapCount);
  assert.strictEqual(m.tong, 20);
  assert.strictEqual(m.cho, 0);
  assert.strictEqual(m.dapUngSauRanh, 20);
  assert.strictEqual(m.trangThai, 'THỢ RẢNH');
});

test('Chờ thợ bận việc khác: tổng = chờ + sau khi rảnh', () => {
  const existingRows = [{
    tenKyThuat: 'Nguyễn Văn A',
    batDauSuaActual: dt('2026-07-15T08:00:00+07:00'),
    ketThucActual: dt('2026-07-15T08:50:00+07:00')
  }];
  const current = {
    tenKyThuat: 'Nguyễn Văn A',
    batDauHuActual: dt('2026-07-15T08:10:00+07:00'),
    batDauSuaActual: dt('2026-07-15T08:55:00+07:00'),
    ketThucActual: dt('2026-07-15T09:30:00+07:00')
  };
  const { busyUntil, overlapCount } = findOverlapAndBusyUntil_(existingRows, current);
  assert.strictEqual(busyUntil.getTime(), dt('2026-07-15T08:50:00+07:00').getTime());
  assert.strictEqual(overlapCount, 0);

  const m = calcDapUngMetrics_(current, busyUntil, overlapCount);
  assert.strictEqual(m.tong, 45);
  assert.strictEqual(m.cho, 40);
  assert.strictEqual(m.dapUngSauRanh, 5);
  assert.strictEqual(m.tong, m.cho + m.dapUngSauRanh);
  assert.strictEqual(m.trangThai, 'CHỜ THỢ RẢNH');
});

test('Chồng việc: 2 phiếu cùng thợ có khung giờ sửa chữa thực tế đè lên nhau', () => {
  const existingRows = [{
    tenKyThuat: 'Nguyễn Văn A',
    batDauSuaActual: dt('2026-07-15T08:00:00+07:00'),
    ketThucActual: dt('2026-07-15T09:00:00+07:00')
  }];
  const current = {
    tenKyThuat: 'Nguyễn Văn A',
    batDauHuActual: dt('2026-07-15T08:30:00+07:00'),
    batDauSuaActual: dt('2026-07-15T08:40:00+07:00'),
    ketThucActual: dt('2026-07-15T09:10:00+07:00')
  };
  const { overlapCount } = findOverlapAndBusyUntil_(existingRows, current);
  assert.strictEqual(overlapCount, 1);

  const m = calcDapUngMetrics_(current, null, overlapCount);
  assert.strictEqual(m.trangThai, 'CHỒNG VIỆC / KIỂM TRA DỮ LIỆU');
});

test('Khác thợ -> không tính vào busy/overlap dù trùng giờ', () => {
  const existingRows = [{
    tenKyThuat: 'Trần Văn B',
    batDauSuaActual: dt('2026-07-15T08:00:00+07:00'),
    ketThucActual: dt('2026-07-15T09:00:00+07:00')
  }];
  const current = {
    tenKyThuat: 'Nguyễn Văn A',
    batDauHuActual: dt('2026-07-15T08:10:00+07:00'),
    batDauSuaActual: dt('2026-07-15T08:20:00+07:00'),
    ketThucActual: dt('2026-07-15T08:40:00+07:00')
  };
  const { busyUntil, overlapCount } = findOverlapAndBusyUntil_(existingRows, current);
  assert.strictEqual(busyUntil, null);
  assert.strictEqual(overlapCount, 0);
});

test('Không nhập tên kỹ thuật -> CHƯA NHẬP NGƯỜI XỬ LÝ', () => {
  const m = calcDapUngMetrics_({ tenKyThuat: '' }, null, 0);
  assert.strictEqual(m.trangThai, 'CHƯA NHẬP NGƯỜI XỬ LÝ');
  assert.strictEqual(m.tong, undefined);
});

test('"Không cần thợ cơ khí" -> KHÔNG YÊU CẦU THỢ CƠ KHÍ', () => {
  const m = calcDapUngMetrics_({ tenKyThuat: 'Không cần thợ cơ khí' }, null, 0);
  assert.strictEqual(m.trangThai, 'KHÔNG YÊU CẦU THỢ CƠ KHÍ');
});

test('Thiếu "Bắt đầu hư" (A.6.1: không bắt buộc nhập) -> THIẾU THỜI GIAN, không chặn lưu phiếu', () => {
  const m = calcDapUngMetrics_({
    tenKyThuat: 'Nguyễn Văn A',
    batDauHuActual: null,
    batDauSuaActual: dt('2026-07-15T08:20:00+07:00'),
    ketThucActual: dt('2026-07-15T09:00:00+07:00')
  }, null, 0);
  assert.strictEqual(m.trangThai, 'THIẾU THỜI GIAN');
  assert.strictEqual(m.tong, undefined);
});

test('Thiếu Bắt đầu sửa hoặc Kết thúc -> THIẾU THỜI GIAN', () => {
  const m1 = calcDapUngMetrics_({
    tenKyThuat: 'Nguyễn Văn A',
    batDauHuActual: dt('2026-07-15T08:00:00+07:00'),
    batDauSuaActual: null,
    ketThucActual: dt('2026-07-15T09:00:00+07:00')
  }, null, 0);
  assert.strictEqual(m1.trangThai, 'THIẾU THỜI GIAN');

  const m2 = calcDapUngMetrics_({
    tenKyThuat: 'Nguyễn Văn A',
    batDauHuActual: dt('2026-07-15T08:00:00+07:00'),
    batDauSuaActual: dt('2026-07-15T08:20:00+07:00'),
    ketThucActual: null
  }, null, 0);
  assert.strictEqual(m2.trangThai, 'THIẾU THỜI GIAN');
});

console.log(`\n${passed} test pass.` + (process.exitCode ? ' CÓ TEST FAIL — xem chi tiết ở trên.' : ' Tất cả pass.'));
