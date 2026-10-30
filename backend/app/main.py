from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import accounts, auth, books, budgets, categories, invites, me, records, stats
from app.core.database import Base, engine
from app.models import Account, Book, BookMember, Budget, Category, Invite, Record, User  # noqa: F401


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="轻记", description="轻记记账 API", version="1.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(me.router)
app.include_router(books.router)
app.include_router(invites.router)
app.include_router(accounts.router)
app.include_router(categories.router)
app.include_router(records.router)
app.include_router(budgets.router)
app.include_router(stats.router)


@app.get("/health")
def health():
    return {"status": "ok", "app": "轻记"}
