import os
from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

# Company Address Definitions
COMPANY_DETAILS = {
    'IN': {
        'name': 'Sclero Proteins (India)',
        'address': 'Rajeshwar Farm & Hatchery, Samarkha Ajarpura Road,\nAjarpura, Anand, 388310, Gujarat, India',
        'phone': '+91 84888 03622',
        'email': 'india@scleroproteins.co.uk',
        'tax_id': 'GSTIN: 24AFXFS9162D1ZG',
    },
    'UK': {
        'name': 'Sclero Proteins Ltd',
        'address': 'Unit B2A Horsted Keynes Business Park, Horsted Keynes,\nHaywards Heath, RH17 7BA, United Kingdom',
        'phone': '01293 901941',
        'email': 'support@scleroproteins.co.uk',
        'tax_id': 'VAT Reg No: GB987654321', # Sandbox dummy VAT
    }
}

def generate_invoice_pdf(order):
    """
    Generates a professional GST Tax Invoice or VAT Receipt PDF using ReportLab.
    """
    from django.conf import settings
    
    region_code = order.region.code
    company = COMPANY_DETAILS.get(region_code, COMPANY_DETAILS['UK'])
    
    # Establish file paths
    invoice_dir = Path(settings.MEDIA_ROOT) / 'invoices'
    os.makedirs(invoice_dir, exist_ok=True)
    
    invoice_filename = f"invoice_{order.id}_{order.created_at.strftime('%Y%m%d%H%M%S')}.pdf"
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
    
    # Custom styles
    title_style = ParagraphStyle(
        'InvoiceTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0A0F1D')
    )
    company_style = ParagraphStyle(
        'CompanyDetails',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#64748B')
    )
    meta_style = ParagraphStyle(
        'MetaDetails',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#1E293B')
    )
    headers_style = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        textColor=colors.white
    )
    body_style = ParagraphStyle(
        'TableBody',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=11
    )
    
    story = []
    
    # Header block (Logo/Title on left, company details on right)
    invoice_title = "TAX INVOICE" if region_code == 'IN' else "VAT RECEIPT"
    
    header_data = [
        [
            Paragraph(f"<b>{company['name']}</b><br/>{invoice_title}", title_style),
            Paragraph(
                f"{company['address']}<br/>"
                f"Phone: {company['phone']}<br/>"
                f"Email: {company['email']}<br/>"
                f"<b>{company['tax_id']}</b>",
                company_style
            )
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
                f"{order.shipping_name}<br/>"
                f"{order.shipping_address_line1}<br/>"
                f"{order.shipping_address_line2 + '<br/>' if order.shipping_address_line2 else ''}"
                f"{order.shipping_city}, {order.shipping_state} - {order.shipping_postal_code}<br/>"
                f"Phone: {order.shipping_phone}<br/>"
                f"Email: {order.email}",
                meta_style
            ),
            Paragraph(
                f"<b>Invoice Number:</b> {invoice_num}<br/>"
                f"<b>Order Date:</b> {order.created_at.strftime('%d-%b-%Y')}<br/>"
                f"<b>Payment Method:</b> {order.payment_method}<br/>"
                f"<b>Transaction ID:</b> {order.payment_id or 'Sandbox Mock'}<br/>"
                f"<b>Status:</b> PAID",
                meta_style
            )
        ]
    ]
    meta_table = Table(meta_data, colWidths=[3.75*inch, 3.75*inch])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
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
    
    currency = order.currency_code
    symbol = "₹" if currency == 'INR' else "£"
    
    for item in order.items.all():
        prod_desc = f"<b>{item.product.name}</b><br/>SKU: {item.product.sku}"
        
        if region_code == 'IN':
            hsn = item.product.hsn_code or "3004"
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
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0A0F1D')),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOX', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
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
        [Paragraph(f"<b>Tax Breakdown</b>", meta_style), Paragraph(tax_detail_str, meta_style)],
        [Paragraph("Shipping Cost", meta_style), Paragraph(f"{symbol}{order.shipping_cost:.2f}", meta_style)],
        [Paragraph("<b>Total Amount Paid</b>", meta_style), Paragraph(f"<b>{symbol}{order.total:.2f}</b>", meta_style)]
    ]
    
    totals_table = Table(totals_data, colWidths=[2.5*inch, 1.5*inch])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('ALIGN', (1,0), (1,-1), 'RIGHT'),
        ('LINEBELOW', (0,-1), (1,-1), 1.5, colors.HexColor('#0A0F1D')),
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
        fontName='Helvetica-Oblique',
        fontSize=8,
        leading=10,
        alignment=1, # Center
        textColor=colors.HexColor('#94A3B8')
    )
    story.append(Paragraph("This is a computer generated invoice and requires no physical signature.<br/>For any support, please contact us at support@scleroproteins.co.uk. Thank you for shopping with Sclero Proteins!", footer_style))
    
    # Build document
    doc.build(story)
    
    # Return path relative to media root
    return f"invoices/{invoice_filename}", invoice_num
