#!/usr/bin/env python3
"""将已有扁平 categories 升级为两级树（开发/单机 SQLite）。

策略（文档约定）：
- 旧扁平分类视为「待迁叶子」：为其新建同名一级大类，原行改为挂在其下的二级「其他」；
  已有流水的 category_id 不变（仍指向原 id，现为二级），可继续记账。
- 新库请直接 create_all + seed，无需本脚本。
- 若列已存在且已有 parent_id 非空行，则跳过已挂父的分类。

用法（在 backend 目录）：
  source .venv/bin/activate
  python scripts/migrate_categories_tree.py
  # 或 DATABASE_URL=sqlite:///./qingji.db python scripts/migrate_categories_tree.py

生产库请先备份；本脚本不删表、不 wipe。
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text

from app.core.database import SessionLocal, engine
from app.models.category import Category


def ensure_parent_id_column() -> None:
    insp = inspect(engine)
    cols = {c["name"] for c in insp.get_columns("categories")}
    if "parent_id" in cols:
        print("column parent_id already exists")
        return
    # SQLite 简单加列；FK 在 SQLite 上 ALTER 能力有限，应用层仍校验
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE categories ADD COLUMN parent_id INTEGER"))
    print("added column parent_id")


def migrate_flat_to_tree() -> None:
    db = SessionLocal()
    try:
        flats = (
            db.query(Category)
            .filter(Category.parent_id.is_(None))
            .order_by(Category.id)
            .all()
        )
        # 仅处理「自身还没有任何子类」的一级——即旧扁平行
        to_wrap = []
        for c in flats:
            has_child = (
                db.query(Category)
                .filter(Category.parent_id == c.id)
                .first()
                is not None
            )
            if not has_child:
                to_wrap.append(c)

        if not to_wrap:
            print("nothing to wrap (already tree or empty)")
            return

        n = 0
        for leaf in to_wrap:
            parent = Category(
                user_id=leaf.user_id,
                book_id=leaf.book_id,
                parent_id=None,
                name=leaf.name,
                type=leaf.type,
                icon=leaf.icon,
            )
            db.add(parent)
            db.flush()
            leaf.parent_id = parent.id
            leaf.name = "其他"
            n += 1
        db.commit()
        print(f"wrapped {n} flat categories into L1+「其他」L2")
    finally:
        db.close()


def main() -> None:
    ensure_parent_id_column()
    migrate_flat_to_tree()


if __name__ == "__main__":
    main()
