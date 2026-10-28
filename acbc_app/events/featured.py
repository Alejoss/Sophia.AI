"""The wide banner that advertises one event on Biblioteca, Caminos, and Temas."""

from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.utils import build_media_url
from events.models import Event, FeaturedEvent

MAX_BANNER_BYTES = 5 * 1024 * 1024


def featured_payload(placement, request, *, include_schedule=False):
    event = placement.event
    data = {
        'id': placement.id,
        'event_id': event.id,
        'title': event.title,
        'image': build_media_url(placement.image, request),
        'path': f'/events/{event.id}',
        'is_active': placement.is_active,
    }
    if include_schedule:
        data.update({
            'date_start': event.date_start,
            'date_end': event.date_end,
            'date_start_has_time': event.date_start_has_time,
            'date_end_has_time': event.date_end_has_time,
        })
    return data


class FeaturedEventWriteSerializer(serializers.Serializer):
    is_active = serializers.BooleanField(required=False)
    image = serializers.ImageField(required=False, allow_null=True)

    def validate_image(self, image):
        if image and image.size > MAX_BANNER_BYTES:
            raise serializers.ValidationError('La imagen debe pesar menos de 5 MB.')
        return image


def _can_manage(user, event):
    return bool(user and user.is_authenticated and (user.is_staff or user.id == event.owner_id))


class CurrentFeaturedEventView(APIView):
    """The one banner currently on display. Anonymous visitors can read it."""

    permission_classes = [AllowAny]

    def get(self, request):
        placement = FeaturedEvent.live()
        if placement is None:
            return Response(None)
        return Response(featured_payload(placement, request, include_schedule=True))


class EventFeatureView(APIView):
    """Upload or replace the wide banner for one event."""

    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def _event(self, event_id):
        return get_object_or_404(Event, pk=event_id, deleted=False)

    def get(self, request, event_id):
        event = self._event(event_id)
        if not _can_manage(request.user, event):
            return Response(
                {'detail': 'No puedes editar el anuncio de este evento.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        placement = FeaturedEvent.objects.filter(event=event).first()
        if placement is None:
            return Response(None)
        return Response(featured_payload(placement, request))

    def put(self, request, event_id):
        event = self._event(event_id)
        if not _can_manage(request.user, event):
            return Response(
                {'detail': 'No puedes editar el anuncio de este evento.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = FeaturedEventWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        is_active = serializer.validated_data.get('is_active', True)
        image = serializer.validated_data.get('image')
        placement = FeaturedEvent.objects.filter(event=event).first()

        if is_active and image is None and (placement is None or not placement.image):
            return Response(
                {'image': 'Sube una imagen ancha para publicar el anuncio.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if placement is None:
            if image is None:
                return Response(None)
            placement = FeaturedEvent(event=event, image=image, is_active=is_active)
        else:
            placement.is_active = is_active
            if image is not None:
                placement.image = image
        placement.save()
        return Response(featured_payload(placement, request))
