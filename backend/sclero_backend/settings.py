import os
import sys
import tempfile
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env
load_dotenv(BASE_DIR / '.env')

def env_bool(name, default=False):
    return os.getenv(name, str(default)).strip().lower() in {'1', 'true', 'yes', 'on'}


DEBUG = env_bool('DEBUG', False)
_BUILDING_STATIC = env_bool('DJANGO_COLLECTSTATIC', False)
TESTING = 'test' in sys.argv

# Fail closed outside development. A known fallback key is acceptable only for
# local developer runs and Docker collectstatic, never for a live process.
SECRET_KEY = os.getenv('SECRET_KEY', '')
if not SECRET_KEY:
    if DEBUG or _BUILDING_STATIC:
        SECRET_KEY = 'django-insecure-local-build-only-fallback-key'
    else:
        raise ImproperlyConfigured('SECRET_KEY must be set when DEBUG=False.')
if not DEBUG and SECRET_KEY.startswith(('django-insecure-', 'CHANGE_ME')):
    raise ImproperlyConfigured('SECRET_KEY must be a real production secret.')

ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv('ALLOWED_HOSTS', 'localhost,127.0.0.1').split(',')
    if host.strip()
]
if not DEBUG and not _BUILDING_STATIC:
    if not os.getenv('ALLOWED_HOSTS', '').strip():
        raise ImproperlyConfigured('ALLOWED_HOSTS must be set when DEBUG=False.')
    if '*' in ALLOWED_HOSTS:
        raise ImproperlyConfigured('Wildcard ALLOWED_HOSTS is not allowed in production.')

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
    'rest_framework_simplejwt.token_blacklist',
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

# Database setup. Production configures PostgreSQL without performing network I/O
# while importing settings; readiness and the entrypoint verify connectivity.
# The convenience SQLite fallback is limited to explicit local DEBUG runs.
DB_NAME = os.getenv('DB_NAME')
DB_USER = os.getenv('DB_USER')
DB_PASSWORD = os.getenv('DB_PASSWORD')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

ALLOW_SQLITE_FALLBACK = env_bool('ALLOW_SQLITE_FALLBACK', DEBUG)

if DB_NAME and DB_USER:
    use_sqlite = False
    if DEBUG and ALLOW_SQLITE_FALLBACK:
        try:
            import psycopg2
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT,
                connect_timeout=2,
            )
            conn.close()
        except Exception as e:
            use_sqlite = True
            print(f"--> WARNING: PostgreSQL connection failed: {e}. Falling back to SQLite local database.")

    if use_sqlite:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.sqlite3',
                'NAME': BASE_DIR / 'db.sqlite3',
            }
        }
    else:
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.postgresql',
                'NAME': DB_NAME,
                'USER': DB_USER,
                'PASSWORD': DB_PASSWORD,
                'HOST': DB_HOST,
                'PORT': DB_PORT,
                'CONN_MAX_AGE': 600,
                'CONN_HEALTH_CHECKS': True,
                'OPTIONS': {'connect_timeout': 5},
            }
        }
else:
    if not ALLOW_SQLITE_FALLBACK and not _BUILDING_STATIC:
        raise ImproperlyConfigured('DB_NAME and DB_USER must be set when DEBUG=False.')
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
        'OPTIONS': {'min_length': 12},
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

# A shared on-disk cache keeps rate-limit counters coherent across Gunicorn
# workers in the single backend container. Use Redis before scaling to multiple
# backend containers.
#
# On Windows dev servers the file-based backend races under concurrent
# requests (pickle.load hits PermissionError on a file another thread holds),
# surfacing as intermittent 500s from DRF throttling. Local dev runs a single
# process, so an in-memory cache is both safe and race-free there.
if DEBUG and os.name == 'nt':
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'sclero-dev-cache',
            'TIMEOUT': 300,
            'OPTIONS': {'MAX_ENTRIES': 10000},
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.filebased.FileBasedCache',
            'LOCATION': os.getenv(
                'DJANGO_CACHE_LOCATION',
                str(Path(tempfile.gettempdir()) / 'sclero-django-cache'),
            ),
            'TIMEOUT': 300,
            'OPTIONS': {'MAX_ENTRIES': 10000},
        }
    }

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS Settings
CORS_ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv(
        'CORS_ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:3100'
    ).split(',') if o.strip()
]
CORS_ALLOW_CREDENTIALS = env_bool('CORS_ALLOW_CREDENTIALS', True)

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
TRUST_PROXY_HEADERS = env_bool('TRUST_PROXY_HEADERS', not DEBUG)

