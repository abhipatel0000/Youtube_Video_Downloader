#!/bin/bash
pip install -r requirements.txt

if [ -n "$YOUTUBE_COOKIES_B64" ]; then
    echo "$YOUTUBE_COOKIES_B64" | base64 -d > cookies.txt
    echo "cookies.txt written from YOUTUBE_COOKIES_B64"
else
    echo "WARNING: YOUTUBE_COOKIES_B64 not set"
fi