@echo off
setlocal enabledelayedexpansion
set NODE_VER=null
set NODE_EXEC=node-v16.14.2-x64.msi
set SETUP_DIR=%CD%
set /p key=< .env  

IF "%key:~16%"=="YOUR_PRIVATE_KEY" (
	echo Missing private key from .env file. Add the key and any configurations then restart this setup.
	pause
	exit
)

node -v >.tmp_nodever
set /p NODE_VER=<.tmp_nodever
del .tmp_nodever
IF %NODE_VER% == null (
	echo Node was not found. Please press enter and it will open your browser and automatically download. 
	PAUSE
	START https://nodejs.org/dist/v16.14.2/%NODE_EXEC%
	echo After you have successfully installed Node.js, please run this script again.
	pause
	exit
)

IF EXIST autoRebake.exe (
	GOTO CheckRefresh
) ELSE (
	GOTO PackageAndRun
)

:CheckRefresh
echo Existing exe found..
set /p REFRESH_EXE="Has the .env changed since the last run? (y/n):"
IF /I "!REFRESH_EXE!"=="y" (
	ECHO Refreshing exe...
	del autoRebake.exe
	GOTO PackageAndRun
) ELSE (
	GOTO Run
)

:PackageAndRun
echo Updating packages and creating exe..
call npm install && npx caxa --input "./" --output "autoRebake.exe" -- "node" "src/autoRebake.js" && autoRebake.exe

:Run
echo Running exe...
call autoRebake.exe