/**
 * Test độc lập cho logic Phần B (tổng hợp sheet "BaoCaoSep" hằng tháng).
 * Chỉ dùng dữ liệu mẫu tự tạo trong file này — KHÔNG kết nối SpreadsheetApp / Sheet thật.
 *
 * Require trực tiếp các hàm tổng hợp thuần (không đụng SpreadsheetApp) từ chính Mã.js.
 * updateBaoCaoSepSheet_, capNhatBaoCaoSepTuDong_, caiDatTriggerBaoCaoSep_, onOpen KHÔNG được
 * test ở đây vì phụ thuộc trực tiếp SpreadsheetApp/ScriptApp/Utilities (I/O đọc-ghi Sheet +
 * đăng ký trigger) — bản thân chúng chỉ là wrapper mỏng gọi lại đúng các hàm thuần đã test kỹ
 * ở dưới. Nên kiểm tra bằng cách chạy thử (Run + xem sheet BaoCaoSep) trong Apps Script Editor
 * trước khi cài trigger thật.
 *
 * Chạy: node apps-script/test/test_baoCaoSep.js
 */
const assert = require('assert');
const path = require('path');

const {
  round1_,
  toBaoCaoRowObj_,
  tinhTongQuan_,
  tinhTheoBoPhan_,
  tinhTheoMay_,
  tinhTheoKyThuat_,
  padRow_,
  buildBaoCaoSepValues_,
  BAOCAO_SEP_SO_COT
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

// --- Dữ liệu mẫu: mô phỏng các dòng thô đọc từ sheet BaoCao (mảng 25 cột, index 0-based) ---
// Chỉ cần điền đúng các cột toBaoCaoRowObj_ dùng tới (index 4,5,6,13,14,15,20,22,23), còn lại để trống.
function makeRawRow_({ maMay = '', tenMay = '', boPhan = '', tgDungMay = '', tgSuaChua = '',
  tenKyThuat = '', dapUngTong = '', dapUngSauRanh = '', soLanChongViec = 0 }) {
  const row = new Array(25).fill('');
  row[4] = maMay; row[5] = tenMay; row[6] = boPhan;
  row[13] = tgDungMay; row[14] = tgSuaChua;
  row[15] = tenKyThuat;
  row[20] = dapUngTong; row[22] = dapUngSauRanh; row[23] = soLanChongViec;
  return row;
}

console.log('=== round1_ ===');
test('Làm tròn 1 chữ số thập phân', () => {
  assert.strictEqual(round1_(12.34), 12.3);
  assert.strictEqual(round1_(12.36), 12.4);
  assert.strictEqual(round1_(10), 10);
});

console.log('\n=== tinhTongQuan_ ===');
test('Đếm tổng số lần hỏng + cộng dồn downtime/sửa chữa, bỏ qua ô trống', () => {
  const rows = [
    makeRawRow_({ tgDungMay: 30, tgSuaChua: 20 }),
    makeRawRow_({ tgDungMay: '', tgSuaChua: 15 }), // thiếu "Bắt đầu hư" -> tgDungMay trống (A.6.1)
    makeRawRow_({ tgDungMay: 10, tgSuaChua: 10 })
  ].map(toBaoCaoRowObj_);

  const tq = tinhTongQuan_(rows);
  assert.strictEqual(tq.soLanHong, 3);
  assert.strictEqual(tq.tongDowntime, 40); // 30 + 10, bỏ qua dòng trống
  assert.strictEqual(tq.tongThoiGianSua, 45); // 20 + 15 + 10
});

console.log('\n=== tinhTheoBoPhan_ ===');
test('Gộp theo bộ phận, sắp xếp giảm dần theo tổng downtime', () => {
  const rows = [
    makeRawRow_({ boPhan: 'SOI', tgDungMay: 10, tgSuaChua: 5 }),
    makeRawRow_({ boPhan: 'SOI', tgDungMay: 20, tgSuaChua: 15 }),
    makeRawRow_({ boPhan: 'DET', tgDungMay: 50, tgSuaChua: 40 })
  ].map(toBaoCaoRowObj_);

  const kq = tinhTheoBoPhan_(rows);
  assert.strictEqual(kq.length, 2);
  assert.strictEqual(kq[0].boPhan, 'DET'); // downtime 50 > 30 -> đứng đầu
  assert.strictEqual(kq[0].soLanHong, 1);
  assert.strictEqual(kq[0].tongDowntime, 50);
  assert.strictEqual(kq[1].boPhan, 'SOI');
  assert.strictEqual(kq[1].soLanHong, 2);
  assert.strictEqual(kq[1].tongDowntime, 30);
  assert.strictEqual(kq[1].tongThoiGianSua, 20);
});

console.log('\n=== tinhTheoMay_ ===');
test('Gộp theo mã máy (không theo tên, tránh trùng tên khác mã)', () => {
  const rows = [
    makeRawRow_({ maMay: 'M01', tenMay: 'Máy 1', boPhan: 'SOI', tgDungMay: 10, tgSuaChua: 5 }),
    makeRawRow_({ maMay: 'M01', tenMay: 'Máy 1', boPhan: 'SOI', tgDungMay: 15, tgSuaChua: 5 }),
    makeRawRow_({ maMay: 'M02', tenMay: 'Máy 2', boPhan: 'DET', tgDungMay: 5, tgSuaChua: 5 })
  ].map(toBaoCaoRowObj_);

  const kq = tinhTheoMay_(rows);
  assert.strictEqual(kq.length, 2);
  assert.strictEqual(kq[0].maMay, 'M01');
  assert.strictEqual(kq[0].soLanHong, 2);
  assert.strictEqual(kq[0].tongDowntime, 25);
  assert.strictEqual(kq[1].maMay, 'M02');
});

console.log('\n=== tinhTheoKyThuat_ ===');
test('Tận dụng cột U/W/X Phần A: TB chỉ tính trên các phiếu có số liệu hợp lệ', () => {
  const rows = [
    makeRawRow_({ tenKyThuat: 'Nguyễn Văn A', dapUngTong: 20, dapUngSauRanh: 5, soLanChongViec: 0 }),
    makeRawRow_({ tenKyThuat: 'Nguyễn Văn A', dapUngTong: 40, dapUngSauRanh: 15, soLanChongViec: 1 }),
    // phiếu "THIẾU THỜI GIAN" (Phần A) -> dapUngTong/dapUngSauRanh trống, không tính vào TB
    makeRawRow_({ tenKyThuat: 'Nguyễn Văn A', dapUngTong: '', dapUngSauRanh: '', soLanChongViec: 0 }),
    makeRawRow_({ tenKyThuat: 'Trần Văn B', dapUngTong: 10, dapUngSauRanh: 10, soLanChongViec: 0 }),
    // phiếu chưa nhập người xử lý -> phải bị loại khỏi bảng theo kỹ thuật viên
    makeRawRow_({ tenKyThuat: '', dapUngTong: 999, dapUngSauRanh: 999, soLanChongViec: 5 })
  ].map(toBaoCaoRowObj_);

  const kq = tinhTheoKyThuat_(rows);
  assert.strictEqual(kq.length, 2); // không có dòng tenKyThuat rỗng

  const a = kq.find(k => k.tenKyThuat === 'Nguyễn Văn A');
  assert.strictEqual(a.soViec, 3); // vẫn đếm cả phiếu thiếu thời gian
  assert.strictEqual(a.tbDapUng, 30); // (20+40)/2, bỏ qua phiếu trống
  assert.strictEqual(a.tbDapUngSauRanh, 10); // (5+15)/2
  assert.strictEqual(a.tongChongViec, 1);

  // sắp xếp giảm dần theo số việc -> A (3 việc) phải đứng trước B (1 việc)
  assert.strictEqual(kq[0].tenKyThuat, 'Nguyễn Văn A');
});

console.log('\n=== padRow_ / buildBaoCaoSepValues_ ===');
test('padRow_ luôn trả về đúng độ rộng cố định', () => {
  assert.deepStrictEqual(padRow_(['a', 'b']), ['a', 'b', '', '', '', '']);
  assert.strictEqual(padRow_(['a']).length, BAOCAO_SEP_SO_COT);
});

test('buildBaoCaoSepValues_: mọi dòng đều cùng độ rộng (bắt buộc để setValues 1 lần không lỗi)', () => {
  const tongQuan = { soLanHong: 5, tongDowntime: 100, tongThoiGianSua: 80 };
  const theoBoPhan = [{ boPhan: 'DET', soLanHong: 3, tongDowntime: 70, tongThoiGianSua: 50 }];
  const theoMay = [{ maMay: 'M01', tenMay: 'Máy 1', boPhan: 'DET', soLanHong: 3, tongDowntime: 70, tongThoiGianSua: 50 }];
  const theoKyThuat = [{ tenKyThuat: 'Nguyễn Văn A', soViec: 3, tbDapUng: 25.5, tbDapUngSauRanh: 8, tongChongViec: 1 }];

  const values = buildBaoCaoSepValues_('07/2026', '28/07/2026 10:00', tongQuan, theoBoPhan, theoMay, theoKyThuat);

  assert.ok(values.length > 10);
  values.forEach(row => assert.strictEqual(row.length, BAOCAO_SEP_SO_COT));

  assert.strictEqual(values[0][0], 'BÁO CÁO TỔNG HỢP SỬA CHỮA — THÁNG 07/2026');
  assert.ok(values[1][0].startsWith('⚠️')); // dòng cảnh báo cố định ngay dưới tiêu đề
  assert.strictEqual(values[2][0], 'Cập nhật lúc: 28/07/2026 10:00');

  // Dòng tổng số lần hỏng nằm trong khối TỔNG QUAN
  const dongTongSoLan = values.find(r => r[0] === 'Tổng số lần hỏng');
  assert.strictEqual(dongTongSoLan[1], 5);

  // Dòng dữ liệu "theo bộ phận"
  const dongDet = values.find(r => r[0] === 'DET');
  assert.deepStrictEqual(dongDet, ['DET', 3, 70, 50, '', '']);

  // Dòng dữ liệu "theo máy"
  const dongMay = values.find(r => r[0] === 'M01');
  assert.deepStrictEqual(dongMay, ['M01', 'Máy 1', 'DET', 3, 70, 50]);

  // Dòng dữ liệu "theo kỹ thuật viên"
  const dongKyThuat = values.find(r => r[0] === 'Nguyễn Văn A');
  assert.deepStrictEqual(dongKyThuat, ['Nguyễn Văn A', 3, 25.5, 8, 1, '']);
});

console.log(`\n${passed} test pass.` + (process.exitCode ? ' CÓ TEST FAIL — xem chi tiết ở trên.' : ' Tất cả pass.'));
