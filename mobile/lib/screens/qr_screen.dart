import 'package:flutter/material.dart';
import 'package:oaklink_mobile/services/api_client.dart';
import 'package:oaklink_mobile/widgets/empty_state.dart';

class QrScreen extends StatefulWidget {
  const QrScreen({super.key});

  @override
  State<QrScreen> createState() => _QrScreenState();
}

class _QrScreenState extends State<QrScreen> {
  final _codeCtrl = TextEditingController();
  final _colorCtrl = TextEditingController(text: '#0b0d10');
  final _bgCtrl = TextEditingController(text: '#ffffff');
  final _logoCtrl = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  double _size = 256;
  double _margin = 1;
  String _ecc = 'M';
  double _logoScale = 0.22;
  String? _message;

  String get _qrUrl {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) return '';
    final params = <String, String>{
      'color': _colorCtrl.text.trim(),
      'bg': _bgCtrl.text.trim(),
      'size': _size.round().toString(),
      'margin': _margin.round().toString(),
      'ecc': _ecc,
    };
    final logo = _logoCtrl.text.trim();
    if (logo.isNotEmpty) {
      params['logo'] = logo;
      params['logo_scale'] = _logoScale.toStringAsFixed(2);
    }
    final query = Uri(queryParameters: params).query;
    return '${ApiClient.baseUrl}/api/qr/$code.png?$query';
  }

  Future<void> _save() async {
    final code = _codeCtrl.text.trim();
    if (code.isEmpty) return;
    if (!_formKey.currentState!.validate()) return;
    setState(() => _message = null);
    final payload = {
      'color': _colorCtrl.text.trim(),
      'bg_color': _bgCtrl.text.trim(),
      'size': _size.round(),
      'margin': _margin.round(),
      'error_correction': _ecc,
      'logo_url': _logoCtrl.text.trim(),
      'logo_scale': _logoScale,
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
        Text('QR studio', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(
          'Customize colors, sizing, and optional logo overlays.',
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
                    controller: _codeCtrl,
                    decoration: const InputDecoration(labelText: 'Short code'),
                    onChanged: (_) => setState(() {}),
                    validator: (value) {
                      if ((value ?? '').trim().isEmpty) return 'Short code is required';
                      return null;
                    },
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _colorCtrl,
                          decoration: const InputDecoration(labelText: 'QR color'),
                          onChanged: (_) => setState(() {}),
                          validator: (value) {
                            final text = (value ?? '').trim();
                            if (!RegExp(r'^#([0-9a-fA-F]{6})$').hasMatch(text)) {
                              return 'Use #RRGGBB format';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: _parseColor(_colorCtrl.text),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Theme.of(context).dividerColor),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _bgCtrl,
                          decoration: const InputDecoration(labelText: 'Background'),
                          onChanged: (_) => setState(() {}),
                          validator: (value) {
                            final text = (value ?? '').trim();
                            if (!RegExp(r'^#([0-9a-fA-F]{6})$').hasMatch(text)) {
                              return 'Use #RRGGBB format';
                            }
                            return null;
                          },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: _parseColor(_bgCtrl.text),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Theme.of(context).dividerColor),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  _SliderRow(
                    label: 'Size',
                    value: _size,
                    min: 128,
                    max: 512,
                    suffix: 'px',
                    onChanged: (value) => setState(() => _size = value),
                  ),
                  _SliderRow(
                    label: 'Margin',
                    value: _margin,
                    min: 0,
                    max: 8,
                    suffix: 'px',
                    onChanged: (value) => setState(() => _margin = value),
                  ),
                  const SizedBox(height: 12),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('Error correction', style: Theme.of(context).textTheme.bodyMedium),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    children: ['L', 'M', 'Q', 'H'].map((value) {
                      return ChoiceChip(
                        label: Text(value),
                        selected: _ecc == value,
                        onSelected: (_) => setState(() => _ecc = value),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _logoCtrl,
                    decoration: const InputDecoration(labelText: 'Logo URL (optional)'),
                    onChanged: (_) => setState(() {}),
                  ),
                  const SizedBox(height: 12),
                  _SliderRow(
                    label: 'Logo scale',
                    value: _logoScale,
                    min: 0.1,
                    max: 0.45,
                    suffix: '',
                    onChanged: (value) => setState(() => _logoScale = value),
                  ),
                  const SizedBox(height: 16),
                  Align(
                    alignment: Alignment.centerRight,
                    child: FilledButton(
                      onPressed: _save,
                      child: const Text('Save QR settings'),
                    ),
                  ),
                  if (_message != null) ...[
                    const SizedBox(height: 8),
                    Text(_message!),
                  ],
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (url.isEmpty)
          const EmptyState(
            icon: Icons.qr_code_2,
            title: 'Preview your QR code',
            subtitle: 'Enter a short code to generate a live preview.',
          )
        else
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Image.network(url, height: 260, fit: BoxFit.contain),
            ),
          ),
      ],
    );
  }

  Color _parseColor(String input) {
    final hex = input.replaceAll('#', '');
    if (hex.length != 6) return Colors.transparent;
    try {
      return Color(int.parse('FF$hex', radix: 16));
    } catch (_) {
      return Colors.transparent;
    }
  }

  @override
  void dispose() {
    _codeCtrl.dispose();
    _colorCtrl.dispose();
    _bgCtrl.dispose();
    _logoCtrl.dispose();
    super.dispose();
  }
}

class _SliderRow extends StatelessWidget {
  final String label;
  final double value;
  final double min;
  final double max;
  final String suffix;
  final ValueChanged<double> onChanged;

  const _SliderRow({
    required this.label,
    required this.value,
    required this.min,
    required this.max,
    required this.suffix,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final display = value.toStringAsFixed(value < 1 ? 2 : 0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(label, style: Theme.of(context).textTheme.bodyMedium),
            const Spacer(),
            Text('$display$suffix', style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
        Slider(
          value: value,
          min: min,
          max: max,
          divisions: max == min ? null : 20,
          onChanged: onChanged,
        ),
      ],
    );
  }
}
