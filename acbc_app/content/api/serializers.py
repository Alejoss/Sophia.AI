from rest_framework import serializers

from content.models import Library, Group, File
from profiles.serializers import UserSerializer


class LibrarySerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Library
        fields = ['id', 'user', 'name']


class GroupSerializer(serializers.ModelSerializer):
    library = LibrarySerializer(read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'library', 'name']


class FileSerializer(serializers.ModelSerializer):
    library = LibrarySerializer(read_only=True)
    group = GroupSerializer(read_only=True)
    ai_detection_result = serializers.JSONField(required=False)
    transaction_receipt = serializers.JSONField(required=False)

    class Meta:
        model = File
        fields = ['id', 'library', 'group', 'file', 'title', 'url', 'extension', 'uploaded_at',
                  'edition', 'year', 'author', 'description', 'file_size', 'extracted_text',
                  'text_length', 'text_hash', 'ai_detection_result', 'transaction_receipt']

    def save(self, *args, **kwargs):
        # Handle the file size calculation if not already provided
        if self.instance is None:  # Creating a new File object
            file = self.validated_data.get('file')
            if file and not self.validated_data.get('file_size'):
                self.validated_data['file_size'] = file.size
        super().save(*args, **kwargs)