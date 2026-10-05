import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:paperflow_mobile/data/api.dart';
import 'package:paperflow_mobile/screens/workspace.dart';
import 'package:paperflow_mobile/ui/design.dart';

class TestSession implements SessionStore {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String v) async {
    value = v;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();
  testWidgets('native session and full shared-backend research workflow', (
    tester,
  ) async {
    const base = String.fromEnvironment(
      'TEST_API_URL',
      defaultValue: 'http://127.0.0.1:8011',
    );
    if (![
      '127.0.0.1',
      'localhost',
      '10.0.2.2',
    ].contains(Uri.parse(base).host)) {
      throw StateError('Integration tests must never target production.');
    }
    final store = TestSession();
    final api = PaperApi(baseUrl: base, store: store);
    final email =
        'mobile-${DateTime.now().microsecondsSinceEpoch}@example.test';
    await api.signIn(email, 'Mobile-test-only-2026', register: true);
    final project = object(
      await api.request(
        '/projects',
        method: 'POST',
        data: {'name': 'Mobile integration research'},
      ),
    );
    final pid = project['id'];
    final root = '/projects/$pid';
    try {
      await api.request(
        '$root/topic',
        method: 'PUT',
        data: {
          'title': 'Guided feedback in programming',
          'description': 'An isolated fixture research project.',
          'team_size': 4,
          'output_language': 'en',
        },
      );
      await api.request(
        '$root/topic/analyze',
        method: 'POST',
        data: {'force': false},
      );
      await api.request('$root/topic/confirm', method: 'POST');
      final sourceBytes = await File('../artifacts/test-source.pdf')
          .readAsBytes();
      final source = object(
        await api.upload('$root/sources', 'fixture.pdf', sourceBytes),
      );
      final sid = source['id'];
      await api.request(
        '$root/sources/$sid/process',
        method: 'POST',
        data: {'force': false},
      );
      // A second source is needed to exercise cross-source comparisons.
      final other = object(
        await api.upload(
          '$root/sources',
          'second-fixture.pdf',
          Uint8List.fromList([...sourceBytes, 10, 37, 32, 50]),
        ),
      );
      await api.request(
        '$root/sources/${other['id']}/process',
        method: 'POST',
        data: {'force': false},
      );
      await api.request(
        '$root/comparisons',
        method: 'POST',
        data: {
          'source_ids': [sid, other['id']],
          'force': false,
        },
      );
      final p = await api.project(pid);
      expect(p['confirmed'], true);
      final e = objects(objects(p['sources']).first['evidence']).first;
      final page = object(
        await api.request('$root/sources/$sid/pages/${e['page']}'),
      );
      expect(textOf(page, 'text'), contains(e['quote']));
      expect((await api.pdf(pid, sid)).take(5), sourceBytes.take(5));
      expect(evidenceCsv(objects(p['sources'])), contains(e['quote']));
      final draft = object(
        await api.request(
          '$root/drafts',
          method: 'POST',
          data: {
            'title': 'Test writing',
            'text': 'Guided feedback improves student programming performance.',
          },
        ),
      );
      await api.request(
        '$root/drafts/${draft['id']}/check',
        method: 'POST',
        data: {'force': false},
      );
      final checked = await api.project(pid);
      final check = objects(objects(checked['drafts']).first['claims'])
          .first['check'];
      expect(check['status'], 'SUPPORTED');
      expect(objects(check['matches']), isNotEmpty);
      expect(objects(checked['comparisons']), isNotEmpty);
      final resumed = PaperApi(baseUrl: base, store: store);
      await resumed.restore();
      expect(object(await resumed.request('/auth/me'))['email'], email);
      expect((await resumed.project(pid))['confirmed'], true);
      final stranger = PaperApi(baseUrl: base, store: TestSession());
      await stranger.signIn(
        'other-$email',
        'Mobile-test-only-2026',
        register: true,
      );
      await expectLater(
        stranger.project(pid),
        throwsA(isA<ApiFailure>().having((e) => e.status, 'ownership', 404)),
      );
      await stranger.signOut();
      await api.request(
        '/hub',
        method: 'POST',
        data: {
          'topic': 'Mobile fixture research',
          'note': 'Isolated test-only note for the local fixture server.',
        },
      );
      expect(objects(await api.request('/hub?q=Mobile%20fixture')), isNotEmpty);
      await tester.pumpWidget(
        MaterialApp(
          theme: paperTheme(),
          home: WorkspaceScreen(api: api, id: pid),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 1));
      expect(find.text('Mobile integration research'), findsOneWidget);
      for (final label in ['Tài liệu', 'Bằng chứng', 'Bài viết', 'Đề tài']) {
        await tester.tap(find.text(label).last);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
      }
      // Existing backend invalidation semantics must remain unchanged.
      await api.request(
        '$root/drafts/${draft['id']}',
        method: 'PUT',
        data: {
          'title': 'Changed draft',
          'text': 'An edited statement that needs a new evidence check.',
        },
      );
      expect(
        objects((await api.project(pid))['drafts']).first['claims'],
        isEmpty,
      );
      await api.request('$root/sources/$sid', method: 'DELETE');
      expect(objects((await api.project(pid))['sources']).length, 1);
      await tester.pumpWidget(const SizedBox());
    } finally {
      await api.request(root, method: 'DELETE');
      await api.signOut();
    }
    expect(store.value, isNull);
  }, timeout: const Timeout(Duration(minutes: 4)));
}
