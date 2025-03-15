from typing import Any, List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import Project
from app.models.rag_answer import ApiConfig
from app.schemas.performance import (
    PerformanceTestOut,
    PerformanceTestCreate,
    PerformanceTestUpdate,
    PerformanceTestRequest,
    PerformanceTestRunResponse,
    PerformanceTestResult,
    PerformanceMetricOut
)
from app.services.performance_service import PerformanceService

router = APIRouter()

@router.post("", response_model=PerformanceTestOut)
def create_performance_test(
    *,
    db: Session = Depends(get_db),
    test_in: PerformanceTestCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建性能测试
    """
    # 检查项目权限
    project = db.query(Project).filter(Project.id == test_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权为此项目创建性能测试")
    
    # 创建测试
    service = PerformanceService(db)
    test = service.create_test(
        user_id=str(current_user.id),
        obj_in=test_in
    )
    
    return test

@router.put("/{test_id}", response_model=PerformanceTestOut)
def update_performance_test(
    *,
    db: Session = Depends(get_db),
    test_id: str,
    test_in: PerformanceTestUpdate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新性能测试
    """
    # 检查测试是否存在
    service = PerformanceService(db)
    test = service.get_test(test_id)
    
    if not test:
        raise HTTPException(status_code=404, detail="性能测试未找到")
    
    # 检查权限
    if str(test.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权更新此性能测试")
    
    # 更新测试
    updated_test = service.update_test(
        test_id=test_id,
        obj_in=test_in
    )
    
    return updated_test

@router.get("", response_model=List[PerformanceTestOut])
def read_performance_tests(
    *,
    db: Session = Depends(get_db),
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取性能测试列表
    """
    service = PerformanceService(db)
    
    if project_id:
        # 检查项目权限
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目未找到")
        
        if project.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="无权查看此项目的性能测试")
        
        tests = service.get_tests_by_project(
            project_id=project_id,
            skip=skip,
            limit=limit
        )
    else:
        # 获取用户的所有测试
        tests = service.get_tests_by_user(
            user_id=str(current_user.id),
            skip=skip,
            limit=limit
        )
    
    return tests

@router.get("/{test_id}", response_model=PerformanceTestOut)
def read_performance_test(
    *,
    db: Session = Depends(get_db),
    test_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取性能测试详情
    """
    service = PerformanceService(db)
    test = service.get_test(test_id)
    
    if not test:
        raise HTTPException(status_code=404, detail="性能测试未找到")
    
    # 检查权限
    project = db.query(Project).filter(Project.id == test.project_id).first()
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此性能测试")
    
    return test

@router.delete("/{test_id}")
def delete_performance_test(
    *,
    db: Session = Depends(get_db),
    test_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除性能测试
    """
    # 检查测试是否存在
    service = PerformanceService(db)
    test = service.get_test(test_id)
    
    if not test:
        raise HTTPException(status_code=404, detail="性能测试未找到")
    
    # 检查权限
    if str(test.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权删除此性能测试")
    
    # 删除测试
    service.delete_test(test_id)
    
    return {"detail": "性能测试已删除"}

@router.post("/run", response_model=PerformanceTestRunResponse)
async def run_performance_test(
    *,
    db: Session = Depends(get_db),
    request: PerformanceTestRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    运行性能测试
    """
    # 检查项目权限
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权对此项目运行性能测试")
    
    # 检查API配置
    api_config = db.query(ApiConfig).filter(ApiConfig.id == request.api_config_id).first()
    if not api_config or api_config.project_id != request.project_id:
        raise HTTPException(status_code=404, detail="API配置未找到或不属于此项目")
    
    # 创建测试记录
    service = PerformanceService(db)
    test = service.create_test(
        user_id=str(current_user.id),
        obj_in=PerformanceTestCreate(
            project_id=request.project_id,
            name=request.name,
            description=request.description,
            test_type="latency",  # 默认测试类型
            config={
                "api_config_id": request.api_config_id,
                "concurrency": request.concurrency,
                "duration": request.duration,
                "ramp_up": request.ramp_up,
                "requests_per_second": request.requests_per_second,
                "status": "pending"
            }
        )
    )
    
    # 启动测试
    task_id = await service.run_test(
        test_id=str(test.id),
        api_config_id=request.api_config_id,
        concurrency=request.concurrency,
        duration=request.duration,
        ramp_up=request.ramp_up,
        requests_per_second=request.requests_per_second,
        question_ids=request.question_ids
    )
    
    if not task_id:
        raise HTTPException(status_code=500, detail="启动测试失败")
    
    # 计算预计完成时间
    estimated_completion = datetime.now() + timedelta(seconds=request.duration + 5)
    
    return PerformanceTestRunResponse(
        test_id=str(test.id),
        status="running",
        start_time=datetime.now(),
        estimated_completion=estimated_completion
    )

@router.get("/status/{task_id}", response_model=Dict[str, Any])
def get_test_status(
    *,
    db: Session = Depends(get_db),
    task_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取测试运行状态
    """
    service = PerformanceService(db)
    status = service.get_test_status(task_id)
    
    if not status:
        raise HTTPException(status_code=404, detail="测试任务未找到")
    
    # 检查权限
    test = service.get_test(status["test_id"])
    if not test:
        raise HTTPException(status_code=404, detail="测试记录未找到")
    
    if str(test.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此测试状态")
    
    return status

@router.get("/results/{test_id}", response_model=PerformanceTestResult)
def get_test_results(
    *,
    db: Session = Depends(get_db),
    test_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取测试结果
    """
    service = PerformanceService(db)
    test = service.get_test(test_id)
    
    if not test:
        raise HTTPException(status_code=404, detail="性能测试未找到")
    
    # 检查权限
    if str(test.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此测试结果")
    
    # 获取测试结果
    results = service.get_test_results(test_id)
    
    if not results:
        raise HTTPException(status_code=404, detail="测试结果未找到")
    
    return results

@router.get("/metrics/{test_id}", response_model=List[PerformanceMetricOut])
def get_test_metrics(
    *,
    db: Session = Depends(get_db),
    test_id: str,
    metric_type: Optional[str] = None,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取测试指标
    """
    service = PerformanceService(db)
    test = service.get_test(test_id)
    
    if not test:
        raise HTTPException(status_code=404, detail="性能测试未找到")
    
    # 检查权限
    if str(test.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此测试指标")
    
    # 获取测试指标
    metrics = service.get_metrics_by_test(test_id, metric_type)
    
    return metrics 