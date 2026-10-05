import 'dart:math' as math;

import 'package:flutter/material.dart';

const ink = Color(0xFF173E36);
const teal = Color(0xFF205D50);
const paper = Color(0xFFF6F7F2);
const mint = Color(0xFFE0EEE4);
const gold = Color(0xFFF1D598);
const muted = Color(0xFF53645F);

ThemeData paperTheme() {
  final scheme =
      ColorScheme.fromSeed(
        seedColor: teal,
        brightness: Brightness.light,
      ).copyWith(
        primary: teal,
        onPrimary: Colors.white,
        surface: paper,
        secondary: const Color(0xFF8B5D16),
      );
  return ThemeData(
    fontFamily: 'PaperFlowSans',
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: paper,
    textTheme: const TextTheme(
      displaySmall: TextStyle(
        fontSize: 34,
        fontWeight: FontWeight.w800,
        height: 1.2,
        color: ink,
      ),
      headlineMedium: TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w800,
        color: ink,
      ),
      titleLarge: TextStyle(
        fontSize: 21,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: ink,
      ),
      bodyLarge: TextStyle(fontSize: 16, height: 1.5, color: ink),
      bodyMedium: TextStyle(fontSize: 14, height: 1.5, color: ink),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: paper,
      foregroundColor: ink,
      centerTitle: false,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      contentPadding: const EdgeInsets.all(18),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFCAD7CF)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0xFFCAD7CF)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 52),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(24),
        side: const BorderSide(color: Color(0xFFE1E6DF)),
      ),
    ),
    dividerTheme: const DividerThemeData(color: Color(0xFFE1E6DF)),
  );
}

class PageBody extends StatelessWidget {
  const PageBody({super.key, required this.children, this.padding = 24});
  final List<Widget> children;
  final double padding;
  @override
  Widget build(BuildContext context) => Center(
    child: ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 860),
      child: ListView(padding: EdgeInsets.all(padding), children: children),
    ),
  );
}

class Panel extends StatelessWidget {
  const Panel({super.key, required this.child, this.color});
  final Widget child;
  final Color? color;
  @override
  Widget build(BuildContext context) => Card(
    color: color,
    child: Padding(padding: const EdgeInsets.all(20), child: child),
  );
}

class Section extends StatelessWidget {
  const Section(this.title, {super.key, this.action});
  final String title;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 24, bottom: 12),
    child: Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        ?action,
      ],
    ),
  );
}

class ErrorNotice extends StatelessWidget {
  const ErrorNotice(this.error, {super.key, this.retry});
  final Object error;
  final VoidCallback? retry;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 12),
    child: Panel(
      color: const Color(0xFFFFEDE8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, color: Color(0xFF943423)),
          const SizedBox(height: 8),
          Text('$error', style: const TextStyle(color: Color(0xFF702C20))),
          if (retry != null)
            TextButton.icon(
              onPressed: retry,
              icon: const Icon(Icons.refresh),
              label: const Text('Thử lại'),
            ),
        ],
      ),
    ),
  );
}

class EmptyView extends StatelessWidget {
  const EmptyView(this.title, this.subtitle, {super.key, this.action});
  final String title, subtitle;
  final Widget? action;
  @override
  Widget build(BuildContext context) => Column(
    children: [
      const SizedBox(height: 12),
      const ResearchArt(height: 156),
      Text(
        title,
        textAlign: TextAlign.center,
        style: Theme.of(context).textTheme.titleLarge,
      ),
      const SizedBox(height: 8),
      Text(
        subtitle,
        textAlign: TextAlign.center,
        style: const TextStyle(color: muted),
      ),
      const SizedBox(height: 18),
      ?action,
    ],
  );
}

class ResearchArt extends StatelessWidget {
  const ResearchArt({super.key, this.height = 220});
  final double height;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(painter: _ResearchPainter()),
    ),
  );
}

