import os
from pathlib import Path
from xml.sax.saxutils import escape
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image as RLImage
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from django.utils import timezone

# ---------------------------------------------------------------------------
# Register Unicode-capable fonts so ₹ and £ render correctly in the PDF.
# On Windows use Arial; on Linux/Mac fall back to DejaVu Sans.
# ---------------------------------------------------------------------------
_FONT_REGISTERED = False

def _register_fonts():
    global _FONT_REGISTERED
    if _FONT_REGISTERED:
        return
    import platform
    candidate_families = []

    if platform.system() == 'Windows':
        font_dir = Path('C:/Windows/Fonts')
        candidate_families = [
            {
                'regular': font_dir / 'segoeui.ttf',
                'bold': font_dir / 'segoeuib.ttf',
                'italic': font_dir / 'segoeuii.ttf',
            },
            {
                'regular': font_dir / 'arial.ttf',
                'bold': font_dir / 'arialbd.ttf',
                'italic': font_dir / 'ariali.ttf',
            },
        ]
    else:
        candidate_families = [
            {
                'regular': Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'),
                'bold': Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'),
                'italic': Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'),
            },
            {
                'regular': Path('/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf'),
                'bold': Path('/usr/share/fonts/truetype/noto/NotoSans-Bold.ttf'),
                'italic': Path('/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf'),
            },
        ]

    for family in candidate_families:
        if not all(path.exists() for path in family.values()):
            continue
        try:
            pdfmetrics.registerFont(TTFont('InvoiceFont', str(family['regular'])))
            pdfmetrics.registerFont(TTFont('InvoiceFont-Bold', str(family['bold'])))
            pdfmetrics.registerFont(TTFont('InvoiceFont-Italic', str(family['italic'])))
            _FONT_REGISTERED = True
            return
        except Exception:
            continue

    _FONT_REGISTERED = True


def _company_block(region):
    """Legal entity details for a market's invoices, straight from the Region."""
    if not region:
        company_info = {}
        try:
            from apps.admin_dashboard.models import SystemSetting
            setting = SystemSetting.objects.filter(key='COMPANY_INFO').first()
            if setting and isinstance(setting.value, dict):
                company_info = setting.value
        except Exception:
            company_info = {}
        return {
            'name': company_info.get('name') or 'Online store',
            'address': company_info.get('address') or '',
            'phone': company_info.get('phone') or '',
            'email': company_info.get('support') or company_info.get('email') or '',
            'tax_id': '',
        }

    label = (getattr(region, 'tax_registration_label', '') or '').strip()
    number = (getattr(region, 'tax_registration_number', '') or '').strip()
    reg_code = (getattr(region, 'code', '') or '').upper()
    if not number:
        from django.conf import settings
        number = (
            getattr(settings, 'IN_GSTIN', '') if reg_code == 'IN'
            else getattr(settings, 'UK_VAT_NUMBER', '')
        ) or ''

    tax_id_parts = []
    if number:
        tax_id_parts.append(f"{label}: {number}" if label else number)
    for entry in (getattr(region, 'extra_registrations', []) or []):
        if isinstance(entry, dict) and entry.get('value'):
            entry_label = str(entry.get('label') or '').strip()
            value = str(entry['value']).strip()
            tax_id_parts.append(f"{entry_label}: {value}" if entry_label else value)

    return {
        'name': getattr(region, 'company_name', None) or getattr(region, 'name', None) or 'Online store',
        'address': getattr(region, 'company_address', '') or '',
        'phone': getattr(region, 'company_phone', '') or '',
        'email': getattr(region, 'company_email', '') or '',
        'tax_id': '\n'.join(tax_id_parts),
    }


