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
          IconButton(
            onPressed: _logout,
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
          ),
        ],
      ),
      body: _screens[_index],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _index,
        onTap: (idx) => setState(() => _index = idx),
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.link), label: 'Links'),
          BottomNavigationBarItem(icon: Icon(Icons.add_box), label: 'Create'),
          BottomNavigationBarItem(icon: Icon(Icons.bar_chart), label: 'Analytics'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Bio'),
          BottomNavigationBarItem(icon: Icon(Icons.qr_code), label: 'QR'),
        ],
      ),
    );
  }
}
