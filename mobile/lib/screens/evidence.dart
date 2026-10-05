import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';
import 'package:share_plus/share_plus.dart';

import '../data/api.dart';
import '../data/workspace.dart';
import '../ui/design.dart';

void openPdf(BuildContext context, Workspace work, String sourceId, int page) {
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => PdfScreen(
        api: work.api,
        projectId: work.id,
        sourceId: sourceId,
        page: page,
      ),
    ),
  );
}

void inspectEvidence(BuildContext context, Workspace work, Json evidence) {
  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (_) => ProvenanceScreen(work: work, evidence: evidence),
    ),
  );
}

class EvidenceTab extends StatefulWidget {
  const EvidenceTab({super.key, required this.work});
  final Workspace work;
  @override
  State<EvidenceTab> createState() => _EvidenceTabState();
}

class _EvidenceTabState extends State<EvidenceTab> {
  String query = '', kind = 'all', sourceId = 'all';
  final selected = <String>{};
  @override
  Widget build(BuildContext context) {
    final w = widget.work;
    selected.removeWhere((id) => !w.sources.any((s) => s['id'] == id));
    if (sourceId != 'all' && !w.sources.any((s) => s['id'] == sourceId)) {
      sourceId = 'all';
    }
    final items = w.evidence
        .where(
          (e) =>
              (kind == 'all' || e['kind'] == kind) &&
              (sourceId == 'all' || e['source_id'] == sourceId) &&
              '${e['content']} ${e['quote']}'.toLowerCase().contains(
                query.toLowerCase(),
              ),
        )
        .toList();
    return PageBody(
      children: [
        Text(
          'Bằng chứng,\ncó thể truy vết.',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 12),
        Text(
          '${w.evidence.length} bằng chứng từ ${w.sources.length} tài liệu',
          style: const TextStyle(color: muted),
        ),
        const SizedBox(height: 16),
        TextField(
          onChanged: (s) => setState(() => query = s),
          decoration: const InputDecoration(
            labelText: 'Tìm bằng chứng',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 12),
        DropdownButtonFormField<String>(
          key: ValueKey(sourceId),
          initialValue: sourceId,
          isExpanded: true,
          decoration: const InputDecoration(labelText: 'Tài liệu'),
          items: [
            const DropdownMenuItem(
              value: 'all',
              child: Text('Tất cả tài liệu'),
            ),
            ...w.sources.map(
              (s) => DropdownMenuItem(
                value: textOf(s, 'id'),
                child: Text(
                  textOf(s, 'filename'),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ],
          onChanged: (s) => setState(() => sourceId = s!),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 6,
          children:
              [
                    'all',
                    'problem',
                    'objective',
                    'method',
                    'sample',
                    'finding',
                    'limitation',
                    'gap',
                  ]
                  .map(
                    (k) => ChoiceChip(
                      label: Text(k == 'all' ? 'Tất cả loại' : labelFor(k)),
                      selected: kind == k,
                      onSelected: (_) => setState(() => kind = k),
                    ),
                  )
                  .toList(),
        ),
        const SizedBox(height: 12),
        Builder(
          builder: (buttonContext) => OutlinedButton.icon(
            onPressed: w.evidence.isEmpty
                ? null
                : () async {
                    try {
                      final box = buttonContext.findRenderObject() as RenderBox;
                      await SharePlus.instance.share(
                        ShareParams(
                          files: [
                            XFile.fromData(
                              Uint8List.fromList(
                                utf8.encode(evidenceCsv(w.sources)),
                              ),
                              mimeType: 'text/csv',
                              name: 'paperflow-evidence.csv',
                            ),
                          ],
                          fileNameOverrides: ['paperflow-evidence.csv'],
                          sharePositionOrigin:
                              box.localToGlobal(Offset.zero) & box.size,
                        ),
                      );
                    } catch (e) {
                      w.error = e;
                      w.emit();
                    }
                  },
            icon: const Icon(Icons.ios_share),
            label: const Text('Xuất toàn bộ bằng chứng CSV'),
          ),
        ),
        if (items.isEmpty)
          const EmptyView(
            'Chưa có bằng chứng phù hợp',
            'Phân tích tài liệu hoặc thay đổi bộ lọc.',
          ),
        ...items.map(
          (e) => Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusPill(textOf(e, 'kind')),
                  const SizedBox(height: 12),
                  SelectableText(textOf(e, 'content')),
                  const SizedBox(height: 8),
                  Text(
                    w.sources
                        .where((s) => s['id'] == e['source_id'])
                        .map((s) => textOf(s, 'filename'))
                        .join(),
                    style: const TextStyle(color: muted, fontSize: 12),
                  ),
                  TextButton.icon(
                    onPressed: () => inspectEvidence(context, w, e),
                    icon: const Icon(Icons.link),
                    label: Text('Nguồn & trích dẫn · trang ${e['page']}'),
                  ),
                ],
              ),
            ),
          ),
        ),
        const Section('So sánh giữa các nguồn'),
        const Text(
          'Chọn ít nhất 2 nguồn có bằng chứng. Kết quả so sánh độc lập với bộ lọc phía trên.',
          style: TextStyle(color: muted),
        ),
        ...w.sources
            .where((s) => objects(s['evidence']).isNotEmpty)
            .map(
              (s) => CheckboxListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(textOf(s, 'filename')),
                value: selected.contains(s['id']),
                onChanged: w.locked
                    ? null
                    : (v) => setState(() {
                        if (v == true) {
                          selected.add(s['id']);
                        } else {
                          selected.remove(s['id']);
                        }
                      }),
              ),
            ),
        FilledButton.icon(
          onPressed: w.locked || selected.length < 2 || !w.confirmed
              ? null
              : () => w.run(
                  'Đang so sánh các nguồn…',
                  () => w.post(
                    '/comparisons',
                    data: {'source_ids': selected.toList(), 'force': false},
                  ),
                ),
          icon: const Icon(Icons.compare_arrows),
          label: const Text('So sánh bằng chứng'),
        ),
        ...objects(w.project!['comparisons']).map(
          (c) => Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Panel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusPill(textOf(c, 'relationship')),
                  const SizedBox(height: 8),
                  SelectableText(textOf(c, 'explanation')),
                  for (final id in strings(c['evidence_ids']))
                    for (final e in w.evidence.where((e) => e['id'] == id))
                      TextButton.icon(
                        onPressed: () => inspectEvidence(context, w, e),
                        icon: const Icon(Icons.link),
                        label: Text('Xem bằng chứng · trang ${e['page']}'),
                      ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 24),
      ],
    );
  }
}

