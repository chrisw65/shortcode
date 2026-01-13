import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:oaklink_mobile/services/api_client.dart';

class CreateLinkScreen extends StatefulWidget {
  const CreateLinkScreen({super.key});

  @override
  State<CreateLinkScreen> createState() => _CreateLinkScreenState();
}

class _CreateLinkScreenState extends State<CreateLinkScreen> {
  final _urlCtrl = TextEditingController();
  final _titleCtrl = TextEditingController();
  final _codeCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;
  String? _message;
  String? _lastShortUrl;
  List<dynamic> _domains = [];
  String _domainId = '';

  @override
  void initState() {
    super.initState();
    _loadDomains();
  }

  Future<void> _loadDomains() async {
    try {
      final res = await ApiClient.instance.get('/api/domains');
      final data = res.data as Map<String, dynamic>;
      final list = data['data'] as List<dynamic>? ?? [];
      setState(() => _domains = list);
    } catch (_) {
      // ignore
    }
  }

  Future<void> _create() async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _message = null;
      _lastShortUrl = null;
    });
    try {
      final payload = {
        'url': _urlCtrl.text.trim(),
        'title': _titleCtrl.text.trim(),
        'short_code': _codeCtrl.text.trim(),
        if (_domainId.isNotEmpty) 'domain_id': _domainId,
      };
      final res = await ApiClient.instance.post('/api/links', data: payload);
      final data = res.data as Map<String, dynamic>;
      if (data['success'] == true) {
        final created = data['data'] as Map<String, dynamic>?;
        setState(() {
          _message = 'Link created';
          _lastShortUrl = created?['short_url']?.toString();
        });
        _urlCtrl.clear();
        _titleCtrl.clear();
        _codeCtrl.clear();
      } else {
        setState(() => _message = data['error']?.toString() ?? 'Failed to create');
      }
    } catch (err) {
      setState(() => _message = 'Failed to create');
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _urlCtrl.dispose();
    _titleCtrl.dispose();
    _codeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text(
          'Create a short link',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 6),
        Text(
          'Shorten a destination and choose a custom domain when available.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 16),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  TextFormField(
                    controller: _urlCtrl,
                    decoration: const InputDecoration(labelText: 'Destination URL'),
                    keyboardType: TextInputType.url,
                    validator: (value) {
                      final text = value?.trim() ?? '';
                      final uri = Uri.tryParse(text);
                      if (text.isEmpty) return 'URL is required';
                      if (uri == null || !(uri.hasScheme && uri.hasAuthority)) {
                        return 'Enter a valid URL';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _titleCtrl,
                    decoration: const InputDecoration(labelText: 'Title (optional)'),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _codeCtrl,
                    decoration: const InputDecoration(labelText: 'Custom code (optional)'),
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _domainId,
                    decoration: const InputDecoration(labelText: 'Domain'),
                    items: [
                      const DropdownMenuItem(value: '', child: Text('Default domain')),
                      ..._domains.map((d) {
                        final dom = d as Map<String, dynamic>;
                        return DropdownMenuItem(
                          value: dom['id']?.toString() ?? '',
                          child: Text(dom['domain']?.toString() ?? ''),
                        );
                      }),
                    ],
                    onChanged: (value) => setState(() => _domainId = value ?? ''),
                  ),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _busy ? null : _create,
                    child: _busy
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Create link'),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (_message != null) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Icon(
                    _lastShortUrl == null ? Icons.info_outline : Icons.check_circle,
                    color: _lastShortUrl == null
                        ? Theme.of(context).colorScheme.onSurfaceVariant
                        : Theme.of(context).colorScheme.secondary,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_message!),
                        if (_lastShortUrl != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(
                              _lastShortUrl!,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: Theme.of(context).colorScheme.onSurfaceVariant,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (_lastShortUrl != null)
                    IconButton(
                      icon: const Icon(Icons.copy_rounded),
                      tooltip: 'Copy',
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: _lastShortUrl!));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Copied to clipboard')),
                        );
                      },
                    ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }
}
