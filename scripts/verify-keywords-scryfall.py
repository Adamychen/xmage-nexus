#!/usr/bin/env python3
"""Verify official keyword wording per language via witness cards on Scryfall.
Search only indexes EN printings, but non-EN printings share set+number, so:
  1. exact-name search -> pick first non-promo paper expansion printing (EN)
  2. GET /cards/<set>/<cn>/<lang> for each target language directly
  3. print reminder-bearing lines (or first lines for evergreen w/o reminder)
Usage: python3 scripts/verify-keywords-scryfall.py "Ledger Shredder" ...
Read-only: no repo files are modified. 0.3s between requests.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

LANGS = ['es', 'de', 'fr', 'it', 'pt', 'ru', 'ja', 'zhs']
HDRS = {'User-Agent': 'XMageNexus-keyword-check/1.0 (dev research)',
        'Accept': 'application/json'}


def fetch(url):
    req = urllib.request.Request(url, headers=HDRS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def show(text, limit=160):
    lines = [ln.strip()[:limit] for ln in (text or '').split('\n')[:2]]
    return ' // '.join(x for x in lines if x)


def cn_key(c):
    m = __import__('re').match(r'\d+', str(c.get('collector_number') or ''))
    return int(m.group()) if m else 10**9


def has_reminder(text):
    return '(' in (text or '') or '（' in (text or '')


def pick_bases(data):
    cands = [c for c in data.get('data', [])
             if not c.get('digital') and not c.get('promo')
             and c.get('set_type') in ('expansion', 'core', 'starter', 'draft_innovation')]
    if not cands:
        return []
    by_set = {}
    for c in cands:
        by_set.setdefault(c.get('set'), []).append(c)
    sets = sorted(by_set, key=lambda s: min(x.get('released_at') or '' for x in by_set[s]))
    bases = []
    for s in sets[:3]:
        for c in sorted(by_set[s], key=cn_key)[:2]:
            bases.append((s, c.get('collector_number')))
    return bases


def fetch_lang(s, cn, lang):
    time.sleep(0.3)
    url = f'https://api.scryfall.com/cards/{s}/{urllib.parse.quote(str(cn))}/{lang}'
    try:
        return fetch(url)
    except urllib.error.HTTPError as e:
        return {'_http': e.code}
    except Exception as e:  # noqa: BLE001
        return {'_err': str(e)[:60]}


def check(name):
    print(f'===== {name} =====')
    q = urllib.parse.quote(f'!"{name}"')
    try:
        data = fetch(f'https://api.scryfall.com/cards/search?q={q}&unique=prints&order=released&dir=desc')
    except Exception as e:  # noqa: BLE001
        print(f'  [query failed: {e}]')
        return
    if data.get('total_cards', 0) == 0:
        print('  [no printings]')
        return
    resolved = 0
    for s, cn in pick_bases(data):
        print(f'  -- try {s}:{cn}')
        ok_here = 0
        for lang in LANGS:
            c = fetch_lang(s, cn, lang)
            if '_http' in c:
                print(f'  [{lang}] HTTP {c["_http"]} (no printing)')
                continue
            if '_err' in c:
                print(f'  [{lang}] err {c["_err"]}')
                continue
            ptext = c.get('printed_text') or ''
            tag = 'reminder' if has_reminder(ptext) else 'NO-REMINDER'
            lines = [ln.strip()[:150] for ln in ptext.split('\n')[:5]]
            print(f'  [{lang}] ({tag}) {" // ".join(x for x in lines if x)}')
            ok_here += 1
        resolved += ok_here
        if resolved >= 6:
            break


if __name__ == '__main__':
    names = sys.argv[1:] or ['Bloated Contaminator']
    for i, n in enumerate(names):
        if i:
            time.sleep(0.4)
        check(n)
