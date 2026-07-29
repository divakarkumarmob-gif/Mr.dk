package com.neetmaster.app;

import android.content.ActivityNotFoundException;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the JS side open the exact system screens needed to keep FCM
 * delivery alive when the app is fully killed, instead of just telling
 * the user where to go. Two things this can do that a text instruction
 * can't:
 *  1. Fire the real "Allow app to ignore battery optimizations" system
 *     dialog directly (one tap = done, no manual navigation).
 *  2. Try known OEM autostart-manager screens (MIUI, ColorOS, FuntouchOS,
 *     OxygenOS) via their internal component names, falling back to the
 *     app's own info page if the OEM screen isn't found on that build.
 */
@CapacitorPlugin(name = "BackgroundSettings")
public class BackgroundSettingsPlugin extends Plugin {

    @PluginMethod
    public void isIgnoringBatteryOptimizations(PluginCall call) {
        Context ctx = getContext();
        boolean ignoring = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            ignoring = pm != null && pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
        }
        JSObject ret = new JSObject();
        ret.put("ignoring", ignoring);
        call.resolve(ret);
    }

    /** Fires the direct system dialog: "Allow [app] to ignore battery optimizations?" */
    @PluginMethod
    public void requestIgnoreBatteryOptimizations(PluginCall call) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                String pkg = getContext().getPackageName();
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + pkg));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getActivity().startActivity(intent);
                call.resolve(new JSObject().put("opened", true));
            } else {
                call.resolve(new JSObject().put("opened", false));
            }
        } catch (Exception e) {
            openAppDetailsFallback(call);
        }
    }

    /** Tries the OEM's own autostart/background-manager screen; falls back to app info page. */
    @PluginMethod
    public void openAutostartSettings(PluginCall call) {
        Context ctx = getContext();
        String manufacturer = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER.toLowerCase();

        ComponentName[] candidates;
        if (manufacturer.contains("xiaomi")) {
            candidates = new ComponentName[]{
                new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
                new ComponentName("com.miui.securitycenter", "com.miui.securitycenter.Main")
            };
        } else if (manufacturer.contains("oppo") || manufacturer.contains("realme")) {
            candidates = new ComponentName[]{
                new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
                new ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
                new ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")
            };
        } else if (manufacturer.contains("vivo") || manufacturer.contains("iqoo")) {
            candidates = new ComponentName[]{
                new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
                new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
                new ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.BgStartUpManager")
            };
        } else if (manufacturer.contains("oneplus")) {
            candidates = new ComponentName[]{
                new ComponentName("com.oneplus.security", "com.oneplus.security.chainlaunch.view.ChainLaunchAppListActivity")
            };
        } else if (manufacturer.contains("samsung")) {
            candidates = new ComponentName[]{
                new ComponentName("com.samsung.android.lool", "com.samsung.android.sm.ui.battery.BatteryActivity")
            };
        } else {
            candidates = new ComponentName[]{};
        }

        for (ComponentName cn : candidates) {
            try {
                Intent intent = new Intent();
                intent.setComponent(cn);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(intent);
                call.resolve(new JSObject().put("opened", true).put("screen", "oem"));
                return;
            } catch (ActivityNotFoundException | SecurityException ignored) {
                // Try next candidate — screen name differs across OEM skin versions.
            }
        }
        // No OEM-specific screen worked (or this isn't a known OEM) — app's
        // own info page is a safe universal fallback the user can act from.
        openAppDetailsFallback(call);
    }

    private void openAppDetailsFallback(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("opened", true).put("screen", "app_info"));
        } catch (Exception e) {
            call.reject("Could not open settings", e);
        }
    }
}
