"""Paid, on-demand transcript generation for content that has none yet."""
from __future__ import annotations

import logging
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from content.models import Content, ContentTranscript, TranscriptGenerationRequest

logger = logging.getLogger(__name__)

GENERATION_MEDIA_TYPES = ('VIDEO', 'AUDIO', 'TEXT')
STALE_PENDING_AFTER = timedelta(hours=24)


class TranscriptGenerationError(ValueError):
    """Buyer-facing rejection for a generation request."""


def generation_price_usd() -> float:
    return float(getattr(settings, 'TRANSCRIPT_GENERATION_PRICE_USD', 1) or 1)


def content_has_transcript(content: Content) -> bool:
    if content is None or not getattr(content, 'pk', None):
        return False
    # Query the table. A select_related('transcript') miss caches DoesNotExist
    # on the content instance even after the transcript row is saved.
    return ContentTranscript.objects.filter(content_id=content.pk).exists()


def open_generation_request(content: Content):
    return (
        TranscriptGenerationRequest.objects.filter(
            content=content,
            status__in=TranscriptGenerationRequest.OPEN_STATUSES,
        )
        .order_by('-created_at')
        .first()
    )


def _payment_in_flight(generation_request: TranscriptGenerationRequest) -> bool:
    from django.utils import timezone as dj_tz

    from payments.models import BchDirectPayment
    from payments.payphone_services import has_pending_payphone
    from payments.services import has_in_flight_nowpayments

    if has_in_flight_nowpayments(transcript_generation=generation_request):
        return True
    if has_pending_payphone(transcript_generation=generation_request):
        return True
    return BchDirectPayment.objects.filter(
        transcript_generation=generation_request,
        status=BchDirectPayment.STATUS_PENDING,
        expires_at__gt=dj_tz.now(),
    ).exists()


def _cancel_if_stale(generation_request: TranscriptGenerationRequest) -> bool:
    """Cancel an abandoned checkout so another user can fund the transcript."""
    if generation_request.status != TranscriptGenerationRequest.STATUS_PENDING_PAYMENT:
        return False
    age = timezone.now() - generation_request.created_at
    if age < STALE_PENDING_AFTER:
        return False
    if _payment_in_flight(generation_request):
        return False
    generation_request.status = TranscriptGenerationRequest.STATUS_CANCELLED
    generation_request.save(update_fields=['status', 'updated_at'])
    logger.info(
        'Cancelled stale transcript generation request %s content=%s',
        generation_request.pk,
        generation_request.content_id,
    )
    return True


def create_generation_request(*, content: Content, user):
    """
    Start or resume a $1 transcript generation checkout.

    Returns (request, created). A queued request is returned as-is so a second
    user is not charged for work that is already paid.
    """
    if content.media_type not in GENERATION_MEDIA_TYPES:
        raise TranscriptGenerationError(
            'Este tipo de contenido no admite transcripción.'
        )
    if content_has_transcript(content):
        raise TranscriptGenerationError('Este contenido ya tiene transcripción.')

    existing = open_generation_request(content)
    if existing is not None:
        if existing.status == TranscriptGenerationRequest.STATUS_QUEUED:
            return existing, False
        if existing.requester_id == user.id:
            return existing, False
        if _cancel_if_stale(existing):
            existing = None
        else:
            raise TranscriptGenerationError(
                'Ya hay una solicitud de transcripción en curso para este contenido.'
            )

    req = TranscriptGenerationRequest.objects.create(
        requester=user,
        content=content,
        price_amount=generation_price_usd(),
        status=TranscriptGenerationRequest.STATUS_PENDING_PAYMENT,
    )
    return req, True


def mark_generation_request_paid(
    generation_request: TranscriptGenerationRequest,
    *,
    source: str = '',
) -> TranscriptGenerationRequest:
    """
    Mark a generation request paid and queue it for the transcript worker.

    Idempotent. If a transcript already exists, the request is completed
    immediately (the public page and embedding bookkeeping are already in place).
    """
    with transaction.atomic():
        req = (
            TranscriptGenerationRequest.objects.select_for_update()
            .select_related('content')
            .get(pk=generation_request.pk)
        )
        if req.status == TranscriptGenerationRequest.STATUS_COMPLETED:
            return req
        if req.status == TranscriptGenerationRequest.STATUS_QUEUED and not content_has_transcript(req.content):
            return req

        if content_has_transcript(req.content):
            req.status = TranscriptGenerationRequest.STATUS_COMPLETED
        else:
            req.status = TranscriptGenerationRequest.STATUS_QUEUED
        req.save(update_fields=['status', 'updated_at'])
        logger.info(
            'Transcript generation %s marked %s (source=%s content=%s)',
            req.pk,
            req.status,
            source or 'unknown',
            req.content_id,
        )
        return req


def settle_generation_requests_for_content(content: Content) -> int:
    """
    Close open generation requests once a transcript exists.

    Queued (paid) requests become completed. Unpaid checkouts are cancelled
    so nobody is charged for a transcript that is already public.
    """
    if content is None or not getattr(content, 'pk', None):
        return 0
    if not content_has_transcript(content):
        return 0
    now = timezone.now()
    completed = TranscriptGenerationRequest.objects.filter(
        content=content,
        status=TranscriptGenerationRequest.STATUS_QUEUED,
    ).update(
        status=TranscriptGenerationRequest.STATUS_COMPLETED,
        updated_at=now,
    )
    cancelled = TranscriptGenerationRequest.objects.filter(
        content=content,
        status=TranscriptGenerationRequest.STATUS_PENDING_PAYMENT,
    ).update(
        status=TranscriptGenerationRequest.STATUS_CANCELLED,
        updated_at=now,
    )
    if completed or cancelled:
        logger.info(
            'Settled transcript generation for content=%s completed=%s cancelled=%s',
            content.pk,
            completed,
            cancelled,
        )
    return completed + cancelled
