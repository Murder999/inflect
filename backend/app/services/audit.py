"""Audit logging helper — kullanılacak her kritik aksiyonda çağrılır."""
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.admin_models import AuditLog
from typing import Optional


async def log_action(
    db: AsyncSession,
    action: str,
    user_id: Optional[int] = None,
    admin_id: Optional[int] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    log = AuditLog(
        user_id=user_id,
        admin_id=admin_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=ip_address,
    )
    db.add(log)
    # flush ama commit etme — caller session'ı yönetir
    await db.flush()
