import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/api.dart';
import '../ui/design.dart';
import '../ui/language.dart';
import 'workspace.dart';
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
    final name = await inputDialog(
      context,
      tr(context, 'Dự án nghiên cứu mới', 'New research project'),
    );
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
        const LanguageToggle(),
        if (tab == 0)
          IconButton(
            tooltip: tr(context, 'Đồng bộ dự án', 'Sync projects'),
            onPressed: load,
            icon: const Icon(Icons.sync_rounded),
          ),
      ],
    ),
    body: SafeArea(
      child: tab == 1 && textOf(widget.user, 'role') == 'ADMIN'
          ? AdminScreen(api: widget.api)
          : tab == (textOf(widget.user, 'role') == 'ADMIN' ? 2 : 1)
          ? account()
          : dashboard(),
    ),
    floatingActionButton: tab == 0 && !loading
        ? FloatingActionButton.extended(
            onPressed: busy ? null : create,
            icon: const Icon(Icons.add_rounded),
            label: Text(tr(context, 'Dự án mới', 'New project')),
          )
        : null,
    bottomNavigationBar: NavigationBar(
      selectedIndex: tab,
      onDestinationSelected: (i) => setState(() => tab = i),
      destinations: [
        NavigationDestination(
          icon: Icon(Icons.grid_view_rounded),
          label: tr(context, 'Dự án', 'Projects'),
        ),
        if (textOf(widget.user, 'role') == 'ADMIN')
          NavigationDestination(
            icon: Icon(Icons.insights_outlined),
            label: tr(context, 'Quản trị', 'Admin'),
          ),
        NavigationDestination(
          icon: Icon(Icons.person_outline_rounded),
          label: tr(context, 'Tài khoản', 'Account'),
        ),
      ],
    ),
  );
  Widget dashboard() => RefreshIndicator(
    onRefresh: load,
    child: PageBody(
      children: [
        Text(
          tr(
            context,
            'Mỗi ý tưởng,\nmột hướng đi.',
            'Every idea,\na clear direction.',
          ),
          style: Theme.of(context).textTheme.displaySmall,
        ),
        const SizedBox(height: 8),
        Text(
          tr(
            context,
            'Tiếp tục nghiên cứu của bạn.',
            'Continue your research.',
          ),
          style: const TextStyle(color: muted),
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
              Text(
                tr(
                  context,
                  'Đề tài  →  Tài liệu  →  Bằng chứng  →  Bài viết',
                  'Topic  →  Sources  →  Evidence  →  Writing',
                ),
                style: const TextStyle(fontSize: 12, color: muted),
              ),
            ],
          ),
        ),
        Section(tr(context, 'Không gian của bạn', 'Your workspace')),
        TextField(
          onChanged: (s) => setState(() => query = s),
          decoration: InputDecoration(
            labelText: tr(context, 'Tìm dự án', 'Search projects'),
            prefixIcon: const Icon(Icons.search),
          ),
        ),
        const SizedBox(height: 16),
        if (loading || busy)
          Working(
            busy
                ? tr(context, 'Đang tạo dự án…', 'Creating project…')
                : tr(context, 'Đang đồng bộ…', 'Syncing…'),
          ),
        if (error != null) ErrorNotice(error!, retry: load),
        if (!loading && error == null && projects.isEmpty)
          EmptyView(
            tr(context, 'Bắt đầu từ một câu hỏi', 'Start with a question'),
            tr(
              context,
              'Tạo dự án để tập hợp đề tài và tài liệu của bạn.',
              'Create a project to bring your topic and sources together.',
            ),
          ),
        if (projects.isNotEmpty &&
            !projects.any(
              (p) =>
                  textOf(p, 'name').toLowerCase().contains(query.toLowerCase()),
            ))
          EmptyView(
            tr(context, 'Chưa tìm thấy dự án', 'No projects found'),
            tr(context, 'Thử từ khóa khác.', 'Try a different keyword.'),
          ),
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
                            '${p['sources']} ${tr(context, 'tài liệu', 'sources')} · ${p['evidence']} ${tr(context, 'bằng chứng', 'evidence')} · ${p['drafts']} ${tr(context, 'bài viết', 'drafts')}',
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
        tr(context, 'Không gian riêng của bạn', 'Your private workspace'),
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
            Text(
              tr(
                context,
                'Dữ liệu dùng chung với PaperFlow web. Làm mới để nhận thay đổi từ thiết bị khác.',
                'Your data is shared with PaperFlow web. Refresh to receive changes from another device.',
              ),
              style: const TextStyle(color: muted),
            ),
          ],
        ),
      ),
      Section(tr(context, 'Về PaperFlow', 'About PaperFlow')),
      Panel(
        child: Text(
          tr(
            context,
            'AI hỗ trợ phân tích, không thay thế đánh giá học thuật. Trích dẫn luôn giữ nguyên nội dung từ tài liệu.\n\nĐề tài và tài liệu được gửi tới máy chủ PaperFlow; phân tích AI được xử lý bởi nhà cung cấp được cấu hình trên máy chủ. Chỉ ghi chú bạn chủ động đăng mới xuất hiện trong Góc chia sẻ.',
            'AI assists analysis; it does not replace academic judgment. Quotations remain exactly as they appear in the source.\n\nTopics and sources are sent to the PaperFlow server. AI analysis is handled by the provider configured on that server. Only notes you choose to publish appear in the Hub.',
          ),
        ),
      ),
      Section(tr(context, 'Quyền riêng tư & hỗ trợ', 'Privacy & support')),
      Panel(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              tr(
                context,
                'Chính sách giải thích dữ liệu nào được xử lý, cách AI được sử dụng và cách yêu cầu xóa dữ liệu.',
                'Our policy explains the data we process, how AI is used, and how to request deletion.',
              ),
              style: const TextStyle(color: muted),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 4,
              runSpacing: 4,
              children: [
                TextButton.icon(
                  onPressed: () =>
                      _openExternal('https://www.paperflow.space/privacy'),
                  icon: const Icon(Icons.privacy_tip_outlined),
                  label: Text(tr(context, 'Quyền riêng tư', 'Privacy policy')),
                ),
                TextButton.icon(
                  onPressed: () =>
                      _openExternal('https://www.paperflow.space/terms'),
                  icon: const Icon(Icons.article_outlined),
                  label: Text(tr(context, 'Điều khoản', 'Terms')),
                ),
                TextButton.icon(
                  onPressed: () =>
                      _openExternal('mailto:nhanlhse184226@fpt.edu.vn'),
                  icon: const Icon(Icons.support_agent_outlined),
                  label: Text(tr(context, 'Liên hệ hỗ trợ', 'Contact support')),
                ),
              ],
            ),
          ],
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
        label: Text(tr(context, 'Đăng xuất', 'Sign out')),
      ),
      const SizedBox(height: 10),
      TextButton.icon(
        style: TextButton.styleFrom(foregroundColor: const Color(0xFF9B2C24)),
        onPressed: busy ? null : deleteAccount,
        icon: const Icon(Icons.delete_forever_outlined),
        label: Text(tr(context, 'Xóa tài khoản', 'Delete account')),
      ),
    ],
  );

  Future<void> _openExternal(String value) async {
    final opened = await launchUrl(
      Uri.parse(value),
      mode: LaunchMode.externalApplication,
    );
    if (!opened && mounted) {
      setState(
        () => error = ApiFailure(
          tr(context, 'Không thể mở liên kết.', 'Could not open the link.'),
        ),
      );
    }
  }

  Future<void> deleteAccount() async {
    final accepted = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(Icons.warning_amber_rounded, color: Color(0xFF9B2C24)),
        title: Text(
          tr(
            context,
            'Xóa vĩnh viễn tài khoản?',
            'Delete account permanently?',
          ),
        ),
        content: Text(
          tr(
            context,
            'Thao tác này không thể hoàn tác. Toàn bộ dự án, PDF, ghi chú bạn đã đăng, phản hồi và phiên đăng nhập của ${textOf(widget.user, 'email')} sẽ bị xóa.',
            'This cannot be undone. All projects, PDFs, Hub notes, feedback, and signed-in sessions for ${textOf(widget.user, 'email')} will be deleted.',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: Text(tr(context, 'Hủy', 'Cancel')),
          ),
          FilledButton(
            style: FilledButton.styleFrom(
              backgroundColor: const Color(0xFF9B2C24),
            ),
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(tr(context, 'Xóa vĩnh viễn', 'Delete permanently')),
          ),
        ],
      ),
    );
    if (accepted != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.deleteAccount();
      if (mounted) widget.onLogout();
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }
}
