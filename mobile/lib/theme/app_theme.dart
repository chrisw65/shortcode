import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color ink = Color(0xFF0E1114);
  static const Color charcoal = Color(0xFF1C232B);
  static const Color slate = Color(0xFF4B5563);
  static const Color mist = Color(0xFFF1ECE4);
  static const Color sand = Color(0xFFF7F3EE);
  static const Color emerald = Color(0xFF2F7A6F);
  static const Color gold = Color(0xFFC9A45C);
  static const Color border = Color(0xFFE4DED2);
  static const Color danger = Color(0xFFE06D6A);

  static ThemeData light() {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(
        seedColor: emerald,
        primary: emerald,
        secondary: gold,
        surface: Colors.white,
        background: sand,
        error: danger,
        brightness: Brightness.light,
      ),
    );

    return base.copyWith(
      scaffoldBackgroundColor: sand,
      textTheme: GoogleFonts.manropeTextTheme(base.textTheme).copyWith(
        headlineSmall: GoogleFonts.manrope(fontWeight: FontWeight.w700),
        titleLarge: GoogleFonts.manrope(fontWeight: FontWeight.w700),
        titleMedium: GoogleFonts.manrope(fontWeight: FontWeight.w600),
        bodyLarge: GoogleFonts.manrope(),
        bodyMedium: GoogleFonts.manrope(),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: sand,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: ink,
          fontSize: 18,
          fontWeight: FontWeight.w700,
        ),
        iconTheme: IconThemeData(color: ink),
      ),
      cardTheme: CardTheme(
        color: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: mist,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: emerald, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: danger),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
          side: const BorderSide(color: border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: charcoal,
        contentTextStyle: TextStyle(color: Colors.white),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: sand,
        indicatorColor: mist,
        labelTextStyle: MaterialStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(MaterialState.selected) ? ink : slate,
            fontWeight: FontWeight.w600,
          ),
        ),
        iconTheme: MaterialStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(MaterialState.selected) ? ink : slate,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(color: border, thickness: 1, space: 24),
    );
  }
}
