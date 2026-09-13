#!/usr/bin/env python3
"""Read public MediaWiki facts without executing Lua/HTML; atomically refresh catalog."""
import argparse
import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WIKI = 'https://stealanegg.fandom.com'


def api(**params):
    url = WIKI + '/api.php?' + urllib.parse.urlencode(dict(format='json', **params))
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'EggQuestCatalog/1.0 (sibatlet.github.io/steal-an-egg-guide)'})
            with urllib.request.urlopen(request, timeout=45) as response:
                data = json.load(response)
            if 'error' in data:
                raise ValueError(str(data['error']))
            return data
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def wiki_url(title):
    return WIKI + '/wiki/' + urllib.parse.quote(title.replace(' ', '_'), safe=':')


def content(page):
    return page.get('revisions', [{}])[0].get('*', '')


def clean(value):
    value = re.sub(r'\[\[(?:[^]|]+\|)?([^]]+)\]\]', r'\1', value)
    value = re.sub(r'<[^>]*>|\{\{.*?\}\}|\}\}', '', value)
    return html.unescape(value.replace("'''", '').strip())[:300]


def income(value):
    match = re.fullmatch(r'\$?([\d,.]+)\s*([KMBT]?)/s', value.strip(), re.I)
    if not match:
        return None
    return float(match[1].replace(',', '')) * {'': 1, 'K': 1e3, 'M': 1e6, 'B': 1e9, 'T': 1e12}[match[2].upper()]


def parse_module(source):
    # Accept only flat string fields. Never execute community Lua or source code.
    source = re.sub(r'--\[\[.*?\]\]|--[^\n]*', '', source, flags=re.S)
    pets = {}
    rarity = None
    pattern = r'^\s*(\w+)\s*=\s*\{|\["([^"\n]+)"\]\s*=\s*\{([^{}]*)\}'
    for match in re.finditer(pattern, source, re.M):
        if match[1]:
            rarity = match[1]
            continue
        fields = dict(re.findall(r'(\w+)\s*=\s*"([^"\n]*)"', match[3]))
        if not rarity or not all(key in fields for key in ('income', 'biome', 'image')):
            raise ValueError('Wiki module format changed; preserve previous catalog.')
        name = match[2]
        if name in pets or income(fields['income']) is None:
            raise ValueError('Duplicate pet or invalid base income: ' + name)
        pets[name] = dict(name=name, group=rarity, rarity=rarity, **fields)
    expected = len(re.findall(r'\["[^"\n]+"\]\s*=', source))
    if len(pets) != expected or len(pets) < 100:
        raise ValueError('Incomplete wiki module; preserve previous catalog.')
    return pets


def detail_fields(source):
    match = re.search(r'\{\{Detail\b(.*?)\}\}', source, re.S | re.I)
    if not match:
        return {}
    return {k: clean(v) for k, v in re.findall(r'\|\s*(\w+)\s*=\s*(.*?)(?=\|\s*\w+\s*=|$)', match[1], re.S)}


def revisions(titles):
    result = {}
    titles = sorted(set(titles))
    for start in range(0, len(titles), 40):
        data = api(action='query', prop='revisions', rvprop='content|ids|timestamp', redirects=1, titles='|'.join(titles[start:start + 40]))
        result.update((p['title'], p) for p in data['query']['pages'].values())
    return result


