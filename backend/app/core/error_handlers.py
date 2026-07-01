from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "status_code": exc.status_code,
                "error_type": _status_to_type(exc.status_code),
                "message": str(exc.detail),
            }
        },
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    details = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"] if loc != "body")
        details.append({"field": field, "message": error["msg"]})

    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "status_code": 422,
                "error_type": "validation_error",
                "message": "Request validation failed",
                "details": details,
            }
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "status_code": 500,
                "error_type": "internal_error",
                "message": "An unexpected error occurred",
            }
        },
    )


def _status_to_type(status_code: int) -> str:
    mapping = {
        401: "authentication_required",
        403: "forbidden",
        404: "not_found",
        410: "gone",
        422: "validation_error",
        429: "rate_limit_exceeded",
    }
    return mapping.get(status_code, "error")


def error_response(status_code: int, message: str, error_type: str | None = None, details: list | None = None) -> dict:
    body: dict = {
        "error": {
            "status_code": status_code,
            "error_type": error_type or _status_to_type(status_code),
            "message": message,
        }
    }
    if details:
        body["error"]["details"] = details
    return body
