# Evenlyo-BACKEND

This is the backend for the Evenlyo project.

## Project Structure

- Add details about the folder structure and main components here.

## Setup

1. Clone the repository.
2. Install dependencies (add instructions here).
3. Run the backend server (add instructions here).

## Features

- **User Authentication**: Email/password login and registration for clients, vendors, and admins
- **Google Authentication**: Social login using Firebase Authentication
- **Session Management**: Secure session-based authentication
- **Role-based Access**: Different user types (client, vendor, admin) with appropriate permissions
- **OTP Verification**: Email-based OTP for registration and password reset
- **Rate Limiting**: Protection against brute force attacks
- **CSRF Protection**: Cross-site request forgery protection

### Authentication Endpoints

- `POST /api/auth/login` - Email/password login (blocked for Google users)
- `POST /api/auth/google` - Google OAuth login/registration
- `POST /api/auth/logout` - Logout
- `POST /api/auth/client/register` - Client registration
- `POST /api/auth/vendor/register` - Vendor registration
- `POST /api/auth/send-forgot-otp` - Send password reset OTP (blocked for Google users)
- `POST /api/auth/verify-forgot-otp` - Verify password reset OTP (blocked for Google users)
- `POST /api/auth/reset-password` - Reset password (blocked for Google users)
- `GET /api/auth/me` - Get current user info

For detailed Google Authentication setup, see [GOOGLE_AUTH_SETUP.md](GOOGLE_AUTH_SETUP.md).

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

Add license information here.
