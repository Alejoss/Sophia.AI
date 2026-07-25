from allauth.account.adapter import DefaultAccountAdapter

from profiles.email_service import EmailService


class AcademiaAccountAdapter(DefaultAccountAdapter):
    """Inject shared brand context into allauth transactional emails."""

    def send_mail(self, template_prefix, email, context):
        context = {**EmailService.get_brand_context(), **context}
        return super().send_mail(template_prefix, email, context)
