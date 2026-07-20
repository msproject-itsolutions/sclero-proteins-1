import imaplib
import email
from email.header import decode_header
import os
import re
from django.contrib.auth import get_user_model
from apps.admin_dashboard.models import SystemSetting
from apps.users.models import SupportTicket


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {'1', 'true', 'yes', 'on'}


def _get_imap_config():
    """Use admin-managed IMAP settings when present, then environment values."""
    configured = {}
    try:
        row = SystemSetting.objects.filter(key='IMAP_SETTINGS').first()
        if row and isinstance(row.value, dict):
            configured = dict(row.value)
    except Exception:
        configured = {}

    def get(name, default=''):
        value = configured.get(name)
        return value if value not in (None, '') else os.getenv(name, default)

    user = get('IMAP_USER')
    password = get('IMAP_PASSWORD')
    return {
        'enabled': _as_bool(get('IMAP_ENABLED', None), bool(user and password)),
        'host': get('IMAP_HOST', 'outlook.office365.com'),
        'port': int(get('IMAP_PORT', '993')),
        'user': user,
        'password': password,
    }

def clean_header(value):
    if not value:
        return ""
    decoded = decode_header(value)
    parts = []
    for text, encoding in decoded:
        if isinstance(text, bytes):
            try:
                parts.append(text.decode(encoding or 'utf-8', errors='ignore'))
            except Exception:
                parts.append(text.decode('latin1', errors='ignore'))
        else:
            parts.append(str(text))
    return "".join(parts)

def parse_sender_email(from_header):
    if not from_header:
        return ""
    match = re.search(r'<([^>]+)>', from_header)
    if match:
        return match.group(1).strip()
    return from_header.strip()

def sync_support_emails():
    """
    Connect to Microsoft 365 / GoDaddy IMAP server, fetch unseen emails,
    and convert them to CRM SupportTickets.
    """
    config = _get_imap_config()
    if not config['enabled']:
        return {'status': 'disabled', 'message': 'IMAP support inbox sync is disabled.'}

    if not config['user'] or not config['password']:
        raise RuntimeError('IMAP_USER and IMAP_PASSWORD must be configured before email sync can run.')

    tickets_created = 0
    try:
        # Initialize secure connection to Microsoft 365
        mail = imaplib.IMAP4_SSL(config['host'], config['port'], timeout=20)
        mail.login(config['user'], config['password'])
        mail.select("inbox")

        # Search for unseen (unread) emails in INBOX
        status, messages = mail.search(None, "UNSEEN")
        if status != "OK":
            return {"status": "error", "message": "Failed to search inbox folder."}

        msg_ids = messages[0].split()
        User = get_user_model()

        for msg_id in msg_ids:
            res, msg_data = mail.fetch(msg_id, "(RFC822)")
            if res != "OK":
                continue

            for response_part in msg_data:
                if isinstance(response_part, tuple):
                    msg = email.message_from_bytes(response_part[1])
                    
                    # Parse subject & sender headers
                    subject = clean_header(msg.get("Subject", "No Subject"))
                    from_val = clean_header(msg.get("From", ""))
                    sender_email = parse_sender_email(from_val)
                    external_message_id = clean_header(msg.get('Message-ID', '')).strip()[:255] or None

                    if external_message_id and SupportTicket.objects.filter(external_message_id=external_message_id).exists():
                        mail.store(msg_id, "+FLAGS", "\\Seen")
                        continue

                    # Extract body content (prefer plain text)
                    body = ""
                    if msg.is_multipart():
                        for part in msg.walk():
                            content_type = part.get_content_type()
                            content_disposition = str(part.get("Content-Disposition"))
                            if content_type == "text/plain" and "attachment" not in content_disposition:
                                try:
                                    body = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
                                except Exception:
                                    pass
                                break
                        if not body:
                            for part in msg.walk():
                                content_type = part.get_content_type()
                                if content_type == "text/html":
                                    try:
                                        body = part.get_payload(decode=True).decode(part.get_content_charset() or 'utf-8', errors='ignore')
                                    except Exception:
                                        pass
                                    break
                    else:
                        try:
                            body = msg.get_payload(decode=True).decode(msg.get_content_charset() or 'utf-8', errors='ignore')
                        except Exception:
                            pass

                    if not body:
                        body = "No text content found in email."

                    # Find customer account linked to sender email
                    user = User.objects.filter(email__iexact=sender_email).first()

                    # Save new SupportTicket to database
                    SupportTicket.objects.create(
                        email=sender_email,
                        external_message_id=external_message_id,
                        user=user,
                        subject=subject,
                        message=body,
                        status='OPEN',
                        priority='MEDIUM'
                    )
                    tickets_created += 1

                    # Flag email as Seen (read) in Outlook so it isn't pulled again
                    mail.store(msg_id, "+FLAGS", "\\Seen")

        mail.logout()
        return {"status": "success", "tickets_created": tickets_created}

    except Exception as e:
        return {"status": "error", "message": f"IMAP sync failed: {str(e)}"}
