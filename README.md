# GMail Export Utility

A command-line utility to export emails from GMail to markdown files.

## Installation

You can run this utility directly using npx:

```bash
npx @tobrien/gmexport
```

Or install it globally:

```bash
npm install -g @tobrien/gmexport
```

## Usage

The utility requires a configuration file (default: `config.yaml`) and an output directory (default: `./exports`).

Basic usage:
```bash
npx @tobrien/gmexport
```

With custom config and output:
```bash
npx @tobrien/gmexport --config ./my-config.yaml --output ./my-exports
```

### Command Line Options

- `--config <path>`: Path to configuration file (default: ./config.yaml)
- `--output <path>`: Output directory for exported emails (default: ./exports)
- `--start <date>`: Start date in YYYY-MM-DD format
- `--end <date>`: End date in YYYY-MM-DD format
- `--current-month`: Export emails from the current month
- `--dry-run`: Show what would be exported without actually exporting

## Configuration

Create a `config.yaml` file with your GMail API credentials:

```yaml
client_id: "your-client-id"
client_secret: "your-client-secret"
redirect_uri: "http://localhost:3000/oauth2callback"
```

## License

Apache-2.0
