import 'package:flutter/material.dart';

import 'data/api.dart';
import 'screens/auth.dart';
import 'screens/home.dart';
import 'ui/design.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(PaperFlowApp(api: PaperApi()));
}

class PaperFlowApp extends StatefulWidget {
  const PaperFlowApp({super.key, required this.api});
  final PaperApi api;
  @override
  State<PaperFlowApp> createState() => _PaperFlowAppState();
}

class _PaperFlowAppState extends State<PaperFlowApp> {
  final navigator = GlobalKey<NavigatorState>();
  Json? user;
  bool loading = true;
  Object? error;
  @override
  void initState() {
    super.initState();
    widget.api.onExpired = () {
      if (!mounted) return;
      navigator.currentState?.popUntil((r) => r.isFirst);
      setState(() {
        user = null;
      });
    };
    restore();
  }

  @override
  void dispose() {
    widget.api.onExpired = null;
    super.dispose();
  }

  Future<void> restore() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await widget.api.restore();
      if (!widget.api.hasSession) return;
      final current = object(await widget.api.request('/auth/me'));
      if (mounted) setState(() => user = current);
    } catch (e) {
      if (mounted && !(e is ApiFailure && e.status == 401)) {
        setState(() => error = e);
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
    navigatorKey: navigator,
    title: 'PaperFlow',
    debugShowCheckedModeBanner: false,
    theme: paperTheme(),
    home: loading
        ? const Scaffold(
            body: SafeArea(
              child: PageBody(
                children: [
                  ResearchArt(),
                  Working('Đang mở không gian nghiên cứu…'),
                ],
              ),
            ),
          )
        : error != null
        ? Scaffold(
            body: SafeArea(
              child: PageBody(
                children: [
                  const ResearchArt(),
                  ErrorNotice(error!, retry: restore),
                ],
              ),
            ),
          )
        : user == null
        ? AuthScreen(api: widget.api, onLogin: (u) => setState(() => user = u))
        : HomeScreen(
            api: widget.api,
            user: user!,
            onLogout: () => setState(() => user = null),
          ),
  );
}
