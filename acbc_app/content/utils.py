from .models import File
from django import forms

import hashlib
import pdfquery


class FileUploadForm(forms.ModelForm):
    class Meta:
        model = File
        fields = ['group', 'file', 'title', 'edition', 'year', 'author', 'description']


def hash_pdf(file_path):
    # Load the PDF using PDFQuery
    pdf = pdfquery.PDFQuery(file_path)
    pdf.load()

    # Extract text content from the PDF
    text_content = ""
    for page in range(1, pdf.doc.catalog['Pages']['Count'] + 1):  # TODO error 'PDFObjRef' object is not subscriptable
        pdf.load(page)
        text_content += pdf.pq('LTTextLineHorizontal').text()

    # Compute the SHA-256 hash
    sha256_hash = hashlib.sha256(text_content.encode('utf-8')).hexdigest()

    return sha256_hash
