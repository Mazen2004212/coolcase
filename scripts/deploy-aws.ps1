param(
    [string]$Region = "eu-central-1",
    [string]$ExpectedAccountId = "603283648663",
    [string]$CloudFrontDomain = "d3r95myjxea18s.cloudfront.net",
    [string]$FunctionName = "coolcase-web",
    [string]$EcrRepository = "coolcase-web"
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

function Test-WebStatus {
    param(
        [string]$Url,
        [int]$Expected = 200
    )

    try {
        $Response = Invoke-WebRequest `
            $Url `
            -UseBasicParsing

        if ($Response.StatusCode -ne $Expected) {
            Fail "$Url returned HTTP $($Response.StatusCode), expected $Expected."
        }

        Write-Host "HTTP $($Response.StatusCode) $Url" -ForegroundColor Green
        return $Response
    }
    catch {
        Fail "Request failed: $Url - $($_.Exception.Message)"
    }
}

function Test-StaticFiles {
    param(
        [string]$Route
    )

    Write-Host ""
    Write-Host "==> Verifying static chunks for $Route" -ForegroundColor Cyan

    try {
        $Html = (
            Invoke-WebRequest `
                "https://$CloudFrontDomain$Route" `
                -UseBasicParsing
        ).Content
    }
    catch {
        Fail "Unable to load https://$CloudFrontDomain$Route"
    }

    $CssPaths = [regex]::Matches(
        $Html,
        'href="([^"]+\.css[^"]*)"'
    ) | ForEach-Object {
        $_.Groups[1].Value
    } | Select-Object -Unique

    foreach ($CssPath in $CssPaths) {

        try {
            $Response = Invoke-WebRequest `
                "https://$CloudFrontDomain$CssPath" `
                -Method Head `
                -UseBasicParsing

            if ($Response.StatusCode -ne 200) {
                Fail "CSS returned HTTP $($Response.StatusCode): $CssPath"
            }

            Write-Host "CSS 200 $CssPath"
        }
        catch {
            Fail "CSS chunk failed: $CssPath"
        }
    }

    $JsPaths = [regex]::Matches(
        $Html,
        'src="([^"]+\.js[^"]*)"'
    ) | ForEach-Object {
        $_.Groups[1].Value
    } | Select-Object -Unique

    foreach ($JsPath in $JsPaths) {

        try {
            $Response = Invoke-WebRequest `
                "https://$CloudFrontDomain$JsPath" `
                -Method Head `
                -UseBasicParsing

            if ($Response.StatusCode -ne 200) {
                Fail "JS returned HTTP $($Response.StatusCode): $JsPath"
            }

            Write-Host "JS  200 $JsPath"
        }
        catch {
            Fail "JS chunk failed: $JsPath"
        }
    }
}


Write-Host ""
Write-Host "Coolcase AWS Production Deployment" -ForegroundColor White
Write-Host "----------------------------------"

if (-not (Test-Path ".\package.json")) {
    Fail "package.json was not found. Run from the Coolcase repository root."
}

if (-not (Test-Path ".\Dockerfile.aws")) {
    Fail "Dockerfile.aws was not found."
}

if (-not (Test-Path ".\.env.local")) {
    Fail ".env.local was not found."
}


# ------------------------------------------------------------
# AWS identity
# ------------------------------------------------------------

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
$Registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$ProductionUrl = "https://$CloudFrontDomain"


# ------------------------------------------------------------
# Git / build identifiers
# ------------------------------------------------------------

$GitSha = git rev-parse --short HEAD

if ($LASTEXITCODE -ne 0) {
    Fail "Unable to read Git commit."
}

$DirtyFiles = git status --porcelain

if ($DirtyFiles) {
    Write-Host ""
    Write-Host "WARNING: deploying uncommitted local changes." -ForegroundColor Yellow
    $GitLabel = "$GitSha-dirty"
}
else {
    $GitLabel = $GitSha
}

$Timestamp = Get-Date -Format "yyyyMMddHHmmss"

$BuildId = "prod-$GitLabel-$Timestamp"
$ImageTag = "prod-$GitLabel-$Timestamp"
$LocalImage = "coolcase:production-$Timestamp"


# ------------------------------------------------------------
# CloudFront
# ------------------------------------------------------------

$DistributionId = aws cloudfront list-distributions `
    --query "DistributionList.Items[?DomainName=='$CloudFrontDomain'].Id | [0]" `
    --output text

if (
    $LASTEXITCODE -ne 0 -or
    [string]::IsNullOrWhiteSpace($DistributionId) -or
    $DistributionId -eq "None"
) {
    Fail "CloudFront distribution was not found."
}


Write-Host ""
Write-Host "AWS account:      $AccountId"
Write-Host "Region:           $Region"
Write-Host "Bucket:           $Bucket"
Write-Host "Registry:         $Registry"
Write-Host "CloudFront:       $CloudFrontDomain"
Write-Host "Distribution:     $DistributionId"
Write-Host "Git:              $GitLabel"
Write-Host "Build ID:         $BuildId"
Write-Host "ECR tag:          $ImageTag"


# ------------------------------------------------------------
# Verify Docker
# ------------------------------------------------------------

Run "Checking Docker engine" {
    docker version
}


# ------------------------------------------------------------
# Code quality
# ------------------------------------------------------------

Run "TypeScript" {
    npm run typecheck
}

Run "ESLint" {
    npm run lint
}


# ------------------------------------------------------------
# Production build variables
# ------------------------------------------------------------

$env:NEXT_PUBLIC_APP_URL = $ProductionUrl
$env:SERVER_ACTION_ALLOWED_ORIGINS = $CloudFrontDomain
$env:COOLCASE_BUILD_ID = $BuildId
$env:COOLCASE_AWS_BUILD = "true"
$env:BUILDKIT_PROGRESS = "plain"


# ------------------------------------------------------------
# Build Docker image
# ------------------------------------------------------------

Run "Building production Docker image" {

    node scripts/build-aws-image.mjs `
        $LocalImage `
        $ProductionUrl
}


Run "Inspecting Docker image" {

    docker image inspect `
        $LocalImage `
        --format "Architecture={{.Architecture}} Size={{.Size}}"
}


# ------------------------------------------------------------
# Smoke test exact production image
# ------------------------------------------------------------

$SmokeContainer = "coolcase-smoke-$Timestamp"

try {

    Run "Starting production smoke container" {

        docker run `
            --rm `
            -d `
            --name $SmokeContainer `
            -p 18080:8080 `
            --env-file .env.local `
            $LocalImage
    }

    Start-Sleep -Seconds 5

    Test-WebStatus `
        "http://127.0.0.1:18080/api/health" |
        Out-Null

    Test-WebStatus `
        "http://127.0.0.1:18080/" |
        Out-Null
}
finally {

    docker stop $SmokeContainer 2>$null | Out-Null
}


# ------------------------------------------------------------
# Extract _next/static FROM THE SAME Docker image
#
# This is deliberately done from the final image to prevent
# Lambda/S3 build mismatches.
# ------------------------------------------------------------

$StaticRoot = ".\.aws-deploy-static"

Remove-Item `
    -Recurse `
    -Force `
    $StaticRoot `
    -ErrorAction SilentlyContinue

New-Item `
    -ItemType Directory `
    -Force `
    "$StaticRoot\_next" |
    Out-Null


Write-Host ""
Write-Host "==> Extracting matching Next static files from Docker image" -ForegroundColor Cyan

$ExportContainer = docker create $LocalImage

if ($LASTEXITCODE -ne 0) {
    Fail "Unable to create temporary Docker container."
}

try {

    docker cp `
        "${ExportContainer}:/app/.next/static" `
        "$StaticRoot\_next\"

    if ($LASTEXITCODE -ne 0) {
        Fail "Unable to extract .next/static from Docker image."
    }
}
finally {

    docker rm $ExportContainer 2>$null | Out-Null
}


if (-not (Test-Path "$StaticRoot\_next\static")) {
    Fail "Extracted Next static directory was not found."
}


# ------------------------------------------------------------
# IMPORTANT DEPLOY ORDER:
#
# Upload static FIRST.
# Lambda is updated AFTER static files are available.
#
# This prevents HTML from asking for chunks not yet on S3.
# ------------------------------------------------------------

Run "Uploading matching Next static files to S3" {

    aws s3 sync `
        "$StaticRoot\_next\static" `
        "s3://$Bucket/_next/static" `
        --region $Region `
        --cache-control "public,max-age=31536000,immutable"
}


# ------------------------------------------------------------
# Upload repository assets directly, WITHOUT image optimizer.
# ------------------------------------------------------------

Run "Uploading repository assets to S3" {

    aws s3 sync `
        ".\public\assets" `
        "s3://$Bucket/assets" `
        --region $Region `
        --exclude "references/*" `
        --cache-control "public,max-age=3600,s-maxage=86400"
}


