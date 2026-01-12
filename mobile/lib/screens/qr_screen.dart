import 'package:flutter/material.dart';
import 'package:oaklink_mobile/services/api_client.dart';

class QrScreen extends StatefulWidget {
  const QrScreen({super.key});

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  final _codeCtrl = TextEditingController();
  final _colorCtrl = TextEditingController(text: '#0b0d10');
  final _bgCtrl = TextEditingController(text: '#ffffff');
  final _sizeCtrl = TextEditingController(text: '256');
  final _marginCtrl = TextEditingController(text: '1');
  final _eccCtrl = TextEditingController(text: 'M');
  final _logoCtrl = TextEditingController();
  final _logoScaleCtrl = TextEditingController(text: '0.22');
  String? _message;

  String get _qrUrl {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) return '';
    final params = <String, String>{
      'color': _colorCtrl.text.trim(),
      'bg': _bgCtrl.text.trim(),
      'size': _sizeCtrl.text.trim(),
      'margin': _marginCtrl.text.trim(),
      'ecc': _eccCtrl.text.trim().toUpperCase(),
    };
    final logo = _logoCtrl.text.trim();
    if (logo.isNotEmpty) {
      params['logo'] = logo;
      params['logo_scale'] = _logoScaleCtrl.text.trim();
    }
    final query = Uri(queryParameters: params).query;
    return '${ApiClient.baseUrl}/api/qr/$code.png?$query';
  }

  Future<void> _save() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) return;
    setState(() => _message = null);
    final payload = {
      'color': _colorCtrl.text.trim(),
      'bg_color': _bgCtrl.text.trim(),
      'size': int.tryParse(_sizeCtrl.text.trim()) ?? 256,
      'margin': int.tryParse(_marginCtrl.text.trim()) ?? 1,
      'error_correction': _eccCtrl.text.trim().toUpperCase(),
      'logo_url': _logoCtrl.text.trim(),
      'logo_scale': double.tryParse(_logoScaleCtrl.text.trim()) ?? 0.22,
    };
    try {
      await ApiClient.instance.put('/api/links/$code/qr-settings', data: payload);
      setState(() => _message = 'Saved QR settings');
    } catch (_) {
      setState(() => _message = 'Failed to save QR settings');
    }
  }

  @override
  Widget build(BuildContext context) {
    final url = _qrUrl;
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const Text('QR tools', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        const SizedBox(height: 12),
        TextField(
          controller: _codeCtrl,
          decoration: const InputDecoration(labelText: 'Short code'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _colorCtrl,
          decoration: const InputDecoration(labelText: 'Color (hex)'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _bgCtrl,
          decoration: const InputDecoration(labelText: 'Background (hex)'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _sizeCtrl,
                decoration: const InputDecoration(labelText: 'Size'),
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: TextField(
                controller: _marginCtrl,
                decoration: const InputDecoration(labelText: 'Margin'),
                keyboardType: TextInputType.number,
                onChanged: (_) => setState(() {}),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _eccCtrl,
          decoration: const InputDecoration(labelText: 'Error correction (L/M/Q/H)'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _logoCtrl,
          decoration: const InputDecoration(labelText: 'Logo URL (optional)'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _logoScaleCtrl,
          decoration: const InputDecoration(labelText: 'Logo scale (0.1-0.45)'),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _save,
          child: const Text('Save QR settings'),
        ),
        if (_message != null) Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(_message!),
        ),
        const SizedBox(height: 20),
        if (url.isNotEmpty)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Image.network(url, height: 240, fit: BoxFit.contain),
            ),
          ),
      ],
    );
  }
}
