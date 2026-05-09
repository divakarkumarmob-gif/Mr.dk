import React, { useState, useEffect } from 'react';

export default function SupportModal({ isOpen, onClose, onConfirm }: { isOpen: boolean, onClose: () => void, onConfirm: () => void }) {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-6" onClick={onClose}>
            <div className="bg-[#161e38] p-6 rounded-2xl border border-white/10 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 text-white">Report a problem?</h2>
                <div className="flex gap-3 mt-6">
                    <button onClick={onConfirm} className="flex-1 bg-blue-600 py-2 rounded-lg font-bold">Yes</button>
                    <button onClick={onClose} className="flex-1 bg-white/10 py-2 rounded-lg font-bold">No</button>
                </div>
            </div>
        </div>
    );
}
