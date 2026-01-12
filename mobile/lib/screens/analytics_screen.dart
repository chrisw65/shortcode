import 'package:flutter/material.dart';
import 'package:oaklink_mobile/services/api_client.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  Future<Map<String, dynamic>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final res = await ApiClient.instance.get('/api/analytics/summary');
    final data = res.data as Map<String, dynamic>;
    return data['data'] as Map<String, dynamic>? ?? {};
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          final data = snapshot.data ?? {};
          final total = data['total_clicks'] ?? 0;
          final clicks24h = data['clicks_24h'] ?? 0;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Card(
                child: ListTile(
                  title: const Text('Total clicks'),
                  trailing: Text('$total'),
                ),
              ),
              const SizedBox(height: 12),
              Card(
                child: ListTile(
                  title: const Text('Clicks (24h)'),
                  trailing: Text('$clicks24h'),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
