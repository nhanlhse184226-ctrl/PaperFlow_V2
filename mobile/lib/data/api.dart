import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

typedef Json = Map<String, dynamic>;
Json object(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : {};
List<Json> objects(dynamic value) =>
    value is List ? value.map(object).toList() : [];
List<String> strings(dynamic value) =>
    value is List ? value.map((e) => '$e').toList() : [];
String textOf(Json value, String key, [String fallback = '']) =>
    value[key]?.toString() ?? fallback;

abstract class SessionStore {
  Future<String?> read();
  Future<void> write(String value);
  Future<void> clear();
}

class SecureSessionStore implements SessionStore {
  SecureSessionStore(String origin)
    : key = 'paperflow.session.${Uri.encodeComponent(origin)}';
  final String key;
  final storage = const FlutterSecureStorage();
  @override
  Future<String?> read() => storage.read(key: key);
  @override
  Future<void> write(String value) => storage.write(key: key, value: value);
  @override
  Future<void> clear() => storage.delete(key: key);
}

class ApiFailure implements Exception {
  ApiFailure(this.message, [this.status]);
  final String message;
  final int? status;
  @override
  String toString() => message;
}

/// Native clients explicitly retain the existing HttpOnly session in OS secure
/// storage. No new auth endpoint, bearer token or backend behavior is required.
class PaperApi {
  PaperApi({String? baseUrl, SessionStore? store, Dio? client}) {
    origin =
        (baseUrl ??
                const String.fromEnvironment(
                  'API_BASE_URL',
                  defaultValue: 'https://paperflow-api.onrender.com',
                ))
            .replaceAll(RegExp(r'/+$'), '');
    final uri = Uri.parse(origin);
    if (!uri.hasAuthority ||
        uri.userInfo.isNotEmpty ||
        uri.path.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        !['https', 'http'].contains(uri.scheme)) {
      throw ArgumentError(
        'API_BASE_URL must be an origin without /api, credentials or query.',
      );
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw ArgumentError('Release builds require HTTPS.');
    }
    sessions = store ?? SecureSessionStore(origin);
    dio = client ?? Dio();
    dio.options = BaseOptions(
      baseUrl: '$origin/api',
      connectTimeout: const Duration(seconds: 90),
      receiveTimeout: const Duration(minutes: 20),
      sendTimeout: const Duration(minutes: 2),
      followRedirects: false,
    );
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (_token != null) {
            options.headers[HttpHeaders.cookieHeader] =
                'paperflow_session=$_token';
          }
          handler.next(options);
        },
        onError: (error, handler) async {
          if (error.response?.statusCode == 401 &&
              !error.requestOptions.path.startsWith('/auth/login')) {
            await forget();
            onExpired?.call();
          }
          handler.next(error);
        },
      ),
    );
  }
  late final String origin;
  late final SessionStore sessions;
  late final Dio dio;
  String? _token;
  bool get hasSession => _token != null;
  VoidCallback? onExpired;

  Future<void> restore() async {
    final saved = await sessions.read();
    if (saved == null) return;
    try {
      final data = object(jsonDecode(saved));
      if (DateTime.parse(data['expires']).isAfter(DateTime.now())) {
        _token = data['token'];
      } else {
        await forget();
      }
    } catch (_) {
      await forget();
    }
  }

  Future<void> forget() async {
    _token = null;
    await sessions.clear();
  }

  ApiFailure failure(DioException e) {
    final data = e.response?.data;
    if (data is Map && data['message'] is String) {
      return ApiFailure(data['message'], e.response?.statusCode);
    }
    if (e.type == DioExceptionType.receiveTimeout ||
        e.type == DioExceptionType.sendTimeout) {
      return ApiFailure(
        'Yêu cầu quá lâu. Máy chủ có thể vẫn đang xử lý. Làm mới để kiểm tra trước khi thử lại.',
      );
    }
    return ApiFailure('Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');
  }

  Future<dynamic> request(
    String path, {
    String method = 'GET',
    dynamic data,
  }) async {
    try {
      return (await dio.request(
        path,
        data: data,
        options: Options(method: method),
      )).data;
    } on DioException catch (e) {
      throw failure(e);
    }
  }

  Future<Json> signIn(
    String email,
    String password, {
    bool register = false,
  }) async {
    try {
      final response = await dio.post(
        '/auth/${register ? 'register' : 'login'}',
        data: {'email': email.trim(), 'password': password},
      );
      await _persistSession(response);
      // Validate the actual session before opening the workspace.
      return object(await request('/auth/me'));
    } on DioException catch (e) {
      throw failure(e);
    }
  }

  Future<Json> googleConfig() async =>
      object(await request('/auth/google/config'));

  Future<Json> signInWithGoogle(String credential) async {
    try {
      final response = await dio.post(
        '/auth/google',
        data: {'credential': credential},
      );
      await _persistSession(response);
      return object(await request('/auth/me'));
    } on DioException catch (e) {
      throw failure(e);
    }
  }

  Future<void> _persistSession(Response<dynamic> response) async {
    Cookie? session;
    for (final value
        in response.headers[HttpHeaders.setCookieHeader] ?? <String>[]) {
      final cookie = Cookie.fromSetCookieValue(value);
      if (cookie.name == 'paperflow_session') session = cookie;
    }
    if (session == null || session.value.isEmpty) {
      throw ApiFailure('Máy chủ không trả phiên đăng nhập. Vui lòng thử lại.');
    }
    _token = session.value;
    final expiry =
        session.expires ??
        DateTime.now().add(Duration(seconds: session.maxAge ?? 604800));
    await sessions.write(
      jsonEncode({
        'token': _token,
        'expires': expiry.toUtc().toIso8601String(),
      }),
    );
  }

  Future<void> signOut() async {
    await request('/auth/logout', method: 'POST');
    await forget();
  }

  Future<List<Json>> projects() async => objects(await request('/projects'));
  Future<Json> project(String id) async =>
      object(await request('/projects/$id'));
  Future<dynamic> upload(
    String path,
    String name,
    Uint8List bytes, {
    ProgressCallback? progress,
  }) async {
    if (bytes.length > 20 * 1024 * 1024) {
      throw ApiFailure('Tệp phải nhỏ hơn hoặc bằng 20 MB.');
    }
    try {
      return (await dio.post(
        path,
        data: FormData.fromMap({
          'file': MultipartFile.fromBytes(bytes, filename: name),
        }),
        onSendProgress: progress,
      )).data;
    } on DioException catch (e) {
      throw failure(e);
    }
  }

  Future<Uint8List> pdf(String projectId, String sourceId) async {
    try {
      final r = await dio.get<List<int>>(
        '/projects/$projectId/sources/$sourceId/file',
        options: Options(responseType: ResponseType.bytes),
      );
      return Uint8List.fromList(r.data!);
    } on DioException catch (e) {
      throw failure(e);
    }
  }
}

String evidenceCsv(List<Json> sources) {
  String escape(dynamic value) {
    var cell = value?.toString() ?? '';
    if (RegExp(r'^\s*[=+@\-\t\r]').hasMatch(cell)) cell = "'$cell";
    return '"${cell.replaceAll('"', '""')}"';
  }

  final rows = <List<dynamic>>[
    ['Tài liệu', 'Loại', 'Nội dung', 'Trang', 'Trích dẫn', 'Mã bằng chứng'],
  ];
  for (final source in sources) {
    for (final e in objects(source['evidence'])) {
      rows.add([
        source['filename'],
        e['kind'],
        e['content'],
        e['page'],
        e['quote'],
        e['id'],
      ]);
    }
  }
  return '\uFEFF${rows.map((row) => row.map(escape).join(',')).join('\r\n')}';
}
