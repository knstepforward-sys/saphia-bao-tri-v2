<#
  roi-may.ps1 - Dong bo cuoi phien lam viec, chay TRUOC khi roi may.

  Cap voi dongbo.ps1: dongbo luc ngoi xuong, roi-may luc dung day.

  Chay MOT lenh lam bon viec, hong o dau dung o do:
    1. Chay kiemtra\kiem-tra.ps1. Do thi DUNG, khong commit gi.
    2. Con thay doi chua commit thi hien danh sach, HOI xac nhan, roi commit.
    3. git pull --rebase de nuot phan may kia da day.
    4. git push, roi in ket luan hai may da khop hay chua.

  KHONG bao gio clasp push, KHONG bao gio deploy. Chi lam viec git.
  Khong tu sua mot dong file nao trong repo.

  Cach chay:
    powershell -ExecutionPolicy Bypass -File roi-may.ps1
    powershell -ExecutionPolicy Bypass -File roi-may.ps1 -BoQuaKiemTra   # chi lam git

  Ma thoat: 0 = da day xong, hai may khop. 1 = con viec can nguoi quyet.
            2 = loi moi truong.
#>

param(
  [switch]$BoQuaKiemTra
)

$ErrorActionPreference = 'Continue'

function Tieu($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Xanh($t) { Write-Host $t -ForegroundColor Green }
function Vang($t) { Write-Host $t -ForegroundColor Yellow }
function Do_($t)  { Write-Host $t -ForegroundColor Red }

$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $goc

# ---------------------------------------------------------------- 1. Git repo
Tieu "1. Kiem tra thu muc lam viec"

git rev-parse --is-inside-work-tree > $null 2>&1
if ($LASTEXITCODE -ne 0) {
  Do_ "Thu muc nay khong phai git repo: $goc"
  Do_ "Chay roi-may.ps1 tu trong thu muc repository saphia-bao-tri-v2."
  exit 2
}
Xanh "OK - dang o repo: $goc"

$nhanh = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Nhanh hien tai: $nhanh"

if ($nhanh -eq 'HEAD') {
  Do_ "Dang o trang thai detached HEAD, khong nam tren nhanh nao."
  Do_ "Chuyen ve nhanh truoc: git checkout master"
  exit 1
}

# ---------------------------------------------------------- 2. Bo kiem tra
# Chay TRUOC khi commit. Commit mot ban do roi day len la de may kia keo ve
# dung cai do, va luc do nguoi sua khong con ngoi truoc man hinh nua.
if ($BoQuaKiemTra) {
  Tieu "2. Bo kiem tra"
  Vang "Bo qua theo yeu cau (-BoQuaKiemTra). Chi lam viec git."
} else {
  Tieu "2. Bo kiem tra tinh"

  $ktr = Join-Path $goc "kiemtra\kiem-tra.ps1"
  if (-not (Test-Path $ktr)) {
    Do_ "Khong thay kiemtra\kiem-tra.ps1."
    exit 2
  }

  & powershell -ExecutionPolicy Bypass -File $ktr
  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Do_ "DUNG LAI. Bo kiem tra bao do nen khong commit, khong push."
    Do_ "Sua xong chay lai roi-may.ps1."
    exit 1
  }
  Xanh "OK - bo kiem tra sach"
}

# ------------------------------------------------- 3. Thay doi chua commit
Tieu "3. Thay doi chua commit"

