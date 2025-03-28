from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from pydantic import ValidationError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import ALGORITHM
from app.db.base import get_db
from app.models.user import User
from app.schemas.user import TokenPayload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
) -> User:
    print(f"DEBUG - 获取当前用户: 令牌前15个字符 {token[:15]}...")
    
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[ALGORITHM]
        )
        print(f"DEBUG - JWT解码成功: {payload}")
        token_data = TokenPayload(**payload)
    except (JWTError, ValidationError):
        print("DEBUG - JWT解码失败")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="认证凭据无效",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = db.query(User).filter(User.id == token_data.sub).first()

    if not user:
        raise HTTPException(status_code=404, detail="用户未找到")
    if not user.is_active:
        raise HTTPException(status_code=400, detail="用户未激活")
    return user

def get_current_active_user(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    获取当前活跃用户（已登录且未停用）
    """
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已停用")
    return current_user

def get_current_active_admin(
    current_user: User = Depends(get_current_active_user),
) -> User:
    """
    获取当前管理员用户
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=403, 
            detail="权限不足"
        )
    return current_user

# # 创建一个假测试用户对象
# test_user = User(
#     id=uuid.uuid4(),
#     email="test@example.com",
#     name="测试用户",
#     is_active=True,
#     is_admin=True  # 赋予管理员权限以访问所有内容
# )
#
# def get_test_user():
#     """
#     开发/测试环境使用的模拟用户依赖项，
#     总是返回一个有效的测试用户，不需要验证
#     """
#     return test_user
#     return test_user