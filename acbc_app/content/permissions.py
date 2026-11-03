import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission


def vincent_machine_keys():
    """Secrets Vincent may present.

    VINCENT_API_KEY is the general machine key. TRANSCRIPT_INGEST_API_KEY is
    accepted only while the general key is unset, so existing workers keep
    working until that env var is set.
    """
    primary = (getattr(settings, 'VINCENT_API_KEY', '') or '').strip()
    if primary:
        return [primary]
    legacy = (getattr(settings, 'TRANSCRIPT_INGEST_API_KEY', '') or '').strip()
    return [legacy] if legacy else []


def extract_vincent_machine_key(request):
    for header in ('X-Vincent-Key', 'X-Transcript-Ingest-Key'):
        provided = (request.headers.get(header, '') or '').strip()
        if provided:
            return provided
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:].strip()
    return ''


class VincentMachinePermission(BasePermission):
    """Machine-to-machine auth for the local Vincent worker."""

    message = 'Clave de Vincent inválida o no configurada.'

    def has_permission(self, request, view):
        expected_keys = vincent_machine_keys()
        provided = extract_vincent_machine_key(request)
        if not expected_keys or not provided:
            return False
        return any(secrets.compare_digest(provided, key) for key in expected_keys)


class TranscriptIngestPermission(VincentMachinePermission):
    """Same Vincent key, kept as the permission name on ingest views."""

    message = 'Clave de ingestión de transcripts inválida o no configurada.'
