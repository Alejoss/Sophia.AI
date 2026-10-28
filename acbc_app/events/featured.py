"""The wide banner that advertises one event on Biblioteca, Caminos, and Temas.

Visitors read the live banner. Only staff create, edit, or remove banners, from the dashboard.
"""

from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.utils import build_media_url
from events.models import Event, FeaturedEvent

MAX_BANNER_BYTES = 5 * 1024 * 1024
EVENT_CHOICE_LIMIT = 300


def _schedule(event):
    return {
        'date_start': event.date_start,
        'date_end': event.date_end,
        'date_start_has_time': event.date_start_has_time,
        'date_end_has_time': event.date_end_has_time,
    }


def featured_payload(placement, request):
    event = placement.event
    return {
        'id': placement.id,
        'event_id': event.id,
        'title': event.title,
        'desktop_image': build_media_url(placement.desktop_image, request),
        'mobile_image': build_media_url(placement.mobile_image, request),
        'path': f'/events/{event.id}',
        'is_active': placement.is_active,
        **_schedule(event),
    }


def admin_payload(placement, request, live_id=None):
    event = placement.event
    return {
        **featured_payload(placement, request),
        'is_live': placement.id == live_id,
        'event_is_visible': event.is_visible and not event.deleted,
        'event_has_ended': FeaturedEvent.event_is_over(event),
        'updated_at': placement.updated_at,
    }


def _live_id():
    live = FeaturedEvent.live()
    return live.id if live else None


class FeaturedEventWriteSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    desktop_image = serializers.ImageField(required=False, allow_null=True)
    mobile_image = serializers.ImageField(required=False, allow_null=True)

    def _check_size(self, image):
        if image and image.size > MAX_BANNER_BYTES:
            raise serializers.ValidationError('La imagen debe pesar menos de 5 MB.')
        return image

    def validate_desktop_image(self, image):
        return self._check_size(image)

    def validate_mobile_image(self, image):
        return self._check_size(image)


class CurrentFeaturedEventView(APIView):
    """The one banner currently on display. Anonymous visitors can read it."""

    permission_classes = [AllowAny]

    def get(self, request):
        placement = FeaturedEvent.live()
        if placement is None:
            return Response(None)
        return Response(featured_payload(placement, request))


class AdminFeaturedEventListView(APIView):
    """Every saved banner, the active one first."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        placements = (
            FeaturedEvent.objects
            .select_related('event')
            .filter(event__deleted=False)
            .order_by('-is_active', '-updated_at')
        )
        live_id = _live_id()
        return Response({'results': [admin_payload(p, request, live_id) for p in placements]})


class AdminFeaturedEventChoicesView(APIView):
    """Every event, for the dashboard's event dropdown.

    Events that have not ended come first, soonest first; ended events follow,
    most recent first. Private and ended events are flagged because their banner
    would not show.
    """

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        events = (
            Event.objects
            .filter(deleted=False)
            .select_related('feature_placement')
            .order_by('-date_start', '-id')[:EVENT_CHOICE_LIMIT]
        )
        upcoming, ended = [], []
        for event in events:
            row = {
                'id': event.id,
                'title': event.title,
                'is_visible': event.is_visible,
                'has_ended': FeaturedEvent.event_is_over(event),
                'has_banner': getattr(event, 'feature_placement', None) is not None,
                **_schedule(event),
            }
            (ended if row['has_ended'] else upcoming).append(row)
        upcoming.reverse()
        return Response({'results': upcoming + ended})


class AdminFeaturedEventDetailView(APIView):
    """Read, upload, or remove the desktop and mobile banners for one event."""

    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _event(self, event_id):
        return get_object_or_404(Event, pk=event_id, deleted=False)

    def get(self, request, event_id):
        placement = FeaturedEvent.objects.filter(event=self._event(event_id)).first()
        if placement is None:
            return Response(None)
        return Response(admin_payload(placement, request, _live_id()))

    def put(self, request, event_id):
        event = self._event(event_id)
        serializer = FeaturedEventWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        is_active = data.get('is_active', True)
        desktop_image = data.get('desktop_image')
        mobile_image = data.get('mobile_image')
        placement = FeaturedEvent.objects.filter(event=event).first()

        if placement is None or is_active:
            missing = {}
            if desktop_image is None and (placement is None or not placement.desktop_image):
                missing['desktop_image'] = 'Sube la imagen para computadora (unos 1600 × 280 px).'
            if mobile_image is None and (placement is None or not placement.mobile_image):
                missing['mobile_image'] = 'Sube la imagen para celular (unos 1200 × 500 px).'
            if missing:
                return Response(missing, status=status.HTTP_400_BAD_REQUEST)

        if placement is None:
            placement = FeaturedEvent(event=event)
        placement.is_active = is_active
        if desktop_image is not None:
            placement.desktop_image = desktop_image
        if mobile_image is not None:
            placement.mobile_image = mobile_image
        placement.save()
        return Response(admin_payload(placement, request, _live_id()))

    def delete(self, request, event_id):
        placement = get_object_or_404(FeaturedEvent, event=self._event(event_id))
        placement.desktop_image.delete(save=False)
        placement.mobile_image.delete(save=False)
        placement.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
