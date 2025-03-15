from typing import Optional, List

from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.models.user import User, ApiKey
from app.schemas.user import UserCreate, UserUpdate
from app.schemas.api_key import ApiKeyCreate, ApiKeyUpdate

def get_user(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    return db.query(User).offset(skip).limit(limit).all()

def get_api_key(db: Session, api_key_id: str) -> Optional[ApiKey]:
    return db.query(ApiKey).filter(ApiKey.id == api_key_id).first()

def get_user_api_keys(db: Session, user_id: str) -> List[ApiKey]:
    return db.query(ApiKey).filter(ApiKey.user_id == user_id).all()

def create_user(db: Session, obj_in: UserCreate) -> User:
    db_obj = User(
        email=obj_in.email,
        password_hash=get_password_hash(obj_in.password),
        name=obj_in.name,
        company=obj_in.company,
        bio=obj_in.bio,
        avatar_url=obj_in.avatar_url,
        is_active=obj_in.is_active,
        is_admin=obj_in.is_admin,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_user(db: Session, db_obj: User, obj_in: UserUpdate) -> User:
    update_data = obj_in.dict(exclude_unset=True)
    if update_data.get("password"):
        hashed_password = get_password_hash(update_data["password"])
        update_data["password_hash"] = hashed_password
        del update_data["password"]
    
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_user(db: Session, user_id: str) -> Optional[User]:
    user = db.query(User).filter(User.id == user_id).first()
    if user:
        db.delete(user)
        db.commit()
    return user

def create_api_key(db: Session, user_id: str, obj_in: ApiKeyCreate) -> ApiKey:
    db_obj = ApiKey(
        user_id=user_id,
        name=obj_in.name,
        key=obj_in.key,
        provider=obj_in.provider,
        is_active=obj_in.is_active
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def update_api_key(db: Session, db_obj: ApiKey, obj_in: ApiKeyUpdate) -> ApiKey:
    update_data = obj_in.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_obj, field, value)
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

def delete_api_key(db: Session, api_key_id: str) -> None:
    db_obj = db.query(ApiKey).filter(ApiKey.id == api_key_id).first()
    if db_obj:
        db.delete(db_obj)
        db.commit() 