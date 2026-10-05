import 'package:flutter/material.dart';

import '../data/api.dart';
import '../ui/design.dart';

class AdminScreen extends StatefulWidget {
  const AdminScreen({super.key, required this.api});
  final PaperApi api;
  @override
  State<AdminScreen> createState() => _AdminScreenState();
}

class _AdminScreenState extends State<AdminScreen> {
  Json? data;
  Object? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = object(await widget.api.request('/admin/overview'));
      if (mounted) setState(() => data = result);
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (error != null)
      return PageBody(children: [ErrorNotice(error!, retry: load)]);
    if (data == null)
      return const PageBody(children: [Working('Đang tải báo cáo…')]);
    final trend = objects(data!['trend']);
    final maximum = trend.fold<double>(1, (max, item) {
      final value = (item['revenue'] as num?)?.toDouble() ?? 0;
      return value > max ? value : max;
    });
    return PageBody(
      children: [
        Text(
          'Toàn cảnh\ndoanh thu.',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 8),
        const Text(
          'Chỉ tính đơn PayOS đã xác nhận.',
          style: TextStyle(color: muted),
        ),
        const SizedBox(height: 20),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            metric(
              'Doanh thu',
              '${data!['revenue']}đ',
              Icons.payments_outlined,
            ),
            metric(
              'Đơn thành công',
              '${data!['paid_orders']}',
              Icons.receipt_long_outlined,
            ),
            metric(
              'Khách trả phí',
              '${data!['customers']}',
              Icons.people_outline,
            ),
            metric(
              'Đang chờ',
              '${data!['pending_orders']}',
              Icons.schedule_outlined,
            ),
          ],
        ),
        const Section('Doanh thu 7 ngày'),
        Panel(
          child: SizedBox(
            height: 210,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: trend.map((item) {
                final amount = (item['revenue'] as num?)?.toDouble() ?? 0;
                return Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Text(
                        '${item['revenue']}đ',
                        style: const TextStyle(fontSize: 9, color: muted),
                      ),
                      const SizedBox(height: 6),
                      Container(
                        height: amount / maximum * 130 + 4,
                        margin: const EdgeInsets.symmetric(horizontal: 5),
                        decoration: BoxDecoration(
                          color: teal,
                          borderRadius: BorderRadius.circular(8),
                        ),
                      ),
                      const SizedBox(height: 7),
                      Text(
                        textOf(
                          item,
                          'day',
                        ).replaceFirst(RegExp(r'^\\d{4}-'), ''),
                        style: const TextStyle(fontSize: 10),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ),
        const SizedBox(height: 70),
      ],
    );
  }

  Widget metric(String label, String value, IconData icon) => SizedBox(
    width: 170,
    child: Panel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: teal),
          const SizedBox(height: 14),
          Text(label, style: const TextStyle(color: muted, fontSize: 12)),
          Text(
            value,
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: ink,
            ),
          ),
        ],
      ),
    ),
  );
}
