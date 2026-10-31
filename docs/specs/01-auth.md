# 01 Auth
Purpose: signup, login, logout, password reset.
Roles: public routes. Signup always creates a CUSTOMER.
Data: User(email unique case-insensitive, passwordHash, role, isActive, sessionVersion, customerId?),
  PasswordResetToken(userId, tokenHash, expiresAt, usedAt), LoginAttempt(emailLower, ip, at, success).
Rules:
- Password: >= 9 chars, upper, lower, special. Same Zod schema on client and server. bcryptjs hash.
- Signup creates User + linked Customer. Duplicate email returns a clear CONFLICT.
- Session: JWT via jose in httpOnly, Secure(prod), SameSite=Lax cookie. Contains userId, role, sessionVersion.
  Verified on every request; inactive user or mismatched sessionVersion = logged out.
- Login: generic "invalid email or password". Lock 15 min after 5 failed attempts per email+IP.
- Reset request: always same response whether the email exists. Token 32 random bytes, stored as sha256 hash,
  expires 30 min, single use. Link: /reset-password?token=...
- Reset success: set new password, mark token used, increment sessionVersion.
- Email goes through sendEmail() in src/server/lib. In dev it logs the link to the console. Ask before adding an SMTP dependency.
Actions: signup, login, logout, requestPasswordReset, resetPassword.
UI: /signup /login /forgot-password /reset-password. Live password-rule checklist, loading, field errors,
  invalid/expired token state, locked state.
Done when: duplicate email rejected; weak passwords rejected (8 chars fails, 9 valid); reset link works once only;
  expired token rejected; 6th bad login locks; resetting a password logs out other sessions; tests for the rules.