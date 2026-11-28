#!/bin/bash
# Kısayolları kişiye özel derler (imzasız). İmza Burak'ın Mac'inde: shortcuts sign -m anyone ...
# Gerekli: cherri derleyicisi (github.com/electrikmilk/cherri) → CHERRI ortam değişkeni
# Tokenlar: Supabase profiles.shortcut_token (Burak/Korhan) → SHORTCUT_TOKEN_BURAK / SHORTCUT_TOKEN_KORHAN
set -e
cd "$(dirname "$0")"
CHERRI=${CHERRI:-cherri}
mkdir -p out
for who in burak korhan; do
  var="SHORTCUT_TOKEN_${who^^}"; tok="${!var}"
  [ -z "$tok" ] && { echo "$var yok"; exit 1; }
  for n in ara senkron kontrol; do
    sed "s/__SHORTCUT_TOKEN__/$tok/" $n.cherri > /tmp/${n}_$who.cherri
    cp -r actions /tmp/ 2>/dev/null || true
    (cd /tmp && $CHERRI ${n}_$who.cherri --skip-sign >/dev/null)
    f=$(ls -t /tmp/*_unsigned.shortcut | head -1); mv "$f" out/${n}_$who.shortcut
  done
done
ls -la out
