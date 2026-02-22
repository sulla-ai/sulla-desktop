# Uninstalling Sulla Desktop

Use this guide to fully remove Sulla Desktop from your machine.

## Before you uninstall

- Close Sulla Desktop.
- Stop any active workflows or tasks.
- Back up any important local data you want to keep.

## Windows (10/11)

1. Open **Settings > Apps > Installed apps**.
2. Find **Sulla Desktop**.
3. Select **Uninstall** and confirm.
4. Follow the uninstall prompts until complete.

### Optional cleanup (Windows)

If you want to remove local app data as well, delete leftover Sulla folders in:

- `%AppData%`
- `%LocalAppData%`

## macOS

1. Quit Sulla Desktop.
2. Open **Applications**.
3. Drag **Sulla Desktop.app** to the Trash.
4. Empty Trash.

### Optional cleanup (macOS)

Remove any remaining app data from your user Library, for example:

- `~/Library/Application Support/`
- `~/Library/Caches/`
- `~/Library/Preferences/`

Look for folders or files that include `Sulla` or `sulla-desktop` in the name.

## Linux

Uninstall using the same package format you installed with.

### AppImage

1. Delete the `Sulla-Desktop.AppImage` file.
2. Remove any desktop shortcut you created.

### Debian/Ubuntu (`.deb`)

```bash
sudo apt remove sulla-desktop
sudo apt autoremove
```

### Fedora/RHEL (`.rpm`)

```bash
sudo dnf remove sulla-desktop
```

## Verify uninstall

- Confirm Sulla Desktop is no longer listed in installed apps.
- Reboot your machine if background processes remain.

## Reinstall later

If you want to install again later, use the latest installer from:

- https://sulladesktop.com/downloads
