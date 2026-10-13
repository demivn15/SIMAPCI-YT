"""
File: routers/notifications.py
Description: Feed of status-change events for the authenticated professor
             (charter requirement #6 "Notificación de procesos").
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.database import get_database_session
from app.models.notification import NotificationModel
from app.models.user import UserModel
from app.schemas.notification import NotificationListResponse, NotificationResponse
from app.schemas.token import MessageResponse
from app.security.dependencies import get_current_active_user

router = APIRouter(
    prefix = "/notifications",
    tags = ["Notifications"],
    dependencies = [Depends(get_current_active_user)],
    responses = {401: {"description": "Missing, invalid or expired access token."}}
)


@router.get(
    "",
    response_model = NotificationListResponse,
    summary = "List the notifications of the authenticated professor",
    description = "Ordered newest first. Each entry describes one status change of a publication or project."
)
def list_notifications(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session),
    unread_only: bool = Query(default = False),
    skip: int = Query(default = 0, ge = 0),
    limit: int = Query(default = 20, ge = 1, le = 100)
):
    """List the authenticated professor's notifications."""
    query = db.query(NotificationModel).filter(NotificationModel.user_id == current_user.id)
    if unread_only:
        query = query.filter(NotificationModel.is_read.is_(False))

    total = query.count()
    unread_count = (
        db.query(NotificationModel)
        .filter(NotificationModel.user_id == current_user.id, NotificationModel.is_read.is_(False))
        .count()
    )
    items = query.order_by(NotificationModel.created_at.desc()).offset(skip).limit(limit).all()

    return NotificationListResponse(total = total, unread_count = unread_count, items = items)


@router.patch(
    "/{notification_id}/read",
    response_model = NotificationResponse,
    summary = "Mark one notification as read",
    responses = {
        403: {"description": "The notification belongs to another user."},
        404: {"description": "No notification with that id."},
    }
)
def mark_notification_read(
    notification_id: int,
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Mark a single notification as read."""
    notification = db.query(NotificationModel).filter(NotificationModel.id == notification_id).first()

    if notification is None:
        raise HTTPException(status_code = status.HTTP_404_NOT_FOUND, detail = "Notification not found.")
    if notification.user_id != current_user.id:
        raise HTTPException(status_code = status.HTTP_403_FORBIDDEN, detail = "This notification belongs to another user.")

    notification.is_read = True
    notification.read_at = datetime.now(timezone.utc).replace(tzinfo = None)

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


@router.patch(
    "/read-all",
    response_model = MessageResponse,
    summary = "Mark every notification of the authenticated professor as read"
)
def mark_all_notifications_read(
    current_user: UserModel = Depends(get_current_active_user),
    db: Session = Depends(get_database_session)
):
    """Mark every unread notification of the caller as read."""
    now = datetime.now(timezone.utc).replace(tzinfo = None)
    updated = (
        db.query(NotificationModel)
        .filter(NotificationModel.user_id == current_user.id, NotificationModel.is_read.is_(False))
        .update({NotificationModel.is_read: True, NotificationModel.read_at: now}, synchronize_session = False)
    )
    db.commit()

    return MessageResponse(detail = f"{updated} notification(s) marked as read.")
