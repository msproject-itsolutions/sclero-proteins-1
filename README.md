# Sclero Proteins — Active Nutrition Storefront & Admin Suite

Sclero Proteins is a production-grade, highly optimized e-commerce platform and administrative ecosystem tailored for premium active nutrition and joint-care therapeutics. 

The platform features a **Single-Identity, Multi-Region** architecture built to seamlessly serve customers in both the **United Kingdom** (GBP / VAT) and **India** (INR / GST), along with a unified **Global Admin Dashboard** that provides full Shopify-like command over products, regional logistics, custom zones, staff RBAC, and analytics.

---

## 🚀 Key Features

### 🛒 Premium Storefront (Next.js App Router)
- **High-End UI/UX**: Minimalist, luxury aesthetics utilizing the Outfit/Inter typography scale, custom glassmorphism panels, and sleek animations.
- **Interactive Wellness Quiz**: A 4-question interactive diagnostic flow recommending specific formulations (such as OvoMatrix ESC or BJC® Bone & Joint Care) based on customer joint mobility, activity level, and dietary profile.
- **Dynamic Catalog**: Filter by health goal (Gut Health, Joint Care, Fitness) and dietary preferences (Vegan, Lab Tested, Gluten-free) with instant local cart updates and database-synchronized wishlists.
- **Accessible & SEO Optimized**: Compliant with WCAG 2.1 Level AA (using screen-reader labels, explicit input connections, keyboard focus traps, and modal escape triggers) and fully optimized for crawling using dynamic server-side Open Graph and metadata generation.

### 📦 Regional Logistics & Shipping (Shopify-style Zones)
- **State-Specific Surcharges**: Define Shipping Zones covering countries or specific states/regions (e.g. remote-area delivery surcharges).
- **Flexible Rate Rules**: Supports Flat Rate, Weight-Based, and Free Shipping tiers with configurable minimum/maximum order value/weight thresholds.
- **Real-Time Tax Extraction**: Automatically calculates VAT (UK) or GST (India) at checkouts using inclusive or exclusive regional settings.

### 🛡️ Secure Checkout & Payment Gateways
- **Multiple Gateways**: Integrated with Stripe (including Apple Pay/Google Pay requests), Razorpay, PayPal, and Cash on Delivery (COD).
- **Postcode/PIN Auto-complete**: Integrates with postal lookup APIs to autofill city and state values during address checkout.
- **Coupon Manager**: Supports region-scoped percentage or flat discount coupon verification.

### 📊 Administrative Suite & RBAC
- **Unified Portal**: Real-time sales metrics, revenue trend graphs (last 90 days), and conversion funnel analysis (Views ➔ Carts ➔ Checkouts ➔ Orders).
- **Staff Roles & Auditing**: Enforces strict Role-Based Access Control (RBAC) with granular permissions. Logs a complete audit trail (IP address, actor, change logs) for every administrative action.
- **Fraud & Risk Mitigation**: Automated checkout risk assessments scoring orders on mismatched regions, billing/shipping inconsistencies, and high-frequency attempts.

---

## 🛠️ Technology Stack

| Layer | Technology | Key Packages / Specs |
| --- | --- | --- |
| **Frontend** | React / Next.js (App Router) | Redux Toolkit, Lucide Icons, Stripe elements |
| **Backend** | Python / Django REST Framework | SimpleJWT, CORS Headers, WhiteNoise, PostgreSQL client |
| **Database** | PostgreSQL; SQLite for local development only | Highly optimized schema with index keys for fast lookup |
| **Proxy & TLS** | Host Nginx & Certbot | Shared-VPS TLS, HTTP/2, gzip, isolated reverse proxy routing |
| **Deployment** | Docker & Docker Compose | Multi-container architecture, persistent named volumes |

---

## ⚙️ Environment Configuration

Copy the configuration files into active environments:
- In `frontend/`: create `.env.local` based on `.env.example`
- In `backend/`: create `.env` based on `.env.example`
- In the root folder: create `.env` based on `.env.production.example` for Docker builds.

### Key Environment Variables

#### Frontend Configuration (`frontend/.env.local`)
- `NEXT_PUBLIC_API_URL`: Points to the Django backend (e.g. `http://localhost:8000`). Leave empty in production so nginx handles same-origin proxying.
- `NEXT_PUBLIC_SITE_URL`: Canonical site URL (e.g. `https://scleroproteins.co.uk`).
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Public Stripe API key.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`: Public Google OAuth client ID (enables Google Sign-in).

#### Backend Configuration (`backend/.env`)
- `SECRET_KEY`: Django cryptographic signing secret.
- `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT`: PostgreSQL configuration. SQLite fallback is restricted to local `DEBUG=True` development and is disabled in production.
- `SEED_SUPERUSER_PASSWORD`, `SEED_STAFF_PASSWORD`: One-off bootstrap credentials passed only to seed commands.

---

## 💻 Local Development Workflow

### Prerequisites
- Node.js (v18+)
- Python (v3.10+)
- PostgreSQL (Optional, defaults to SQLite)

### 1. Set Up the Backend
```bash
cd backend
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
python manage.py seed_db
python manage.py seed_catalog
python manage.py runserver
```
The backend server starts on `http://127.0.0.1:8000/`.

### 2. Set Up the Frontend
```bash
cd frontend
npm install
npm run dev
```
The Next.js storefront starts on `http://localhost:3000/`.

### 3. Log In & Verify
The seed command requires passwords supplied through
`SEED_SUPERUSER_PASSWORD` and `SEED_STAFF_PASSWORD`; no known default password
is used in production. Rotate bootstrap credentials after first sign-in and
enable TOTP for every staff account.

---

## 🛡️ Production Verification Checks

Run the following checks before committing code for deployment:
1. **Next.js Production Build**:
   ```bash
   cd frontend
   npm run build
   ```
   Ensures no static pre-rendering bailouts occur.
2. **Django Migrations**:
   ```bash
   cd backend
   python manage.py makemigrations --check --dry-run
   ```
   Confirms all schema changes have corresponding migration files.
3. **Django Test Suite**:
   ```bash
   cd backend
   python manage.py test
   ```
   Runs the installed backend app suites, including checkout, inventory, auth,
   webhooks, glossary, and admin serialization coverage.
4. **Dependency Audit**:
   ```bash
   cd backend
   python -m pip_audit -r requirements.txt
   ```
   Flags known Python package vulnerabilities before shipping.
5. **Log Check**:
   Confirm that all API client exceptions handle 401 token expirations cleanly by dropping cached tokens and returning to guest views.

For shared-VPS deployment, backups, TLS bootstrapping, health checks, rollback,
and go-live checks, follow [DEPLOYMENT.md](DEPLOYMENT.md).
