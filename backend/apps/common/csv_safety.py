"""Neutralise spreadsheet formulas in CSV exports.

Spreadsheet apps evaluate cells that start with = + - @ (or tab/CR). Customer
text such as an email address could otherwise become a live formula when
staff open an export.
"""
import csv
import re

FORMULA_PREFIXES = ('=', '+', '-', '@', '\t', '\r')
_NUMBER = re.compile(r'-?\d+(\.\d+)?')


def safe_cell(value):
    if isinstance(value, str) and value.startswith(FORMULA_PREFIXES) and not _NUMBER.fullmatch(value):
        return "'" + value
    return value


def safe_row(row):
    return [safe_cell(value) for value in row]


class _SafeWriter:
    def __init__(self, writer):
        self._writer = writer

    def writerow(self, row):
        return self._writer.writerow(safe_row(row))

    def writerows(self, rows):
        return self._writer.writerows(safe_row(row) for row in rows)


def safe_writer(fileobj, **kwargs):
    return _SafeWriter(csv.writer(fileobj, **kwargs))
