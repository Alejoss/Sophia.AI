import secrets

from django.conf import settings
from rest_framework.permissions import BasePermission


class TranscriptIngestPermission(BasePermission):
    """Machine-to-machine auth for external transcript extraction workers."""

    message = 'Clave de ingestión de transcripts inválida o no configurada.'

    def has_permission(self, request, view):
        expected = getattr(settings, 'TRANSCRIPT_INGEST_API_KEY', '') or ''
        if not expected:
            return False

        provided = request.headers.get('X-Transcript-Ingest-Key', '')
        if not provided:
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                provided = auth_header[7:].strip()

        if not provided:
            return False
        return secrets.compare_digest(provided, expected)
