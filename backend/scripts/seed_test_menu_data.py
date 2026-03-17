#!/usr/bin/env python3
"""Bulk seed test menu data with fraction-based vegetable ingredient amounts.

Examples:
  python3 backend/scripts/seed_test_menu_data.py
  python3 backend/scripts/seed_test_menu_data.py --menu-masters 80 --days 42
"""

from __future__ import annotations

import argparse
import json
import random
import sys
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any
from urllib import error, request


@dataclass(frozen=True)
class IngredientTemplate:
    name: str
    unit: str
    supplier_kind: str


FRACTIONS = ["1/8", "1/6", "1/5", "1/4", "1/3", "1/2", "2/3", "3/4", "1"]
VEG_TEMPLATES = [
    IngredientTemplate("玉ねぎ", "玉", "veg"),
    IngredientTemplate("にんじん", "本", "veg"),
    IngredientTemplate("じゃがいも", "個", "veg"),
    IngredientTemplate("キャベツ", "玉", "veg"),
    IngredientTemplate("白菜", "玉", "veg"),
    IngredientTemplate("大根", "本", "veg"),
    IngredientTemplate("長ねぎ", "本", "veg"),
    IngredientTemplate("ピーマン", "個", "veg"),
    IngredientTemplate("ほうれん草", "束", "veg"),
    IngredientTemplate("もやし", "袋", "veg"),
    IngredientTemplate("れんこん", "節", "veg"),
    IngredientTemplate("ごぼう", "本", "veg"),
]
MEAT_TEMPLATES = [
    IngredientTemplate("豚こま肉", "g", "meat"),
    IngredientTemplate("鶏もも肉", "g", "meat"),
    IngredientTemplate("牛こま肉", "g", "meat"),
]
FISH_TEMPLATES = [
    IngredientTemplate("鮭", "切れ", "fish"),
    IngredientTemplate("さば", "切れ", "fish"),
    IngredientTemplate("白身魚", "切れ", "fish"),
]
COOP_TEMPLATES = [
    IngredientTemplate("米", "合", "coop"),
    IngredientTemplate("卵", "パック", "coop"),
    IngredientTemplate("牛乳", "パック", "coop"),
    IngredientTemplate("冷凍チャーハン", "袋", "coop"),
]
DISH_NAMES = [
    "野菜カレー", "肉じゃが", "野菜炒め", "八宝菜", "クリームシチュー",
    "ミネストローネ", "ポトフ", "豚汁", "けんちん汁", "回鍋肉",
    "中華丼", "焼きそば", "ちゃんぽん", "筑前煮", "白和え",
    "親子丼", "牛丼", "三色丼", "カツ丼", "天丼",
    "炊き込みご飯", "鮭ご飯", "五目ご飯", "チャーハン", "ドライカレー",
]
RICE_DISH_KEYWORDS = ("丼", "ご飯", "チャーハン", "カレー")
RICE_GO_AMOUNTS = ["0.5", "1", "1.5", "2", "2.5", "3"]
MEAT_DISH_KEYWORDS = ("肉", "牛", "豚", "鶏", "親子", "カツ", "回鍋肉", "焼きそば", "ちゃんぽん", "チャーハン")
FISH_DISH_KEYWORDS = ("魚", "鮭", "さば", "天丼")


def api_call(base: str, method: str, path: str, data: dict[str, Any] | None = None) -> tuple[int, dict[str, Any]]:
    payload = None
    headers = {}
    if data is not None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = request.Request(base.rstrip("/") + path, data=payload, headers=headers, method=method)
    try:
        with request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}
    except error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            body = json.loads(raw)
        except Exception:
            body = {"raw": raw}
        return e.code, body


def pick_supplier_ids(suppliers: list[dict[str, Any]]) -> dict[str, int | None]:
    ids: dict[str, int | None] = {"fish": None, "meat": None, "veg": None, "coop": None, "fallback": None}
    for s in suppliers:
        sid = s.get("id")
        name = str(s.get("name", ""))
        if ids["fallback"] is None:
            ids["fallback"] = sid
        if ids["fish"] is None and ("魚" in name or "魚丹" in name):
            ids["fish"] = sid
        if ids["meat"] is None and ("肉" in name or "牛豚" in name or "河野" in name):
            ids["meat"] = sid
        if ids["veg"] is None and ("八百" in name or "八百喜" in name):
            ids["veg"] = sid
        if ids["coop"] is None and ("生協" in name):
            ids["coop"] = sid
    for k in ("fish", "meat", "veg", "coop"):
        if ids[k] is None:
            ids[k] = ids["fallback"]
    return ids


