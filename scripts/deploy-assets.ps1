param(
    [string]$Region = "eu-central-1",
    [string]$ExpectedAccountId = "603283648663",
    [string]$CloudFrontDomain = "d3r95myjxea18s.cloudfront.net"
)

$ErrorActionPreference = "Stop"

function Fail {
    param([string]$Message)

    Write-Host ""
    Write-Host "DEPLOY FAILED: $Message" -ForegroundColor Red
    exit 1
}

function Run {
    param(
        [string]$Label,
        [scriptblock]$Command
    )

    Write-Host ""
    Write-Host "==> $Label" -ForegroundColor Cyan

    & $Command

    if ($LASTEXITCODE -ne 0) {
        Fail "$Label failed with exit code $LASTEXITCODE."
    }
}

Write-Host ""
Write-Host "Coolcase AWS Asset Deployment" -ForegroundColor White
Write-Host "-----------------------------"

if (-not (Test-Path ".\public\assets")) {
    Fail "public/assets was not found. Run this script from the Coolcase repository root."
}

$AccountId = aws sts get-caller-identity `
    --query "Account" `
    --output text

if ($LASTEXITCODE -ne 0) {
    Fail "Unable to verify AWS identity."
}

if ($AccountId -ne $ExpectedAccountId) {
    Fail "Wrong AWS account. Expected $ExpectedAccountId but AWS CLI is using $AccountId."
}

$Bucket = "coolcase-prod-$AccountId-eu-central-1"

$DistributionId = aws cloudfront list-distributions `
    --query "DistributionList.Items[?DomainName=='$CloudFrontDomain'].Id | [0]" `
    --output text

if (
    $LASTEXITCODE -ne 0 -or
    [string]::IsNullOrWhiteSpace($DistributionId) -or
    $DistributionId -eq "None"
) {
    Fail "CloudFront distribution for $CloudFrontDomain was not found."
}

Write-Host "AWS account:   $AccountId"
Write-Host "Region:        $Region"
Write-Host "Bucket:        $Bucket"
Write-Host "CloudFront:    $CloudFrontDomain"
Write-Host "Distribution:  $DistributionId"

Run "Uploading public/assets to S3" {

    aws s3 sync `
        ".\public\assets" `
        "s3://$Bucket/assets" `
        --region $Region `
        --exclude "references/*" `
        --cache-control "public,max-age=3600,s-maxage=86400"
}

Write-Host ""
Write-Host "==> Creating CloudFront asset invalidation" -ForegroundColor Cyan

$InvalidationId = aws cloudfront create-invalidation `
    --distribution-id $DistributionId `
    --paths "/assets/*" `
    --query "Invalidation.Id" `
    --output text

if ($LASTEXITCODE -ne 0) {
    Fail "Unable to create CloudFront invalidation."
}

Write-Host "Invalidation: $InvalidationId"

Run "Waiting for CloudFront invalidation" {

    aws cloudfront wait invalidation-completed `
        --distribution-id $DistributionId `
        --id $InvalidationId
}

Write-Host ""
Write-Host "==> Testing canonical logo through CloudFront" -ForegroundColor Cyan

$LogoUrl = "https://$CloudFrontDomain/assets/logo/coolcase-logo.png"

try {
    $Response = Invoke-WebRequest `
        $LogoUrl `
        -Method Head `
        -UseBasicParsing

    if ($Response.StatusCode -ne 200) {
        Fail "Logo returned HTTP $($Response.StatusCode)."
    }

    Write-Host "Logo: HTTP 200" -ForegroundColor Green
}
catch {
    Fail "Unable to retrieve $LogoUrl"
}

Write-Host ""
Write-Host "ASSET DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "https://$CloudFrontDomain"
Write-Host ""