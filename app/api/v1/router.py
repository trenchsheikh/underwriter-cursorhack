from fastapi import APIRouter

from app.api.v1.endpoints import applicants, applications, auth, decisions, documents

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(applicants.router)
api_router.include_router(applications.router)
api_router.include_router(documents.router)
api_router.include_router(decisions.router)
