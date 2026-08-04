"""Install the minimal editable shipping rules required by a new deployment."""

from django.core.management.base import BaseCommand

from apps.regions.models import Region, ShippingRate, ShippingZone


class Command(BaseCommand):
    help = 'Create missing baseline UK and India shipping rules without changing existing configuration.'

    def handle(self, *args, **options):
        defaults = (
            ('UK', 'United Kingdom', ['GB'], 'Standard UK delivery', 'Standard delivery', '5.00', '50.00', '3–5 business days'),
            ('IN', 'India', ['IN'], 'Standard India delivery', 'Standard delivery', '150.00', '3000.00', '3–7 business days'),
        )
        created = 0
        for code, zone_name, countries, rate_name, method, price, free_above, eta in defaults:
            region = Region.objects.filter(code=code, is_active=True).first()
            if not region:
                self.stdout.write(self.style.WARNING(f'Skipping {code}: its market is not configured.'))
                continue
            # A state/postcode-restricted zone may share the country name. It
            # is not a safe nationwide fallback, so never reuse it here.
            zone = ShippingZone.objects.filter(
                region=region, countries=countries, states=[], cities=[], postal_ranges=[], is_active=True,
            ).first()
            zone_created = False
            if not zone:
                base_name = zone_name
                if ShippingZone.objects.filter(region=region, name=base_name).exists():
                    base_name = f'{zone_name} Nationwide'
                zone = ShippingZone.objects.create(
                    region=region,
                    name=base_name,
                    countries=countries,
                    description='Baseline nationwide rate. Manage in Admin → Shipping & Delivery.',
                    is_active=True,
                )
                zone_created = True
            _rate, rate_created = ShippingRate.objects.get_or_create(
                zone=zone,
                name=rate_name,
                defaults={
                    'method': method,
                    'rate_type': 'FLAT',
                    'price': price,
                    'free_above': free_above,
                    'estimated_days': eta,
                    'is_active': True,
                },
            )
            created += int(zone_created) + int(rate_created)
        self.stdout.write(self.style.SUCCESS(f'Baseline shipping rules verified ({created} records created).'))
