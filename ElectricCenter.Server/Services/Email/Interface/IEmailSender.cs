namespace ElectricCenter.Server.Services.Email.Interface
{
    public interface IEmailSender
    {
        /// <param name="email">Recipient address.</param>
        /// <param name="subject">Subject line.</param>
        /// <param name="message">Plain-text body.</param>
        /// <param name="htmlMessage">Optional HTML alternative; mail clients that render HTML show this instead.</param>
        Task SendEmailAsync(string email, string subject, string message, string? htmlMessage = null);
    }
}
