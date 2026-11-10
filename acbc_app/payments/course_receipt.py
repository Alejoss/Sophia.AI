"""Confirmation email sent to the buyer when a course purchase becomes paid."""

import logging
from decimal import Decimal, InvalidOperation

from payments.models import CoursePurchase
from profiles.email_service import EmailService, EmailServiceError

logger = logging.getLogger('app_logger')

# Frontend public path. The absolute URL is built from the same brand host as other mail.
COURSE_WELCOME_IMAGES = {
    'real-historia-bitcoin': '/images/real-historia-bitcoin-welcome.jpg',
}

REAL_HISTORIA_SUBJECT = (
    'Tu inscripción al curso La real historia de Bitcoin '
    'y la guerra por las criptomonedas está confirmada.'
)


def buyer_email_for_purchase(purchase: CoursePurchase) -> str:
    """Receipt address from checkout, then the account email when the buyer has one."""
    email = (purchase.receipt_email or '').strip()
    if email:
        return email
    user = purchase.user
    if user is not None and user.email:
        return user.email.strip()
    return ''


def buyer_name_for_purchase(purchase: CoursePurchase) -> str:
    user = purchase.user
    if user is None:
        return ''
    first = (user.first_name or '').strip()
    if first:
        return first
    return (user.username or '').strip()


def _price_label(amount) -> str:
    try:
        value = Decimal(str(amount if amount is not None else 0)).quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError):
        value = Decimal('0.00')
    return f'${value} USD'


def send_course_purchase_receipt(purchase: CoursePurchase) -> bool:
    """
    Email the buyer that their place is confirmed.

    Returns True when the message was handed to the mail backend, False when
    sending is disabled, there is no address, or the send failed. Never raises.
    """
    purchase = (
        CoursePurchase.objects
        .select_related('user', 'course')
        .get(pk=purchase.pk)
    )
    if purchase.payment_status != 'PAID':
        return False

    receiver = buyer_email_for_purchase(purchase)
    if not receiver:
        logger.info('Course purchase %s is paid but has no receipt email', purchase.pk)
        return False

    course = purchase.course
    frontend = (EmailService.get_brand_context().get('frontend_url') or '').rstrip('/')
    landing = course.landing_path or ''
    course_url = f'{frontend}{landing}' if landing else frontend
    hero_path = COURSE_WELCOME_IMAGES.get(course.code, '')
    hero_image_url = f'{frontend}{hero_path}' if hero_path and frontend else ''
    buyer_name = buyer_name_for_purchase(purchase)

    try:
        return EmailService.send_template_email(
            receiver_email=receiver,
            subject=(
                REAL_HISTORIA_SUBJECT
                if course.code == 'real-historia-bitcoin'
                else f'Tu inscripción está confirmada — {course.title}'
            ),
            template_name='course_purchase_confirmed',
            context={
                'buyer_name': buyer_name,
                'course_title': course.title,
                'course_url': course_url,
                'price_label': _price_label(purchase.price_amount),
                'hero_image_url': hero_image_url,
                'hero_image_alt': (
                    f'Bienvenido al curso {course.title}. Tu inscripción está confirmada.'
                ),
            },
            tags=['course', 'purchase', course.code],
        )
    except EmailServiceError as exc:
        logger.warning(
            'Course receipt email failed purchase=%s to=%s: %s',
            purchase.pk,
            receiver,
            exc,
        )
        return False
    except Exception:
        logger.exception(
            'Unexpected error sending course receipt purchase=%s',
            purchase.pk,
        )
        return False
