#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'

REQUIRED = [
    PUBLIC / 'index.html',
    PUBLIC / 'assets' / 'stlite' / 'bootstrap.js',
    PUBLIC / 'assets' / 'app' / 'main.py',
    PUBLIC / 'assets' / 'app' / 'browser_app.js',
    PUBLIC / 'assets' / 'app' / 'pingdou' / 'mask_cv.py',
    PUBLIC / 'assets' / 'palettes' / 'basic.json',
]

OPTIONAL_RUNTIME = [
    PUBLIC / 'assets' / 'pyodide' / 'pyodide.js',
    PUBLIC / 'assets' / 'pyodide' / 'pyodide.asm.wasm',
    PUBLIC / 'assets' / 'pyodide' / 'python_stdlib.zip',
]


def main() -> int:
    missing = [p for p in REQUIRED if not p.exists()]
    if missing:
        print('Missing required files:')
        for p in missing:
            print(' -', p.relative_to(ROOT))
        return 1
    missing_runtime = [p for p in OPTIONAL_RUNTIME if not p.exists()]
    if missing_runtime:
        print('Pyodide/stlite runtime assets not vendored yet; browser-native MVP can still run locally, but vendor them before a strict stlite production deploy:')
        for p in missing_runtime:
            print(' -', p.relative_to(ROOT))
    print('Static skeleton verification passed.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
