$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$port = 43871
$source = @"
using System;
using System.IO;
using System.Net;
using System.Threading;
public static class TflowLocalHost {
  static HttpListener listener;
  static string root;
  public static void Start(string folder, int port) {
    root = Path.GetFullPath(folder).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
    listener = new HttpListener();
    listener.Prefixes.Add("http://127.0.0.1:" + port + "/");
    listener.Start();
    var thread = new Thread(Loop); thread.IsBackground = true; thread.Start();
  }
  static void Loop() {
    while (listener != null && listener.IsListening) {
      try {
        var context = listener.GetContext();
        var relative = Uri.UnescapeDataString(context.Request.Url.AbsolutePath.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
        if (String.IsNullOrWhiteSpace(relative)) relative = "index.html";
        var file = Path.GetFullPath(Path.Combine(root, relative));
        if (!file.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(file)) { context.Response.StatusCode = 404; context.Response.Close(); continue; }
        var ext = Path.GetExtension(file).ToLowerInvariant();
        context.Response.ContentType = ext == ".html" ? "text/html; charset=utf-8" : ext == ".js" ? "application/javascript; charset=utf-8" : ext == ".webmanifest" || ext == ".json" ? "application/manifest+json; charset=utf-8" : ext == ".png" ? "image/png" : ext == ".ico" ? "image/x-icon" : "application/octet-stream";
        context.Response.Headers["Cache-Control"] = "no-cache";
        var bytes = File.ReadAllBytes(file); context.Response.ContentLength64 = bytes.Length; context.Response.OutputStream.Write(bytes, 0, bytes.Length); context.Response.Close();
      } catch { }
    }
  }
  public static void Stop() { try { if (listener != null) { listener.Stop(); listener.Close(); } } catch { } }
}
"@
Add-Type -TypeDefinition $source -Language CSharp
[TflowLocalHost]::Start($root, $port)
Start-Sleep -Milliseconds 300
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
if (-not (Test-Path -LiteralPath $edge)) { $edge = 'msedge.exe' }
$profile = Join-Path $env:LOCALAPPDATA 'Tflow\EdgeProfile'
New-Item -ItemType Directory -Force -Path $profile | Out-Null
try {
  $app = Start-Process -FilePath $edge -ArgumentList @('--no-first-run', "--user-data-dir=$profile", "--app=http://127.0.0.1:$port/index.html") -PassThru
  $app.WaitForExit()
} finally { [TflowLocalHost]::Stop() }
