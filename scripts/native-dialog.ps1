param([string]$Path, [string]$Title, [string]$Screenshot, [switch]$Cancel)
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$until=(Get-Date).AddSeconds(30)
$dialog=$null
while((Get-Date) -lt $until) {
 $windows=[System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,[System.Windows.Automation.Condition]::TrueCondition)
 foreach($w in $windows) { if($w.Current.ClassName -eq '#32770' -and (!$Title -or $w.Current.Name -eq $Title)) { $dialog=$w; break } }
 if($dialog) {break}; Start-Sleep -Milliseconds 100
}
if(!$dialog){throw "Native file dialog not found: $Title"}
if($Screenshot) {
 $rect=$dialog.Current.BoundingRectangle
 $bitmap=[System.Drawing.Bitmap]::new([int]$rect.Width,[int]$rect.Height)
 $graphics=[System.Drawing.Graphics]::FromImage($bitmap)
 $graphics.CopyFromScreen([int]$rect.X,[int]$rect.Y,0,0,$bitmap.Size)
 $bitmap.Save($Screenshot); $graphics.Dispose(); $bitmap.Dispose()
}
$dialog.SetFocus()
if($Cancel) {
 $button=$dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,([System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'2')))
 $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
} else {
 $edits=$dialog.FindAll([System.Windows.Automation.TreeScope]::Descendants,([System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Edit)))
 $edit=$null
 foreach($e in $edits){if($e.Current.AutomationId -eq '1001'){$edit=$e;break}}
 if(!$edit){throw 'Filename edit control 1001 not found'}
 $edit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern).SetValue($Path)
 $button=$dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,([System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::AutomationIdProperty,'1')))
 $button.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
}
Write-Output 'Native dialog operated successfully'
