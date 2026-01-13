import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:oaklink_mobile/services/api_client.dart';
import 'package:oaklink_mobile/widgets/app_snackbar.dart';
import 'package:oaklink_mobile/widgets/empty_state.dart';
import 'package:url_launcher/url_launcher.dart';

class LinksScreen extends StatefulWidget {
  const LinksScreen({super.key});

  @override
  State<LinksScreen> createState() => _LinksScreenState();
}

class _LinksScreenState extends State<LinksScreen> {
  Future<List<dynamic>>? _future;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<dynamic>> _load() async {
    try {
      final res = await ApiClient.instance.get('/api/links');
      final data = res.data as Map<String, dynamic>;
      _errorMessage = null;
      return (data['data'] as List<dynamic>? ?? []);
    } catch (err) {
      _errorMessage = ApiClient.errorMessage(err);
      rethrow;
    }
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _open(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      showError(context, 'Unable to open link');
    }
  }

  void _copy(String value) {
    Clipboard.setData(ClipboardData(text: value));
    showSuccess(context, 'Copied to clipboard');
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: FutureBuilder<List<dynamic>>(
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
                  icon: Icons.warning_amber_rounded,
                  title: 'Unable to load links',
                  subtitle: _errorMessage ?? 'Check your connection and try again.',
                  action: FilledButton(
                    onPressed: _refresh,
                    child: const Text('Retry'),
                  ),
                ),
              ],
            );
          }
          final items = snapshot.data ?? [];
          if (items.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 80),
                EmptyState(
                  icon: Icons.link,
                  title: 'No links yet',
                  subtitle: 'Create your first short link to get started.',
                ),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              if (index == 0) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Your links', style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 6),
                    Text(
                      'Tap a link to open it. Use the copy icon to share.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 4),
                  ],
                );
              }
              final link = items[index - 1] as Map<String, dynamic>;
              final title = (link['title'] as String?)?.trim();
              final destination = link['url']?.toString() ?? '';
              final shortUrl = link['short_url'] as String? ?? '';
              final clicks = link['click_count'] ?? 0;
              return Card(
                child: Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title?.isNotEmpty == true ? title! : shortUrl,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(shortUrl, style: Theme.of(context).textTheme.bodyMedium),
                      if (destination.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          destination,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurfaceVariant,
                          ),
                        ),
                      ],
                      const SizedBox(height: 10),
                      Row(
                        children: [
                          Chip(label: Text('$clicks clicks')),
                          const Spacer(),
                          IconButton(
                            onPressed: shortUrl.isNotEmpty ? () => _copy(shortUrl) : null,
                            icon: const Icon(Icons.copy_rounded),
                            tooltip: 'Copy',
                          ),
                          IconButton(
                            onPressed: shortUrl.isNotEmpty ? () => _open(shortUrl) : null,
                            icon: const Icon(Icons.open_in_new),
                            tooltip: 'Open',
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