class _ResearchPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    final scale = math.min(size.width / 350, size.height / 220);
    canvas.translate(
      (size.width - 350 * scale) / 2,
      (size.height - 220 * scale) / 2,
    );
    canvas.scale(scale);
    final fill = Paint();
    canvas.drawOval(const Rect.fromLTWH(43, 17, 265, 186), fill..color = mint);
    canvas.drawCircle(const Offset(282, 49), 22, fill..color = gold);
    canvas.save();
    canvas.translate(106, 47);
    canvas.rotate(-.13);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(0, 0, 126, 152),
        const Radius.circular(12),
      ),
      fill..color = const Color(0xFFACC9BA),
    );
    canvas.restore();
    canvas.save();
    canvas.translate(115, 28);
    canvas.rotate(.09);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(0, 0, 126, 158),
        const Radius.circular(12),
      ),
      fill..color = Colors.white,
    );
    for (var i = 0; i < 4; i++) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(20, 28 + i * 17, i == 0 ? 58 : 84, 6),
          const Radius.circular(3),
        ),
        fill..color = i == 0 ? teal : mint,
      );
    }
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        const Rect.fromLTWH(20, 111, 83, 25),
        const Radius.circular(6),
      ),
      fill..color = gold,
    );
    canvas.restore();
    canvas.drawLine(
      const Offset(238, 145),
      const Offset(269, 178),
      Paint()
        ..color = ink
        ..strokeWidth = 11
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(const Offset(223, 125), 30, fill..color = teal);
    canvas.drawCircle(
      const Offset(223, 125),
      21,
      fill..color = const Color(0xFFF0F8F1),
    );
    final path = Path()
      ..moveTo(214, 125)
      ..lineTo(221, 132)
      ..lineTo(233, 118);
    canvas.drawPath(
      path,
      Paint()
        ..color = teal
        ..strokeWidth = 4
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round,
    );
    canvas.drawCircle(const Offset(69, 143), 13, fill..color = gold);
    canvas.drawCircle(const Offset(80, 58), 5, fill..color = teal);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class Working extends StatefulWidget {
  const Working(this.label, {super.key, this.progress});
  final String label;
  final double? progress;
  @override
  State<Working> createState() => _WorkingState();
}

class _WorkingState extends State<Working> with SingleTickerProviderStateMixin {
  late final AnimationController controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      controller.stop();
    } else {
      controller.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    label: widget.label,
    child: Panel(
      color: mint,
      child: Column(
        children: [
          FadeTransition(
            opacity: Tween(begin: .45, end: 1.0).animate(controller),
            child: const Icon(
              Icons.auto_awesome_rounded,
              size: 32,
              color: teal,
            ),
          ),
          const SizedBox(height: 10),
          Text(widget.label, textAlign: TextAlign.center),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value:
                MediaQuery.disableAnimationsOf(context) &&
                    widget.progress == null
                ? .5
                : widget.progress,
          ),
          const SizedBox(height: 8),
          const Text(
            'Kết quả sẽ được lưu trên máy chủ.',
            style: TextStyle(fontSize: 12, color: muted),
          ),
        ],
      ),
    ),
  );
}

Future<bool> confirm(
  BuildContext context,
  String title,
  String content,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: Text(content),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Hủy'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Tiếp tục'),
          ),
        ],
      ),
    ) ??
    false;

Future<String?> inputDialog(
  BuildContext context,
  String title, {
  String value = '',
  int min = 3,
  int max = 200,
}) async {
  final controller = TextEditingController(text: value);
  final form = GlobalKey<FormState>();
  final result = await showDialog<String>(
    context: context,
    builder: (c) => AlertDialog(
      title: Text(title),
      content: Form(
        key: form,
        child: TextFormField(
          controller: controller,
          autofocus: true,
          maxLength: max,
          decoration: const InputDecoration(labelText: 'Tên dự án'),
          validator: (v) =>
              (v ?? '').trim().length < min ? 'Nhập ít nhất $min ký tự' : null,
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(c), child: const Text('Hủy')),
        FilledButton(
          onPressed: () {
            if (form.currentState!.validate()) {
              Navigator.pop(c, controller.text.trim());
            }
          },
          child: const Text('Lưu'),
        ),
      ],
    ),
  );
  // The route may still be animating after its result completes.
  await Future<void>.delayed(const Duration(milliseconds: 300));
  controller.dispose();
  return result;
}

String labelFor(String value) =>
    const {
      'clarity': 'Độ rõ ràng',
      'scope': 'Phạm vi',
      'feasibility': 'Tính khả thi',
      'researchability': 'Khả năng nghiên cứu',
      'source readiness': 'Sẵn sàng tài liệu',
      'data readiness': 'Sẵn sàng dữ liệu',
      'ready': 'Sẵn sàng',
      'unknown': 'Chưa rõ',
      'needs attention': 'Cần chú ý',
      'problem': 'Vấn đề',
      'objective': 'Mục tiêu',
      'method': 'Phương pháp',
      'sample': 'Mẫu nghiên cứu',
      'finding': 'Kết quả',
      'findings': 'Kết quả',
      'limitation': 'Hạn chế',
      'gap': 'Khoảng trống',
      'SUPPORTED': 'Có hỗ trợ',
      'PARTIALLY_SUPPORTED': 'Hỗ trợ một phần',
      'CONTRADICTED': 'Mâu thuẫn',
      'UNSUPPORTED': 'Không được hỗ trợ',
      'INSUFFICIENT_EVIDENCE': 'Chưa đủ bằng chứng',
      'agreement': 'Đồng thuận',
      'partial agreement': 'Đồng thuận một phần',
      'contradiction': 'Mâu thuẫn',
      'insufficient evidence': 'Chưa đủ bằng chứng',
      'supporting': 'Hỗ trợ',
      'partial': 'Một phần',
      'contradictory': 'Đối lập',
      'context': 'Bối cảnh',
      'extracted': 'Đã trích xuất',
      'failed': 'Cần thử lại',
      'saved': 'Đã lưu',
      'checked': 'Đã kiểm tra',
      'title': 'Tiêu đề',
      'authors': 'Tác giả',
      'year': 'Năm',
      'publication': 'Nơi xuất bản',
      'doi': 'DOI',
      'limitations': 'Hạn chế',
    }[value] ??
    value;

class StatusPill extends StatelessWidget {
  const StatusPill(this.value, {super.key});
  final String value;
  @override
  Widget build(BuildContext context) {
    final positive = [
      'ready',
      'SUPPORTED',
      'checked',
      'agreement',
    ].contains(value);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: positive ? mint : const Color(0xFFFFF1D5),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        labelFor(value),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: positive ? ink : const Color(0xFF77501A),
        ),
      ),
    );
  }
}
