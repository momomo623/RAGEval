from typing import Any, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from pydantic import EmailStr
import uuid

from app.api.deps import get_current_active_admin, get_current_user, get_db, get_current_active_user
from app.core.security import get_password_hash, verify_password
from app.models.user import User, ApiKey
from app.schemas.user import UserCreate, UserUpdate, UserOut, ApiKeyCreate, ApiKeyUpdate, ApiKeyOut
from app.services.user_service import (
    get_user, 
    get_users, 
    create_user, 
    update_user, 
    delete_user
)
from app.utils.security import generate_api_key_token

router = APIRouter()

@router.get("", response_model=List[UserOut])
def read_users(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    获取所有用户
    """
    users = get_users(db, skip=skip, limit=limit)
    return users

@router.post("", response_model=UserOut)
def create_user_admin(
    *,
    db: Session = Depends(get_db),
    user_in: UserCreate,
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    创建新用户 (仅管理员)
    """
    user = get_user_by_email(db, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="该邮箱已被注册",
        )
    user = create_user(db, obj_in=user_in)
    return user

@router.get("/me", response_model=UserOut)
def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    获取当前登录用户的信息
    """
    # 确保转换UUID为字符串
    user_dict = current_user.__dict__.copy()
    user_dict["id"] = str(user_dict["id"])  # 显式转换UUID为字符串
    return user_dict

@router.put("/me", response_model=UserOut)
def update_current_user_info(
    *,
    db: Session = Depends(get_db),
    password: Optional[str] = Body(None),
    name: Optional[str] = Body(None),
    email: Optional[EmailStr] = Body(None),
    company: Optional[str] = Body(None),
    bio: Optional[str] = Body(None),
    avatar_url: Optional[str] = Body(None),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    更新当前登录用户的信息
    """
    current_user_data = UserUpdate()
    
    if password is not None:
        current_user_data.password = password
    if name is not None:
        current_user_data.name = name
    if email is not None:
        current_user_data.email = email
    if company is not None:
        current_user_data.company = company
    if bio is not None:
        current_user_data.bio = bio
    if avatar_url is not None:
        current_user_data.avatar_url = avatar_url
    
    # 更新用户数据
    for field, value in current_user_data.dict(exclude_unset=True).items():
        if field == "password":
            setattr(current_user, "password_hash", get_password_hash(value))
        else:
            setattr(current_user, field, value)
    
    current_user.updated_at = func.now()  # 更新时间戳
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    
    return current_user

@router.get("/{user_id}", response_model=UserOut)
def get_user_by_id(
    *,
    db: Session = Depends(get_db),
    user_id: str,
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    通过ID获取用户信息
    普通用户只能获取自己的信息，管理员可以获取任何用户的信息
    """
    # 检查权限
    if str(current_user.id) != user_id and not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="无权限查看此用户信息"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="用户未找到"
        )
    
    return user

@router.put("/{user_id}", response_model=UserOut)
def update_user_by_id(
    *,
    db: Session = Depends(get_db),
    user_id: str,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_admin)
) -> Any:
    """
    更新指定用户信息
    仅管理员可操作
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="用户未找到"
        )
    
    # 更新用户数据
    update_data = user_in.dict(exclude_unset=True)
    if "password" in update_data:
        update_data["password_hash"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    user.updated_at = func.now()  # 更新时间戳
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return user

@router.delete("/{user_id}", response_model=UserOut)
def delete_user(
    *,
    db: Session = Depends(get_db),
    user_id: str,
    current_user: User = Depends(get_current_active_admin)
) -> Any:
    """
    删除指定用户
    仅管理员可操作
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="用户未找到"
        )
    
    # 不允许删除自己
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=400,
            detail="不能删除当前登录的管理员账户"
        )
    
    # 保存用户信息用于返回
    user_out = UserOut.from_orm(user)
    
    # 删除用户
    db.delete(user)
    db.commit()
    
    return user_out

# API 密钥相关接口
@router.post("/api-keys", response_model=ApiKeyOut)
def create_api_key(
    *,
    db: Session = Depends(get_db),
    api_key_in: ApiKeyCreate,
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    创建API密钥
    """
    db_obj = ApiKey(
        user_id=current_user.id,
        name=api_key_in.name,
        key=api_key_in.key,
        provider=api_key_in.provider,
        is_active=api_key_in.is_active if api_key_in.is_active is not None else True
    )
    
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    
    return db_obj

@router.get("/api-keys", response_model=List[ApiKeyOut])
def get_api_keys(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    获取当前用户的所有API密钥
    """
    api_keys = db.query(ApiKey).filter(ApiKey.user_id == current_user.id).all()
    return api_keys

@router.put("/api-keys/{api_key_id}", response_model=ApiKeyOut)
def update_api_key(
    *,
    db: Session = Depends(get_db),
    api_key_id: str,
    api_key_in: ApiKeyUpdate,
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    更新API密钥
    """
    api_key = db.query(ApiKey).filter(
        ApiKey.id == api_key_id, 
        ApiKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail="API密钥未找到或无权访问"
        )
    
    # 更新API密钥数据
    update_data = api_key_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(api_key, field, value)
    
    api_key.updated_at = func.now()  # 更新时间戳
    db.add(api_key)
    db.commit()
    db.refresh(api_key)
    
    return api_key

@router.delete("/api-keys/{api_key_id}")
def delete_api_key(
    *,
    db: Session = Depends(get_db),
    api_key_id: str,
    current_user: User = Depends(get_current_active_user)
) -> Any:
    """
    删除API密钥
    """
    api_key = db.query(ApiKey).filter(
        ApiKey.id == api_key_id, 
        ApiKey.user_id == current_user.id
    ).first()
    
    if not api_key:
        raise HTTPException(
            status_code=404,
            detail="API密钥未找到或无权访问"
        )
    
    db.delete(api_key)
    db.commit()
    
    return {"detail": "API密钥已删除"} 