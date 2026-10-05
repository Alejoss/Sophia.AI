"""HTML Open Graph documents for social crawlers (Telegram, Facebook, etc.)."""
from django.shortcuts import render
from django.views import View

from content.models import Topic
from content.social_preview import (
    build_content_social_preview,
    build_site_social_preview,
    build_topic_social_preview,
    get_content_for_social_preview,
)


class ContentSocialPreviewView(View):
    """Serve per-content OG/Twitter meta HTML for link unfurlers."""

    http_method_names = ['get', 'head']

    def get(self, request, pk):
        content = get_content_for_social_preview(pk)
        if content is None:
            meta = build_site_social_preview(request, canonical_path='/')
            status = 404
        else:
            meta = build_content_social_preview(content, request)
            status = 200
        response = render(
            request,
            'content/social_preview.html',
            {'meta': meta},
            status=status,
        )
        response['Cache-Control'] = 'public, max-age=300'
        return response


class TopicSocialPreviewView(View):
    """Serve per-topic OG/Twitter meta HTML for link unfurlers."""

    http_method_names = ['get', 'head']

    def get(self, request, pk):
        try:
            topic = Topic.objects.get(pk=pk)
        except Topic.DoesNotExist:
            topic = None

        meta = build_topic_social_preview(topic, request) if topic else None
        if meta is None:
            meta = build_site_social_preview(request, canonical_path='/')
            status = 404
        else:
            status = 200

        response = render(
            request,
            'content/social_preview.html',
            {'meta': meta},
            status=status,
        )
        response['Cache-Control'] = 'public, max-age=300'
        return response


class SiteSocialPreviewView(View):
    """Fallback OG document for the homepage / unknown share paths."""

    http_method_names = ['get', 'head']

    def get(self, request):
        meta = build_site_social_preview(request, canonical_path='/')
        response = render(
            request,
            'content/social_preview.html',
            {'meta': meta},
            status=200,
        )
        response['Cache-Control'] = 'public, max-age=600'
        return response
