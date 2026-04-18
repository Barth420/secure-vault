@echo off
:: This launcher just opens PowerShell as Admin and runs the real script
powershell -Command "Start-Process powershell -ArgumentList '-NoExit -ExecutionPolicy Bypass -File ""%~dp0stop-vault.ps1""' -Verb RunAs"
