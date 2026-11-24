from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.routers.me import station_out
from app.schemas import StationOut
from app.security import current_user
from app.services import geo

router = APIRouter(prefix="/stations", tags=["stations"])


@router.get("/nearby", response_model=list[StationOut])
def nearby(
    lat: float | None = Query(default=None, ge=-90, le=90),
    lng: float | None = Query(default=None, ge=-180, le=180),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    lat = lat if lat is not None else user.lat
    lng = lng if lng is not None else user.lng
    if lat is None or lng is None:
        raise HTTPException(status_code=400, detail="Set your location first")
    return [station_out(item) for item in geo.nearby_stations(db, lat, lng)]
