import asyncio
from models import SessionState

_sessions: dict[str, SessionState] = {}
_queues: dict[str, asyncio.Queue] = {}
_lock = asyncio.Lock()


async def create_session(session_id: str) -> SessionState:
    async with _lock:
        state = SessionState(session_id=session_id)
        _sessions[session_id] = state
        _queues[session_id] = asyncio.Queue()
        return state


async def get_session(session_id: str) -> SessionState | None:
    return _sessions.get(session_id)


async def update_session(session_id: str, **kwargs) -> SessionState | None:
    async with _lock:
        state = _sessions.get(session_id)
        if state is None:
            return None
        updated = state.model_copy(update=kwargs)
        _sessions[session_id] = updated
        return updated


async def delete_session(session_id: str) -> None:
    async with _lock:
        _sessions.pop(session_id, None)
        _queues.pop(session_id, None)


def get_queue(session_id: str) -> asyncio.Queue | None:
    return _queues.get(session_id)


async def push_event(session_id: str, event: dict) -> None:
    q = _queues.get(session_id)
    if q is not None:
        await q.put(event)
