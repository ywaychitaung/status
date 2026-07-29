/**
 * CSRF token for plain form posts and `fetch` calls, read from the meta tag
 * rendered by app.blade.php and falling back to Laravel's XSRF-TOKEN cookie.
 */
export function csrfToken(): string {
    if (typeof document === 'undefined') return '';

    const meta = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]');
    if (meta?.content) return meta.content;

    const cookie = document.cookie.split('; ').find((entry) => entry.startsWith('XSRF-TOKEN='));

    return cookie ? decodeURIComponent(cookie.slice('XSRF-TOKEN='.length)) : '';
}
