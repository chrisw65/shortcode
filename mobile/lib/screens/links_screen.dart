import 'package:flutter/material.dart';
import 'package:oaklink_mobile/services/api_client.dart';
import 'package:url_launcher/url_launcher.dart';

class LinksScreen extends StatefulWidget {
  const LinksScreen({super.key});

  @override
  State<LinksScreen> createState() => _LinksScreenState();
}

class _LinksScreenState extends State<LinksScreen> {
  Future<List<dynamic>>? _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<dynamic>> _load() async {
    final res = await ApiClient.instance.get('/api/links');
    final data = res.data as Map<String, dynamic>;
    return (data['data'] as List<dynamic>? ?? []);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _open(String url) async {
    final uri = Uri.parse(url);
    if (!await launchUrl(uri, mode: LaunchMode.externalApplication)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open link')),
      );
    }
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
          final items = snapshot.data ?? [];
          if (items.isEmpty) {
            return ListView(
              children: const [
                SizedBox(height: 120),
                Center(child: Text('No links yet.')),
              ],
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final link = items[index] as Map<String, dynamic>;
              final title = (link['title'] as String?)?.trim();
              final shortUrl = link['short_url'] as String? ?? '';
              final clicks = link['click_count'] ?? 0;
              return Card(
                child: ListTile(
                  title: Text(title?.isNotEmpty == true ? title! : shortUrl),
                  subtitle: Text(shortUrl),
                  trailing: Text('$clicks'),
                  onTap: shortUrl.isNotEmpty ? () => _open(shortUrl) : null,
                ),
              );
            },
          );
        },
      ),
    );
  }
}
