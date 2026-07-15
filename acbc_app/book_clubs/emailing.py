"""Email helpers for book club onboarding."""
import logging

from django.conf import settings

from book_clubs.guest_tokens import build_complete_account_url
from profiles.email_service import EmailService, EmailServiceError

logger = logging.getLogger('app_logger')


def send_book_club_invite_email(*, email: str, club, token: str) -> bool:
    """
    Send confirmation / complete-account invite. Returns True if sent or skipped
    (SEND_EMAILS=False). Does not raise to the API caller for send failures.
    """
    complete_url = build_complete_account_url(token=token, slug=club.slug)
    subject = f'Confirma tu correo y únete a {club.title}'
    text = (
        f'Gracias por interesarte en el Club de Lectura «{club.title}».\n\n'
        f'Ya puedes explorar el club en el navegador donde dejaste tu correo.\n\n'
        f'Para participar (comentar, completar misiones), crea tu cuenta aquí:\n'
        f'{complete_url}\n\n'
        f'— Academia Blockchain\n'
    )
    html = (
        f'<p>Gracias por interesarte en el Club de Lectura '
        f'<strong>{club.title}</strong>.</p>'
        f'<p>Ya puedes explorar el club en el navegador donde dejaste tu correo.</p>'
        f'<p>Para participar (comentar, completar misiones), crea tu cuenta:</p>'
        f'<p><a href="{complete_url}">Crear mi cuenta</a></p>'
        f'<p style="color:#666;font-size:12px;">Si el botón no funciona, copia este enlace:<br/>'
        f'{complete_url}</p>'
    )
    try:
        return EmailService.send_email(
            receiver_email=email,
            subject=subject,
            html_message=html,
            text_message=text,
            tags=['book_club', 'invite'],
        )
    except EmailServiceError as exc:
        logger.warning(
            'Book club invite email failed for %s (club=%s): %s',
            email,
            club.slug,
            exc,
        )
        return False
    except Exception as exc:
        logger.exception(
            'Unexpected error sending book club invite to %s: %s',
            email,
            exc,
        )
        return False
