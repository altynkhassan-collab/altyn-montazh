#!/bin/bash
# ./stills.sh <scene> t1,t2,...  -> chk_<scene>.jpg
rm -f still_*.jpg
node render.js "film.html?scene=$1" stills:$2 || exit 1
ls still_*.jpg | sort -t_ -k2 -g > /tmp/l.txt
args=(); f=""; i=0
for x in $(sort -t_ -k2 -g <<< "$(ls still_*.jpg)"); do args+=(-i $x); f="$f[$i]scale=360:640[v$i];"; i=$((i+1)); done
st=""; for j in $(seq 0 $((i-1))); do st="$st[v$j]"; done
ffmpeg -v error -y "${args[@]}" -filter_complex "${f}${st}hstack=$i" chk_$1.jpg