# ------------------------------------------------------------
# ECR login
# ------------------------------------------------------------

Write-Host ""
Write-Host "==> Logging into Amazon ECR" -ForegroundColor Cyan

$EcrPassword = aws ecr get-login-password `
    --region $Region

if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($EcrPassword)) {
    Fail "Unable to get ECR login password."
}

$EcrPassword |
    docker login `
        --username AWS `
        --password-stdin `
        $Registry

if ($LASTEXITCODE -ne 0) {
    Fail "Docker ECR login failed."
}


# ------------------------------------------------------------
# Tag and push
# ------------------------------------------------------------

$RemoteImageTag = "${Registry}/${EcrRepository}:${ImageTag}"

Run "Tagging production image" {

    docker tag `
        $LocalImage `
        $RemoteImageTag
}


Run "Pushing production image to ECR" {

    docker push $RemoteImageTag
}


# ------------------------------------------------------------
# Resolve immutable digest
# ------------------------------------------------------------

$ImageDigest = aws ecr describe-images `
    --repository-name $EcrRepository `
    --image-ids "imageTag=$ImageTag" `
    --region $Region `
    --query "imageDetails[0].imageDigest" `
    --output text

if (
    $LASTEXITCODE -ne 0 -or
    [string]::IsNullOrWhiteSpace($ImageDigest) -or
    $ImageDigest -eq "None"
) {
    Fail "Unable to resolve ECR image digest."
}

$ImageUri = "${Registry}/${EcrRepository}@${ImageDigest}"

Write-Host ""
Write-Host "Image URI:"
Write-Host $ImageUri


# ------------------------------------------------------------
# Lambda update AFTER static upload
# ------------------------------------------------------------

Run "Updating Lambda" {

    aws lambda update-function-code `
        --function-name $FunctionName `
        --image-uri $ImageUri `
        --region $Region
}


