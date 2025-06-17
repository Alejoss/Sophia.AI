from django.contrib import admin
from .models import CertificateRequest, Certificate, CertificateTemplate

@admin.register(CertificateRequest)
class CertificateRequestAdmin(admin.ModelAdmin):
    list_display = ('id', 'requester', 'knowledge_path', 'status', 'request_date', 'response_date')
    list_filter = ('status', 'request_date', 'response_date')
    search_fields = ('requester__username', 'knowledge_path__title')
    readonly_fields = ('request_date', 'response_date')
    ordering = ('-request_date',)

@admin.register(Certificate)
class CertificateAdmin(admin.ModelAdmin):
    list_display = ('certificate_id', 'user', 'knowledge_path', 'template', 'issued_on', 'blockchain_hash')
    list_filter = ('issued_on',)
    search_fields = ('user__username', 'knowledge_path__title', 'certificate_id')
    readonly_fields = ('certificate_id', 'issued_on')
    ordering = ('-issued_on',)

@admin.register(CertificateTemplate)
class CertificateTemplateAdmin(admin.ModelAdmin):
    list_display = ('title', 'version', 'is_active', 'created_at', 'updated_at')
    list_filter = ('is_active', 'created_at', 'updated_at')
    search_fields = ('title', 'description', 'note')
    readonly_fields = ('created_at', 'updated_at')
    ordering = ('-created_at',)
