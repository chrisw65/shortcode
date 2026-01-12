import 'package:dio/dio.dart';
import 'package:oaklink_mobile/services/api_client.dart';

class AuthResult {
  final bool success;
  final bool requires2fa;
  final String? challengeToken;
  final String? error;

  AuthResult({required this.success, this.requires2fa = false, this.challengeToken, this.error});
}

class AuthService {
  AuthService._();

  static final AuthService instance = AuthService._();

  ApiClient get _api => ApiClient.instance;

  Future<AuthResult> login(String email, String password) async {
    try {
      await _api.ensureCsrf();
      final res = await _api.post('/api/auth/login', data: {
        'email': email,
        'password': password,
      });
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        return AuthResult(success: false, error: data['error']?.toString());
      }
      final payload = data['data'] as Map<String, dynamic>?;
      if (payload != null && payload['requires_2fa'] == true) {
        return AuthResult(
          success: false,
          requires2fa: true,
          challengeToken: payload['challenge_token']?.toString(),
        );
      }
      return AuthResult(success: true);
    } on DioException catch (err) {
      return AuthResult(success: false, error: err.response?.data?['error']?.toString() ?? err.message);
    } catch (err) {
      return AuthResult(success: false, error: err.toString());
    }
  }

  Future<AuthResult> confirm2fa(String challengeToken, String code) async {
    try {
      await _api.ensureCsrf();
      final res = await _api.post('/api/auth/2fa/confirm', data: {
        'challenge_token': challengeToken,
        'code': code,
      });
      final data = res.data as Map<String, dynamic>;
      if (data['success'] != true) {
        return AuthResult(success: false, error: data['error']?.toString());
      }
      return AuthResult(success: true);
    } on DioException catch (err) {
      return AuthResult(success: false, error: err.response?.data?['error']?.toString() ?? err.message);
    } catch (err) {
      return AuthResult(success: false, error: err.toString());
    }
  }

  Future<bool> hasSession() async {
    try {
      final res = await _api.get('/api/auth/me');
      final data = res.data as Map<String, dynamic>;
      return data['success'] == true;
    } catch (_) {
      return false;
    }
  }

  Future<void> logout() async {
    await _api.ensureCsrf();
    await _api.post('/api/auth/logout');
  }
}
