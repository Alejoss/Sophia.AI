from rest_framework import serializers
from .models import CertificateRequest, Certificate, CertificateTemplate
from knowledge_paths.serializers import KnowledgePathSerializer


class CertificateRequestSerializer(serializers.ModelSerializer):
    requester = serializers.CharField(source='requester.username', read_only=True)
    knowledge_path_title = serializers.CharField(source='knowledge_path.title', read_only=True)
    knowledge_path_author = serializers.CharField(source='knowledge_path.author.username', read_only=True)

    class Meta:
        model = CertificateRequest
        fields = [
            'id',
            'requester',
            'knowledge_path',
            'knowledge_path_title',
            'knowledge_path_author',
            'status',
            'request_date',
            'response_date',
            'rejection_reason',
            'notes'
        ]
        read_only_fields = ['status', 'response_date', 'rejection_reason', 'requester', 'knowledge_path_title', 'knowledge_path_author']

    def create(self, validated_data):
        # Set the requester to the current user
        validated_data['requester'] = self.context['request'].user
        return super().create(validated_data)

class CertificateSerializer(serializers.ModelSerializer):
    knowledge_path_title = serializers.CharField(source='knowledge_path.title')
    download_url = serializers.SerializerMethodField()

    class Meta:
        model = Certificate
        fields = [
            'id',
            'certificate_id',
            'knowledge_path',
            'knowledge_path_title',
            'issued_on',
            'blockchain_hash',
            'download_url',
            'data'
        ]

    def get_download_url(self, obj):
        # If you have a method to generate download URLs, implement it here
        # For now, returning None
        return None 