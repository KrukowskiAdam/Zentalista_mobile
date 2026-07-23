package com.zentalist.app;

import android.content.pm.ApplicationInfo;
import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.view.WindowCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
			WebView.setWebContentsDebuggingEnabled(true);
		}
		WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
	}
}
