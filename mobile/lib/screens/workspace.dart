import 'package:flutter/material.dart';

import '../data/api.dart';
import '../data/workspace.dart';
import '../ui/design.dart';
import 'topic.dart';
import 'sources.dart';
import 'evidence.dart';
import 'essay.dart';

class WorkspaceScreen extends StatefulWidget {
  const WorkspaceScreen({super.key, required this.api, required this.id});
  final PaperApi api;
  final String id;
  @override
  State<WorkspaceScreen> createState() => _WorkspaceScreenState();
}

class _WorkspaceScreenState extends State<WorkspaceScreen> {
  late final Workspace work = Workspace(widget.api, widget.id);
  int tab = 0;
  @override
  void initState() {
    super.initState();
    work.load();
  }

  @override
  void dispose() {
    work.dispose();
    super.dispose();
  }

  Future<void> menu(String item) async {
    if (item == 'rename') {
      final name = await inputDialog(
        context,
        'Đổi tên dự án',
        value: textOf(work.project!, 'name'),
      );
      if (name != null) {
        await work.run(
          'Đang đổi tên…',
          () => widget.api.request(
            work.base,
            method: 'PATCH',
            data: {'name': name},
          ),
        );
      }
    } else if (item == 'delete') {
      if (!await confirm(
        context,
        'Xóa dự án?',
        'Tài liệu, bằng chứng và bài viết sẽ bị xóa trên cả web và app. Không thể hoàn tác.',
      )) {
        return;
      }
      try {
        await widget.api.request(work.base, method: 'DELETE');
        if (mounted) Navigator.pop(context);
      } catch (e) {
        work.error = e;
        work.emit();
      }
    }
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: work,
    builder: (context, _) => Scaffold(
      appBar: AppBar(
        title: Text(
          textOf(work.project ?? {}, 'name', 'Dự án'),
          overflow: TextOverflow.ellipsis,
        ),
        actions: [
          IconButton(
            onPressed: work.busy ? null : work.load,
            tooltip: 'Đồng bộ với web',
            icon: const Icon(Icons.sync),
          ),
          PopupMenuButton<String>(
            enabled: work.project != null && !work.locked,
            tooltip: 'Tùy chọn dự án',
            onSelected: menu,
            itemBuilder: (_) => const [
              PopupMenuItem(value: 'rename', child: Text('Đổi tên')),
              PopupMenuItem(value: 'delete', child: Text('Xóa dự án')),
            ],
          ),
        ],
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (work.project != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(24, 0, 24, 12),
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            work.confirmed
                                ? 'Hướng nghiên cứu đã xác nhận'
                                : 'Bắt đầu bằng việc xác nhận đề tài',
                            style: const TextStyle(color: muted, fontSize: 12),
                          ),
                        ),
                        Text(
                          '${tab + 1} / 4',
                          style: const TextStyle(
                            color: teal,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: (tab + 1) / 4,
                        minHeight: 4,
                      ),
                    ),
                  ],
                ),
              ),
            if (work.locked)
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 6,
                ),
                child: Working(
                  work.busy
                      ? work.label
                      : 'Máy chủ đang xử lý. Đang kiểm tra tiến độ…',
                  progress: work.progress,
                ),
              ),
            if (work.error != null)
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 170),
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 24),
                  child: ErrorNotice(
                    work.error!,
                    retry: work.busy ? null : work.load,
                  ),
                ),
              ),
            Expanded(
              child: work.project == null
                  ? (work.error == null
                        ? const Center(child: CircularProgressIndicator())
                        : const SizedBox())
                  : AnimatedSwitcher(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 220),
                      child: KeyedSubtree(
                        key: ValueKey(tab),
                        child: [
                          TopicTab(work: work),
                          SourcesTab(work: work),
                          EvidenceTab(work: work),
                          EssayTab(work: work),
                        ][tab],
                      ),
                    ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: tab,
        onDestinationSelected: (i) => setState(() => tab = i),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            label: 'Đề tài',
          ),
          NavigationDestination(
            icon: Icon(Icons.description_outlined),
            label: 'Tài liệu',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_tree_outlined),
            label: 'Bằng chứng',
          ),
          NavigationDestination(
            icon: Icon(Icons.fact_check_outlined),
            label: 'Bài viết',
          ),
        ],
      ),
    ),
  );
}
