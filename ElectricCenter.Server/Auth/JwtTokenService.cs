using System.Security.Claims;
using ElectricCenter.Server.Data.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace ElectricCenter.Server.Auth
{
    public sealed record AccessToken(string Token, DateTime ExpiresAtUtc);

    public interface IJwtTokenService
    {
        AccessToken CreateAccessToken(User user);
    }

    public sealed class JwtTokenService(IOptions<JwtOptions> options, TimeProvider timeProvider) : IJwtTokenService
    {
        private readonly JsonWebTokenHandler _handler = new();

        public AccessToken CreateAccessToken(User user)
        {
            var jwt = options.Value;
            var now = timeProvider.GetUtcNow().UtcDateTime;
            var expires = now.AddMinutes(jwt.AccessTokenMinutes);

            var claims = new List<Claim>
            {
                new(AuthClaims.Subject, user.Id.ToString()),
                new(AuthClaims.Email, user.Email),
                new(AuthClaims.Name, user.FullName),
                new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };
            // One claim per role; the handler serializes repeats as a JSON array.
            claims.AddRange(user.Roles.Select(r => new Claim(AuthClaims.Role, r.Role)));

            var token = _handler.CreateToken(new SecurityTokenDescriptor
            {
                Issuer = jwt.Issuer,
                Audience = jwt.Audience,
                Subject = new ClaimsIdentity(claims),
                IssuedAt = now,
                NotBefore = now,
                Expires = expires,
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(jwt.SigningKeyBytes), SecurityAlgorithms.HmacSha256),
            });

            return new AccessToken(token, expires);
        }

        /// <summary>Validation rules shared by the JwtBearer middleware and the tests.</summary>
        public static TokenValidationParameters CreateValidationParameters(JwtOptions jwt) => new()
        {
            ValidIssuer = jwt.Issuer,
            ValidAudience = jwt.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(jwt.SigningKeyBytes),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = AuthClaims.Name,
            RoleClaimType = AuthClaims.Role,
        };
    }
}
