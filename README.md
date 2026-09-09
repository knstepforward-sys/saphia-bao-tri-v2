# SAPHIA — Hệ thống Bảo trì

Repository riêng cho hai ứng dụng Google Apps Script thuộc nghiệp vụ bảo trì:

- `bao-tri-v2/`: Bảo trì Toàn nhà máy v2, đang phục vụ hệ thống QR trên máy.
- `apps-script/`: ứng dụng SAPHIA nhập nhanh báo cáo sửa chữa BM01/QTSCBT-05.
- `kiemtra/`: bộ kiểm tra tĩnh dùng trước khi đẩy Bảo trì v2 lên Apps Script.

Hai ứng dụng dùng Spreadsheet và Apps Script project khác nhau. Đọc `CLAUDE.md` và
`bao-tri-v2/CLAUDE.md` trước khi chỉnh sửa.

## Bắt đầu mỗi phiên làm việc

```powershell
powershell -ExecutionPolicy Bypass -File dongbo.ps1
```

Script kiểm tra thay đổi chưa commit, `git pull`, rồi so mã trong repo với bản đang chạy
trên Apps Script. Chỉ đọc và báo cáo; không push, không deploy, không ghi đè file.

Mã nguồn tồn tại ở **bốn nơi**: máy công ty, laptop cá nhân, GitHub, Apps Script Editor.
Trước khi rời một máy phải commit và push, nếu không lần sau ngồi máy kia sẽ lệch.

## Cài đặt trên một máy Windows mới

1. **Git** và **Node.js** (bản LTS).
2. **GitHub CLI** rồi đăng nhập tài khoản sở hữu repository:
   ```powershell
   winget install --id GitHub.cli
   ```
   Mở cửa sổ PowerShell **mới** (để nạp lại PATH) rồi chạy `gh auth login`.
   Nếu máy đã lưu sẵn tài khoản GitHub khác, `git clone` sẽ im lặng báo
   *Repository not found* mà không hiện cửa sổ đăng nhập. Kiểm tra bằng
   `cmdkey /list` và tìm dòng `git:https://github.com`.
3. **Clone repository:**
   ```powershell
   gh repo clone knstepforward-sys/saphia-bao-tri-v2
   ```
4. **clasp:**
   ```powershell
   npm install -g @google/clasp
   clasp.cmd login
   ```
   Gọi `clasp.cmd`, **không** gọi `clasp`. PowerShell chặn file `clasp.ps1` với lỗi
   *running scripts is disabled*; đừng hạ ExecutionPolicy của máy chỉ để chạy một lệnh.
5. **Tạo `bao-tri-v2/.clasp.json`** — file này chứa scriptId nên không nằm trong
   repository. Chép `.clasp.json.mau`, điền scriptId lấy từ Apps Script Editor
   (Cài đặt dự án → ID tập lệnh):
   ```json
   { "scriptId": "<scriptId>", "rootDir": "." }
   ```
6. Chạy `dongbo.ps1` để xác nhận mọi thứ thông.

Đặt danh tính git cho riêng repository này, không dùng `--global`:

```powershell
git config user.name "knstepforward-sys"
git config user.email "noreply@users.noreply.github.com"
```

## Phân quyền cho Claude Code

`.claude/settings.json` nằm trong repository nên máy nào clone về cũng có. Nó cho phép
sẵn các lệnh chỉ đọc và lệnh đồng bộ để khỏi bị hỏi giữa chừng, đồng thời **chặn**
`clasp push`, `clasp deploy` và `git push`. Ba lệnh đó phải do chủ dự án xác nhận
từng lần.

## Quy tắc triển khai

- GitHub chỉ lưu lịch sử mã nguồn; push GitHub không làm thay đổi ứng dụng đang chạy.
- Muốn cập nhật Apps Script Editor phải chạy `clasp push` trong đúng thư mục ứng dụng.
- Muốn cập nhật web app thật phải deploy lại đúng deployment ID hiện có; không tạo URL mới.
- Không commit `.clasp.json`, `.clasprc.json`, token, mật khẩu hoặc thông tin tài khoản.
- Sau mỗi thay đổi, cập nhật mục mới ở đầu `NOTES.md` và chạy bộ kiểm tra phù hợp.

Trang wrapper GitHub Pages vẫn nằm trong repository triển khai riêng `baocao-saphia` để
không làm thay đổi các đường dẫn QR đã phát hành.
