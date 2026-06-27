#!/usr/bin/env python
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import User
from django.test import TestCase

from utils.notification_utils import create_notification


class CreateNotificationTests(TestCase):
    @patch('notifications.models.Notification.objects.create')
    def test_create_notification_persists_via_model(self, mock_create):
        mock_create.return_value = MagicMock()
        recipient = User.objects.create_user(
            username='recipient',
            email='recipient@example.com',
            password='testpass123',
        )

        create_notification(
            recipient=recipient,
            verb='solicitó un certificado',
            description='Detalle de la solicitud',
        )

        mock_create.assert_called_once_with(
            recipient=recipient,
            verb='solicitó un certificado',
            description='Detalle de la solicitud',
        )
