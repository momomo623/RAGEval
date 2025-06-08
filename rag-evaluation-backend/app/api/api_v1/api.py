from fastapi import APIRouter

from app.api.api_v1.endpoints import (
    auth, users, datasets, projects, questions,
    rag_answers, dataset_questions, performance, accuracy, admin, rag_proxy
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["认证"])
api_router.include_router(users.router, prefix="/users", tags=["用户管理"])
api_router.include_router(datasets.router, prefix="/datasets", tags=["数据集管理"])
api_router.include_router(projects.router, prefix="/projects", tags=["项目管理"])
api_router.include_router(questions.router, prefix="/questions", tags=["问题管理"])
api_router.include_router(rag_answers.router, prefix="/rag-answers", tags=["RAG回答"])
api_router.include_router(performance.router, prefix="/performance", tags=["性能测试"])
api_router.include_router(dataset_questions.router, prefix="/datasets-questions", tags=["dataset-questions"])
api_router.include_router(accuracy.router, prefix="/accuracy", tags=["accuracy"])
api_router.include_router(admin.router, prefix="/admin", tags=["管理员"])
api_router.include_router(rag_proxy.router, prefix="/rag", tags=["RAG代理"])

@api_router.get("/health")
def health_check():
    return {"status": "健康"}

# 在这里添加更多路由
# 例如:
# from app.api.api_v1.endpoints import users, projects, evaluations
# api_router.include_router(users.router, prefix="/users", tags=["users"])
# api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
# api_router.include_router(evaluations.router, prefix="/evaluations", tags=["evaluations"])