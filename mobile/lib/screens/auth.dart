import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../data/api.dart';
import '../ui/design.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.api, required this.onLogin});
  final PaperApi api;
  final ValueChanged<Json> onLogin;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final email = TextEditingController(), password = TextEditingController();
  final form = GlobalKey<FormState>();
  bool register = false, busy = false, obscure = true;
  bool googleInitialized = false;
  Object? error;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) return;
    FocusScope.of(context).unfocus();
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final user = await widget.api.signIn(
        email.text,
        password.text,
        register: register,
      );
      if (mounted) widget.onLogin(user);
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> signInWithGoogle() async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final config = await widget.api.googleConfig();
      final clientId = textOf(config, 'client_id');
      if (clientId.isEmpty) {
        throw ApiFailure('Đăng nhập Google chưa được cấu hình.');
      }
      if (!googleInitialized) {
        await GoogleSignIn.instance.initialize(serverClientId: clientId);
        googleInitialized = true;
      }
      final account = await GoogleSignIn.instance.authenticate();
      final credential = account.authentication.idToken;
      if (credential == null || credential.isEmpty) {
        throw ApiFailure(
          'Google không trả thông tin đăng nhập. Vui lòng thử lại.',
        );
      }
      final user = await widget.api.signInWithGoogle(credential);
      if (mounted) widget.onLogin(user);
    } on GoogleSignInException catch (e) {
      if (mounted && e.code != GoogleSignInExceptionCode.canceled) {
        setState(
          () => error = ApiFailure(
            'Không thể đăng nhập Google. Vui lòng thử lại.',
          ),
        );
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(
                      Icons.auto_stories_rounded,
                      color: teal,
                      size: 30,
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'PaperFlow',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ],
                ),
                const ResearchArt(height: 210),
                Text(
                  register
                      ? 'Ý tưởng của bạn.\nKhởi đầu tại đây.'
                      : 'Từ ý tưởng\nđến bằng chứng.',
                  style: Theme.of(context).textTheme.displaySmall,
                ),
                const SizedBox(height: 10),
                const Text(
                  'Một nơi cho đề tài, tài liệu và bài viết.',
                  style: TextStyle(color: muted),
                ),
                const SizedBox(height: 24),
                AutofillGroup(
                  child: Form(
                    key: form,
                    child: Column(
                      children: [
                        TextFormField(
                          key: const Key('email'),
                          controller: email,
                          enabled: !busy,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          textInputAction: TextInputAction.next,
                          maxLength: 254,
                          decoration: const InputDecoration(
                            labelText: 'Email',
                            prefixIcon: Icon(Icons.alternate_email),
                            counterText: '',
                          ),
                          validator: (v) =>
                              RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                                  .hasMatch((v ?? '').trim())
                              ? null
                              : 'Nhập email hợp lệ',
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          key: const Key('password'),
                          controller: password,
                          enabled: !busy,
                          obscureText: obscure,
                          autofillHints: [
                            register
                                ? AutofillHints.newPassword
                                : AutofillHints.password,
                          ],
                          maxLength: 128,
                          decoration: InputDecoration(
                            labelText: 'Mật khẩu',
                            helperText: 'Ít nhất 3 ký tự',
                            counterText: '',
                            prefixIcon: const Icon(Icons.lock_outline_rounded),
                            suffixIcon: IconButton(
                              tooltip: obscure
                                  ? 'Hiện mật khẩu'
                                  : 'Ẩn mật khẩu',
                              onPressed: () =>
                                  setState(() => obscure = !obscure),
                              icon: Icon(
                                obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                          validator: (v) => (v ?? '').length >= 3
                              ? null
                              : 'Mật khẩu cần ít nhất 3 ký tự',
                          onFieldSubmitted: (_) => submit(),
                        ),
                      ],
                    ),
                  ),
                ),
                if (error != null) ErrorNotice(error!),
                const SizedBox(height: 18),
                if (busy)
                  Working(register ? 'Đang tạo tài khoản…' : 'Đang đăng nhập…'),
                if (!busy)
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      key: const Key('auth-submit'),
                      onPressed: submit,
                      icon: const Icon(Icons.arrow_forward_rounded),
                      label: Text(register ? 'Tạo tài khoản' : 'Đăng nhập'),
                    ),
                  ),
                if (!busy && Platform.isAndroid) ...[
                  const SizedBox(height: 12),
                  const Row(
                    children: [
                      Expanded(child: Divider()),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Text(
                          'hoặc',
                          style: TextStyle(color: muted, fontSize: 12),
                        ),
                      ),
                      Expanded(child: Divider()),
                    ],
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: signInWithGoogle,
                      icon: const Icon(Icons.login_rounded),
                      label: const Text('Tiếp tục với Google'),
                    ),
                  ),
                ],
                Center(
                  child: TextButton(
                    onPressed: busy
                        ? null
                        : () => setState(() {
                            register = !register;
                            error = null;
                          }),
                    child: Text(
                      register
                          ? 'Đã có tài khoản? Đăng nhập'
                          : 'Chưa có tài khoản? Đăng ký',
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.shield_outlined, size: 18, color: muted),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Dùng cùng tài khoản với web. Dự án được đồng bộ khi có mạng.',
                        style: TextStyle(color: muted, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
