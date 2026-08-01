package com.neetmaster.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Capacitor plugin that bridges the Live AI session's foreground service
 * (CallStyle notification) to the JS/TS side.
 *
 * JS API:
 *   LiveSession.startSession()   — starts the foreground service + notification
 *   LiveSession.stopSession()    — stops the foreground service
 *   LiveSession.updateMute({ muted: boolean }) — swaps mic icon without restarting
 *
 * Events emitted to JS via notifyListeners():
 *   "callEnded"    — user tapped the red end-call button in the notification
 *   "muteToggled"  — user tapped the mic button in the notification
 */
@CapacitorPlugin(name = "LiveSession")
public class LiveSessionPlugin extends Plugin {

    private BroadcastReceiver receiver;

    @Override
    public void load() {
        // Register a broadcast receiver that listens for the notification
        // action broadcasts and forwards them to the JS layer.
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                try {
                    switch (intent.getAction()) {
                        case LiveSessionService.ACTION_END_CALL:
                            notifyListeners("callEnded", new JSObject());
                            // Also stop the service since the user tapped end-call
                            stopServiceInternal();
                            break;
                        case LiveSessionService.ACTION_MUTE_TOGGLE:
                            notifyListeners("muteToggled", new JSObject());
                            break;
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(LiveSessionService.ACTION_END_CALL);
        filter.addAction(LiveSessionService.ACTION_MUTE_TOGGLE);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(receiver, filter);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), LiveSessionService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            call.resolve(new JSObject().put("started", true));
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Failed to start live session service", e);
        }
    }

    @PluginMethod
    public void stopSession(PluginCall call) {
        try {
            stopServiceInternal();
            call.resolve(new JSObject().put("stopped", true));
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Failed to stop live session service", e);
        }
    }

    /**
     * Update the notification's mic icon without restarting the service
     * or resetting the chronometer. Called from JS when the user mutes/
     * unmutes from within the app UI, so the notification icon stays in
     * sync.
     */
    @PluginMethod
    public void updateMute(PluginCall call) {
        try {
            boolean muted = call.getBoolean("muted", false);
            Intent serviceIntent = new Intent(getContext(), LiveSessionService.class);
            serviceIntent.putExtra("updateMute", muted);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            call.resolve(new JSObject().put("updated", true));
        } catch (Exception e) {
            e.printStackTrace();
            call.reject("Failed to update mute state", e);
        }
    }

    private void stopServiceInternal() {
        try {
            Intent serviceIntent = new Intent(getContext(), LiveSessionService.class);
            getContext().stopService(serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (receiver != null) {
                getContext().unregisterReceiver(receiver);
                receiver = null;
            }
        } catch (Exception e) {
            // Receiver may not have been registered — safe to ignore.
        }
        stopServiceInternal();
    }
}