class ProvenanceScreen extends StatefulWidget {
  const ProvenanceScreen({
    super.key,
    required this.work,
    required this.evidence,
  });
  final Workspace work;
  final Json evidence;
  @override
  State<ProvenanceScreen> createState() => _ProvenanceScreenState();
}

class _ProvenanceScreenState extends State<ProvenanceScreen> {
  late Future<dynamic> page;
  @override
  void initState() {
    super.initState();
    page = fetch();
  }

  Future<dynamic> fetch() => widget.work.api.request(
    '${widget.work.base}/sources/${widget.evidence['source_id']}/pages/${widget.evidence['page']}',
  );
  @override
  Widget build(BuildContext context) {
    final e = widget.evidence;
    final source = widget.work.sources.where((s) => s['id'] == e['source_id']);
    return Scaffold(
      appBar: AppBar(title: const Text('Theo dấu bằng chứng')),
      body: SafeArea(
        child: PageBody(
          children: [
            const Icon(Icons.format_quote_rounded, size: 48, color: teal),
            Text(
              source.isNotEmpty ? textOf(source.first, 'filename') : 'Tài liệu',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            Text(
              'Trang ${e['page']} · trích dẫn nguyên văn',
              style: const TextStyle(color: muted),
            ),
            const SizedBox(height: 16),
            Panel(color: mint, child: SelectableText(textOf(e, 'quote'))),
            const SizedBox(height: 16),
            FilledButton.icon(
              onPressed: () => openPdf(
                context,
                widget.work,
                textOf(e, 'source_id'),
                (e['page'] as num).toInt(),
              ),
              icon: const Icon(Icons.picture_as_pdf_outlined),
              label: const Text('Mở đúng trang PDF'),
            ),
            const Section('Văn bản trích xuất của trang'),
            FutureBuilder<dynamic>(
              future: page,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return ErrorNotice(
                    snapshot.error!,
                    retry: () => setState(() => page = fetch()),
                  );
                }
                if (!snapshot.hasData) return const Working('Đang tải trang…');
                final content = textOf(object(snapshot.data), 'text');
                return Panel(
                  child: SelectableText(
                    content.isEmpty
                        ? 'Trang không có văn bản trích xuất.'
                        : content,
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class PdfScreen extends StatefulWidget {
  const PdfScreen({
    super.key,
    required this.api,
    required this.projectId,
    required this.sourceId,
    required this.page,
  });
  final PaperApi api;
  final String projectId, sourceId;
  final int page;
  @override
  State<PdfScreen> createState() => _PdfScreenState();
}

class _PdfScreenState extends State<PdfScreen> {
  late Future<Uint8List> bytes;
  @override
  void initState() {
    super.initState();
    bytes = fetch();
  }

  Future<Uint8List> fetch() =>
      widget.api.pdf(widget.projectId, widget.sourceId);
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('PDF gốc · trang ${widget.page}')),
    body: SafeArea(
      child: FutureBuilder<Uint8List>(
        future: bytes,
        builder: (context, s) {
          if (s.hasError) {
            return PageBody(
              children: [
                ErrorNotice(
                  s.error!,
                  retry: () => setState(() => bytes = fetch()),
                ),
              ],
            );
          }
          if (!s.hasData) {
            return const PageBody(children: [Working('Đang tải PDF…')]);
          }
          return PdfViewer.data(
            s.data!,
            sourceName: '${widget.sourceId}.pdf',
            initialPageNumber: widget.page,
          );
        },
      ),
    ),
  );
}
