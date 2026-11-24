"""OpenStreetMap lookups: nearby police stations (Overpass) and addresses (Nominatim)."""

import logging
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from concurrent.futures import TimeoutError as FuturesTimeout
from dataclasses import dataclass

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import PoliceStation
from app.state import get_state, set_state

logger = logging.getLogger("callshield.geo")

STATION_CACHE_DAYS = 7
_nominatim_lock = threading.Lock()
_last_nominatim_call = 0.0

STATION_WORDS = ("police station", "thana", "kotwali", "p.s.", " ps ", "police stn")


@dataclass
class NearbyStation:
    station: PoliceStation
    distance_km: float


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlmb / 2) ** 2
    return 2 * radius * math.asin(math.sqrt(a))


def _headers() -> dict[str, str]:
    return {"User-Agent": settings.HTTP_USER_AGENT, "Accept": "application/json"}


def _address_from_tags(tags: dict) -> str | None:
    if tags.get("addr:full"):
        return tags["addr:full"]
    parts = [
        " ".join(p for p in (tags.get("addr:housenumber"), tags.get("addr:street")) if p),
        tags.get("addr:suburb") or tags.get("addr:place"),
        tags.get("addr:city") or tags.get("addr:district"),
        tags.get("addr:state"),
        tags.get("addr:postcode"),
    ]
    text = ", ".join(p for p in parts if p)
    return text or None


def parse_overpass(payload: dict) -> list[dict]:
    """Turn an Overpass JSON response into plain station dicts."""
    stations = []
    for element in payload.get("elements", []):
        tags = element.get("tags", {})
        lat = element.get("lat") or (element.get("center") or {}).get("lat")
        lng = element.get("lon") or (element.get("center") or {}).get("lon")
        if lat is None or lng is None:
            continue
        name = tags.get("name:en") or tags.get("name") or tags.get("official_name") or "Police Station"
        stations.append(
            {
                "osm_id": f"{element.get('type', 'node')}/{element.get('id')}",
                "name": name.strip(),
                "lat": float(lat),
                "lng": float(lng),
                "address": _address_from_tags(tags),
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "email": tags.get("email") or tags.get("contact:email"),
            }
        )
    return stations


def _overpass_post(url: str, query: str) -> dict:
    response = httpx.post(url, data={"data": query}, headers=_headers(), timeout=30)
    response.raise_for_status()
    return response.json()


def _overpass_query(lat: float, lng: float, radius_m: int) -> dict:
    """Ask every public Overpass mirror at once and use the first good answer (mirrors are often slow)."""
    query = (
        "[out:json][timeout:25];("
        f'node["amenity"="police"](around:{radius_m},{lat},{lng});'
        f'way["amenity"="police"](around:{radius_m},{lat},{lng});'
        ");out center tags;"
    )
    urls = [u.strip() for u in settings.OVERPASS_URLS.split(",") if u.strip()]
    pool = ThreadPoolExecutor(max_workers=len(urls))
    futures = {pool.submit(_overpass_post, url, query): url for url in urls}
    errors = []
    try:
        for future in as_completed(futures, timeout=35):
            try:
                return future.result()
            except Exception as exc:
                errors.append(f"{futures[future]}: {exc}")
                logger.warning("Overpass mirror failed: %s", errors[-1])
    except FuturesTimeout:
        errors.append("all mirrors timed out")
    finally:
        pool.shutdown(wait=False, cancel_futures=True)
    raise RuntimeError(f"Police station lookup failed ({'; '.join(errors)})")


def _nominatim_wait() -> None:
    """Nominatim allows one request per second; callers must hold _nominatim_lock."""
    global _last_nominatim_call
    wait = 1.1 - (time.time() - _last_nominatim_call)
    if wait > 0:
        time.sleep(wait)
    _last_nominatim_call = time.time()


_PHOTON_TYPES = {"N": "node", "W": "way", "R": "relation"}


def _photon_search(lat: float, lng: float) -> list[dict]:
    response = httpx.get(
        "https://photon.komoot.io/api/",
        params={"q": "police", "lat": lat, "lon": lng, "osm_tag": "amenity:police", "limit": 40},
        headers=_headers(),
        timeout=15,
    )
    response.raise_for_status()
    items = []
    for feature in response.json().get("features", []):
        props = feature.get("properties", {})
        lng_, lat_ = feature.get("geometry", {}).get("coordinates", [None, None])
        if lat_ is None or not props.get("osm_id"):
            continue
        address = ", ".join(p for p in (props.get("street"), props.get("district"), props.get("city"), props.get("postcode")) if p)
        items.append(
            {
                "osm_id": f"{_PHOTON_TYPES.get(props.get('osm_type'), 'node')}/{props['osm_id']}",
                "name": (props.get("name") or "Police Station").strip(),
                "lat": float(lat_),
                "lng": float(lng_),
                "address": address or None,
                "phone": None,
                "email": None,
            }
        )
    return items


