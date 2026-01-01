from rest_framework import serializers
import logging

from django.contrib.auth.models import User

from profiles.models import CryptoCurrency, AcceptedCrypto, ContactMethod, Profile
from notifications.models import Notification

# Get logger for profiles serializers
logger = logging.getLogger('academia_blockchain.profiles.serializers')

# UserRegistrationSerializer (moved from views.py)
class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, style={'input_type': 'password'})
    email = serializers.EmailField(required=True)
    username = serializers.CharField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password')

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese correo electrónico.")
        return value

    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Ya existe un usuario con ese nombre de usuario.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            password=validated_data['password']
        )
        return user

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']


class CryptoCurrencySerializer(serializers.ModelSerializer):
    thumbnail = serializers.SerializerMethodField()
    
    class Meta:
        model = CryptoCurrency
        fields = ['id', 'name', 'code', 'thumbnail']
    
    def get_thumbnail(self, obj):
        if obj.thumbnail:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None


class AcceptedCryptoSerializer(serializers.ModelSerializer):
    crypto = CryptoCurrencySerializer(read_only=True)

    class Meta:
        model = AcceptedCrypto
        fields = ['id', 'user', 'crypto', 'address', 'deleted']


class ContactMethodSerializer(serializers.ModelSerializer):
    has_contact_url = serializers.SerializerMethodField()

    class Meta:
        model = ContactMethod
        fields = ['id', 'user', 'name', 'description', 'url_link', 'deleted']

    def get_has_contact_url(self, obj):
        return obj.has_contact_url()


class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    profile_picture = serializers.SerializerMethodField()

    # cryptos_list = serializers.SerializerMethodField()  # TODO manejar en otro endpoint

    class Meta:
        model = Profile
        fields = ['user', 'interests', 'profile_description', 'timezone', 'is_teacher', 'profile_picture']

    def get_profile_picture(self, obj):
        if obj.profile_picture:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.profile_picture.url)
            return obj.profile_picture.url
        return None

    def get_cryptos_list(self, obj):
        # Fetch all non-deleted AcceptedCrypto instances related to this profile's user
        cryptos = AcceptedCrypto.objects.filter(user=obj.user, deleted=False)
        # Serialize the data
        return AcceptedCryptoSerializer(cryptos, many=True).data

class NotificationSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    actor_id = serializers.SerializerMethodField()
    content_type = serializers.SerializerMethodField()
    target_url = serializers.SerializerMethodField()
    context_title = serializers.SerializerMethodField()
    target = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'actor', 'actor_id', 'verb', 'description',
            'timestamp', 'unread', 'content_type', 'target_url',
            'context_title', 'target'
        ]

    def get_actor(self, obj):
        return obj.actor.username if obj.actor else None

    def get_actor_id(self, obj):
        return obj.actor.id if obj.actor else None

    def get_content_type(self, obj):
        if obj.action_object_content_type:
            return obj.action_object_content_type.model
        return None

    def get_target(self, obj):
        if obj.target:
            return {
                'id': obj.target.id,
                'title': obj.target.title if hasattr(obj.target, 'title') else None
            }
        return None

    def get_context_title(self, obj):
        try:
            # For knowledge path comments
            if obj.verb == 'comentó en tu ruta de conocimiento' and obj.target:
                return obj.target.title if hasattr(obj.target, 'title') else None
            
            # For comment replies
            if obj.verb == 'respondió a' and obj.action_object:
                comment = obj.action_object
                if comment and comment.content_object:
                    if hasattr(comment.content_object, 'title'):
                        return comment.content_object.title
                    elif hasattr(comment.content_object, 'name'):
                        return comment.content_object.name
            
            # For event registrations
            if obj.verb == 'se registró en tu evento' and obj.target:
                return obj.target.title if hasattr(obj.target, 'title') else None
            
            # For payment accepted
            if obj.verb == 'aceptó tu pago para' and obj.target:
                return obj.target.title if hasattr(obj.target, 'title') else None
            
            # For certificate sent
            if obj.verb == 'te envió un certificado para' and obj.target:
                return obj.target.title if hasattr(obj.target, 'title') else None
                
            return None
        except Exception as e:
            logger.error("Error getting context title", extra={
                'notification_id': obj.id,
                'verb': obj.verb,
                'error': str(e),
            }, exc_info=True)
            return None

    def get_target_url(self, obj):
        try:
            # For knowledge path comments
            if obj.verb == 'comentó en tu ruta de conocimiento' and obj.target:
                return f'/knowledge_path/{obj.target.id}' if hasattr(obj.target, 'id') else None
            
            # For knowledge path completion
            if obj.verb == 'completó tu ruta de conocimiento' and obj.target:
                return f'/knowledge_path/{obj.target.id}' if hasattr(obj.target, 'id') else None
            
            # For comment replies
            if obj.verb == 'respondió a' and obj.action_object:
                comment = obj.action_object
                if comment and comment.content_object:
                    if hasattr(comment.content_object, 'id'):
                        return f'/knowledge_path/{comment.content_object.id}'
            
            # For content upvotes
            if obj.verb == 'votó positivamente tu contenido' and obj.target:
                return f'/content/{obj.target.id}/library' if hasattr(obj.target, 'id') else None
            
            # For knowledge path upvotes
            if obj.verb == 'votó positivamente tu ruta de conocimiento' and obj.target:
                return f'/knowledge_path/{obj.target.id}' if hasattr(obj.target, 'id') else None
            
            # For event registrations
            if obj.verb == 'se registró en tu evento' and obj.target:
                return f'/events/{obj.target.id}' if hasattr(obj.target, 'id') else None
            
            # For payment accepted
            if obj.verb == 'aceptó tu pago para' and obj.target:
                return f'/events/{obj.target.id}' if hasattr(obj.target, 'id') else None
            
            # For certificate sent
            if obj.verb == 'te envió un certificado para' and obj.target:
                return f'/events/{obj.target.id}' if hasattr(obj.target, 'id') else None
                
            return None
        except Exception as e:
            logger.error("Error getting target URL", extra={
                'notification_id': obj.id,
                'verb': obj.verb,
                'error': str(e),
            }, exc_info=True)
            return None

    def getNotificationDescription(self, notification):
        if notification.verb == 'comentó en tu ruta de conocimiento':
            return f"{notification.actor} comentó en tu ruta de conocimiento {notification.context_title}"
        elif notification.verb == 'respondió a':
            return f"{notification.actor} respondió a tu comentario en {notification.context_title}"
        elif notification.verb == 'completó tu ruta de conocimiento':
            return notification.description
        elif notification.verb == 'solicitó un certificado para tu ruta de conocimiento':
            return notification.description
        elif notification.verb == 'aprobó tu solicitud de certificado para':
            return notification.description
        elif notification.verb == 'rechazó tu solicitud de certificado para':
            return notification.description
        elif notification.verb == 'votó positivamente tu contenido':
            return notification.description
        elif notification.verb == 'votó positivamente tu ruta de conocimiento':
            return notification.description
        elif notification.verb == 'se registró en tu evento':
            return notification.description
        elif notification.verb == 'aceptó tu pago para':
            return notification.description
        elif notification.verb == 'te envió un certificado para':
            return notification.description
        else:
            return f"{notification.actor} {notification.verb} tu comentario en {notification.context_title}"
