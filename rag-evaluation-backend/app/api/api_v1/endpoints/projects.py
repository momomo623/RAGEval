from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.deps import get_current_user, get_current_active_admin, get_db
from app.models.user import User
from app.models.project import Project
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectOut,
    ProjectDetail,
    EvaluationDimension
)
from app.schemas.common import PaginatedResponse
from app.schemas.dataset import DatasetOut

from app.services.project_service import (
    create_project,
    get_project,
    update_project,
    delete_project,
    get_projects_by_user,
    update_project_status,
    update_project_dimensions,
    get_project_with_stats
)

router = APIRouter()

@router.get("/admin", response_model=List[ProjectOut])
def read_all_projects(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    获取所有项目（仅管理员可访问）
    """
    # 查询所有项目
    projects = db.query(Project).all()

    # 转换UUID为字符串
    result = []
    for project in projects:
        project_dict = {
            "id": str(project.id),
            "user_id": str(project.user_id),
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "scoring_scale": project.scoring_scale,
            "evaluation_dimensions": project.evaluation_dimensions,
            "created_at": project.created_at,
            "updated_at": project.updated_at
        }
        result.append(project_dict)

    return result

@router.post("", response_model=ProjectOut)
def create_project_api(
    *,
    db: Session = Depends(get_db),
    project_in: ProjectCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建项目
    """
    project = create_project(db, obj_in=project_in, user_id=str(current_user.id))

    # 手动转换返回值，确保UUID被转换为字符串
    return {
        "id": str(project.id),
        "user_id": str(project.user_id),
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "scoring_scale": project.scoring_scale,
        "evaluation_dimensions": project.evaluation_dimensions,
        "created_at": project.created_at,
        "updated_at": project.updated_at
    }

@router.get("", response_model=PaginatedResponse[ProjectOut])
def read_projects(
    *,
    db: Session = Depends(get_db),
    page: int = Query(1, gt=0),
    size: int = Query(10, gt=0, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取项目列表
    """
    skip = (page - 1) * size

    # 获取项目列表
    projects = get_projects_by_user(
        db,
        user_id=str(current_user.id),
        skip=skip,
        limit=size,
        search=search,
        status=status
    )

    # 计算总数
    query = db.query(func.count(Project.id)).filter(Project.user_id == current_user.id)

    if search:
        query = query.filter(Project.name.ilike(f"%{search}%"))

    if status:
        query = query.filter(Project.status == status)

    total = query.scalar()

    # 计算总页数
    pages = (total + size - 1) // size if total > 0 else 1

    # 准备返回结果
    result = []
    for project in projects:
        project_dict = {
            "id": str(project.id),
            "user_id": str(project.user_id),
            "name": project.name,
            "description": project.description,
            "status": project.status,
            "scoring_scale": project.scoring_scale,
            "evaluation_dimensions": project.evaluation_dimensions,
            "created_at": project.created_at,
            "updated_at": project.updated_at
        }
        result.append(project_dict)

    return {
        "items": result,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

@router.get("/{project_id}", response_model=ProjectDetail)
def read_project(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取项目详情
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    # 检查权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权访问此项目")

    result = get_project_with_stats(db, project_id)

    # 将result转换为schema需要的格式，明确转换UUID为字符串
    return {
        "id": str(result["project"].id),
        "user_id": str(result["project"].user_id),
        "name": result["project"].name,
        "description": result["project"].description,
        "status": result["project"].status,
        "scoring_scale": result["project"].scoring_scale,
        "evaluation_dimensions": result["project"].evaluation_dimensions,
        "created_at": result["project"].created_at,
        "updated_at": result["project"].updated_at,
        "datasets": result["datasets"],
        "accuracy_tests": result["accuracy_tests"],
        "performance_tests": result["performance_tests"]
    }

@router.put("/{project_id}", response_model=ProjectOut)
def update_project_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    project_in: ProjectUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新项目
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    # 检查权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权修改此项目")

    project = update_project(db, db_obj=project, obj_in=project_in)

    # 手动转换返回值，确保UUID被转换为字符串
    return {
        "id": str(project.id),
        "user_id": str(project.user_id),
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "scoring_scale": project.scoring_scale,
        "evaluation_dimensions": project.evaluation_dimensions,
        "created_at": project.created_at,
        "updated_at": project.updated_at
    }

@router.delete("/{project_id}")
def delete_project_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除项目
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    # 检查权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权删除此项目")

    delete_project(db, project_id=project_id)
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
    更新项目评估维度
    """
    project = get_project(db, project_id=project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    # 检查权限
    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权修改此项目")

    dimensions_data = [d.dict() for d in dimensions]
    project = update_project_dimensions(db, project_id=project_id, dimensions=dimensions_data)
    return project

