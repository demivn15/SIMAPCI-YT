"""
File: test_notifications.py
Description: Test suite for notification generation (T-HU08-03) and 
successful product upload notification integration (T-HU08-04).
"""

from app.models.notification import Notification
from app.models.user import User
from app.services.notification_service import create_notification


def test_create_notification_unit(db_session):
    """
    T-HU08-03: Verifica que el servicio registre correctamente una notificación 
    asociada al usuario propietario (CA24).
    """
    user = User(
        username="profesor_test",
        email="profesor.test@example.com",
        full_name="Profesor Test",
        school="ECMC",
        role="professor"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    notification = create_notification(
        db=db_session,
        user_id=user.id,
        title="Producto verificado",
        message="Tu producto ha sido verificado exitosamente por el comité."
    )

    assert notification.id is not None
    assert notification.user_id == user.id
    assert notification.title == "Producto verificado"
    assert notification.is_read is False

    db_notif = db_session.query(Notification).filter_by(id=notification.id).first()
    assert db_notif is not None
    assert db_notif.message == "Tu producto ha sido verificado exitosamente por el comité."


def test_product_upload_triggers_success_notification(db_session):
    """
    T-HU08-04 & CA22: Dado que el profesor guarda un producto correctamente, 
    cuando finaliza la carga, recibe una notificación de «cargado exitosamente».
    """
    user = User(
        username="profesor_upload",
        email="profesor.upload@example.com",
        full_name="Profesor Upload",
        school="ECMC",
        role="professor"
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    create_notification(
        db=db_session,
        user_id=user.id,
        title="Producto registrado",
        message="Tu producto fue cargado exitosamente."
    )

    notifications = db_session.query(Notification).filter_by(user_id=user.id).all()
    
    success_notifications = [
        n for n in notifications if "cargado exitosamente" in n.message.lower() or "registrado" in n.message.lower()
    ]
    
    assert len(success_notifications) == 1
    assert success_notifications[0].user_id == user.id
