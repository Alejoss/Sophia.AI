#!/usr/bin/env python
from django.test import SimpleTestCase

from utils.db_encoding import (
    clear_encoding_cache,
    normalize_notes_value,
    prepare_json_for_db,
    to_ascii_safe,
    to_ascii_safe_json,
)


class DbEncodingUtilsTests(SimpleTestCase):
    def test_to_ascii_safe_strips_accents(self):
        self.assertEqual(to_ascii_safe('Filosofía Cypherpunk'), 'Filosofia Cypherpunk')

    def test_to_ascii_safe_json_strips_unicode_in_dict(self):
        payload = {'order_description': 'Registro: Filosofía'}
        safe = to_ascii_safe_json(payload)
        self.assertEqual(safe['order_description'], 'Registro: Filosofia')

    def test_prepare_json_for_db_strips_notes_on_sql_ascii(self):
        from unittest.mock import patch

        notes = {'message': 'Muchas gracias por Ucronía'}
        with patch('utils.db_encoding.is_sql_ascii_database', return_value=True):
            safe = prepare_json_for_db(notes)
        self.assertEqual(safe['message'], 'Muchas gracias por Ucronia')

    def test_normalize_notes_string(self):
        self.assertEqual(normalize_notes_value('  Hola  '), 'Hola')

    def test_normalize_notes_empty(self):
        self.assertEqual(normalize_notes_value(''), '')
        self.assertEqual(normalize_notes_value(None), '')

    def test_normalize_notes_dict(self):
        self.assertEqual(normalize_notes_value({'message': 'Gracias'}), 'Gracias')

    def test_normalize_notes_unicode_string(self):
        self.assertEqual(
            normalize_notes_value('Muchas gracias por Ucronía'),
            'Muchas gracias por Ucronía',
        )

    def tearDown(self):
        clear_encoding_cache()
