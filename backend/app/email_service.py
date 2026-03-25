"""
Email service for submission verification via Resend.
"""

import logging
import os
from uuid import UUID

import resend

logger = logging.getLogger(__name__)

RESEND_API_KEY: str | None = os.environ.get("RESEND_API_KEY")
FROM_EMAIL: str = os.environ.get(
    "RESEND_FROM_EMAIL",
    "Musician Genealogy Project <noreply@mail.musician-genealogy.org>",
)
APP_BASE_URL: str = os.environ.get("APP_BASE_URL", "http://localhost:5173")

if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY


def _build_verification_html(
    verification_token: UUID,
    musician_name: str | None = None,
) -> str:
    """Return the HTML body for a submission-verification email."""

    verify_url = f"{APP_BASE_URL}/submissions/verify/{verification_token}"
    expiry_days = int(os.environ.get("VERIFICATION_TOKEN_EXPIRY_DAYS", "7"))

    subject_line = (
        f"your submission for {musician_name}"
        if musician_name
        else "your submission"
    )

    return f"""\
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,
'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background-color:#f4f4f5;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;margin:40px auto;background:#ffffff;
                border-radius:8px;overflow:hidden;
                border:1px solid #e4e4e7;">
    <tr>
      <td style="padding:32px 40px 0;">
        <h1 style="margin:0 0 8px;font-size:22px;color:#18181b;">
          Musician Genealogy Project
        </h1>
        <p style="margin:0 0 24px;font-size:14px;color:#71717a;">
          Verify {subject_line}
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px;">
        <p style="font-size:15px;line-height:1.6;color:#27272a;">
          Thanks for contributing! Please confirm your email address so our
          editors can review your submission.
        </p>

        <table role="presentation" cellpadding="0" cellspacing="0"
               style="margin:24px 0;">
          <tr>
            <td style="border-radius:6px;background:#18181b;">
              <a href="{verify_url}"
                 style="display:inline-block;padding:12px 28px;
                        font-size:15px;font-weight:600;color:#ffffff;
                        text-decoration:none;border-radius:6px;">
                Verify my submission
              </a>
            </td>
          </tr>
        </table>

        <p style="font-size:13px;line-height:1.5;color:#71717a;">
          Or copy and paste this link into your browser:<br>
          <a href="{verify_url}" style="color:#3b82f6;word-break:break-all;">
            {verify_url}
          </a>
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:24px 40px 32px;">
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 16px;">
        <p style="font-size:12px;line-height:1.5;color:#a1a1aa;margin:0;">
          This link expires in {expiry_days} days. If you didn't submit
          anything, you can safely ignore this email &mdash; the submission
          will be automatically removed.
        </p>
      </td>
    </tr>
  </table>

</body>
</html>"""


def _build_verification_text(
    verification_token: UUID,
    musician_name: str | None = None,
) -> str:
    """Plain-text fallback for email clients that don't render HTML."""
    verify_url = f"{APP_BASE_URL}/submissions/verify/{verification_token}"
    expiry_days = int(os.environ.get("VERIFICATION_TOKEN_EXPIRY_DAYS", "7"))
    subject = (
        f"your submission for {musician_name}"
        if musician_name
        else "your submission"
    )
    return (
        f"Musician Genealogy Project — Verify {subject}\n\n"
        f"Thanks for contributing! Please confirm your email by visiting:\n\n"
        f"  {verify_url}\n\n"
        f"This link expires in {expiry_days} days. If you didn't submit "
        f"anything, you can safely ignore this email.\n"
    )


async def send_verification_email(
    to_email: str,
    verification_token: UUID,
    musician_name: str | None = None,
) -> dict | None:
    """
    Send a verification email for a community submission.

    Returns Resend API response dict on success, None if Resend is not configured.
    """
    if not RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not set — skipping verification email to %s (token=%s)",
            to_email,
            verification_token,
        )
        return None

    subject = (
        f"Verify your submission for {musician_name} — Musician Genealogy Project"
        if musician_name
        else "Verify your submission — Musician Genealogy Project"
    )

    params: resend.Emails.SendParams = {
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": _build_verification_html(verification_token, musician_name),
        "text": _build_verification_text(verification_token, musician_name),
        "tags": [
            {"name": "category", "value": "verification"},
            {"name": "project", "value": "musician-genealogy"},
        ],
    }

    try:
        response = await resend.Emails.send_async(params)
        logger.info(
            "Verification email sent to %s (resend_id=%s, token=%s)",
            to_email,
            response.get("id") if isinstance(response, dict) else response,
            verification_token,
        )
        return response
    except Exception:
        logger.exception("Failed to send verification email to %s", to_email)
        raise
