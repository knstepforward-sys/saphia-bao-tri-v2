<#
  dongbo.ps1 - Dong bo dau phien lam viec.

  Chay MOT lenh lam du bon viec:
    1. Kiem tra co thay doi chua commit khong (co thi DUNG, khong tu dong gop).
    2. git pull de lay ban moi nhat tu GitHub.
    3. clasp clone ra thu muc tam, so ma repo voi ban dang chay tren Apps Script.
       So HAI CHIEU: file server co ma repo khong, file khac noi dung, VA file
       repo co ma server chua co.
    4. In ket luan: sach hay lech, lech o dau, ben nao moi hon.

  KHONG bao gio push, KHONG bao gio deploy, KHONG bao gio ghi de file trong repo.
  Chi doc va bao cao.

  Cach chay:
    powershell -ExecutionPolicy Bypass -File dongbo.ps1
    powershell -ExecutionPolicy Bypass -File dongbo.ps1 -BoQuaClasp   # chi lam git

  Ma thoat: 0 = sach, 1 = co lech can xu ly, 2 = loi moi truong.
#>

param(
  [switch]$BoQuaClasp
)

$ErrorActionPreference = 'Continue'

function Tieu($t) { Write-Host ""; Write-Host "=== $t ===" -ForegroundColor Cyan }
function Xanh($t) { Write-Host $t -ForegroundColor Green }
function Vang($t) { Write-Host $t -ForegroundColor Yellow }
function Do_($t)  { Write-Host $t -ForegroundColor Red }

$goc = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $goc

$coLech = $false

# ---------------------------------------------------------------- 1. Git repo
Tieu "1. Kiem tra thu muc lam viec"

git rev-parse --is-inside-work-tree > $null 2>&1
if ($LASTEXITCODE -ne 0) {
  Do_ "Thu muc nay khong phai git repo: $goc"
  Do_ "Mo chat trong thu muc repository saphia-bao-tri-v2, khong phai thu muc cha."
  exit 2
}
Xanh "OK - dang o repo: $goc"

$nhanh = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Nhanh hien tai: $nhanh"

# ------------------------------------------------- 2. Thay doi chua commit
Tieu "2. Thay doi chua commit"

$ban = git status --porcelain
if ($ban) {
  Vang "Co thay doi chua commit tren may nay:"
  $ban | ForEach-Object { Write-Host "  $_" }
  Write-Host ""
  Do_ "DUNG LAI. Khong tu dong git pull khi con thay doi chua luu."
  Do_ "Xu ly mot trong hai cach roi chay lai:"
  Do_ "  - Giu lai:  git add -A; git commit -m 'mo ta'"
  Do_ "  - Bo di:    git checkout -- ."
  exit 1
}
Xanh "OK - khong co thay doi chua commit"

# ------------------------------------------------------------ 3. Keo tu GitHub
Tieu "3. Keo ban moi tu GitHub"

$truoc = (git rev-parse HEAD).Trim()
git pull --ff-only
if ($LASTEXITCODE -ne 0) {
  Do_ "git pull that bai. Co the do lich su hai may da re nhanh."
  Do_ "Xem 'git log --oneline --graph --all' roi quyet dinh giu ban nao."
  exit 1
}
$sau = (git rev-parse HEAD).Trim()

if ($truoc -eq $sau) {
  Xanh "OK - da la ban moi nhat, khong co gi de keo"
} else {
  Xanh "Da cap nhat tu GitHub:"
  git log --oneline "$truoc..$sau" | ForEach-Object { Write-Host "  $_" }
}

if ($BoQuaClasp) {
  Tieu "Ket luan"
  Xanh "Da dong bo voi GitHub. Bo qua buoc so voi Apps Script theo yeu cau."
  exit 0
}

# ---------------------------------------------------- 4. So voi Apps Script
Tieu "4. So ma repo voi ban dang chay tren Apps Script"

$claspFile = Join-Path $goc "bao-tri-v2\.clasp.json"
if (-not (Test-Path $claspFile)) {
  Vang "Thieu bao-tri-v2\.clasp.json tren may nay."
  Vang "File nay chua scriptId nen KHONG nam trong repo. Tao tay theo mau .clasp.json.mau:"
  Vang '  { "scriptId": "<scriptId lay tu Apps Script Editor>", "rootDir": "." }'
  Vang "Bo qua buoc so sanh."
  exit 1
}

$scriptId = (Get-Content $claspFile -Raw | ConvertFrom-Json).scriptId
if (-not $scriptId -or $scriptId -like "DIEN_SCRIPT_ID*") {
  Do_ "scriptId trong .clasp.json chua duoc dien that."
  exit 2
}

$clasp = Get-Command clasp.cmd -ErrorAction SilentlyContinue
if (-not $clasp) {
  Vang "Khong tim thay clasp.cmd. Cai bang: npm install -g @google/clasp"
  Vang "Luu y goi clasp.cmd chu khong phai clasp - PowerShell chan file .ps1."
  exit 2
}

