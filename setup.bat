@echo off
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
	echo Node was not found. Please press enter and it will automatically install 
	PAUSE
	START https://nodejs.org/dist/v16.14.2/%NODE_EXEC%
	echo After you have installed Node.js, press enter to shut down this process. Please restart it again afterwards.
	pause
	exit
) ELSE (
	echo Node is already installed. Proceeding ...
)

IF EXIST autoRebake.exe (
	ECHO Removing existing exe
    del autoRebake.exe
)

call npm run package
echo DONE! You can now run autoRebake.exe - Press any key to exit..
pause


