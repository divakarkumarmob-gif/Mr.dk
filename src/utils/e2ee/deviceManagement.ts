import { getE2EEStorageItem, setE2EEStorageItem } from './storage';
import { collection, doc, setDoc, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export interface DeviceInfo {
    deviceId: string;
    deviceName: string;
    userAgent: string;
    platform: string;
    registeredAt: any;
    lastActive: any;
    isCurrent?: boolean;
}

const DEVICE_ID_KEY = 'local_device_id';

/**
 * Gets local device ID or creates one if absent
 */
export async function getOrCreateDeviceId(): Promise<string> {
    let deviceId = await getE2EEStorageItem<string>(DEVICE_ID_KEY);
    if (!deviceId) {
        deviceId = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        await setE2EEStorageItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}

/**
 * Detects device browser/platform name
 */

function detectDeviceName(): string {
    const ua = navigator.userAgent;
    let browser = 'Web Browser';
    if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('SamsungBrowser')) browser = 'Samsung Internet';
    else if (ua.includes('Opera') || ua.includes('OPR')) browser = 'Opera';
    else if (ua.includes('Trident')) browser = 'Internet Explorer';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Safari')) browser = 'Safari';

    let os = 'Unknown OS';
    if (ua.includes('Win')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return `${browser} on ${os}`;
}

/**
 * Registers local device in Firestore
 */
export async function registerDeviceInFirestore(uid: string): Promise<DeviceInfo> {
    const deviceId = await getOrCreateDeviceId();
    const deviceName = detectDeviceName();
    const platform = navigator.platform || 'Unknown';
    const userAgent = navigator.userAgent;

    const deviceRef = doc(db, 'users', uid, 'devices', deviceId);
    const deviceData = {
        deviceId,
        deviceName,
        userAgent,
        platform,
        registeredAt: new Date().toISOString(),
        lastActive: new Date().toISOString()
    };

    await setDoc(deviceRef, deviceData, { merge: true });

    return { ...deviceData, isCurrent: true };
}

/**
 * Gets all linked devices for user
 */
export async function getUserDevices(uid: string): Promise<DeviceInfo[]> {
    const currentDeviceId = await getOrCreateDeviceId();
    const devicesRef = collection(db, 'users', uid, 'devices');
    const snapshot = await getDocs(devicesRef);

    const devices: DeviceInfo[] = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data() as DeviceInfo;
        devices.push({
            ...data,
            isCurrent: data.deviceId === currentDeviceId
        });
    });

    return devices;
}

/**
 * Revokes a device by removing it from Firestore
 */
export async function revokeDevice(uid: string, deviceIdToRevoke: string): Promise<void> {
    const deviceRef = doc(db, 'users', uid, 'devices', deviceIdToRevoke);
    await deleteDoc(deviceRef);
}

/**
 * Revokes all linked devices for a user except the current local device
 */
export async function revokeAllOtherDevices(uid: string): Promise<number> {
    const currentDeviceId = await getOrCreateDeviceId();
    const devicesRef = collection(db, 'users', uid, 'devices');
    const snapshot = await getDocs(devicesRef);

    let count = 0;
    const deletePromises: Promise<void>[] = [];
    snapshot.forEach(docSnap => {
        const deviceId = docSnap.id;
        if (deviceId !== currentDeviceId) {
            deletePromises.push(deleteDoc(docSnap.ref));
            count++;
        }
    });

    await Promise.all(deletePromises);
    return count;
}
