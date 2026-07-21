"""Email helpers for book club onboarding."""
import logging

from profiles.email_service import EmailService, EmailServiceError
from book_clubs.guest_tokens import build_complete_account_url

logger = logging.getLogger('app_logger')


def send_book_club_invite_email(*, email: str, club, token: str) -> bool:
    """
    Send confirmation / complete-account invite. Returns True if sent or skipped
    (SEND_EMAILS=False). Does not raise to the API caller for send failures.
    """
    complete_url = build_complete_account_url(token=token, slug=club.slug)
    try:
        return EmailService.send_template_email(
            receiver_email=email,
            subject=f'Confirma tu correo y únete a {club.title}',
            template_name='book_club_invite',
            context={
                'club_title': club.title,
                'complete_url': complete_url,
            },
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
