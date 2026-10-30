"""首次登录 / 新建账本种子数据（一级大类 + 二级小类）"""

from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.book import Book
from app.models.category import Category
from app.models.member import BookMember
from app.models.user import User

# (一级名, 一级 icon, [(二级名, 二级 icon), ...])
DEFAULT_EXPENSE_TREE: list[tuple[str, str, list[tuple[str, str]]]] = [
    ("餐饮", "food", [("外卖", "food"), ("堂食", "food"), ("零食饮料", "food")]),
    ("购物", "shopping", [("服饰", "shopping"), ("数码", "shopping"), ("日用", "shopping")]),
    ("交通", "transport", [("公交地铁", "transport"), ("打车", "transport"), ("加油停车", "transport")]),
    ("生活", "home", [("通讯", "phone"), ("日杂", "home"), ("宠物", "home")]),
    ("住房", "home", [("房租房贷", "home"), ("水电燃气", "home"), ("物业维修", "home")]),
    ("娱乐", "entertainment", [("影视游戏", "entertainment"), ("出行游玩", "entertainment")]),
    ("医疗", "medical", [("药品", "medical"), ("就诊", "medical")]),
    ("教育", "education", [("学费培训", "education"), ("书籍文具", "education")]),
    ("其他", "other", [("其他支出", "other")]),
]

DEFAULT_INCOME_TREE: list[tuple[str, str, list[tuple[str, str]]]] = [
    ("工资", "salary", [("基本工资", "salary"), ("加班补贴", "salary")]),
    ("奖金", "bonus", [("年终奖", "bonus"), ("绩效奖金", "bonus")]),
    ("理财", "invest", [("利息分红", "invest"), ("投资收益", "invest")]),
    ("红包", "redpacket", [("红包礼金", "redpacket")]),
    ("其他", "other", [("其他收入", "other")]),
]

DEFAULT_ACCOUNTS = [
    ("现金", "cash"),
    ("微信", "wechat"),
    ("支付宝", "alipay"),
]


def _seed_category_tree(
    db: Session,
    user: User,
    book: Book,
    tree: list[tuple[str, str, list[tuple[str, str]]]],
    cat_type: str,
) -> None:
    for parent_name, parent_icon, children in tree:
        parent = Category(
            user_id=user.id,
            book_id=book.id,
            parent_id=None,
            name=parent_name,
            type=cat_type,
            icon=parent_icon,
        )
        db.add(parent)
        db.flush()
        for child_name, child_icon in children:
            db.add(
                Category(
                    user_id=user.id,
                    book_id=book.id,
                    parent_id=parent.id,
                    name=child_name,
                    type=cat_type,
                    icon=child_icon,
                )
            )


def seed_book_defaults(db: Session, user: User, book: Book) -> None:
    """为账本写入默认一二级分类与账户（不 commit）。"""
    _seed_category_tree(db, user, book, DEFAULT_EXPENSE_TREE, "expense")
    _seed_category_tree(db, user, book, DEFAULT_INCOME_TREE, "income")
    for name, icon in DEFAULT_ACCOUNTS:
        db.add(Account(user_id=user.id, book_id=book.id, name=name, balance_cents=0, icon=icon))


def seed_user_defaults(db: Session, user: User) -> Book:
    """为新用户创建默认个人账本、分类、账户与 owner 成员，返回默认账本。"""
    book = Book(user_id=user.id, name="日常账本", kind="personal", is_default=True)
    db.add(book)
    db.flush()
    db.add(BookMember(book_id=book.id, user_id=user.id, role="owner"))
    seed_book_defaults(db, user, book)
    db.commit()
    db.refresh(book)
    return book
