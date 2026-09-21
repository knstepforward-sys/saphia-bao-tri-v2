<#
  day-len.ps1 - Day ma len Apps Script (clasp push) va deploy vao DUNG deployment ID cu.

  Tai sao co file nay: CLAUDE.md cam clasp push / clasp deploy tu y. Lenh clasp tran van
  bi chan trong .claude\settings.json. File nay la DUONG DUY NHAT duoc phep, va chi chay
  sau khi chu du an xac nhan trong chat tung lan (settings.json dat o muc "hoi lai").

  Hai buoc, cach nhau boi buoc THU TREN DIEN THOAI:

    -Buoc Push     Kiem tra, roi clasp push. Chua doi link /exec cua ai.
                   Sau buoc nay, "Trien khai thu nghiem" (link /dev) chay ma moi -
                   thu nut bam tren dien thoai bang link do, va menu Test trong Sheet.
    -Buoc Deploy   Chi chay khi da them -DaThuTrenDienThoai. Deploy vao deployment ID
                   da luu, roi kiem tra ID + URL /exec van y nguyen.

  Deployment ID KHONG hardcode (repo cong khai). Luu o bao-tri-v2\.deployment-id
  (mot dong, khong dua len kho - da co trong .gitignore). Lay ID bang:
      cd bao-tri-v2 ; clasp.cmd deployments
  Chon dong web app dang phuc vu QR (khong phai @HEAD).

  Khong nhan deployment ID qua tham so, khong bao gio tao "Ban trien khai moi".

  Cach chay:
    powershell -ExecutionPolicy Bypass -File day-len.ps1 -Buoc Push
    powershell -ExecutionPolicy Bypass -File day-len.ps1 -Buoc Deploy -DaThuTrenDienThoai [-MoTa "..."]

  Ma thoat: 0 = xong. 1 = con viec can nguoi quyet. 2 = thieu moi truong.
#>

param(
  [Parameter(Mandatory = $true)][ValidateSet('Push', 'Deploy')][string]$Buoc,
  [switch]$DaThuTrenDienThoai,
  [string]$MoTa = ''
)

$ErrorActionPreference = 'Continue'

