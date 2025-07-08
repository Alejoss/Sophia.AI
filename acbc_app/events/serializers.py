from rest_framework import serializers
from django.utils import timezone

from comments.models import Comment
from certificates.models import Certificate, CertificateRequest
from events.models import Event, EventRegistration
from profiles.serializers import UserSerializer, AcceptedCryptoSerializer
from profiles.models import AcceptedCrypto


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
            request = self.context.get('request')
            if request:
                data['image'] = request.build_absolute_uri(instance.image.url)
            else:
                data['image'] = instance.image.url
        return data

    def validate(self, data):
        # Validate required fields
        if not data.get('title', '').strip():
            raise serializers.ValidationError({
                'title': 'Title is required'
            })
        
        if not data.get('description', '').strip():
            raise serializers.ValidationError({
                'description': 'Description is required'
            })
        
        # Validate other_platform when platform is 'other'
        if data.get('platform') == 'other' and not data.get('other_platform'):
            raise serializers.ValidationError({
                'other_platform': 'Other platform name is required when platform is "Other"'
            })
        
        # Validate end date is after start date
        if data.get('date_end') and data.get('date_start') and data['date_end'] <= data['date_start']:
            raise serializers.ValidationError({
                'date_end': 'End date must be after start date'
            })
        
        return data

    def create(self, validated_data):
        # Set owner based on the request user
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            validated_data['owner'] = request.user
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
            raise serializers.ValidationError("Event is required")
        
        if not user or not user.is_authenticated:
            raise serializers.ValidationError("User must be authenticated")
        
        # Check if user is already registered
        if EventRegistration.objects.filter(user=user, event=event).exists():
            raise serializers.ValidationError("User is already registered for this event")
        
        # Check if user is the event creator
        if user == event.owner:
            raise serializers.ValidationError("Event creators cannot register for their own events")
        
        # Check if event has already started
        if event.date_start and event.date_start < timezone.now():
            raise serializers.ValidationError("Cannot register for events that have already started")
        
        return data
    
    def create(self, validated_data):
        # Set the user from the request
        validated_data['user'] = self.context.get('request').user
        return super().create(validated_data)


class EventRegistrationListSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True)
    event = serializers.PrimaryKeyRelatedField(read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_date = serializers.DateTimeField(source='event.date_start', read_only=True)
    has_certificate = serializers.SerializerMethodField()
    
    class Meta:
        model = EventRegistration
        fields = ['id', 'user', 'user_email', 'event', 'event_title', 'event_date', 'registered_at', 'registration_status', 'payment_status', 'has_certificate']
    
    def get_has_certificate(self, obj):
        """Check if a certificate exists for this user and event"""
        from certificates.models import Certificate
        return Certificate.objects.filter(
            user=obj.user,
            event=obj.event
        ).exists()

