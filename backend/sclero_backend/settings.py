import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / '.env')

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.getenv('SECRET_KEY', 'django-insecure-default-fallback-key')
DEBUG = os.getenv('DEBUG', 'True') == 'True'

ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')

# Sentry — optional. When SENTRY_DSN is set the SDK initialises on import; in dev
# leave SENTRY_DSN empty and nothing is reported. send_default_pii=False keeps
# GDPR-relevant headers (cookies, auth header) out of the wire. Bump
# traces_sample_rate when you actually want APM data; high values can be costly.
SENTRY_DSN = os.getenv('SENTRY_DSN', '')
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[DjangoIntegration()],
            traces_sample_rate=float(os.getenv('SENTRY_TRACES_SAMPLE_RATE', '0.1')),
            send_default_pii=False,
            environment='development' if DEBUG else 'production',
            release=os.getenv('SENTRY_RELEASE', ''),
        )
    except Exception:
        # Never let observability tooling break the server boot.
        pass


# Logging — terse default. Errors go to stderr; the SensitiveDataFilter scrubs
# common secret patterns from log messages (Stripe keys, webhook secrets, bearer
# tokens) before they ever reach a handler.
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'filters': {
        'scrub_secrets': {'()': 'sclero_backend.logging_filters.SensitiveDataFilter'},
    },
    'formatters': {
        'simple': {'format': '%(levelname)s %(asctime)s %(name)s %(message)s'},
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
            'filters': ['scrub_secrets'],
            'level': 'INFO' if DEBUG else 'WARNING',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'INFO' if DEBUG else 'WARNING',
    },
    'loggers': {
        'django.request': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
    },
}

# Application definition
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party apps
    'rest_framework',
    'corsheaders',
    
    # Project apps
    'apps.regions.apps.RegionsConfig',
    'apps.products.apps.ProductsConfig',
    'apps.inventory.apps.InventoryConfig',
    'apps.users.apps.UsersConfig',
    'apps.orders.apps.OrdersConfig',
    'apps.admin_dashboard.apps.AdminDashboardConfig',
    'apps.audit.apps.AuditConfig',
    'apps.enquiries.apps.EnquiriesConfig',
    'apps.analytics.apps.AnalyticsConfig',
    'apps.fraud.apps.FraudConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware', # CORS middleware goes before CommonMiddleware
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'apps.audit.context.AuditContextMiddleware',
]

# WhiteNoise serves Django's own static files (admin, DRF) straight from the app
# process so nginx only handles /media uploads. Inserted right after the security
# middleware. Guarded so local dev still boots before the prod deps are pip-installed.
try:
    import whitenoise  # noqa: F401
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
    _WHITENOISE_AVAILABLE = True
except ImportError:
    _WHITENOISE_AVAILABLE = False

ROOT_URLCONF = 'sclero_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'sclero_backend.wsgi.application'

# Database Setup: PostgreSQL with SQLite fallback
DB_NAME = os.getenv('DB_NAME')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

if DB_NAME and DB_USER:
    try:
        import psycopg2
        # Verify connectivity with a short timeout
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            connect_timeout=2
        )
        conn.close()
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': DB_NAME,
                'USER': DB_USER,
                'PASSWORD': DB_PASSWORD,
                'HOST': DB_HOST,
                'PORT': DB_PORT,
                'CONN_MAX_AGE': 600, # Connection pooling for optimization
            }
        }
        print("--> Successfully connected to PostgreSQL. Using PostgreSQL as main database.")
    except Exception as e:
        print(f"--> WARNING: PostgreSQL connection failed: {e}. Falling back to SQLite local database.")
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Custom User Model
AUTH_USER_MODEL = 'users.User'

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static & Media Files
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# WhiteNoise: compress + hash static files at collectstatic time so they can be
# served with long-lived immutable cache headers. Falls back to Django's default
# static storage when WhiteNoise isn't installed (e.g. a bare local checkout).
_STATIC_BACKEND = (
    'whitenoise.storage.CompressedManifestStaticFilesStorage'
    if _WHITENOISE_AVAILABLE
    else 'django.contrib.staticfiles.storage.StaticFilesStorage'
)
STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.FileSystemStorage'},
    'staticfiles': {'BACKEND': _STATIC_BACKEND},
}

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        'CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3100'
    ).split(',') if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# CSRF: the trusted origins that may submit forms / unsafe methods. In the ccTLD
# deployment the frontend calls the API same-origin (per domain), so list every
# scheme://host that serves the site. Comma-separated, full origins with scheme.
CSRF_TRUSTED_ORIGINS = [
    o.strip() for o in os.getenv(
        'CSRF_TRUSTED_ORIGINS',
        'https://scleroproteins.co.uk,https://www.scleroproteins.co.uk,'
        'https://scleroproteins.in,https://www.scleroproteins.in,'
        'https://scleroproteins.com,https://www.scleroproteins.com',
    ).split(',') if o.strip()
]

# Running behind nginx, which terminates TLS and forwards the original scheme in
# X-Forwarded-Proto. This lets Django know the request was secure.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True

# Production hardening — only when DEBUG is off so local dev over http still works.
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '31536000'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    # nginx already redirects http->https; leave Django's redirect off to avoid
    # double-redirect loops behind the proxy.
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False') == 'True'

# DRF Configurations
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.AllowAny',
    ),
}

# Staff RBAC enforcement. Defaults ON in production (DEBUG=False) and OFF in
# development. Override with the RBAC_ENFORCED env var (e.g. to harden staging
# or to troubleshoot a production permission gap). When ON, every admin endpoint
# requires an authenticated staff user whose roles grant the required permission
# key — see apps/users/permissions.py.
_RBAC_DEFAULT = 'False' if DEBUG else 'True'
RBAC_ENFORCED = os.getenv('RBAC_ENFORCED', _RBAC_DEFAULT) == 'True'

# Email / SMTP Settings (overridable per environment, and at runtime via
# SystemSetting(key='SMTP_SETTINGS') in the admin panel)
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '1025'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False') == 'True'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'noreply@scleroproteins.co.uk')
SITE_URL = os.getenv('SITE_URL', '')

# Simple JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=1),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': False,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
