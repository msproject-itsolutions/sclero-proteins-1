"""Order-level fraud scoring.

`assess_order(order)` runs every active FraudRule against the freshly placed
order, records signals, computes an aggregate score+level, and upserts an
OrderRiskAssessment row. If the order needs review it is moved back to PENDING
so it does not auto-progress through fulfilment.

Wrapped in a broad try/except — fraud scoring must never block checkout.
"""

import logging
from datetime import timedelta
from decimal import Decimal

from django.utils import timezone

from apps.audit.recorder import record_audit

logger = logging.getLogger(__name__)


_SEVERITY_WEIGHT = {'LOW': 1, 'MEDIUM': 3, 'HIGH': 8}


def _level_for(score):
    if score >= 8:
        return 'CRITICAL'
    if score >= 4:
        return 'HIGH'
    if score >= 1:
        return 'MEDIUM'
    return 'LOW'


def assess_order(order):
    try:
        # Local imports — avoid loading the fraud app at import time of the
        # orders module (lets checkout work even before the fraud migration
        # has been applied during a deploy window).
        from apps.fraud.models import FraudRule, OrderRiskAssessment
        from apps.orders.models import Order

        rules = list(FraudRule.objects.filter(is_active=True))
        signals = []
        has_hold = False

        for rule in rules:
            detail = None
            kind = rule.kind
            window = rule.window_minutes or 60

            if kind == 'ORDER_VELOCITY_PER_EMAIL':
                since = timezone.now() - timedelta(minutes=window)
                count = Order.objects.filter(
                    email__iexact=order.email, created_at__gte=since,
                ).exclude(pk=order.pk).count()
                if count > rule.threshold:
                    detail = f"{count} orders from {order.email} in {window}min (threshold {rule.threshold})"

            elif kind == 'ORDER_VELOCITY_PER_IP':
                # Order does not currently persist the originating IP — skip
                # until checkout records `request.META['REMOTE_ADDR']` on the
                # Order row. The rule definition is preserved so a future
                # migration can switch this branch on.
                continue

            elif kind == 'HIGH_VALUE_ORDER':
                if Decimal(str(order.total or 0)) > Decimal(str(rule.threshold)):
                    detail = (f"Order total {order.currency_code} {order.total} "
                              f"exceeds threshold {rule.threshold}")

            elif kind == 'NEW_EMAIL_HIGH_VALUE':
                prior = Order.objects.filter(email__iexact=order.email).exclude(pk=order.pk).count()
                if prior == 0 and Decimal(str(order.total or 0)) > Decimal(str(rule.threshold)):
                    detail = (f"First order from {order.email} at {order.currency_code} "
                              f"{order.total} (threshold {rule.threshold})")

            if detail:
                signals.append({
                    'rule': rule.name,
                    'kind': rule.kind,
                    'severity': rule.severity,
                    'detail': detail,
                    'threshold': rule.threshold,
                    'action': rule.action,
                })
                if rule.action == 'HOLD':
                    has_hold = True

        score = sum(_SEVERITY_WEIGHT.get(s['severity'], 0) for s in signals)
        level = _level_for(score)
        needs_review = has_hold or level in ('HIGH', 'CRITICAL')

        assessment, _ = OrderRiskAssessment.objects.update_or_create(
            order=order,
            defaults={
                'score': score,
                'level': level,
                'signals': signals,
                'needs_review': needs_review,
            },
        )

        if needs_review:
            if order.status != 'PENDING':
                order.status = 'PENDING'
                order.save(update_fields=['status'])
            record_audit(
                'order.risk_flagged',
                target_type='Order', target_id=order.id,
                summary=f"{level} risk order #{order.id}",
                changes={'score': score, 'level': level, 'signal_count': len(signals)},
            )

        return assessment

    except Exception as exc:  # pragma: no cover — defensive
        logger.warning("Fraud assessment failed for order %s: %s", getattr(order, 'id', '?'), exc)
        return None
