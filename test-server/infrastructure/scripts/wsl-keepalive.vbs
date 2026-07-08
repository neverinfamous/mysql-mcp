' WSL KeepAlive - runs wsl.exe hidden (no console window)
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "wsl.exe -d Ubuntu-24.04 --exec sleep infinity", 0, True
