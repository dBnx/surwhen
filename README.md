# SurWhen

A simple survey application with hash-based invitation links. Surveys are accessed via unique invitation links derived from survey titles, ensuring only invited users can participate.

## Intended Use

SurWhen enables you to create private surveys that can only be accessed through invitation links. Each survey has a unique hash-based URL, preventing unauthorized access while avoiding the need for passwords or authentication systems. Perfect for gathering feedback, registrations, or any scenario where you want controlled access without complex user management.

## How It Works

- Surveys are configured in `surveys.json`
- Each survey title generates a unique hash used in the invitation URL
- Invalid or expired links show an error page
- Form submissions are sent via email (SMTP) to configured recipients
- Email addresses can be CC'd to the submitter if provided

## Configuration

### Surveys

Edit `surveys.json` to define your surveys:

```json
{
  "defaultTargetEmail": "recipient@example.com",
  "surveys": [
    {
      "title": "Survey Title (must be unique)",
      "description": "Survey description shown to users",
      "reasons": ["Option 1", "Option 2", "Option 3"],
      "targetEmail": "specific@example.com"
    }
  ]
}
```

- `defaultTargetEmail`: Used when a survey doesn't specify `targetEmail`
- `title`: Must be unique (used to generate the invitation hash)
- `targetEmail`: Optional per survey; falls back to `defaultTargetEmail`

### Environment Variables

Create a `.env` file with SMTP configuration:

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
SMTP_FROM=your-email@example.com
```

## Setup

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Configure surveys in `surveys.json`

3. Set environment variables in `.env`

4. Run the development server:
   ```bash
   pnpm dev
   ```

## Generating Invitation Links

The invitation hash is the first 16 characters of the SHA256 hash of the survey title. You can generate it using:

```bash
node -e "const crypto = require('crypto'); console.log(crypto.createHash('sha256').update('Your Survey Title').digest('hex').substring(0, 16))"
```

The invitation URL format is: `/survey/{hash}`

For example, if your survey title is "Feedback Survey" and the hash is `a1b2c3d4e5f6g7h8`, the link would be:
`https://yourdomain.com/survey/a1b2c3d4e5f6g7h8`

## Tech Stack

Built with [T3 Stack](https://create.t3.gg/):
- Next.js 15
- TypeScript
- Tailwind CSS
- Nodemailer (SMTP)
