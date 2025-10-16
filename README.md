# Evenlyo-BACKEND

This is the backend for the Evenlyo project.

## Project Structure

- Add details about the folder structure and main components here.

## Setup


## JWT Authentication Migration

The API now uses stateless JSON Web Tokens (JWT) for authentication. All session middleware has been removed.

### New Endpoints / Responses

1. Login (`POST /api/auth/login` or role-specific logins) now returns:
```json
{
	"success": true,
	"message": "Login successful",
		"tokens": { "access": "<JWT>" },
	"user": { "id": "...", "email": "...", "userType": "client" }
}
```
2. Google auth returns the same structure with `tokens`.
3. Password reset flow:
	 - Verify OTP (`/api/auth/forgot/verify`) now returns `{ resetToken: "<short-lived JWT>" }`.
	 - Reset password: send `{ password: "newPass", resetToken: "<received JWT>" }`.

### Client Usage

Store access token (preferably in memory, NOT localStorage if you can avoid XSS). Send the access token in each request:

```
Authorization: Bearer <access_token>
```

When the token expires (401), prompt the user to login again since refresh tokens are disabled by design in this deployment.

### Environment Variables

Add the following to your `.env` (generate strong secrets):

```
JWT_ACCESS_SECRET=replace_with_strong_random
JWT_PASSWORD_RESET_SECRET=replace_with_strong_random
JWT_ACCESS_EXPIRES_IN=15m
JWT_PASSWORD_RESET_EXPIRES_IN=10m
```

### Transition Notes

Stateless: No `express-session` usage. Logout is handled entirely client-side by discarding the token.

### Security Recommendations

- Keep access tokens short-lived (<= 15m).
- Rotate secrets periodically.
- Handle logout client-side by deleting stored tokens (server does not need state for JWT logout unless implementing a denylist).
- **Google Authentication**: Social login using Firebase Authentication
<!-- Session Management feature removed after JWT migration -->
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

## Subcategory Payment Settings

Admin can configure payment-related controls per subcategory:

- escrowEnabled: boolean. If true, client pays an upfront percent of total before confirmation; remaining amount is held and released after a configured number of hours.
- upfrontFeePercent: number 0-100. Percent of total price to be paid upfront when escrow is enabled.
- upfrontHour: number >= 0. Hours after which the remaining escrow is released.
- evenlyoProtectFeePercent: number 0-100. Platform (Evenlyo Protect) fee percent at subcategory level.

Create subcategory

POST /api/admin/listings/create/subcategories

Body example:

{
	"name": { "en": "Hair Styling", "nl": "Haarstyling" },
	"icon": "scissors",
	"mainCategoryId": "<categoryId>",
	"description": { "en": "desc", "nl": "desc" },
	"escrowEnabled": true,
	"upfrontFeePercent": 30,
	"upfrontHour": 48,
	"evenlyoProtectFeePercent": 5
}

Validation rules:

- If escrowEnabled is true, upfrontFeePercent must be 1-100 and upfrontHour must be > 0.
- Percent values must be between 0 and 100 inclusive. Hours must be non-negative.
