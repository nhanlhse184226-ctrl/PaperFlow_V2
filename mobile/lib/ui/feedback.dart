import 'package:flutter/material.dart';

import '../data/workspace.dart';
import 'design.dart';

class AiFeedback extends StatefulWidget {
  const AiFeedback({super.key, required this.work, required this.module, required this.resultId});
  final Workspace work;
  final String module, resultId;
  @override
  State<AiFeedback> createState() => _AiFeedbackState();
}

class _AiFeedbackState extends State<AiFeedback> {
  bool sending = false;
  String? sent;
  Future<void> send(bool helpful, [String? reason, String comment = '']) async {
    setState(() => sending = true);
    try {
      await widget.work.api.request('/feedback/ai', method: 'POST', data: {
        'module': widget.module, 'project_id': widget.work.id, 'result_id': widget.resultId,
        'helpful': helpful, 'reason': reason, 'comment': comment,
      });
      if (mounted) setState(() => sent = helpful ? 'Cảm ơn phản hồi của bạn.' : 'Đã gửi phản hồi.');
    } catch (e) { if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'))); }
    finally { if (mounted) setState(() => sending = false); }
  }
  Future<void> negative() async {
    final result = await showModalBottomSheet<(String, String)>(context: context, isScrollControlled: true, builder: (context) => const _NegativeFeedbackSheet());
    if (result != null) await send(false, result.$1, result.$2);
  }
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.only(top: 12),
    child: sent != null ? Text(sent!, style: const TextStyle(color: muted, fontSize: 12)) : Row(children: [
      const Expanded(child: Text('Kết quả này có hữu ích không?', style: TextStyle(fontSize: 12, color: muted))),
      IconButton(tooltip: 'Hữu ích', onPressed: sending ? null : () => send(true), icon: sending ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.thumb_up_outlined)),
      IconButton(tooltip: 'Chưa hữu ích', onPressed: sending ? null : negative, icon: const Icon(Icons.thumb_down_outlined)),
    ]),
  );
}

class _NegativeFeedbackSheet extends StatefulWidget { const _NegativeFeedbackSheet(); @override State<_NegativeFeedbackSheet> createState() => _NegativeFeedbackSheetState(); }
class _NegativeFeedbackSheetState extends State<_NegativeFeedbackSheet> {
  String? reason; final note = TextEditingController();
  @override void dispose() { note.dispose(); super.dispose(); }
  @override Widget build(BuildContext context) => SafeArea(child: Padding(padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + MediaQuery.viewInsetsOf(context).bottom), child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
    Text('Điều gì chưa đúng?', style: Theme.of(context).textTheme.titleLarge), const SizedBox(height: 10),
    Wrap(spacing: 8, runSpacing: 8, children: [for (final item in const [('INCORRECT', 'Không chính xác'), ('MISSING_INFORMATION', 'Thiếu thông tin'), ('CITATION_EVIDENCE', 'Vấn đề trích dẫn / bằng chứng'), ('TOO_VERBOSE', 'Quá dài'), ('OTHER', 'Khác')]) ChoiceChip(label: Text(item.$2), selected: reason == item.$1, onSelected: (_) => setState(() => reason = item.$1))]),
    TextField(controller: note, maxLength: 1000, minLines: 2, maxLines: 4, decoration: const InputDecoration(labelText: 'Ghi chú thêm (không bắt buộc)')),
    const SizedBox(height: 10), SizedBox(width: double.infinity, child: FilledButton(onPressed: reason == null ? null : () => Navigator.pop(context, (reason!, note.text.trim())), child: const Text('Gửi phản hồi'))),
  ])));
}
