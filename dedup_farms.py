"""
De Lokale Boer -- Farm Deduplication Script
Strategy: within each source, group by (name+city+country),
keep the most complete record, delete the rest.
Completeness score: photo(4) + website(3) + phone(2) + hours(2) + address(1) + rating(1)
"""

import json, os, urllib.request, urllib.error
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv('.env.local')
SUPABASE_URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
SERVICE_KEY  = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

DEDUP_SOURCES = {'overture', 'osm', 'foursquare'}
BATCH_SIZE    = 50   # ids per DELETE request

# ---------------------------------------------------------------------------

def api_get(path):
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/{path}',
        headers={'apikey': SERVICE_KEY,
                 'Authorization': f'Bearer {SERVICE_KEY}',
                 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())

def api_delete_batch(ids):
    id_csv = ','.join(str(i) for i in ids)
    req = urllib.request.Request(
        f'{SUPABASE_URL}/rest/v1/farms?id=in.({id_csv})',
        headers={'apikey': SERVICE_KEY,
                 'Authorization': f'Bearer {SERVICE_KEY}',
                 'Prefer': 'return=minimal'},
        method='DELETE')
    with urllib.request.urlopen(req, timeout=60) as r:
        r.read()   # consume response

def fetch_all():
    cols = ('id,name,city,country,source,'
            'image,website,phone,opening_hours,address,avg_rating')
    farms, offset = [], 0
    print('Fetching all farms...', end='', flush=True)
    while True:
        chunk = api_get(f'farms?select={cols}&offset={offset}&limit=1000&order=id')
        farms.extend(chunk)
        print(f' {len(farms)}', end='', flush=True)
        if len(chunk) < 1000:
            break
        offset += 1000
    print()
    return farms

def score(f):
    return (bool(f.get('image'))         * 4 +
            bool(f.get('website'))       * 3 +
            bool(f.get('phone'))         * 2 +
            bool(f.get('opening_hours')) * 2 +
            bool(f.get('address'))       * 1 +
            bool(f.get('avg_rating'))    * 1)

def dup_key(f):
    return (
        (f.get('source') or '').lower(),
        (f.get('name')   or '').strip().lower(),
        (f.get('city')   or '').strip().lower(),
        (f.get('country') or '').strip().upper(),
    )

def find_dup_groups(farms):
    buckets = defaultdict(list)
    for f in farms:
        src = (f.get('source') or '').lower()
        if src in DEDUP_SOURCES:
            buckets[dup_key(f)].append(f)
    return {k: v for k, v in buckets.items() if len(v) > 1}

def plan(groups):
    """Returns (keep_list, delete_list)."""
    keep_list, del_list = [], []
    for _, grp in groups.items():
        ranked = sorted(grp, key=lambda f: (-score(f), f['id']))
        keep_list.append(ranked[0])
        del_list.extend(ranked[1:])
    return keep_list, del_list

# ---------------------------------------------------------------------------

def main():
    farms = fetch_all()
    total_before = len(farms)
    print(f'Total farms before dedup: {total_before:,}')

    groups = find_dup_groups(farms)

    # ------------------------------------------------------------------
    # DRY-RUN REPORT
    # ------------------------------------------------------------------
    src_stats = defaultdict(lambda: {'groups': 0, 'excess': 0})
    for (src, name, city, country), grp in groups.items():
        src_stats[src]['groups'] += 1
        src_stats[src]['excess'] += len(grp) - 1

    total_excess = sum(s['excess'] for s in src_stats.values())

    print(f'\nDuplicate groups found: {len(groups)}')
    print(f'Excess rows to delete : {total_excess}')
    print(f'Expected count after  : {total_before - total_excess:,}')
    print()
    print(f'{"Source":<15} {"Groups":>7} {"To delete":>10}')
    print('-' * 36)
    for src in sorted(src_stats):
        s = src_stats[src]
        print(f'{src:<15} {s["groups"]:>7} {s["excess"]:>10}')

    # Detailed list
    print('\n-- Detail (all duplicate groups) --')
    for (src, name, city, country), grp in sorted(
            groups.items(), key=lambda x: (-len(x[1]), x[0][0])):
        ranked = sorted(grp, key=lambda f: (-score(f), f['id']))
        keep = ranked[0]
        dels = ranked[1:]
        print(f'\n  [{src}] "{name}" | {city} | {country}  ({len(grp)} copies)')
        k = keep
        print(f'    KEEP  id={k["id"]}  score={score(k)}  '
              f'img={"Y" if k.get("image") else "N"}  '
              f'web={"Y" if k.get("website") else "N"}  '
              f'tel={"Y" if k.get("phone") else "N"}  '
              f'hrs={"Y" if k.get("opening_hours") else "N"}')
        for d in dels:
            print(f'    DEL   id={d["id"]}  score={score(d)}  '
                  f'img={"Y" if d.get("image") else "N"}  '
                  f'web={"Y" if d.get("website") else "N"}  '
                  f'tel={"Y" if d.get("phone") else "N"}  '
                  f'hrs={"Y" if d.get("opening_hours") else "N"}')

    # ------------------------------------------------------------------
    # EXECUTE DELETIONS
    # ------------------------------------------------------------------
    _, to_delete = plan(groups)
    delete_ids = [f['id'] for f in to_delete]

    print(f'\n-- Deleting {len(delete_ids)} records in batches of {BATCH_SIZE} --')
    errors = []
    deleted = 0
    for i in range(0, len(delete_ids), BATCH_SIZE):
        batch = delete_ids[i:i + BATCH_SIZE]
        try:
            api_delete_batch(batch)
            deleted += len(batch)
            pct = deleted / len(delete_ids) * 100
            print(f'  Progress: {deleted}/{len(delete_ids)}  ({pct:.0f}%)', end='\r')
        except urllib.error.HTTPError as e:
            body = e.read().decode()
            errors.append(f'Batch {i}-{i+BATCH_SIZE}: HTTP {e.code} -- {body}')
    print()

    # ------------------------------------------------------------------
    # FINAL REPORT
    # ------------------------------------------------------------------
    print('\n' + '=' * 55)
    if errors:
        print(f'COMPLETED WITH {len(errors)} ERRORS:')
        for err in errors:
            print(f'  {err}')
    else:
        print('Deduplication complete -- no errors')

    print(f'  Rows deleted   : {deleted}')
    print(f'  Before         : {total_before:,}')
    print(f'  Expected after : {total_before - deleted:,}')
    print('=' * 55)

if __name__ == '__main__':
    main()
