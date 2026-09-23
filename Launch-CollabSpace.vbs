Set WshShell = CreateObject("WScript.Shell")
WshShell.Run Chr(34) & Replace(WScript.ScriptFullName, "Launch-CollabSpace.vbs", "Launch-CollabSpace.bat") & Chr(34), 0, False
