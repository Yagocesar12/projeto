# VIIBE Panel — Setup Guide

## Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Supabase (PostgreSQL + Auth + Storage + RLS)
- Radix UI primitives
- Recharts
- Sonner (toasts)
- Framer Motion

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Supabase Setup

### 2.1 Create a new Supabase project at https://supabase.com

### 2.2 Run the migration

In your Supabase dashboard → SQL Editor, paste and run:

```
supabase/migrations/001_initial_schema.sql
```

This creates all tables, RLS policies, atomic RPCs, triggers, and seed data.

### 2.3 Create Storage buckets

In Supabase → Storage, create these buckets:
- `skins` — for mod skin previews and files (Public)
- `avatars` — for user avatars (Public)
- `files` — for IPA files (Private)

### 2.4 Configure Auth

In Supabase → Authentication → Settings:
- Enable Email confirmations
- Set Site URL to your domain
- Add redirect URLs: `http://localhost:3000/**` and your production domain

---

## 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```bash
cp .env.example .env.local
```

Required variables:
```
NEXT_PUBLIC_SUPABASE_URL=        # From Supabase Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # From Supabase Settings → API (anon key)
SUPABASE_SERVICE_ROLE_KEY=       # From Supabase Settings → API (service_role — KEEP SECRET)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_SECRET=                 # Run: openssl rand -base64 32
```

---

## 4. Create your first admin user

### Option A — Via Supabase Auth + SQL

1. Register an account normally through `/register`
2. Confirm the email
3. In Supabase SQL Editor, run:

```sql
UPDATE profiles
SET role = 'admin'
WHERE email = 'your-admin@email.com';
```

### Option B — Via Supabase Auth Dashboard

1. Create user in Authentication → Users
2. Update role in Table Editor → profiles

---

## 5. Add Products

Products must exist for key generation. Add via Supabase SQL Editor:

```sql
INSERT INTO products (name, description, credit_cost, is_active, sort_order)
VALUES
  ('GHOST Basic', 'Acesso básico', 30, true, 1),
  ('GHOST Pro', 'Acesso completo', 80, true, 2),
  ('GHOST Elite', 'Acesso elite com todas features', 150, true, 3);
```

Or via the admin settings panel once it's running.

---

## 6. Run the development server

```bash
npm run dev
```

Open http://localhost:3000

---

## 7. Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/login` | Public | Login |
| `/register` | Public | Register |
| `/forgot-password` | Public | Password reset request |
| `/reset-password` | Public | Set new password |
| `/blocked` | Public | Blocked account page |
| `/dashboard` | Reseller | Main dashboard |
| `/dashboard/generate` | Reseller | Key generation |
| `/dashboard/manage` | Reseller | Key management |
| `/dashboard/wallet` | Reseller | Credits & history |
| `/dashboard/profile` | Reseller | Profile |
| `/admin` | Admin only | Admin dashboard |
| `/admin/resellers` | Admin only | Reseller management |
| `/admin/keys` | Admin only | Global key management |
| `/admin/wallet` | Admin only | Financial overview |
| `/admin/ipa/features` | Admin only | Feature flags |
| `/admin/ipa/skins` | Admin only | Mod skin catalog |
| `/admin/ipa/controls` | Admin only | Global controls |
| `/admin/logs` | Admin only | Audit logs |

---

## 8. Public APIs (for future external project integration)

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/mod-skins` | None | Active skins list |
| `POST /api/webhooks` | Webhook signature | Payment webhooks |

### Key validation endpoint (implement when external project is ready)

```typescript
// In src/lib/services/key.service.ts
KeyService.validateKeyForExternalApp(keyValue)
// Returns: { valid, status, message, data }
```

---

## 9. Security Architecture

### Authorization layers:

1. **Next.js Middleware** (`/src/middleware.ts`)
   - Blocks unauthenticated access to protected routes
   - Blocks non-admins from `/admin` routes
   - Redirects blocked users to `/blocked`

2. **API Route guards**
   - Every API route verifies auth and role server-side
   - Never trusts frontend-sent role or credit values

3. **PostgreSQL RLS**
   - Row-level security enforces data isolation
   - Resellers only see their own data
   - Service role client used only server-side

4. **Atomic RPCs**
   - `generate_key_atomic()` — prevents race conditions
   - `add_credits_atomic()` — atomic credit operations
   - `remove_credits_atomic()` — with balance validation

### What resellers CANNOT do:
- Access any `/admin/*` route or API
- Modify their own role
- Add credits to themselves
- Set unlimited credits
- View other resellers' data
- Call admin-only API endpoints

---

## 10. Future Integration — External Project

When the external project is ready, integration points:

### Key validation
```typescript
// src/lib/services/key.service.ts → validateKeyForExternalApp()
// Returns key status, expiry, HWID, product info
```

### Feature flags
```typescript
// GET /api/features — returns all feature flag states
// External project polls this to enable/disable features
```

### Mod skins
```typescript
// GET /api/mod-skins — returns active skins list
// { skins: [{ name, filename, preview_url }] }
```

### HWID binding (implement when external project sends HWID)
```sql
-- Add to key record on first use
UPDATE keys SET hwid = $hwid, activated_at = NOW(), status = 'active'
WHERE key_value = $key AND hwid IS NULL;
```

---

## 11. Build for production

```bash
npm run build
npm start
```

Or deploy to Vercel:

```bash
npx vercel --prod
```

Set all environment variables in Vercel dashboard before deploying.
