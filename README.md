# Lina Stock Count for Android

This Android Studio project packages the existing stock-count interface as an offline WebView app. Stock data stays in the app's private SQLite database. The app has a shared, offline username/password login; there is no cloud sync or network permission.

## Open and run

1. Install Android Studio with Android SDK 35 and a Java 17 runtime.
2. In the project root `local.properties`, add the shared login properties below. Keep this file private and do not send or commit it.
   ```properties
   lina.auth.username=your-shared-username
   lina.auth.password=use-a-private-password-of-at-least-12-characters
   ```
   The username must be 3-64 letters, numbers, `.`, `_`, `@`, or `-`. The password must be at least 12 characters.
3. Open this folder in Android Studio and let Gradle sync.
4. Connect an Android 10+ device or start an emulator, then run the `app` configuration.

The Gradle wrapper uses Gradle 8.9 with Android Gradle Plugin 8.7.3. To build an APK from Android Studio, choose **Build → Build Bundle(s) / APK(s) → Build APK(s)**. The installable debug APK is written to `app/build/outputs/apk/debug/app-debug.apk`. Transfer it to an Android 10+ phone, open it, and approve **Install unknown apps** if Android asks. This debug build is suitable for testing; for ongoing distribution, generate a signed release APK and keep its signing key safe.

The app's bundled interface is `app/src/main/assets/Stock_Count_System_V5.html`. `android-storage.js` redirects the existing app's local-storage API to SQLite, `session-tools.js` provides backup handling, and `auth-sessions.js` provides login and the session dashboard.

Build the APK after setting the shared credentials and install that same APK on each device to use the same login. The app derives a password verifier during the build; it does not store the plaintext password in the APK. Because login is entirely offline, however, a determined person with access to the APK can reverse-engineer or patch the client. This login is intended to control ordinary app access, not to provide server-grade identity verification.

## Session backups

Use **Download session JSON** to export the active stock list and count session to `Downloads/Lina Stock Count`. The app offers password encryption (AES-256-GCM with a password-derived key) or plain JSON. Encrypted backups use PBKDF2-HMAC-SHA-256 with a random salt and 310,000 iterations. Keep the password separate from the backup; it cannot be recovered. Other downloadable reports from the existing interface are saved in the same folder.

From the dashboard, choose **Import session backup** to continue a colleague's exported session. Both password-encrypted and plain JSON backups are supported; the existing session is saved in History before the imported session replaces the active one. This import preserves the device's other saved history. The older **Restore JSON** action in the stock-count interface replaces all stock data and saved history on that device, after confirmation. The restore/import flows reject files larger than 40 MB and validate the session structure.

## Security and storage

- SQLite rows are encrypted using AES-256-GCM with a key held in Android Keystore; row keys are authenticated as additional data.
- The database and app assets are private to the app. Android cloud/device backup is disabled; transfers are by explicit JSON export/import only.
- The app requests no Internet permission, blocks non-bundled WebView resources and navigation, and applies a restrictive Content Security Policy.
- WebView file/content access and mixed content are disabled. The JavaScript storage bridge accepts only the app's known storage-key shapes.
- Spreadsheet and backup files are selected through Android's document picker and read locally.

The app depends on Android's device lock and Keystore protections. A compromised or rooted device can bypass app-level protections. Password-encrypted JSON backups are recommended when transferring session data.
