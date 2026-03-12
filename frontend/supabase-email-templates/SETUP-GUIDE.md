# Hướng dẫn cấu hình Email Supabase

## Bước 1: Bật Email Confirmation

1. Vào **Supabase Dashboard** → https://supabase.com/dashboard
2. Chọn project `qkffdrupbzgmdytklznd`
3. Vào **Authentication** → **Providers** → **Email**
4. Bật **"Confirm email"** (Enable email confirmations)
5. Save

## Bước 2: Cập nhật Email Templates

### Template: Confirm signup
1. Vào **Authentication** → **Email Templates** → **Confirm signup**
2. **Subject**: `Xác nhận tài khoản - Gia Phả Họ Nguyễn Duy`
3. **Body**: Copy nội dung file `confirmation.html` vào đây
4. Save

### Template: Reset password
1. Vào **Email Templates** → **Reset password**
2. **Subject**: `Đặt lại mật khẩu - Gia Phả Họ Nguyễn Duy`
3. **Body**: Copy nội dung file `reset-password.html` vào đây
4. Save

## Bước 3 (Khuyến nghị): Cấu hình Custom SMTP với Resend

Supabase free plan chỉ gửi được **4 email/giờ** (rate limit). Để gỡ giới hạn và có sender domain chuyên nghiệp:

### Đăng ký Resend (FREE - 100 emails/ngày, 3000/tháng)
1. Vào https://resend.com → Sign up
2. Vào **API Keys** → tạo API key → lưu lại
3. Vào **Domains** → Add domain (hoặc dùng domain miễn phí `onboarding@resend.dev`)

### Cấu hình SMTP trong Supabase
1. Vào **Supabase Dashboard** → **Project Settings** → **Authentication**
2. Scroll xuống **SMTP Settings** → Enable Custom SMTP
3. Điền thông tin:
   - **Sender email**: `giapha@yourdomain.com` (hoặc email bạn muốn)
   - **Sender name**: `Gia Phả Họ Nguyễn Duy`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Username**: `resend`
   - **Password**: `re_xxxxxxxxxx` (API key từ Resend)
4. Save

### Lợi ích
- Email gửi từ domain của bạn (không phải `noreply@mail.app.supabase.io`)
- Không bị rate limit 4 email/giờ
- Email ít bị vào Spam hơn
- **Chi phí: $0** (free tier đủ cho gia phả)

## Các giải pháp SMTP thay thế (cũng miễn phí)

| Service | Free Tier | SMTP Host |
|---------|-----------|-----------|
| **Resend** | 100/ngày, 3000/tháng | smtp.resend.com |
| **Brevo** | 300/ngày | smtp-relay.brevo.com |
| **Mailgun** | 100/ngày (trial) | smtp.mailgun.org |

## Lưu ý

- Sau khi cấu hình SMTP, tất cả email (confirm, reset, invite) sẽ đi qua SMTP provider
- Email templates vẫn quản lý trong Supabase Dashboard
- Nếu không cấu hình SMTP, Supabase vẫn gửi được nhưng bị giới hạn 4 email/giờ
