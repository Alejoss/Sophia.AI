"""Course purchase confirmation email."""

from unittest.mock import patch

from django.template.loader import render_to_string
from django.test import TestCase, override_settings

from payments.course_receipt import send_course_purchase_receipt
from payments.models import Course, CoursePurchase
from payments.services import mark_course_purchase_paid
from profiles.email_service import EmailServiceError
from tests.factories.users import UserFactory


@override_settings(FRONTEND_PUBLIC_URL='https://www.academiablockchain.com')
class CoursePurchaseReceiptEmailTests(TestCase):
    def setUp(self):
        self.buyer = UserFactory(first_name='Ana', email='cuenta@example.com')
        self.course = Course.objects.get(code='real-historia-bitcoin')

    def _purchase(self, **kwargs):
        defaults = {
            'user': self.buyer,
            'course': self.course,
            'price_amount': 35,
            'receipt_email': 'recibo@example.com',
            'payment_status': 'PENDING',
        }
        defaults.update(kwargs)
        return CoursePurchase.objects.create(**defaults)

    @patch('payments.course_receipt.EmailService.send_template_email', return_value=True)
    def test_marking_paid_emails_the_receipt_address(self, mock_send):
        purchase = self._purchase()
        with self.captureOnCommitCallbacks(execute=True):
            mark_course_purchase_paid(purchase)

        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs
        self.assertEqual(kwargs['receiver_email'], 'recibo@example.com')
        self.assertEqual(kwargs['template_name'], 'course_purchase_confirmed')
        self.assertEqual(
            kwargs['subject'],
            'Tu inscripción al curso La real historia de Bitcoin '
            'y la guerra por las criptomonedas está confirmada.',
        )
        self.assertEqual(kwargs['context']['buyer_name'], 'Ana')
        self.assertEqual(kwargs['context']['price_label'], '$35.00 USD')
        self.assertIn('real-historia-bitcoin-welcome.jpg', kwargs['context']['hero_image_url'])
        self.assertEqual(
            kwargs['context']['course_url'],
            'https://www.academiablockchain.com/cursos/real-historia-bitcoin',
        )
        purchase.refresh_from_db()
        self.assertEqual(purchase.payment_status, 'PAID')

    @patch('payments.course_receipt.EmailService.send_template_email', return_value=True)
    def test_paying_again_does_not_send_a_second_email(self, mock_send):
        purchase = self._purchase()
        with self.captureOnCommitCallbacks(execute=True):
            mark_course_purchase_paid(purchase)
            mark_course_purchase_paid(purchase)
        self.assertEqual(mock_send.call_count, 1)

    @patch('payments.course_receipt.EmailService.send_template_email', return_value=True)
    def test_guest_checkout_uses_the_receipt_email(self, mock_send):
        purchase = self._purchase(
            user=None,
            receipt_email='invitado@example.com',
            checkout_token='guest-token',
        )
        with self.captureOnCommitCallbacks(execute=True):
            mark_course_purchase_paid(purchase)
        kwargs = mock_send.call_args.kwargs
        self.assertEqual(kwargs['receiver_email'], 'invitado@example.com')
        self.assertEqual(kwargs['context']['buyer_name'], '')

    @patch('payments.course_receipt.EmailService.send_template_email', return_value=True)
    def test_falls_back_to_the_account_email(self, mock_send):
        purchase = self._purchase(receipt_email='')
        with self.captureOnCommitCallbacks(execute=True):
            mark_course_purchase_paid(purchase)
        self.assertEqual(mock_send.call_args.kwargs['receiver_email'], 'cuenta@example.com')

    @patch('payments.course_receipt.EmailService.send_template_email', return_value=True)
    def test_skips_when_there_is_no_address(self, mock_send):
        self.buyer.email = ''
        self.buyer.save(update_fields=['email'])
        purchase = self._purchase(receipt_email='')
        with self.captureOnCommitCallbacks(execute=True):
            mark_course_purchase_paid(purchase)
        mock_send.assert_not_called()
        purchase.refresh_from_db()
        self.assertEqual(purchase.payment_status, 'PAID')

    @patch(
        'payments.course_receipt.EmailService.send_template_email',
        side_effect=EmailServiceError('smtp down'),
    )
    def test_a_failed_email_still_leaves_the_purchase_paid(self, _mock_send):
        purchase = self._purchase()
        with self.captureOnCommitCallbacks(execute=True):
            marked = mark_course_purchase_paid(purchase)
        self.assertEqual(marked.payment_status, 'PAID')
        purchase.refresh_from_db()
        self.assertEqual(purchase.payment_status, 'PAID')

    def test_direct_send_is_a_no_op_until_the_purchase_is_paid(self):
        purchase = self._purchase()
        with patch('payments.course_receipt.EmailService.send_template_email') as mock_send:
            self.assertFalse(send_course_purchase_receipt(purchase))
        mock_send.assert_not_called()

    def test_template_includes_the_welcome_image_and_the_course_link(self):
        html = render_to_string(
            'profiles/emails/course_purchase_confirmed.html',
            {
                'buyer_name': 'Ana',
                'course_title': self.course.title,
                'course_url': 'https://www.academiablockchain.com/cursos/real-historia-bitcoin',
                'price_label': '$35.00 USD',
                'hero_image_url': (
                    'https://www.academiablockchain.com/images/real-historia-bitcoin-welcome.jpg'
                ),
                'hero_image_alt': 'Bienvenido al curso. Tu inscripción está confirmada.',
                'brand_name': 'Academia Blockchain',
            },
        )
        text = render_to_string(
            'profiles/emails/course_purchase_confirmed.txt',
            {
                'buyer_name': 'Ana',
                'course_title': self.course.title,
                'course_url': 'https://www.academiablockchain.com/cursos/real-historia-bitcoin',
                'price_label': '$35.00 USD',
                'brand_name': 'Academia Blockchain',
            },
        )
        self.assertIn('real-historia-bitcoin-welcome.jpg', html)
        self.assertIn('Revisar la página de descripción del curso', html)
        self.assertIn('Estamos por explorar juntos esa historia.', html)
        self.assertIn('Comprender es libertad.', html)
        self.assertIn('¡Nos vemos pronto!', text)
        self.assertIn('https://www.academiablockchain.com/cursos/real-historia-bitcoin', text)
