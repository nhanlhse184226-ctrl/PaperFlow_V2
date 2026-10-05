import 'package:flutter/material.dart';

import '../data/api.dart';
import '../data/workspace.dart';
import '../ui/design.dart';

class TopicTab extends StatefulWidget {
  const TopicTab({super.key, required this.work});
  final Workspace work;
  @override
  State<TopicTab> createState() => _TopicTabState();
}

class _TopicTabState extends State<TopicTab> {
  Json? translated;
  dynamic original;
  Future<void> edit() async {
    await Navigator.of(context).push<Json>(
      MaterialPageRoute(
        builder: (_) => TopicEditor(
          contextData: object(widget.work.project!['context']),
          save: (data) async {
            final ok = await widget.work.run(
              'Đang lưu đề tài…',
              () => widget.work.api.request(
                '${widget.work.base}/topic',
                method: 'PUT',
                data: data,
              ),
            );
            if (!ok)
              throw widget.work.error ??
                  ApiFailure('Dự án đang xử lý. Thử lưu lại sau.');
          },
          invalidates: widget.work.project!['analysis'] != null,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.work, p = w.project!, c = object(p['context']);
    if (original != p['analysis']) {
      original = p['analysis'];
      translated = null;
    }
    final a = translated ?? object(p['analysis']);
    return PageBody(
      children: [
        const ResearchArt(height: 150),
        Text(
          'Tìm một hướng đi rõ ràng.',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 16),
        Panel(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                textOf(c, 'title'),
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 10),
              if (textOf(c, 'description').isNotEmpty)
                Text(textOf(c, 'description')),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  Chip(
                    avatar: const Icon(Icons.group_outlined, size: 18),
                    label: Text('${c['team_size']} thành viên'),
                  ),
                  if (textOf(c, 'timeline').isNotEmpty)
                    Chip(
                      avatar: const Icon(Icons.schedule, size: 18),
                      label: Text(textOf(c, 'timeline')),
                    ),
                  if (w.confirmed) const StatusPill('ready'),
                ],
              ),
              OutlinedButton.icon(
                onPressed: w.locked ? null : edit,
                icon: const Icon(Icons.edit_outlined),
                label: const Text('Thông tin & nguồn lực'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        FilledButton.icon(
          key: const Key('analyze-topic'),
          onPressed: w.locked
              ? null
              : () async {
                  final force = p['analysis'] != null;
                  if (force &&
                      !await confirm(
                        context,
                        'Phân tích lại?',
                        'Thao tác này gọi AI và dùng hạn mức trên máy chủ.',
                      )) {
                    return;
                  }
                  await w.run(
                    'AI đang phân tích đề tài…',
                    () => w.post('/topic/analyze', data: {'force': force}),
                  );
                },
          icon: const Icon(Icons.auto_awesome_outlined),
          label: Text(
            p['analysis'] == null ? 'Phân tích đề tài' : 'Phân tích lại',
          ),
        ),
        if (a.isNotEmpty) ...[
          Section(
            'Góc nhìn từ AI',
            action: TextButton(
              onPressed: w.locked
                  ? null
                  : () async {
                      Json? result;
                      final ok = await w.run('Đang dịch kết quả…', () async {
                        result = object(
                          await w.post(
                            '/topic/translation',
                            data: {'language': 'vi'},
                          ),
                        );
                      });
                      if (ok && mounted) {
                        setState(() {
                          original = w.project!['analysis'];
                          translated = result;
                        });
                      }
                    },
              child: const Text('Tiếng Việt'),
            ),
          ),
          Panel(child: SelectableText(textOf(a, 'summary'))),
          const SizedBox(height: 12),
          ...objects(a['dimensions']).map(
            (d) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Panel(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      labelFor(textOf(d, 'name')),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 8),
                    StatusPill(textOf(d, 'status')),
                    const SizedBox(height: 10),
                    SelectableText(textOf(d, 'explanation')),
                  ],
                ),
              ),
            ),
          ),
          for (final entry in {
            'risks': 'Rủi ro',
            'missing_information': 'Cần bổ sung',
            'directions': 'Hướng phát triển',
            'keywords': 'Từ khóa',
            'next_steps': 'Bước tiếp theo',
          }.entries)
            if (strings(a[entry.key]).isNotEmpty)
              ExpansionTile(
                title: Text(entry.value),
                children: strings(a[entry.key])
                    .map(
                      (s) => ListTile(
                        leading: const Icon(Icons.arrow_right),
                        title: SelectableText(s),
                      ),
                    )
                    .toList(),
              ),
          const SizedBox(height: 20),
          FilledButton.icon(
            key: const Key('confirm-topic'),
            onPressed: w.locked || w.confirmed
                ? null
                : () => w.run('Đang xác nhận…', () => w.post('/topic/confirm')),
            icon: const Icon(Icons.check_circle_outline),
            label: Text(
              w.confirmed ? 'Đề tài đã xác nhận' : 'Xác nhận hướng nghiên cứu',
            ),
          ),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

const contextFields = <String, (String, int)>{
  'title': ('Tên đề tài', 300),
  'description': ('Mô tả ngắn', 5000),
  'problem': ('Vấn đề nghiên cứu', 3000),
  'objectives': ('Mục tiêu', 3000),
  'questions': ('Câu hỏi nghiên cứu', 3000),
  'skills': ('Kỹ năng của nhóm', 2000),
  'timeline': ('Thời gian dự kiến', 1000),
  'sources': ('Tài liệu sẵn có', 2000),
  'datasets': ('Dữ liệu sẵn có', 2000),
  'constraints': ('Giới hạn khác', 3000),
};

class TopicEditor extends StatefulWidget {
  const TopicEditor({
    super.key,
    required this.contextData,
    this.save,
    this.invalidates = false,
  });
  final Json contextData;
  final Future<void> Function(Json)? save;
  final bool invalidates;
  @override
  State<TopicEditor> createState() => _TopicEditorState();
}

class _TopicEditorState extends State<TopicEditor> {
  late final fields = {
    for (final key in contextFields.keys)
      key: TextEditingController(text: textOf(widget.contextData, key)),
  };
  late final team = TextEditingController(
    text: textOf(widget.contextData, 'team_size', '1'),
  );
  final form = GlobalKey<FormState>();
  late String language = textOf(widget.contextData, 'output_language', 'vi');
  bool dirty = false, leaving = false;
  bool saving = false;
  Object? error;
  Future<void> submit() async {
    if (saving || !form.currentState!.validate()) return;
    if (widget.invalidates &&
        !await confirm(
          context,
          'Cập nhật đề tài?',
          'Thay đổi sẽ bỏ xác nhận và làm các đánh giá phụ thuộc cần kiểm tra lại trên cả web và app.',
        ))
      return;
    if (!mounted) return;
    final data = <String, dynamic>{
      for (final e in fields.entries) e.key: e.value.text.trim(),
      'team_size': int.parse(team.text),
      'output_language': language,
    };
    setState(() {
      saving = true;
      error = null;
    });
    try {
      await widget.save?.call(data);
      if (mounted) finish(data);
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  void dispose() {
    for (final f in fields.values) {
      f.dispose();
    }
    team.dispose();
    super.dispose();
  }

  void finish(Json? value) {
    setState(() => leaving = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.pop(context, value);
    });
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: (!dirty && !saving) || leaving,
    onPopInvokedWithResult: (didPop, result) async {
      if (!didPop &&
          !saving &&
          await confirm(
            context,
            'Bỏ thay đổi chưa lưu?',
            'Thông tin bạn vừa nhập chưa được lưu.',
          )) {
        finish(null);
      }
    },
    child: Scaffold(
      appBar: AppBar(title: const Text('Thông tin đề tài')),
      body: SafeArea(
        child: Form(
          key: form,
          onChanged: () {
            if (!dirty) setState(() => dirty = true);
          },
          child: PageBody(
            children: [
              const Text(
                'Thông tin cụ thể giúp AI đánh giá sát hơn.',
                style: TextStyle(color: muted),
              ),
              const SizedBox(height: 20),
              for (final entry in contextFields.entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: TextFormField(
                    enabled: !saving,
                    controller: fields[entry.key],
                    maxLength: entry.value.$2,
                    minLines: 1,
                    maxLines: entry.key == 'title' ? 2 : 5,
                    decoration: InputDecoration(labelText: entry.value.$1),
                    validator: entry.key == 'title'
                        ? (v) => (v ?? '').trim().length < 3
                              ? 'Nhập ít nhất 3 ký tự'
                              : null
                        : null,
                  ),
                ),
              TextFormField(
                enabled: !saving,
                controller: team,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(labelText: 'Số thành viên'),
                validator: (v) {
                  final n = int.tryParse(v ?? '');
                  return n == null || n < 1 || n > 100
                      ? 'Nhập số từ 1 đến 100'
                      : null;
                },
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: language,
                decoration: const InputDecoration(
                  labelText: 'Ngôn ngữ phân tích đề tài',
                ),
                items: const [
                  DropdownMenuItem(value: 'vi', child: Text('Tiếng Việt')),
                  DropdownMenuItem(value: 'en', child: Text('English')),
                ],
                onChanged: saving
                    ? null
                    : (v) => setState(() {
                        language = v!;
                        dirty = true;
                      }),
              ),
              const SizedBox(height: 24),
              if (error != null) ErrorNotice(error!),
              if (saving) const Working('Đang lưu thông tin…'),
              FilledButton(
                onPressed: saving ? null : submit,
                child: const Text('Lưu thông tin'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
