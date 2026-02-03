import base64
import logging
from threading import Thread

import msal
import requests

from django.core.mail import get_connection, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags


logger = logging.getLogger(__name__)


class EmailUtils:
    @staticmethod
    def get_email_setting(_user):
        from apps.users.models import EmailSetting

        "User is not current used but in future may be get email setting based on user, so get at a params"
        return EmailSetting.objects.filter(status=True).first()


    @staticmethod
    def send_mail_using_smtp(email_settings, subject, template, to_emails, payload=None, attachments=None):
        email_backend = get_connection(
            host=email_settings.email_host,
            port=email_settings.email_port,
            username=email_settings.email_user,
            password=email_settings.email_password,
            use_tls=True,
            fail_silently=False,
        )

        # Render the email template
        html_message = render_to_string(f"{template}.html", payload or {})
        plain_message = strip_tags(html_message)

        # Send the email using the configured backend        
        email = EmailMultiAlternatives(
            subject=subject,
            body=plain_message,
            from_email=email_settings.email_user,
            to=to_emails,
            connection=email_backend,
        )

        email.attach_alternative(html_message, "text/html")

        for att in attachments or []:
            email.attach(
                att["filename"],
                att["content"],
                att.get("mimetype", "application/octet-stream"),
            )

        email.send()

    @staticmethod
    def send_mail_using_outlook(
        email_settings, subject, template, to_emails, payload=None, attachments=None
    ):
        GRAPH_URL = (
            f"https://graph.microsoft.com/v1.0/users/{email_settings.email}/sendMail"
        )
        app = msal.ConfidentialClientApplication(
            client_id=email_settings.client_id,
            authority=f"https://login.microsoftonline.com/{email_settings.tenant_id}",
            client_credential=email_settings.client_secret,
        )
        result = app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )
        ACCESS_TOKEN = result.get("access_token")
        if not ACCESS_TOKEN:
            logger.error("Failed to acquire access token.")
        else:
            # recipient_email = to_email

            message_body = render_to_string(f"{template}.html", payload or {})
            
            attachments_payload = []
            for att in attachments or []:
                attachments_payload.append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": att["filename"],
                    "contentType": att.get("mimetype", "application/octet-stream"),
                    "contentBytes": base64.b64encode(att["content"]).decode("utf-8"),
                })
                
            email_message = {
                "message": {
                    "subject": subject,
                    "body": {
                        "contentType": "HTML",
                        "content": message_body,
                    },
                    "toRecipients": [
                        {"emailAddress": {"address": email}} for email in to_emails
                    ],
                    "attachments": attachments_payload,
                }
            }

            response = requests.post(
                GRAPH_URL,
                headers={
                    "Authorization": f"Bearer {ACCESS_TOKEN}",
                    "Content-Type": "application/json",
                },
                data=email_message,
            )
            if response.status_code == 202:
                logger.info(f"Email successfully sent to {to_emails}")
            else:
                logger.error(f"Failed to send email to {to_emails}: {response.text}")


def send_email(user, subject, template, to_emails, payload=None, attachments=None, async_send=True):
   
    if not isinstance(to_emails, list):
        to_emails = [to_emails]
        
    logger.info(f"Sending email to.............. {to_emails}")
    def task():
        try:
            email_settings = EmailUtils.get_email_setting(user)
            if not email_settings:
                logger.error("No active email settings found.")
                return
            if email_settings.email_type == "smtp":
                EmailUtils.send_mail_using_smtp(
                    email_settings, subject, template, to_emails, payload, attachments
                )
            elif email_settings.email_type == "outlook":
                EmailUtils.send_mail_using_outlook(
                    email_settings, subject, template, to_emails, payload, attachments
                )
            else:
                logger.warning(f"Email type not supported: {email_settings.email_type}")

            logger.info(f"Email successfully sent to {to_emails}")

        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            
    if async_send:
        # Start the task in a separate thread to avoid blocking
        Thread(target=task, daemon=True).start()
    else:
        task()
