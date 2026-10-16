[CmdletBinding()]
param(
    [string]$KeystorePath = "$env:USERPROFILE\paperflow-upload.jks",
    [string]$Alias = "paperflow-upload"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $KeystorePath -PathType Leaf)) {
    throw "Upload keystore was not found: $KeystorePath"
}

function Convert-SecureStringToPlainText([Security.SecureString]$Value) {
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    }
}

function ConvertTo-JavaPropertiesValue([string]$Value) {
    $escaped = [System.Text.StringBuilder]::new()
    for ($index = 0; $index -lt $Value.Length; $index++) {
        $character = $Value[$index]
        $codePoint = [int][char]$character

        if ($character -eq '\\') { [void]$escaped.Append('\\\\'); continue }
        if ($character -eq "`t") { [void]$escaped.Append('\\t'); continue }
        if ($character -eq "`r") { [void]$escaped.Append('\\r'); continue }
        if ($character -eq "`n") { [void]$escaped.Append('\\n'); continue }
        if ($codePoint -lt 0x20 -or $codePoint -gt 0x7e) {
            [void]$escaped.Append(('\\u{0:X4}' -f $codePoint))
            continue
        }
        if ($index -eq 0 -and ($character -eq ' ' -or $character -eq '#' -or $character -eq '!')) {
            [void]$escaped.Append('\\')
        }
        [void]$escaped.Append($character)
    }
    return $escaped.ToString()
}

function Test-KeystorePassword([string]$Path, [string]$EntryAlias, [string]$Password) {
    $keytool = (Get-Command keytool.exe -ErrorAction Stop).Source
    $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
    $startInfo.FileName = $keytool
    $startInfo.UseShellExecute = $false
    $startInfo.RedirectStandardInput = $true
    $startInfo.RedirectStandardOutput = $true
    $startInfo.RedirectStandardError = $true
    # Windows PowerShell 5.1 does not expose ProcessStartInfo.ArgumentList.
    # Neither value contains a secret; the password is supplied over stdin below.
    $safePath = '"{0}"' -f $Path.Replace('"', '\"')
    $safeAlias = '"{0}"' -f $EntryAlias.Replace('"', '\"')
    $startInfo.Arguments = "-list -keystore $safePath -alias $safeAlias"

    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $startInfo
    [void]$process.Start()
    $process.StandardInput.WriteLine($Password)
    $process.StandardInput.Close()
    [void]$process.StandardOutput.ReadToEnd()
    [void]$process.StandardError.ReadToEnd()
    $process.WaitForExit()
    return $process.ExitCode -eq 0
}

$storeSecure = Read-Host "Keystore password" -AsSecureString
$keySecure = Read-Host "Key password (press Enter if it is the same)" -AsSecureString
$storePassword = Convert-SecureStringToPlainText $storeSecure
$keyPassword = if ($keySecure.Length -eq 0) { $storePassword } else { Convert-SecureStringToPlainText $keySecure }

try {
    if (-not (Test-KeystorePassword -Path $KeystorePath -EntryAlias $Alias -Password $storePassword)) {
        throw 'The keystore password was not accepted. Re-enter the password verified with keytool.'
    }

    $propertiesPath = Join-Path $PSScriptRoot "..\android\key.properties"
    $absoluteKeystore = (Resolve-Path -LiteralPath $KeystorePath).Path.Replace("\", "/")
    $properties = @(
        "storePassword=$(ConvertTo-JavaPropertiesValue $storePassword)"
        "keyPassword=$(ConvertTo-JavaPropertiesValue $keyPassword)"
        "keyAlias=$Alias"
        "storeFile=$absoluteKeystore"
    ) -join [Environment]::NewLine
    Set-Content -LiteralPath $propertiesPath -Value $properties -Encoding ascii -NoNewline

    # Limit the plaintext Gradle properties file to the current Windows user.
    $grant = ('{0}:(R,W)' -f $env:USERNAME)
    & icacls $propertiesPath /inheritance:r /grant:r $grant | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not restrict access to key.properties. Remove the file and retry."
    }
    Write-Host "Release signing configuration is ready at $propertiesPath. The Gradle release build verifies the alias and passwords."
}
finally {
    $storePassword = $null
    $keyPassword = $null
    $storeSecure.Dispose()
    $keySecure.Dispose()
}
