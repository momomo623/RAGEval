from typing import Any, List

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.api.deps import get_current_active_admin, get_current_user, get_db
from app.models.user import User, ApiKey
from app.schemas.user import UserCreate, UserUpdate, UserOut
from app.schemas.api_key import ApiKeyCreate, ApiKeyOut, ApiKeyUpdate
from app.services.user_service import (
    get_user, 
    get_users, 
    create_user, 
    update_user, 
    delete_user
)

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
def read_user_me(
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取当前用户
    """
    return current_user

@router.put("/me", response_model=UserOut)
def update_user_me(
    *,
    db: Session = Depends(get_db),
    password: str = Body(None),
    name: str = Body(None),
    email: str = Body(None),
    company: str = Body(None),
    bio: str = Body(None),
    avatar_url: str = Body(None),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    更新当前用户
    """
    current_user_data = jsonable_encoder(current_user)
    user_in = UserUpdate(**current_user_data)
    if password is not None:
        user_in.password = password
    if name is not None:
        user_in.name = name
    if email is not None:
        user_in.email = email
    if company is not None:
        user_in.company = company
    if bio is not None:
        user_in.bio = bio
    if avatar_url is not None:
        user_in.avatar_url = avatar_url
        
    user = update_user(db, db_obj=current_user, obj_in=user_in)
    return user

@router.get("/{user_id}", response_model=UserOut)
def read_user_by_id(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    获取用户信息
    """
    user = get_user(db, user_id=user_id)
    if user == current_user:
        return user
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403, detail="权限不足"
        )
    return user

@router.put("/{user_id}", response_model=UserOut)
def update_user_admin(
    *,
    db: Session = Depends(get_db),
    user_id: str,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    更新用户 (仅管理员)
    """
    user = get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="用户未找到",
        )
    user = update_user(db, db_obj=user, obj_in=user_in)
    return user

@router.delete("/{user_id}", response_model=UserOut)
def delete_user_admin(
    *,
    db: Session = Depends(get_db),
    user_id: str,
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    删除用户 (仅管理员)
    """
    user = get_user(db, user_id=user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="用户未找到",
        )
    user = delete_user(db, user_id=user_id)
    return user

# API 密钥相关接口
@router.post("/api-keys", response_model=ApiKeyOut)
def create_api_key(
    *,
    db: Session = Depends(get_db),
    api_key_in: ApiKeyCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    创建 API 密钥
    """
    from app.services.user_service import create_api_key as create_key
    
    api_key = create_key(
        db=db,
        user_id=str(current_user.id),
        obj_in=api_key_in
    )
    return api_key

@router.get("/api-keys", response_model=List[ApiKeyOut])
def read_api_keys(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取用户的所有 API 密钥
    """
    from app.services.user_service import get_user_api_keys
    
    api_keys = get_user_api_keys(db=db, user_id=str(current_user.id))
    return api_keys

@router.put("/api-keys/{api_key_id}", response_model=ApiKeyOut)
def update_api_key(
    *,
    db: Session = Depends(get_db),
    api_key_id: str,
    api_key_in: ApiKeyUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    更新 API 密钥
    """
    from app.services.user_service import get_api_key, update_api_key as update_key
    
    api_key = get_api_key(db=db, api_key_id=api_key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API密钥未找到")
    
    if str(api_key.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权更新此API密钥")
    
    api_key = update_key(db=db, db_obj=api_key, obj_in=api_key_in)
    return api_key

@router.delete("/api-keys/{api_key_id}")
def delete_api_key(
    *,
    db: Session = Depends(get_db),
    api_key_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    删除 API 密钥
    """
    from app.services.user_service import get_api_key, delete_api_key as delete_key
    
    api_key = get_api_key(db=db, api_key_id=api_key_id)
    if not api_key:
        raise HTTPException(status_code=404, detail="API密钥未找到")
    
    if str(api_key.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权删除此API密钥")
    
    delete_key(db=db, api_key_id=api_key_id)
    return {"detail": "API密钥已删除"} 