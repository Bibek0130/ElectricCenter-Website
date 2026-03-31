using ElectricCenter.Server.Services.Email.Interface;
using System.Net;
using System.Net.Mail;

namespace ElectricCenter.Server.Services.Email.Service
{
    public class EmailSender: IEmailSender
    {
        public Task SendEmailAsync(string email, string subject, string message)
        {
            var mail = "mainalibibek2nd@gmail.com";
            var pw = "Password_chaidainah01";

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
