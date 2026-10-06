import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../data/api.dart';
import '../data/workspace.dart';
import '../ui/design.dart';
import '../ui/feedback.dart';
import 'evidence.dart';

Future<void> pickUpload(Workspace w, {bool draft = false}) async {
  if (w.locked) return;
  try {
    final f = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: draft ? ['pdf', 'txt', 'md'] : ['pdf'],
    );
    if (f == null || w.disposed) return;
    final buffer = BytesBuilder(copy: false);
    await for (final chunk in f.readAsByteStream()) {
      if (buffer.length + chunk.length > 20 * 1024 * 1024) {
        throw ApiFailure('Tệp phải nhỏ hơn hoặc bằng 20 MB.');
      }
      buffer.add(chunk);
    }
    if (w.disposed) return;
    await w.run(
      draft ? 'Đang tải bài viết…' : 'Đang tải và trích xuất PDF…',
      () => w.api.upload(
        '${w.base}/${draft ? 'draft-upload' : 'sources'}',
        f.name,
        buffer.takeBytes(),
        progress: (sent, total) {
          if (total > 0) {
            w.progress = sent < total ? sent / total : null;
            w.emit();
          }
        },
      ),
    );
  } catch (e) {
    w.error = e;
    w.emit();
  }
}

class SourcesTab extends StatelessWidget {
  const SourcesTab({super.key, required this.work});
  final Workspace work;
  @override
  Widget build(BuildContext context) => PageBody(
    children: [
      Text(
        'Tài liệu làm nền tảng.',
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: 8),
      const Text(
        'PDF có văn bản · tối đa 20 MB, 150 trang',
        style: TextStyle(color: muted),
      ),
      const SizedBox(height: 20),
      Panel(
        color: mint,
        child: Column(
          children: [
            const Icon(Icons.upload_file_rounded, size: 54, color: teal),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: work.locked ? null : () => pickUpload(work),
              icon: const Icon(Icons.add),
              label: const Text('Chọn tài liệu PDF'),
            ),
            const SizedBox(height: 10),
            const Text(
              'PDF scan cần OCR trước khi tải lên.',
              style: TextStyle(fontSize: 12, color: muted),
            ),
          ],
        ),
      ),
      if (!work.confirmed)
        const Padding(
          padding: EdgeInsets.only(top: 16),
          child: Text(
            'Xác nhận đề tài trước khi phân tích tài liệu.',
            style: TextStyle(color: muted),
          ),
        ),
      Section('${work.sources.length} tài liệu'),
      if (work.sources.isEmpty)
        const EmptyView(
          'Thêm nguồn cho ý tưởng',
          'Tải bài báo để trích xuất bằng chứng có thể kiểm tra.',
        ),
      ...work.sources.map(
        (s) => Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: Panel(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.picture_as_pdf_outlined,
                  color: teal,
                  size: 32,
                ),
                const SizedBox(height: 12),
                Text(
                  textOf(s, 'filename'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  '${s['page_count']} trang · ${objects(s['evidence']).length} bằng chứng',
                  style: const TextStyle(color: muted),
                ),
                const SizedBox(height: 8),
                StatusPill(textOf(s, 'status')),
                if (s['error'] != null) ErrorNotice(s['error']),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    FilledButton.tonal(
                      onPressed:
                          work.locked || !work.confirmed || s['page_count'] == 0
                          ? null
                          : () async {
                              final force =
                                  s['evaluation'] != null &&
                                  s['evidence_done'] == true;
                              if (force &&
                                  !await confirm(
                                    context,
                                    'Phân tích lại tài liệu?',
                                    'Bằng chứng có thể thay đổi, kết quả so sánh và kiểm tra bài viết sẽ cần chạy lại.',
                                  )) {
                                return;
                              }
                              await work.run(
                                'Đang đánh giá và trích xuất bằng chứng…',
                                () => work.post(
                                  '/sources/${s['id']}/process',
                                  data: {'force': force},
                                ),
                              );
                            },
                      child: Text(
                        s['evaluation'] != null && s['evidence_done'] == true
                            ? 'Phân tích lại'
                            : 'Phân tích',
                      ),
                    ),
                    OutlinedButton(
                      onPressed: () => Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => SourceDetails(work: work, source: s),
                        ),
                      ),
                      child: const Text('Xem chi tiết'),
                    ),
                    IconButton(
                      tooltip: 'Xóa tài liệu',
                      onPressed: work.locked
                          ? null
                          : () async {
                              if (!await confirm(
                                context,
                                'Xóa tài liệu?',
                                'Tài liệu và bằng chứng của nó sẽ bị xóa trên cả web và app; các báo cáo liên quan cần kiểm tra lại.',
                              )) {
                                return;
                              }
                              await work.run(
                                'Đang xóa tài liệu…',
                                () => work.api.request(
                                  '${work.base}/sources/${s['id']}',
                                  method: 'DELETE',
                                ),
                              );
                            },
                      icon: const Icon(Icons.delete_outline),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ],
  );
}

class SourceDetails extends StatelessWidget {
  const SourceDetails({super.key, required this.work, required this.source});
  final Workspace work;
  final Json source;
  @override
  Widget build(BuildContext context) {
    final evaluation = object(source['evaluation']);
    return Scaffold(
      appBar: AppBar(title: const Text('Đánh giá tài liệu')),
      body: SafeArea(
        child: PageBody(
          children: [
            Text(
              textOf(source, 'filename'),
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () => openPdf(context, work, textOf(source, 'id'), 1),
              icon: const Icon(Icons.picture_as_pdf_outlined),
              label: const Text('Mở PDF gốc'),
            ),
            if (source['error'] != null) ErrorNotice(source['error']),
            for (final warning in strings(source['warnings']))
              ErrorNotice(warning),
            if (evaluation.isEmpty)
              const EmptyView(
                'Chưa có đánh giá',
                'Quay lại và chọn Phân tích sau khi xác nhận đề tài.',
              ),
            if (evaluation.isNotEmpty) ...[
              const Section('Thông tin từ tài liệu'),
              const Text(
                'Thông tin không xuất hiện ở đây được xem là chưa rõ.',
                style: TextStyle(color: muted),
              ),
              const SizedBox(height: 12),
              ...objects(evaluation['facts']).map(
                (f) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          labelFor(textOf(f, 'field')),
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        SelectableText(textOf(f, 'value')),
                        TextButton.icon(
                          onPressed: () => inspectEvidence(context, work, {
                            ...f,
                            'source_id': source['id'],
                            'content': f['value'],
                          }),
                          icon: const Icon(Icons.link),
                          label: Text('Kiểm tra trang ${f['page']}'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const Section('Nhận định của AI'),
              for (final e in {
                'relevance': 'Phù hợp đề tài',
                'usefulness': 'Giá trị bằng chứng',
                'recency': 'Tính cập nhật',
              }.entries)
                Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Panel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.value,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        SelectableText(textOf(evaluation, e.key)),
                      ],
                    ),
                  ),
                ),
              for (final warning in [
                ...strings(evaluation['limitations']),
                ...strings(evaluation['warnings']),
              ])
                ErrorNotice(warning),
              AiFeedback(work: work, module: 'source_evaluation', resultId: textOf(source, 'id')),
            ],
          ],
        ),
      ),
    );
  }
}
