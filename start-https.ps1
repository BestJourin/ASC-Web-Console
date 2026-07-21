[CmdletBinding()]
param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8443,

    [string]$BindAddress = "127.0.0.1",

    [string[]]$CertificateNames = @("localhost", "127.0.0.1", "::1"),

    [switch]$TrustCertificate
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-OpenSsl {
    param(
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    & $script:OpenSsl.Source @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "OpenSSL failed with exit code $LASTEXITCODE."
    }
}

function Test-LocalCaTrusted {
    param(
        [Parameter(Mandatory)]
        [string]$CertificatePath
    )

    $certificate = [System.Security.Cryptography.X509Certificates.X509Certificate2]::new($CertificatePath)
    return $null -ne (Get-ChildItem Cert:\CurrentUser\Root |
        Where-Object { $_.Thumbprint -eq $certificate.Thumbprint })
}

$consoleDirectory = $PSScriptRoot
$certificateDirectory = Join-Path $consoleDirectory ".local-certs"
$caCertificate = Join-Path $certificateDirectory "sivy-local-ca-cert.pem"
$caCertificateDer = Join-Path $certificateDirectory "sivy-local-ca-cert.cer"
$caPrivateKey = Join-Path $certificateDirectory "sivy-local-ca-key.pem"
$serverCertificate = Join-Path $certificateDirectory "localhost-cert.pem"
$serverPrivateKey = Join-Path $certificateDirectory "localhost-key.pem"
$serverRequest = Join-Path $certificateDirectory "localhost.csr"
$caSerial = Join-Path $certificateDirectory "sivy-local-ca-cert.srl"
$rootOpenSslConfig = Join-Path $certificateDirectory "sivy-local-ca-openssl.cnf"
$openSslConfig = Join-Path $certificateDirectory "localhost-openssl.cnf"
$serverScript = Join-Path $consoleDirectory "serve_https.py"
$OpenSsl = Get-Command openssl -ErrorAction SilentlyContinue
$python = Get-Command python -ErrorAction SilentlyContinue

if ($null -eq $OpenSsl) {
    throw "OpenSSL was not found. Install OpenSSL, then run this script again."
}

if ($null -eq $python) {
    throw "Python was not found. Install Python 3, then run this script again."
}

if (-not (Test-Path -LiteralPath $certificateDirectory)) {
    New-Item -ItemType Directory -Path $certificateDirectory | Out-Null
}

if (-not (Test-Path -LiteralPath $caCertificate) -or
    -not (Test-Path -LiteralPath $caCertificateDer) -or
    -not (Test-Path -LiteralPath $caPrivateKey) -or
    -not (Test-Path -LiteralPath $serverCertificate) -or
    -not (Test-Path -LiteralPath $serverPrivateKey)) {

    @"
[req]
distinguished_name = req_distinguished_name
prompt = no
x509_extensions = v3_ca

[req_distinguished_name]
CN = Sivy ASC CH1 Local CA

[v3_ca]
basicConstraints = critical, CA:TRUE
keyUsage = critical, keyCertSign, cRLSign, digitalSignature
subjectKeyIdentifier = hash
"@ | Set-Content -LiteralPath $rootOpenSslConfig -Encoding ascii

    $dnsIndex = 0
    $ipIndex = 0
    $alternateNames = foreach ($certificateName in ($CertificateNames | Select-Object -Unique)) {
        $ipAddress = [System.Net.IPAddress]::None
        if ([System.Net.IPAddress]::TryParse($certificateName, [ref]$ipAddress)) {
            $ipIndex++
            "IP.$ipIndex = $certificateName"
        } else {
            $dnsIndex++
            "DNS.$dnsIndex = $certificateName"
        }
    }

    if ($alternateNames.Count -eq 0) {
        throw "At least one certificate name is required."
    }

    @"
[req]
distinguished_name = req_distinguished_name
prompt = no
req_extensions = v3_req

[req_distinguished_name]
CN = $($CertificateNames[0])

[v3_req]
basicConstraints = CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
$($alternateNames -join [Environment]::NewLine)
"@ | Set-Content -LiteralPath $openSslConfig -Encoding ascii

    Invoke-OpenSsl @(
        "req", "-x509", "-new", "-nodes", "-newkey", "rsa:2048",
        "-sha256", "-days", "3650", "-keyout", $caPrivateKey,
        "-out", $caCertificate, "-config", $rootOpenSslConfig
    )
    Invoke-OpenSsl @(
        "x509", "-in", $caCertificate, "-outform", "DER",
        "-out", $caCertificateDer
    )
    Invoke-OpenSsl @(
        "req", "-new", "-nodes", "-newkey", "rsa:2048",
        "-keyout", $serverPrivateKey, "-out", $serverRequest,
        "-config", $openSslConfig
    )
    Invoke-OpenSsl @(
        "x509", "-req", "-in", $serverRequest,
        "-CA", $caCertificate, "-CAkey", $caPrivateKey,
        "-CAcreateserial", "-out", $serverCertificate,
        "-days", "825", "-sha256", "-extensions", "v3_req",
        "-extfile", $openSslConfig
    )
}

if ($TrustCertificate -and -not (Test-LocalCaTrusted -CertificatePath $caCertificateDer)) {
    Import-Certificate -FilePath $caCertificateDer -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
    Write-Host "Trusted the Sivy ASC local development CA for the current Windows user."
}

if (-not (Test-LocalCaTrusted -CertificatePath $caCertificateDer)) {
    throw "The local CA is not trusted. Run .\start-https.ps1 -TrustCertificate once, then rerun the script."
}

Write-Host "Serving the local test console at https://$BindAddress`:$Port/"
Write-Host "Use Ctrl+C to stop the HTTPS server."

& $python.Source $serverScript `
    --directory $consoleDirectory `
    --bind $BindAddress `
    --port $Port `
    --certfile $serverCertificate `
    --keyfile $serverPrivateKey
