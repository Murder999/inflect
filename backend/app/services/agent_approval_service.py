"""
Agent Approval Service — Onay kuyruğu yönetimi.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.agent import AgentApproval, ApprovalStatus, RiskLevel


async def create_approval(
    session: AsyncSession,
    action_type: str,
    title: str,
    description: Optional[str] = None,
    risk_level: RiskLevel = RiskLevel.MEDIUM,
    task_id: Optional[int] = None,
    requested_by_agent_id: Optional[int] = None,
    payload: Optional[dict[str, Any]] = None,
) -> AgentApproval:
    approval = AgentApproval(
        task_id=task_id,
        requested_by_agent_id=requested_by_agent_id,
        action_type=action_type,
        title=title,
        description=description,
        risk_level=risk_level,
        payload=payload,
        status=ApprovalStatus.PENDING,
    )
    session.add(approval)
    await session.flush()
    return approval


async def approve(
    session: AsyncSession,
    approval_id: int,
    reviewed_by_user_id: int,
    note: Optional[str] = None,
) -> Optional[AgentApproval]:
    result = await session.execute(
        select(AgentApproval).where(AgentApproval.id == approval_id)
    )
    approval = result.scalar_one_or_none()
    if not approval or approval.status != ApprovalStatus.PENDING:
        return None
    approval.status = ApprovalStatus.APPROVED
    approval.reviewed_by_user_id = reviewed_by_user_id
    approval.review_note = note
    approval.reviewed_at = datetime.now(timezone.utc)
    await session.flush()
    return approval


async def reject(
    session: AsyncSession,
    approval_id: int,
    reviewed_by_user_id: int,
    note: Optional[str] = None,
) -> Optional[AgentApproval]:
    result = await session.execute(
        select(AgentApproval).where(AgentApproval.id == approval_id)
    )
    approval = result.scalar_one_or_none()
    if not approval or approval.status != ApprovalStatus.PENDING:
        return None
    approval.status = ApprovalStatus.REJECTED
    approval.reviewed_by_user_id = reviewed_by_user_id
    approval.review_note = note
    approval.reviewed_at = datetime.now(timezone.utc)
    await session.flush()
    return approval


async def list_approvals(
    session: AsyncSession,
    status: Optional[str] = None,
    limit: int = 50,
) -> list[AgentApproval]:
    q = select(AgentApproval).order_by(AgentApproval.created_at.desc()).limit(limit)
    if status:
        try:
            q = q.where(AgentApproval.status == ApprovalStatus(status))
        except ValueError:
            pass
    result = await session.execute(q)
    return list(result.scalars().all())
