# Google Play release checklist

This document is for the **Android Play build** of PaperFlow. It does not add
new research workflow, account, payment, or AI behavior.

## What is already enforced in this build

- Application ID: `vn.paperflow.paperflow_mobile`.
- Flutter 3.47 targets Android API 36.
- AndroidManifest requests only `INTERNET`; the platform file picker is used
  instead of broad storage permissions.
- The Play app has no PayOS checkout, plan screen, purchase CTA, or link to an
  external checkout.
- Hub is not reachable from the Play app until report, block, and moderation
  controls exist end-to-end.
- Every AI result module exposes feedback including **Harmful or inappropriate**.
- Account → Delete account permanently deletes the account and all owned
  projects, PDFs, Hub notes, feedback, active sessions, and billing records.
- Privacy, terms, and support pages are public at `www.paperflow.space` after
  the frontend deployment containing this change.

## Create the upload key once

Run the local helper from `C:\PaperFlow\mobile`. It prompts for passwords with
hidden input, writes the ignored Gradle properties file, and restricts that
file to the current Windows user. The release build verifies the alias and
passwords without putting them in terminal arguments:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\tools\prepare_play_key.ps1 -KeystorePath "$env:USERPROFILE\paperflow-upload.jks" -Alias "paperflow-upload"
flutter build appbundle --release
Copy-Item build\app\outputs\bundle\release\app-release.aab ..\output\PaperFlow.aab
```

`android/key.properties` and `android/keystore/` are ignored by Git. Back up the
JKS and its passwords in a private password manager before the first upload.
Do not use the debug keystore for a Play build.

## Google Play Console

1. Create the app with package ID `vn.paperflow.paperflow_mobile`.
2. Enable **Play App Signing** and upload `output/PaperFlow.aab` to Internal
   testing first.
3. In Google Cloud Console, create an Android OAuth client with this package ID
   and the **Play App Signing certificate SHA-1/SHA-256**. Keep the existing
   server Web OAuth client ID on Render as `GOOGLE_OAUTH_CLIENT_ID`; never put
   a client secret in the app.
4. Set the Privacy Policy field to `https://www.paperflow.space/privacy` and
   support URL to `https://www.paperflow.space/support` only after those pages
   are deployed and load without sign-in.
5. Complete Data safety truthfully from the deployed implementation: email and
   account/session data; project text, PDFs, drafts, evidence; user feedback;
   and public Hub notes created from web. State that the app has no ads and no
   in-app purchase flow.
6. Complete Content rating, Target audience, App access, and store listing.
   For App access, provide a non-admin reviewer account with reusable access
   and English steps; never provide a production administrator password.
7. If the developer account is a new personal account, complete the required
   closed test before requesting production access.

## Final device QA

Test the signed AAB-installed build on a physical Android device: registration,
email login, Google login, logout, session restoration, project upload/PDF
viewing, all AI result feedback, account deletion, weak network/Render wake-up,
font scaling, TalkBack, and links to privacy/support. Confirm that no mobile
screen opens or promotes a purchase outside Google Play.
