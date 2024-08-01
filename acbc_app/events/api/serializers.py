from rest_framework import serializers

from courses.models import Event, Comment, ConnectionPlatform, Certificate, Bookmark, CertificateRequest
from profiles.api.serializers import UserSerializer


class ConnectionPlatformSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConnectionPlatform
        fields = '__all__'


class EventSerializer(serializers.ModelSerializer):
    owner = UserSerializer(read_only=True)
    platform = ConnectionPlatformSerializer(read_only=True)

    class Meta:
        model = Event
        fields = '__all__'

    def validate(self, data):
        # Example validation: ensure end date is after start date
        if data['date_end'] < data['date_start']:
            raise serializers.ValidationError("End date must be after start date.")
        return data

    def create(self, validated_data):
        # Example: Set owner based on the request user, if not passed explicitly
        request = self.context['request']
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


class BookmarkSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = Bookmark
        fields = '__all__'


class CertificateRequestSerializer(serializers.ModelSerializer):
    event = EventSerializer(read_only=True)
    user = UserSerializer(read_only=True)

    class Meta:
        model = CertificateRequest
        fields = '__all__'

