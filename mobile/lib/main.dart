import 'package:flutter/material.dart';
import 'package:oaklink_mobile/screens/home_screen.dart';
import 'package:oaklink_mobile/screens/login_screen.dart';
import 'package:oaklink_mobile/screens/two_factor_screen.dart';
import 'package:oaklink_mobile/services/api_client.dart';
import 'package:oaklink_mobile/services/auth_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient.init();
  runApp(const OaklinkApp());
}

class OaklinkApp extends StatelessWidget {
  const OaklinkApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Oaklink Mobile',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF0B0D10)),
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF6F4EF),
      ),
      home: const SessionGate(),
      routes: {
        LoginScreen.routeName: (_) => const LoginScreen(),
        TwoFactorScreen.routeName: (_) => const TwoFactorScreen(),
        HomeScreen.routeName: (_) => const HomeScreen(),
      },
    );
  }
}

class SessionGate extends StatefulWidget {
  const SessionGate({super.key});

  @override
  State<SessionGate> createState() => _SessionGateState();
}

class _SessionGateState extends State<SessionGate> {
  late Future<bool> _sessionFuture;

  @override
  void initState() {
    super.initState();
    _sessionFuture = AuthService.instance.hasSession();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _sessionFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.data == true) {
          return const HomeScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
