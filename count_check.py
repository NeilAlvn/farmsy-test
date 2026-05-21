"""
Find where the 300 extra farms come from.
Tries every angle: no filter, published filter, HEAD count,
unpublished rows, different select, osm_id null rows.
"""
import json, os, urllib.request
from collections import Counter
from dotenv import load_dotenv

load_dotenv('.env.local')
URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

def head_count(path):
    req = urllib.request.Request(
        f'{URL}/rest/v1/{path}',
        headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}',
                 'Prefer': 'count=exact', 'Range-Unit': 'items', 'Range': '0-0'},
        method='HEAD')
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.headers.get('Content-Range', '?')  # e.g. "0-0/13522"

def fetch_all(path, cols='id,source,is_published,created_at'):
    farms, offset = [], 0
    while True:
        req = urllib.request.Request(
            f'{URL}/rest/v1/{path}&select={cols}&offset={offset}&limit=1000&order=id',
            headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}',
                     'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.loads(r.read())
        farms.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return farms

print('=== HEAD count checks (Content-Range: start-end/TOTAL) ===')
print(f'  farms (no filter)              : {head_count("farms?")}')
print(f'  farms is_published=true        : {head_count("farms?is_published=eq.true")}')
print(f'  farms is_published=false       : {head_count("farms?is_published=eq.false")}')
print(f'  farms is_published IS NULL     : {head_count("farms?is_published=is.null")}')
print(f'  farms osm_id IS NULL           : {head_count("farms?osm_id=is.null")}')
print(f'  farms osm_id IS NOT NULL       : {head_count("farms?osm_id=not.is.null")}')

print()
print('=== Paginated fetch: all rows, no filter ===')
all_farms = fetch_all('farms?')
print(f'  Fetched: {len(all_farms):,}')

by_pub = Counter(str(f.get('is_published')) for f in all_farms)
print(f'  is_published breakdown: {dict(by_pub)}')

by_src = Counter(f.get('source') or 'NULL' for f in all_farms)
print('\n  By source:')
for src, cnt in by_src.most_common():
    print(f'    {src:<35} {cnt:>6,}')

by_day = Counter((f.get('created_at') or '')[:10] for f in all_farms)
print('\n  By creation date:')
for day in sorted(by_day, reverse=True):
    print(f'    {day}   {by_day[day]:>6,}')

# Check: are any rows NOT visible in the normal published query?
print()
print('=== Rows visible with is_published=eq.true filter ===')
pub_farms = fetch_all('farms?is_published=eq.true')
print(f'  Fetched: {len(pub_farms):,}')

pub_ids = {f['id'] for f in pub_farms}
all_ids = {f['id'] for f in all_farms}
hidden  = all_ids - pub_ids
print(f'  Rows in "all" but NOT in "published": {len(hidden)}')
if hidden:
    for fid in list(hidden)[:20]:
        row = next(f for f in all_farms if f['id'] == fid)
        print(f'    id={fid}  source={row.get("source")}  '
              f'published={row.get("is_published")}  '
              f'created={str(row.get("created_at",""))[:10]}')