function Tieu($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Xanh($t) { Write-Host $t -ForegroundColor Green }
function Vang($t) { Write-Host $t -ForegroundColor Yellow }
function Do_($t)  { Write-Host $t -ForegroundColor Red }

$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $goc
$duAn = Join-Path $goc 'bao-tri-v2'
$fileId = Join-Path $duAn '.deployment-id'
$fileDau = Join-Path $duAn '.da-clasp-push'

# ---------------------------------------------------------- 1. Moi truong
Tieu "1. Moi truong"

git rev-parse --is-inside-work-tree > $null 2>&1
if ($LASTEXITCODE -ne 0) { Do_ "Khong phai git repo: $goc"; exit 2 }

if (-not (Test-Path (Join-Path $duAn '.clasp.json'))) {
  Do_ "Thieu bao-tri-v2\.clasp.json (chua scriptId, khong nam trong repo). Tao theo .clasp.json.mau."
  exit 2
}
if (-not (Get-Command clasp.cmd -ErrorAction SilentlyContinue)) {
  Do_ "Khong thay clasp.cmd. Cai: npm install -g @google/clasp. Luu y goi clasp.cmd, khong phai clasp."
  exit 2
}
if (-not (Test-Path $fileId)) {
  Do_ "Thieu bao-tri-v2\.deployment-id."
  Vang "Tao file mot dong chua deployment ID cua web app dang phuc vu QR:"
  Vang "  cd bao-tri-v2 ; clasp.cmd deployments      (chon dong web app, KHONG chon @HEAD)"
  exit 2
}
$id = (Get-Content $fileId -Raw).Trim()
if ($id -notmatch '^AKfy[A-Za-z0-9_-]{20,}$') {
  Do_ "Noi dung .deployment-id khong giong mot deployment ID (phai bat dau bang AKfy...)."
  exit 2
}
Xanh "OK - co .clasp.json, clasp.cmd, deployment ID (da luu)."

# ------------------------------------------- 2. Git phai sach va khop GitHub
Tieu "2. Ma tren may phai khop GitHub"

$nhanh = (git rev-parse --abbrev-ref HEAD).Trim()
$ban = git status --porcelain --untracked-files=no
if ($ban) {
  Do_ "Con thay doi chua commit trong file da theo doi:"
  $ban | ForEach-Object { Write-Host "  $_" }
  Do_ "DUNG LAI. Commit + push GitHub truoc: ma chay that phai co ban luu tren GitHub."
  exit 1
}
git fetch origin 2>$null
$head = (git rev-parse HEAD).Trim()
$goc2 = (git rev-parse "origin/$nhanh" 2>$null)
if (-not $goc2 -or $head -ne $goc2.Trim()) {
  Do_ "HEAD chua khop origin/$nhanh. Push (hoac pull) GitHub truoc."
  exit 1
}
Xanh "OK - sach, HEAD = origin/$nhanh = $($head.Substring(0,7))"

# ------------------------------------------------------ 3. Bo kiem tra tinh
Tieu "3. Bo kiem tra tinh"
& powershell -ExecutionPolicy Bypass -File (Join-Path $goc 'kiemtra\kiem-tra.ps1')
if ($LASTEXITCODE -ne 0) { Do_ "DUNG LAI. Bo kiem tra bao do."; exit 1 }
Xanh "OK - bo kiem tra sach"

Set-Location $duAn

function LayDanhSachDeploy {
  $o = & clasp.cmd deployments 2>&1 | Out-String
  return $o
}
function DemDeploy($o) { return ([regex]::Matches($o, '(?m)^\s*-\s+AKfy')).Count }

# ================================================================== PUSH
if ($Buoc -eq 'Push') {
  Tieu "4. clasp push"
  & clasp.cmd push --force
  if ($LASTEXITCODE -ne 0) {
    Do_ "clasp push that bai. Doc thong bao o tren (da clasp.cmd login chua?)."
    exit 1
  }
  Set-Content -Path $fileDau -Value $head -Encoding ASCII
  Xanh "Da clasp push. Link /exec cua QR CHUA doi (van chay ban da deploy truoc do)."
  Write-Host ""
  Vang "TRUOC KHI DEPLOY - phai thu tren ban that:"
  Vang "  1. Mo Sheet, menu Bao tri > 'Chay test logic' - ket qua phai xanh, khong do."
  Vang "  2. Apps Script Editor > Deploy > Test deployments: mo link /dev tren DIEN THOAI,"
  Vang "     thu cac nut vua sua (khong dung link QR that)."
  Vang "  3. On roi moi noi voi Claude: 'da thu xong', de chay -Buoc Deploy."
  exit 0
}

# ================================================================ DEPLOY
Tieu "4. Dieu kien deploy"
if (-not $DaThuTrenDienThoai) {
  Do_ "Chua co -DaThuTrenDienThoai. Deploy dua ma len cho MAY DANG SAN XUAT dung ngay."
  Do_ "Thu xong tren dien thoai (link /dev) va menu Test trong Sheet roi moi chay lai kem co nay."
  exit 1
}
if (-not (Test-Path $fileDau) -or (Get-Content $fileDau -Raw).Trim() -ne $head) {
  Do_ "Ma hien tai chua duoc clasp push (hoac da doi sau lan push cuoi)."
  Do_ "Chay -Buoc Push truoc, thu lai, roi deploy."
  exit 1
}
$truoc = LayDanhSachDeploy
if ($truoc -notmatch [regex]::Escape($id)) {
  Do_ "Deployment ID luu trong .deployment-id khong con trong danh sach clasp deployments."
  Do_ "DUNG LAI - khong deploy vao ID la."
  exit 1
}
$soTruoc = DemDeploy $truoc
Xanh "OK - ID co trong danh sach ($soTruoc deployment)."

Tieu "5. clasp deploy (vao dung ID cu)"
if (-not $MoTa.Trim()) { $MoTa = (git log -1 --pretty=%s).Trim() }
& clasp.cmd deploy --deploymentId $id --description $MoTa
if ($LASTEXITCODE -ne 0) { Do_ "clasp deploy that bai. Doc thong bao o tren."; exit 1 }

Tieu "6. Kiem tra link khong doi"
$sau = LayDanhSachDeploy
$soSau = DemDeploy $sau
if ($sau -notmatch [regex]::Escape($id)) {
  Do_ "CANH BAO: deployment ID khong con trong danh sach sau khi deploy. Kiem tra ngay tren Apps Script."
  exit 1
}
if ($soSau -ne $soTruoc) {
  Do_ "CANH BAO: so deployment doi tu $soTruoc thanh $soSau - co the vua sinh ban trien khai moi (doi link)."
  Do_ "Kiem tra Deploy > Manage deployments va bao chu du an ngay."
  exit 1
}
Xanh "OK - ID va so deployment van nguyen ($soSau). Link /exec khong doi, QR khong phai in lai."
Remove-Item $fileDau -ErrorAction SilentlyContinue
exit 0
