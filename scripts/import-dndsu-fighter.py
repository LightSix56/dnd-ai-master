#!/usr/bin/env python3
"""Сборка src/lib/combat/data/fighter-dndsu.json из выгрузки dnd.su (подклассы Воина, редакция 2014).

Вход — fighter-subclasses.json гибридной выгрузки (список умений с вариантами: приёмы, руны, выстрелы,
псионические силы). Скрипт проставляет умениям и вариантам латинские идентификаторы (на них ссылается
src/lib/combat/fighter-subclasses.ts) и проверяет, что ничего не потеряно.

Запуск: python scripts/import-dndsu-fighter.py <fighter-subclasses.json> [выход.json]
"""
import json
import sys
from pathlib import Path

SUBCLASSES = {
    "Мастер боевых искусств": "battlemaster",
    "Мистический рыцарь": "eldritch-knight",
    "Чемпион": "champion",
    "Рыцарь Пурпурного дракона": "banneret",
    "Кавалерист": "cavalier",
    "Мистический лучник": "arcane-archer",
    "Самурай": "samurai",
    "Рыцарь Эха": "echo-knight",
    "Пси-воин": "psi-warrior",
    "Рунный рыцарь": "rune-knight",
}

FEATURES = {
    ("battlemaster", "Боевое превосходство"): "combat-superiority",
    ("battlemaster", "Ученик войны"): "student-of-war",
    ("battlemaster", "Познай своего врага"): "know-your-enemy",
    ("battlemaster", "Улучшенное боевое превосходство"): "improved-combat-superiority",
    ("battlemaster", "Неослабевающий"): "relentless",
    ("eldritch-knight", "Использование заклинаний"): "spellcasting",
    ("eldritch-knight", "Связь с оружием"): "weapon-bond",
    ("eldritch-knight", "Боевая магия"): "war-magic",
    ("eldritch-knight", "Мистический удар"): "eldritch-strike",
    ("eldritch-knight", "Волшебный рывок"): "arcane-charge",
    ("eldritch-knight", "Улучшенная боевая магия"): "improved-war-magic",
    ("champion", "Улучшенные критические попадания"): "improved-critical",
    ("champion", "Выдающийся атлет"): "remarkable-athlete",
    ("champion", "Дополнительный боевой стиль"): "additional-fighting-style",
    ("champion", "Превосходные критические попадания"): "superior-critical",
    ("champion", "Уцелевший"): "survivor",
    ("banneret", "Сплочающий крик"): "rallying-cry",
    ("banneret", "Посланник короны"): "royal-envoy",
    ("banneret", "Вдохновляющий всплеск"): "inspiring-surge",
    ("banneret", "Оплот"): "bulwark",
    ("cavalier", "Дополнительные владения"): "bonus-proficiencies",
    ("cavalier", "Непоколебимая метка"): "unwavering-mark",
    ("cavalier", "Рожденный в седле"): "born-to-the-saddle",
    ("cavalier", "Защитный маневр"): "warding-maneuver",
    ("cavalier", "Держать строй"): "hold-the-line",
    ("cavalier", "Свирепый натиск"): "ferocious-charger",
    ("cavalier", "Бдительный защитник"): "vigilant-defender",
    ("arcane-archer", "Знания мистического лучника"): "arcane-archer-lore",
    ("arcane-archer", "Магический выстрел"): "arcane-shot",
    ("arcane-archer", "Зачарованная стрела"): "magic-arrow",
    ("arcane-archer", "Странствующая стрела"): "curving-shot",
    ("arcane-archer", "Выстрел всегда наготове"): "ever-ready-shot",
    ("samurai", "Дополнительные владения"): "bonus-proficiencies",
    ("samurai", "Боевой дух"): "fighting-spirit",
    ("samurai", "Элегантный придворный"): "elegant-courtier",
    ("samurai", "Неутомимая душа"): "tireless-spirit",
    ("samurai", "Стремительный удар"): "rapid-strike",
    ("samurai", "Стойкость перед смертью"): "strength-before-death",
    ("echo-knight", "Манифест эха"): "manifest-echo",
    ("echo-knight", "Раскрыть потенциал"): "unleash-incarnation",
    ("echo-knight", "Аватар эха"): "echo-avatar",
    ("echo-knight", "Эхо-мученик"): "shadow-martyr",
    ("echo-knight", "Поглотить потенциал"): "reclaim-potential",
    ("echo-knight", "Легион единого"): "legion-of-one",
    ("psi-warrior", "Псионическая сила"): "psionic-power",
    ("psi-warrior", "Адепт-телекинетик"): "telekinetic-adept",
    ("psi-warrior", "Защищённый разум"): "guarded-mind",
    ("psi-warrior", "Оплот силы"): "bulwark-of-force",
    ("psi-warrior", "Мастер телекинеза"): "telekinetic-master",
    ("rune-knight", "Бонусные владения"): "bonus-proficiencies",
    ("rune-knight", "Резчик рун"): "rune-carver",
    ("rune-knight", "Мощь великана"): "giants-might",
    ("rune-knight", "Рунический щит"): "runic-shield",
    ("rune-knight", "Великий рост"): "great-stature",
    ("rune-knight", "Мастер рун"): "master-of-runes",
    ("rune-knight", "Рунический джаггернаут"): "runic-juggernaut",
}

