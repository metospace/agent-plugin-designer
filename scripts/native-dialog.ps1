param([string]$Path, [string]$Title, [string]$Screenshot, [switch]$Cancel)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class NativeDialogWindow {
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
 [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
 [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hwnd);
}
'@
$until=(Get-Date).AddSeconds(30)
$dialog=$null
while((Get-Date) -lt $until) {
 $windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
 foreach($w in $windows) {
  if($w.Current.ClassName -eq '#32770' -and $w.Current.Name -eq $Title) { $dialog=$w; break }
  if($w.Current.ClassName -eq 'MyGoWindow') {
   $owned=$w.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ClassNameProperty,'#32770'))
   foreach($candidate in $owned){if($candidate.Current.Name -eq $Title){$dialog=$candidate;break}}
   if($dialog){break}
  }
 }
 if($dialog -and $dialog.Current.IsEnabled){break}; Start-Sleep -Milliseconds 100
}
if(!$dialog){
 $windows | ForEach-Object { Write-Output ("UIA window: " + $_.Current.Name + " class=" + $_.Current.ClassName) }
 throw "Native file dialog not found: $Title"
}
$hwnd=[IntPtr]$dialog.Current.NativeWindowHandle
[void][NativeDialogWindow]::SetForegroundWindow($hwnd)
$focusUntil=(Get-Date).AddSeconds(5)
while([NativeDialogWindow]::GetForegroundWindow() -ne $hwnd -and (Get-Date) -lt $focusUntil){Start-Sleep -Milliseconds 100}
if([NativeDialogWindow]::GetForegroundWindow() -ne $hwnd){throw 'Native file dialog did not receive foreground focus'}
Start-Sleep -Milliseconds 300
if($Screenshot) {
 $rect=$dialog.Current.BoundingRectangle
 $bitmap=[System.Drawing.Bitmap]::new([int]$rect.Width,[int]$rect.Height)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bitmap.Size)
 $bitmap.Save($Screenshot,[System.Drawing.Imaging.ImageFormat]::Png); $graphics.Dispose(); $bitmap.Dispose()
}
if($Cancel) {
 [System.Windows.Forms.SendKeys]::SendWait('{ESC}')
} else {
 # The native shell's lower controls are not always exposed by its UIA
 # provider. Use the real File name accelerator and OS input, then verify
 # the resulting file and bytes in the caller.
 [System.Windows.Forms.SendKeys]::SendWait('%n')
 [System.Windows.Forms.SendKeys]::SendWait('^a')
 [System.Windows.Forms.Clipboard]::SetText($Path)
 [System.Windows.Forms.SendKeys]::SendWait('^v')
 [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}
$closedUntil=(Get-Date).AddSeconds(15)
while([NativeDialogWindow]::IsWindow($hwnd) -and (Get-Date) -lt $closedUntil){Start-Sleep -Milliseconds 100}
if([NativeDialogWindow]::IsWindow($hwnd)){throw 'Native file dialog remained open after input'}
Write-Output 'Native dialog operated successfully through OS keyboard input'
