from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from io import StringIO
from rest_framework.test import APITestCase
from rest_framework import status
from .models import GeneralFAQ, GlossaryTerm

User = get_user_model()

class GlossaryModelTest(TestCase):
    def test_create_glossary_term(self):
        """Verify that glossary terms can be created and default sorting is alphabetical."""
        term2 = GlossaryTerm.objects.create(
            term="Collagen",
            definition="A structural protein found in skin and connective tissues.",
            category="Biosecurity"
        )
        term1 = GlossaryTerm.objects.create(
            term="BJC",
            definition="Bone & Joint Care clinically-formulated supplement.",
            category="Nutraceuticals"
        )

        # Check fields
        self.assertEqual(term1.term, "BJC")
        self.assertEqual(term2.category, "Biosecurity")
        self.assertEqual(term1.internal_code, '')
        self.assertEqual(term1.image_url, '')

        # Check default ordering (alphabetical by term)
        terms = list(GlossaryTerm.objects.all())
        self.assertEqual(terms[0], term1)  # BJC
        self.assertEqual(terms[1], term2)  # Collagen


class GlossaryAPITest(APITestCase):
    def setUp(self):
        # Create glossary terms
        self.term = GlossaryTerm.objects.create(
            term="Scleroproteins",
            definition="Fibrous proteins such as keratin, collagen, and elastin.",
            category="Biochemistry",
            image_url="http://localhost:8001/media/uploads/sclero.png"
        )

        # Create staff user with settings.manage permission
        self.staff_user = User.objects.create_user(
            email="staff@scleroproteins.co.uk",
            password="securepassword123",
            is_staff=True
        )
        from apps.users.models import Role
        role, _ = Role.objects.get_or_create(name="Admin", defaults={"permissions": ["settings.manage"]})
        self.staff_user.roles.add(role)

        # Create customer user without settings.manage permission
        self.customer = User.objects.create_user(
            email="customer@gmail.com",
            password="customerpassword123"
        )

    def test_public_read_only_access(self):
        """Verify anyone (authenticated or not) can list glossary terms."""
        response = self.client.get('/api/glossary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should be a list
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['term'], "Scleroproteins")

        # Try to POST to public endpoint - should fail (ReadOnlyModelViewSet does not support POST)
        response = self.client.post('/api/glossary/', {
            "term": "Keratin",
            "definition": "A fibrous structural protein."
        })
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_admin_crud_access_denied_for_public(self):
        """Verify unauthenticated requests cannot access admin CRUD."""
        response = self.client.post('/api/admin/glossary/', {
            "term": "Keratin",
            "definition": "A fibrous structural protein."
        })
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_crud_access_denied_for_customer(self):
        """Verify non-staff customer requests cannot access admin CRUD."""
        self.client.force_authenticate(user=self.customer)
        response = self.client.post('/api/admin/glossary/', {
            "term": "Keratin",
            "definition": "A fibrous structural protein."
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_crud_success_for_authorized_staff(self):
        """Verify staff with settings.manage can CRUD glossary terms."""
        self.client.force_authenticate(user=self.staff_user)

        # 1. Create (POST)
        response = self.client.post('/api/admin/glossary/', {
            "term": "Keratin",
            "definition": "A fibrous structural protein of hair and nails.",
            "category": "Proteins",
            "image_url": "http://localhost:8001/media/uploads/keratin.png"
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GlossaryTerm.objects.count(), 2)
        self.assertIn('internal_code', response.data)
        
        # 2. Update (PUT)
        term_id = response.data['id']
        response = self.client.put(f'/api/admin/glossary/{term_id}/', {
            "term": "Keratin Protein",
            "definition": "Updated definition of keratin.",
            "category": "Proteins",
            "image_url": ""
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(GlossaryTerm.objects.get(id=term_id).term, "Keratin Protein")

        # 3. Delete (DELETE)
        response = self.client.delete(f'/api/admin/glossary/{term_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(GlossaryTerm.objects.count(), 1)


class ExpandedGlossarySeedTest(TestCase):
    def test_seed_imports_complete_supplied_glossary(self):
        output = StringIO()
        call_command('seed_glossary', verbosity=0, stdout=output)

        self.assertEqual(GlossaryTerm.objects.count(), 179)
        self.assertEqual(
            GlossaryTerm.objects.get(term='Amino Acid Substrate Support').internal_code,
            'amino_acid_substrate_support',
        )
        self.assertEqual(
            GlossaryTerm.objects.get(term='Biogenic Mineral Profile').category,
            'ESC Science',
        )
        self.assertEqual(
            GlossaryTerm.objects.get(term='Wetting Agents').category,
            'Soil & Turf Science',
        )

        # A second run updates existing rows instead of creating duplicates.
        call_command('seed_glossary', verbosity=0, stdout=output)
        self.assertEqual(GlossaryTerm.objects.count(), 179)


class GeneralFAQModelTest(TestCase):
    def test_create_general_faq(self):
        """Verify that general FAQs can be created and default sorting is category + order."""
        faq2 = GeneralFAQ.objects.create(
            question="How long is shipping?",
            answer="Shipping takes 2-3 business days.",
            category="Shipping",
            display_order=1
        )
        faq1 = GeneralFAQ.objects.create(
            question="Do you ship to the US?",
            answer="Yes, we ship globally.",
            category="Shipping",
            display_order=0
        )
        faq3 = GeneralFAQ.objects.create(
            question="What is your return policy?",
            answer="30-day money back guarantee.",
            category="Returns",
            display_order=0
        )

        # Check ordering (category then display_order)
        faqs = list(GeneralFAQ.objects.all())
        self.assertEqual(faqs[0], faq3)  # Returns, display_order 0
        self.assertEqual(faqs[1], faq1)  # Shipping, display_order 0
        self.assertEqual(faqs[2], faq2)  # Shipping, display_order 1


class GeneralFAQAPITest(APITestCase):
    def setUp(self):
        self.faq = GeneralFAQ.objects.create(
            question="How do I pay?",
            answer="We accept Stripe, PayPal, Razorpay.",
            category="Payments",
            is_active=True
        )
        self.inactive_faq = GeneralFAQ.objects.create(
            question="Secret question?",
            answer="Secret answer.",
            category="Hidden",
            is_active=False
        )

        self.staff_user = User.objects.create_user(
            email="staff2@scleroproteins.co.uk",
            password="securepassword123",
            is_staff=True
        )
        from apps.users.models import Role
        role, _ = Role.objects.get_or_create(name="Admin", defaults={"permissions": ["settings.manage"]})
        self.staff_user.roles.add(role)

        self.customer = User.objects.create_user(
            email="customer2@gmail.com",
            password="customerpassword123"
        )

    def test_public_read_only_access(self):
        """Verify anyone can list active FAQs."""
        response = self.client.get('/api/faqs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Should only return active FAQ
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['question'], "How do I pay?")

    def test_admin_crud_access_denied_for_customer(self):
        self.client.force_authenticate(user=self.customer)
        response = self.client.post('/api/admin/faqs/', {
            "question": "Can I edit this?",
            "answer": "No."
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_crud_success_for_authorized_staff(self):
        self.client.force_authenticate(user=self.staff_user)

        # Create
        response = self.client.post('/api/admin/faqs/', {
            "question": "Can I edit this?",
            "answer": "Yes.",
            "category": "General",
            "is_active": True,
            "display_order": 5
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GeneralFAQ.objects.count(), 3)

        # Update
        faq_id = response.data['id']
        response = self.client.put(f'/api/admin/faqs/{faq_id}/', {
            "question": "Can I edit this? (Updated)",
            "answer": "Yes, completely.",
            "category": "General",
            "is_active": True,
            "display_order": 5
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(GeneralFAQ.objects.get(id=faq_id).question, "Can I edit this? (Updated)")

        # Delete
        response = self.client.delete(f'/api/admin/faqs/{faq_id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(GeneralFAQ.objects.count(), 2)
