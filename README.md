# API Credential Manager

A secure desktop application for guiding users through obtaining, managing, and securely storing API keys and OAuth tokens for various services commonly used in AI agent frameworks.

## Features

- **Step-by-step Wizard UI**: Guides users through the process of obtaining API keys and OAuth tokens for popular services
- **Local Encrypted Storage**: All credentials are stored securely on the user's device with strong encryption
- **OAuth Integration**: Handles OAuth flows with secure local redirect server
- **Browser Automation**: Optional automation for tedious credential retrieval steps
- **Cross-Framework Support**: Helps set up credentials for various AI frameworks (LangChain, AutoGPT, etc.)
- **Plugin Architecture**: Easy to extend with new services

## Supported Services

- **OpenAI API**: API keys for GPT-4, DALL-E, and other OpenAI services
- **Google Cloud**: OAuth setup for Google APIs and services
- **Signal**: Integration with Signal messaging via CallMeBot
- **Slack**: Bot token setup for Slack automation
- *More services coming soon...*

## Security

This application takes security seriously:

- **Zero Cloud Storage**: All credentials stay on your device
- **Strong Encryption**: Uses Web Crypto API and OS-level secure storage
- **OS Keychain Integration**: Leverages your operating system's secure credential store
- **Transparent Code**: Open architecture for verification
- **Secure Exports**: Password-protected export for backups

## Getting Started

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rogu3bear/api-credential-manager.git
cd api-credential-manager
```

2. Install dependencies:
```bash
npm install
```

3. Start the development version:
```bash
# Start Electron app with React UI
npm run start:electron
```

### Building for Production

```bash
# Build React frontend
npm run build

# Package Electron app
npm run package
```

## Development

The project is structured as follows:

- `frontend/`: React application with TypeScript and TailwindCSS
- `backend/`: Electron application with Node.js features
- `plugins/`: Service definitions for different API providers

### Adding a New Service

1. Create a new plugin definition in `plugins/your-service.json`
2. If needed, add automation script in `backend/automator/your-service.ts`
3. Add a flow component in `frontend/src/flows/YourServiceFlow.tsx`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Electron for providing the desktop app framework
- React for the frontend interface
- Playwright for browser automation capabilities
- keytar for secure OS-level credential storage 