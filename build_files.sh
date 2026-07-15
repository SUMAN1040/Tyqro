#!/bin/bash
echo "BUILD START"

if command -v python3.12 &>/dev/null; then
    PYTHON_CMD="python3.12"
elif command -v python3 &>/dev/null; then
    PYTHON_CMD="python3"
else
    PYTHON_CMD="python"
fi

echo "Using Python command: $PYTHON_CMD"

$PYTHON_CMD -m pip install -r requirements.txt --break-system-packages
$PYTHON_CMD manage.py collectstatic --noinput --clear
$PYTHON_CMD manage.py migrate
mkdir -p staticfiles
touch staticfiles/.gitkeep
echo "BUILD END"
