#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
FORBIDDEN = [
    'cdn.jsdelivr.net', 'unpkg.com', 'github.com', 'raw.githubusercontent.com', 'pypi.org', 'files.pythonhosted.org'
]
PATTERN = re.compile('|'.join(re.escape(x) for x in FORBIDDEN), re.I)


def main() -> int:
    offenders = []
    for path in PUBLIC.rglob('*'):
        if path.is_file() and path.suffix.lower() in {'.html', '.js', '.py', '.json', '.css'}:
            text = path.read_text(encoding='utf-8', errors='ignore')
            if PATTERN.search(text):
                offenders.append(path.relative_to(ROOT))
    if offenders:
        print('Forbidden external runtime references found:')
        for item in offenders:
            print(' -', item)
        return 1
    print('No forbidden external runtime references found in public/.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
