"""
Email service for submission emails via Resend.
Handles verification, approval, and rejection notifications.
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

    verify_url = f"{APP_BASE_URL}/api/v1/submissions/verify/{verification_token}"
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
    verify_url = f"{APP_BASE_URL}/api/v1/submissions/verify/{verification_token}"
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


# --------------------------------------------------------------------------- #
#  Approval / rejection notification emails
# --------------------------------------------------------------------------- #

def _build_decision_html(
    decision: str,
    musician_name: str | None = None,
    editor_notes: str | None = None,
) -> str:
    """Return the HTML body for an approval or rejection notification."""

    if decision == "approved":
        heading = "Your submission has been approved!"
        body_text = (
            "Great news — your submission has been reviewed and approved by our editors. "
            "The information is now live on the site."
        )
        if musician_name:
            browse_url = f"{APP_BASE_URL}/search?q={musician_name.replace(' ', '+')}"
            body_text += (
                f'<br><br><a href="{browse_url}" style="color:#3b82f6;">'
                f"Search for {musician_name} on the site</a>"
            )
    else:
        heading = "Update on your submission"
        body_text = (
            "Thank you for your contribution. After review, our editors were unable "
            "to approve this submission at this time."
        )

    notes_section = ""
    if editor_notes:
        notes_section = f"""\
        <p style="font-size:14px;line-height:1.5;color:#52525b;
                  background:#f4f4f5;border-radius:6px;padding:12px 16px;
                  margin:16px 0 0;">
          <strong>Editor notes:</strong> {editor_notes}
        </p>"""

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
          {heading}
        </p>
      </td>
    </tr>

    <tr>
      <td style="padding:0 40px;">
        <p style="font-size:15px;line-height:1.6;color:#27272a;">
          {body_text}
        </p>
        {notes_section}
      </td>
    </tr>

    <tr>
      <td style="padding:24px 40px 32px;">
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 16px;">
        <p style="font-size:12px;line-height:1.5;color:#a1a1aa;margin:0;">
          Thank you for helping build the Musician Genealogy Project.
        </p>
      </td>
    </tr>
  </table>

</body>
</html>"""


def _build_decision_text(
    decision: str,
    musician_name: str | None = None,
    editor_notes: str | None = None,
) -> str:
    """Plain-text fallback for decision notifications."""
    if decision == "approved":
        intro = "Great news — your submission has been reviewed and approved by our editors. The information is now live on the site."
    else:
        intro = "Thank you for your contribution. After review, our editors were unable to approve this submission at this time."

    text = f"Musician Genealogy Project\n\n{intro}\n"

    if editor_notes:
        text += f"\nEditor notes: {editor_notes}\n"

    text += "\nThank you for helping build the Musician Genealogy Project.\n"
    return text


async def send_decision_email(
    to_email: str,
    decision: str,
    musician_name: str | None = None,
    editor_notes: str | None = None,
) -> dict | None:
    """
    Send an approval or rejection notification email.

    Args:
        to_email:      Submitter's email address.
        decision:      "approved" or "rejected".
        musician_name: Optional musician name for context.
        editor_notes:  Optional editor notes (shown for rejections).
    """
    if not RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not set — skipping %s notification to %s",
            decision,
            to_email,
        )
        return None

    if decision == "approved":
        subject = (
            f"Your submission for {musician_name} has been approved!"
            if musician_name
            else "Your submission has been approved! — Musician Genealogy Project"
        )
    else:
        subject = (
            f"Update on your submission for {musician_name} — Musician Genealogy Project"
            if musician_name
            else "Update on your submission — Musician Genealogy Project"
        )

    params: resend.Emails.SendParams = {
        "from": FROM_EMAIL,
        "to": [to_email],
        "subject": subject,
        "html": _build_decision_html(decision, musician_name, editor_notes),
        "text": _build_decision_text(decision, musician_name, editor_notes),
        "tags": [
            {"name": "category", "value": decision},
            {"name": "project", "value": "musician-genealogy"},
        ],
    }

    try:
        response = await resend.Emails.send_async(params)
        logger.info(
            "%s notification sent to %s (resend_id=%s)",
            decision.capitalize(),
            to_email,
            response.get("id") if isinstance(response, dict) else response,
        )
        return response
    except Exception:
        logger.exception("Failed to send %s notification to %s", decision, to_email)
        raise
