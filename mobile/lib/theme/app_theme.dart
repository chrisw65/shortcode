import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color ink = Color(0xFF101418);
  static const Color charcoal = Color(0xFF1B2229);
  static const Color slate = Color(0xFF5B6470);
  static const Color mist = Color(0xFFF0E8DD);
  static const Color sand = Color(0xFFF6F2EA);
  static const Color emerald = Color(0xFF1E6F62);
  static const Color gold = Color(0xFFC89B4A);
  static const Color border = Color(0xFFE2D8C8);
  static const Color danger = Color(0xFFD95B57);

  static ThemeData light() {
    final baseScheme = ColorScheme.fromSeed(
      seedColor: emerald,
      brightness: Brightness.light,
    ).copyWith(
      primary: emerald,
      secondary: gold,
      surface: Colors.white,
      surfaceVariant: mist,
      background: sand,
      error: danger,
      onPrimary: Colors.white,
      onSecondary: ink,
      onSurface: ink,
      onSurfaceVariant: slate,
      onBackground: ink,
      onError: Colors.white,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: baseScheme,
    );

    return base.copyWith(
      scaffoldBackgroundColor: sand,
      textTheme: GoogleFonts.manropeTextTheme(base.textTheme)
          .apply(bodyColor: ink, displayColor: ink)
          .copyWith(
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
        elevation: 0.2,
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
        labelStyle: const TextStyle(color: slate, fontWeight: FontWeight.w600),
        hintStyle: const TextStyle(color: slate),
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
          backgroundColor: emerald,
          foregroundColor: Colors.white,
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
      chipTheme: ChipThemeData(
        backgroundColor: const Color(0xFFF3EEE5),
        selectedColor: mist,
        side: const BorderSide(color: border),
        labelStyle: const TextStyle(color: ink, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
      listTileTheme: const ListTileThemeData(
        textColor: ink,
        iconColor: slate,
      ),
    );
  }
}
