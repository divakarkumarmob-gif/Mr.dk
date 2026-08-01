package com.neetmaster.app;

import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ScreenSecurity")
public class ScreenSecurityPlugin extends Plugin {

    @PluginMethod
    public void enableScreenshot(PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    JSObject ret = new JSObject();
                    ret.put("allowed", true);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to enable screenshot", e);
                }
            }
        });
    }

    @PluginMethod
    public void disableScreenshot(PluginCall call) {
        getActivity().runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try {
                    getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                    JSObject ret = new JSObject();
                    ret.put("allowed", false);
                    call.resolve(ret);
                } catch (Exception e) {
                    call.reject("Failed to disable screenshot", e);
                }
            }
        });
    }
}
