from django.test import SimpleTestCase, override_settings


@override_settings(DEBUG=False, FRONTEND_PUBLIC_URL='http://localhost:5173')
class Custom404Tests(SimpleTestCase):
    def test_browser_api_404_returns_branded_html(self):
        response = self.client.get(
            '/api/this-route-does-not-exist/',
            HTTP_ACCEPT='text/html',
        )

        self.assertEqual(response.status_code, 404)
        self.assertIn('text/html', response['Content-Type'])
        content = response.content.decode()
        self.assertIn('Academia Blockchain', content)
        self.assertIn('No encontramos esta página', content)
        self.assertIn('http://localhost:5173/', content)
        self.assertIn('/api/this-route-does-not-exist/', content)

    def test_api_client_404_returns_json(self):
        response = self.client.get(
            '/api/this-route-does-not-exist/',
            HTTP_ACCEPT='application/json',
        )

        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {'detail': 'Not found.'})
