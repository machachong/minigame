from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    WX_APPID: str = ""
    WX_SECRET: str = ""
    JWT_SECRET: str = "qingji-dev-secret-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 30
    DATABASE_URL: str = "sqlite:///./qingji.db"
    MOCK_OPENID: str = ""
    # MOCK 模式下 getPhoneNumber / phone_code 返回的写死手机号
    MOCK_PHONE: str = "13800138000"


@lru_cache
def get_settings() -> Settings:
    return Settings()
