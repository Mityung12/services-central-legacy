/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

package org.mozilla.gecko;

import android.content.Context;
import android.content.res.Resources;
import android.graphics.drawable.BitmapDrawable;
import android.util.Log;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.PopupWindow;
import android.widget.LinearLayout;
import android.widget.RelativeLayout;
import android.widget.RelativeLayout.LayoutParams;
import android.widget.ImageView;
import android.widget.TextView;

import org.json.JSONObject;
import org.json.JSONException;

public class SiteIdentityPopup extends PopupWindow {
    private static final String LOGTAG = "GeckoSiteIdentityPopup";

    public static final String UNKNOWN = "unknown";
    public static final String VERIFIED = "verified";
    public static final String IDENTIFIED = "identified";

    private Context mContext;
    private Resources mResources;
    private boolean mInflated;

    private TextView mHost;
    private TextView mOwner;
    private TextView mSupplemental;
    private TextView mVerifier;
    private TextView mEncrypted;

    private ImageView mLarry;
    private ImageView mArrow;

    public SiteIdentityPopup(Context aContext) {
        super(aContext);
        mContext = aContext;
        mResources = aContext.getResources();
        mInflated = false;
   }

    private void init() {
        setBackgroundDrawable(new BitmapDrawable());
        setOutsideTouchable(true);
        setWindowLayoutMode(LayoutParams.FILL_PARENT, LayoutParams.WRAP_CONTENT);

        LayoutInflater inflater = LayoutInflater.from(mContext);
        RelativeLayout layout = (RelativeLayout) inflater.inflate(R.layout.site_identity_popup, null);
        setContentView(layout);

        mHost = (TextView) layout.findViewById(R.id.host);
        mOwner = (TextView) layout.findViewById(R.id.owner);
        mSupplemental = (TextView) layout.findViewById(R.id.supplemental);
        mVerifier = (TextView) layout.findViewById(R.id.verifier);
        mEncrypted = (TextView) layout.findViewById(R.id.encrypted);

        mLarry = (ImageView) layout.findViewById(R.id.larry);
        mArrow = (ImageView) layout.findViewById(R.id.arrow);

        mInflated = true;
    }

    public void show(int leftMargin) {
        JSONObject identityData = Tabs.getInstance().getSelectedTab().getIdentityData();
        if (identityData == null) {
            Log.e(LOGTAG, "Tab has no identity data");
            return;
        }

        String mode;
        try {
            mode = identityData.getString("mode");
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception trying to get identity mode: " + e);
            return;
        }

        if (!mode.equals(VERIFIED) && !mode.equals(IDENTIFIED)) {
            Log.e(LOGTAG, "Can't show site identity popup in non-identified state");
            return;
        }

        if (!mInflated)
            init();

        try {
            String host = identityData.getString("host");
            mHost.setText(host);

            String owner = identityData.getString("owner");
            mOwner.setText(owner);

            String verifier = identityData.getString("verifier");
            mVerifier.setText(verifier);

            String encrypted = identityData.getString("encrypted");
            mEncrypted.setText(encrypted);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception trying to get identity data: " + e);
            return;
        }

        try {
            String supplemental = identityData.getString("supplemental");
            mSupplemental.setText(supplemental);
            mSupplemental.setVisibility(View.VISIBLE);
        } catch (JSONException e) {
            mSupplemental.setVisibility(View.INVISIBLE);
        }

        if (mode.equals(VERIFIED)) {
            // Use a blue theme for SSL
            mLarry.setImageResource(R.drawable.larry_blue);
            mHost.setTextColor(mResources.getColor(R.color.identity_verified));
            mOwner.setTextColor(mResources.getColor(R.color.identity_verified));
            mSupplemental.setTextColor(mResources.getColor(R.color.identity_verified));
        } else {
            // Use a green theme for EV
            mLarry.setImageResource(R.drawable.larry_green);
            mHost.setTextColor(mResources.getColor(R.color.identity_identified));
            mOwner.setTextColor(mResources.getColor(R.color.identity_identified));
            mSupplemental.setTextColor(mResources.getColor(R.color.identity_identified));
        }

        // Position the mArrow according to lock position
        LayoutParams layoutParams = (LayoutParams) mArrow.getLayoutParams();
        LayoutParams newLayoutParams = new LayoutParams(LayoutParams.WRAP_CONTENT, LayoutParams.WRAP_CONTENT);
        newLayoutParams.setMargins(leftMargin, layoutParams.topMargin, 0, 0);
        mArrow.setLayoutParams(newLayoutParams);

        // This will place the popup at the correct vertical position
        showAsDropDown(GeckoApp.mBrowserToolbar.mSiteSecurity);
    }
}