# Production hardening — only when DEBUG is off so local dev over http still works.
if not DEBUG:
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    CSRF_COOKIE_SECURE = True
    CSRF_COOKIE_SAMESITE = 'Lax'
    SECURE_HSTS_SECONDS = int(os.getenv('SECURE_HSTS_SECONDS', '3600'))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool('SECURE_HSTS_INCLUDE_SUBDOMAINS', False)
    SECURE_HSTS_PRELOAD = env_bool('SECURE_HSTS_PRELOAD', False)
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = 'strict-origin-when-cross-origin'
    SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
    X_FRAME_OPTIONS = 'DENY'
    # nginx already redirects http->https; leave Django's redirect off to avoid
    # double-redirect loops behind the proxy.
    SECURE_SSL_REDIRECT = os.getenv('SECURE_SSL_REDIRECT', 'False') == 'True'

# DRF Configurations
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
        'rest_framework.throttling.ScopedRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': os.getenv('DRF_THROTTLE_ANON', '500/hour'),
        'user': os.getenv('DRF_THROTTLE_USER', '5000/hour'),
        'auth': os.getenv('DRF_THROTTLE_AUTH', '10/min'),
        'otp': os.getenv('DRF_THROTTLE_OTP', '5/min'),
        'password_reset': os.getenv('DRF_THROTTLE_PASSWORD_RESET', '5/hour'),
        'contact': os.getenv('DRF_THROTTLE_CONTACT', '5/hour'),
        'review': os.getenv('DRF_THROTTLE_REVIEW', '5/hour'),
        'checkout': os.getenv('DRF_THROTTLE_CHECKOUT', '20/hour'),
        'analytics': os.getenv('DRF_THROTTLE_ANALYTICS', '120/min'),
        'media_upload': os.getenv('DRF_THROTTLE_MEDIA_UPLOAD', '30/hour'),
    },
}

# Staff RBAC fails closed in every environment. A developer may explicitly set
# RBAC_ENFORCED=False for isolated fixture work, but DEBUG must never silently
# expose customer/order/payment administration APIs.
RBAC_ENFORCED = env_bool('RBAC_ENFORCED', True)

# Email / SMTP Settings (overridable per environment, and at runtime via
# SystemSetting(key='SMTP_SETTINGS') in the admin panel)
EMAIL_BACKEND = os.getenv('EMAIL_BACKEND', 'django.core.mail.backends.console.EmailBackend')
EMAIL_HOST = os.getenv('EMAIL_HOST', 'localhost')
EMAIL_PORT = int(os.getenv('EMAIL_PORT', '1025'))
EMAIL_HOST_USER = os.getenv('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.getenv('EMAIL_HOST_PASSWORD', '')
EMAIL_USE_TLS = os.getenv('EMAIL_USE_TLS', 'False') == 'True'
DEFAULT_FROM_EMAIL = os.getenv('DEFAULT_FROM_EMAIL', 'support@scleroproteins.co.uk')
SITE_URL = os.getenv('SITE_URL', '')
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', os.getenv('NEXT_PUBLIC_GOOGLE_CLIENT_ID', '')).strip()
COMPANY_REGISTRATION_NUMBER = os.getenv('COMPANY_REGISTRATION_NUMBER', '').strip()
UK_VAT_NUMBER = os.getenv('UK_VAT_NUMBER', '').strip()
IN_GSTIN = os.getenv('IN_GSTIN', '').strip()
if not DEBUG and not _BUILDING_STATIC and not SITE_URL.startswith('https://'):
    raise ImproperlyConfigured('SITE_URL must be an absolute https:// URL in production.')
if not DEBUG and not _BUILDING_STATIC:
    missing_legal = [
        name for name, value in {
            'COMPANY_REGISTRATION_NUMBER': COMPANY_REGISTRATION_NUMBER,
            'UK_VAT_NUMBER': UK_VAT_NUMBER,
            'IN_GSTIN': IN_GSTIN,
        }.items() if not value or value.startswith('CHANGE_ME')
    ]
    if missing_legal:
        raise ImproperlyConfigured(
            f"Production legal identifiers are missing: {', '.join(missing_legal)}"
        )

# Simple JWT Settings
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=int(os.getenv('JWT_ACCESS_MINUTES', '15'))),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=int(os.getenv('JWT_REFRESH_DAYS', '7'))),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': SECRET_KEY,
    'AUTH_HEADER_TYPES': ('Bearer',),
}
