# -*- coding: utf-8 -*-
"""
Импорт классовых умений SRD 5.1 из открытого репозитория системы D&D 5e для Foundry VTT
(https://github.com/foundryvtt/dnd5e, данные SRD — CC BY 4.0, код — MIT).

Собирает src/lib/combat/data/srd-class-features.json: умения 12 классов и SRD-архетипов
с уровнем получения, стоимостью применения, зарядами и восстановлением, общими запасами
(ци, Канал божественности…), формулами лечения/урона/спасбросков и таблицами роста по уровням.
Русские названия и описания — в srd-class-features-ru.json (правится вручную).

Запуск (нужны python3 и PyYAML):
  git clone --depth 1 https://github.com/foundryvtt/dnd5e /tmp/fvtt-dnd5e
  python scripts/import-foundry-class-features.py /tmp/fvtt-dnd5e
"""

import json
import os
import re
import subprocess
import sys

import yaml

if len(sys.argv) < 2:
    sys.exit("Укажите путь к клону foundryvtt/dnd5e")

ROOT = sys.argv[1]
PACKS = os.path.join(ROOT, "packs", "_source")
OUT = os.path.join(os.path.dirname(__file__), "..", "src", "lib", "combat", "data", "srd-class-features.json")


def load(path):
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def walk_yaml(folder):
    for dp, _, files in os.walk(folder):
        for name in sorted(files):
            if name.endswith(".yml") and not name.startswith("_"):
                yield load(os.path.join(dp, name))


def uuid_id(uuid):
    return uuid.split(".")[-1] if uuid else None


# ---------- умения ----------
raw_features = {}
for doc in walk_yaml(os.path.join(PACKS, "classfeatures")):
    if doc.get("type") == "feat":
        raw_features[doc["_id"]] = doc

# ---------- классы и архетипы: какие умения на каком уровне, таблицы роста ----------
grants = {}  # _id умения -> [(класс, архетип, уровень, выбор?)] — общие умения выдаются нескольким классам
scales = {}
subclasses = []
classes = []


def read_advancement(owner_key, class_key, subclass_key, advancement):
    for adv in advancement or []:
        cfg = adv.get("configuration") or {}
        kind = adv.get("type")
        if kind == "ItemGrant":
            for item in cfg.get("items") or []:
                fid = uuid_id(item.get("uuid") if isinstance(item, dict) else item)
                grants.setdefault(fid, []).append((class_key, subclass_key, adv.get("level") or 1, False))
        elif kind == "ItemChoice":
            first_level = min(int(l) for l in (cfg.get("choices") or {"1": 0}).keys())
            for item in cfg.get("pool") or []:
                fid = uuid_id(item.get("uuid") if isinstance(item, dict) else item)
                grants.setdefault(fid, []).append((class_key, subclass_key, first_level, True))
        elif kind == "ScaleValue":
            ident = cfg.get("identifier")
            table = {}
            for lvl, val in (cfg.get("scale") or {}).items():
                if cfg.get("type") == "dice":
                    table[str(lvl)] = f"{val.get('number') or 1}d{val.get('faces')}"
                elif cfg.get("type") == "distance":
                    table[str(lvl)] = val.get("value")
                else:
                    table[str(lvl)] = val.get("value")
            scales[f"{owner_key}.{ident}"] = {"type": cfg.get("type"), "scale": table}


for doc in walk_yaml(os.path.join(PACKS, "classes")):
    key = doc["system"].get("identifier") or doc["name"].lower()
    classes.append({"key": key, "nameEn": doc["name"]})
    read_advancement(key, key, None, doc["system"].get("advancement"))

for doc in walk_yaml(os.path.join(PACKS, "subclasses")):
    key = doc["system"].get("identifier")
    class_key = doc["system"].get("classIdentifier")
    subclasses.append({"key": key, "className": class_key, "nameEn": doc["name"]})
    read_advancement(key, class_key, key, doc["system"].get("advancement"))


# ---------- нормализация ----------
def formula_of(part):
    """Формула урона/лечения Foundry -> строка вида '2d8 + @mod'"""
    if not part:
        return None
    custom = part.get("custom") or {}
    if custom.get("enabled") and custom.get("formula"):
        return str(custom["formula"]).strip()
    dice = f"{part['number']}d{part['denomination']}" if part.get("number") and part.get("denomination") else ""
    bonus = str(part.get("bonus") or "").strip()
    if dice and bonus:
        return f"{dice} + {bonus}"
    return dice or bonus or None


def ident_of(doc):
    return doc["system"].get("identifier") or re.sub(r"[^a-z0-9]+", "-", doc["name"].lower()).strip("-")


def key_of(fid, class_key=None):
    """Ключ умения «класс-или-архетип/идентификатор»; для общих умений — у класса class_key"""
    doc = raw_features.get(fid)
    if not doc:
        return None
    options = grants.get(fid) or [(None, None, None, None)]
    grant = next((g for g in options if class_key and g[0] == class_key), options[0])
    return f"{grant[1] or grant[0] or 'shared'}/{ident_of(doc)}"


identifier_index = {}
for fid, doc in raw_features.items():
    identifier_index.setdefault(ident_of(doc), []).append(fid)


