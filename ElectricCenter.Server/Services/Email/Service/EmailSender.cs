using ElectricCenter.Server.Services.Email.Interface;
using Microsoft.Extensions.Options;
using System.Net;
using System.Net.Mail;
using System.Net.Mime;

namespace ElectricCenter.Server.Services.Email.Service
{
    /// <summary>Bound from "Email:Smtp". Credentials come from user-secrets or environment variables, never source code.</summary>
    public sealed class SmtpOptions
    {
        public const string SectionName = "Email:Smtp";

        public string Host { get; set; } = string.Empty;
        public int Port { get; set; } = 587;
        public string UserName { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string FromAddress { get; set; } = string.Empty;
        public string FromName { get; set; } = "Panchamukhi Electric Center";
        public bool EnableSsl { get; set; } = true;

        public bool IsConfigured => !string.IsNullOrWhiteSpace(Host) && !string.IsNullOrWhiteSpace(FromAddress);
    }

    /// <summary>Sends mail over SMTP (e.g. Gmail: smtp.gmail.com:587 with an App Password). See docs/AUTH.md.</summary>
    public class EmailSender(IOptions<SmtpOptions> options) : IEmailSender
    {
        public async Task SendEmailAsync(string email, string subject, string message, string? htmlMessage = null)
        {
            var smtp = options.Value;
            if (!smtp.IsConfigured)
            {
                throw new InvalidOperationException("SMTP is not configured. Set Email:Smtp:Host, FromAddress, UserName and Password (user-secrets or environment variables).");
            }

            using var client = new SmtpClient(smtp.Host, smtp.Port)
            {
                Credentials = new NetworkCredential(smtp.UserName, smtp.Password),
                EnableSsl = smtp.EnableSsl,
                Timeout = 15_000,
            };
            using var mail = new MailMessage
            {
                From = new MailAddress(smtp.FromAddress, smtp.FromName),
                Subject = subject,
                Body = message,
                IsBodyHtml = false,
            };
            mail.To.Add(email);
            if (htmlMessage is not null)
            {
                mail.AlternateViews.Add(AlternateView.CreateAlternateViewFromString(htmlMessage, null, MediaTypeNames.Text.Html));
            }

            await client.SendMailAsync(mail);
        }
    }

    /// <summary>
    /// Development-only stand-in used when SMTP isn't configured: writes each email
    /// (including OTP codes) to the server log instead of sending it.
    /// </summary>
    public class DevelopmentEmailSender(ILogger<DevelopmentEmailSender> logger) : IEmailSender
    {
        public Task SendEmailAsync(string email, string subject, string message, string? htmlMessage = null)
        {
            logger.LogWarning(
                "SMTP not configured, so this email was NOT sent. To: {To} | Subject: {Subject}{NewLine}{Body}",
                email, subject, Environment.NewLine, message);
            return Task.CompletedTask;
        }
    }
}
