"""
Admin report aggregation endpoints. All gated by `reports.view`.

Conventions:
  - ?region=IN|UK  optional, defaults to "all" (no filter). Numbers are grouped
    by currency_code to avoid mixing GBP+INR totals.
  - ?days=N        default 90, max 365.
  - ?format=csv    streams a CSV download instead of JSON.

Heuristic notes (documented per endpoint):
  - "Repeat customer" = same email with >= 2 PAID orders in the window.
  - "Recovered cart"  = Order exists for the cart's email created after the
    cart's updated_at within 7 days.
  - Funnel "checkouts" = carts that had items + lived > 60s before clearing
    (heuristic). Use this as a rough abandonment proxy, not a precise count.
"""
from __future__ import annotations

import datetime as _dt
from django.db.models import Count, F, Max, Min, Sum
from django.db.models.functions import TruncDate
from django.http import StreamingHttpResponse
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.orders.models import Cart, Order, OrderItem
from apps.users.permissions import require_permission
from apps.common.csv_safety import safe_writer


_PAID_STATUSES = ['PAID']  # payment_status values that count as conversion


# ---------------------------------------------------------------- helpers
def _parse_days(request, default=90, max_days=365) -> int:
    try:
        d = int(request.query_params.get('days') or default)
    except (TypeError, ValueError):
        d = default
    return max(1, min(d, max_days))


def _region_qs(qs, request, field='region__code'):
    region = (request.query_params.get('region') or '').strip().upper()
    if region and region not in ('ALL', ''):
        qs = qs.filter(**{field: region})
    return qs


def _since(days: int):
    return timezone.now() - _dt.timedelta(days=days)


def _wants_csv(request) -> bool:
    fmt = (request.query_params.get('format') or '').lower()
    exp = (request.query_params.get('export') or '').lower()
    return fmt in ('csv', 'true') or exp == 'csv'


class _Echo:
    """File-like object for csv.writer that just returns the value written."""
    def write(self, value):
        return value


def _stream_csv(filename: str, header: list, rows_iter):
    pseudo = _Echo()
    writer = safe_writer(pseudo)

    def gen():
        yield writer.writerow(header)
        for row in rows_iter:
            yield writer.writerow(row)

    resp = StreamingHttpResponse(gen(), content_type='text/csv')
    resp['Content-Disposition'] = f'attachment; filename="{filename}"'
    return resp


def _today_str():
    return timezone.now().date().isoformat()


# ---------------------------------------------------------------- a. sales by country
@api_view(['GET'])
@permission_classes([require_permission('reports.view')])
def sales_by_country(request):
    days = _parse_days(request)
    qs = Order.objects.filter(
        created_at__gte=_since(days),
        payment_status__in=_PAID_STATUSES,
    )
    qs = _region_qs(qs, request)
    rows = (qs
            .values('shipping_country', 'currency_code')
            .annotate(order_count=Count('id'), revenue=Sum('total'))
            .order_by('-revenue'))
    data = [
        {
            'country': r['shipping_country'] or '',
            'currency': r['currency_code'],
            'order_count': r['order_count'],
            'revenue': float(r['revenue'] or 0),
        }
        for r in rows
    ]

    if _wants_csv(request):
        return _stream_csv(
            f'sclero-sales-by-country-{_today_str()}.csv',
            ['country', 'currency', 'order_count', 'revenue'],
            ([d['country'], d['currency'], d['order_count'], d['revenue']] for d in data),
        )
    return Response(data)


