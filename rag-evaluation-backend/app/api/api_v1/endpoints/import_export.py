from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.schemas.question import QuestionBatchImport
from app.models.dataset import Dataset
from app.models.user import User
from app.services.question_service import import_questions_with_rag_answers

router = APIRouter()

@router.post("/import/questions_with_rag", response_model=Dict[str, Any])
def import_questions_with_rag_answers_api(
    *,
    db: Session = Depends(get_db),
    import_data: QuestionBatchImport,
    current_user: User = Depends(get_current_user)
) -> Any:
    """
    批量导入问题及其RAG回答
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == import_data.dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="数据集未找到")
    
    # 检查权限
    if str(dataset.user_id) != str(current_user.id) and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="无权向此数据集导入数据")
    
    # 导入问题和RAG回答
    imported_questions = import_questions_with_rag_answers(
        db, 
        import_data.dataset_id, 
        import_data.questions
    )
    
    return {
        "success": True,
        "imported_count": len(imported_questions),
        "dataset_id": import_data.dataset_id
    } 