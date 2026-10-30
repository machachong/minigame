from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.category import Category
from app.models.user import User
from app.schemas.category import CategoryCreate, CategoryOut
from app.services.membership import require_book_member

router = APIRouter(prefix="/api/categories", tags=["categories"])


def _to_out(cat: Category, children: list[CategoryOut] | None = None) -> CategoryOut:
    return CategoryOut(
        id=cat.id,
        book_id=cat.book_id,
        parent_id=cat.parent_id,
        name=cat.name,
        type=cat.type,
        icon=cat.icon,
        created_at=cat.created_at,
        children=children or [],
    )


def _build_tree(rows: list[Category]) -> list[CategoryOut]:
    by_parent: dict[int | None, list[Category]] = {}
    for c in rows:
        by_parent.setdefault(c.parent_id, []).append(c)
    roots = by_parent.get(None, [])
    result: list[CategoryOut] = []
    for root in roots:
        kids = [_to_out(ch) for ch in by_parent.get(root.id, [])]
        result.append(_to_out(root, kids))
    return result


@router.get("", response_model=list[CategoryOut])
def list_categories(
    book_id: int = Query(...),
    type: str | None = Query(None, description="expense | income"),
    parent_id: int | None = Query(
        None,
        description="筛选直属子类；不传则返回整棵树（一级带 children）",
    ),
    flat: bool = Query(False, description="true 时返回扁平列表（含 parent_id，children 为空）"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, book_id)
    q = db.query(Category).filter(Category.book_id == book_id)
    if type:
        q = q.filter(Category.type == type)

    if flat:
        if parent_id is not None:
            q = q.filter(Category.parent_id == parent_id)
        rows = q.order_by(Category.id).all()
        return [_to_out(c) for c in rows]

    if parent_id is not None:
        rows = q.filter(Category.parent_id == parent_id).order_by(Category.id).all()
        return [_to_out(c) for c in rows]

    rows = q.order_by(Category.id).all()
    return _build_tree(rows)


@router.post("", response_model=CategoryOut)
def create_category(
    body: CategoryCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    require_book_member(db, user, body.book_id)

    parent: Category | None = None
    if body.parent_id is not None:
        parent = (
            db.query(Category)
            .filter(Category.id == body.parent_id, Category.book_id == body.book_id)
            .first()
        )
        if not parent:
            raise HTTPException(400, "父分类不存在")
        if parent.parent_id is not None:
            raise HTTPException(400, "最多两级分类，不能在二级下再建子类")
        if parent.type != body.type:
            raise HTTPException(400, "二级分类类型须与一级一致")
        dup = (
            db.query(Category)
            .filter(
                Category.book_id == body.book_id,
                Category.parent_id == parent.id,
                Category.name == body.name,
            )
            .first()
        )
        if dup:
            raise HTTPException(400, "同一大类下小类名称已存在")
    else:
        dup = (
            db.query(Category)
            .filter(
                Category.book_id == body.book_id,
                Category.parent_id.is_(None),
                Category.type == body.type,
                Category.name == body.name,
            )
            .first()
        )
        if dup:
            raise HTTPException(400, "同类型下大类名称已存在")

    cat = Category(
        user_id=user.id,
        book_id=body.book_id,
        parent_id=body.parent_id,
        name=body.name,
        type=body.type,
        icon=body.icon,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return _to_out(cat)