# ---------------------------------------------------------------- b. revenue by product
@api_view(['GET'])
@permission_classes([require_permission('reports.view')])
def revenue_by_product(request):
    days = _parse_days(request)
    qs = OrderItem.objects.filter(
        order__created_at__gte=_since(days),
        order__payment_status__in=_PAID_STATUSES,
    )
    region = (request.query_params.get('region') or '').strip().upper()
    if region and region not in ('ALL', ''):
        qs = qs.filter(order__region__code=region)

    rows = (qs
            .values('product_id', 'product__sku', 'product__name', 'order__currency_code')
            .annotate(units_sold=Sum('quantity'),
                      revenue=Sum(F('quantity') * F('price')))
            .order_by('-revenue')[:20])
    data = [
        {
            'product_id': r['product_id'],
            'sku': r['product__sku'],
            'name': r['product__name'],
            'currency': r['order__currency_code'],
            'units_sold': int(r['units_sold'] or 0),
            'revenue': float(r['revenue'] or 0),
        }
        for r in rows
    ]

    if _wants_csv(request):
        return _stream_csv(
            f'sclero-revenue-by-product-{_today_str()}.csv',
            ['product_id', 'sku', 'name', 'currency', 'units_sold', 'revenue'],
            ([d['product_id'], d['sku'], d['name'], d['currency'], d['units_sold'], d['revenue']] for d in data),
        )
    return Response(data)


# ---------------------------------------------------------------- c. CLV
@api_view(['GET'])
@permission_classes([require_permission('reports.view')])
def clv(request):
    days = _parse_days(request, default=365, max_days=365 * 5)
    qs = Order.objects.filter(
        payment_status__in=_PAID_STATUSES,
        created_at__gte=_since(days),
    )
    qs = _region_qs(qs, request)
    rows = (qs
            .values('email', 'currency_code')
            .annotate(
                orders=Count('id'),
                total_spend=Sum('total'),
                first_order=Min('created_at'),
                last_order=Max('created_at'),
            )
            .order_by('-total_spend')[:100])
    data = [
        {
            'email': r['email'],
            'currency': r['currency_code'],
            'orders': r['orders'],
            'total_spend': float(r['total_spend'] or 0),
            'first_order': r['first_order'].isoformat() if r['first_order'] else None,
            'last_order': r['last_order'].isoformat() if r['last_order'] else None,
        }
        for r in rows
    ]

    if _wants_csv(request):
        return _stream_csv(
            f'sclero-clv-{_today_str()}.csv',
            ['email', 'currency', 'orders', 'total_spend', 'first_order', 'last_order'],
            ([d['email'], d['currency'], d['orders'], d['total_spend'], d['first_order'], d['last_order']] for d in data),
        )
    return Response(data)


# ---------------------------------------------------------------- d. repeat cohort
@api_view(['GET'])
@permission_classes([require_permission('reports.view')])
def repeat_cohort(request):
    """
    Definition: a customer (email) is "repeat" if they have >= 2 PAID orders
    within the window. "three_plus" counts emails with >= 3 PAID orders.
    """
    days = _parse_days(request)
    qs = Order.objects.filter(
        created_at__gte=_since(days),
        payment_status__in=_PAID_STATUSES,
    )
    qs = _region_qs(qs, request)
    counts = (qs.values('email').annotate(c=Count('id')))
    one_time = 0
    repeat = 0
    three_plus = 0
    for row in counts:
        c = row['c']
        if c <= 1:
            one_time += 1
        else:
            repeat += 1
            if c >= 3:
                three_plus += 1
    total_customers = one_time + repeat
    repeat_rate = round(repeat / total_customers, 4) if total_customers else 0.0

    if _wants_csv(request):
        return _stream_csv(
            f'sclero-repeat-cohort-{_today_str()}.csv',
            ['metric', 'value'],
            [
                ['repeat_rate', repeat_rate],
                ['one_time_customers', one_time],
                ['repeat_customers', repeat],
                ['three_plus_orders', three_plus],
                ['total_customers', total_customers],
            ]
        )

    return Response({
        'repeat_rate': repeat_rate,
        'one_time': one_time,
        'repeat': repeat,
        'three_plus': three_plus,
        'total_customers': total_customers,
    })


