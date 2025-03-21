from fastapi import APIRouter

from app.api.api_v1.endpoints import (
    auth, users, datasets, projects, questions, 
    rag_answers, evaluations, auto_evaluation, 
    manual_evaluation, reports, performance, dataset_questions
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["数据集管理"])
api_router.include_router(projects.router, prefix="/projects", tags=["项目管理"])
api_router.include_router(questions.router, prefix="/questions", tags=["问题管理"])
api_router.include_router(rag_answers.router, prefix="/rag-answers", tags=["RAG回答"])
api_router.include_router(evaluations.router, prefix="/evaluations", tags=["评测管理"])
api_router.include_router(auto_evaluation.router, prefix="/auto-evaluations", tags=["自动评测"])
api_router.include_router(manual_evaluation.router, prefix="/manual-evaluations", tags=["人工评测"])
api_router.include_router(reports.router, prefix="/reports", tags=["报告管理"])
api_router.include_router(performance.router, prefix="/performance", tags=["性能测试"])
api_router.include_router(dataset_questions.router, prefix="/datasets-questions", tags=["dataset-questions"])

@api_router.get("/health")
def health_check():
    return {"status": "健康"}

# 在这里添加更多路由
# 例如:
# from app.api.api_v1.endpoints import users, projects, evaluations
# api_router.include_router(users.router, prefix="/users", tags=["users"])
# api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
# api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"]) 