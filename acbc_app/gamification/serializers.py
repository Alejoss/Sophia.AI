from rest_framework import serializers
from .models import Badge, UserBadge
from content.utils import build_media_url


class BadgeSerializer(serializers.ModelSerializer):
    """Serializer for Badge model."""
    icon = serializers.SerializerMethodField()
    
    class Meta:
        model = Badge
        fields = ['id', 'code', 'name', 'description', 'icon', 'category', 'points_value', 'is_active', 'created_at']
        read_only_fields = ['id', 'created_at']
    
    def get_icon(self, obj):
        if obj.icon:
            return build_media_url(obj.icon, self.context.get('request'))
        return None


class UserBadgeSerializer(serializers.ModelSerializer):
    """Serializer for UserBadge model with badge details."""
    
    badge = BadgeSerializer(read_only=True)
    badge_id = serializers.IntegerField(write_only=True, required=False)
    
    class Meta:
        model = UserBadge
        fields = ['id', 'user', 'badge', 'badge_id', 'earned_at', 'points_earned', 'context_data']
        read_only_fields = ['id', 'earned_at', 'points_earned']


class UserBadgeSummarySerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing user badges."""
    
    badge_code = serializers.CharField(source='badge.code', read_only=True)
    badge_name = serializers.CharField(source='badge.name', read_only=True)
    badge_description = serializers.CharField(source='badge.description', read_only=True)
    badge_category = serializers.CharField(source='badge.category', read_only=True)
    badge_icon = serializers.SerializerMethodField()
    
    class Meta:
        model = UserBadge
        fields = [
            'id', 'badge_code', 'badge_name', 'badge_description', 
            'badge_category', 'badge_icon', 'earned_at', 'points_earned', 'context_data'
        ]
        read_only_fields = ['id', 'earned_at', 'points_earned']
    
    def get_badge_icon(self, obj):
        if obj.badge and obj.badge.icon:
            return build_media_url(obj.badge.icon, self.context.get('request'))
        return None