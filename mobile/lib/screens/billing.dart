import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/api.dart';
import '../ui/design.dart';

class BillingScreen extends StatefulWidget {
  const BillingScreen({super.key, required this.api});
  final PaperApi api;
  @override
  State<BillingScreen> createState() => _BillingScreenState();
}

class _BillingScreenState extends State<BillingScreen> with WidgetsBindingObserver {
  List<Json> plans = [];
  List<Json> projects = [];
  List<Json> orders = [];
  String? projectId;
  Object? error;
  String busy = '';

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
    if (state == AppLifecycleState.resumed) load();
  }

  Future<void> load() async {
    try {
      final data = object(await widget.api.request('/billing/me'));
      if (!mounted) return;
      final nextProjects = objects(data['projects']);
      setState(() {
        plans = objects(data['plans']);
        projects = nextProjects;
        orders = objects(data['orders']);
        projectId = nextProjects.any((item) => textOf(item, 'id') == projectId)
            ? projectId
            : nextProjects.where((item) => item['billing_enforced'] == true).firstOrNull?['id']?.toString() ??
                nextProjects.firstOrNull?['id']?.toString();
        error = null;
      });
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  Future<void> checkout(Json plan) async {
    if (projectId == null) return;
    setState(() => busy = textOf(plan, 'id'));
    try {
      final result = object(await widget.api.request('/billing/checkout', method: 'POST',
          data: {'project_id': projectId, 'plan_id': textOf(plan, 'id')}));
      if (!await launchUrl(Uri.parse(textOf(result, 'checkout_url')),
          mode: LaunchMode.externalApplication)) {
        throw ApiFailure('Không mở được PayOS. Vui lòng thử lại.');
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = '');
    }
  }

  Future<void> refresh(Json order) async {
    setState(() => busy = 'refresh');
    try {
      await widget.api.request('/billing/orders/${order['order_code']}/refresh', method: 'POST');
      await load();
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = '');
    }
  }

  @override
  Widget build(BuildContext context) {
    final project = projects.where((item) => textOf(item, 'id') == projectId).firstOrNull;
    final enforced = project?['billing_enforced'] == true;
    final activeId = textOf(project ?? {}, 'plan_id', 'free');
    final activePlan = plans.where((item) => textOf(item, 'id') == activeId).firstOrNull;
    const ranks = {'free': 0, 'starter': 1, 'research': 2, 'pro': 3};
    return PageBody(children: [
      Text('Gói cho dự án của bạn', style: Theme.of(context).textTheme.headlineMedium),
      const SizedBox(height: 7),
      const Text('Mua một lần mỗi dự án · thanh toán VietQR', style: TextStyle(color: muted)),
      if (error != null) ErrorNotice(error!, retry: load),
      const Section('Dự án'),
      if (projects.isEmpty) const Panel(child: Text('Tạo một dự án để chọn gói.')),
      if (projects.isNotEmpty) Panel(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        DropdownButtonFormField<String>(
          initialValue: projectId,
          decoration: const InputDecoration(labelText: 'Áp dụng cho'),
          items: projects.map((item) => DropdownMenuItem(value: textOf(item, 'id'), child: Text(textOf(item, 'name')))).toList(),
          onChanged: (value) => setState(() => projectId = value),
        ),
        const SizedBox(height: 10),
        Text(enforced
            ? 'Đang dùng: ${activePlan?['name'] ?? 'Miễn phí'} · ${activePlan?['sources'] ?? 1} PDF · ${activePlan?['drafts'] ?? 1} bản thảo'
            : 'Dự án cũ giữ nguyên quyền sử dụng; không cần mua gói.',
            style: const TextStyle(color: muted)),
      ])),
      const Section('Chọn gói'),
      ...plans.map((plan) {
        final available = enforced && (ranks[textOf(plan, 'id')] ?? 0) > (ranks[activeId] ?? 0);
        return Padding(padding: const EdgeInsets.only(bottom: 14), child: Panel(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(textOf(plan, 'name'), style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 5),
            Text(textOf(plan, 'tagline'), style: const TextStyle(color: muted)),
            const SizedBox(height: 12),
            Text('${plan['amount']}đ', style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 12),
            ...strings(plan['highlights']).map((item) => Padding(padding: const EdgeInsets.only(bottom: 7), child: Row(children: [
              const Icon(Icons.check_circle_outline_rounded, color: teal, size: 18),
              const SizedBox(width: 8), Expanded(child: Text(item)),
            ]))),
            const SizedBox(height: 10),
            SizedBox(width: double.infinity, child: FilledButton.icon(
              onPressed: busy.isNotEmpty || !available ? null : () => checkout(plan),
              icon: const Icon(Icons.qr_code_rounded),
              label: Text(!enforced ? 'Đã có quyền sử dụng' : !available ? 'Gói đã có' : 'Thanh toán VietQR'),
            )),
          ],
        )));
      }),
      const Section('Giao dịch'),
      if (orders.isEmpty) const Text('Chưa có giao dịch.', style: TextStyle(color: muted)),
      ...orders.map((order) => Padding(padding: const EdgeInsets.only(bottom: 10), child: Panel(child: Row(children: [
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${order['plan_name']} · ${order['project_name'] ?? ''}', style: const TextStyle(fontWeight: FontWeight.bold)),
          Text(order['status'] == 'PAID' ? 'Đã thanh toán' : order['status'] == 'PENDING' ? 'Đang chờ xác nhận' : 'Đã hủy', style: const TextStyle(color: muted)),
        ])),
        if (order['status'] == 'PENDING') IconButton(onPressed: busy.isNotEmpty ? null : () => refresh(order), icon: const Icon(Icons.refresh_rounded), tooltip: 'Kiểm tra lại'),
      ])))),
      const SizedBox(height: 70),
    ]);
  }
}
