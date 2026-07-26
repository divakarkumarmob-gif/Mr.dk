import { showToast } from './toast';

/**
 * Opens the device's phone dialer pre-filled with the given number.
 * Shows a toast if no number is available.
 */
export function callPhoneNumber(phoneNumber: string | null | undefined) {
    if (!phoneNumber || !phoneNumber.trim()) {
        showToast('Phone number not available');
        return;
    }
    const sanitized = phoneNumber.trim();
    window.location.href = `tel:${sanitized}`;
}
