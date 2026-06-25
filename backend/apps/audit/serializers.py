from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'actor', 'actor_email', 'actor_name', 'action',
            'target_type', 'target_id', 'summary', 'changes',
            'ip_address', 'user_agent', 'created_at',
        ]
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor:
            return 'System'
        full = f'{obj.actor.first_name} {obj.actor.last_name}'.strip()
        return full or obj.actor_email or 'Unknown'
