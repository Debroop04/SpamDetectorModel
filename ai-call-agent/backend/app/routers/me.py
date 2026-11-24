from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import PoliceStation, User
from app.phone import normalize_number
from app.schemas import LocationIn, LocationOut, StationOut, StationSelectIn, UserOut, UserUpdate
from app.security import current_user
from app.services import geo

router = APIRouter(prefix="/me", tags=["me"])


def station_out(item: geo.NearbyStation) -> StationOut:
    out = StationOut.model_validate(item.station)
    out.distance_km = item.distance_km
    return out


@router.patch("", response_model=UserOut)
def update_me(body: UserUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "phone" in data:
        phone = normalize_number(data["phone"]) if data["phone"] else None
        if data["phone"] and not phone:
            raise HTTPException(status_code=422, detail="Enter a valid phone number")
        data["phone"] = phone
    if data.get("police_delivery") == "live" and not settings.ALLOW_LIVE_POLICE_EMAIL:
        raise HTTPException(
            status_code=403,
            detail="Live delivery is disabled on this server. Set ALLOW_LIVE_POLICE_EMAIL=true in backend/.env first.",
        )
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    return user


@router.put("/location", response_model=LocationOut)
def set_location(body: LocationIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.lat, user.lng = round(body.lat, 6), round(body.lng, 6)
    with ThreadPoolExecutor(max_workers=1) as pool:
        address = pool.submit(geo.reverse_geocode, body.lat, body.lng)
        found = geo.nearby_stations(db, body.lat, body.lng)
        user.address = address.result() or user.address
    picked = geo.pick_station(found)
    if picked:
        user.station_id = picked.station.id
    db.commit()
    db.refresh(user)
    return LocationOut(user=UserOut.model_validate(user), stations=[station_out(f) for f in found])


@router.put("/station", response_model=UserOut)
def choose_station(body: StationSelectIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    station = db.get(PoliceStation, body.station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Police station not found")
    if body.email is not None:
        station.email = str(body.email).lower()
        station.email_source = "user"
    if body.phone:
        station.phone = body.phone.strip()
    user.station_id = station.id
    db.commit()
    db.refresh(user)
    return user


@router.post("/line", response_model=UserOut)
def claim_line(user: User = Depends(current_user), db: Session = Depends(get_db)):
    number = normalize_number(settings.TWILIO_PHONE_NUMBER)
    if not number:
        raise HTTPException(status_code=400, detail="No Twilio phone number is configured on the server")
    owner = db.query(User).filter(User.line_number == number).first()
    if owner and owner.id != user.id:
        raise HTTPException(status_code=409, detail="This protection line is already used by another account")
    user.line_number = number
    db.commit()
    return user


@router.delete("/line", response_model=UserOut)
def release_line(user: User = Depends(current_user), db: Session = Depends(get_db)):
    user.line_number = None
    db.commit()
    return user
