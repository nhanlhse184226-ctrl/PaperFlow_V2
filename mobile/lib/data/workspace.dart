import 'dart:async';

import 'package:flutter/foundation.dart';

import 'api.dart';

class Workspace extends ChangeNotifier {
  Workspace(this.api, this.id);
  final PaperApi api;
  final String id;
  Json? project;
  Object? error;
  bool busy = false, disposed = false;
  String label = '';
  double? progress;
  String get base => '/projects/$id';
  List<Json> get sources => objects(project?['sources']);
  List<Json> get evidence =>
      sources.expand((s) => objects(s['evidence'])).toList();
  bool get confirmed => project?['confirmed'] == true;
  bool get locked => busy || project?['operation'] != null;
  Timer? timer;
  bool fetching = false;
  @override
  void dispose() {
    disposed = true;
    timer?.cancel();
    super.dispose();
  }

  void emit() {
    if (!disposed) notifyListeners();
  }

  Future<void> load({bool clearError = true}) async {
    if (fetching || disposed) return;
    fetching = true;
    try {
      final data = await api.project(id);
      if (!disposed) {
        project = data;
        if (clearError) error = null;
      }
      timer?.cancel();
      if (!disposed && project?['operation'] != null) {
        timer = Timer(
          const Duration(seconds: 5),
          () => load(clearError: false),
        );
      }
    } catch (e) {
      if (error == null || clearError) error = e;
    } finally {
      fetching = false;
      emit();
    }
  }

  Future<bool> run(String message, Future<dynamic> Function() action) async {
    if (locked || disposed) return false;
    busy = true;
    label = message;
    progress = null;
    error = null;
    emit();
    var success = false;
    try {
      await action();
      success = true;
    } catch (e) {
      error = e;
    } finally {
      // Recover persisted partial results even if the provider timed out.
      await load(clearError: false);
      busy = false;
      progress = null;
      emit();
    }
    return success;
  }

  Future<dynamic> post(String path, {Json data = const {}}) =>
      api.request('$base$path', method: 'POST', data: data);
}
