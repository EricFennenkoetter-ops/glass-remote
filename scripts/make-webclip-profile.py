#!/usr/bin/env python3
"""
Builds public/glass-remote.mobileconfig: a configuration profile with a Web Clip payload.

Why: iOS 27.2 ignores apple-touch-icon and manifest icons when adding a site to the home
screen (even for well-known web apps) and shows a letter instead. A Web Clip installed from a
profile carries its own icon, so it doesn't depend on Safari's icon lookup.

Usage: python3 scripts/make-webclip-profile.py [app-url]
"""
import plistlib
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APP_URL = sys.argv[1] if len(sys.argv) > 1 else "https://ericfennenkoetter-ops.github.io/glass-remote/"
ICON = ROOT / "public" / "apple-touch-icon.png"
OUT = ROOT / "public" / "glass-remote.mobileconfig"

# Fixed identifiers so re-installing updates the existing profile instead of adding a second one.
NAMESPACE = uuid.UUID("6f1c2b7e-0a43-4c0e-9f5e-2f1f7a3c9d10")
PROFILE_ID = "io.github.ericfennenkoetter-ops.glass-remote"

webclip = {
    "PayloadType": "com.apple.webClip.managed",
    "PayloadVersion": 1,
    "PayloadIdentifier": f"{PROFILE_ID}.webclip",
    "PayloadUUID": str(uuid.uuid5(NAMESPACE, "webclip")).upper(),
    "PayloadDisplayName": "Glass Remote",
    "Label": "Glass Remote",
    "URL": APP_URL,
    "Icon": ICON.read_bytes(),  # written as <data>
    "Precomposed": True,  # iOS must not add its own gloss on top of the icon
    "FullScreen": True,  # open as standalone web app (no Safari bars)
    "IgnoreManifestScope": True,  # the Spotify login redirect stays inside the app window
    "IsRemovable": True,
}

profile = {
    "PayloadType": "Configuration",
    "PayloadVersion": 1,
    "PayloadIdentifier": PROFILE_ID,
    "PayloadUUID": str(uuid.uuid5(NAMESPACE, "profile")).upper(),
    "PayloadDisplayName": "Glass Remote",
    "PayloadDescription": "Legt Glass Remote mit Icon auf den Home-Bildschirm. Enthält keine weiteren Einstellungen.",
    "PayloadOrganization": "Glass Remote",
    "PayloadRemovalDisallowed": False,
    "PayloadContent": [webclip],
}

OUT.write_bytes(plistlib.dumps(profile))
print(f"✓ {OUT.relative_to(ROOT)} ({OUT.stat().st_size // 1024} KB) → {APP_URL}")
