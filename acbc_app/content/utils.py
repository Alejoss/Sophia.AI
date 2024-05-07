from .models import File
from django import forms
import fitz # PyMuPDF

import hashlib
import pdfquery


class FileUploadForm(forms.ModelForm):
    class Meta:
        model = File
        fields = ['group', 'file', 'title', 'edition', 'year', 'author', 'description']


def hash_pdf(file_path):
    document = fitz.open(file_path)
    text_content = ""

    for page in document:
        text_content += page.get_text()

    sha256_hash = hashlib.sha256(text_content.encode('utf-8')).hexdigest()
    print(f"SHA256 Hash: {sha256_hash}")
    return sha256_hash
