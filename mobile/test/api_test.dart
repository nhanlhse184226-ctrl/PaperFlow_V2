import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:paperflow_mobile/data/api.dart';

class MemoryStore implements SessionStore {
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

class ReplyAdapter implements HttpClientAdapter {
  ReplyAdapter(this.reply);
  final ResponseBody Function(RequestOptions) reply;
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async => reply(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody jsonReply(
  dynamic body, {
  int status = 200,
  Map<String, List<String>> headers = const {},
}) => ResponseBody.fromString(
  jsonEncode(body),
  status,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
    ...headers,
  },
);

void main() {
  test(
    'native login persists cookie, verifies session, restores and logs out',
    () async {
      final storage = MemoryStore();
      final dio = Dio()
        ..httpClientAdapter = ReplyAdapter((o) {
          if (o.path == '/auth/login') {
            expect(o.data['email'], 'member@example.com');
            return jsonReply(
              {'email': 'member@example.com'},
              headers: {
                'set-cookie': [
                  'paperflow_session=test-session; Max-Age=604800; Path=/; Secure; HttpOnly; SameSite=None',
                ],
              },
            );
          }
          expect(o.headers['cookie'], 'paperflow_session=test-session');
          return jsonReply({'id': 'user', 'email': 'member@example.com'});
        });
      final api = PaperApi(store: storage, client: dio);
      final user = await api.signIn(' member@example.com ', 'example-password');
      expect(user['id'], 'user');
      expect(jsonDecode(storage.value!)['token'], 'test-session');
      final second = PaperApi(store: storage, client: dio);
      await second.restore();
      await second.request('/auth/me');
      await second.signOut();
      expect(storage.value, isNull);
    },
  );
  test('401 invalidates persisted session but 503 preserves it', () async {
    final storage = MemoryStore()
      ..value = jsonEncode({
        'token': 'session',
        'expires': DateTime.now()
            .add(const Duration(days: 1))
            .toIso8601String(),
      });
    var status = 503;
    final dio = Dio()
      ..httpClientAdapter = ReplyAdapter(
        (_) => jsonReply({'message': 'Unavailable'}, status: status),
      );
    final api = PaperApi(store: storage, client: dio);
    var expired = false;
    api.onExpired = () => expired = true;
    await api.restore();
    await expectLater(api.request('/projects'), throwsA(isA<ApiFailure>()));
    expect(storage.value, isNotNull);
    expect(expired, isFalse);
    status = 401;
    await expectLater(api.request('/projects'), throwsA(isA<ApiFailure>()));
    expect(storage.value, isNull);
    expect(expired, isTrue);
  });
  test('expired local sessions are never sent', () async {
    final storage = MemoryStore()
      ..value = jsonEncode({'token': 'old', 'expires': '2000-01-01T00:00:00Z'});
    final api = PaperApi(
      store: storage,
      client: Dio()
        ..httpClientAdapter = ReplyAdapter((o) {
          expect(o.headers.containsKey('cookie'), isFalse);
          return jsonReply([]);
        }),
    );
    await api.restore();
    await api.projects();
    expect(storage.value, isNull);
  });
  test('CSV retains quote/page and neutralizes spreadsheet formulas', () {
    final csv = evidenceCsv([
      {
        'filename': '=EXEC()',
        'evidence': [
          {
            'kind': 'finding',
            'content': 'x,"y"',
            'page': 3,
            'quote': 'original',
            'id': 'e1',
          },
        ],
      },
    ]);
    expect(csv, contains("'=EXEC()"));
    expect(csv, contains('"x,""y"""'));
    expect(csv, contains('"3","original","e1"'));
  });
}
