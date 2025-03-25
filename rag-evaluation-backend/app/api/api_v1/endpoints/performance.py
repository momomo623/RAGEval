from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
import uuid

from app import schemas, models
from app.api import deps
from app.api.deps import get_current_user
from app.models.user import User
from app.services.performance_service import performance_service
from app.services import rag_service

router = APIRouter()

@router.post("/", response_model=schemas.performance.PerformanceTestOut)
def create_performance_test(
    *,
    db: Session = Depends(deps.get_db),
    performance_in: schemas.performance.PerformanceTestCreate,
    current_user: User = Depends(get_current_user),
) -> Any:
    """创建新的性能测试"""
    return performance_service.create_performance_test(db=db, obj_in=performance_in)

@router.get("/project/{project_id}", response_model=List[schemas.performance.PerformanceTestOut])
def get_project_performance_tests(
    *,
    db: Session = Depends(deps.get_db),
    project_id: str,
   current_user: User = Depends(get_current_user),
) -> Any:
    """获取项目的所有性能测试"""
    return performance_service.get_by_project(db=db, project_id=project_id)

@router.get("/{performance_test_id}", response_model=schemas.performance.PerformanceTestDetail)
def get_performance_test(
    *,
    db: Session = Depends(deps.get_db),
    performance_test_id: str,
   current_user: User = Depends(get_current_user),
) -> Any:
    """获取性能测试详情"""
    test = performance_service.get(db=db, id=performance_test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Performance test not found")
    return test

@router.post("/start", response_model=schemas.performance.PerformanceTestOut)
def start_performance_test(
    *,
    db: Session = Depends(deps.get_db),
    start_request: schemas.performance.StartPerformanceTestRequest,
    background_tasks: BackgroundTasks,
   current_user: User = Depends(get_current_user),
) -> Any:
    """开始执行性能测试"""
    # 获取性能测试
    test = performance_service.get(db=db, id=start_request.performance_test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Performance test not found")
    
    # 如果已经在运行中，返回错误
    if test.status == "running":
        raise HTTPException(status_code=400, detail="Test is already running")
    
    # 将测试状态更新为运行中
    test = performance_service.start_performance_test(
        db=db, performance_test_id=start_request.performance_test_id
    )
    
    # 在后台执行测试
    # 注意：实际执行代码会在前端完成，后端只负责状态管理
    background_tasks.add_task(
        performance_service.complete_performance_test,
        db=db,
        performance_test_id=start_request.performance_test_id
    )
    
    return test

@router.post("/{performance_test_id}/complete", response_model=schemas.performance.PerformanceTestOut)
def complete_performance_test(
    *,
    db: Session = Depends(deps.get_db),
    performance_test_id: str,
   current_user: User = Depends(get_current_user),
) -> Any:
    """手动完成性能测试并计算指标"""
    test = performance_service.get(db=db, id=performance_test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Performance test not found")
    
    return performance_service.complete_performance_test(
        db=db, performance_test_id=performance_test_id
    )

@router.post("/{performance_test_id}/fail", response_model=schemas.performance.PerformanceTestOut)
def fail_performance_test(
    *,
    db: Session = Depends(deps.get_db),
    performance_test_id: str,
    error_details: dict,
   current_user: User = Depends(get_current_user),
) -> Any:
    """标记性能测试为失败状态"""
    test = performance_service.get(db=db, id=performance_test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Performance test not found")
    
    return performance_service.fail_performance_test(
        db=db, performance_test_id=performance_test_id, error_details=error_details
    ) 