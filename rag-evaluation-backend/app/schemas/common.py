from typing import Generic, TypeVar, List, Optional
from pydantic import BaseModel

T = TypeVar('T')

class PaginatedResponse(BaseModel, Generic[T]):
    """标准分页响应模型"""
    items: List[T]              # 数据项列表
    total: int                  # 总数据量
    page: int                   # 当前页码
    size: int                   # 每页大小
    pages: Optional[int] = None # 总页数 