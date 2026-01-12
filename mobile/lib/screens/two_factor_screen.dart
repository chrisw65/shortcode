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
  final _formKey = GlobalKey<FormState>();
  bool _busy = false;
  String? _error;
  AutovalidateMode _autovalidate = AutovalidateMode.disabled;

  Future<void> _submit(String challengeToken) async {
    FocusScope.of(context).unfocus();
    if (!_formKey.currentState!.validate()) {
      setState(() => _autovalidate = AutovalidateMode.onUserInteraction);
      return;
    }
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
  void dispose() {
    _codeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final token = ModalRoute.of(context)?.settings.arguments as String?;
    return Scaffold(
      appBar: AppBar(title: const Text('Two-factor')),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Form(
                  key: _formKey,
                  autovalidateMode: _autovalidate,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'Confirm your code',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      const Text('Enter the 6-digit code from your authenticator app.'),
                      const SizedBox(height: 16),
                      TextFormField(
                        controller: _codeCtrl,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: '2FA code'),
                        validator: (value) {
                          final text = value?.trim() ?? '';
                          if (text.length != 6) return 'Enter a 6-digit code';
                          return null;
                        },
                      ),
                      const SizedBox(height: 12),
                      if (_error != null)
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Theme.of(context).colorScheme.error.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _error!,
                            style: TextStyle(color: Theme.of(context).colorScheme.error),
                          ),
                        ),
                      const SizedBox(height: 12),
                      FilledButton(
                        onPressed: (_busy || token == null) ? null : () => _submit(token),
                        child: _busy
                            ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Text('Verify'),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
