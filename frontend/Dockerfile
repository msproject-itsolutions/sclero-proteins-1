# syntax=docker/dockerfile:1

# ---- deps: install node_modules from lockfile ----
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: produce the standalone Next.js server ----
FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* are inlined into the client bundle at build time. Leave
# NEXT_PUBLIC_API_URL EMPTY so the browser calls the API same-origin (nginx
# proxies /api on each ccTLD). NEXT_PUBLIC_SITE_URL is the canonical primary host.
ARG NEXT_PUBLIC_API_URL=
ARG NEXT_PUBLIC_SITE_URL=https://scleroproteins.co.uk
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ARG NEXT_PUBLIC_GA4_ID=
ARG NEXT_PUBLIC_META_PIXEL_ID=
ARG NEXT_PUBLIC_TIKTOK_PIXEL_ID=
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ARG NEXT_PUBLIC_COMPANY_REGISTRATION_NUMBER=
ARG NEXT_PUBLIC_IN_GSTIN=
ARG NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID=
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_GA4_ID=$NEXT_PUBLIC_GA4_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_TIKTOK_PIXEL_ID=$NEXT_PUBLIC_TIKTOK_PIXEL_ID \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_COMPANY_REGISTRATION_NUMBER=$NEXT_PUBLIC_COMPANY_REGISTRATION_NUMBER \
    NEXT_PUBLIC_IN_GSTIN=$NEXT_PUBLIC_IN_GSTIN \
    NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID=$NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID

RUN npm run build

# ---- runner: minimal image running node server.js ----
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# libc6-compat lets the musl image load native dependencies when required.
RUN apk add --no-cache libc6-compat \
    && addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
