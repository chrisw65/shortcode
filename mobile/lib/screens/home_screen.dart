import 'package:flutter/material.dart';
import 'package:oaklink_mobile/screens/analytics_screen.dart';
import 'package:oaklink_mobile/screens/bio_screen.dart';
import 'package:oaklink_mobile/screens/create_link_screen.dart';
import 'package:oaklink_mobile/screens/links_screen.dart';
import 'package:oaklink_mobile/screens/qr_screen.dart';
import 'package:oaklink_mobile/screens/login_screen.dart';
import 'package:oaklink_mobile/services/auth_service.dart';

class HomeScreen extends StatefulWidget {
  static const routeName = '/home';
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _index = 0;

  final _screens = const [
    LinksScreen(),
    CreateLinkScreen(),
    AnalyticsScreen(),
    BioScreen(),
    QrScreen(),
  ];

  Future<void> _logout() async {
    await AuthService.instance.logout();
    if (!mounted) return;
    Navigator.pushReplacementNamed(context, LoginScreen.routeName);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Oaklink Mobile'),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert),
            onSelected: (value) {
              if (value == 'logout') _logout();
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'logout', child: Text('Sign out')),
            ],
          ),
        ],
      ),
      body: _screens[_index],
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (idx) => setState(() => _index = idx),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.link), label: 'Links'),
          NavigationDestination(icon: Icon(Icons.add_box), label: 'Create'),
          NavigationDestination(icon: Icon(Icons.bar_chart), label: 'Analytics'),
          NavigationDestination(icon: Icon(Icons.person), label: 'Bio'),
          NavigationDestination(icon: Icon(Icons.qr_code), label: 'QR'),
        ],
      ),
    );
  }
}
