from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
from app.models import Location
from app.routers.locations import router as locations_router


# Create database tables
Base.metadata.create_all(bind=engine)


# Initialize FastAPI application
app = FastAPI(
    title="Kaavalal API",
    description="Kerala Disaster Management and Resource Allocation Platform",
    version="1.0.0",
)


# Allow requests from the React frontend
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


# Register district routes
app.include_router(locations_router)


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "Kaavalal API is running",
        "status": "ok",
    }


# Health check endpoint
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }