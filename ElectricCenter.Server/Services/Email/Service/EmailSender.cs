using ElectricCenter.Server.Services.Email.Interface;
using System.Net;
using System.Net.Mail;

namespace ElectricCenter.Server.Services.Email.Service
{
    public class EmailSender: IEmailSender
    {
        public Task SendEmailAsync(string email, string subject, string message)
        {
            var mail = "aQ9zXp7r@mail.com";
            var pw = "!9$dY2*gH7kL";

            var client = new SmtpClient("smtp.mail.com", 587)
            {
                Credentials = new NetworkCredential(mail, pw),
                EnableSsl = true
            };

            return client.SendMailAsync(
                new MailMessage(
                    from: mail,
                    to: email,
                    subject: subject,
                    message
                    ));
        }
    }
}
