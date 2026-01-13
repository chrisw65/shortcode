import 'package:flutter/material.dart';
import 'package:oaklink_mobile/services/api_client.dart';
import 'package:oaklink_mobile/widgets/empty_state.dart';
import 'package:oaklink_mobile/widgets/stat_card.dart';

class AnalyticsScreen extends StatefulWidget {
  const AnalyticsScreen({super.key});

  @override
  State<AnalyticsScreen> createState() => _AnalyticsScreenState();
}

class _AnalyticsScreenState extends State<AnalyticsScreen> {
  Future<Map<String, dynamic>>? _future;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    try {
      final res = await ApiClient.instance.get('/api/analytics/summary');
      final data = res.data as Map<String, dynamic>;
      _errorMessage = null;
      return data['data'] as Map<String, dynamic>? ?? {};
    } catch (err) {
      _errorMessage = ApiClient.errorMessage(err);
      rethrow;
    }
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
          if (snapshot.hasError) {
            return ListView(
              padding: const EdgeInsets.all(24),
              children: [
                EmptyState(
                  icon: Icons.bar_chart,
                  title: 'Analytics unavailable',
                  subtitle: _errorMessage ?? 'Pull to refresh or try again in a moment.',
                  action: FilledButton(
                    onPressed: _refresh,
                    child: const Text('Retry'),
                  ),
                ),
              ],
            );
          }
          final data = snapshot.data ?? {};
          final total = data['total_clicks'] ?? 0;
          final clicks24h = data['clicks_24h'] ?? 0;
          final unique24h = data['unique_24h'] ?? 0;
          final linksTotal = data['links_total'] ?? 0;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text('Overview', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              StatCard(
                label: 'Total clicks',
                value: '$total',
                helper: 'All time',
                icon: Icons.stacked_line_chart,
              ),
              const SizedBox(height: 12),
              StatCard(
                label: 'Clicks (24h)',
                value: '$clicks24h',
                helper: 'Last 24 hours',
                icon: Icons.bolt,
              ),
              const SizedBox(height: 12),
              StatCard(
                label: 'Unique (24h)',
                value: '$unique24h',
                helper: 'Estimated unique clicks',
                icon: Icons.person_outline,
              ),
              const SizedBox(height: 12),
              StatCard(
                label: 'Links tracked',
                value: '$linksTotal',
                helper: 'Active links in your org',
                icon: Icons.link_rounded,
              ),
            ],
          );
        },
      ),
    );
  }
}
