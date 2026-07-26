import { TextToSpeech } from '@capacitor-community/text-to-speech';
import { Capacitor } from '@capacitor/core';

export const speak = async (text: string, lang: string = 'en-US') => {
  if (Capacitor.isNativePlatform()) {
    try {
      await TextToSpeech.speak({
        text,
        lang,
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        category: 'ambient',
      });
    } catch (e) {
      console.error("Error speaking text:", e);
    }
  } else {
    // Web fallback using browser's SpeechSynthesis API
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    window.speechSynthesis.speak(utterance);
  }
};

export const stopSpeaking = async () => {
  if (Capacitor.isNativePlatform()) {
    try {
      await TextToSpeech.stop();
    } catch (e) {
      console.error("Error stopping speech:", e);
    }
  } else {
    window.speechSynthesis.cancel();
  }
};
