import { Haptics, ImpactStyle } from '@capacitor/haptics';

export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
  try {
    if ((window as any).Capacitor) {
      await Haptics.impact({ style });
    }
  } catch (e) {
    console.error("Haptics error:", e);
  }
};
