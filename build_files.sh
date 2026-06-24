#!/bin/bash
echo "BUILD START"
python3.12 -m pip install -r requirements.txt --break-system-packages
python3.12 manage.py collectstatic --noinput --clear
python3.12 manage.py migrate
mkdir -p staticfiles
touch staticfiles/.gitkeep
echo "BUILD END"
