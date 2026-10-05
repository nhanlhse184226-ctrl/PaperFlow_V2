import 'package:flutter/material.dart';

import '../data/api.dart';
import '../ui/design.dart';
import 'workspace.dart';
import 'hub.dart';
import 'billing.dart';
import 'admin.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.api,
    required this.user,
    required this.onLogout,
  });
  final PaperApi api;
  final Json user;
  final VoidCallback onLogout;
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  List<Json> projects = [];
  Object? error;
  bool loading = true, busy = false;
  int tab = 0;
  String query = '';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && tab == 0) load();
  }

  Future<void> load() async {
    try {
      final p = await widget.api.projects();
      if (mounted) {
        setState(() {
          projects = p;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> open(String id) async {
    await Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => WorkspaceScreen(api: widget.api, id: id),
      ),
    );
    if (mounted) await load();
  }

  Future<void> create() async {
    final name = await inputDialog(context, 'Dự án nghiên cứu mới');
    if (name == null || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final p = object(
        await widget.api.request(
          '/projects',
          method: 'POST',
          data: {'name': name},
        ),
      );
      if (mounted) await open(p['id']);
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Row(
        children: [
          Icon(Icons.auto_stories_rounded, color: teal),
          SizedBox(width: 10),
          Text('PaperFlow'),
        ],
      ),
      actions: [
        if (tab == 0)
          IconButton(
            tooltip: 'Đồng bộ dự án',
            onPressed: load,
            icon: const Icon(Icons.sync_rounded),
          ),
      ],
    ),
    body: SafeArea(
      child: tab == 1
          ? HubScreen(api: widget.api)
          : tab == 2
          ? BillingScreen(api: widget.api)
          : tab == 3 && textOf(widget.user, 'role') == 'ADMIN'
          ? AdminScreen(api: widget.api)
          : tab == (textOf(widget.user, 'role') == 'ADMIN' ? 4 : 3)
          ? account()
          : dashboard(),
    ),
    floatingActionButton: tab == 0 && !loading
        ? FloatingActionButton.extended(
            onPressed: busy ? null : create,
            icon: const Icon(Icons.add_rounded),
            label: const Text('Dự án mới'),
          )
        : null,
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (i) => setState(() => tab = i),
      destinations: [
        const NavigationDestination(
          icon: Icon(Icons.grid_view_rounded),
          label: 'Dự án',
        ),
        const NavigationDestination(
          icon: Icon(Icons.forum_outlined),
          label: 'Góc chia sẻ',
        ),
        const NavigationDestination(
          icon: Icon(Icons.workspace_premium_outlined),
          label: 'Gói',
        ),
        if (textOf(widget.user, 'role') == 'ADMIN')
          const NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            label: 'Quản trị',
          ),
        const NavigationDestination(
          icon: Icon(Icons.person_outline_rounded),
          label: 'Tài khoản',
        ),
      ],
    ),
  );
  Widget dashboard() => RefreshIndicator(
    onRefresh: load,
    child: PageBody(
      children: [
        Text(
          'Mỗi ý tưởng,\nmột hướng đi.',
          style: Theme.of(context).textTheme.displaySmall,
        ),
        const SizedBox(height: 8),
        const Text(
          'Tiếp tục nghiên cứu của bạn.',
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 20),
        Panel(
          color: mint,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const ResearchArt(height: 142),
              Text(
                '${projects.length} dự án · ${projects.fold<int>(0, (a, p) => a + ((p['sources'] as num?)?.toInt() ?? 0))} tài liệu',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              const Text(
                'Đề tài  →  Tài liệu  →  Bằng chứng  →  Bài viết',
                style: TextStyle(fontSize: 12, color: muted),
              ),
            ],
          ),
        ),
        const Section('Không gian của bạn'),
        TextField(
          onChanged: (s) => setState(() => query = s),
          decoration: const InputDecoration(
            labelText: 'Tìm dự án',
            prefixIcon: Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 16),
        if (loading || busy)
          Working(busy ? 'Đang tạo dự án…' : 'Đang đồng bộ…'),
        if (error != null) ErrorNotice(error!, retry: load),
        if (!loading && error == null && projects.isEmpty)
          const EmptyView(
            'Bắt đầu từ một câu hỏi',
            'Tạo dự án để tập hợp đề tài và tài liệu của bạn.',
          ),
        if (projects.isNotEmpty &&
            !projects.any(
              (p) =>
                  textOf(p, 'name').toLowerCase().contains(query.toLowerCase()),
            ))
          const EmptyView('Chưa tìm thấy dự án', 'Thử từ khóa khác.'),
        ...projects
            .where(
              (p) =>
                  textOf(p, 'name').toLowerCase().contains(query.toLowerCase()),
            )
            .map(
              (p) => Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () => open(p['id']),
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: mint,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(
                                  Icons.folder_open_rounded,
                                  color: teal,
                                ),
                              ),
                              const Spacer(),
                              const Icon(
                                Icons.arrow_outward_rounded,
                                color: muted,
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Text(
                            textOf(p, 'name'),
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          const SizedBox(height: 10),
                          Text(
                            '${p['sources']} tài liệu · ${p['evidence']} bằng chứng · ${p['drafts']} bài viết',
                            style: const TextStyle(color: muted, fontSize: 12),
                          ),
                          const SizedBox(height: 12),
                          StatusPill(
                            p['confirmed'] == true
                                ? 'ready'
                                : 'needs attention',
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
        const SizedBox(height: 80),
      ],
    ),
  );
  Widget account() => PageBody(
    children: [
      const ResearchArt(height: 160),
      Text(
        'Không gian riêng của bạn',
        style: Theme.of(context).textTheme.headlineMedium,
      ),
      const SizedBox(height: 20),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.account_circle_outlined, size: 36, color: teal),
            const SizedBox(height: 12),
            SelectableText(textOf(widget.user, 'email')),
            const SizedBox(height: 12),
            const Text(
              'Dữ liệu dùng chung với PaperFlow web. Làm mới để nhận thay đổi từ thiết bị khác.',
              style: TextStyle(color: muted),
            ),
          ],
        ),
      ),
      const Section('Về PaperFlow'),
      const Panel(
        child: Text(
          'AI hỗ trợ phân tích, không thay thế đánh giá học thuật. Trích dẫn luôn giữ nguyên nội dung từ tài liệu.\n\nĐề tài và tài liệu được gửi tới máy chủ PaperFlow; phân tích AI được xử lý bởi nhà cung cấp được cấu hình trên máy chủ. Chỉ ghi chú bạn chủ động đăng mới xuất hiện trong Góc chia sẻ.',
        ),
      ),
      const SizedBox(height: 24),
      if (error != null) ErrorNotice(error!),
      OutlinedButton.icon(
        onPressed: busy
            ? null
            : () async {
                setState(() {
                  busy = true;
                  error = null;
                });
                try {
                  await widget.api.signOut();
                  if (mounted) widget.onLogout();
                } catch (e) {
                  if (mounted) setState(() => error = e);
                } finally {
                  if (mounted) setState(() => busy = false);
                }
              },
        icon: const Icon(Icons.logout),
        label: const Text('Đăng xuất'),
      ),
    ],
  );
}
