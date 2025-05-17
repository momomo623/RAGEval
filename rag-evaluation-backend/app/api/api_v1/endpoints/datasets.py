from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.api.deps import get_current_user, get_current_active_admin, get_db
from app.models.user import User
from app.schemas.dataset import (
    DatasetCreate,
    DatasetUpdate,
    DatasetOut,
    DatasetDetail,
    BatchLinkDatasets
)
from app.schemas.question import QuestionOut
from app.schemas.common import PaginatedResponse

from app.services.dataset_service import (
    create_dataset,
    get_dataset,
    get_datasets_by_user,
    update_dataset,
    delete_dataset,
    get_dataset_with_stats,
    link_dataset_to_project,
    unlink_dataset_from_project,
    get_questions_by_dataset,
    copy_dataset
)
from app.models.question import Question
from app.models.dataset import Dataset

router = APIRouter()

@router.get("/admin", response_model=List[DatasetOut])
def read_all_datasets(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin),
) -> Any:
    """
    获取所有数据集（仅管理员可访问）
    """
    # 查询所有数据集
    datasets = db.query(Dataset).all()

    # 为每个数据集添加问题数量，并转换UUID为字符串
    result = []
    for dataset in datasets:
        question_count = db.query(func.count(Question.id)).filter(
            Question.dataset_id == dataset.id
        ).scalar()

        dataset_dict = {
            "id": str(dataset.id),
            "user_id": str(dataset.user_id),
            "name": dataset.name,
            "description": dataset.description,
            "is_public": dataset.is_public,
            "tags": dataset.tags or [],
            "dataset_metadata": dataset.dataset_metadata or {},
            "question_count": question_count,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at
        }
        result.append(dataset_dict)

    return result

@router.post("", response_model=DatasetOut)
def create_dataset_api(
    *,
    db: Session = Depends(get_db),
    dataset_in: DatasetCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建数据集
    """
    dataset = create_dataset(db, obj_in=dataset_in, user_id=str(current_user.id))

    # 手动转换返回值，确保UUID被转换为字符串
    return {
        "id": str(dataset.id),
        "user_id": str(dataset.user_id),
        "name": dataset.name,
        "description": dataset.description,
        "is_public": dataset.is_public,
        "tags": dataset.tags or [],
        "dataset_metadata": dataset.dataset_metadata or {},
        "question_count": 0,  # 新创建的数据集没有问题
        "created_at": dataset.created_at,
        "updated_at": dataset.updated_at
    }

@router.get("", response_model=PaginatedResponse[DatasetOut])
def read_datasets(
    *,
    db: Session = Depends(get_db),
    page: int = Query(1, gt=0),
    size: int = Query(10, gt=0, le=100),
    search: Optional[str] = None,
    filter_type: Optional[str] = Query("all", description="筛选类型: all/my/public/private"),
    tags: Optional[str] = Query(None, description="标签，多个用逗号分隔"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取数据集列表，支持多种筛选条件
    """
    skip = (page - 1) * size

    # 处理标签
    tag_list = tags.split(",") if tags else None

    # 设置公开和所有者筛选
    include_public = True
    only_public = False
    only_private = False
    only_mine = False

    if filter_type == "my":
        include_public = False  # 只看我的数据集
        only_mine = True
    elif filter_type == "public":
        only_public = True  # 只看公开数据集
    elif filter_type == "private":
        only_private = True  # 只看私有数据集
        include_public = False

    # 获取数据集列表
    datasets = get_datasets_by_user(
        db,
        user_id=str(current_user.id),
        skip=skip,
        limit=size,
        search=search,
        include_public=include_public,
        only_public=only_public,
        only_private=only_private,
        only_mine=only_mine,
        tags=tag_list
    )

    # 计算总数（需要考虑筛选条件）
    query = db.query(func.count(Dataset.id))

    # 应用相同的筛选逻辑用于计算总数
    if include_public:
        if only_public:
            query = query.filter(Dataset.is_public == True)
        elif only_private:
            query = query.filter(
                Dataset.user_id == current_user.id,
                Dataset.is_public == False
            )
        else:
            query = query.filter(
                or_(
                    Dataset.user_id == current_user.id,
                    Dataset.is_public == True
                )
            )
    else:
        query = query.filter(Dataset.user_id == current_user.id)
        if only_private:
            query = query.filter(Dataset.is_public == False)

    # 应用标签筛选
    if tag_list:
        for tag in tag_list:
            query = query.filter(Dataset.tags.contains([tag]))

    # 应用搜索关键词
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Dataset.name.ilike(search_term),
                Dataset.description.ilike(search_term)
            )
        )

    total = query.scalar()

    # 计算总页数
    pages = (total + size - 1) // size if total > 0 else 1

    # 准备返回结果
    result = []
    for dataset in datasets:
        # 获取此数据集的问题数量
        question_count = db.query(func.count(Question.id)).filter(
            Question.dataset_id == dataset.id
        ).scalar()

        dataset_dict = {
            "id": str(dataset.id),
            "user_id": str(dataset.user_id) if str(dataset.user_id) == str(current_user.id) else None,
            "name": dataset.name,
            "description": dataset.description,
            "is_public": dataset.is_public,
            "tags": dataset.tags or [],
            "dataset_metadata": dataset.dataset_metadata or {},
            "question_count": question_count,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at,
            "is_owner": str(dataset.user_id) == str(current_user.id)
        }
        result.append(dataset_dict)

    return {
        "items": result,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }

