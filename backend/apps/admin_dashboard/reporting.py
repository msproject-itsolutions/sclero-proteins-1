import io
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors

def generate_pdf_report(sales_data, marketing_data, customer_data):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=15
    )
    section_style = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=colors.HexColor('#6366F1'),
        spaceBefore=15,
        spaceAfter=10
    )
    body_style = ParagraphStyle(
        'DocBody',
        parent=styles['Normal'],
        fontSize=10,
        leading=14,
        textColor=colors.HexColor('#475569'),
        spaceAfter=8
    )

    # Title
    story.append(Paragraph("Sclero Proteins Ltd — Performance Report", title_style))
    story.append(Paragraph("Unified Commerce, Marketing & Analytics Summary", body_style))
    story.append(Spacer(1, 10))

    # Sales Section
    story.append(Paragraph("Sales & Financial Performance", section_style))
    sales_table_data = [
        ["Metric", "Value"],
        ["Total Orders", str(sales_data.get('total_orders', 0))],
        ["Gross Revenue", f"{sales_data.get('currency', 'GBP')} {sales_data.get('total_revenue', 0.0):,.2f}"],
        ["Average Order Value", f"{sales_data.get('currency', 'GBP')} {sales_data.get('aov', 0.0):,.2f}"],
        ["Estimated Margin (Gross)", f"{sales_data.get('gross_margin', 70.0)}%"]
    ]
    t = Table(sales_table_data, colWidths=[240, 240])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t)
    story.append(Spacer(1, 10))

    # Marketing Section
    story.append(Paragraph("Marketing Channel Performance", section_style))
    marketing_table_data = [["Channel", "Spend", "Impressions", "Clicks", "Conversions"]]
    for item in marketing_data:
        marketing_table_data.append([
            item.get('name'),
            f"GBP {item.get('spend', 0.0):,.2f}",
            f"{item.get('impressions', 0):,}",
            f"{item.get('clicks', 0):,}",
            str(item.get('conversions', 0)),
        ])
    t_m = Table(marketing_table_data, colWidths=[150, 90, 90, 80, 90])
    t_m.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_m)
    story.append(Spacer(1, 10))

    # Customer Behavior
    story.append(Paragraph("Customer Behavior & Activity", section_style))
    customer_table_data = [
        ["Metric", "Value"],
        ["Total Customer Accounts", str(customer_data.get('total_customers', 0))],
        ["New Signups (Last 30 Days)", str(customer_data.get('new_customers_30d', 0))],
        ["Repeat Purchase Rate", f"{customer_data.get('repeat_purchase_rate', 0.0):.1f}%"],
        ["Total Logged Activities", str(customer_data.get('activity_count', 0))]
    ]
    t_c = Table(customer_table_data, colWidths=[240, 240])
    t_c.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#F8FAFC')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#0F172A')),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('PADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_c)
    
    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