Run "Waiting for Lambda update" {

    aws lambda wait function-updated-v2 `
        --function-name $FunctionName `
        --region $Region
}


# ------------------------------------------------------------
# Verify Lambda
# ------------------------------------------------------------

$LambdaState = aws lambda get-function-configuration `
    --function-name $FunctionName `
    --region $Region `
    --query "State" `
    --output text

$LambdaUpdateStatus = aws lambda get-function-configuration `
    --function-name $FunctionName `
    --region $Region `
    --query "LastUpdateStatus" `
    --output text

if ($LambdaState -ne "Active") {
    Fail "Lambda state is $LambdaState."
}

if ($LambdaUpdateStatus -ne "Successful") {
    Fail "Lambda update status is $LambdaUpdateStatus."
}


$AllowedOrigins = aws lambda get-function-configuration `
    --function-name $FunctionName `
    --region $Region `
    --query "Environment.Variables.SERVER_ACTION_ALLOWED_ORIGINS" `
    --output text

if ($AllowedOrigins -notlike "*$CloudFrontDomain*") {
    Write-Host ""
    Write-Host "WARNING: Lambda SERVER_ACTION_ALLOWED_ORIGINS does not contain $CloudFrontDomain." -ForegroundColor Yellow
}


# ------------------------------------------------------------
# Invalidate canonical assets
#
# _next/static uses immutable unique chunk names, so no
# invalidation is necessary there.
# ------------------------------------------------------------

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


Run "Waiting for CloudFront invalidation" {

    aws cloudfront wait invalidation-completed `
        --distribution-id $DistributionId `
        --id $InvalidationId
}


# ------------------------------------------------------------
# Production checks
# ------------------------------------------------------------

Write-Host ""
Write-Host "==> Production validation" -ForegroundColor Cyan

Test-WebStatus `
    "https://$CloudFrontDomain/api/health" |
    Out-Null

Test-WebStatus `
    "https://$CloudFrontDomain/" |
    Out-Null

Test-WebStatus `
    "https://$CloudFrontDomain/login" |
    Out-Null


Test-StaticFiles "/"
Test-StaticFiles "/login"


# ------------------------------------------------------------
# Cleanup
# ------------------------------------------------------------

Remove-Item `
    -Recurse `
    -Force `
    $StaticRoot `
    -ErrorAction SilentlyContinue


Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "COOLCASE PRODUCTION DEPLOYMENT COMPLETE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host ""
Write-Host "URL:        https://$CloudFrontDomain"
Write-Host "Git:        $GitLabel"
Write-Host "Image tag:  $ImageTag"
Write-Host "Digest:     $ImageDigest"
Write-Host ""