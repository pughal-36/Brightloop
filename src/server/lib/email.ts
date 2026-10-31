import "server-only";

export interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(
      `[Email] To: ${options.to} | Subject: ${options.subject}${
        options.text ? ` | Text: ${options.text}` : ""
      }`
    );
  }
}

