/**
 * Email validation utilities using mail.so API and basic format validation.
 * This module provides both synchronous format validation for immediate feedback
 * and asynchronous mail.so API validation for thorough email verification.
 */

/**
 * Basic email format validation using regex.
 * This provides immediate feedback without API calls.
 * Matches most valid email formats according to RFC 5322.
 *
 * @param email - The email address to validate
 * @returns true if the email format is valid, false otherwise
 */
export function isValidEmailFormat(email: string): boolean {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) return false;

  // RFC 5322 compliant email regex (simplified but comprehensive)
  // Allows most valid email formats including:
  // - Standard formats: user@example.com
  // - With subdomain: user@mail.example.com
  // - With plus signs: user+tag@example.com
  // - With dashes: user-name@example.co.uk
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  return emailRegex.test(trimmedEmail);
}

/**
 * Email validation result from mail.so API.
 */
export interface EmailValidationResult {
  valid: boolean;
  reason?: string;
  deliverable?: boolean;
  disposable?: boolean;
  roleAccount?: boolean;
}

/**
 * Validates an email address using the mail.so API.
 * This performs thorough validation including deliverability checks,
 * disposable email detection, and role account detection.
 *
 * @param email - The email address to validate
 * @param apiKey - The mail.so API key (optional, can be set via environment variable)
 * @returns Promise resolving to EmailValidationResult
 */
export async function validateEmailWithMailSo(
  email: string,
  apiKey?: string,
): Promise<EmailValidationResult> {
  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { valid: false, reason: "Email is empty" };
  }

  // Use provided API key or get from environment variable
  const key = apiKey ?? process.env.NEXT_PUBLIC_MAILSO_API_KEY;

  if (!key) {
    // If no API key is provided, fall back to format validation
    console.warn(
      "mail.so API key not found. Falling back to format validation only.",
    );
    return {
      valid: isValidEmailFormat(trimmedEmail),
      reason: isValidEmailFormat(trimmedEmail)
        ? undefined
        : "Invalid email format",
    };
  }

  try {
    const response = await fetch("https://api.mails.so/v1/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ email: trimmedEmail }),
    });

    if (!response.ok) {
      throw new Error(`mail.so API error: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      valid: boolean;
      reason?: string;
      deliverable?: boolean;
      disposable?: boolean;
      roleAccount?: boolean;
    };

    return {
      valid: data.valid ?? false,
      reason: data.reason,
      deliverable: data.deliverable,
      disposable: data.disposable,
      roleAccount: data.roleAccount,
    };
  } catch (error) {
    console.error("Error validating email with mail.so:", error);
    // Fall back to format validation on API error
    return {
      valid: isValidEmailFormat(trimmedEmail),
      reason: error instanceof Error ? error.message : "Validation error",
    };
  }
}

/**
 * Comprehensive email validation that combines format validation with mail.so API.
 * Use this for thorough validation before important operations like user invitations.
 *
 * @param email - The email address to validate
 * @param apiKey - The mail.so API key (optional)
 * @returns Promise resolving to EmailValidationResult
 */
export async function validateEmail(
  email: string,
  apiKey?: string,
): Promise<EmailValidationResult> {
  const trimmedEmail = email.trim();

  // First check basic format
  if (!isValidEmailFormat(trimmedEmail)) {
    return {
      valid: false,
      reason: "Invalid email format",
    };
  }

  // Then validate with mail.so API
  return validateEmailWithMailSo(trimmedEmail, apiKey);
}
