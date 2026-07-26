/**
 * Formats a Firestore Timestamp (or null) into WhatsApp-style presence text.
 * Examples: "online", "last seen just now", "last seen today at 3:45 PM",
 * "last seen yesterday at 9:12 AM", "last seen 12/07/2026"
 */
export function formatPresence(online: boolean, lastSeen: any): string {
    if (online) return 'online';
    if (!lastSeen?.toDate) return 'offline';

    const date: Date = lastSeen.toDate();
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'last seen just now';
    if (diffMins < 60) return `last seen ${diffMins} min${diffMins === 1 ? '' : 's'} ago`;

    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `last seen today at ${timeStr}`;
    if (isYesterday) return `last seen yesterday at ${timeStr}`;

    const dateStr = date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `last seen ${dateStr} at ${timeStr}`;
}
