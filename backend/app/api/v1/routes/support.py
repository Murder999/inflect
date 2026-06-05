from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.admin_models import SupportTicket

router = APIRouter(prefix="/support", tags=["support"])


class TicketCreateRequest(BaseModel):
    subject: str = Field(..., min_length=5, max_length=200)
    message: str = Field(..., min_length=10)
    category: Optional[str] = "other"  # billing, technical, account, other
    priority: Optional[str] = "normal"


@router.get("/tickets")
async def my_tickets(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SupportTicket).where(SupportTicket.user_id == user.id)
        .order_by(SupportTicket.updated_at.desc())
    )
    tickets = []
    for t in result.scalars().all():
        tickets.append({
            "id": t.id, "subject": t.subject,
            "status": t.status, "priority": t.priority, "category": t.category,
            "messages": t.messages or [],
            "messages_count": len(t.messages or []),
            "created_at": t.created_at.isoformat() if t.created_at else "",
            "updated_at": t.updated_at.isoformat() if t.updated_at else "",
        })
    return {"tickets": tickets, "total": len(tickets)}


@router.post("/tickets")
async def create_ticket(
    req: TicketCreateRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    ticket = SupportTicket(
        user_id=user.id,
        subject=req.subject,
        category=req.category,
        priority=req.priority,
        messages=[{
            "sender": "user",
            "sender_name": user.full_name or user.email,
            "message": req.message,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }],
    )
    db.add(ticket)
    await db.flush()
    return {
        "success": True,
        "ticket_id": ticket.id,
        "message": "Talebiniz alındı. En kısa sürede yanıt vereceğiz.",
    }


@router.post("/tickets/{ticket_id}/reply")
async def reply_ticket(
    ticket_id: int,
    message: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == ticket_id, SupportTicket.user_id == user.id
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket bulunamadı.")
    if ticket.status in ("resolved", "closed"):
        raise HTTPException(status_code=400, detail="Kapalı ticket'a yanıt eklenemez.")

    msgs = list(ticket.messages or [])
    msgs.append({
        "sender": "user",
        "sender_name": user.full_name or user.email,
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    ticket.messages = msgs
    await db.flush()
    return {"success": True}
