import 'dart:io';
import 'dart:ui' as ui;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:paperflow_mobile/data/api.dart';
import 'package:paperflow_mobile/data/workspace.dart';
import 'package:paperflow_mobile/screens/auth.dart';
import 'package:paperflow_mobile/screens/topic.dart';
import 'package:paperflow_mobile/screens/sources.dart';
import 'package:paperflow_mobile/screens/evidence.dart';
import 'package:paperflow_mobile/screens/essay.dart';
import 'package:paperflow_mobile/screens/home.dart';
import 'package:paperflow_mobile/ui/design.dart';

import 'api_test.dart' show MemoryStore, ReplyAdapter, jsonReply;

Future<void> screenshot(WidgetTester tester, String name) async {
  final boundary = tester.renderObject<RenderRepaintBoundary>(
    find.byKey(const Key('capture')),
  );
  final image = await boundary.toImage(pixelRatio: 2);
  final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
  final dir = Directory('../artifacts/mobile/screenshots');
  dir.createSync(recursive: true);
  File('${dir.path}/$name.png').writeAsBytesSync(bytes!.buffer.asUint8List());
  image.dispose();
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final loader = FontLoader('PaperFlowSans')
      ..addFont(rootBundle.load('assets/fonts/roboto-regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/roboto-bold.ttf'));
    await loader.load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });
  PaperApi api() => PaperApi(
    store: MemoryStore(),
    client: Dio()..httpClientAdapter = ReplyAdapter((_) => jsonReply([])),
  );
  Widget frame(Widget screen) => RepaintBoundary(
    key: const Key('capture'),
    child: MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: paperTheme(),
      home: screen,
    ),
  );
  for (final width in [360.0, 430.0]) {
    testWidgets('login fits $width and validates without a request', (
      tester,
    ) async {
      tester.view.physicalSize = Size(width, 920);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(frame(AuthScreen(api: api(), onLogin: (_) {})));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await screenshot(tester, 'login-${width.toInt()}');
      await tester.ensureVisible(find.byKey(const Key('auth-submit')));
      await tester.tap(find.byKey(const Key('auth-submit')));
      await tester.pumpAndSettle();
      expect(find.text('Nhập email hợp lệ'), findsOneWidget);
      expect(find.text('Mật khẩu cần ít nhất 12 ký tự'), findsOneWidget);
    });
  }
  testWidgets('four modules render at phone width with long research data', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final w = Workspace(api(), 'p')
      ..project = {
        'name': 'Nghiên cứu học tập',
        'context': {
          'title': 'Ảnh hưởng của phản hồi trong học lập trình',
          'team_size': 4,
          'output_language': 'vi',
        },
        'confirmed': true,
        'analysis': {
          'summary': 'Một hướng nghiên cứu cần dữ liệu thực nghiệm.',
          'dimensions': [
            {
              'name': 'clarity',
              'status': 'ready',
              'explanation': 'Câu hỏi có phạm vi rõ ràng.',
            },
          ],
        },
        'sources': [
          {
            'id': 's',
            'filename': 'Nghiên cứu phản hồi trong giáo dục.pdf',
            'page_count': 12,
            'status': 'ready',
            'evidence_done': true,
            'evaluation': {},
            'evidence': [
              {
                'id': 'e',
                'source_id': 's',
                'kind': 'finding',
                'page': 3,
                'content': 'Phản hồi có hướng dẫn cải thiện kết quả trong nhóm nghiên cứu.',
                'quote': 'Original source quotation.',
              },
            ],
          },
        ],
        'drafts': [
          {
            'id': 'd',
            'title': 'Bài viết nghiên cứu',
            'text': 'Một luận điểm cần nguồn hỗ trợ và kiểm tra giới hạn.',
            'status': 'checked',
            'claims': [
              {
                'text': 'Phản hồi hỗ trợ việc học.',
                'check': {'status': 'PARTIALLY_SUPPORTED', 'matches': []},
              },
            ],
          },
        ],
        'comparisons': [],
      };
    addTearDown(w.dispose);
    final screens = <String, Widget>{
      'topic': TopicTab(work: w),
      'sources': SourcesTab(work: w),
      'evidence': EvidenceTab(work: w),
      'essay': EssayTab(work: w),
    };
    for (final entry in screens.entries) {
      await tester.pumpWidget(frame(Scaffold(body: entry.value)));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull, reason: entry.key);
      await screenshot(tester, entry.key);
    }
    await tester.pumpWidget(
      frame(
        HomeScreen(
          api: api(),
          user: {'email': 'test@example.com'},
          onLogout: () {},
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });
  testWidgets('topic editor prevents silently losing unsaved edits', (
    tester,
  ) async {
    await tester.pumpWidget(
      frame(
        Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => const TopicEditor(
                    contextData: {
                      'title': 'Original topic',
                      'team_size': 1,
                      'output_language': 'vi',
                    },
                  ),
                ),
              ),
              child: const Text('Open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byType(TextFormField).first,
      'Updated research topic',
    );
    await tester.pump();
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(find.text('Bỏ thay đổi chưa lưu?'), findsOneWidget);
    await tester.tap(find.text('Hủy'));
    await tester.pumpAndSettle();
    expect(find.text('Updated research topic'), findsOneWidget);
  });
}
