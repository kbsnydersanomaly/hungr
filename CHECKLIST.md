# Hungr — One-Page Smoke Checklist

**Date:** __________ **Tester:** __________ **Env:** ☐ local ☐ staging ☐ production

---

### Setup (before testing)
☐ Plans seeded ☐ Test user email confirmed ☐ Super admin set (if testing `/admin`) ☐ `NEXT_PUBLIC_APP_URL` matches env

### Marketing & auth
☐ `/` redirects to `/sign-in` when logged out ☐ `/sign-in` loads and sign-up mode is accessible ☐ Sign up → confirm email → sign in ☐ Sign out ☐ Forgot password email + reset works ☐ Logged-out `/dashboard` → `/sign-in`

### Restaurant & billing
☐ Create restaurant ☐ PayFast checkout completes (or sandbox return) ☐ Success banner on billing ☐ Restaurant slug visible on `/restaurants`

### Menu builder
☐ Create menu ☐ Add category + item (with image) ☐ Edit item ☐ Drag reorder ☐ **Publish** menu

### Content & brand
☐ Branding: preview updates → **Publish** ☐ About page saves ☐ Media upload works ☐ QR code downloads

### Public menu (incognito / mobile)
☐ `/m/[slug]` shows items + branding ☐ Item detail page ☐ About link works ☐ Submit review ☐ Mobile nav opens

### Dashboard moderation
☐ Approve review ☐ Special created → visible on public menu (if in date range) ☐ `/insights` charts load

### Team
☐ Org invite sent ☐ Invite link accepted (new or existing user) ☐ Role change + remove member (toast on success)

### Settings
☐ Profile save ☐ Org name save ☐ Password change ☐ Notification toggles save ☐ Org billing page loads

### Super admin (optional)
☐ `/admin/orgs` ☐ `/admin/users` ☐ `/admin/subscriptions/[id]` ☐ `/admin/health` ☐ Impersonate → banner → stop

### Post-deploy only
☐ `/api/health` 200 ☐ PayFast ITN webhook received ☐ Transaction in billing history ☐ Email delivery (not console) ☐ Cron grace-period authorized

---

**Result:** ☐ All critical pass ☐ Blockers: _______________________________________________

*Critical path = Marketing → Auth → Restaurant → Menu publish → Public menu → Review → Approve. Full detail: `DEMO_AND_TEST_PLAN.md`*
