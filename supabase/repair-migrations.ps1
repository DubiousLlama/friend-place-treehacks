# Mark migrations as already applied so db push only runs 20260217000000 and 20260217100000.
# Run from repo root: .\supabase\repair-migrations.ps1

$versions = @(
  "20260214000000",
  "20260214100000",
  "20260214200000",
  "20260214300000",
  "20260214400000",
  "20260214410000",
  "20260215000000",
  "20260215100000",
  "20260215110000",
  "20260215200000",
  "20260215210000",
  "20260216000000",
  "20260216110000",
  "20260216120000",
  "20260216130000",
  "20260216135000",
  "20260216140000",
  "20260216150000",
  "20260216160000",
  "20260216170000",
  "20260216180000",
  "20260216190000",
  "20260216200000",
  "20260216210000",
  "20260216220000",
  "20260216230000",
  "20260216240000",
  "20260216250000",
  "20260216260000",
  "20260216260001"
)

foreach ($v in $versions) {
  Write-Host "Repair (mark applied): $v"
  supabase migration repair --status applied $v
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "Repair failed for $v - you may need to run manually."
  }
}

Write-Host ""
Write-Host "Done. Run: supabase db push"
Write-Host "Only 20260217000000_notifications and 20260217100000_group_interests will run."
