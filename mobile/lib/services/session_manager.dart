import 'package:flutter/material.dart';

class SessionManager {
  static final navigatorKey = GlobalKey<NavigatorState>();
  static String _loginRoute = '/login';

  static void configure({required String loginRoute}) {
    _loginRoute = loginRoute;
  }

  static void redirectToLogin() {
    final nav = navigatorKey.currentState;
    if (nav == null) return;
    nav.pushNamedAndRemoveUntil(_loginRoute, (route) => false);
  }
}
