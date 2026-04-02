/**
 * HTML sanitization utility — prevents XSS via dangerouslySetInnerHTML.
 *
 * Every component that renders user-provided HTML MUST use this wrapper
 * instead of passing raw HTML to dangerouslySetInnerHTML.
 *
 * Usage:
 *   import { sanitizeHtml } from '../lib/sanitize';
 *   <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(userContent) }} />
 */
import DOMPurify from 'dompurify';

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows safe formatting tags from rich-text editors (Quill) while
 * stripping dangerous elements like <script>, event handlers, etc.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
    if (!dirty) return '';
    return DOMPurify.sanitize(dirty, {
        ALLOWED_TAGS: [
            // Text formatting
            'p', 'br', 'b', 'i', 'u', 's', 'em', 'strong', 'sub', 'sup',
            // Headings
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            // Lists
            'ul', 'ol', 'li',
            // Links (href will be sanitized by DOMPurify)
            'a',
            // Block
            'blockquote', 'pre', 'code', 'div', 'span',
            // Tables
            'table', 'thead', 'tbody', 'tr', 'th', 'td',
            // Media (src sanitized)
            'img',
            // Misc
            'hr',
        ],
        ALLOWED_ATTR: [
            'href', 'target', 'rel', 'src', 'alt', 'title', 'width', 'height',
            'class', 'style', 'colspan', 'rowspan',
        ],
        ALLOW_DATA_ATTR: false,
    });
}
