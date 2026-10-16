from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.models import Location, User
from app.routers.locations import router as locations_router
from app.routers.auth import router as auth_router

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Kaavalal API",
    description="Kerala Disaster Management and Resource Allocation Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(locations_router)
app.include_router(auth_router)


@app.get("/")
def root():
    return {
        "message": "Kaavalal API is running",
        "status": "ok",
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}