OPTIONS = {
    "Активное уклонение": "evasive-footwork", "Атака с выпадом": "lunging-attack",
    "Атака с манёвром": "maneuvering-attack", "Атака с угрозой": "menacing-attack",
    "Атака с финтом": "feinting-attack", "Обезоруживающая атака": "disarming-attack",
    "Опрокидывающая атака": "trip-attack", "Ответный удар": "riposte",
    "Отвлекающий удар": "distracting-strike", "Парирование": "parry",
    "Провоцирующая атака": "goading-attack", "Сплочение": "rally",
    "Толкающая атака": "pushing-attack", "Точная атака": "precision-attack",
    "Удар командующего": "commanders-strike", "Широкая атака": "sweeping-attack",
    "Атака с захватом": "grappling-strike", "Быстрый бросок": "quick-toss",
    "Готовность": "brace", "Засада": "ambush", "Командирский напор": "commanding-presence",
    "Подмена": "bait-and-switch", "Тактическая оценка": "tactical-assessment",
    "Взрывная стрела": "bursting-arrow", "Изгоняющая стрела": "banishing-arrow",
    "Ищущая стрела": "seeking-arrow", "Обманная стрела": "beguiling-arrow",
    "Ослабляющая стрела": "enfeebling-arrow", "Пронзающая стрела": "piercing-arrow",
    "Сжимающая стрела": "grasping-arrow", "Теневая стрела": "shadow-arrow",
    "Защитное поле": "protective-field", "Псионический удар": "psionic-strike",
    "Телекинетическое передвижение": "telekinetic-movement",
    "Усиленный пси-прыжок": "psi-powered-leap", "Телекинетический толчок": "telekinetic-thrust",
    "Каменная руна": "stone-rune", "Ледяная руна": "frost-rune", "Облачная руна": "cloud-rune",
    "Огненная руна": "fire-rune", "Холмовая руна": "hill-rune", "Штормовая руна": "storm-rune",
}


def main() -> None:
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent / "src/lib/combat/data/fighter-dndsu.json"
    rows = json.loads(src.read_text(encoding="utf-8"))

    features = []
    seen = set()
    for r in rows:
        sub = SUBCLASSES[r["subclass"]]
        fid = FEATURES[(sub, r["name"])]
        if (sub, fid) in seen:
            raise SystemExit(f"дубль {sub}/{fid}")
        seen.add((sub, fid))
        opts = [{"id": OPTIONS[o["name"]], "name": o["name"], "description": o["description"].strip()} for o in r.get("options", [])]
        features.append({
            "id": fid,
            "subclassId": sub,
            "subclass": r["subclass"],
            "level": r["level"],
            "name": r["name"],
            "description": r["description"].strip(),
            "source": r["source"],
            "options": opts,
        })

    if len(set(FEATURES.values())) and len(features) != len(FEATURES):
        raise SystemExit(f"умений {len(features)}, ожидалось {len(FEATURES)}")
    n_opts = sum(len(f["options"]) for f in features)
    if n_opts != len(OPTIONS):
        raise SystemExit(f"вариантов {n_opts}, ожидалось {len(OPTIONS)}")

    out = {
        "_note": "Подклассы Воина (редакция 2014) с dnd.su: умения и варианты на выбор (приёмы, магические выстрелы, псионические силы, руны). Собрано scripts/import-dndsu-fighter.py.",
        "source": {"site": "dnd.su", "edition": "2014"},
        "subclasses": [{"id": sid, "name": name} for name, sid in SUBCLASSES.items()],
        "features": features,
    }
    dst.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"подклассов {len(SUBCLASSES)}, умений {len(features)}, вариантов {n_opts} -> {dst}")


if __name__ == "__main__":
    main()