$tam = Join-Path $env:TEMP ("dongbo-" + [guid]::NewGuid().ToString("N").Substring(0,8))
New-Item -ItemType Directory -Force $tam | Out-Null

Write-Host "Tai ban dang chay ve thu muc tam..."
Push-Location $tam
& clasp.cmd clone $scriptId 2>&1 | Out-Null
$maLoi = $LASTEXITCODE
Pop-Location

if ($maLoi -ne 0 -or -not (Get-ChildItem $tam -Filter "*.js" -ErrorAction SilentlyContinue)) {
  Do_ "Khong tai duoc ma tu Apps Script."
  Do_ "Kiem tra da dang nhap chua: clasp.cmd login"
  Remove-Item -Recurse -Force $tam -ErrorAction SilentlyContinue
  exit 2
}

$repoDir = Join-Path $goc "bao-tri-v2"
$khac = @()
$chiTrenServer = @()
$chiTrongRepo = @()
$tenTrenServer = @{}

Get-ChildItem $tam -File | Where-Object { $_.Name -ne ".clasp.json" } | ForEach-Object {
  $ten = $_.Name
  if ($ten -like "*.js") { $tenRepo = ($ten -replace '\.js$', '.gs') } else { $tenRepo = $ten }
  $duong = Join-Path $repoDir $tenRepo

  $tenTrenServer[$tenRepo] = $true

  if (-not (Test-Path $duong)) {
    $chiTrenServer += $tenRepo
    return
  }

  $a = (Get-Content $_.FullName -Raw -Encoding UTF8) -replace "`r`n", "`n"
  $b = (Get-Content $duong    -Raw -Encoding UTF8) -replace "`r`n", "`n"
  if ($a.TrimEnd() -ne $b.TrimEnd()) {
    $dongServer = ($a -split "`n").Count
    $dongRepo   = ($b -split "`n").Count
    $khac += [pscustomobject]@{ File = $tenRepo; Server = $dongServer; Repo = $dongRepo }
  }
}

Remove-Item -Recurse -Force $tam -ErrorAction SilentlyContinue

# Duyet nguoc: file co trong repo ma Apps Script chua co. Vong tren chi di tu
# server sang repo nen file MOI trong repo khong bao gio hien ra - dung cai file
# dang can nhin nhat lai la cai bi bo qua im lang. Da tra gia mot lan: ThongBao.gs
# 826 dong vang mat hoan toan trong ban doi chieu ngay 10/09/2026.
# Chi xet dung nhung duoi ma clasp day len: .gs, .html, appsscript.json.
Get-ChildItem $repoDir -File | Where-Object {
  ($_.Extension -in @('.gs', '.html')) -or ($_.Name -eq 'appsscript.json')
} | ForEach-Object {
  if (-not $tenTrenServer.ContainsKey($_.Name)) {
    $soDong = (Get-Content $_.FullName | Measure-Object -Line).Lines
    $chiTrongRepo += [pscustomobject]@{ File = $_.Name; Dong = $soDong }
  }
}

if ($chiTrenServer.Count -eq 0 -and $khac.Count -eq 0 -and $chiTrongRepo.Count -eq 0) {
  Xanh "OK - repo khop hoan toan voi ban dang chay tren Apps Script"
} else {
  $coLech = $true
  if ($chiTrenServer.Count -gt 0) {
    Vang "File co tren Apps Script nhung khong co trong repo:"
    $chiTrenServer | ForEach-Object { Write-Host "  $_" }
  }
  if ($chiTrongRepo.Count -gt 0) {
    Vang "File co trong repo nhung CHUA co tren Apps Script:"
    $chiTrongRepo | ForEach-Object {
      Write-Host ("  {0,-22} {1} dong, chua bao gio duoc clasp push" -f $_.File, $_.Dong)
    }
  }
  if ($khac.Count -gt 0) {
    Vang "File khac noi dung (so dong):"
    $khac | ForEach-Object {
      $chenh = $_.Server - $_.Repo
      if ($chenh -gt 0) { $ghi = "Apps Script nhieu hon $chenh dong" }
      elseif ($chenh -lt 0) { $ghi = "repo nhieu hon $(-$chenh) dong" }
      else { $ghi = "cung so dong, khac noi dung" }
      Write-Host ("  {0,-22} server={1,-6} repo={2,-6} {3}" -f $_.File, $_.Server, $_.Repo, $ghi)
    }
  }
}

# ------------------------------------------------------------------ Ket luan
Tieu "Ket luan"

if (-not $coLech) {
  Xanh "SACH. Repo khop GitHub va khop Apps Script. Bat dau lam viec duoc."
  exit 0
}

Do_ "CO LECH giua repo va ban dang chay tren Apps Script."
Do_ "DUNG push de len truoc khi biet ben nao moi hon."
Write-Host ""
Write-Host "Neu Apps Script moi hon (co nguoi sua thang tren Editor):"
Write-Host "  keo ve repo truoc, roi commit, roi moi lam viec tiep."
Write-Host "Neu repo moi hon (may kia da sua va push):"
Write-Host "  day len bang clasp.cmd push --force, nhung phai duoc chu du an xac nhan."
exit 1
