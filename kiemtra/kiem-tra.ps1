# =============================================================================
# Chạy toàn bộ kiểm tra tĩnh cho bao-tri-v2 trước khi push lên Apps Script.
#
#   Cách chạy:   powershell -File kiemtra\kiem-tra.ps1
#   Hoặc:        .\kiemtra\kiem-tra.ps1
#
# Thoát mã 0 = sạch, an toàn để push.
# Thoát mã 1 = có lỗi, KHÔNG push.
#
# Chốt 0 không phải phép thử đúng sai mà là một cái chốt cửa: có token bot lọt vào
# mã nguồn thì mọi thứ khác xanh cũng vô nghĩa, nên nó chạy trước.
#
# Ba lớp đầu chỉ bắt lỗi TĨNH; lớp 4, 5 và 6 chạy thẳng phép thử vì ba nhóm hàm
# đó là hàm thuần — chỉ nhận mảng, chuỗi và Date. Lớp thứ bảy — logic nghiệp vụ
# còn lại — nằm trong Sheet: menu 🔧 Bảo trì → 🧪 Chạy test logic, chạy bằng dữ
# liệu giả.
# =============================================================================

$ErrorActionPreference = 'Stop'
$goc = Split-Path -Parent $PSScriptRoot
$duAn = Join-Path $goc 'bao-tri-v2'
$tmp = Join-Path $env:TEMP 'kiemtra-gs'
New-Item -ItemType Directory -Force $tmp | Out-Null

$ok = $true

# --- Chốt 0: token bot lọt vào mã nguồn --------------------------------------
# Rào 5.13 của TASK_THONG_BAO_TELEGRAM.md. Token nằm trong Script Properties,
# không bao giờ trong repository — ai cầm được là nhắn tin được dưới danh nghĩa
# bot cho toàn bộ thợ. Quét cả repository chứ không riêng thư mục clasp.
Write-Output "=== 0. Token bot lot vao ma nguon ==="
node (Join-Path $PSScriptRoot 'token.js') $goc
if ($LASTEXITCODE -ne 0) { $ok = $false }

# --- Lớp 1: cú pháp từng file .gs -------------------------------------------
# node --check cần đuôi .js nên chép sang thư mục tạm trước.
Write-Output "`n=== 1. Cu phap cac file .gs ==="
foreach ($f in Get-ChildItem -Path $duAn -Filter *.gs) {
  $dich = Join-Path $tmp "$($f.BaseName).js"
  Copy-Item $f.FullName $dich -Force
  node --check $dich
  if ($LASTEXITCODE -ne 0) { $ok = $false; Write-Output "  LOI: $($f.Name)" }
}
if ($ok) { Write-Output "  OK - khong loi cu phap" }

# --- Lớp 2: biến che tham số -------------------------------------------------
Write-Output "`n=== 2. Bien che tham so ==="
node (Join-Path $PSScriptRoot 'shadow.js') $duAn
if ($LASTEXITCODE -ne 0) { $ok = $false }

# --- Lớp 3: HTML -------------------------------------------------------------
Write-Output "`n=== 3. HTML (scriptlet trong comment, cu phap JS, id) ==="
$html = Get-ChildItem -Path $duAn -Filter *.html | ForEach-Object { $_.FullName }
$thuMucWrapper = Join-Path $goc 'baocao-saphia'
if (Test-Path -LiteralPath $thuMucWrapper) {
  $html += Get-ChildItem -LiteralPath $thuMucWrapper -Filter *.html |
    ForEach-Object { $_.FullName }
}
node (Join-Path $PSScriptRoot 'checkhtml.js') @html
if ($LASTEXITCODE -ne 0) { $ok = $false }

# --- Lớp 4: số học KPI đáp ứng thợ -------------------------------------------
# Nhóm hàm KPI là hàm THUẦN nên chạy thẳng được ở đây, không phải đợi bấm menu
# trong Sheet như phần còn lại của Test.gs.
Write-Output "`n=== 4. So hoc KPI dap ung tho ==="
node (Join-Path $PSScriptRoot 'kpi-tho.js') $duAn
if ($LASTEXITCODE -ne 0) { $ok = $false }

# --- Lớp 5: nội dung tin Telegram --------------------------------------------
# Ba hàm soạn tin trong ThongBao.gs cố ý tách khỏi phần gửi và không dùng cả
# Utilities, nên chạy được ở đây. Lớp này cũng canh luôn ranh giới đó: có ai kéo
# UrlFetchApp hay SpreadsheetApp vào nhóm hàm soạn tin là đỏ ngay.
Write-Output "`n=== 5. Noi dung tin Telegram ==="
node (Join-Path $PSScriptRoot 'thongbao.js') $duAn
if ($LASTEXITCODE -ne 0) { $ok = $false }

# --- Lớp 6: phép đếm lần lỗi đáp ứng -----------------------------------------
# Nhóm hàm trong LoiDapUng.gs cố ý KHÔNG gọi SpreadsheetApp/Utilities, nên chạy
# thẳng được ở đây. Lớp này canh luôn ranh giới đó: kéo một lời gọi dịch vụ vào
# file kia là đỏ ngay, kèm lời giải thích.
#
# Phần đối chiếu với báo cáo tay tháng 8/2026 tự bật khi hai file
# kiemtra\mau\kpi-t8-nguon.json và kpi-t8-mongdoi.json có mặt. Thiếu chúng thì
# lớp vẫn xanh — bộ mẫu tự dựng đã phủ đủ nhánh — nhưng script in cảnh báo to
# rằng các con số của tháng 8 thật CHƯA ai kiểm.
Write-Output "`n=== 6. Phep dem lan loi dap ung ==="
node (Join-Path $PSScriptRoot 'loi-dap-ung.js') $duAn
if ($LASTEXITCODE -ne 0) { $ok = $false }

# --- Kết luận ----------------------------------------------------------------
Write-Output ""
if ($ok) {
  Write-Output "===> SACH. An toan de push."
  Write-Output "     cd bao-tri-v2"
  Write-Output "     clasp push --force"
  Write-Output "     clasp deploy --deploymentId <ID trong CLAUDE.md> --description ""..."""
  exit 0
} else {
  Write-Output "===> CO LOI. Sua xong roi chay lai, DUNG push."
  exit 1
}
