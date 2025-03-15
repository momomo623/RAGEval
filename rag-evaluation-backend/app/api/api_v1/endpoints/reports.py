from typing import Any, List, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.project import Project
from app.models.report import Report
from app.schemas.report import (
    ReportCreate,
    ReportUpdate,
    ReportOut,
    ReportWithContent,
    ReportExportRequest
)
from app.services.report_service import ReportService

router = APIRouter()

@router.post("", response_model=ReportOut)
def create_report(
    *,
    db: Session = Depends(get_db),
    report_in: ReportCreate,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    创建报告
    """
    # 检查项目权限
    project = db.query(Project).filter(Project.id == report_in.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="项目未找到")
    
    if project.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权为此项目创建报告")
    
    # 创建报告
    report_service = ReportService(db)
    report = report_service.create_report(
        user_id=str(current_user.id),
        obj_in=report_in
    )
    
    return report

@router.put("/{report_id}", response_model=ReportOut)
def update_report(
    *,
    db: Session = Depends(get_db),
    report_id: str,
    report_in: ReportUpdate,
    regenerate: bool = False,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    更新报告
    """
    # 检查报告是否存在
    report_service = ReportService(db)
    report = report_service.get_report(report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="报告未找到")
    
    # 检查权限
    if str(report.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权更新此报告")
    
    # 更新报告
    updated_report = report_service.update_report(
        report_id=report_id,
        obj_in=report_in,
        regenerate_content=regenerate
    )
    
    return updated_report

@router.get("", response_model=List[ReportOut])
def read_reports(
    *,
    db: Session = Depends(get_db),
    project_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取报告列表
    """
    report_service = ReportService(db)
    
    if project_id:
        # 检查项目权限
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="项目未找到")
        
        if project.user_id != current_user.id and not current_user.is_admin:
            raise HTTPException(status_code=403, detail="无权查看此项目的报告")
        
        reports = report_service.get_reports_by_project(
            project_id=project_id,
            skip=skip,
            limit=limit
        )
    else:
        # 获取用户的所有报告
        reports = report_service.get_reports_by_user(
            user_id=str(current_user.id),
            skip=skip,
            limit=limit
        )
    
    return reports

@router.get("/public", response_model=List[ReportOut])
def read_public_reports(
    *,
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 20
) -> Any:
    """
    获取公开的报告
    """
    report_service = ReportService(db)
    reports = report_service.get_public_reports(skip=skip, limit=limit)
    
    return reports

@router.get("/{report_id}", response_model=ReportWithContent)
def read_report(
    *,
    db: Session = Depends(get_db),
    report_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    获取报告详情
    """
    report_service = ReportService(db)
    report = report_service.get_report(report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="报告未找到")
    
    # 检查权限，如果不是公开报告且不是创建者或管理员，则无权查看
    if not report.public and str(report.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权查看此报告")
    
    # 如果报告内容不存在，生成报告内容
    if not report.content:
        report_service.generate_report_content(report_id)
        # 重新获取报告
        report = report_service.get_report(report_id)
    
    return report

@router.post("/regenerate/{report_id}", response_model=ReportWithContent)
def regenerate_report(
    *,
    db: Session = Depends(get_db),
    report_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    重新生成报告内容
    """
    # 检查报告是否存在
    report_service = ReportService(db)
    report = report_service.get_report(report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="报告未找到")
    
    # 检查权限
    if str(report.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权重新生成此报告")
    
    # 重新生成报告内容
    success = report_service.generate_report_content(report_id)
    if not success:
        raise HTTPException(status_code=500, detail="报告生成失败")
    
    # 获取更新后的报告
    updated_report = report_service.get_report(report_id)
    
    return updated_report

@router.delete("/{report_id}")
def delete_report(
    *,
    db: Session = Depends(get_db),
    report_id: str,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    删除报告
    """
    # 检查报告是否存在
    report_service = ReportService(db)
    report = report_service.get_report(report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="报告未找到")
    
    # 检查权限
    if str(report.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权删除此报告")
    
    # 删除报告
    report_service.delete_report(report_id)
    
    return {"detail": "报告已删除"}

@router.post("/export", response_model=Dict[str, Any])
def export_report(
    *,
    db: Session = Depends(get_db),
    export_request: ReportExportRequest,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    导出报告
    """
    # 检查报告是否存在
    report_service = ReportService(db)
    report = report_service.get_report(export_request.report_id)
    
    if not report:
        raise HTTPException(status_code=404, detail="报告未找到")
    
    # 检查权限，如果不是公开报告且不是创建者或管理员，则无权导出
    if not report.public and str(report.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权导出此报告")
    
    # 导出报告
    export_data = report_service.export_report(
        report_id=export_request.report_id,
        export_format=export_request.format,
        include_charts=export_request.include_charts
    )
    
    if not export_data:
        raise HTTPException(status_code=500, detail="报告导出失败")
    
    # 获取适当的 MIME 类型
    mime_types = {
        "pdf": "application/pdf",
        "html": "text/html",
        "md": "text/markdown",
        "csv": "text/csv",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }
    
    # 构建文件名
    filename = f"report_{report.id}.{export_request.format}"
    
    # 返回文件
    return Response(
        content=export_data,
        media_type=mime_types.get(export_request.format, "application/octet-stream"),
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    ) 