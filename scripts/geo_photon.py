import os
import json, subprocess, time, urllib.request, urllib.parse, re, sys
def sql(q):
    open('/tmp/gq2.sql', 'w').write(q)
    o = subprocess.run(["python3", "sql.py", "/tmp/gq2.sql"], capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__))).stdout
    return json.loads(o) if o.strip() and not o.startswith('ERR') else o
cache = {}
def photon(q):
    if q in cache: return cache[q]
    u = 'https://photon.komoot.io/api/?' + urllib.parse.urlencode({'q': q, 'limit': 1, 'lat': 39.92, 'lon': 32.85, 'bbox': '32.4,39.6,33.2,40.15'})
    p = None
    try:
        d = json.load(urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'parobita-crm/1.0'}), timeout=10))
        f = (d.get('features') or [None])[0]
        if f and f['properties'].get('state') == 'Ankara':
            p = (f['geometry']['coordinates'][1], f['geometry']['coordinates'][0])
    except Exception as e:
        time.sleep(2)
    time.sleep(0.35)
    cache[q] = p
    return p
def clean(a):
    a = re.sub(r'\b(No|D|Kat|Daire)\s*:?\s*[\w/.-]+', '', a, flags=re.I)
    a = re.sub(r'\d{5}\s*', '', a)
    a = re.sub(r'\s+,', ',', a); a = re.sub(r',\s*,', ',', a); a = re.sub(r'\s{2,}', ' ', a)
    return a.strip(' ,')
FIX = {'GOP': 'Gaziosmanpaşa', 'Çankaya merkez': 'Kızılay', 'Tunalı': 'Kavaklıdere', 'Paris Cd.': 'Kavaklıdere', 'Bağlar Cd.': 'Murat Mahallesi'}
t0 = time.time(); limit = float(sys.argv[1]) if len(sys.argv) > 1 else 500
rows = sql("select id, address, district from leads where geo_level is null or geo_level='district' order by geo_level nulls first")
ok = 0; n = 0; buf = []
def flush():
    global buf
    if not buf: return
    vals = ','.join(f"('{i}'::uuid,{la if la is not None else 'null'}::float8,{ln if ln is not None else 'null'}::float8,'{lv}')" for i, la, ln, lv in buf)
    sql(f"update leads l set lat=coalesce(v.la,l.lat), lng=coalesce(v.ln,l.lng), geo_level=case when v.lv='none' and l.lat is not null then 'district' else v.lv end from (values {vals}) v(id,la,ln,lv) where l.id=v.id")
    buf = []
for l in rows:
    if time.time() - t0 > limit: break
    n += 1
    p = None; lvl = 'none'
    if l['address']:
        a = clean(l['address'])
        p = photon(a if 'Ankara' in a else a + ', Ankara')
        if p: lvl = 'address'
    if not p and l['district']:
        d = re.split(r'[(/]', l['district'])[0].strip()
        p = photon(f"{FIX.get(d, d.replace(' Mah.', ''))}, Ankara")
        if p: lvl = 'district'
    if p: ok += 1
    buf.append((l['id'], p[0] if p else None, p[1] if p else None, lvl if p else 'none'))
    if len(buf) >= 40: flush()
flush()
print('processed', n, 'found', ok)
print(sql("select geo_level, count(*) from leads group by 1"))
