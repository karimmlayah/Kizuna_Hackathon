from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import Response
from urllib.request import Request as HTTPRequest, urlopen
from urllib.error import HTTPError, URLError

app = FastAPI(
    title="Solar IoT Gateway",
    docs_url=None,
    redoc_url=None,
    openapi_url=None
)

@app.get("/health")
@app.get("/")
def gateway_health():
    return {
        "status": "ok",
        "service": "Smart Solar IoT Gateway",
        "port": 8002
    }

@app.post("/api/iot/measurements")
async def forward_measurement(request: Request):

    body = await request.body()

    if len(body) > 2048:
        raise HTTPException(413, "Payload too large")

    req = HTTPRequest(
        "http://127.0.0.1:8001/api/iot/measurements",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urlopen(req, timeout=5) as result:
            return Response(
                content=result.read(),
                status_code=result.status,
                media_type="application/json"
            )

    except HTTPError as error:
        return Response(
            content=error.read(),
            status_code=error.code,
            media_type="application/json"
        )

    except URLError:
        raise HTTPException(503, "Backend unavailable")