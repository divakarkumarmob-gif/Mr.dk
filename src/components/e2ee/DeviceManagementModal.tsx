import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Smartphone, Laptop, Trash2, ShieldCheck, RefreshCw, X, AlertCircle } from 'lucide-react';
import { getUserDevices, revokeDevice, DeviceInfo } from '../../utils/e2ee';
import { showToast } from '../../utils/toast';

interface DeviceManagementModalProps {
    uid: string;
    onClose: () => void;
}

import { useModalBackButton } from '../../utils/hardwareBackButton';

export default function DeviceManagementModal({ uid, onClose }: DeviceManagementModalProps) {
    useModalBackButton(true, onClose);
    const [devices, setDevices] = useState<DeviceInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [revokingId, setRevokingId] = useState<string | null>(null);

    const loadDevices = async () => {
        setLoading(true);
        try {
            const list = await getUserDevices(uid);
            setDevices(list);
        } catch (e) {
            console.error("Device fetch error:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDevices();
    }, [uid]);

    const handleRevoke = async (deviceId: string, deviceName: string) => {
        if (!window.confirm(`Kya aap device "${deviceName}" ko revoke karna chahte hain? Is device ka access invalidate ho jayega.`)) {
            return;
        }

        setRevokingId(deviceId);
        try {
            await revokeDevice(uid, deviceId);
            showToast(`Device "${deviceName}" revoke kar diya gaya. 🚫`);
            setDevices(prev => prev.filter(d => d.deviceId !== deviceId));
        } catch (e: any) {
            showToast('Device revoke karne me error aayi.');
        } finally {
            setRevokingId(null);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl text-white relative"
            >
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                            <Laptop className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-100 text-base">Linked Devices</h3>
                            <p className="text-xs text-slate-400">Manage device keys & active sessions</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                        <span className="text-xs">Fetching active devices...</span>
                    </div>
                ) : devices.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                        <AlertCircle className="w-6 h-6 text-slate-500" />
                        <span>Koi secondary device linked nahi hai.</span>
                    </div>
                ) : (
                    <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                        {devices.map(device => (
                            <div 
                                key={device.deviceId}
                                className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                                    device.isCurrent 
                                        ? 'bg-emerald-950/30 border-emerald-500/40' 
                                        : 'bg-slate-800/60 border-slate-700/60'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${device.isCurrent ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
                                        {device.platform?.toLowerCase().includes('win') || device.platform?.toLowerCase().includes('mac') ? (
                                            <Laptop className="w-4 h-4" />
                                        ) : (
                                            <Smartphone className="w-4 h-4" />
                                        )}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-slate-100">{device.deviceName}</span>
                                            {device.isCurrent && (
                                                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded border border-emerald-500/30">
                                                    This Device
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Added: {new Date(device.registeredAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                {!device.isCurrent && (
                                    <button 
                                        onClick={() => handleRevoke(device.deviceId, device.deviceName)}
                                        disabled={revokingId === device.deviceId}
                                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                                        title="Revoke Device"
                                    >
                                        {revokingId === device.deviceId ? (
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold"
                    >
                        Close
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
