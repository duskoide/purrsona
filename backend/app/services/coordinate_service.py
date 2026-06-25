import math
import random
from dataclasses import dataclass

from app.core.config import settings


@dataclass
class Coordinate:
    latitude: float
    longitude: float


def blur_coordinate(exact: Coordinate) -> Coordinate:
    """Apply random offset within configured radius (default 200m).

    Uses uniform random bearing and distance to avoid
    clustering at the center (uses sqrt for uniform area distribution).
    """
    max_offset_meters = float(settings.BLUR_RADIUS_METERS)
    earth_radius_meters = 6_371_000.0

    # Uniform distribution over circular area
    distance = max_offset_meters * math.sqrt(random.random())
    bearing = random.uniform(0, 2 * math.pi)

    # Convert distance to angular offset
    angular_distance = distance / earth_radius_meters
    lat_rad = math.radians(exact.latitude)

    new_lat = math.asin(
        math.sin(lat_rad) * math.cos(angular_distance)
        + math.cos(lat_rad) * math.sin(angular_distance) * math.cos(bearing)
    )
    new_lng = math.radians(exact.longitude) + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat_rad),
        math.cos(angular_distance) - math.sin(lat_rad) * math.sin(new_lat),
    )

    return Coordinate(
        latitude=math.degrees(new_lat),
        longitude=math.degrees(new_lng),
    )


def haversine_distance(a: Coordinate, b: Coordinate) -> float:
    """Calculate distance in meters between two coordinates."""
    R = 6_371_000.0
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat = lat2 - lat1
    dlng = math.radians(b.longitude - a.longitude)
    h = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    )
    return 2 * R * math.asin(math.sqrt(h))


def compute_blurred_location(latitude: float, longitude: float) -> tuple[float, float]:
    """Convenience wrapper: returns (blurred_lat, blurred_lng)."""
    exact = Coordinate(latitude=latitude, longitude=longitude)
    blurred = blur_coordinate(exact)
    return blurred.latitude, blurred.longitude
