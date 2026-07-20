"""Security checks for administrator-configured outbound webhook URLs."""

import ipaddress
import socket
from urllib.parse import urlsplit

from rest_framework import serializers


def _is_public_ip(value):
    address = ipaddress.ip_address(value)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def validate_webhook_destination(url, *, resolve_dns=True):
    """Require an HTTPS destination that cannot directly target private services.

    The check runs both when an admin saves a subscription and immediately
    before each delivery. Rechecking at delivery time limits DNS-change attacks
    and prevents stale subscriptions from bypassing newer validation.
    """
    try:
        parsed = urlsplit(url)
    except (TypeError, ValueError) as exc:
        raise serializers.ValidationError('Enter a valid webhook URL.') from exc

    if parsed.scheme.lower() != 'https':
        raise serializers.ValidationError('Webhook URLs must use HTTPS.')
    if not parsed.hostname or parsed.username or parsed.password:
        raise serializers.ValidationError('Webhook URLs must contain a valid host and no credentials.')

    hostname = parsed.hostname.rstrip('.').lower()
    if hostname == 'localhost' or hostname.endswith('.localhost'):
        raise serializers.ValidationError('Private or local webhook destinations are not allowed.')

    try:
        if not _is_public_ip(hostname):
            raise serializers.ValidationError('Private or local webhook destinations are not allowed.')
        return
    except ValueError:
        pass

    if not resolve_dns:
        return

    try:
        addresses = {
            result[4][0]
            for result in socket.getaddrinfo(hostname, parsed.port or 443, type=socket.SOCK_STREAM)
        }
    except socket.gaierror as exc:
        raise serializers.ValidationError('Webhook destination could not be resolved.') from exc

    if not addresses or any(not _is_public_ip(address) for address in addresses):
        raise serializers.ValidationError('Webhook destination resolves to a private or unsafe address.')
