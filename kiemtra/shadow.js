/**
 * Dò lỗi "biến khai trong thân hàm trùng tên tham số".
 *
 * node --check KHÔNG bắt được vì cú pháp hợp lệ, nhưng chạy thật sẽ văng
 * "Cannot access 'X' before initialization" — biến const/let trong khối try che
 * mất tham số cùng tên trên TOÀN BỘ khối, kể cả những dòng phía trên nó.
 *
 * Lỗi này đã xảy ra thật một lần ở acceptIncident (tham số maTho).
 *
 * Dùng:  node kiemtra/shadow.js bao-tri-v2
 */
const fs = require('fs');
const path = require('path');

const dir = process.argv[2];
let loi = 0;

fs.readdirSync(dir).filter(f => f.endsWith('.gs')).forEach(function (f) {
  const src = fs.readFileSync(path.join(dir, f), 'utf8');
  const dong = src.split(/\r?\n/);

  let ham = null;
  dong.forEach(function (line, i) {
    const m = line.match(/^function\s+([A-Za-z0-9_$]+)\s*\(([^)]*)\)/);
    if (m) {
      ham = {
        ten: m[1],
        params: m[2].split(',').map(s => s.trim()).filter(Boolean),
        dongBatDau: i + 1,
      };
      return;
    }
    if (!ham || !ham.params.length) return;

    const d = line.match(/^\s*(?:const|let)\s+([A-Za-z0-9_$]+)\s*=/);
    if (d && ham.params.indexOf(d[1]) !== -1) {
      loi++;
      console.log('✗ ' + f + ':' + (i + 1) + '  hàm ' + ham.ten +
        '() khai lại tham số "' + d[1] + '"');
      console.log('   ' + line.trim());
    }
  });
});

console.log(loi ? '\n=> ' + loi + ' chỗ cần sửa' : '=> Không có chỗ nào che tham số.');
process.exit(loi ? 1 : 0);
