' Multicam: gc-score-live. Sin ventana. Puerto distinto: variable MULTICAM_PORT.
Set sh = CreateObject("WScript.Shell")
port = sh.ExpandEnvironmentStrings("%MULTICAM_PORT%")
If port = "%MULTICAM_PORT%" Or port = "" Then port = "3000"
sh.Run "curl.exe -s -X POST http://127.0.0.1:" & port & "/api/do/gc-score-live", 0, False
