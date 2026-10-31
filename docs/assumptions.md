# Assumptions

- Password policy schema and rule check function defined in src/lib/password.ts and re-exported in src/server/modules/auth/schema.ts so client components can import without violating server-only.
- Precomputed bcrypt cost 12 dummy hash used on unknown user login attempts to protect against timing attacks.
- In-memory sliding-window rate limiter in src/server/lib/rate-limit.ts caps password reset requests to 3 per hour per email for both existing and non-existing accounts to prevent enumeration.
- Login lockout tracks 5 failed attempts per email+IP in the last 15 minutes via LoginAttempt table and locks on the 6th failure with a 429 status.
- Admin staff creation generates a 24-hour set-password token reusing the PasswordResetToken flow and sends an email invitation.
- Customer management is accessible by both ADMIN and STAFF, with individual customer records scoped by customerId for customer portal requests.
- Catalog costPrice and product margin calculations are stripped from all non-ADMIN responses to protect financial margins.
- Plan availability windows treat dates inclusively from start-of-day on availableFrom through end-of-day on availableTo.

