"""Farm count discrepancy investigation -- De Lokale Boer"""

import json, os, urllib.request
from collections import Counter, defaultdict
from dotenv import load_dotenv

load_dotenv('.env.local')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
SERVICE_KEY  = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

def api_get(path, extra_headers=None):
    headers = {'apikey': SERVICE_KEY,
               'Authorization': f'Bearer {SERVICE_KEY}',
               'Accept': 'application/json'}
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(f'{SUPABASE_URL}/rest/v1/{path}', headers=headers)
    with urllib.request.urlopen(req, timeout=60) as r:
        body = json.loads(r.read())
        content_range = r.headers.get('Content-Range', '')
        return body, content_range

def count_total():
    """Use HEAD + Prefer:count=exact to get real table size."""
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/farms?select=id',
        headers={'apikey': SERVICE_KEY,
                 'Authorization': f'Bearer {SERVICE_KEY}',
                 'Prefer': 'count=exact',
                 'Range-Unit': 'items',
                 'Range': '0-0'},
        method='HEAD')
    with urllib.request.urlopen(req, timeout=30) as r:
        cr = r.headers.get('Content-Range', '')  # e.g. "0-0/13972"
        return cr

def fetch_all():
    cols = 'id,name,city,country,source,created_at,is_published'
    farms, offset = [], 0
    print('Fetching all farms (no is_published filter)...', end='', flush=True)
    while True:
        chunk, _ = api_get(
            f'farms?select={cols}&offset={offset}&limit=1000&order=id')
        farms.extend(chunk)
        print(f' {len(farms)}', end='', flush=True)
        if len(chunk) < 1000:
            break
        offset += 1000
    print()
    return farms

def sep(title):
    print(f'\n== {title} ' + '-' * max(0, 55 - len(title)))

def main():
    # Raw table count first
    cr = count_total()
    print(f'Content-Range from HEAD request: {cr}')

    farms = fetch_all()
    total = len(farms)
    print(f'Rows fetched (paginated):  {total:,}')

    published   = [f for f in farms if f.get('is_published')]
    unpublished = [f for f in farms if not f.get('is_published')]
    print(f'  is_published=true  : {len(published):,}')
    print(f'  is_published=false : {len(unpublished):,}')
    print(f'  is_published=NULL  : {sum(1 for f in farms if f.get("is_published") is None):,}')

    # 1. Count by source
    sep('1. Farm count by source')
    by_src = Counter(f.get('source') or 'NULL' for f in farms)
    for src, cnt in by_src.most_common():
        pub = sum(1 for f in farms
                  if (f.get('source') or 'NULL') == src and f.get('is_published'))
        unpub = cnt - pub
        print(f'  {src:<35}  total={cnt:>6,}  pub={pub:>6,}  unpub={unpub:>4,}')

    # 2. Latest addition per source
    sep('2. Latest creation date by source')
    latest = defaultdict(list)
    for f in farms:
        latest[f.get('source') or 'NULL'].append(f.get('created_at') or '')
    for src, tss in sorted(latest.items(), key=lambda x: max(x[1]), reverse=True):
        print(f'  {src:<35}  count={len(tss):>6,}  latest={max(tss)[:19]}')

    # 3. Overture-only duplicates
    sep('3. Overture duplicate check (name+city+country)')
    overture = [f for f in farms if (f.get('source') or '').lower() == 'overture']
    ov_key   = Counter((f.get('name',''), f.get('city',''), f.get('country',''))
                       for f in overture)
    dups = sorted([(k, v) for k, v in ov_key.items() if v > 1],
                  key=lambda x: x[1], reverse=True)
    print(f'  Overture total rows : {len(overture):,}')
    print(f'  Duplicate groups    : {len(dups)}')
    for (name, city, country), cnt in dups[:20]:
        print(f'    [{cnt}x] {repr(name)}  {city}  {country}')

    # 4. Rows added per day since 2026-05-16
    sep('4. New rows per day since 2026-05-16')
    by_day = Counter()
    for f in farms:
        d = (f.get('created_at') or '')[:10]
        if d >= '2026-05-16':
            by_day[d] += 1
    for day in sorted(by_day, reverse=True):
        print(f'  {day}   {by_day[day]:>5,} rows')

    # 5. All-time day summary
    sep('5. All-time rows per creation date')
    all_days = Counter((f.get('created_at') or '')[:10] for f in farms)
    for day in sorted(all_days, reverse=True):
        print(f'  {day}   {all_days[day]:>6,}')

    # 6. Cross-source duplicates
    sep('6. Cross-source duplicates (same name+city+country)')
    all_key = defaultdict(list)
    for f in farms:
        key = ((f.get('name') or '').strip().lower(),
               (f.get('city') or '').strip().lower(),
               (f.get('country') or '').strip().upper())
        all_key[key].append(f.get('source') or 'NULL')
    cross = sorted([(k, srcs) for k, srcs in all_key.items() if len(srcs) > 1],
                   key=lambda x: len(x[1]), reverse=True)
    print(f'  Total duplicate groups (any source): {len(cross):,}')
    for (name, city, country), srcs in cross[:20]:
        sc = Counter(srcs)
        print(f'    [{len(srcs)}x] {repr(name)}  {city}  {country}  {dict(sc)}')

if __name__ == '__main__':
    main()
