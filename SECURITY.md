# Security

## What this project holds

Worth stating plainly, because it bounds what a vulnerability here can be:

- **No accounts, no authentication, no sessions.** The backend is stateless.
- **No database.** The team lives on the device and travels in each request body.
- **No personal data at rest on the server.** Names and cities arrive in a request,
  are used to compute a status, and are not stored or logged.
- **No secrets in the repository.** The data providers need no keys.

The people added to a team have no account and are never contacted. They are a name and
a city typed by the user.

## Reporting

Report privately through GitHub's **Security → Report a vulnerability** on this
repository. Please do not open a public issue for something exploitable.

Include what an attacker gains. Given the above, the interesting classes are denial of
service against the backend, and anything that makes the app display data from a
different member than the one requested.

One person maintains this, so expect a reply in days rather than hours.

## Out of scope

- The absence of authentication. It is a product decision, not an oversight: see
  section 3 of `PLAN.md`.
- Cleartext HTTP in debug builds. It is confined to the debug manifest so a local
  backend can be reached; release builds refuse it.
- Wrong holiday or work week data. That is a correctness problem with its own issue
  form, not a security one.
