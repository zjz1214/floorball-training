param([int]$DesktopProcessId,[string]$Action='Close',[string]$Button='取消',[string]$DialogTitle='有未保存内容')
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$root=[System.Windows.Automation.AutomationElement]::RootElement
$processCondition=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ProcessIdProperty,$DesktopProcessId)
if($Action -eq 'Close'){
  $windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,$processCondition)
  foreach($entry in $windows){if($entry.Current.ClassName -eq 'Chrome_WidgetWin_1'){ $entry.GetCurrentPattern([System.Windows.Automation.WindowPattern]::Pattern).Close(); 'Close requested'; exit 0 }}
  throw 'Desktop window not found'
}
for($attempt=0;$attempt -lt 100;$attempt++){
  $windows=$root.FindAll([System.Windows.Automation.TreeScope]::Children,$processCondition)
  foreach($entry in $windows){
    if($entry.Current.Name -eq $DialogTitle){
      $buttons=$entry.FindAll([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::Button))
      'Dialog: '+$entry.Current.Name
      foreach($control in $buttons){'Button: '+$control.Current.Name;if($control.Current.Name -eq $Button){$control.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke();exit 0}}
    }
  }
  Start-Sleep -Milliseconds 100
}
throw 'Expected dialog or button not found'
