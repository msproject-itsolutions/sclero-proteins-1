"""Check that INTEGRATION_ENCRYPTION_KEY decrypts every stored credential.

deploy/vps-install.sh runs this against the release candidate before any live
container is replaced. Encrypted fields fail closed, so a wrong key would make
every stored credential read as empty and silently break payments, shipping,
email and webhooks. Read-only; secret values are never printed.

Usage:
    python manage.py verify_encryption_key
"""
import json

from cryptography.fernet import InvalidToken
from django.apps import apps
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.models import TextField
from django.db.models.functions import Cast

from apps.common.fields import PREFIX, EncryptedTextField, SensitiveKeysJSONField, _fernet


def encrypted_fields():
    """Yield (model, field) for every encrypted field stored in a model's own table."""
    for model in apps.get_models():
        if model._meta.proxy:
            continue
        for field in model._meta.local_concrete_fields:
            # EncryptedJSONField subclasses EncryptedTextField.
            if isinstance(field, (EncryptedTextField, SensitiveKeysJSONField)):
                yield model, field


def _strings(value):
    if isinstance(value, dict):
        for item in value.values():
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)
    elif isinstance(value, str):
        yield value


def _stored_tokens(field, raw):
    """Return the enc:v1: strings held in one raw column value."""
    if raw is None:
        return []
    candidates = [raw]
    if isinstance(field, SensitiveKeysJSONField):
        try:
            candidates = list(_strings(json.loads(raw)))
        except ValueError:
            pass  # not JSON: Django returns such a value as the raw string
    return [value for value in candidates if value.startswith(PREFIX)]


def _decrypts(fernet, token):
    try:
        fernet.decrypt(token[len(PREFIX):].encode('ascii'))
    except (InvalidToken, ValueError):
        return False
    return True


def check_field(model, field):
    """Return (verified value count, pks whose stored values fail) for one field."""
    fernet = _fernet()
    rows = (
        model._base_manager.order_by('pk')
        # Cast bypasses the field's from_db_value, which would decrypt (and
        # fail closed to '') instead of exposing the stored ciphertext.
        .annotate(_raw=Cast(field.name, output_field=TextField()))
        .values_list('pk', '_raw')
    )
    verified, failing = 0, []
    for pk, raw in rows:
        tokens = _stored_tokens(field, raw)
        if all(_decrypts(fernet, token) for token in tokens):
            verified += len(tokens)
        else:
            failing.append(pk)
    return verified, failing


class Command(BaseCommand):
    help = 'Verify INTEGRATION_ENCRYPTION_KEY decrypts every stored credential (read-only).'

    def handle(self, *args, **options):
        tables = set(connection.introspection.table_names())
        verified, failures = 0, 0
        for model, field in encrypted_fields():
            table = model._meta.db_table
            if table not in tables:
                continue  # fresh database: nothing stored yet
            with connection.cursor() as cursor:
                columns = {
                    column.name for column in connection.introspection.get_table_description(cursor, table)
                }
            if field.column not in columns:
                continue  # added by a migration this release has not applied yet
            count, failing = check_field(model, field)
            verified += count
            for pk in failing:
                failures += 1
                self.stderr.write(
                    f'{model._meta.label} pk={pk} field={field.name}: '
                    'cannot decrypt with the configured INTEGRATION_ENCRYPTION_KEY'
                )
        if failures:
            raise CommandError(
                f'{failures} stored credential(s) cannot be decrypted with INTEGRATION_ENCRYPTION_KEY; '
                'aborting before any live change.'
            )
        self.stdout.write(f'Encryption key verified for {verified} stored value(s).')
