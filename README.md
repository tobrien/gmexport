# GMExport

A command-line tool for exporting emails from your Gmail account. This tool allows you to download your Gmail messages, including attachments, and save them in a structured format.

## Features

- Export emails from Gmail to local storage
- Support for downloading email attachments
- Configurable export options (date range, labels, etc.)
- Structured output format
- Progress tracking and logging
- Secure authentication using Google OAuth2

## Prerequisites

- Node.js (v14 or higher)
- Yarn package manager
- A Google Cloud Project with Gmail API enabled
- OAuth 2.0 credentials from Google Cloud Console

## Installation

1. Clone the repository:
```bash
git clone https://github.com/tobrien/gmexport.git
cd gmexport
```

2. Install dependencies:
```bash
yarn install
```

3. Build the project:
```bash
yarn build
```

## Configuration

1. Create a Google Cloud Project and enable the Gmail API
2. Create OAuth 2.0 credentials and download them
3. Create a `.env` file in the project root with your credentials:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=your_redirect_uri
```

## Generating Google Cloud Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select an existing one
3. Enable the Gmail API:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop application" as the application type
   - Give it a name (e.g. "Gmail Export Tool")
   - Click "Create"
5. Download the credentials:
   - Find your newly created OAuth 2.0 Client ID
   - Click the download icon (⬇️) to download the JSON file
   - Save it as `credentials.json` in your project directory

## First-Time Authentication

When you first run the tool, it will:

1. Open your default browser to a Google authentication page
2. Ask you to sign in and grant permissions to access your Gmail
3. After approval, Google will redirect you to a URL containing an authorization code
4. Copy the entire URL and paste it back into the terminal when prompted
5. The tool will save the token for future use, so you won't need to authenticate again unless the token expires

For example:

## Usage

The tool can be used from the command line with various options:

```bash
yarn start [options]
```

### Command Line Options

- `--output <path>`: Specify the output directory for exported emails
- `--start-date <date>`: Start date for email export (YYYY-MM-DD)
- `--end-date <date>`: End date for email export (YYYY-MM-DD)
- `--labels <labels>`: Comma-separated list of Gmail labels to export
- `--format <format>`: Output format (default: "eml")
- `--verbose`: Enable verbose logging
- `--help`: Display help information

### Example Usage

```bash
# Export all emails from the last 30 days
yarn start --output ./exports --start-date 2024-02-27

# Export specific labels
yarn start --output ./exports --labels "INBOX,SENT"

# Export with custom date range
yarn start --output ./exports --start-date 2024-01-01 --end-date 2024-02-27
```

## Output Structure

Exported emails will be organized in the following structure:

## Development

- `yarn dev`: Start development mode with watch
- `yarn test`: Run tests
- `yarn lint`: Run ESLint
- `yarn build`: Build the project

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## Author

Tobin O'Brien <tobrien@discursive.com>
