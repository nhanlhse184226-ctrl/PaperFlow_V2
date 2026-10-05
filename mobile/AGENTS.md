# PaperFlow mobile

Read the root AGENTS.md first. This directory owns only the Flutter client and local test tools.

- Keep `lib/data` HTTP/session/state logic independent from screen widgets; shared visual tokens live in `lib/ui/design.dart`.
- Supported targets: Android, iOS and Windows local preview. This is native Flutter, not a WebView. Flutter web is intentionally not configured because native cookie and secure-storage semantics differ from browser authentication.
- UI default is Vietnamese. Source quotations and AI interpretations retain backend wording. The backend currently supports explicit translation only for topic analysis; do not silently pretend other modules are fully translated.
- `flutter pub get`, `flutter analyze`, `flutter test` before handoff. Run integration tests against `tools/test_server.py` on port 8011; never production. `flutter build windows --debug` verifies only Windows.
- Do not put secrets in Dart defines, assets, screenshots, test fixtures or logs. Never change BE/FE to satisfy a mobile test.
- Read `README.md` for the run commands, current limitations and store release prerequisites.
