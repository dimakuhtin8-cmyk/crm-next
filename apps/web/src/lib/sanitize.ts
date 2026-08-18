/**
 * Input sanitization for XSS prevention
 */

// Remove HTML tags and script content
export function sanitizeInput(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/data:text\/html/gi, '') // Remove data: URI
    .trim();
}

// Sanitize name (allow letters, spaces, hyphens, apostrophes, Ukrainian chars)
export function sanitizeName(name: string): string {
  return name
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove angle brackets
    .trim()
    .slice(0, 100); // Limit length
}

// Sanitize email (basic cleaning)
export function sanitizeEmail(email: string): string {
  return email
    .toLowerCase()
    .trim()
    .slice(0, 254); // RFC 5321 max length
}
