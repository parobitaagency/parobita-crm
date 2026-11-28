# Supabase Management API ile SQL çalıştırır.
# Kullanım: python3 scripts/sql.py dosya.sql   |   python3 scripts/sql.py --q "select 1"
# .env (repo kökünde, git'e girmez): SB_REF=..., SB_PAT=... (Supabase personal access token)
import json, os, sys, urllib.request
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
env = dict(l.strip().split('=', 1) for l in open(os.path.join(root, '.env')) if '=' in l)
q = open(sys.argv[1]).read() if len(sys.argv) > 1 and not sys.argv[1].startswith('--q') else sys.argv[2]
r = urllib.request.Request(f'https://api.supabase.com/v1/projects/{env["SB_REF"]}/database/query',
    data=json.dumps({'query': q}).encode(), headers={'Authorization': 'Bearer ' + env['SB_PAT'], 'Content-Type': 'application/json'}, method='POST')
try: print(urllib.request.urlopen(r, timeout=60).read().decode())
except urllib.error.HTTPError as e: print('ERR', e.read().decode())
