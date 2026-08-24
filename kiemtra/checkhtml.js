/**
 * Kiểm file HTML của Apps Script trước khi push. Ba lớp:
 *
 *   1. Scriptlet <? ... ?> nằm trong comment HTML — engine template VẪN dịch,
 *      scriptlet rỗng làm hỏng cả trang và Apps Script báo lỗi ở NHẦM file
 *      (quy về dòng gọi t.evaluate() trong file .gs). Đã dính hai lần.
 *   2. Cú pháp JavaScript trong mọi khối <script>.
 *   3. Mọi getElementById(...) đều trỏ tới id có thật trong HTML.
 *
 * Dùng:  node kiemtra/checkhtml.js bao-tri-v2/Index.html bao-tri-v2/Tho.html ...
 */
const fs = require('fs');
const vm = require('vm');

let loi = 0;

process.argv.slice(2).forEach(function (f) {
  const src = fs.readFileSync(f, 'utf8');

  // --- 1. Scriptlet trong comment ------------------------------------------
  [...src.matchAll(/<!--([\s\S]*?)-->/g)].forEach(function (c) {
    if (/<\?/.test(c[1])) {
      loi++;
      const dong = src.slice(0, c.index).split('\n').length;
      console.log('LỖI  ' + f + ':' + dong +
        ': có scriptlet <? ... ?> trong comment HTML — engine template vẫn dịch, sẽ hỏng trang');
    }
  });

  const sach = src.replace(/<!--[\s\S]*?-->/g, '');

  // --- 2. Cú pháp JavaScript -----------------------------------------------
  const khoi = [...sach.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
  if (!khoi.length) console.log('—    ' + f + ': không có khối <script>');

  khoi.forEach(function (js, i) {
    if (/<\?/.test(js)) {
      console.log('—    ' + f + ' (khối ' + (i + 1) + '): có scriptlet template, bỏ qua kiểm cú pháp');
      return;
    }
    try {
      new vm.Script(js, { filename: f + ' #script' + (i + 1) });
      console.log('OK   ' + f + '  (khối ' + (i + 1) + ', ' + js.split('\n').length + ' dòng)');
    } catch (e) {
      loi++;
      console.log('LỖI  ' + f + ' (khối ' + (i + 1) + '): ' + e.message);
    }
  });

  // --- 3. id được JS gọi tới có tồn tại không ------------------------------
  const idDung = [...sach.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
  const idCo = [...sach.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  [...new Set(idDung)].forEach(function (id) {
    if (idCo.indexOf(id) === -1) {
      loi++;
      console.log('LỖI  ' + f + ': JS gọi getElementById("' + id + '") nhưng HTML không có id đó');
    }
  });
});

console.log(loi ? '\n=> ' + loi + ' lỗi' : '\n=> Sạch.');
process.exit(loi ? 1 : 0);
