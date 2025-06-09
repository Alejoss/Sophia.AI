from rest_framework import serializers
from .models import CertificateRequest, Certificate, CertificateTemplate

class CertificateRequestSerializer(serializers.ModelSerializer):
    requester = serializers.ReadOnlyField(source='requester.username')
    knowledge_path_title = serializers.ReadOnlyField(source='knowledge_path.title')
    knowledge_path_author = serializers.ReadOnlyField(source='knowledge_path.author.username')

    class Meta:
        model = CertificateRequest
        fields = [
            'id', 'requester', 'knowledge_path', 'knowledge_path_title',
            'knowledge_path_author', 'status', 'request_date', 'response_date', 
            'rejection_reason', 'notes'
        ]
        read_only_fields = ['status', 'response_date', 'rejection_reason']

    def create(self, validated_data):
        # Set the requester to the current user
        validated_data['requester'] = self.context['request'].user
        return super().create(validated_data) 