def by_identifier(ident, class_key):
    """Запас по идентификатору: Канал божественности жреца и паладина — разные"""
    fids = identifier_index.get(ident) or []
    own = [f for f in fids if any(g[0] == class_key for g in grants.get(f, []))]
    fid = (own or fids or [None])[0]
    return key_of(fid, class_key) if fid else None


def consumption(cons, own_key, class_key):
    out = []
    for t in (cons or {}).get("targets") or []:
        if t.get("type") == "spellSlots":
            out.append({"pool": "spellSlot", "amount": str(t.get("value")), "slotLevel": t.get("target")})
            continue
        if t.get("type") not in ("itemUses", "activityUses"):
            continue
        target = t.get("target") or ""
        if not target:
            pool = own_key
        elif target.startswith("Compendium."):
            pool = key_of(uuid_id(target), class_key)
        elif target.startswith("feat:"):
            pool = by_identifier(target.split(":", 1)[1], class_key)
        else:
            pool = key_of(target, class_key)
        if pool:
            out.append({"pool": pool, "amount": str(t.get("value") or "1")})
    return out


def activity(act, own_key, class_key):
    target = act.get("target") or {}
    tpl = target.get("template") or {}
    rng = act.get("range") or {}
    dur = act.get("duration") or {}
    out = {
        "type": act.get("type"),
        "name": act.get("name") or None,
        "activation": (act.get("activation") or {}).get("type") or None,
        "condition": (act.get("activation") or {}).get("condition") or None,
        "target": (target.get("affects") or {}).get("type") or None,
        "targetCount": (target.get("affects") or {}).get("count") or None,
        "range": {"units": rng.get("units"), "value": rng.get("value")} if rng.get("units") else None,
        "template": {"type": tpl.get("type"), "size": tpl.get("size")} if tpl.get("type") else None,
        "duration": {"value": dur.get("value"), "units": dur.get("units")} if dur.get("units") else None,
        "consumes": consumption(act.get("consumption"), own_key, class_key),
    }
    if act.get("type") == "heal":
        out["heal"] = formula_of(act.get("healing"))
        out["healTypes"] = (act.get("healing") or {}).get("types") or []
    if act.get("type") in ("damage", "save", "attack"):
        parts = []
        for p in (act.get("damage") or {}).get("parts") or []:
            parts.append({"formula": formula_of(p), "types": p.get("types") or []})
        out["damage"] = parts
    if act.get("type") == "save":
        save = act.get("save") or {}
        abil = save.get("ability")
        out["save"] = {
            "ability": abil[0] if isinstance(abil, list) and abil else abil,
            "dc": (save.get("dc") or {}).get("calculation") or (save.get("dc") or {}).get("formula") or None,
            "onSave": (act.get("damage") or {}).get("onSave"),
        }
    if act.get("type") == "attack":
        out["attack"] = {"type": ((act.get("attack") or {}).get("type") or {}).get("value")}
    return {k: v for k, v in out.items() if v not in (None, [], {})}


features = []
seen = set()
for fid, doc in raw_features.items():
    # умения, которые не выдаёт ни один класс SRD (общие черты), пропускаем
    for class_key, subclass_key, level, choice in grants.get(fid, []):
        key = f"{subclass_key or class_key}/{ident_of(doc)}"
        if key in seen:
            continue
        seen.add(key)
        sysd = doc["system"]
        uses = sysd.get("uses") or {}
        recovery = [r.get("period") for r in uses.get("recovery") or [] if r.get("period")]
        acts = [activity(a, key, class_key) for a in (sysd.get("activities") or {}).values()]
        features.append({
            "key": key,
            "nameEn": doc["name"],
            "className": class_key,
            "subclass": subclass_key,
            "level": int(level),
            "choice": choice,
            "uses": {"max": str(uses.get("max")), "recovery": recovery} if uses.get("max") else None,
            "activities": acts,
            "hasEffects": bool(doc.get("effects")),
        })

features.sort(key=lambda f: (f["className"] or "", f["subclass"] or "", f["level"], f["key"]))

try:
    commit = subprocess.check_output(["git", "-C", ROOT, "rev-parse", "HEAD"], text=True).strip()
except Exception:
    commit = None

result = {
    "source": {
        "repository": "https://github.com/foundryvtt/dnd5e",
        "commit": commit,
        "notice": (
            "This work includes material taken from the System Reference Document 5.1 (\"SRD 5.1\") by "
            "Wizards of the Coast LLC and available at https://dnd.wizards.com/resources/systems-reference-document. "
            "The SRD 5.1 is licensed under the Creative Commons Attribution 4.0 International License available at "
            "https://creativecommons.org/licenses/by/4.0/legalcode. Structured data adapted from the Foundry VTT "
            "D&D 5e system (MIT License, Copyright 2021 Andrew Clayton)."
        ),
    },
    "classes": sorted(classes, key=lambda c: c["key"]),
    "subclasses": sorted(subclasses, key=lambda s: s["key"]),
    "scales": dict(sorted(scales.items())),
    "features": features,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump(result, f, ensure_ascii=False, indent=1)
    f.write("\n")

print(f"Умений: {len(features)}, таблиц роста: {len(scales)}, архетипов: {len(subclasses)} -> {OUT}")
