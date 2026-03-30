namespace ElectricCenter.Server.Services.Email.Interface
{
    public interface IEmailSender
    {
        Task SendEmailAsync(string emial, string subject, string message);
    }
}