def build(module, pages, images):
    pets = parse_module(content(module))
    details = {}
    for title, page in pages.items():
        fields = detail_fields(content(page))
        name = fields.get('pet_name')
        if name and fields.get('mps') and income(fields['mps']) is not None:
            details[name] = (fields, page)
            if name not in pets:
                pets[name] = dict(name=name, group=fields.get('rarity', 'Unknown'), rarity=fields.get('rarity', 'Unknown'),
                                  biome=fields.get('biome', ''), income=fields['mps'], image=fields.get('pet_image', ''))
    # Compare structured income facts on biome pages as well as pet pages.
    claims = {}
    for title, page in pages.items():
        for tag in re.findall(r'<div\b[^>]*>', content(page)):
            attrs = dict(re.findall(r'(data-[\w-]+)="([^"]*)"', tag))
            if attrs.get('data-name') in pets and income(attrs.get('data-mps', '')) is not None:
                claims.setdefault(attrs['data-name'], []).append((income(attrs['data-mps']), title))
    result = []
    for name, pet in pets.items():
        fields, page = details.get(name, ({}, pages.get(name, {})))
        amount = income(pet['income'])
        variants = {amount}
        sources = [wiki_url('Module:Pets/Data')]
        if page and 'missing' not in page:
            sources.append(wiki_url(page['title']))
        if fields.get('mps'):
            variants.add(income(fields['mps']))
        for other, title in claims.get(name, []):
            if other != amount:
                variants.add(other)
                sources.append(wiki_url(title))
        notes = []
        if len(variants) > 1:
            notes.append('Доход различается на страницах вики. Значения приведены в подробностях; точный доход проверь в игре.')
        if fields.get('rarity') and fields['rarity'] != pet['rarity']:
            if pet['group'] in ('Brainrot', 'Monster', 'Event'):
                pet['rarity'] = fields['rarity']
            else:
                notes.append('Редкость различается на страницах вики: ' + pet['rarity'] + ' / ' + fields['rarity'] + '.')
        if fields.get('biome') and fields['biome'] != pet['biome'] and fields['biome'] != 'Event':
            # Angels/Demons are subareas of the combined biome.
            if not (pet['biome'] == 'Angels & Demons' and fields['biome'] in ('Angels', 'Demons')):
                notes.append('Локация различается на страницах вики: ' + pet['biome'] + ' / ' + fields['biome'] + '.')
        img = images.get('File:' + pet['image'].replace('_', ' '), {})
        img_url = img.get('thumburl') or img.get('url')
        if img_url and urllib.parse.urlparse(img_url).hostname != 'static.wikia.nocookie.net':
            img_url = None
        revision = page.get('revisions', [{}])[0]
        result.append(dict(name=name, rarity=pet['rarity'], group=pet['group'], biome=pet['biome'] if pet['biome'] != '.' else '',
                           income=amount if len(variants) == 1 else None, incomeVariants=sorted(variants), egg=fields.get('egg_name') or (pet['biome'] if pet['biome'].endswith(' Egg') else None),
                           growTime=fields.get('grow_time') or None, reward=fields.get('reward') or None,
                           image=img_url, imageSource=wiki_url('File:' + pet['image']) if img_url else None,
                           notes=notes, sources=list(dict.fromkeys(sources)), revision=revision.get('revid')))
    result.sort(key=lambda p: p['name'].casefold())
    rev = module['revisions'][0]
    return dict(schemaVersion=1, checkedAt=dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
                source=wiki_url('Pets'), moduleRevision=rev['revid'], moduleUpdatedAt=rev['timestamp'],
                license='CC BY-SA (Fandom; individual images may have separate terms)', pets=result)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/pets.json')
    args = parser.parse_args()
    module = revisions(['Module:Pets/Data'])['Module:Pets/Data']
    pets = parse_module(content(module))
    names = set(pets)
    continuation = {}
    while True:
        listing = api(action='query', list='allpages', apnamespace=0, aplimit=500, **continuation)
        names.update(p['title'] for p in listing['query']['allpages'])
        if len(names) > 2000:
            raise ValueError('Unexpected wiki size; manual review needed.')
        continuation = listing.get('continue')
        if not continuation:
            break
    pages = revisions(names)
    files = {'File:' + p['image'] for p in pets.values()}
    for page in pages.values():
        fields = detail_fields(content(page))
        if fields.get('pet_image'):
            files.add('File:' + fields['pet_image'])
    images = {}
    files = sorted(files)
    for start in range(0, len(files), 40):
        data = api(action='query', prop='imageinfo', iiprop='url', iiurlwidth=240, titles='|'.join(files[start:start + 40]))
        images.update((p['title'], p.get('imageinfo', [{}])[0]) for p in data['query']['pages'].values())
    data = build(module, pages, images)
    if args.output.exists():
        previous = json.loads(args.output.read_text())
        if len(data['pets']) < len(previous['pets']) * .9:
            raise ValueError('More than 10% of pets disappeared; preserve previous catalog and review source.')
        for field in ('growTime', 'image', 'reward'):
            old_count = sum(bool(p.get(field)) for p in previous['pets'])
            new_count = sum(bool(p.get(field)) for p in data['pets'])
            if old_count and new_count < old_count * .8:
                raise ValueError('Too many missing ' + field + ' values; preserve previous catalog and review source.')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(args.output)
    print(json.dumps({'pets': len(data['pets']), 'incomeConflicts': sum(p['income'] is None for p in data['pets']), 'checkedAt': data['checkedAt']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
