"""Invoice records and PDFs for orders."""
import logging

from django.conf import settings

from .models import Invoice
from .utils import generate_invoice_pdf

logger = logging.getLogger(__name__)


def invoice_details(order):
    in_india = order.region.code == 'IN'
    return {
        'tax_reg_number': f'GSTIN: {settings.IN_GSTIN}' if in_india else f'VAT: {settings.UK_VAT_NUMBER}',
        'invoice_type': 'GST Tax Invoice' if in_india else 'VAT Receipt',
        'hsn_summary': [
            {
                'hsn_code': item.product.hsn_code or '',
                'quantity': item.quantity,
                'tax_amount': str(item.tax_amount),
            }
            for item in order.items.select_related('product')
        ] if in_india else [],
    }


def ensure_invoice(order, *, refresh_pdf=False):
    """Create the order's invoice once; a PDF failure is logged, never raised."""
    invoice, _created = Invoice.objects.get_or_create(
        order=order,
        defaults={
            'invoice_number': f'SP-{order.created_at.year}-{order.pk:05d}',
            'invoice_type': 'GST_INVOICE' if order.region.code == 'IN' else 'VAT_RECEIPT',
            'details': invoice_details(order),
        },
    )
    if invoice.pdf_file and not refresh_pdf:
        return invoice
    try:
        path, number = generate_invoice_pdf(order)
    except Exception:
        logger.exception('Invoice PDF generation failed for order %s.', order.pk)
        return invoice
    invoice.pdf_file = path
    invoice.invoice_number = number
    invoice.save(update_fields=['pdf_file', 'invoice_number'])
    return invoice
