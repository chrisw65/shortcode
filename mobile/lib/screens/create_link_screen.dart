import 'package:flutter/material.dart';
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
  bool _busy = false;
  String? _message;
  List<dynamic> _domains = [];
  String? _domainId;

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
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final payload = {
        'url': _urlCtrl.text.trim(),
        'title': _titleCtrl.text.trim(),
        'short_code': _codeCtrl.text.trim(),
        if (_domainId != null && _domainId!.isNotEmpty) 'domain_id': _domainId,
      };
      final res = await ApiClient.instance.post('/api/links', data: payload);
      final data = res.data as Map<String, dynamic>;
      if (data['success'] == true) {
        setState(() => _message = 'Link created');
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
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('Create a short link', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        const SizedBox(height: 12),
        TextField(
          controller: _urlCtrl,
          decoration: const InputDecoration(labelText: 'Destination URL'),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _titleCtrl,
          decoration: const InputDecoration(labelText: 'Title (optional)'),
        ),
        const SizedBox(height: 12),
        TextField(
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
          onChanged: (value) => setState(() => _domainId = value),
        ),
        const SizedBox(height: 16),
        if (_message != null) Text(_message!),
        const SizedBox(height: 8),
        FilledButton(
          onPressed: _busy ? null : _create,
          child: _busy
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Create link'),
        ),
      ],
    );
  }
}
