"""Source breakdown table: NL / BE / Total per data source."""
import json, os, urllib.request
from collections import defaultdict, Counter
from dotenv import load_dotenv

load_dotenv('.env.local')
URL = os.getenv('NEXT_PUBLIC_SUPABASE_URL', '').rstrip('/')
KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY', '')

def fetch_all():
    farms, offset = [], 0
    cols = 'source,country,created_at'
    while True:
        req = urllib.request.Request(
            f'{URL}/rest/v1/farms?select={cols}&offset={offset}&limit=1000&order=id',
            headers={'apikey': KEY, 'Authorization': f'Bearer {KEY}', 'Accept': 'application/json'})
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.loads(r.read())
        farms.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return farms

print('Fetching...', flush=True)
farms = fetch_all()
print(f'Total: {len(farms):,}\n')

# Aggregate
stats = defaultdict(lambda: {'NL': 0, 'BE': 0, 'OTHER': 0,
                              'first': '9999', 'last': '0000'})
for f in farms:
    src = f.get('source') or 'unknown'
    ctry = (f.get('country') or 'OTHER').upper()
    key = ctry if ctry in ('NL', 'BE') else 'OTHER'
    stats[src][key] += 1
    d = (f.get('created_at') or '')[:10]
    if d < stats[src]['first']: stats[src]['first'] = d
    if d > stats[src]['last']:  stats[src]['last']  = d

# Source display names
LABELS = {
    'osm':         'OpenStreetMap',
    'overture':    'Overture Maps',
    'foursquare':  'Foursquare',
    'traces':      'TRACES (EU)',
    'fish_import': 'Fish DB',
    'unknown':     'Unknown',
}

# Sort by total descending
rows = sorted(stats.items(), key=lambda x: -(x[1]['NL']+x[1]['BE']+x[1]['OTHER']))

total_nl = sum(v['NL'] for _, v in rows)
total_be = sum(v['BE'] for _, v in rows)
total_ot = sum(v['OTHER'] for _, v in rows)
grand    = total_nl + total_be + total_ot

W = 18  # column width

# Header
print(f'{"Source":<22} {"NL":>{W}} {"BE":>{W}} {"Other":>8} {"Total":>{W}} {"Share":>7}  {"Imported"}')
print('-' * 100)

for src, v in rows:
    nl    = v['NL'];  be = v['BE'];  ot = v['OTHER']
    tot   = nl + be + ot
    share = tot / grand * 100
    label = LABELS.get(src, src.title())
    date_range = v['first'] if v['first'] == v['last'] else f"{v['first']} -> {v['last']}"
    print(f'{label:<22} {nl:>{W},} {be:>{W},} {ot:>8,} {tot:>{W},} {share:>6.1f}%  {date_range}')

print('-' * 100)
print(f'{"TOTAL":<22} {total_nl:>{W},} {total_be:>{W},} {total_ot:>8,} {grand:>{W},} {"100.0%":>7}')

print()
print('NL share of total:', f'{total_nl/grand*100:.1f}%')
print('BE share of total:', f'{total_be/grand*100:.1f}%')
