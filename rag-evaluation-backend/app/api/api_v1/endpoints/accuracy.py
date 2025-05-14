from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, Body, Path
from sqlalchemy.orm import Session
import uuid
from sqlalchemy.sql.expression import case

from app.api import deps
from app.models.user import User
from app.schemas.accuracy import (
    AccuracyTestCreate,
    AccuracyTestCreateResponse,
    AccuracyTestDetail,
    AccuracyTestProgress,
    AccuracyTestItemDetail,
    HumanAssignmentCreate,
    HumanAssignmentDetail,
    StartAccuracyTestRequest,
    InterruptTestRequest,
    AccuracyTest
)
from app.services.accuracy_service import AccuracyService

router = APIRouter()

@router.post("/add", response_model=AccuracyTestCreateResponse)
def create_accuracy_test(
    data: AccuracyTestCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """创建新的精度评测"""
    service = AccuracyService(db)
    try:
        test = service.create_test(data, current_user.id)
        return test
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"创建精度评测失败: {str(e)}")

@router.get("/project/{project_id}", response_model=List[AccuracyTestDetail])
def get_project_accuracy_tests(
    project_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """获取项目的所有精度评测"""
    service = AccuracyService(db)
    return service.get_tests_by_project(project_id)

@router.get("/{test_id}", response_model=AccuracyTestDetail)
def get_accuracy_test_detail(
    test_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """获取精度评测详情"""
    service = AccuracyService(db)
    test = service.get_test_detail(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="精度评测不存在")
    return test

@router.get("/{test_id}/items", response_model=Dict[str, Any])
def get_accuracy_test_items(
    test_id: uuid.UUID,
    limit: int = Query(50, gt=0, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = Query(None),
    score: Optional[float] = Query(None, description="按分数筛选"),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """获取精度评测项目列表"""
    service = AccuracyService(db)
    items, total = service.get_test_items(test_id, limit, offset, status, score)
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset
    }

@router.post("/start", response_model=AccuracyTestDetail)
def start_accuracy_test(
    data: StartAccuracyTestRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """开始精度评测"""
    service = AccuracyService(db)
    try:
        test = service.start_test(data.accuracy_test_id)
        if not test:
            raise HTTPException(status_code=404, detail="精度评测不存在")
        return test
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{test_id}/update-progress", response_model=AccuracyTestProgress)
def update_test_progress(
    test_id: uuid.UUID,
    processed: int = Body(...),
    success: int = Body(...),
    failed: int = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """更新测试进度"""
    service = AccuracyService(db)
    test = service.update_test_progress(test_id, processed, success, failed)
    if not test:
        raise HTTPException(status_code=404, detail="精度评测不存在")
    
    return {
        "id": test.id,
        "total": test.total_questions,
        "processed": test.processed_questions,
        "success": test.success_questions,
        "failed": test.failed_questions,
        "status": test.status
    }

@router.post("/{test_id}/complete", response_model=AccuracyTestDetail)
def complete_accuracy_test(
    test_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """完成精度评测"""
    service = AccuracyService(db)
    try:
        test = service.complete_test(test_id)
        if not test:
            raise HTTPException(status_code=404, detail="精度评测不存在")
        return test
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{test_id}/fail", response_model=AccuracyTestDetail)
def fail_accuracy_test(
    test_id: uuid.UUID,
    error_details: Dict[str, Any] = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """将精度评测标记为失败"""
    service = AccuracyService(db)
    test = service.fail_test(test_id, error_details)
    if not test:
        raise HTTPException(status_code=404, detail="精度评测不存在")
    return test

@router.post("/{test_id}/items", response_model=Dict[str, Any])
def submit_test_item_results(
    test_id: uuid.UUID,
    items: List[Dict[str, Any]] = Body(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """批量提交评测项结果"""
    service = AccuracyService(db)
    try:
        success = service.submit_test_item_results(test_id, items)
        return {"success": success}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{test_id}/human-assignments", response_model=HumanAssignmentDetail)
def create_human_assignment(
    test_id: uuid.UUID,
    data: HumanAssignmentCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """创建人工评测任务"""
    if data.evaluation_id != test_id:
        raise HTTPException(status_code=400, detail="请求路径ID与请求体ID不匹配")
    
    service = AccuracyService(db)
    try:
        assignment = service.create_human_assignment(data, current_user.id)
        return assignment
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{test_id}/human-assignments", response_model=List[HumanAssignmentDetail])
def get_human_assignments(
    test_id: uuid.UUID,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """获取人工评测任务列表"""
    service = AccuracyService(db)
    assignments = service.get_human_assignments(test_id)
    return assignments

@router.get("/project/{project_id}/running-tests")
async def get_running_tests(
    project_id: uuid.UUID,
    db: Session = Depends(deps.get_db)
):
    service = AccuracyService(db)
    return service.check_running_tests(project_id)

@router.post("/{test_id}/interrupt")
async def interrupt_test(
    test_id: uuid.UUID,
    data: InterruptTestRequest,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    """将测试标记为中断状态"""
    service = AccuracyService(db)
    return service.mark_test_interrupted(test_id, data.reason)

@router.post("/{test_id}/reset")
async def reset_test(
    test_id: uuid.UUID,
    db: Session = Depends(deps.get_db)
):
    service = AccuracyService(db)
    return service.reset_test_items(test_id)

@router.put("/{test_id}/status", response_model=AccuracyTest)
async def update_test_status(
    test_id: str,
    data: Dict[str, str] = Body(...),
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
):
    """更新测试状态"""
    service = AccuracyService(db)
    test = service.get_test_detail(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="测试不存在")
    
    # 验证状态值
    valid_statuses = ['created', 'running', 'completed', 'failed', 'interrupted']
    if data.get('status') not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"无效的状态值，必须是以下之一: {', '.join(valid_statuses)}")
    
    return service.update_test_status(db, test_id, data.get('status')) 