@router.get("/public", response_model=PaginatedResponse[DatasetOut])
def read_public_datasets(
    *,
    db: Session = Depends(get_db),
    page: int = Query(1, gt=0),
    size: int = Query(12, gt=0, le=100),
    tags: Optional[str] = Query(None, description="标签，多个用逗号分隔"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取公开数据集
    """
    tag_list = tags.split(",") if tags else None

    # 创建基础查询
    query = db.query(Dataset).filter(Dataset.is_public == True)

    if tag_list:
        for tag in tag_list:
            query = query.filter(Dataset.tags.contains([tag]))

    if search:
        query = query.filter(
            or_(
                Dataset.name.ilike(f"%{search}%"),
                Dataset.description.ilike(f"%{search}%")
            )
        )

    # 计算总数
    total = query.count()

    # 计算分页
    offset = (page - 1) * size
    datasets = query.offset(offset).limit(size).all()

    # 为每个数据集添加问题数量，并转换UUID为字符串
    result = []
    for dataset in datasets:
        question_count = db.query(func.count(Question.id)).filter(
            Question.dataset_id == dataset.id
        ).scalar()

        dataset_dict = {
            "id": str(dataset.id),
            "user_id": str(dataset.user_id) if str(dataset.user_id) == str(current_user.id) else None,
            "name": dataset.name,
            "description": dataset.description,
            "is_public": dataset.is_public,
            "tags": dataset.tags or [],
            "dataset_metadata": dataset.dataset_metadata or {},
            "question_count": question_count,
            "created_at": dataset.created_at,
            "updated_at": dataset.updated_at
        }
        result.append(dataset_dict)

    # 计算总页数
    pages = (total + size - 1) // size if total > 0 else 1

    # 返回分页结果
    return {
        "items": result,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }



@router.get("/{dataset_id}", response_model=DatasetDetail)
def read_dataset(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取数据集详情
    """
    dataset = get_dataset(db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")

    # 检查访问权限
    if not dataset.is_public and str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权访问此数据集")

    result = get_dataset_with_stats(db, dataset_id)

    # 将result转换为schema需要的格式，明确转换UUID为字符串
    return {
        "id": str(result["dataset"].id),
        "user_id": str(result["dataset"].user_id),
        "name": result["dataset"].name,
        "description": result["dataset"].description,
        "is_public": result["dataset"].is_public,
        "tags": result["dataset"].tags or [],
        "dataset_metadata": result["dataset"].dataset_metadata or {},
        "question_count": result["question_count"],
        "created_at": result["dataset"].created_at,
        "updated_at": result["dataset"].updated_at,
        "projects": result["projects"]
    }

@router.put("/{dataset_id}", response_model=DatasetOut)
def update_dataset_api(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    dataset_in: DatasetUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新数据集
    """
    dataset = get_dataset(db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")

    # 检查权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权修改此数据集")

    dataset = update_dataset(db, db_obj=dataset, obj_in=dataset_in)

    # 获取问题数量
    question_count = db.query(func.count(Question.id)).filter(
        Question.dataset_id == dataset.id
    ).scalar()

    # 手动转换返回值，确保UUID被转换为字符串
    return {
        "id": str(dataset.id),
        "user_id": str(dataset.user_id),
        "name": dataset.name,
        "description": dataset.description,
        "is_public": dataset.is_public,
        "tags": dataset.tags or [],
        "dataset_metadata": dataset.dataset_metadata or {},
        "question_count": question_count,
        "created_at": dataset.created_at,
        "updated_at": dataset.updated_at
    }

@router.delete("/{dataset_id}")
def delete_dataset_api(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除数据集
    """
    dataset = get_dataset(db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")

    # 检查删除权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权删除此数据集")

    # 检查是否有项目正在使用此数据集
    from app.models.dataset import ProjectDataset
    project_links = db.query(ProjectDataset).filter(
        ProjectDataset.dataset_id == dataset_id
    ).count()

    if project_links > 0:
        raise HTTPException(status_code=400, detail="数据集正在被项目使用，无法删除")

    delete_dataset(db, dataset_id=dataset_id)
    return {"detail": "数据集已删除"}



@router.post("/link/{project_id}", response_model=dict)
def link_datasets_to_project(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    link_data: BatchLinkDatasets,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    批量关联数据集到项目
    """
    # 检查项目权限
    from app.models.project import Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此项目")

    # 验证所有数据集是否存在，以及用户是否有权限访问
    datasets = []
    for dataset_id in link_data.dataset_ids:
        dataset = get_dataset(db, dataset_id=dataset_id)
        if not dataset:
            raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 未找到")

        if not dataset.is_public and str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
            raise HTTPException(status_code=403, detail=f"无权访问数据集 {dataset_id}")

        datasets.append(dataset)

    # 关联数据集到项目
    added_datasets = []
    for dataset in datasets:
        link = link_dataset_to_project(db, project_id=project_id, dataset_id=str(dataset.id))
        added_datasets.append({
            "id": str(dataset.id),
            "name": dataset.name
        })

    return {
        "success": True,
        "added_datasets": added_datasets
    }

@router.delete("/unlink/{project_id}/{dataset_id}")
def unlink_dataset_from_project_api(
    *,
    db: Session = Depends(get_db),
    project_id: str,
    dataset_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    从项目中移除数据集关联
    """
    # 检查项目权限
    from app.models.project import Project
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")

    if str(project.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权操作此项目")

    # 检查关联是否存在
    from app.models.dataset import ProjectDataset
    link = db.query(ProjectDataset).filter(
        ProjectDataset.project_id == project_id,
        ProjectDataset.dataset_id == dataset_id
    ).first()

    if not link:
        raise HTTPException(status_code=404, detail="项目未关联此数据集")

    # 检查是否有使用此数据集的精度评测结果
    from app.models.accuracy import AccuracyTest
    accuracy_tests = db.query(AccuracyTest).filter(
        AccuracyTest.project_id == project_id,
        AccuracyTest.dataset_id == dataset_id
    ).count()

    if accuracy_tests > 0:
        raise HTTPException(
            status_code=400,
            detail="该数据集已被用于精度评测，无法移除。"
        )

    # 检查是否有使用此数据集的性能评测结果
    from app.models.performance import PerformanceTest
    performance_tests = db.query(PerformanceTest).filter(
        PerformanceTest.project_id == project_id,
        PerformanceTest.dataset_id == dataset_id
    ).count()

    if performance_tests > 0:
        raise HTTPException(
            status_code=400,
            detail="该数据集已被用于性能评测，无法移除。"
        )

    unlink_dataset_from_project(db, project_id=project_id, dataset_id=dataset_id)
    return {"detail": "数据集已从项目中移除"}

@router.get("/{dataset_id}/questions", response_model=List[QuestionOut])
def read_dataset_questions(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    difficulty: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取数据集中的问题列表
    """
    dataset = get_dataset(db, dataset_id=dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")

    # 检查访问权限
    if not dataset.is_public and str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权访问此数据集")

    questions = get_questions_by_dataset(
        db,
        dataset_id=dataset_id,
        skip=skip,
        limit=limit,
        category=category,
        difficulty=difficulty
    )

    # 转换UUID为字符串
    result = []
    for question in questions:
        question_dict = {
            "id": str(question.id),
            "dataset_id": str(question.dataset_id),
            "question_text": question.question_text,
            "standard_answer": question.standard_answer,
            "category": question.category,
            "difficulty": question.difficulty,
            "type": question.type,
            "tags": question.tags,
            "question_metadata": question.question_metadata,
            "created_at": question.created_at,
            "updated_at": question.updated_at
        }
        result.append(question_dict)

    return result

@router.post("/{dataset_id}/copy", response_model=DatasetOut)
def copy_dataset_api(
    *,
    db: Session = Depends(get_db),
    dataset_id: str,
    name: Optional[str] = Query(None, description="新数据集名称"),
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    复制公开数据集到当前用户的私人数据集
    """
    # 检查源数据集
    source_dataset = get_dataset(db, dataset_id=dataset_id)
    if not source_dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")

    # 检查权限 - 如果数据集不是公开的且不属于当前用户，则拒绝访问
    if not source_dataset.is_public and str(source_dataset.user_id) != str(current_user.id):
        raise HTTPException(status_code=403, detail="无权复制此数据集")

    # 执行复制
    new_dataset = copy_dataset(db, source_dataset_id=dataset_id, user_id=str(current_user.id), new_name=name)

    if not new_dataset:
        raise HTTPException(status_code=500, detail="复制数据集失败")

    # 获取问题数量
    question_count = db.query(func.count(Question.id)).filter(
        Question.dataset_id == new_dataset.id
    ).scalar()

    # 返回响应
    return {
        "id": str(new_dataset.id),
        "user_id": str(new_dataset.user_id),
        "name": new_dataset.name,
        "description": new_dataset.description,
        "is_public": new_dataset.is_public,
        "tags": new_dataset.tags or [],
        "dataset_metadata": new_dataset.dataset_metadata or {},
        "question_count": question_count,
        "created_at": new_dataset.created_at,
        "updated_at": new_dataset.updated_at
    }