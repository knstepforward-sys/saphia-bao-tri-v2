/**
 * Quét cả repository tìm token bot Telegram bị dán nhầm vào mã nguồn — rào 5.13.
 *
 * Token cất trong Script Properties, KHÔNG bao giờ nằm trong repository. Ai cầm
 * được token là nhắn tin được dưới danh nghĩa bot cho toàn bộ thợ, và repository
 * này có thể được clone sang máy khác. Rào tự động, không dựa vào trí nhớ người
 * viết mã: dán nhầm một lần là bị chặn ngay ở lần push kế tiếp.
 *
 * Cố ý chạy TRƯỚC mọi lớp kiểm thử khác. Đây không phải phép thử đúng sai, mà là
 * một cái chốt cửa — có token lọt ra thì mọi thứ khác xanh cũng vô nghĩa.
 *
 * Dùng:  node kiemtra/token.js <thư mục gốc repository>
 */
const fs = require('fs');
const path = require('path');

const goc = process.argv[2] || '.';

// Token @BotFather cấp có dạng <id bot>:<chuỗi bí mật>, ví dụ hình dạng chung là
// 10 chữ số, dấu hai chấm, rồi 35 ký tự chữ số và gạch. Nới rộng hai đầu để bắt
// được cả token cũ lẫn token mới.
const MAU = /\b\d{6,12}:[A-Za-z0-9_-]{30,45}\b/;

const DUOI = ['.gs', '.html', '.js', '.json', '.md', '.ps1', '.txt'];
const BO_QUA = ['.git', 'node_modules'];

// File này chứa chính cái mẫu nhận dạng nên tự soi mình là đỏ oan.
const TU_BO_QUA = path.resolve(__filename);

const loi = [];
let soFile = 0;

function quet(thuMuc) {
  let ds;
  try {
    ds = fs.readdirSync(thuMuc, { withFileTypes: true });
  } catch (e) {
    return;
  }
  ds.forEach(function (m) {
    const duong = path.join(thuMuc, m.name);
    if (m.isDirectory()) {
      if (BO_QUA.indexOf(m.name) < 0) quet(duong);
      return;
    }
    if (DUOI.indexOf(path.extname(m.name)) < 0) return;
    if (path.resolve(duong) === TU_BO_QUA) return;

    soFile++;
    let noiDung;
    try {
      noiDung = fs.readFileSync(duong, 'utf8');
    } catch (e) {
      return;
    }
    noiDung.split(/\r?\n/).forEach(function (dong, i) {
      if (!MAU.test(dong)) return;
      // Cố ý KHÔNG in ra token tìm được. In ra là chép nó thêm một lần nữa, lần
      // này vào nhật ký chạy lệnh và vào cả log của máy chủ CI nếu có.
      loi.push('  ' + duong + ':' + (i + 1) + '  — dòng này chứa chuỗi trông như token bot');
    });
  });
}

quet(goc);

if (loi.length) {
  console.log('CO TOKEN LOT VAO MA NGUON:');
  loi.forEach(function (x) { console.log(x); });
  console.log('\n=> ' + loi.length + ' chỗ. Gỡ hết rồi mới push.');
  console.log('   Token phải nằm trong Script Properties, khoá TELEGRAM_BOT_TOKEN.');
  console.log('   Token đã lọt ra ngoài thì coi như lộ: nhắn @BotFather lệnh');
  console.log('   /revoke để huỷ token cũ và lấy token mới, đừng chỉ xoá dòng đó đi.');
  process.exit(1);
}

console.log('=> Sạch, không có token trong ' + soFile + ' file mã nguồn.');
process.exit(0);
