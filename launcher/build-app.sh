#!/bin/bash
# Build Sulla Desktop.app launcher bundle
# Usage: ./launcher/build-app.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_NAME="Sulla Desktop"
APP_BUNDLE="$PROJECT_DIR/${APP_NAME}.app"
ICON_SRC="$(cd "$PROJECT_DIR/.." && pwd)/app-icon.png"
ICON_PNG="$SCRIPT_DIR/icon-converted.png"
ICONSET_DIR="$SCRIPT_DIR/SullaDesktop.iconset"
ICNS_FILE="$SCRIPT_DIR/SullaDesktop.icns"

echo "Building ${APP_NAME}.app..."

# --- Normalize source icon to PNG ---
sips -s format png "$ICON_SRC" --out "$ICON_PNG" >/dev/null
echo "  ✓ Prepared icon source"

# --- Generate .icns from PNG ---
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

sips -z 16 16     "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16.png"      >/dev/null
sips -z 32 32     "$ICON_PNG" --out "$ICONSET_DIR/icon_16x16@2x.png"   >/dev/null
sips -z 32 32     "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32.png"      >/dev/null
sips -z 64 64     "$ICON_PNG" --out "$ICONSET_DIR/icon_32x32@2x.png"   >/dev/null
sips -z 128 128   "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128.png"    >/dev/null
sips -z 256 256   "$ICON_PNG" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 256 256   "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256.png"    >/dev/null
sips -z 512 512   "$ICON_PNG" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 512 512   "$ICON_PNG" --out "$ICONSET_DIR/icon_512x512.png"    >/dev/null
cp "$ICON_PNG"                      "$ICONSET_DIR/icon_512x512@2x.png"

iconutil -c icns "$ICONSET_DIR" -o "$ICNS_FILE"
rm -rf "$ICONSET_DIR"
echo "  ✓ Generated icns"

# --- Assemble .app bundle ---
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

cp "$ICNS_FILE" "$APP_BUNDLE/Contents/Resources/SullaDesktop.icns"

# Info.plist
cat > "$APP_BUNDLE/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>Sulla Desktop</string>
  <key>CFBundleDisplayName</key>
  <string>Sulla Desktop</string>
  <key>CFBundleIdentifier</key>
  <string>com.sulla.desktop-dev</string>
  <key>CFBundleVersion</key>
  <string>1.0</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <key>CFBundleExecutable</key>
  <string>launcher</string>
  <key>CFBundleIconFile</key>
  <string>SullaDesktop</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
  <key>LSUIElement</key>
  <false/>
</dict>
</plist>
PLIST

# Launcher script
cat > "$APP_BUNDLE/Contents/MacOS/launcher" <<'LAUNCHER'
#!/bin/zsh

# Resolve the project directory (3 levels up from Contents/MacOS/launcher)
PROJECT_DIR="$(cd "$(dirname "$0")/../../.." && pwd)"

# Source nvm so we get the right node
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# Homebrew paths (Apple Silicon)
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

export NODE_NO_WARNINGS=1

cd "$PROJECT_DIR"
exec npx electron .
LAUNCHER

chmod +x "$APP_BUNDLE/Contents/MacOS/launcher"

echo "  ✓ Built ${APP_NAME}.app at: $APP_BUNDLE"
echo ""
echo "Drag it to your Dock or double-click to launch."
