#!/usr/bin/env python3
"""DDR WORLD ALL MUSIC -> public/data/songs.json (experimental HTML parser)."""
import argparse
import hashlib
import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup, Tag

BASE = 'https://p.eagate.573.jp/game/ddr/ddrworld/music/index.html'
LEVEL_RE = re.compile(r'Lv\.?\s*(\d{1,2}|[-－])', re.I)
SP_RE = re.compile(r'\bSP\b', re.I)
DP_RE = re.compile(r'\bDP\b', re.I)
HEADERS = {'User-Agent': 'Mozilla/5.0 (compatible; Personal-DDR-Memo/0.1)', 'Accept-Language': 'ja,en;q=0.8'}


def clean(s):
    return re.sub(r'\s+', ' ', s or '').strip()


def image_url(img, page_url):
    if not img:
        return None
    for key in ('data-src', 'data-original', 'src'):
        raw = img.get(key)
        if raw and not raw.startswith('data:'):
            url = urljoin(page_url, raw)
            if urlparse(url).scheme == 'https':
                return url
    return None


def find_rows(soup):
    """Look for the smallest element containing a complete SP+DP level block."""
    rows = []
    for sp_text in soup.find_all(string=lambda t: bool(t and SP_RE.search(str(t)))):
        node = sp_text.parent
        for _ in range(7):
            if not isinstance(node, Tag):
                break
            text = clean(node.get_text(' ', strip=True))
            sp = SP_RE.search(text)
            dp = DP_RE.search(text)
            if sp and dp and sp.start() < dp.start():
                levels = LEVEL_RE.findall(text[sp.end():dp.start()])
                if len(levels) == 5 and node.find('img'):
                    # Prefer a compact song element; avoid wrapping multiple songs.
                    if len(LEVEL_RE.findall(text)) <= 12:
                        rows.append(node)
                        break
            node = node.parent
    unique = []
    for row in rows:
        if row not in unique:
            unique.append(row)
    return unique


def parse_row(row, page_url):
    text = clean(row.get_text(' ', strip=True))
    sp = SP_RE.search(text)
    dp = DP_RE.search(text)
    if not sp or not dp or sp.start() >= dp.start():
        raise ValueError('SP/DP欄が見つかりません')
    levels = LEVEL_RE.findall(text[sp.end():dp.start()])
    if len(levels) != 5:
        raise ValueError(f'SPの難易度数が5ではありません: {levels}')
    prefix = clean(text[:sp.start()])
    # Site markup may separate title/artist into dedicated elements. Use those first.
    title_node = row.select_one('.music_name, .music-title, .music_title, .title, .name')
    artist_node = row.select_one('.artist_name, .music_artist, .artist')
    title = clean(title_node.get_text(' ', strip=True)) if title_node else ''
    artist = clean(artist_node.get_text(' ', strip=True)) if artist_node else ''
    if not title:
        # Ambiguous combined text cannot safely be split into title and artist.
        raise ValueError(f'曲名を特定できません。HTMLのセレクタ調整が必要: {prefix[:100]}')
    if not artist:
        artist = None
    charts = []
    for difficulty, index in (('expert', 3), ('challenge', 4)):
        value = levels[index]
        if value not in ('-', '－'):
            level = int(value)
            if not 1 <= level <= 19:
                raise ValueError(f'不正なレベル: {level}')
            charts.append({'difficulty': difficulty, 'level': level})
    img = row.find('img')
    jacket = image_url(img, page_url)
    # Stable across repeated runs, independent of ordering and pagination.
    key = title + '\x00' + (artist or '')
    song_id = 'ddr-' + hashlib.sha256(key.encode('utf-8')).hexdigest()[:16]
    return {'id': song_id, 'title': title, 'artist': artist, 'sortKey': title, 'jacketUrl': jacket, 'charts': charts}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--pages', type=int, default=27, help='ページ数 (既定: 27)')
    p.add_argument('--output', default='public/data/songs.json')
    p.add_argument('--debug-dir', default='scrape-debug')
    p.add_argument('--delay', type=float, default=1.5)
    args = p.parse_args()
    if args.pages < 1 or args.delay < 0:
        p.error('--pages は1以上、--delay は0以上にしてください')
    debug = Path(args.debug_dir)
    debug.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update(HEADERS)
    all_songs = []
    try:
        for offset in range(args.pages):
            resp = session.get(BASE, params={'offset': offset, 'filter': 7}, timeout=30)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding if resp.encoding.lower() == 'iso-8859-1' else resp.encoding
            html = resp.text
            (debug / f'page-{offset:02}.html').write_text(html, encoding='utf-8')
            soup = BeautifulSoup(html, 'html.parser')
            rows = find_rows(soup)
            print(f'page {offset + 1}/{args.pages}: {len(rows)}件の候補', flush=True)
            if offset == 0 and len(rows) != 50:
                raise ValueError(f'先頭ページの曲数が50ではありません ({len(rows)}件)。HTML構造を確認してください。')
            if not rows:
                raise ValueError(f'ページ{offset + 1}で曲が見つかりません')
            for i, row in enumerate(rows, 1):
                try:
                    all_songs.append(parse_row(row, resp.url))
                except Exception as exc:
                    (debug / f'problem-{offset:02}-{i:02}.html').write_text(str(row), encoding='utf-8')
                    raise ValueError(f'ページ{offset + 1} 曲{i}: {exc}') from exc
            if offset + 1 < args.pages:
                time.sleep(args.delay)
        ids = [song['id'] for song in all_songs]
        if len(ids) != len(set(ids)):
            raise ValueError('重複IDがあります。元データを確認してください')
        if args.pages == 27 and len(all_songs) < 1000:
            raise ValueError(f'全曲取得として少なすぎます: {len(all_songs)}曲')
        out = Path(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        tmp = out.with_suffix('.json.tmp')
        tmp.write_text(json.dumps(all_songs, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        tmp.replace(out)
        print(f'完了: {len(all_songs)}曲 -> {out}')
    except (requests.RequestException, ValueError) as exc:
        print(f'取得・解析エラー: {exc}', file=sys.stderr)
        print(f'HTMLの確認用ファイル: {debug.resolve()}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
