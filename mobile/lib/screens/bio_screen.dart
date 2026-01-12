import 'package:flutter/material.dart';
import 'package:oaklink_mobile/services/api_client.dart';
import 'package:url_launcher/url_launcher.dart';

class BioScreen extends StatefulWidget {
  const BioScreen({super.key});

  @override
  State<BioScreen> createState() => _BioScreenState();
}

class _BioScreenState extends State<BioScreen> {
  Future<List<dynamic>>? _future;
  final _slugCtrl = TextEditingController();
  final _titleCtrl = TextEditingController();
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<dynamic>> _load() async {
    final res = await ApiClient.instance.get('/api/bio');
    final data = res.data as Map<String, dynamic>;
    return (data['data'] as List<dynamic>? ?? []);
  }

  Future<void> _refresh() async {
    setState(() => _future = _load());
    await _future;
  }

  Future<void> _open(String slug) async {
    final uri = Uri.parse('${ApiClient.baseUrl}/b/$slug');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _create() async {
    setState(() => _busy = true);
    final payload = {
      'slug': _slugCtrl.text.trim(),
      'title': _titleCtrl.text.trim(),
    };
    try {
      await ApiClient.instance.post('/api/bio', data: payload);
      _slugCtrl.clear();
      _titleCtrl.clear();
      await _refresh();
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to create page')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          const Text('Create bio page', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          TextField(
            controller: _slugCtrl,
            decoration: const InputDecoration(labelText: 'Slug'),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _titleCtrl,
            decoration: const InputDecoration(labelText: 'Title'),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _busy ? null : _create,
            child: _busy
                ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Create'),
          ),
          const SizedBox(height: 20),
          const Text('Your pages', style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          FutureBuilder<List<dynamic>>(
            future: _future,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              final items = snapshot.data ?? [];
              if (items.isEmpty) {
                return const Text('No bio pages yet.');
              }
              return Column(
                children: items.map((page) {
                  final p = page as Map<String, dynamic>;
                  return Card(
                    child: ListTile(
                      title: Text(p['title']?.toString() ?? p['slug']?.toString() ?? ''),
                      subtitle: Text('/${p['slug']}'),
                      trailing: const Icon(Icons.open_in_new),
                      onTap: () => _open(p['slug']?.toString() ?? ''),
                    ),
                  );
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }
}
