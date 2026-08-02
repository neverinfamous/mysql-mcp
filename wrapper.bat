@echo off
set LOG_FILE=C:\Users\chris\Desktop\mysql-mcp\mcp_wrapper.log
echo Starting MCP Wrapper at %time% >> %LOG_FILE%
echo ARGS: %* >> %LOG_FILE%
echo ENV CWD: %cd% >> %LOG_FILE%
node %* 2>> %LOG_FILE%
echo Exit Code: %ERRORLEVEL% >> %LOG_FILE%
