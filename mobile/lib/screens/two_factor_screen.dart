import 'package:flutter/material.dart';
import 'package:oaklink_mobile/screens/home_screen.dart';
import 'package:oaklink_mobile/services/auth_service.dart';

class TwoFactorScreen extends StatefulWidget {
  static const routeName = '/2fa';
  const TwoFactorScreen({super.key});

  @override
  State<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends State<TwoFactorScreen> {
  final _codeCtrl = TextEditingController();
  bool _busy = false;
  String? _error;

  Future<void> _submit(String challengeToken) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final result = await AuthService.instance.confirm2fa(
      challengeToken,
      _codeCtrl.text.trim(),
    );
    if (!mounted) return;
    setState(() => _busy = false);
    if (result.success) {
      Navigator.pushReplacementNamed(context, HomeScreen.routeName);
    } else {
      setState(() => _error = result.error ?? 'Invalid code');
    }
  }

  @override
  Widget build(BuildContext context) {
    final token = ModalRoute.of(context)?.settings.arguments as String?;
    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Enter the 6-digit code from your authenticator app.'),
            const SizedBox(height: 16),
            TextField(
              controller: _codeCtrl,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: '2FA code'),
            ),
            const SizedBox(height: 12),
            if (_error != null)
              Text(_error!, style: const TextStyle(color: Colors.redAccent)),
            const SizedBox(height: 8),
            FilledButton(
              onPressed: (_busy || token == null) ? null : () => _submit(token),
              child: _busy
                  ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Verify'),
            ),
          ],
        ),
      ),
    );
  }
}