# ---------------------------------------------------------------- e. abandoned conversion
@api_view(['GET'])
@permission_classes([require_permission('reports.view')])
def abandoned_conversion(request):
    """
    "Recovered" = there exists a paid Order with the same user/email created
    after the cart's updated_at within 7 days. Carts without any user/email
    binding fall back to checking by user FK only.
    """
    days = _parse_days(request)
    cutoff = _since(days)
    region = (request.query_params.get('region') or '').strip().upper()

    carts = Cart.objects.filter(updated_at__gte=cutoff).filter(items__isnull=False).distinct()
    if region and region not in ('ALL', ''):
        carts = carts.filter(region__code=region)

    total = carts.count()
    recovered = 0
    for cart in carts.only('id', 'user_id', 'updated_at', 'region_id').iterator():
        if cart.user_id is None:
            continue
        window_end = cart.updated_at + _dt.timedelta(days=7)
        exists = Order.objects.filter(
            user_id=cart.user_id,
            payment_status__in=_PAID_STATUSES,
            created_at__gte=cart.updated_at,
            created_at__lte=window_end,
        ).exists()
        # Also recovered if explicitly marked.
        if exists or cart.recovery_status == 'RECOVERED':
            recovered += 1
    abandoned = total - recovered
    rate = round(recovered / total, 4) if total else 0.0

    if _wants_csv(request):
        return _stream_csv(
            f'sclero-abandoned-conversion-{_today_str()}.csv',
            ['metric', 'value'],
            [
                ['total_carts_with_items', total],
                ['recovered_carts', recovered],
                ['abandoned_carts', abandoned],
                ['recovery_rate', rate],
            ]
        )

    return Response({
        'total_carts_with_items': total,
        'recovered': recovered,
        'abandoned': abandoned,
        'recovery_rate': rate,
    })


# ---------------------------------------------------------------- f. revenue trend
@api_view(['GET'])
@permission_classes([require_permission('reports.view')])
def revenue_trend(request):
    days = _parse_days(request)
    qs = Order.objects.filter(
        created_at__gte=_since(days),
        payment_status__in=_PAID_STATUSES,
    )
    qs = _region_qs(qs, request)
    rows = (qs
            .annotate(d=TruncDate('created_at'))
            .values('d', 'currency_code')
            .annotate(revenue=Sum('total'), orders=Count('id'))
            .order_by('d'))
    data = [
        {
            'date': r['d'].isoformat() if r['d'] else None,
            'currency': r['currency_code'],
            'revenue': float(r['revenue'] or 0),
            'orders': r['orders'],
        }
        for r in rows
    ]
    if _wants_csv(request):
        return _stream_csv(
            f'sclero-revenue-trend-{_today_str()}.csv',
            ['date', 'currency', 'revenue', 'orders'],
            ([d['date'], d['currency'], d['revenue'], d['orders']] for d in data),
        )
    return Response(data)


# ---------------------------------------------------------------- g. conversion funnel
@api_view(['GET'])
@permission_classes([require_permission('reports.view')])
def conversion_funnel(request):
    """
    Funnel computed in last N days.

    Heuristics:
      - pageviews:      PageView count
      - product_views:  PageView where path matches /products/<...>
      - add_to_carts:   distinct carts CREATED in window (proxy: cart creation
                        implies at least one item added)
      - checkouts:      carts in window where updated_at - created_at > 60s
                        AND items existed at any point (proxy for begun
                        checkout; the user lingered past the initial add)
      - orders:         paid Orders in window
    """
    from apps.analytics.models import PageView

    days = _parse_days(request, default=30, max_days=365)
    since = _since(days)

    pageviews = PageView.objects.filter(created_at__gte=since).count()
    product_views = PageView.objects.filter(
        created_at__gte=since,
        path__startswith='/products/',
    ).count()

    carts_qs = Cart.objects.filter(created_at__gte=since)
    region = (request.query_params.get('region') or '').strip().upper()
    if region and region not in ('ALL', ''):
        carts_qs = carts_qs.filter(region__code=region)

    add_to_carts = carts_qs.filter(items__isnull=False).distinct().count()
    checkouts = (carts_qs
                 .filter(items__isnull=False)
                 .annotate(span=F('updated_at') - F('created_at'))
                 .filter(span__gt=_dt.timedelta(seconds=60))
                 .distinct()
                 .count())

    orders_qs = Order.objects.filter(
        created_at__gte=since,
        payment_status__in=_PAID_STATUSES,
    )
    orders_qs = _region_qs(orders_qs, request)
    orders = orders_qs.count()

    return Response({
        'pageviews': pageviews,
        'product_views': product_views,
        'add_to_carts': add_to_carts,
        'checkouts': checkouts,
        'orders': orders,
    })