def resolve_supplier_id(kind: str, supplier_ids: dict[str, int | None]) -> int | None:
    return supplier_ids.get(kind) or supplier_ids.get("fallback")


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed bulk test menu data (with fractions).")
    parser.add_argument("--api-base", default="http://localhost/api", help="API base URL")
    parser.add_argument("--menu-masters", type=int, default=40, help="Number of menu masters to create")
    parser.add_argument("--days", type=int, default=28, help="Number of days for calendar menu seeding")
    parser.add_argument("--prefix", default="テスト", help="Prefix for generated menu names")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    args = parser.parse_args()

    random.seed(args.seed)

    code, sup = api_call(args.api_base, "GET", "/suppliers")
    if code != 200:
        print(f"ERROR suppliers fetch failed: {code} {sup}")
        return 1

    code, blk = api_call(args.api_base, "GET", "/blocks")
    if code != 200:
        print(f"ERROR blocks fetch failed: {code} {blk}")
        return 1

    suppliers = sup.get("suppliers", [])
    blocks = blk.get("blocks", [])
    if not blocks:
        print("ERROR no blocks found. Create at least one block first.")
        return 1

    supplier_ids = pick_supplier_ids(suppliers)

    created_names: list[str] = []
    for i in range(args.menu_masters):
        dish = DISH_NAMES[i % len(DISH_NAMES)]
        name = f"{args.prefix}_{dish}_{i+1:03d}"

        vegs = random.sample(VEG_TEMPLATES, k=3)
        ingredients = [
            {
                "name": v.name,
                "amount": random.choice(FRACTIONS),  # fraction string (e.g. 1/2)
                "unit": v.unit,
                "persons_per_unit": None,
                "supplier_id": resolve_supplier_id(v.supplier_kind, supplier_ids),
            }
            for v in vegs
        ]

        if any(k in dish for k in FISH_DISH_KEYWORDS):
            main = random.choice(FISH_TEMPLATES)
            ingredients.append(
                {
                    "name": main.name,
                    "amount": random.choice(["1/2", "1"]),
                    "unit": main.unit,
                    "persons_per_unit": None,
                    "supplier_id": resolve_supplier_id(main.supplier_kind, supplier_ids),
                }
            )
        elif any(k in dish for k in MEAT_DISH_KEYWORDS):
            main = random.choice(MEAT_TEMPLATES)
            ingredients.append(
                {
                    "name": main.name,
                    "amount": str(random.choice([40, 50, 60, 80])),
                    "unit": main.unit,
                    "persons_per_unit": None,
                    "supplier_id": resolve_supplier_id(main.supplier_kind, supplier_ids),
                }
            )

        if any(k in dish for k in RICE_DISH_KEYWORDS):
            ingredients.append(
                {
                    "name": "米",
                    "amount": random.choice(RICE_GO_AMOUNTS),  # 何合
                    "unit": "合",
                    "persons_per_unit": None,
                    "supplier_id": resolve_supplier_id("coop", supplier_ids),
                }
            )

        payload = {
            "name": name,
            "block_id": None,
            "grams_per_person": round(random.uniform(70, 180), 1),
            "memo": "大量テストデータ（分数材料）",
            "ingredients": ingredients,
        }

        code, body = api_call(args.api_base, "POST", "/menu-masters", payload)
        if code in (200, 201):
            created_names.append(name)
        else:
            print(f"WARN menu-master create failed ({name}): {code} {body}")

    if not created_names:
        print("ERROR no menu masters created")
        return 1

    menu_created = 0
    start = date.today()
    for d in range(args.days):
        menu_date = (start + timedelta(days=d)).isoformat()
        for block in blocks:
            for meal_type in (1, 2, 3, 4):
                payload = {
                    "name": random.choice(created_names),
                    "menu_date": menu_date,
                    "meal_type": meal_type,
                    "block_id": block["id"],
                }
                code, _ = api_call(args.api_base, "POST", "/menus", payload)
                if code in (200, 201):
                    menu_created += 1

    boq_saved = 0
    for d in range(args.days):
        order_date = (start + timedelta(days=d)).isoformat()
        items: list[dict[str, Any]] = []
        for block in blocks:
            for meal_type in (1, 2, 3, 4):
                room1 = random.randint(4, 10)
                room2 = random.randint(4, 10)
                items.append(
                    {
                        "block_id": block["id"],
                        "meal_type": meal_type,
                        "room1_kamaho_count": room1,
                        "room2_kamaho_count": room2,
                        "order_quantity": room1 + room2,
                        "notes": "seed auto",
                    }
                )
        code, _ = api_call(
            args.api_base,
            "POST",
            "/block-order-quantities",
            {"order_date": order_date, "items": items},
        )
        if code in (200, 201):
            boq_saved += len(items)

    result = {
        "created_menu_masters": len(created_names),
        "created_calendar_menus": menu_created,
        "created_block_order_quantities": boq_saved,
        "days": args.days,
        "blocks": len(blocks),
        "fraction_examples": FRACTIONS[:5],
        "supplier_mapping": supplier_ids,
    }
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
