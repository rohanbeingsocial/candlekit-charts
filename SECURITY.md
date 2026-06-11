# Security Policy

## Supported Versions

candlekit/charts is pre-1.0. Only the latest published minor receives
security fixes.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

Please report vulnerabilities privately via
[GitHub Security Advisories](https://github.com/rohanbeingsocial/candlekit-charts/security/advisories/new)
— do **not** open a public issue for security reports.

You can expect an acknowledgement within 7 days. If the report is accepted,
a fix lands in the next patch release and the advisory is published once a
fixed version is available; if declined, you'll get a short explanation.

## Scope notes

- This is a client-side charting library with no server component, no
  network calls, and no credential handling. The main classes of concern
  are XSS via chart/drawing inputs and prototype pollution via
  configuration/serialization (e.g. persisted drawing state).
- The live demo site (GitHub Pages) is a static showcase. GitHub Pages
  does not allow custom HTTP response headers, so header-only protections
  (`X-Content-Type-Options`, header CSP with `frame-ancestors`) cannot be
  set there; meta-tag equivalents are applied where the platform allows.
