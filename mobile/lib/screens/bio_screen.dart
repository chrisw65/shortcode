import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:oaklink_mobile/services/api_client.dart';
import 'package:oaklink_mobile/widgets/app_snackbar.dart';
import 'package:oaklink_mobile/widgets/empty_state.dart';
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
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<List<dynamic>> _load() async {
    try {
      final res = await ApiClient.instance.get('/api/bio');
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

  Future<void> _open(String slug) async {
    final uri = Uri.parse('${ApiClient.baseUrl}/b/$slug');
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _create() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
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
    } catch (err) {
      if (mounted) {
        showError(context, ApiClient.errorMessage(err));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _slugCtrl.dispose();
    _titleCtrl.dispose();
    super.dispose();
  }

  void _copy(String slug) {
    Clipboard.setData(ClipboardData(text: '${ApiClient.baseUrl}/b/$slug'));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Bio link copied')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _refresh,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text('Bio pages', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            'Create a simple link hub and share it anywhere.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Form(
                key: _formKey,
                child: Column(
                  children: [
                    TextFormField(
                      controller: _slugCtrl,
                      decoration: const InputDecoration(labelText: 'Slug'),
                      validator: (value) {
                        final text = value?.trim() ?? '';
                        if (text.isEmpty) return 'Slug is required';
                        if (text.contains(' ')) return 'Use dashes instead of spaces';
                        return null;
                      },
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _titleCtrl,
                      decoration: const InputDecoration(labelText: 'Title'),
                      validator: (value) {
                        if ((value ?? '').trim().isEmpty) return 'Title is required';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerRight,
                      child: FilledButton(
                        onPressed: _busy ? null : _create,
                        child: _busy
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Create page'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text('Your pages', style: Theme.of(context).textTheme.titleMedium),
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
              if (snapshot.hasError) {
                return EmptyState(
                  icon: Icons.warning_amber_rounded,
                  title: 'Unable to load pages',
                  subtitle: _errorMessage ?? 'Pull down to refresh.',
                );
              }
              final items = snapshot.data ?? [];
              if (items.isEmpty) {
                return const EmptyState(
                  icon: Icons.person_outline,
                  title: 'No bio pages yet',
                  subtitle: 'Create your first page to start sharing.',
                );
              }
              return Column(
                children: items.map((page) {
                  final p = page as Map<String, dynamic>;
                  return Card(
                    child: ListTile(
                      title: Text(p['title']?.toString() ?? p['slug']?.toString() ?? ''),
                      subtitle: Text('/${p['slug']}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.copy_rounded),
                            onPressed: () => _copy(p['slug']?.toString() ?? ''),
                          ),
                          IconButton(
                            icon: const Icon(Icons.open_in_new),
                            onPressed: () => _open(p['slug']?.toString() ?? ''),
                          ),
                        ],
                      ),
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