def _nominatim_search(lat: float, lng: float, radius_km: int) -> list[dict]:
    delta = radius_km / 111.0
    with _nominatim_lock:
        _nominatim_wait()
        response = httpx.get(
            f"{settings.NOMINATIM_URL}/search",
            params={
                "q": "police",
                "format": "jsonv2",
                "viewbox": f"{lng - delta},{lat + delta},{lng + delta},{lat - delta}",
                "bounded": 1,
                "limit": 40,
                "extratags": 1,
                "addressdetails": 0,
                "accept-language": "en",
            },
            headers=_headers(),
            timeout=15,
        )
    response.raise_for_status()
    items = []
    for row in response.json():
        if row.get("category") != "amenity" or row.get("type") != "police":
            continue
        tags = row.get("extratags") or {}
        items.append(
            {
                "osm_id": f"{row.get('osm_type', 'node')}/{row.get('osm_id')}",
                "name": (row.get("name") or "Police Station").strip(),
                "lat": float(row["lat"]),
                "lng": float(row["lon"]),
                "address": ", ".join(row.get("display_name", "").split(", ")[1:5]) or None,
                "phone": tags.get("phone") or tags.get("contact:phone"),
                "email": tags.get("email") or tags.get("contact:email"),
            }
        )
    return items


def fallback_search(lat: float, lng: float, radius_km: int) -> list[dict]:
    """Photon and Nominatim search, used when every Overpass mirror is down."""
    merged: dict[str, dict] = {}
    errors = []
    for search in (lambda: _nominatim_search(lat, lng, radius_km), lambda: _photon_search(lat, lng)):
        try:
            for item in search():
                if haversine_km(lat, lng, item["lat"], item["lng"]) <= radius_km:
                    current = merged.get(item["osm_id"])
                    merged[item["osm_id"]] = {**item, **{k: v for k, v in (current or {}).items() if v}} if current else item
        except Exception as exc:
            errors.append(str(exc))
            logger.warning("Fallback police search failed: %s", exc)
    if not merged and len(errors) == 2:
        raise RuntimeError(f"Police station lookup failed ({'; '.join(errors)})")
    return list(merged.values())


def _upsert(db: Session, items: list[dict]) -> None:
    for item in items:
        row = db.query(PoliceStation).filter(PoliceStation.osm_id == item["osm_id"]).first()
        if row is None:
            row = PoliceStation(osm_id=item["osm_id"], name=item["name"], lat=item["lat"], lng=item["lng"])
            db.add(row)
        row.name = item["name"]
        row.lat = item["lat"]
        row.lng = item["lng"]
        row.address = item["address"] or row.address
        row.phone = item["phone"] or row.phone
        if item["email"] and row.email_source != "user":
            row.email = item["email"]
            row.email_source = "osm"
    db.commit()


def _area_key(lat: float, lng: float, radius_km: int) -> str:
    return f"overpass:{round(lat, 2)}:{round(lng, 2)}:{radius_km}"


def refresh_area(db: Session, lat: float, lng: float, radius_km: int) -> None:
    key = _area_key(lat, lng, radius_km)
    fetched = get_state(db, key)
    if fetched and time.time() - float(fetched) < STATION_CACHE_DAYS * 86400:
        return
    try:
        _upsert(db, parse_overpass(_overpass_query(lat, lng, radius_km * 1000)))
        set_state(db, key, time.time())
    except RuntimeError as overpass_error:
        logger.warning("%s. Trying Photon and Nominatim.", overpass_error)
        _upsert(db, fallback_search(lat, lng, radius_km))
        # Fallback results have fewer details, so try Overpass again after one day.
        set_state(db, key, time.time() - (STATION_CACHE_DAYS - 1) * 86400)


def _local_nearby(db: Session, lat: float, lng: float, radius_km: float) -> list[NearbyStation]:
    delta = radius_km / 111.0 + 0.01
    rows = (
        db.query(PoliceStation)
        .filter(PoliceStation.lat.between(lat - delta, lat + delta))
        .filter(PoliceStation.lng.between(lng - delta * 1.6, lng + delta * 1.6))
        .all()
    )
    found = [NearbyStation(row, round(haversine_km(lat, lng, row.lat, row.lng), 2)) for row in rows]
    return sorted([f for f in found if f.distance_km <= radius_km], key=lambda f: f.distance_km)


def nearby_stations(db: Session, lat: float, lng: float, limit: int = 20) -> list[NearbyStation]:
    """Nearest police stations. Searches 5 km, then 15 km and 30 km only if nothing was found."""
    for radius in (5, 15, 30):
        try:
            refresh_area(db, lat, lng, radius)
        except RuntimeError:
            # The map service is unreachable; use whatever is cached and do not widen the search.
            return _local_nearby(db, lat, lng, 30)[:limit]
        found = _local_nearby(db, lat, lng, radius)
        if found:
            return found[:limit]
    return []


def pick_station(found: list[NearbyStation]) -> NearbyStation | None:
    """Prefer a proper police station over a booth or outpost when it is not much farther away."""
    if not found:
        return None
    nearest = found[0]
    for item in found:
        lowered = f" {item.station.name.lower()} "
        if any(word in lowered for word in STATION_WORDS) and item.distance_km <= max(nearest.distance_km * 1.5, nearest.distance_km + 1.5):
            return item
    return nearest


def reverse_geocode(lat: float, lng: float) -> str | None:
    """Readable address for a coordinate. Respects Nominatim's one request per second rule."""
    with _nominatim_lock:
        _nominatim_wait()
        try:
            response = httpx.get(
                f"{settings.NOMINATIM_URL}/reverse",
                params={"format": "jsonv2", "lat": lat, "lon": lng, "zoom": 16, "accept-language": "en"},
                headers=_headers(),
                timeout=10,
            )
            response.raise_for_status()
            return response.json().get("display_name")
        except Exception as exc:
            logger.warning("Reverse geocoding failed: %s", exc)
            return None
