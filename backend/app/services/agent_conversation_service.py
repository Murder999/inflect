"""
Agent Conversation Service — Konuşma ve mesaj yönetimi.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.models.agent import (
    AgentConversation, AgentMessage,
    SenderType, MessageType,
)


async def create_conversation(
    session: AsyncSession,
    title: str,
    source: str = "system",
    related_task_id: Optional[int] = None,
) -> AgentConversation:
    conv = AgentConversation(
        title=title,
        source=source,
        status="active",
        related_task_id=related_task_id,
    )
    session.add(conv)
    await session.flush()
    return conv


async def add_message(
    session: AsyncSession,
    conversation_id: int,
    sender_name: str,
    content: str,
    sender_type: SenderType = SenderType.AGENT,
    message_type: MessageType = MessageType.LOG,
    agent_id: Optional[int] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> AgentMessage:
    msg = AgentMessage(
        conversation_id=conversation_id,
        agent_id=agent_id,
        sender_type=sender_type,
        sender_name=sender_name,
        message_type=message_type,
        content=content,
        metadata_=metadata,
    )
    session.add(msg)
    await session.flush()
    return msg


async def list_conversations(
    session: AsyncSession,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[AgentConversation], int]:
    from sqlalchemy import func
    total = (await session.execute(select(func.count(AgentConversation.id)))).scalar() or 0
    result = await session.execute(
        select(AgentConversation)
        .order_by(desc(AgentConversation.created_at))
        .limit(limit).offset(offset)
    )
    return list(result.scalars().all()), total


async def get_conversation_with_messages(
    session: AsyncSession,
    conversation_id: int,
) -> tuple[Optional[AgentConversation], list[AgentMessage]]:
    conv_result = await session.execute(
        select(AgentConversation).where(AgentConversation.id == conversation_id)
    )
    conv = conv_result.scalar_one_or_none()
    if not conv:
        return None, []
    msgs_result = await session.execute(
        select(AgentMessage)
        .where(AgentMessage.conversation_id == conversation_id)
        .order_by(AgentMessage.created_at)
    )
    return conv, list(msgs_result.scalars().all())
