import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "../.env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from backend.routes.simulate import router as simulate_router
from backend.routes.graph import router as graph_router
from backend.routes.chat import router as chat_router
from backend.utils.simulation_db import init_db

app = FastAPI(title="SocioAtlas API", version="1.0.0")
init_db()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(simulate_router, prefix="/api/simulate")
app.include_router(graph_router, prefix="/api/graph")
app.include_router(chat_router, prefix="/api/chat")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3001"))
    uvicorn.run("backend.server:app", host="0.0.0.0", port=port, reload=True)
