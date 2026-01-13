import 'dart:io';

import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';
import 'package:oaklink_mobile/services/session_manager.dart';

class ApiClient {
  static const String baseUrl = 'https://okleaf.link';
  static late ApiClient instance;

  late final Dio dio;
  late final CookieJar cookieJar;

  ApiClient._(this.dio, this.cookieJar);

  static Future<void> init() async {
    final dir = await getApplicationDocumentsDirectory();
    final jar = PersistCookieJar(storage: FileStorage('${dir.path}/cookies'));
    final dio = Dio(BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 10),
      receiveTimeout: const Duration(seconds: 15),
      headers: { 'Accept': 'application/json' },
    ));
    dio.interceptors.add(CookieManager(jar));
    dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        if (options.method.toUpperCase() != 'GET') {
          final token = await _getCsrfToken(jar);
          if (token != null) {
            options.headers['x-csrf-token'] = token;
          }
        }
        handler.next(options);
      },
      onError: (err, handler) {
        if (err.response?.statusCode == 401) {
          SessionManager.redirectToLogin();
        }
        handler.next(err);
      },
    ));

    instance = ApiClient._(dio, jar);
  }

  static Future<String?> _getCsrfToken(CookieJar jar) async {
    final cookies = await jar.loadForRequest(Uri.parse(baseUrl));
    for (final cookie in cookies) {
      if (cookie.name == 'csrf_token') return cookie.value;
    }
    return null;
  }

  Future<void> ensureCsrf() async {
    final token = await _getCsrfToken(cookieJar);
    if (token != null && token.isNotEmpty) return;
    await dio.get('/health');
  }

  Future<Response<dynamic>> get(String path, {Map<String, dynamic>? query}) {
    return dio.get(path, queryParameters: query);
  }

  Future<Response<dynamic>> post(String path, {dynamic data}) {
    return dio.post(path, data: data);
  }

  Future<Response<dynamic>> put(String path, {dynamic data}) {
    return dio.put(path, data: data);
  }

  Future<Response<dynamic>> delete(String path, {dynamic data}) {
    return dio.delete(path, data: data);
  }

  static String errorMessage(Object error) {
    if (error is DioException) {
      final data = error.response?.data;
      if (data is Map<String, dynamic> && data['error'] != null) {
        return data['error'].toString();
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout) {
        return 'Network timeout. Please try again.';
      }
      if (error.type == DioExceptionType.connectionError) {
        return 'Unable to reach the server. Check your connection.';
      }
      if (error.response?.statusCode == 401) {
        return 'Session expired. Please sign in again.';
      }
      return error.message ?? 'Request failed';
    }
    return error.toString();
  }
}
