import 'package:flutter/material.dart';

import '../data/api.dart';
import '../ui/design.dart';

class HubScreen extends StatefulWidget {
  const HubScreen({super.key, required this.api});
  final PaperApi api;
  @override
  State<HubScreen> createState() => _HubScreenState();
}

class _HubScreenState extends State<HubScreen> {
  List<Json> notes = [];
  final search = TextEditingController(),
      topic = TextEditingController(),
      note = TextEditingController();
  final form = GlobalKey<FormState>();
  bool loading = true, busy = false;
  Object? error;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    topic.dispose();
    note.dispose();
    super.dispose();
  }

  Future<void> load() async {
    final version = ++generation;
    try {
      final n = objects(
        await widget.api.request(
          '/hub?q=${Uri.encodeQueryComponent(search.text)}',
        ),
      );
      if (mounted && version == generation) {
        setState(() {
          notes = n;
          error = null;
        });
      }
    } catch (e) {
      if (mounted && version == generation) setState(() => error = e);
    } finally {
      if (mounted && version == generation) setState(() => loading = false);
    }
  }

  Future<void> publish() async {
    if (!form.currentState!.validate()) return;
    if (!await confirm(
      context,
      'Đăng ghi chú công khai?',
      'Người dùng PaperFlow khác sẽ đọc được đề tài và ghi chú này. Không đăng dữ liệu riêng tư.',
    )) {
      return;
    }
    if (!mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.request(
        '/hub',
        method: 'POST',
        data: {'topic': topic.text, 'note': note.text},
      );
      topic.clear();
      note.clear();
      await load();
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => RefreshIndicator(
    onRefresh: load,
    child: PageBody(
      children: [
        Text(
          'Cùng nhau tìm\nhướng nghiên cứu.',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const ResearchArt(height: 130),
        const Text(
          'Kinh nghiệm cộng đồng, không phải bằng chứng học thuật đã xác minh.',
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 18),
        TextField(
          controller: search,
          onSubmitted: (_) => load(),
          decoration: InputDecoration(
            labelText: 'Tìm đề tài',
            suffixIcon: IconButton(
              onPressed: load,
              tooltip: 'Tìm kiếm',
              icon: const Icon(Icons.search),
            ),
          ),
        ),
        const Section('Chia sẻ một ghi chú'),
        Panel(
          child: Form(
            key: form,
            child: Column(
              children: [
                TextFormField(
                  controller: topic,
                  maxLength: 300,
                  decoration: const InputDecoration(labelText: 'Đề tài'),
                  validator: (v) => (v ?? '').trim().length < 3
                      ? 'Nhập ít nhất 3 ký tự'
                      : null,
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: note,
                  minLines: 2,
                  maxLines: 5,
                  maxLength: 3000,
                  decoration: const InputDecoration(
                    labelText: 'Kinh nghiệm, từ khóa hoặc nguồn dữ liệu',
                  ),
                  validator: (v) => (v ?? '').trim().length < 10
                      ? 'Nhập ít nhất 10 ký tự'
                      : null,
                ),
                FilledButton.icon(
                  onPressed: busy ? null : publish,
                  icon: const Icon(Icons.send_outlined),
                  label: const Text('Đăng ghi chú'),
                ),
              ],
            ),
          ),
        ),
        if (loading || busy) const Working('Đang đồng bộ ghi chú…'),
        if (error != null) ErrorNotice(error!, retry: load),
        const Section('Ghi chú cộng đồng'),
        if (!loading && notes.isEmpty)
          const EmptyView(
            'Chưa có ghi chú phù hợp',
            'Bạn có thể chia sẻ kinh nghiệm đầu tiên.',
          ),
        ...notes.map(
          (n) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    textOf(n, 'topic'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  SelectableText(textOf(n, 'note')),
                  const SizedBox(height: 8),
                  Text(
                    textOf(n, 'created_at').split('T').first,
                    style: const TextStyle(fontSize: 12, color: muted),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    ),
  );
}
