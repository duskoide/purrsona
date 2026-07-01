import math
import random

from app.core.config import settings


def blur_coordinate(latitude: float, longitude: float) -> tuple[float, float]:
    """Apply random offset within configured radius (default 200m).

    Uses uniform random bearing and distance to avoid
    clustering at the center (uses sqrt for uniform area distribution).
    Returns (blurred_lat, blurred_lng).
    """
    max_offset_meters = float(settings.BLUR_RADIUS_METERS)
    earth_radius_meters = 6_371_000.0

    distance = max_offset_meters * math.sqrt(random.random())
    bearing = random.uniform(0, 2 * math.pi)

    angular_distance = distance / earth_radius_meters
    lat_rad = math.radians(latitude)

    new_lat = math.asin(
        math.sin(lat_rad) * math.cos(angular_distance)
        + math.cos(lat_rad) * math.sin(angular_distance) * math.cos(bearing)
    )
    new_lng = math.radians(longitude) + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(lat_rad),
        math.cos(angular_distance) - math.sin(lat_rad) * math.sin(new_lat),
    )

    return math.degrees(new_lat), math.degrees(new_lng)
