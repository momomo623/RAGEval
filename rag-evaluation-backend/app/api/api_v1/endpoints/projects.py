from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate, ProjectOut, ProjectWithDimensions, ProjectDetail, EvaluationDimension
from app.schemas.common import PaginatedResponse
from app.schemas.dataset import DatasetOut

from app.services.project_service import (
    create_project, 
    get_project, 
    update_project, 
    delete_project, 
    get_projects_by_user,
    get_project_with_dimensions,
    update_project_status,
    update_project_dimensions
)

router = APIRouter()

@router.post("", response_model=ProjectOut)
def create_project_api(
    *,
    db: Session = Depends(get_db),
    project_in: ProjectCreate,
    # current_user: User = Depends(get_test_user)
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建新项目
    """
    # print("------------------------")
    # print(current_user.id)
    # current_user.id="b109e9b0-2674-4366-9cb5-61f12182ace3"
    project = create_project(db, obj_in=project_in, user_id=current_user.id)
    return project

@router.get("", response_model=PaginatedResponse[ProjectOut])
def read_projects(
    *,
    db: Session = Depends(get_db),
    page: int = Query(1, gt=0),
    size: int = Query(10, gt=0, le=100),
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取用户的所有项目
    """
    skip = (page - 1) * size
    projects = get_projects_by_user(
        db, user_id=str(current_user.id), skip=skip, limit=size, status=status
    )
    
    # 计算总数
    total = db.query(Project).filter(Project.user_id == current_user.id)
    if status:
        total = total.filter(Project.status == status)
    total = total.count()
    
    # 计算总页数
    pages = (total + size - 1) // size if total > 0 else 1
    
    return {
        "items": projects,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

@router.get("/{project_id}", response_model=ProjectOut)
def read_project(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    获取项目详情
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    # 检查访问权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin and not project.public:
        raise HTTPException(status_code=403, detail="无权访问此项目")
    
    return project

@router.put("/{project_id}", response_model=ProjectOut)
def update_project_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    project_in: ProjectUpdate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    更新项目
    """
    print(f"DEBUG - 更新项目: 项目ID={project_id}, 用户ID={current_user.id}")
    
    project = get_project(db, project_id=project_id)
    if not project:
        print(f"DEBUG - 项目不存在: {project_id}")
        raise HTTPException(status_code=404, detail="项目不存在")
    
    # 检查权限（只有项目创建者可以修改）
    if str(project.user_id) != str(current_user.id):
        print(f"DEBUG - 无权限: 项目创建者ID={project.user_id}, 当前用户ID={current_user.id}")
        raise HTTPException(status_code=403, detail="无权限操作此项目")
    
    project = update_project(db, db_obj=project, obj_in=project_in)
    return project

@router.delete("/{project_id}")
def delete_project_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    删除项目
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权限删除此项目")
    project = delete_project(db, project_id=project_id)
    return {"detail": "项目已删除"}

@router.get("/{project_id}/datasets", response_model=List[DatasetOut])
def read_project_datasets(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取项目关联的数据集
    """
    # 检查项目是否存在
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    # 检查权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权访问此项目")
    
    # 获取关联的数据集
    from app.services.dataset_service import get_project_datasets_with_question_count_efficient
    datasets = get_project_datasets_with_question_count_efficient(db, project_id=project_id)
    
    # 转换UUID为字符串
    result = []
    for dataset in datasets:
        dataset_dict = {
            "id": str(dataset['dataset'].id),
            "user_id": str(dataset['dataset'].user_id),
            "name": dataset['dataset'].name,
            "description": dataset['dataset'].description,
            "is_public": dataset['dataset'].is_public,
            "tags": dataset['dataset'].tags or [],
            "dataset_metadata": dataset['dataset'].dataset_metadata or {},
            "question_count": dataset['question_count'],  # 这里可以进一步完善，添加问题数量统计
            "created_at": dataset['dataset'].created_at,
            "updated_at": dataset['dataset'].updated_at
        }
        result.append(dataset_dict)
    
    return result

@router.put("/{project_id}/status", response_model=ProjectOut)
def update_project_status_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    status: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新项目状态
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    # 检查修改权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权修改此项目")
    
    # 验证状态值
    valid_statuses = ["created", "in_progress", "completed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"无效的状态值，有效值为: {', '.join(valid_statuses)}")
    
    project = update_project_status(db, project_id=project_id, status=status)
    return project

@router.put("/{project_id}/dimensions", response_model=ProjectOut)
def update_project_dimensions_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    dimensions: List[EvaluationDimension],
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新项目评测维度
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    # 检查修改权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权修改此项目")
    
    # 验证维度数据
    if not dimensions:
        raise HTTPException(status_code=400, detail="至少需要一个评测维度")
    
    # 确保至少有一个维度是启用的
    if not any(d.enabled for d in dimensions):
        raise HTTPException(status_code=400, detail="至少需要一个启用的评测维度")
    
    dimensions_data = [d.dict() for d in dimensions]
    project = update_project_dimensions(db, project_id=project_id, dimensions=dimensions_data)
    return project 