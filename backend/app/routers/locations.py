from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from urllib.request import urlopen
from urllib.error import URLError
import json

from app.core.database import get_db
from app.models.location import Location
from app.schemas.location import LocationResponse


router = APIRouter(
    prefix="/api/districts",
    tags=["Districts"],
)


# --------------------------------------------------
# GET ALL DISTRICTS
# --------------------------------------------------
@router.get(
    "",
    response_model=list[LocationResponse],
)
def get_districts(
    db: Session = Depends(get_db),
):
    districts = (
        db.query(Location)
        .filter(Location.location_type == "DISTRICT")
        .order_by(Location.name)
        .all()
    )

    return districts


# --------------------------------------------------
# GET A SINGLE DISTRICT
# --------------------------------------------------
@router.get(
    "/{district_id}",
    response_model=LocationResponse,
)
def get_district(
    district_id: int,
    db: Session = Depends(get_db),
):
    district = (
        db.query(Location)
        .filter(
            Location.id == district_id,
            Location.location_type == "DISTRICT",
        )
        .first()
    )

    if district is None:
        raise HTTPException(
            status_code=404,
            detail="District not found",
        )

    return district


# --------------------------------------------------
# GET LOCATIONS BELONGING TO A DISTRICT
# --------------------------------------------------
@router.get("/{district_id}/locations")
def get_district_locations(
    district_id: int,
    db: Session = Depends(get_db),
):
    district = (
        db.query(Location)
        .filter(
            Location.id == district_id,
            Location.location_type == "DISTRICT",
        )
        .first()
    )

    if district is None:
        raise HTTPException(
            status_code=404,
            detail="District not found",
        )

    locations = (
        db.query(Location)
        .filter(
            Location.parent_id == district_id
        )
        .order_by(Location.name)
        .all()
    )

    return {
        "district": district.name,
        "district_id": district.id,
        "locations": [
            {
                "id": location.id,
                "name": location.name,
                "location_type": location.location_type,
                "latitude": location.latitude,
                "longitude": location.longitude,
            }
            for location in locations
        ],
    }


# --------------------------------------------------
# GET CURRENT WEATHER FOR A DISTRICT
# --------------------------------------------------
@router.get("/{district_id}/weather")
def get_district_weather(
    district_id: int,
    db: Session = Depends(get_db),
):
    district = (
        db.query(Location)
        .filter(
            Location.id == district_id,
            Location.location_type == "DISTRICT",
        )
        .first()
    )

    if district is None:
        raise HTTPException(
            status_code=404,
            detail="District not found",
        )

    url = (
        "https://api.open-meteo.com/v1/forecast"
        f"?latitude={district.latitude}"
        f"&longitude={district.longitude}"
        "&current=temperature_2m,relative_humidity_2m,"
        "precipitation,wind_speed_10m"
        "&timezone=Asia%2FKolkata"
    )

    try:
        with urlopen(url, timeout=10) as response:
            weather = json.loads(
                response.read().decode("utf-8")
            )

    except (URLError, TimeoutError):
        raise HTTPException(
            status_code=503,
            detail="Weather service is temporarily unavailable",
        )

    current = weather.get("current")

    if current is None:
        raise HTTPException(
            status_code=502,
            detail="Weather data is unavailable",
        )

    return {
        "district_id": district.id,
        "district": district.name,
        "temperature": current.get("temperature_2m"),
        "humidity": current.get("relative_humidity_2m"),
        "rainfall": current.get("precipitation"),
        "wind_speed": current.get("wind_speed_10m"),
        "time": current.get("time"),
    }