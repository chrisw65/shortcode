import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const Color bg = Color(0xFF0A0D12);
  static const Color bg2 = Color(0xFF10151D);
  static const Color panel = Color(0xFF151B24);
  static const Color panel2 = Color(0xFF0F1620);
  static const Color text = Color(0xFFF5F3EF);
  static const Color muted = Color(0xFFA59F96);
  static const Color accent = Color(0xFFD5A24B);
  static const Color accent2 = Color(0xFF2FB7A4);
  static const Color border = Color(0xFF262F3A);
  static const Color danger = Color(0xFFFF7B7B);

  static ThemeData dark() {
    final baseScheme = const ColorScheme(
      brightness: Brightness.dark,
      primary: accent,
      onPrimary: Color(0xFF141414),
      secondary: accent2,
      onSecondary: text,
      error: danger,
      onError: text,
      background: bg,
      onBackground: text,
      surface: panel,
      onSurface: text,
    ).copyWith(
      surfaceVariant: panel2,
      onSurfaceVariant: muted,
      outline: border,
    );

    final base = ThemeData(
      useMaterial3: true,
      colorScheme: baseScheme,
    );

    final bodyFont = GoogleFonts.spaceGroteskTextTheme(base.textTheme)
        .apply(bodyColor: text, displayColor: text);
    final titleFont = GoogleFonts.newsreaderTextTheme(base.textTheme)
        .apply(bodyColor: text, displayColor: text);

    return base.copyWith(
      scaffoldBackgroundColor: bg,
      textTheme: bodyFont.copyWith(
        headlineSmall: titleFont.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
        titleLarge: titleFont.titleLarge?.copyWith(fontWeight: FontWeight.w600),
        titleMedium: titleFont.titleMedium?.copyWith(fontWeight: FontWeight.w600),
        bodyLarge: bodyFont.bodyLarge,
        bodyMedium: bodyFont.bodyMedium,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: panel2,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        titleTextStyle: TextStyle(
          color: text,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.2,
        ),
        iconTheme: IconThemeData(color: text),
      ),
      cardTheme: CardTheme(
        color: panel,
        elevation: 0,
        shadowColor: Colors.black54,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(18),
          side: const BorderSide(color: border),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: panel2,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        labelStyle: const TextStyle(color: muted, fontWeight: FontWeight.w600),
        hintStyle: const TextStyle(color: muted),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: accent, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: danger),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          backgroundColor: accent,
          foregroundColor: const Color(0xFF141414),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: text,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          textStyle: const TextStyle(fontWeight: FontWeight.w600),
          side: const BorderSide(color: border),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: panel,
        contentTextStyle: TextStyle(color: text),
      ),
      chipTheme: ChipThemeData(
        backgroundColor: panel2,
        selectedColor: panel,
        side: const BorderSide(color: border),
        labelStyle: const TextStyle(color: text, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: bg2,
        indicatorColor: panel,
        labelTextStyle: MaterialStateProperty.resolveWith(
          (states) => TextStyle(
            color: states.contains(MaterialState.selected) ? text : muted,
            fontWeight: FontWeight.w600,
          ),
        ),
        iconTheme: MaterialStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(MaterialState.selected) ? accent : muted,
          ),
        ),
      ),
      dividerTheme: const DividerThemeData(color: border, thickness: 1, space: 24),
      listTileTheme: const ListTileThemeData(
        textColor: text,
        iconColor: muted,
      ),
    );
  }
}
