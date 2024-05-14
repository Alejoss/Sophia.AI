import json
import hashlib
import fitz # PyMuPDF
import requests
import re  # Regular expressions library

from .models import File
from django import forms


class FileUploadForm(forms.ModelForm):
    class Meta:
        model = File
        fields = ['group', 'file', 'title', 'edition', 'year', 'author', 'description']


def extract_text_from_pdf(pdf_path):
    document = fitz.open(pdf_path)
    text = ""
    for page_num in range(document.page_count):
        page = document.load_page(page_num)
        text += page.get_text()

    return text


def gptzero_post_request(api_key, document, version, multilingual=False):
    url = "https://api.gptzero.me/v2/predict/text"
    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "x-api-key": api_key
    }
    data = {
        "document": document,
        "version": version,
        "multilingual": multilingual
    }

    response = requests.post(url, headers=headers, data=json.dumps(data))

    if response.status_code == 200:
        return response.json()
    else:
        print("Request failed with status code:", response.status_code)
        print("Response content:", response.content)
        response.raise_for_status()  # Raise an HTTPError if the request was not successful