def generate_invoice_pdf(order):
    """
    Generates a professional GST Tax Invoice or VAT Receipt PDF using ReportLab.
    """
    from django.conf import settings

    # Register Unicode fonts on first call
    _register_fonts()

    # Resolve Order instance from Invoice if needed
    if hasattr(order, 'order'):
        order = order.order
    
    region_code = getattr(order.region, 'code', 'IN') if order.region else (getattr(order, 'region_code', 'IN') or 'IN')
    company = _company_block(order.region)
    company = {key: escape(str(value or '')) for key, value in company.items()}
    company['tax_id'] = company['tax_id'].replace('\n', '<br/>')
    
    # Establish file paths
    invoice_dir = Path(settings.MEDIA_ROOT) / 'invoices'
    os.makedirs(invoice_dir, exist_ok=True)
    
    created_at_dt = getattr(order, 'created_at', None) or timezone.now()
    invoice_filename = f"invoice_{order.id}_{created_at_dt.strftime('%Y%m%d%H%M%S')}.pdf"
    pdf_path = invoice_dir / invoice_filename
    
    # Setup document template
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Sclero Proteins brand palette (matches the storefront and logo artwork).
    BRAND_INK = colors.HexColor('#101871')      # brand navy — headings, table header band
    BRAND_ACCENT = colors.HexColor('#F5A227')   # brand orange — accent rules
    TEXT_MUTED = colors.HexColor('#6B7280')
    BORDER_COLOR = colors.HexColor('#E6EAF2')

    # Font names — use registered Unicode fonts, fall back to Helvetica
    FONT = 'InvoiceFont' if 'InvoiceFont' in pdfmetrics.getRegisteredFontNames() else 'Helvetica'
    FONT_BOLD = 'InvoiceFont-Bold' if 'InvoiceFont-Bold' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Bold'
    FONT_ITALIC = 'InvoiceFont-Italic' if 'InvoiceFont-Italic' in pdfmetrics.getRegisteredFontNames() else 'Helvetica-Oblique'

    # Custom styles
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName=FONT_BOLD,
        fontSize=20,
        leading=24,
        textColor=BRAND_INK
    )
    company_style = ParagraphStyle(
        'CompanyDetails',
        parent=styles['Normal'],
        fontName=FONT,
        fontSize=9,
        leading=13,
        textColor=TEXT_MUTED
    )
    meta_style = ParagraphStyle(
        'MetaDetails',
        parent=styles['Normal'],
        fontName=FONT,
        fontSize=9,
        leading=13,
        textColor=BRAND_INK
    )
    headers_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName=FONT_BOLD,
        fontSize=9,
        leading=11,
        textColor=colors.white
    )
    body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName=FONT,
        fontSize=9,
        leading=12
    )
    
    story = []
    
    # Header block (Logo/Title on left, company details on right)
    tax_name = escape(str(getattr(order.region, 'tax_name', '') or 'Tax'))
    invoice_title = f"{tax_name.upper()} INVOICE"
    
    # Find logo path — v2 asset has the complete tagline descenders.
    logo_path = Path(settings.BASE_DIR) / '..' / 'frontend' / 'public' / 'logo-full-v2.png'
    logo_path = logo_path.resolve()

    logo_img = None
    if logo_path.exists():
        try:
            # Proportions: width = 1.5 inch, height = 1.5 * (1251/1359) = 1.38 inch
            logo_img = RLImage(str(logo_path), width=1.5*inch, height=1.38*inch)
        except Exception:
            logo_img = None
 
    if logo_img:
        header_data = [
            [
                logo_img,
                Paragraph(f"<b>{company['name']}</b><br/>{invoice_title}", title_style),
                Paragraph('<br/>'.join(filter(None, [
                    company['address'],
                    f"Phone: {company['phone']}" if company['phone'] else '',
                    f"Email: {company['email']}" if company['email'] else '',
                    f"<b>{company['tax_id']}</b>" if company['tax_id'] else '',
                ])), company_style)
            ]
        ]
        header_table = Table(header_data, colWidths=[1.6*inch, 2.4*inch, 3.5*inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (2,0), (2,0), 'RIGHT'),
        ]))
    else:
        header_data = [
            [
                Paragraph(f"<b>{company['name']}</b><br/>{invoice_title}", title_style),
                Paragraph('<br/>'.join(filter(None, [
                    company['address'],
                    f"Phone: {company['phone']}" if company['phone'] else '',
                    f"Email: {company['email']}" if company['email'] else '',
                    f"<b>{company['tax_id']}</b>" if company['tax_id'] else '',
                ])), company_style)
            ]
        ]
        header_table = Table(header_data, colWidths=[3.5*inch, 4.0*inch])
        header_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ]))
        
    story.append(header_table)
    story.append(Spacer(1, 15))
    
    # Metadata Block (Order ID, Invoice Number, Billing info)
    invoice_num = f"SP-{order.created_at.strftime('%Y')}-{order.id:05d}"
    
    meta_data = [
        [
            Paragraph(
                f"<b>BILL TO:</b><br/>"
                f"{escape(str(order.shipping_name or ''))}<br/>"
                f"{escape(str(order.shipping_address_line1 or ''))}<br/>"
                f"{escape(str(order.shipping_address_line2 or '')) + '<br/>' if order.shipping_address_line2 else ''}"
                f"{escape(str(order.shipping_city or ''))}, {escape(str(order.shipping_state or ''))} - {escape(str(order.shipping_postal_code or ''))}<br/>"
                f"Phone: {escape(str(order.shipping_phone or ''))}<br/>"
                f"Email: {escape(str(order.email or ''))}",
                meta_style
            ),
            Paragraph(
                f"<b>Invoice Number:</b> {invoice_num}<br/>"
                f"<b>Order Date:</b> {order.created_at.strftime('%d-%b-%Y')}<br/>"
                f"<b>Payment Method:</b> {escape(str(order.payment_method or ''))}<br/>"
                f"<b>Transaction ID:</b> {escape(str(order.payment_id or 'Not applicable'))}<br/>"
                f"<b>Status:</b> {escape(str(order.payment_status or ''))}",
                meta_style
            )
        ]
    ]
    meta_table = Table(meta_data, colWidths=[3.75*inch, 3.75*inch])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 8),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 20))
    
    # Items Table
    # Table headers
    if region_code == 'IN':
        table_headers = [
            Paragraph("<b>Product SKU / Description</b>", headers_style),
            Paragraph("<b>HSN</b>", headers_style),
            Paragraph("<b>Qty</b>", headers_style),
            Paragraph("<b>Price</b>", headers_style),
            Paragraph("<b>GST Rate</b>", headers_style),
            Paragraph("<b>Amount</b>", headers_style),
        ]
    else:
        table_headers = [
            Paragraph("<b>Product SKU / Description</b>", headers_style),
            Paragraph("<b>Qty</b>", headers_style),
            Paragraph("<b>Price</b>", headers_style),
            Paragraph("<b>VAT Rate</b>", headers_style),
            Paragraph("<b>Amount</b>", headers_style),
        ]
        
    table_data = [table_headers]
    
    # Use region_code (reliable) instead of currency_code for symbol selection.
    # ₹ (\u20B9) requires a Unicode-capable font (registered above).
    symbol = getattr(order.region, 'currency_symbol', '') if order.region else order.currency_code
    
    for item in order.items.all():
        variant_line = (
            f"<br/>Option: {escape(str(item.variant_name))} "
            f"({escape(str(item.variant_sku))})"
            if getattr(item, 'variant_sku', '') else ''
        )
        prod_desc = (
            f"<b>{escape(str(item.product.name))}</b><br/>"
            f"SKU: {escape(str(item.product.sku))}{variant_line}"
        )
        
        if region_code == 'IN':
            hsn = escape(str(item.product.hsn_code or '—'))
            row = [
                Paragraph(prod_desc, body_style),
                Paragraph(hsn, body_style),
                Paragraph(str(item.quantity), body_style),
                Paragraph(f"{symbol}{item.price:.2f}", body_style),
                Paragraph(f"{order.tax_rate:.1f}%", body_style),
                Paragraph(f"{symbol}{(item.quantity * item.price):.2f}", body_style)
            ]
        else:
            row = [
                Paragraph(prod_desc, body_style),
                Paragraph(str(item.quantity), body_style),
                Paragraph(f"{symbol}{item.price:.2f}", body_style),
                Paragraph(f"{order.tax_rate:.1f}%", body_style),
                Paragraph(f"{symbol}{(item.quantity * item.price):.2f}", body_style)
            ]
        table_data.append(row)
        
    # Col widths setup
    if region_code == 'IN':
        col_widths = [3.2*inch, 0.9*inch, 0.5*inch, 0.9*inch, 0.9*inch, 1.1*inch]
    else:
        col_widths = [4.1*inch, 0.5*inch, 0.9*inch, 0.9*inch, 1.1*inch]
        
    item_table = Table(table_data, colWidths=col_widths)
    item_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), BRAND_INK),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(item_table)
    story.append(Spacer(1, 15))
    
    # Totals block (right aligned)
    tax_title = "GST" if region_code == 'IN' else "VAT"
    
    # Split CGST/SGST display for India GST
    tax_detail_str = f"Tax ({tax_title} {order.tax_rate:.1f}%)"
    if region_code == 'IN':
        half_rate = order.tax_rate / 2
        half_amount = order.tax_amount / 2
        tax_detail_str = f"CGST ({half_rate:.1f}%): {symbol}{half_amount:.2f}<br/>SGST ({half_rate:.1f}%): {symbol}{half_amount:.2f}"
    else:
        tax_detail_str = f"VAT ({order.tax_rate:.1f}%): {symbol}{order.tax_amount:.2f}"
 
    totals_data = [
        [Paragraph("Subtotal", meta_style), Paragraph(f"{symbol}{order.subtotal:.2f}", meta_style)],
        [Paragraph("<b>Tax Breakdown</b>", meta_style), Paragraph(tax_detail_str, meta_style)],
        [Paragraph(
            f"Shipping ({escape(str(order.shipping_method))})" if order.shipping_method else "Shipping Cost",
            meta_style,
        ), Paragraph(f"{symbol}{order.shipping_cost:.2f}", meta_style)],
        [Paragraph("<b>Total Amount Paid</b>", meta_style), Paragraph(f"<b>{symbol}{order.total:.2f}</b>", meta_style)]
    ]
    
    totals_table = Table(totals_data, colWidths=[2.5*inch, 1.5*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('LINEBELOW', (0,-1), (1,-1), 1.5, BRAND_ACCENT),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    
    # Wrap in layout table to push it to the right side
    layout_data = [["", totals_table]]
    layout_table = Table(layout_data, colWidths=[3.5*inch, 4.0*inch])
    layout_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
    ]))
    story.append(layout_table)
    story.append(Spacer(1, 40))
    # Footer notes
    footer_style = ParagraphStyle(
        'FooterNote',
        parent=styles['Normal'],
        fontName=FONT_ITALIC,
        fontSize=8,
        leading=10,
        alignment=1, # Center
        textColor=colors.HexColor('#94A3B8')
    )
    support_line = f" For support, contact {company['email']}." if company['email'] else ''
    story.append(Paragraph(
        f"This is a computer-generated invoice and requires no physical signature.{support_line}",
        footer_style,
    ))
    
    # Build document
    doc.build(story)
    
    # Return path relative to media root
    return f"invoices/{invoice_filename}", invoice_num
