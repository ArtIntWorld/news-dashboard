"""Bundled configuration: the country list, Google News editions and section mapping.

Loaded once at startup. A bad file stops the service with a clear message rather than
letting it start with an empty list.
"""

import json
import re
from dataclasses import dataclass
from pathlib import Path

from .models import SECTIONS, Country

_CODE = re.compile(r"^[A-Z]{2}$")


class ConfigError(RuntimeError):
    """A bundled configuration file is missing or malformed."""


@dataclass(frozen=True)
class Edition:
    hl: str
    lang: str


@dataclass(frozen=True)
class SectionDef:
    keywords: str
    topic: str | None = None


@dataclass(frozen=True)
class Catalog:
    countries: list[Country]  # sorted by name
    by_code: dict[str, Country]
    editions: dict[str, Edition]
    sections: dict[str, SectionDef]

    def country(self, code: str) -> Country | None:
        return self.by_code.get(code.upper())


def _read_json(path: Path, what: str):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError as e:
        raise ConfigError(f"{what} file not found: {path}") from e
    except json.JSONDecodeError as e:
        raise ConfigError(f"{what} file is not valid JSON: {path}: {e}") from e


def load_countries(path: Path) -> list[Country]:
    raw = _read_json(path, "Country")
    if not isinstance(raw, list) or not raw:
        raise ConfigError(f"Country file must be a non-empty JSON array: {path}")
    seen: set[str] = set()
    out: list[Country] = []
    for i, row in enumerate(raw):
        if not isinstance(row, dict):
            raise ConfigError(f"Country file entry {i} is not an object: {path}")
        code = str(row.get("code", "")).strip().upper()
        name = str(row.get("name", "")).strip()
        if not _CODE.match(code) or not name:
            raise ConfigError(f"Country file entry {i} needs a 2-letter code and a name: {row!r}")
        if code in seen:
            raise ConfigError(f"Country file has duplicate code {code}")
        seen.add(code)
        out.append(Country(code=code, name=name))
    out.sort(key=lambda c: c.name.casefold())
    return out


def load_editions(path: Path, valid_codes: set[str]) -> dict[str, Edition]:
    raw = _read_json(path, "Editions")
    if not isinstance(raw, dict):
        raise ConfigError(f"Editions file must be a JSON object: {path}")
    out: dict[str, Edition] = {}
    for code, val in raw.items():
        if code.startswith("_"):
            continue
        code = code.upper()
        if code not in valid_codes:
            raise ConfigError(f"Editions file names unknown country {code}")
        if not isinstance(val, dict) or not val.get("lang"):
            raise ConfigError(f"Edition for {code} needs a lang: {val!r}")
        out[code] = Edition(hl=str(val.get("hl") or val["lang"]), lang=str(val["lang"]))
    return out


def load_sections(path: Path) -> dict[str, SectionDef]:
    raw = _read_json(path, "Sections")
    if not isinstance(raw, dict):
        raise ConfigError(f"Sections file must be a JSON object: {path}")
    out: dict[str, SectionDef] = {}
    for name in SECTIONS:
        val = raw.get(name)
        if not isinstance(val, dict) or not str(val.get("keywords", "")).strip():
            raise ConfigError(f"Sections file needs keywords for '{name}'")
        out[name] = SectionDef(keywords=str(val["keywords"]).strip(), topic=val.get("topic") or None)
    return out


def load_catalog(countries_file: Path, editions_file: Path, sections_file: Path) -> Catalog:
    countries = load_countries(countries_file)
    by_code = {c.code: c for c in countries}
    return Catalog(
        countries=countries,
        by_code=by_code,
        editions=load_editions(editions_file, set(by_code)),
        sections=load_sections(sections_file),
    )
