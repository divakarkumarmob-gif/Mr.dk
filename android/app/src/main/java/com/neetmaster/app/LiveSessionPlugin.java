package com.neetmaster.app;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

/**
 * Capacitor plugin that bridges the Live AI session's foreground service
 * (CallStyle notification) to the JS/TS side.
 */
@CapacitorPlugin(
    name = "LiveSession",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class LiveSessionPlugin extends Plugin {

    private BroadcastReceiver receiver;
    private boolean isRegistered = false;

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (intent == null || intent.getAction() == null) return;
                try {
                    switch (intent.getAction()) {
                        case LiveSessionService.ACTION_END_CALL:
                            notifyListeners("callEnded", new JSObject());
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
            isRegistered = true;
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        try {
            Context context = getContext();

            // Safety check: ensure microphone permission is granted before launching foreground service with microphone type
            if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                call.reject("RECORD_AUDIO permission not granted");
                return;
            }

            // Request POST_NOTIFICATIONS permission on Android 13+ if not already granted
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    if (getActivity() != null) {
                        ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 101);
                    }
                }
            }

            Intent serviceIntent = new Intent(context, LiveSessionService.class);
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent);
                } else {
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                e.printStackTrace();
                try {
                    context.startService(serviceIntent);
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
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
            if (receiver != null && isRegistered) {
                getContext().unregisterReceiver(receiver);
                isRegistered = false;
                receiver = null;
            }
        } catch (Exception e) {
            // Safe to ignore
        }
        stopServiceInternal();
    }
}
