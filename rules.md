# Codebase Rules & Guidelines

This document outlines the coding standards, library constraints, API boundaries, and error handling rules for the Tyqro project to ensure production-level code quality.

---

## 1. Libraries & Dependency Guidelines

### 1.1. What to Use (Preferred Stack)
* **Frontend UI**: Bootstrap 5 (CSS framework) and Bootstrap Icons for simple, responsive component styling.
* **State Management**: React `useState` and `useEffect` hooks. For larger flows, use React Context.
* **API Requests**: Standard Javascript `fetch` API.
* **Backend API Framework**: Django REST Framework (DRF) with `@api_view` or APIView classes to enforce serializations and automated responses.
* **Backend Security**: `djangorestframework-simplejwt` for secure, stateless token authentication (Access/Refresh cycles).

### 1.2. What to Avoid (Forbidden/Discouraged Stack)
* **TailwindCSS**: Do not introduce Tailwind. Keep the design aligned with Bootstrap 5 to maintain style consistency and prevent bloated stylesheet payloads.
* **Redux/MobX**: Avoid adding global state packages. The current state is highly localized and lightweight; adding external state managers introduces unnecessary complexity.
* **Raw Session Authentication for API**: Avoid mixing Django cookie-based sessions with JWT tokens. If a view handles dashboard metrics, it MUST be a DRF view, not a raw Django `@login_required` view, to avoid CSRF-origin check mismatches.
* **Standard Django Templates**: The backend should strictly act as a headless JSON API. Do not write HTML files in Django templates folder for main dashboard screens.

---

## 2. API Design & System Boundaries

### 2.1. Authorization Boundaries
* **Token Handshake**: All protected API endpoints must enforce `Bearer JWT` headers:
  `Authorization: Bearer <access_token>`
* **CORS Settings**: Restrict `CORS_ALLOWED_ORIGINS` to trusted hosts (localhost in debug mode, and the secure production domain on Vercel). Do not allow wildcard `*` origins in production settings.
* **Payload Encodings**: Enforce `application/json` payload bodies for POST/PUT/PATCH operations.

### 2.2. CORS & CSRF Boundaries
* Stateless API views (DRF) do not require CSRF cookies. If a view is authenticated via headers, make sure it is managed by DRF's authentication classes to prevent session middleware conflicts.

---

## 3. Error Handling Principles

### 3.1. Frontend Error Handling Rules
* **No Crashing / Uncaught Exceptions**: Wrap all `fetch` requests inside robust `try/catch` wrappers.
* **User-Facing Alerting**: If an API returns a non-2xx status, extract the detail message and assign it to a state variable (e.g. `setError` or `setReasonError`) to show a clean alert modal.
* **Fallback Defaults**: In the performance heatmap, if any API failure occurs, fall back to rendering an empty year grid instead of crashing the dashboard layout.
* **Image Fallbacks**: Always provide `onError` image handlers for logo assets and avatars to prevent broken-link icons.

### 3.2. Backend Error Handling Rules
* **Consistent Payload Schemas**: All error outputs must return standardized JSON payloads:
  ```json
  {
      "error": "Error identifier code",
      "detail": "Human readable reason description"
  }
  ```
* **Status Code Integrity**:
  * Return `400 Bad Request` for validation failures (e.g., duplicate work sessions, invalid registration data).
  * Return `401 Unauthorized` for expired or invalid tokens.
  * Return `403 Forbidden` for permissions violations (e.g. editing another user's todo).
  * Return `404 Not Found` for missing database entries.
* **Never Expose Tracebacks**: Ensure `DEBUG = False` is active in production server settings so that raw Python stack traces are never printed in response payloads. Log traceback files silently to secure files/syslogs.

---

## 4. PWA & Cache Management

* **Service Worker Boundary**: The service worker (`sw.js`) caches static assets for offline usage.
* **Versioned Caches**: Bump `CACHE_NAME` (e.g., `tyqro-v4`, `tyqro-v5`) on any release that edits core scripts to force immediate browser cache updates.
* **Ignore APIs**: Never allow the service worker to cache API endpoints under `/api/` using caching protocols. All REST APIs must bypass caches to fetch real-time state.
