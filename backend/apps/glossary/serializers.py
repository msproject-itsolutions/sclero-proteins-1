from rest_framework import serializers
from .models import GlossaryTerm, GeneralFAQ

class GlossaryTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = GlossaryTerm
        fields = ['id', 'term', 'internal_code', 'definition', 'category', 'image_url', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_term(self, value):
        # Strip whitespaces and validate
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Term cannot be empty or just whitespace.")
        return value


class GeneralFAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = GeneralFAQ
        fields = ['id', 'question', 'answer', 'category', 'is_active', 'display_order', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_question(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Question cannot be empty.")
        return value