$ban = git status --porcelain
if (-not $ban) {
  Xanh "OK - khong co gi de commit"
} else {
  Write-Host "Cac file se duoc dua vao commit:"
  $ban | ForEach-Object { Write-Host "  $_" }
  Write-Host ""

  # Hoi moi lan, khong tu doan. Day la lan cuoi co nguoi ngoi day de xac nhan.
  $traLoi = Read-Host "Commit nhung file tren? (c = co, k = khong)"
  if ($traLoi -ne 'c') {
    Vang "Khong commit theo yeu cau."
    Do_ "DUNG LAI. Con thay doi chua commit thi khong push, va may kia se khong thay."
    Do_ "Xu ly mot trong hai cach roi chay lai:"
    Do_ "  - Giu lai:  tra loi 'c' o lan chay sau"
    Do_ "  - Bo di:    git checkout -- ."
    exit 1
  }

  $moTa = Read-Host "Mo ta ngan cho commit"
  if (-not $moTa -or $moTa.Trim() -eq '') {
    Do_ "Mo ta rong. DUNG LAI, khong commit."
    Do_ "Mot dong 'wip' hom nay la mot buoi mo mam log tuan sau."
    exit 1
  }

  git add -A
  git commit -m $($moTa.Trim())
  if ($LASTEXITCODE -ne 0) {
    Do_ "git commit that bai. Doc thong bao git in ra o tren."
    exit 1
  }
  Xanh "Da commit."
}

# ------------------------------------------------------- 4. Nuot phan may kia
Tieu "4. Keo phan may kia da day"

# --rebase chu khong phai merge: hai may cung mot nguoi, xep noi tiep de doc
# duoc log, khong sinh merge commit rac moi lan doi may.
git pull --rebase
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Do_ "DUNG LAI. git pull --rebase gap xung dot hoac that bai."
  Do_ "Khong tu bo rebase - de nguyen hien truong cho ban tu go."
  Write-Host ""
  Write-Host "Xem cho nao dang xung dot:"
  Write-Host "  git status"
  Write-Host "Sua xong tung file thi:"
  Write-Host "  git add <file>; git rebase --continue"
  Write-Host "Muon quay ve nhu truoc luc keo:"
  Write-Host "  git rebase --abort"
  Write-Host ""
  Write-Host "Go xong chay lai roi-may.ps1 de day len."
  exit 1
}
Xanh "OK - da nuot phan may kia (neu co)"

# ---------------------------------------------------------------- 5. Day len
Tieu "5. Day len GitHub"

git rev-parse --verify "origin/$nhanh" > $null 2>&1
$coNhanhXa = ($LASTEXITCODE -eq 0)

if (-not $coNhanhXa) {
  Vang "Nhanh '$nhanh' chua co tren GitHub. Lan day nay se tao moi."
  $chuaDay = $null
} else {
  $chuaDay = git log "origin/$nhanh..$nhanh" --oneline 2>$null
}

if ($coNhanhXa -and -not $chuaDay) {
  Xanh "Khong co commit nao chua day."
} elseif ($chuaDay) {
  Write-Host "Cac commit sap day:"
  $chuaDay | ForEach-Object { Write-Host "  $_" }
}

git push -u origin $nhanh
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Do_ "git push that bai."
  Do_ "Neu bao 'not recognized': dang o cua so PowerShell quyen Administrator,"
  Do_ "Git khong nam trong PATH cua no. Mo PowerShell thuong roi chay lai."
  Do_ "Neu bao 'rejected': may kia vua day them, chay lai roi-may.ps1."
  exit 1
}

# ------------------------------------------------------------------ Ket luan
Tieu "Ket luan"

git fetch origin $nhanh > $null 2>&1
$tai  = (git rev-parse HEAD).Trim()
$xa   = (git rev-parse "origin/$nhanh").Trim()
$ban2 = git status --porcelain

if ($tai -eq $xa -and -not $ban2) {
  Xanh "XONG. GitHub da co du phan viec cua may nay."
  Xanh "Ngoi may kia thi chay dongbo.ps1 truoc khi lam gi."
  Write-Host ""
  Vang "Luu y: script nay KHONG dong bo Apps Script Editor."
  Vang "Neu phien nay co clasp push thi ban dang chay da doi, ghi vao NOTES.md."
  exit 0
}

Do_ "CHUA XONG. Sau khi day van con lech:"
if ($tai -ne $xa)  { Do_ "  HEAD tai may $($tai.Substring(0,7)) khac origin/$nhanh $($xa.Substring(0,7))" }
if ($ban2)         { Do_ "  Van con thay doi chua commit:"; $ban2 | ForEach-Object { Write-Host "  $_" } }
Do_ "Dung roi may cho toi khi het lech."
exit 1
