# The API's starting point: creates the app and plugs in all the routes.
# Run it: python -m app.main   (from apps/api-py, with the venv active)
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import sessions

app = FastAPI(title="Replay API")

# CORS: browsers block a page on one address (the shop, port 5173) from calling another
# (this API, port 4000) unless the API says that address is allowed. This says so.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# A route: when someone visits GET /, send back a short message.
@app.get("/")
def root() -> dict[str, str]:
    return {"message": "Replay API is running"}


# Health check: tells anyone asking that the server is alive.
@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Every address starting with /sessions is handled by the sessions router.
app.include_router(sessions.router)


# This block only runs when you start this file directly (not when tests import it).
if __name__ == "__main__":
    # reload=True restarts the server when you save a file (like `tsx watch`).
    uvicorn.run("app.main:app", port=settings.port, reload=True)
