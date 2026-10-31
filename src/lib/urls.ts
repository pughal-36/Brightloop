export function sanitizeReturnTo(returnTo?: string | null): string | null {
  if (!returnTo || typeof returnTo !== "string") {
    return null;
  }

  const trimmed = returnTo.trim();

  // Must start with a single "/" and not "//"
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return null;
  }

  // Must not contain backslashes (prevents "/\\evil.com" bypass)
  if (trimmed.includes("\\")) {
    return null;
  }

  // Must not contain control characters or newlines
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) {
    return null;
  }

  // Ensure it cannot be treated as having a scheme
  try {
    const parsed = new URL(trimmed, "http://localhost");
    if (parsed.origin !== "http://localhost") {
      return null;
    }
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) {
      return null;
    }
  } catch {
    return null;
  }

  return trimmed;
}

