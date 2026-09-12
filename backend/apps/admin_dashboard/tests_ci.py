import os
import unittest

from django.db import connection
from django.test import SimpleTestCase


class ContinuousIntegrationDatabaseTests(SimpleTestCase):
    @unittest.skipUnless(os.getenv('CI') == 'true', 'Only meaningful on the CI runner.')
    def test_ci_runs_against_postgresql(self):
        # SQLite ignores row locks and column lengths; a silent fallback would
        # let concurrency and truncation bugs pass CI.
        self.assertEqual(connection.vendor, 'postgresql')
