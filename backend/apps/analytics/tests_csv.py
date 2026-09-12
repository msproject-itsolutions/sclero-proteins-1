from django.test import SimpleTestCase

from apps.analytics.reports import _stream_csv
from apps.common.csv_safety import safe_cell, safe_row


class SafeCellTests(SimpleTestCase):
    def test_formula_prefixes_are_neutralised(self):
        for value in ('=HYPERLINK("http://x")', '+1+1', '-cmd', '@SUM(A1)', '\tx', '\rx'):
            with self.subTest(value=value):
                self.assertEqual(safe_cell(value), "'" + value)

    def test_plain_values_and_numbers_are_unchanged(self):
        self.assertEqual(safe_cell('buyer@example.com'), 'buyer@example.com')
        self.assertEqual(safe_cell('-12.50'), '-12.50')
        self.assertEqual(safe_cell(-3), -3)
        self.assertEqual(safe_row(['a', '=b', 4]), ['a', "'=b", 4])


class StreamCsvTests(SimpleTestCase):
    def test_streamed_report_cells_are_neutralised(self):
        response = _stream_csv('clv.csv', ['email', 'orders'], [['=HYPERLINK("http://x")@x.com', 2]])
        content = b''.join(response.streaming_content).decode()
        self.assertIn("'=HYPERLINK", content)
