import React, { useState } from 'react';
import { toPng } from 'html-to-image';
import { Camera, Send, X } from 'lucide-react';

export default function SupportModal({ isOpen, onClose, onConfirm, onSendReport }: { isOpen: boolean, onClose: () => void, onConfirm: () => void, onSendReport: (screenshot: string, text: string) => void }) {
    const [isSharing, setIsSharing] = useState(false);
    const [screenshot, setScreenshot] = useState<string | null>(null);
    const [text, setText] = useState('');

    if (!isOpen) return null;

    const handleTakeScreenshot = async () => {
        try {
            const dataUrl = await toPng(document.body, {
                filter: (node) => node.id !== 'support-modal-container'
            });
            setScreenshot(dataUrl);
            setIsSharing(true);
        } catch (error) {
            console.error('Error taking screenshot:', error);
            alert('Failed to take screenshot.');
        }
    };

    const handleSendReport = async () => {
        if (!screenshot) return;
        
        try {
            // Need to convert dataUrl to File for uploadMedia
            const res = await fetch(screenshot);
            const blob = await res.blob();
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });
            
            // Re-use existing uploadMedia from chatService - needs to be imported if not already.
            // Since UserChat uses sendMessage/uploadMedia, I'll need to trigger that logic.
            // Actually, I can just call handleSend with the dataUrl if I make the service support it,
            // or just use uploadMedia locally if I can import it.
            // The file currently has: import { initializeChat, sendMessage, uploadMedia, subscribeToMessages } from '../services/chatService';
            // Wait, SupportModal.tsx does NOT have these imports.
            
            // Let's modify handleSendReport to accept the onSendReport prop, which will handle the logic inside UserChat/App.
            // Wait, UserChat/App.tsx logic is already there. I just need to call it.
            
            onSendReport(screenshot, text);
            alert('Message sent!');
            setIsSharing(false);
            onClose();
        } catch (error) {
            console.error('Error sending report:', error);
            alert('Failed to send report.');
        }
    };

    if (isSharing) {
        return (
            <div className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-6" onClick={() => setIsSharing(false)}>
                <div className="bg-[#161e38] p-6 rounded-2xl border border-white/10 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                    <h2 className="text-xl font-bold mb-4 text-white">Report Details</h2>
                    {screenshot && (
                        <img
                            src={screenshot}
                            alt="Screenshot"
                            className="mb-4 rounded-lg border border-white/20 w-full max-h-56 object-contain bg-black/30 mx-auto"
                        />
                    )}
                    <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Describe the issue..."
                        className="w-full bg-white/5 text-white p-2 rounded-lg mb-4 h-24"
                    />
                    <button onClick={handleSendReport} className="w-full bg-blue-600 py-2 rounded-lg font-bold text-white flex items-center justify-center gap-2">
                        <Send size={18} /> Send Report
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div id="support-modal-container" className="fixed inset-0 bg-black/80 z-[1000] flex items-center justify-center p-6" onClick={onClose}>
            <div className="bg-[#161e38] p-6 rounded-2xl border border-white/10 w-full max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-xl font-bold mb-4 text-white">Report a problem?</h2>
                <div className="flex flex-col gap-3 mt-6">
                    <button onClick={onConfirm} className="w-full bg-blue-600 py-2 rounded-lg font-bold text-white">Yes</button>
                    <button onClick={handleTakeScreenshot} className="w-full bg-green-600 py-2 rounded-lg font-bold text-white flex items-center justify-center gap-2">
                        <Camera size={18} /> Share Screen
                    </button>
                    <button onClick={onClose} className="w-full bg-white/10 py-2 rounded-lg font-bold text-white">No</button>
                </div>
            </div>
        </div>
    );
}
