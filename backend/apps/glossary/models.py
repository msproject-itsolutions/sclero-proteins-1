from django.db import models

class GlossaryTerm(models.Model):
    term = models.CharField(
        max_length=150, 
        unique=True, 
        db_index=True,
        help_text="The technical term, abbreviation, or industry phrase."
    )
    internal_code = models.CharField(
        max_length=150,
        blank=True,
        default='',
        db_index=True,
        help_text="Optional internal knowledge-hub identifier for the term."
    )
    definition = models.TextField(help_text="Detailed, easy-to-understand definition of the term.")
    category = models.CharField(
        max_length=100, 
        blank=True, 
        default='', 
        help_text="Category of the term, e.g. Immunology, Biosecurity, Active Nutrition."
    )
    image_url = models.URLField(
        max_length=1000, 
        blank=True, 
        default='', 
        help_text="Optional illustrative image url."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['term']
        verbose_name = "Glossary Term"
        verbose_name_plural = "Glossary Terms"

    def __str__(self):
        return self.term


class GeneralFAQ(models.Model):
    question = models.CharField(max_length=255, unique=True, db_index=True)
    answer = models.TextField()
    category = models.CharField(max_length=100, blank=True, default='General', help_text="e.g. Shipping, Payments, Returns, Product Care")
    is_active = models.BooleanField(default=True, db_index=True)
    display_order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['category', 'display_order', 'question']
        verbose_name = "General FAQ"
        verbose_name_plural = "General FAQs"

    def __str__(self):
        return self.question
