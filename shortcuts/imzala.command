#!/bin/bash
# Burak'ın Mac'inde çalıştırılır: ~/Downloads/parobita-imza içindeki imzasız dosyaları imzalar
cd "$(dirname "$0")"
D=~/Downloads
for p in burak korhan; do
  mkdir -p "$D/ara-$p"
  shortcuts sign -m anyone -i ara_$p.shortcut -o "$D/ara-$p/Parobita Ara.shortcut"
  shortcuts sign -m anyone -i senkron_$p.shortcut -o "$D/ara-$p/Parobita Senkron.shortcut"
done
echo; echo "Tamam. ~/Downloads/ara-burak ve ara-korhan güncellendi."
open "$D/ara-burak"
