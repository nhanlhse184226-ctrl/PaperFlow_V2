import 'package:flutter/material.dart';

/// App-chrome language only. Source quotations and saved AI output retain the
/// wording returned by the API so provenance is never altered on-device.
class AppLanguage extends ChangeNotifier {
  AppLanguage([this.code = 'vi']);
  String code;
  bool get isVietnamese => code == 'vi';

  void select(String next) {
    if (next == code) return;
    code = next;
    notifyListeners();
  }
}

class LanguageScope extends InheritedNotifier<AppLanguage> {
  const LanguageScope({
    super.key,
    required AppLanguage controller,
    required super.child,
  }) : super(notifier: controller);

  static final _fallback = AppLanguage();

  static AppLanguage? maybeOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<LanguageScope>()?.notifier;

  static AppLanguage of(BuildContext context) {
    return maybeOf(context) ?? _fallback;
  }
}

String tr(BuildContext context, String vietnamese, String english) =>
    LanguageScope.of(context).isVietnamese ? vietnamese : english;

class LanguageToggle extends StatelessWidget {
  const LanguageToggle({super.key});

  @override
  Widget build(BuildContext context) {
    final language = LanguageScope.maybeOf(context);
    if (language == null) return const SizedBox.shrink();
    return Semantics(
      label: tr(context, 'Đổi ngôn ngữ ứng dụng', 'Change app language'),
      child: Padding(
        padding: const EdgeInsets.only(right: 8),
        child: SegmentedButton<String>(
          segments: const [
            ButtonSegment(value: 'en', label: Text('EN')),
            ButtonSegment(value: 'vi', label: Text('VI')),
          ],
          selected: {language.code},
          showSelectedIcon: false,
          style: ButtonStyle(
            visualDensity: VisualDensity.compact,
            minimumSize: const WidgetStatePropertyAll(Size(44, 40)),
            padding: const WidgetStatePropertyAll(
              EdgeInsets.symmetric(horizontal: 8),
            ),
            textStyle: const WidgetStatePropertyAll(
              TextStyle(fontSize: 12, fontWeight: FontWeight.w800),
            ),
          ),
          onSelectionChanged: (selected) => language.select(selected.first),
        ),
      ),
    );
  }
}
