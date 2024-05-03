from .models import File
from django import forms


class FileUploadForm(forms.ModelForm):
    class Meta:
        model = File
        fields = ['file', 'title']
