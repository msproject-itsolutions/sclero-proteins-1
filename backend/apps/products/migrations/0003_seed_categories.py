from django.db import migrations


CATEGORIES = [
    ("Protein", "protein", "High-quality protein powders for recovery and lean mass.", 1),
    ("Bone & Joint Care", "bone-joint-care", "Collagen and mineral support for mobility and skeletal health.", 2),
    ("Creatine", "creatine", "Pure creatine for strength and high-intensity performance.", 3),
    ("Recovery", "recovery", "Amino acids and actives that speed recovery and reduce soreness.", 4),
    ("Collagen", "collagen", "Structural protein support for joints, skin, and connective tissue.", 5),
]

# Maps existing product SKUs to category slugs.
PRODUCT_CATEGORIES = {
    "WHEY-RAW-80": ["protein", "recovery"],
    "CREATINE-200MESH": ["creatine"],
    "GLUTAMINE-PURE": ["recovery", "protein"],
    "BJC-BONE-JOINT": ["bone-joint-care", "collagen"],
}


def seed_categories(apps, schema_editor):
    Category = apps.get_model("products", "Category")
    Product = apps.get_model("products", "Product")

    slug_to_cat = {}
    for name, slug, desc, order in CATEGORIES:
        cat, _ = Category.objects.get_or_create(
            slug=slug,
            defaults={"name": name, "description": desc, "display_order": order},
        )
        slug_to_cat[slug] = cat

    for sku, slugs in PRODUCT_CATEGORIES.items():
        try:
            product = Product.objects.get(sku=sku)
        except Product.DoesNotExist:
            continue
        product.categories.add(*[slug_to_cat[s] for s in slugs if s in slug_to_cat])


def unseed_categories(apps, schema_editor):
    Category = apps.get_model("products", "Category")
    Category.objects.filter(slug__in=[c[1] for c in CATEGORIES]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0002_category_product_categories"),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
