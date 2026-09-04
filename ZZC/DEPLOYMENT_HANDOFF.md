# Portfolio Deployment Handoff

## Purpose

This document records the verified process for producing a directly uploadable static deployment package for this portfolio.

The target package must work on Linux-based hosting services such as CloudBase. Do not use Windows PowerShell `Compress-Archive` for the final upload ZIP because it can store entry names with backslashes (`\`). CloudBase's unzip step warns about those separators and may treat the warning as a failed deployment.

## Project locations

- Project root: `D:\个人介绍3`
- Vite build output: `D:\个人介绍3\dist`
- Human-readable deployment folder: `D:\个人介绍3\服务器部署包`
- Verified upload archive naming convention: `zzcspace-upload-vN.zip`

## Build procedure

Run the production build from the project root:

```powershell
npm run build
```

The build must finish successfully before packaging. The generated `dist` directory is the deployable website; source files, `node_modules`, TypeScript files, and build configuration are not needed on a static server.

## Required archive structure

The ZIP must contain `index.html` at its root:

```text
index.html
assets/
photos/
favicon.png
hongling-logo.png
og-cover.jpg
sustech-logo.png
```

Incorrect structure:

```text
服务器部署包/
  index.html
  assets/
```

If the outer folder is included, the hosting service will report `NoSuchKey: index.html` because there is no homepage at the deployment root.

## Cross-platform ZIP requirement

Every ZIP entry must use `/` as the path separator. There must be no entry containing `\`.

Do not create the final package with this command on Windows:

```powershell
Compress-Archive
```

In this environment it produced ZIP entries such as:

```text
assets\index.css
photos\gallery-01.jpg
```

CloudBase emitted:

```text
warning: code.zip appears to use backslashes as path separators
Finished, code: 1
```

Instead, create the ZIP with `.NET ZipArchive` and explicitly normalize entry names:

```powershell
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$source = (Resolve-Path -LiteralPath '服务器部署包').Path
$zip = Join-Path (Get-Location) 'zzcspace-upload-v3.zip'
$stream = [IO.File]::Open($zip, [IO.FileMode]::CreateNew)
$archive = [IO.Compression.ZipArchive]::new(
  $stream,
  [IO.Compression.ZipArchiveMode]::Create,
  $false
)

try {
  Get-ChildItem -LiteralPath $source -Recurse -File | ForEach-Object {
    $relative = $_.FullName.Substring($source.Length + 1).Replace('\', '/')
    $entry = $archive.CreateEntry(
      $relative,
      [IO.Compression.CompressionLevel]::Optimal
    )
    $entryStream = $entry.Open()
    $fileStream = [IO.File]::OpenRead($_.FullName)
    try {
      $fileStream.CopyTo($entryStream)
    } finally {
      $fileStream.Dispose()
      $entryStream.Dispose()
    }
  }
} finally {
  $archive.Dispose()
  $stream.Dispose()
}
```

Always use a new versioned filename rather than silently overwriting a package the user may already be uploading.

## Mandatory verification

Before handing off the ZIP, inspect its entries:

```powershell
$check = [IO.Compression.ZipFile]::OpenRead($zip)
try {
  $names = @($check.Entries | ForEach-Object { $_.FullName })
  $hasRootIndex = $names -contains 'index.html'
  $backslashCount = @($names | Where-Object { $_ -match '\\' }).Count

  Write-Output "ROOT_INDEX=$hasRootIndex"
  Write-Output "BACKSLASH_ENTRIES=$backslashCount"
} finally {
  $check.Dispose()
}
```

Do not deliver the archive unless the results are exactly:

```text
ROOT_INDEX=True
BACKSLASH_ENTRIES=0
```

Also confirm that all six gallery images and the built JavaScript/CSS assets are present.

## CloudBase upload configuration

Upload the verified ZIP directly without extracting or recompressing it.

Use these settings for a prebuilt static package:

```text
Project type: ZIP archive
Framework: Static site / HTML / Other
Target directory: ./
Install command: empty
Build command: empty
Output directory: ./
Deployment path: /
```

Do not select the React preset for this package. React is only appropriate when uploading the full source project with `package.json`, in which case the build command is `npm run build` and the output directory is `dist`.

## Known failure signatures

### `can't cd to /root/cloudbase-workspace/服务器部署包`

Cause: the target directory was incorrectly set to `./服务器部署包` even though the service extracts the ZIP contents directly into the workspace root.

Fix: set the target directory to `./`.

### `NoSuchKey: index.html`

Cause: `index.html` is not at the archive root, or the wrong output/deployment directory was selected.

Fix: verify that the ZIP contains the exact root entry `index.html`; use output directory `./` and deployment path `/`.

### `code.zip appears to use backslashes as path separators`

Cause: the ZIP was created with Windows-style entry names.

Fix: recreate it with `.NET ZipArchive`, normalize every entry name with `.Replace('\', '/')`, and verify `BACKSLASH_ENTRIES=0`.

## Last verified package

`D:\个人介绍3\zzcspace-upload-v11.zip`

Verification result:

```text
ENTRY_COUNT=22
ROOT_INDEX=True
BACKSLASH_ENTRIES=0
```
