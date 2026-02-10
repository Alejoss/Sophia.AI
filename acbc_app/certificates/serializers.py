from rest_framework import serializers

from content.utils import build_media_url
from .models import CertificateRequest, Certificate, CertificateTemplate
from knowledge_paths.serializers import KnowledgePathSerializer
from knowledge_paths.models import KnowledgePath
from events.models import Event


class CertificateRequestSerializer(serializers.ModelSerializer):
    requester = serializers.CharField(source='requester.username', read_only=True)
    requester_id = serializers.IntegerField(source='requester.id', read_only=True)
    knowledge_path_title = serializers.CharField(source='knowledge_path.title', read_only=True)
    knowledge_path_author = serializers.CharField(source='knowledge_path.author.username', read_only=True)
    knowledge_path_author_id = serializers.IntegerField(source='knowledge_path.author.id', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    event_owner = serializers.CharField(source='event.owner.username', read_only=True)
    event_owner_id = serializers.IntegerField(source='event.owner.id', read_only=True)
    knowledge_path = serializers.PrimaryKeyRelatedField(
        queryset=KnowledgePath.objects.all(), required=False, allow_null=True
    )
    event = serializers.PrimaryKeyRelatedField(
        queryset=Event.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = CertificateRequest
        fields = [
            'id',
            'requester',
            'requester_id',
            'knowledge_path',
            'knowledge_path_title',
            'knowledge_path_author',
            'knowledge_path_author_id',
            'event',
            'event_title',
            'event_owner',
            'event_owner_id',
            'status',
            'request_date',
            'response_date',
            'rejection_reason',
            'notes'
        ]
        read_only_fields = ['status', 'response_date', 'rejection_reason', 'requester', 'requester_id', 'knowledge_path_title', 'knowledge_path_author', 'knowledge_path_author_id', 'event_title', 'event_owner', 'event_owner_id']

    def create(self, validated_data):
        print(f"DEBUG: CertificateRequestSerializer.create called with validated_data: {validated_data}")
        # Set the requester to the current user
        validated_data['requester'] = self.context['request'].user
        print(f"DEBUG: Added requester: {validated_data['requester'].username}")
        try:
            result = super().create(validated_data)
            print(f"DEBUG: CertificateRequest created successfully with ID: {result.id}")
            return result
        except Exception as e:
            print(f"DEBUG: Error in create method: {str(e)}")
            print(f"DEBUG: Error type: {type(e)}")
            import traceback
            print(f"DEBUG: Create method traceback: {traceback.format_exc()}")
            raise

class CertificateSerializer(serializers.ModelSerializer):
    knowledge_path_title = serializers.CharField(source='knowledge_path.title', read_only=True)
    event_title = serializers.CharField(source='event.title', read_only=True)
    issued_by = serializers.CharField(source='issued_by.username', read_only=True)
    download_url = serializers.SerializerMethodField()
    certificate_file_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            'id',
            'certificate_id',
            'knowledge_path',
            'knowledge_path_title',
            'event',
            'event_title',
            'event_registration',
            'issued_on',
            'issued_by',
            'blockchain_hash',
            'certificate_file',
            'certificate_file_url',
            'additional_notes',
            'download_url',
            'data'
        ]

    def get_download_url(self, obj):
        # If you have a method to generate download URLs, implement it here
        # For now, returning None
        return None

    def get_certificate_file_url(self, obj):
        if obj.certificate_file:
            return build_media_url(obj.certificate_file, self.context.get('request'))
        return None


class CertificateTemplateSerializer(serializers.ModelSerializer):
    template_file = serializers.SerializerMethodField()

    class Meta:
        model = CertificateTemplate
        fields = '__all__'

    def get_template_file(self, obj):
        if obj.template_file:
            return build_media_url(obj.template_file, self.context.get('request'))
        return None 