from rest_framework import serializers

from comments.models import Comment
from certificates.models import Certificate, CertificateRequest
from content.utils import build_media_url
from events.models import Event, EventRegistration
from events.scheduling import (
    _mapping_copy,
    event_range_is_invalid,
    normalize_optional_event_datetime,
)
from profiles.serializers import UserSerializer, AcceptedCryptoSerializer
from profiles.models import AcceptedCrypto


def _parse_bool(value):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.lower() in ('true', '1', 'yes', 'on')
    return bool(value)


class EventSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    image = serializers.ImageField(required=False, allow_null=True)
    owner_accepted_cryptos = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = '__all__'

    def get_owner_accepted_cryptos(self, obj):
        """Get the owner's accepted cryptocurrencies (non-deleted)"""
        accepted_cryptos = AcceptedCrypto.objects.filter(
            user=obj.owner,
            deleted=False
        )
        return AcceptedCryptoSerializer(accepted_cryptos, many=True, context=self.context).data

    def to_representation(self, instance):
        """Custom representation to provide full URLs for images"""
        data = super().to_representation(instance)
        if instance.image:
            data['image'] = build_media_url(instance.image, self.context.get('request'))
        return data

    def to_internal_value(self, data):
        """Accept a calendar date with no clock time.

        ``YYYY-MM-DD`` is stored at noon UTC and ``date_*_has_time`` is False.
        A blank date clears the field. A value that includes a time keeps it.
        """
        mutable = _mapping_copy(data)
        for field_name, flag_name in (
            ('date_start', 'date_start_has_time'),
            ('date_end', 'date_end_has_time'),
        ):
            if field_name not in mutable:
                continue
            normalized, has_time = normalize_optional_event_datetime(mutable.get(field_name))
            mutable[field_name] = normalized
            mutable[flag_name] = has_time
        return super().to_internal_value(mutable)

    def validate(self, data):
        if 'is_visible' in self.initial_data:
            data['is_visible'] = _parse_bool(self.initial_data.get('is_visible'))

        # Validate required fields
        if not data.get('title', '').strip():
            raise serializers.ValidationError({
                'title': 'El título es requerido'
            })
        
        if not data.get('description', '').strip():
            raise serializers.ValidationError({
                'description': 'La descripción es requerida'
            })
        
        # Validate other_platform when platform is 'other'
        if data.get('platform') == 'other' and not data.get('other_platform'):
            raise serializers.ValidationError({
                'other_platform': 'El nombre de otra plataforma es requerido cuando la plataforma es "Otra"'
            })
        
        start = data['date_start'] if 'date_start' in data else (
            self.instance.date_start if self.instance else None
        )
        end = data['date_end'] if 'date_end' in data else (
            self.instance.date_end if self.instance else None
        )
        start_has_time = data['date_start_has_time'] if 'date_start_has_time' in data else (
            self.instance.date_start_has_time if self.instance else True
        )
        end_has_time = data['date_end_has_time'] if 'date_end_has_time' in data else (
            self.instance.date_end_has_time if self.instance else True
        )
        if event_range_is_invalid(start, end, start_has_time, end_has_time):
            raise serializers.ValidationError({
                'date_end': 'La fecha de finalización debe ser posterior a la fecha de inicio'
            })
        
        return data

    def create(self, validated_data):
        # Set owner based on the request user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['owner'] = request.user
        validated_data.setdefault('is_visible', False)
        instance = super().create(validated_data)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        return instance


class CommentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    event = EventSerializer(read_only=True)

    class Meta:
        model = Comment
        fields = '__all__'


class CertificateSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = Certificate
        fields = '__all__'


# class BookmarkSerializer(serializers.ModelSerializer): # TODO create Bookmark model
#     event = EventSerializer(read_only=True)
#     user = UserSerializer(read_only=True)
#
#     class Meta:
#         model = Bookmark
#         fields = '__all__'


class CertificateRequestSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = CertificateRequest
        fields = '__all__'


class EventRegistrationSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    event = serializers.PrimaryKeyRelatedField(queryset=Event.objects.all())
    
    class Meta:
        model = EventRegistration
        fields = '__all__'
        read_only_fields = ('user', 'registered_at')
    
    def validate(self, data):
        # Additional validation for registration
        event = data.get('event')
        request = self.context.get('request')
        user = request.user if request else None
        
        if not event:
            raise serializers.ValidationError("El evento es requerido")
        
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("El usuario debe estar autenticado")
        
        existing = EventRegistration.objects.filter(user=user, event=event).first()
        if existing and existing.registration_status == 'REGISTERED':
            raise serializers.ValidationError("El usuario ya está registrado para este evento")
        if existing and existing.registration_status == 'CANCELLED':
            data['_reactivate_registration'] = existing
        
        # Check if user is the event creator
        if user == event.owner:
            raise serializers.ValidationError("Los creadores de eventos no pueden registrarse en sus propios eventos")
        
        if event.has_started():
            raise serializers.ValidationError("No se puede registrar para eventos que ya han comenzado")

        return data
    
    def create(self, validated_data):
        reactivate = validated_data.pop('_reactivate_registration', None)
        validated_data['user'] = self.context.get('request').user
        if reactivate:
            reactivate.registration_status = 'REGISTERED'
            reactivate.payment_status = 'PENDING'
            reactivate.notes = ''
            reactivate.save(update_fields=['registration_status', 'payment_status', 'notes'])
            return reactivate
        return super().create(validated_data)


class EventRegistrationListSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    event = serializers.PrimaryKeyRelatedField(read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_date = serializers.DateTimeField(source='event.date_start', read_only=True)
    event_date_has_time = serializers.BooleanField(source='event.date_start_has_time', read_only=True)
    has_certificate = serializers.SerializerMethodField()
    
    class Meta:
        model = EventRegistration
        fields = ['id', 'user', 'user_email', 'event', 'event_title', 'event_date', 'event_date_has_time', 'registered_at', 'registration_status', 'payment_status', 'has_certificate']
    
    def get_has_certificate(self, obj):
        """Check if a certificate exists for this user and event"""
        from certificates.models import Certificate
        return Certificate.objects.filter(
            user=obj.user,
            event=obj.event
        ).exists()

