import 'package:flutter/material.dart';

import '../data/api.dart';
import '../data/workspace.dart';
import '../ui/design.dart';
import '../ui/feedback.dart';
import 'sources.dart';
import 'evidence.dart';

class EssayTab extends StatefulWidget {
  const EssayTab({super.key, required this.work});
  final Workspace work;
  @override
  State<EssayTab> createState() => _EssayTabState();
}

class _EssayTabState extends State<EssayTab> {
  String? active;
  String filter = 'all';
  Future<void> edit([Json? draft]) async {
    Json? saved;
    final w = widget.work;
    await Navigator.push<Json>(
      context,
      MaterialPageRoute(
        builder: (_) => DraftEditor(
          draft: draft,
          save: (result) async {
            final ok = await w.run('Đang lưu bài viết…', () async {
              saved = object(
                await w.api.request(
                  '${w.base}/drafts${draft == null ? '' : '/${draft['id']}'}',
                  method: draft == null ? 'POST' : 'PUT',
                  data: result,
                ),
              );
            });
            if (!ok)
              throw w.error ?? ApiFailure('Dự án đang xử lý. Thử lưu lại sau.');
          },
        ),
      ),
    );
    if (saved != null && mounted) setState(() => active = saved!['id']);
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.work, drafts = objects(w.project!['drafts']);
    if (drafts.isNotEmpty && !drafts.any((d) => d['id'] == active)) {
      active = drafts.first['id'];
    }
    final current = drafts.where((d) => d['id'] == active);
    final d = current.isEmpty ? null : current.first;
    final claims = objects(d?['claims']);
    return PageBody(
      children: [
        Text(
          'Mỗi luận điểm,\nmột cơ sở.',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        const Text(
          'Đối chiếu bài viết với bằng chứng trong dự án.',
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            FilledButton.icon(
              onPressed: w.locked ? null : () => edit(),
              icon: const Icon(Icons.edit_note),
              label: const Text('Thêm bài viết'),
            ),
            OutlinedButton.icon(
              onPressed: w.locked ? null : () => pickUpload(w, draft: true),
              icon: const Icon(Icons.upload_file),
              label: const Text('PDF / TXT / MD'),
            ),
          ],
        ),
        if (d == null)
          const EmptyView(
            'Bài viết của bạn bắt đầu ở đây',
            'Dán nội dung hoặc tải tệp để tìm luận điểm cần bằng chứng.',
          ),
        if (d != null) ...[
          const SizedBox(height: 20),
          DropdownButtonFormField<String>(
            key: ValueKey(active),
            initialValue: active,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Bài viết đã lưu'),
            items: drafts
                .map(
                  (d) => DropdownMenuItem(
                    value: textOf(d, 'id'),
                    child: Text(
                      textOf(d, 'title'),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() {
              active = value;
              filter = 'all';
            }),
          ),
          const SizedBox(height: 16),
          Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                StatusPill(textOf(d, 'status')),
                const SizedBox(height: 10),
                Text(
                  textOf(d, 'text'),
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                ),
                TextButton.icon(
                  onPressed: w.locked ? null : () => edit(d),
                  icon: const Icon(Icons.edit_outlined),
                  label: const Text('Xem & chỉnh sửa'),
                ),
              ],
            ),
          ),
          if (d['error'] != null) ErrorNotice(d['error']),
          const SizedBox(height: 12),
          FilledButton.icon(
            key: const Key('check-essay'),
            onPressed: w.locked || !w.confirmed
                ? null
                : () async {
                    final force = d['status'] == 'checked';
                    if (force &&
                        !await confirm(
                          context,
                          'Kiểm tra lại bài viết?',
                          'AI sẽ trích xuất lại luận điểm và dùng hạn mức máy chủ.',
                        )) {
                      return;
                    }
                    await w.run(
                      'Đang kiểm tra luận điểm với bằng chứng…',
                      () => w.post(
                        '/drafts/${d['id']}/check',
                        data: {'force': force},
                      ),
                    );
                  },
            icon: const Icon(Icons.fact_check_outlined),
            label: Text(
              d['status'] == 'checked' ? 'Kiểm tra lại' : 'Kiểm tra bằng chứng',
            ),
          ),
          if (!w.confirmed)
            const Padding(
              padding: EdgeInsets.only(top: 8),
              child: Text(
                'Xác nhận đề tài trước khi kiểm tra.',
                style: TextStyle(color: muted),
              ),
            ),
          const SizedBox(height: 12),
          const Text(
            'Tối đa 40 luận điểm mỗi bài. Kết quả chỉ phản ánh bằng chứng đã tải, không phải chấm điểm chất lượng bài viết.',
            style: TextStyle(color: muted, fontSize: 12),
          ),
          Section('${claims.length} luận điểm'),
          if (claims.isNotEmpty)
            Wrap(
              spacing: 6,
              children:
                  [
                        'all',
                        'SUPPORTED',
                        'PARTIALLY_SUPPORTED',
                        'CONTRADICTED',
                        'UNSUPPORTED',
                        'INSUFFICIENT_EVIDENCE',
                      ]
                      .map(
                        (s) => ChoiceChip(
                          label: Text(
                            s == 'all'
                                ? 'Tất cả'
                                : '${labelFor(s)} (${claims.where((c) => object(c['check'])['status'] == s).length})',
                          ),
                          selected: filter == s,
                          onSelected: (_) => setState(() => filter = s),
                        ),
                      )
                      .toList(),
            ),
          if (claims.isEmpty && d['status'] == 'checked')
            const EmptyView(
              'Không tìm thấy luận điểm',
              'Thử đoạn văn có các nhận định nghiên cứu cần kiểm chứng.',
            ),
          ...claims
              .where(
                (c) =>
                    filter == 'all' || object(c['check'])['status'] == filter,
              )
              .map(
                (c) => Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Card(
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(18),
                      title: Text(textOf(c, 'text')),
                      subtitle: Padding(
                        padding: const EdgeInsets.only(top: 10),
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: c['check'] == null
                              ? const Text('Chưa kiểm tra')
                              : StatusPill(
                                  textOf(object(c['check']), 'status'),
                                ),
                        ),
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ClaimDetails(work: w, claim: c),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          if (claims.isNotEmpty)
            AiFeedback(work: w, module: 'essay_evidence_check', resultId: textOf(d, 'id')),
        ],
        const SizedBox(height: 24),
      ],
    );
  }
}

class ClaimDetails extends StatelessWidget {
  const ClaimDetails({super.key, required this.work, required this.claim});
  final Workspace work;
  final Json claim;
  @override
  Widget build(BuildContext context) {
    final check = object(claim['check']);
    return Scaffold(
      appBar: AppBar(title: const Text('Kiểm tra luận điểm')),
      body: SafeArea(
        child: PageBody(
          children: [
            Panel(color: mint, child: SelectableText(textOf(claim, 'text'))),
            if (check.isEmpty)
              const EmptyView(
                'Chưa có kết quả',
                'Quay lại và tiếp tục kiểm tra bài viết.',
              ),
            if (check.isNotEmpty) ...[
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: StatusPill(textOf(check, 'status')),
              ),
              for (final e in {
                'explanation': 'Giải thích',
                'relevance': 'Mức liên quan',
                'citation_issue': 'Vấn đề trích dẫn',
                'limitation': 'Giới hạn đánh giá',
                'action': 'Gợi ý tiếp theo',
              }.entries) ...[
                Section(e.value),
                SelectableText(textOf(check, e.key)),
              ],
              const Section('Bằng chứng liên quan'),
              if (objects(check['matches']).isEmpty)
                const Text(
                  'Chưa tìm thấy bằng chứng phù hợp. Điều này không đồng nghĩa luận điểm sai.',
                ),
              ...objects(check['matches']).map(
                (m) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        StatusPill(textOf(m, 'relation')),
                        const SizedBox(height: 10),
                        SelectableText(textOf(m, 'explanation')),
                        for (final e in work.evidence.where(
                          (e) => e['id'] == m['evidence_id'],
                        ))
                          TextButton.icon(
                            onPressed: () => inspectEvidence(context, work, e),
                            icon: const Icon(Icons.link),
                            label: Text('Nguồn · trang ${e['page']}'),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class DraftEditor extends StatefulWidget {
  const DraftEditor({super.key, this.draft, this.save});
  final Json? draft;
  final Future<void> Function(Json)? save;
  @override
  State<DraftEditor> createState() => _DraftEditorState();
}

class _DraftEditorState extends State<DraftEditor> {
  late final title = TextEditingController(
    text: textOf(widget.draft ?? {}, 'title'),
  );
  late final content = TextEditingController(
    text: textOf(widget.draft ?? {}, 'text'),
  );
  final form = GlobalKey<FormState>();
  bool dirty = false, leaving = false;
  bool saving = false;
  Object? error;
  Future<void> submit() async {
    if (saving || !form.currentState!.validate()) return;
    if (widget.draft != null &&
        !await confirm(
          context,
          'Lưu thay đổi bài viết?',
          'Luận điểm và kết quả kiểm tra cũ của bài này sẽ được đặt lại.',
        ))
      return;
    if (!mounted) return;
    final data = <String, dynamic>{
      'title': title.text.trim(),
      'text': content.text.trim(),
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
    title.dispose();
    content.dispose();
    super.dispose();
  }

  void finish(Json? data) {
    setState(() => leaving = true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.pop(context, data);
    });
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: (!dirty && !saving) || leaving,
    onPopInvokedWithResult: (didPop, _) async {
      if (!didPop &&
          !saving &&
          await confirm(
            context,
            'Bỏ thay đổi chưa lưu?',
            'Nội dung vừa nhập chưa được lưu.',
          )) {
        finish(null);
      }
    },
    child: Scaffold(
      appBar: AppBar(
        title: Text(
          widget.draft == null ? 'Bài viết mới' : 'Chỉnh sửa bài viết',
        ),
      ),
      body: SafeArea(
        child: Form(
          key: form,
          onChanged: () {
            if (!dirty) setState(() => dirty = true);
          },
          child: PageBody(
            children: [
              TextFormField(
                enabled: !saving,
                controller: title,
                maxLength: 200,
                decoration: const InputDecoration(labelText: 'Tên bài viết'),
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'Nhập tên bài viết' : null,
              ),
              const SizedBox(height: 16),
              TextFormField(
                enabled: !saving,
                controller: content,
                minLines: 12,
                maxLines: 24,
                maxLength: 60000,
                decoration: const InputDecoration(
                  labelText: 'Nội dung',
                  alignLabelWithHint: true,
                ),
                validator: (v) => (v ?? '').trim().length < 20
                    ? 'Nhập ít nhất 20 ký tự'
                    : null,
              ),
              const SizedBox(height: 20),
              if (error != null) ErrorNotice(error!),
              if (saving) const Working('Đang lưu bài viết…'),
              FilledButton(
                onPressed: saving ? null : submit,
                child: const Text('Lưu bài viết'),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
