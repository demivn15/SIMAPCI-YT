# Testing & Verification Guide — Institutional Login Portal

This manual outlines how to instantiate the mock LDAP directory container and run functional integration tests across all success, failure, and edge-case paths.

---

## Step 1: Start the Local OpenLDAP Container

We use a pre-populated OpenLDAP Docker container (`rroemhild/test-openldap`) to simulate production directory behavior offline.

### 1. Start Container
From the root directory where `docker-compose.yml` is located, execute:

```bash
docker compose up -d
```

### 2. Verify Container Health
```bash
docker ps
```
Ensure `mock_ldap_server` is running and binding port `10389`.

---

## Step 2: Pre-Loaded Test Accounts

The mock LDAP container contains pre-configured users under `ou=people,dc=planetexpress,dc=com`:

| Scenario | Username | Password | Group Membership | Expected Result |
| :--- | :--- | :--- | :--- | :--- |
| **Valid Professor** | `professor` | `professor` | `admin_staff` | **200 OK** — Redirects to `/dashboard` & sets JWT cookie |
| **Unauthorized User** | `fry` | `fry` | `ship_crew` | **401 Unauthorized** — LDAP bind succeeds, but fails group check |
| **Invalid Password** | `professor` | `wrongpass` | N/A | **401 Unauthorized** — LDAP bind fails |
| **Non-Existent User** | `unknown_user` | `password` | N/A | **401 Unauthorized** — User lookup yields no records |

---

## Step 3: Test Execution Walkthrough

### Scenario A: Successful Login & Session Persistence
1. Navigate to `http://localhost:5173/login`.
2. Input credentials:
   * **Username:** `professor`
   * **Password:** `professor`
3. Click **Sign In**.
4. **Verification:**
   * App redirects to `/dashboard`.
   * Open Developer Tools (`F12`) -> **Application** / **Storage** -> **Cookies**.
   * Locate `access_token` and verify the `HttpOnly` attribute is checked.
5. Refresh the browser page (`F5`).
   * `/auth/me` re-authenticates via cookie; user remains logged in.

### Scenario B: Authorization Enforcement (Non-Professor Access)
1. Go to `/login` and submit:
   * **Username:** `fry`
   * **Password:** `fry`
2. **Verification:**
   * Error message displayed: *"Invalid institutional credentials or unauthorized role."*
   * No cookie is set, and access to `/dashboard` is blocked.

### Scenario C: Authenticated Protected Route Guard
1. Open a private/incognito browser window.
2. Directly enter `http://localhost:5173/dashboard`.
3. **Verification:**
   * App invokes `/auth/me`, detects no valid cookie, and immediately redirects user to `/login`.

### Scenario D: LDAP Server Downtime / Timeout Handling
1. Stop the Docker container:
   ```bash
   docker compose stop
   ```
2. Attempt to log in with `professor` / `professor`.
3. **Verification:**
   * The backend connection times out after 5 seconds (`connect_timeout=5`).
   * Backend returns **HTTP 503 Service Unavailable**.
   * Frontend displays: *"Institutional directory service is temporarily unreachable. Please try again later."*
4. Restart the container:
   ```bash
   docker compose start
   ```

### Scenario E: Logout Flow
1. While logged in on `/dashboard`, click the **Logout** button.
2. **Verification:**
   * POST request hits `/api/v1/auth/logout`.
   * `access_token` cookie is cleared from the browser.
   * User is redirected to `/login`.