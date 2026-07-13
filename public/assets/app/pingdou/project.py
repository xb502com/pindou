from __future__ import annotations

import json
from dataclasses import asdict, is_dataclass
from typing import Any

import numpy as np


def _json_default(obj: Any):
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if is_dataclass(obj):
        return asdict(obj)
    if isinstance(obj, set):
        return sorted(obj)
    raise TypeError(f'Object of type {type(obj).__name__} is not JSON serializable')


def dumps_project(data: dict) -> str:
    payload = {'version': 7, **data}
    return json.dumps(payload, ensure_ascii=False, indent=2, default=_json_default)


def loads_project(text: str) -> dict:
    data = json.loads(text)
    if int(data.get('version', 0)) > 7:
        raise ValueError('project version is newer than this app')
    return data
