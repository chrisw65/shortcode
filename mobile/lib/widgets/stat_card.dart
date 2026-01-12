import 'package:flutter/material.dart';

class StatCard extends StatelessWidget {
  final String label;
  final String value;
  final String? helper;
  final IconData? icon;

  const StatCard({
    super.key,
    required this.label,
    required this.value,
    this.helper,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            if (icon != null) ...[
              CircleAvatar(
                radius: 18,
                backgroundColor: Theme.of(context).colorScheme.secondary.withOpacity(0.15),
                child: Icon(icon, size: 18),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: Theme.of(context).textTheme.bodyMedium),
                  const SizedBox(height: 6),
                  Text(
                    value,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (helper != null) ...[
                    const SizedBox(height: 4),
                    Text(
                      helper!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
